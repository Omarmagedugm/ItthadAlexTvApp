import { Link } from 'react-router-dom';
import { useAppStore } from '../store';
import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { db, auth } from '../lib/firebase';
import { collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Send, Trash2, ShieldCheck, User, Loader2 } from 'lucide-react';

interface Comment {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  text: string;
  createdAt: any;
  role: string;
}

export default function Live() {
  const { liveStream, liveStreams, profile, users, appSettings } = useAppStore();
  const [selectedSport, setSelectedSport] = useState<'football' | 'basketball'>(() => {
    if (appSettings.liveViewMode === 'basketball') return 'basketball';
    return 'football';
  });

  useEffect(() => {
    if (appSettings.liveViewMode && appSettings.liveViewMode !== 'both') {
      setSelectedSport(appSettings.liveViewMode as 'football' | 'basketball');
    }
  }, [appSettings.liveViewMode]);
  
  const currentStream = selectedSport === 'basketball' ? liveStreams.basketball : liveStreams.football;
  const [chatMessage, setChatMessage] = useState('');
  const [comments, setComments] = useState<Comment[]>([]);
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'live_comments'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, { includeMetadataChanges: true }, (snapshot) => {
      const newComments = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Comment[];
      // Filter out comments without createdAt if the server hasn't set it yet
      // This happens momentarily during local optimistic updates
      const validComments = newComments.filter(c => c.createdAt !== null);
      setComments(validComments.reverse());
    }, (error) => {
      if (error.code !== 'permission-denied') {
        console.error("Snapshot error:", error);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [comments]);

  const handleSendMessage = async () => {
    if (!chatMessage.trim() || !auth.currentUser || isSending) return;
    
    setIsSending(true);
    const messageText = chatMessage.trim();
    setChatMessage(''); // Clear immediately for UX

    try {
      await addDoc(collection(db, 'live_comments'), {
        userId: auth.currentUser.uid,
        userName: profile.name || auth.currentUser.displayName || 'مشجع اتحادي',
        userAvatar: profile.avatar || auth.currentUser.photoURL || '',
        text: messageText,
        createdAt: serverTimestamp(),
        role: profile.role || 'user'
      });
    } catch (error) {
      console.error("Error sending message:", error);
      // Restore message if failed
      setChatMessage(messageText);
      toast.error('فشل إرسال التعليق، يرجى المحاولة مرة أخرى');
    } finally {
      setIsSending(false);
    }
  };

  const handleDeleteComment = async (id: string) => {
    if (window.confirm('هل تريد حذف هذا التعليق؟')) {
      try {
        await deleteDoc(doc(db, 'live_comments', id));
        toast.success('تم حذف التعليق');
      } catch (e) {
        toast.error('فشل حذف التعليق');
      }
    }
  };

  // Auto-detect video type for rendering
  const renderPlayer = () => {
    if (!currentStream?.isActive) {
      return (
        <div className="absolute inset-0 bg-slate-900 flex flex-col items-center justify-center p-6 text-center">
          <span className="material-symbols-outlined text-[64px] text-slate-700 mb-4">videocam_off</span>
          <p className="text-white font-bold text-lg mb-2">لا يوجد بث مباشر {selectedSport === 'football' ? 'لكرة القدم' : 'لكرة السلة'} حالياً</p>
          <p className="text-slate-400 text-sm">البث المباشر سيبدأ قبل موعد المباراة</p>
        </div>
      );
    }

    const { url } = currentStream;
    if (!url) return null;

    if (url.includes('youtube.com/embed/') || url.includes('iframe')) {
      const iframeUrl = url.includes('<iframe') ? url.match(/src="([^"]+)"/)?.[1] || url : url;
      return (
        <iframe 
          className="w-full h-full absolute inset-0"
          src={iframeUrl} 
          title="Live Stream"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
          allowFullScreen
        ></iframe>
      );
    } else if (url.endsWith('.mp4') || url.endsWith('.m3u8')) {
      // Basic HTML5 video, for m3u8 in a real app we'd use hls.js
      return (
        <video 
          className="w-full h-full object-cover absolute inset-0" 
          controls 
          autoPlay 
          playsInline
          src={url}
        ></video>
      );
    }

    // Fallback UI
    return (
      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuDCz19y9c0fSAniiT2SuAvgWYT5nzGvPRX1RVIr6M1IG3tDbgqyVNZ5Q9wWfbkHymrFKo7P4QdOCLo5ZddDwauBLfygLJ9rPLtqYB1NaR8G6rdk4V6buPvIpUe_Xu4hsi_vyTv07ap9p3Ov1FSXYTTTsCZgwhDWqiZUAWk6uH-vSbky1AUahPIMMxfYo0hb8zusWvoRtUqEmFWrHaVZ1IbIzI21R7M2F4J8Xz6RMc2ZfFAt_Ae7gMGxVkGKeGR0VUhagVO9R20aBEQ')" }}>
        <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center pointer-events-none">
           <div className="w-16 h-16 bg-primary text-white rounded-full flex items-center justify-center shadow-lg transform hover:scale-105 transition-transform pressable pointer-events-auto">
             <span className="material-symbols-outlined text-4xl">play_arrow</span>
           </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 w-full max-w-md mx-auto flex flex-col pb-32 bg-background-light dark:bg-background-dark min-h-screen">
      <main className="flex-1 flex flex-col">
        {/* Video Player */}
        <section className="relative w-full aspect-video bg-black shadow-lg sticky top-[64px] z-40 lg:static">
          {renderPlayer()}
          
          {/* Overlay info if not playing native video (fallback) */}
          {currentStream.isActive && !currentStream.url && (
             <div className="absolute top-0 left-0 right-0 p-3 flex justify-between items-start pointer-events-none bg-gradient-to-b from-black/80 to-transparent">
               <div className="bg-black/50 text-white text-[10px] font-bold px-2 py-1 rounded backdrop-blur-md flex items-center gap-1.5">
                 <span className="material-symbols-outlined text-xs">visibility</span> {(currentStream?.viewers || 0).toLocaleString()}
               </div>
               <div className="bg-primary/90 text-white text-[10px] font-bold px-2 py-1 rounded backdrop-blur-md border border-white/10">
                 {currentStream.title}
               </div>
             </div>
          )}
        </section>

        {/* Sports Toggle Section */}
        {(!appSettings.liveViewMode || appSettings.liveViewMode === 'both') && (
          <div className="bg-white dark:bg-card-dark border-b border-border-light dark:border-border-dark p-3 flex justify-center gap-3">
            <button 
              onClick={() => setSelectedSport('football')}
              className={`flex-1 h-11 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-2 ${selectedSport === 'football' ? 'bg-primary text-white shadow-glow' : 'bg-slate-50 dark:bg-surface-dark text-slate-400 hover:bg-slate-100'}`}
            >
              <span className="material-symbols-outlined !text-[20px]">sports_soccer</span>
              كرة القدم
            </button>
            <button 
              onClick={() => setSelectedSport('basketball')}
              className={`flex-1 h-11 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-2 ${selectedSport === 'basketball' ? 'bg-orange-600 text-white shadow-glow' : 'bg-slate-50 dark:bg-surface-dark text-slate-400 hover:bg-slate-100'}`}
            >
              <span className="material-symbols-outlined !text-[20px]">sports_basketball</span>
              كرة السلة
            </button>
          </div>
        )}

        {/* Live Chat Section */}
        <section className="flex-1 flex flex-col p-4">
          <div className="flex items-center justify-between border-b border-border-light dark:border-border-dark pb-3 mb-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-xl">forum</span> 
              الدردشة المباشرة
            </h2>
            <span className="text-[10px] text-slate-500 font-bold bg-slate-100 dark:bg-surface-dark px-2 py-1 rounded-full">
              {(currentStream?.isActive ? (currentStream?.viewers || 0) : 0).toLocaleString()} متصل
            </span>
          </div>
          
          {/* Chat Messages */}
          <div 
            ref={scrollRef}
            className="flex-1 overflow-y-auto no-scrollbar space-y-4 mb-4 min-h-[300px]"
          >
            {comments.length > 0 ? comments.map((msg) => {
              const chatUser = users.find(u => u.uid === msg.userId);
              const chatAvatar = chatUser?.avatar || msg.userAvatar;
              const chatName = chatUser?.name || msg.userName;
              const isMsgAdmin = msg.role === 'admin' || chatUser?.role === 'admin';
              return (
                <div key={msg.id} className={`flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                  <div className="relative flex-shrink-0">
                    {chatAvatar ? (
                      <img src={chatAvatar} referrerPolicy="no-referrer" className="w-8 h-8 rounded-full border shadow-sm" alt="" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-surface-dark flex items-center justify-center text-slate-500 border border-border-light dark:border-border-dark">
                        <User size={16} />
                      </div>
                    )}
                    {isMsgAdmin && (
                      <div className="absolute -bottom-1 -right-1 bg-primary text-white p-0.5 rounded-full border border-white">
                        <ShieldCheck size={8} />
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={`text-[11px] font-black ${isMsgAdmin ? 'text-primary' : 'text-slate-700 dark:text-slate-300'}`}>{chatName}</span>
                        {isMsgAdmin && (
                          <span className="bg-red-500/10 text-red-500 text-[8px] font-black px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                            <ShieldCheck size={9} />
                            مدير التطبيق
                          </span>
                        )}
                        {chatUser?.tier === 'premium' && (
                          <span className="bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[8px] font-black px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                            عضو ملكي 👑
                          </span>
                        )}
                        <span className="text-[9px] text-slate-400 font-bold">
                          {msg.createdAt && formatDistanceToNow(msg.createdAt.toDate(), { locale: ar, addSuffix: true })}
                        </span>
                      </div>
                    {(profile.role === 'admin' || auth.currentUser?.uid === msg.userId) && (
                      <button onClick={() => handleDeleteComment(msg.id)} className="p-1 text-red-400 hover:text-red-500 transition-colors">
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                  <div className={`text-xs p-3 rounded-2xl rounded-tr-sm leading-relaxed border ${msg.role === 'admin' ? 'bg-primary/5 border-primary/10 text-slate-800 dark:text-slate-200' : 'bg-white dark:bg-card-dark border-border-light dark:border-border-dark text-slate-600 dark:text-slate-400 shadow-sm'}`}>
                    {msg.text}
                  </div>
                </div>
              </div>
            ); }) : (
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 space-y-2">
                 <span className="material-symbols-outlined text-4xl opacity-50">forum</span>
                 <p className="text-xs font-bold">لا توجد تعليقات بعد.. كن أول من يعلق!</p>
              </div>
            )}
          </div>
          
          {/* Chat Input */}
          <div className="sticky bottom-0 pt-2 bg-background-light dark:bg-background-dark">
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex gap-2 items-center bg-white dark:bg-card-dark p-1.5 rounded-full border border-border-light dark:border-border-dark shadow-sm"
            >
              <input 
                className="flex-1 bg-transparent border-none focus:ring-0 text-xs py-2 px-3 outline-none text-slate-700 dark:text-white" 
                placeholder={auth.currentUser ? "اكتب تعليقك هنا..." : "سجل دخول للتعليق"} 
                type="text" 
                value={chatMessage}
                disabled={!auth.currentUser || isSending}
                onChange={(e) => setChatMessage(e.target.value)}
              />
              <button 
                type="submit"
                disabled={!chatMessage.trim() || isSending || !auth.currentUser}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all pressable ${chatMessage.trim() && !isSending && auth.currentUser ? 'bg-primary text-white shadow-md' : 'bg-slate-100 dark:bg-surface-dark text-slate-400'}`}
              >
                {isSending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} className="ml-1" />}
              </button>
            </form>
          </div>
        </section>
      </main>
    </div>
  );
}
