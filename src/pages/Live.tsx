import { Link } from 'react-router-dom';
import { useAppStore } from '../store';
import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { db, auth } from '../lib/firebase';
import { collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Send, Trash2, ShieldCheck, User, Loader2, Radio, Trophy, Eye, Share2, Tv } from 'lucide-react';
import LivePlayer from '../components/live/LivePlayer';

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
  
  // Choose sport/channel based on settings or active stream
  const [selectedSport, setSelectedSport] = useState<'football' | 'basketball' | 'programs'>(() => {
    if (appSettings.liveViewMode === 'basketball') return 'basketball';
    if (appSettings.liveViewMode === 'football') return 'football';
    if (liveStreams.football?.isActive) return 'football';
    if (liveStreams.basketball?.isActive) return 'basketball';
    if (liveStreams.programs?.isActive) return 'programs';
    return 'football';
  });

  useEffect(() => {
    if (appSettings.liveViewMode && appSettings.liveViewMode !== 'both') {
      if (['football', 'basketball', 'programs'].includes(appSettings.liveViewMode)) {
        setSelectedSport(appSettings.liveViewMode as 'football' | 'basketball' | 'programs');
      }
    }
  }, [appSettings.liveViewMode]);
  
  const currentStream = selectedSport === 'programs' 
    ? liveStreams.programs 
    : selectedSport === 'basketball' 
      ? liveStreams.basketball 
      : liveStreams.football;

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

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: currentStream.title || 'بث مباشر - نادي الاتحاد السكندري',
          text: `شاهد الآن البث المباشر: ${currentStream.title || 'نادي الاتحاد السكندري'}`,
          url: window.location.href,
        });
      } catch (err) {
        // Ignored or cancelled
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success('تم نسخ رابط البث المباشر');
    }
  };

  const getSportTitle = () => {
    if (selectedSport === 'programs') return 'برامج واستوديو الاتحاد';
    if (selectedSport === 'basketball') return 'كرة السلة';
    return 'كرة القدم';
  };

  return (
    <div className="flex-1 w-full max-w-md mx-auto flex flex-col pb-32 bg-background-light dark:bg-background-dark min-h-screen">
      <main className="flex-1 flex flex-col">
        {/* Video Player */}
        <section className="relative w-full aspect-video bg-black shadow-lg sticky top-[64px] z-40 lg:static">
          <LivePlayer
            url={currentStream?.url}
            title={currentStream?.title}
            isActive={currentStream?.isActive}
            sportName={getSportTitle()}
          />

          {/* Floating live info pill */}
          {currentStream?.isActive && (
            <div className="absolute top-2 left-2 right-2 flex justify-between items-center pointer-events-none z-20">
              <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10 text-white text-[10px] font-black shadow-md">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                <span>مباشر الآن</span>
                <span className="text-white/40">|</span>
                <Eye size={11} className="text-primary" />
                <span>{((currentStream?.viewers || 0) + 1).toLocaleString()}</span>
              </div>

              <button
                onClick={handleShare}
                className="pointer-events-auto bg-black/60 hover:bg-black/80 backdrop-blur-md p-1.5 rounded-full border border-white/10 text-white transition-all shadow-md active:scale-95 cursor-pointer"
                title="مشاركة البث"
              >
                <Share2 size={13} />
              </button>
            </div>
          )}
        </section>

        {/* Live Channel / Sport Tabs: Football, Basketball, Programs */}
        <div className="bg-white dark:bg-card-dark border-b border-border-light dark:border-border-dark p-2 flex justify-center gap-1.5">
          <button 
            onClick={() => setSelectedSport('football')}
            className={`flex-1 h-10 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${selectedSport === 'football' ? 'bg-primary text-white shadow-md shadow-primary/20' : 'bg-slate-50 dark:bg-surface-dark text-slate-500 hover:bg-slate-100 dark:hover:bg-surface-dark/80'}`}
          >
            <span className="material-symbols-outlined !text-[18px]">sports_soccer</span>
            <span>كرة القدم</span>
            {liveStreams.football?.isActive && (
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
            )}
          </button>

          <button 
            onClick={() => setSelectedSport('basketball')}
            className={`flex-1 h-10 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${selectedSport === 'basketball' ? 'bg-orange-600 text-white shadow-md shadow-orange-600/20' : 'bg-slate-50 dark:bg-surface-dark text-slate-500 hover:bg-slate-100 dark:hover:bg-surface-dark/80'}`}
          >
            <span className="material-symbols-outlined !text-[18px]">sports_basketball</span>
            <span>كرة السلة</span>
            {liveStreams.basketball?.isActive && (
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
            )}
          </button>

          <button 
            onClick={() => setSelectedSport('programs')}
            className={`flex-1 h-10 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${selectedSport === 'programs' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' : 'bg-slate-50 dark:bg-surface-dark text-slate-500 hover:bg-slate-100 dark:hover:bg-surface-dark/80'}`}
          >
            <span className="material-symbols-outlined !text-[18px]">live_tv</span>
            <span>برامج</span>
            {liveStreams.programs?.isActive && (
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
            )}
          </button>
        </div>

        {/* Live Stream Title and Status Banner */}
        {currentStream?.title && (
          <div className="bg-slate-50 dark:bg-surface-dark/60 border-b border-border-light dark:border-border-dark px-4 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2 overflow-hidden">
              <Radio size={14} className="text-red-500 shrink-0 animate-pulse" />
              <p className="text-xs font-black text-slate-800 dark:text-white truncate">
                {currentStream.title}
              </p>
            </div>
            {currentStream.isActive ? (
              <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md shrink-0">
                بث نشط 🟢
              </span>
            ) : (
              <span className="text-[9px] font-black text-slate-400 bg-slate-200 dark:bg-surface-dark px-2 py-0.5 rounded-md shrink-0">
                مغلق
              </span>
            )}
          </div>
        )}

        {/* Live Chat Section */}
        <section className="flex-1 flex flex-col p-4">
          <div className="flex items-center justify-between border-b border-border-light dark:border-border-dark pb-3 mb-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-xl">forum</span> 
              الدردشة المباشرة
            </h2>
            <span className="text-[10px] text-slate-500 font-bold bg-slate-100 dark:bg-surface-dark px-2.5 py-1 rounded-full">
              {(currentStream?.isActive ? (currentStream?.viewers || 0) + 1 : 0).toLocaleString()} متصل
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
                      <img src={chatAvatar} referrerPolicy="no-referrer" className="w-8 h-8 rounded-full border shadow-sm object-cover" alt="" />
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
                        <button onClick={() => handleDeleteComment(msg.id)} className="p-1 text-red-400 hover:text-red-500 transition-colors cursor-pointer">
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                    <div className={`text-xs p-3 rounded-2xl rounded-tr-sm leading-relaxed border whitespace-pre-wrap break-words ${msg.role === 'admin' ? 'bg-primary/5 border-primary/10 text-slate-800 dark:text-slate-200' : 'bg-white dark:bg-card-dark border-border-light dark:border-border-dark text-slate-600 dark:text-slate-400 shadow-sm'}`}>
                      {msg.text}
                    </div>
                  </div>
                </div>
              );
            }) : (
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 space-y-2 py-12">
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
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all pressable cursor-pointer ${chatMessage.trim() && !isSending && auth.currentUser ? 'bg-primary text-white shadow-md' : 'bg-slate-100 dark:bg-surface-dark text-slate-400'}`}
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
