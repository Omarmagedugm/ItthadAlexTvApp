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

type SportChannel = 'football' | 'basketball' | 'programs';

export default function Live() {
  const { liveStream, liveStreams, profile, users, appSettings } = useAppStore();
  
  // Track whether the user has manually picked a channel in this session
  const userSelectedRef = useRef(false);

  // Helper to find which stream is active
  const getFirstActiveSport = (): SportChannel | null => {
    if (liveStreams.football?.isActive) return 'football';
    if (liveStreams.basketball?.isActive) return 'basketball';
    if (liveStreams.programs?.isActive) return 'programs';
    return null;
  };

  // Default initial sport: active stream first!
  const [selectedSport, setSelectedSport] = useState<SportChannel>(() => {
    const active = getFirstActiveSport();
    if (active) return active;
    if (appSettings.liveViewMode && ['football', 'basketball', 'programs'].includes(appSettings.liveViewMode)) {
      return appSettings.liveViewMode as SportChannel;
    }
    return 'football';
  });

  // Auto-switch to active stream whenever liveStreams state loads or updates
  useEffect(() => {
    const active = getFirstActiveSport();
    if (active && (!userSelectedRef.current || !liveStreams[selectedSport]?.isActive)) {
      setSelectedSport(active);
    }
  }, [
    liveStreams.football?.isActive,
    liveStreams.basketball?.isActive,
    liveStreams.programs?.isActive
  ]);

  // Handle liveViewMode changes from app settings
  useEffect(() => {
    if (appSettings.liveViewMode && appSettings.liveViewMode !== 'both') {
      if (['football', 'basketball', 'programs'].includes(appSettings.liveViewMode)) {
        if (!getFirstActiveSport()) {
          setSelectedSport(appSettings.liveViewMode as SportChannel);
        }
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
        userName: profile?.displayName || profile?.name || auth.currentUser.displayName || 'مشجع اتحادي',
        userAvatar: profile?.avatar || auth.currentUser.photoURL || '',
        text: messageText,
        createdAt: serverTimestamp(),
        role: profile?.role || 'user'
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
          title: `بث مباشر: ${currentStream?.title || 'قناة الاتحاد السكندري'}`,
          text: `شاهد البث المباشر لأحداث ومباريات الاتحاد السكندري الآن! 🟢⚪`,
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

  // Define channels: Football, Basketball, Programs
  const channelsConfig: Array<{
    id: SportChannel;
    label: string;
    icon: string;
    activeStyle: string;
    isActive: boolean;
  }> = [
    {
      id: 'football',
      label: 'كرة القدم',
      icon: 'sports_soccer',
      activeStyle: 'bg-primary text-white shadow-md shadow-primary/20',
      isActive: !!liveStreams.football?.isActive
    },
    {
      id: 'basketball',
      label: 'كرة السلة',
      icon: 'sports_basketball',
      activeStyle: 'bg-orange-600 text-white shadow-md shadow-orange-600/20',
      isActive: !!liveStreams.basketball?.isActive
    },
    {
      id: 'programs',
      label: 'برامج',
      icon: 'live_tv',
      activeStyle: 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20',
      isActive: !!liveStreams.programs?.isActive
    }
  ];

  // Reorder channels to display LIVE broadcasting channels first
  const sortedChannels = [...channelsConfig].sort((a, b) => (b.isActive ? 1 : 0) - (a.isActive ? 1 : 0));

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
              <div className="flex items-center gap-1.5 bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10 text-white text-[10px] font-black shadow-md">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
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

        {/* Live Channel Tabs: Football, Basketball, Programs (Active first) */}
        <div className="bg-white dark:bg-card-dark border-b border-border-light dark:border-border-dark p-2 flex justify-center gap-1.5">
          {sortedChannels.map((channel) => (
            <button 
              key={channel.id}
              onClick={() => {
                userSelectedRef.current = true;
                setSelectedSport(channel.id);
              }}
              className={`flex-1 h-10 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer relative ${
                selectedSport === channel.id 
                  ? channel.activeStyle 
                  : 'bg-slate-50 dark:bg-surface-dark text-slate-500 hover:bg-slate-100 dark:hover:bg-surface-dark/80'
              }`}
            >
              <span className="material-symbols-outlined !text-[18px]">{channel.icon}</span>
              <span>{channel.label}</span>
              {channel.isActive && (
                <span className="relative flex h-2 w-2 mr-0.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </span>
              )}
            </button>
          ))}
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
              <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md shrink-0 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                بث مباشر نشط
              </span>
            ) : (
              <span className="text-[9px] font-bold text-slate-400 bg-slate-200/50 dark:bg-card-dark px-2 py-0.5 rounded-md shrink-0">
                غير متصل
              </span>
            )}
          </div>
        )}

        {/* Live Chat Section */}
        <section className="flex-1 flex flex-col p-4 bg-background-light dark:bg-background-dark min-h-[300px]">
          <div className="flex items-center justify-between pb-3 border-b border-border-light dark:border-border-dark mb-3">
            <h2 className="text-xs font-black text-slate-800 dark:text-white flex items-center gap-1.5">
              <span className="material-symbols-outlined text-primary !text-[18px]">forum</span>
              <span>دردشة جماهير زعيم الثغر</span>
            </h2>
            <span className="text-[10px] font-bold text-slate-400">
              {comments.length} تعليق
            </span>
          </div>

          <div 
            ref={scrollRef}
            className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[40vh] min-h-[220px] scroll-smooth"
          >
            {comments.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2 py-10">
                <span className="material-symbols-outlined !text-4xl text-slate-300 dark:text-slate-600">chat_bubble_outline</span>
                <p className="text-xs font-bold">لا توجد تعليقات بعد، كن أول من يشارك!</p>
              </div>
            ) : (
              comments.map((comment) => {
                const isAdmin = comment.role === 'admin' || comment.role === 'supervisor' || users[comment.userId]?.role === 'admin' || users[comment.userId]?.role === 'supervisor';
                const isAuthor = auth.currentUser?.uid === comment.userId;
                const canDelete = isAuthor || profile?.role === 'admin';

                return (
                  <div key={comment.id} className="flex items-start gap-2.5 group">
                    <div className="w-7 h-7 rounded-full overflow-hidden bg-slate-200 dark:bg-surface-dark flex items-center justify-center shrink-0 border border-border-light dark:border-border-dark">
                      {comment.userAvatar ? (
                        <img src={comment.userAvatar} alt={comment.userName} className="w-full h-full object-cover" />
                      ) : (
                        <User size={14} className="text-slate-400" />
                      )}
                    </div>
                    <div className="flex-1 bg-white dark:bg-card-dark p-2.5 rounded-2xl rounded-tr-none border border-border-light dark:border-border-dark shadow-sm">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-black text-slate-800 dark:text-white">
                            {comment.userName}
                          </span>
                          {isAdmin && (
                            <span className="bg-primary/10 text-primary text-[8px] font-black px-1.5 py-0.2 rounded-md flex items-center gap-0.5 border border-primary/20">
                              <ShieldCheck size={9} />
                              إدارة
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[9px] font-bold text-slate-400">
                            {comment.createdAt?.toDate ? formatDistanceToNow(comment.createdAt.toDate(), { addSuffix: true, locale: ar }) : 'الآن'}
                          </span>
                          {canDelete && (
                            <button
                              onClick={() => handleDeleteComment(comment.id)}
                              className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 p-0.5 transition-opacity"
                              title="حذف التعليق"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed break-words">
                        {comment.text}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Comment input area */}
          <div className="mt-3 pt-3 border-t border-border-light dark:border-border-dark">
            {auth.currentUser ? (
              <form 
                onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  placeholder="اكتب تعليقك وتشجيعك لزعيم الثغر..."
                  className="flex-1 h-10 px-3 rounded-xl border border-border-light dark:border-border-dark bg-white dark:bg-card-dark text-xs font-bold outline-none focus:border-primary transition-colors"
                  maxLength={200}
                />
                <button
                  type="submit"
                  disabled={!chatMessage.trim() || isSending}
                  className="h-10 px-4 bg-primary hover:bg-primary-dark disabled:opacity-50 text-white rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-primary/20 cursor-pointer"
                >
                  {isSending ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <>
                      <span>إرسال</span>
                      <Send size={12} className="rotate-180" />
                    </>
                  )}
                </button>
              </form>
            ) : (
              <div className="bg-slate-100 dark:bg-surface-dark p-3 rounded-xl text-center">
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">
                  يجب تسجيل الدخول للمشاركة في الدردشة المباشرة
                </p>
                <Link
                  to="/auth"
                  className="inline-block px-4 py-1.5 bg-primary text-white rounded-lg text-xs font-black shadow-sm"
                >
                  تسجيل الدخول
                </Link>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
