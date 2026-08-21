import { Link } from 'react-router-dom';
import { useAppStore } from '../store';
import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { db, auth } from '../lib/firebase';
import { collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { 
  Send, 
  Trash2, 
  ShieldCheck, 
  User, 
  Loader2, 
  Radio, 
  Trophy, 
  Eye, 
  Share2, 
  Tv, 
  RefreshCw, 
  ExternalLink,
  Flame,
  Volume2,
  Sparkles,
  MessageSquare,
  Maximize2
} from 'lucide-react';
import LivePlayer from '../components/live/LivePlayer';
import { parseLiveStreamUrl } from '../lib/videoUtils';

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

  const [playerReloadKey, setPlayerReloadKey] = useState(0);

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

  const parsedUrl = parseLiveStreamUrl(currentStream?.url);

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

  const handleReloadPlayer = () => {
    setPlayerReloadKey(prev => prev + 1);
    toast.success('جاري إعادة تشغيل إشارة البث ⚡', { id: 'reload-player' });
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
      label: 'برامج واستوديو',
      icon: 'live_tv',
      activeStyle: 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20',
      isActive: !!liveStreams.programs?.isActive
    }
  ];

  // Reorder channels to display LIVE broadcasting channels first
  const sortedChannels = [...channelsConfig].sort((a, b) => (b.isActive ? 1 : 0) - (a.isActive ? 1 : 0));

  return (
    <div className="flex-1 w-full min-h-screen bg-background-light dark:bg-background-dark pb-28 lg:pb-12">
      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-3 lg:py-6">
        
        {/* Main Grid: Desktop 2-column layout, Mobile single column */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-8 items-start">
          
          {/* LEFT / MAIN COLUMN: Video Player & Stream Control Hub */}
          <div className="lg:col-span-8 flex flex-col space-y-3">

            {/* Header bar above video player: Live status badge & Share */}
            {currentStream?.isActive && (
              <div className="flex justify-between items-center px-1">
                <div className="flex items-center gap-2 bg-red-600/15 dark:bg-red-500/20 text-red-600 dark:text-red-400 px-3 py-1.5 rounded-full border border-red-500/30 text-xs font-black shadow-sm">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping"></span>
                  <span>مباشر الآن</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleShare}
                    className="bg-white dark:bg-card-dark hover:bg-slate-100 dark:hover:bg-surface-dark px-3 py-1.5 rounded-full border border-border-light dark:border-border-dark text-slate-700 dark:text-slate-200 text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer flex items-center gap-1.5 hover:text-primary"
                    title="مشاركة البث"
                  >
                    <Share2 size={14} />
                    <span>مشاركة</span>
                  </button>
                </div>
              </div>
            )}
            
            {/* 1. Video Player Container with rounded corners & shadow */}
            <div className="relative w-full aspect-video bg-black rounded-2xl lg:rounded-3xl overflow-hidden shadow-xl border border-slate-800">
              <LivePlayer
                key={`live-player-${selectedSport}-${playerReloadKey}`}
                url={currentStream?.url}
                title={currentStream?.title}
                isActive={currentStream?.isActive}
                sportName={getSportTitle()}
              />
            </div>

            {/* 2. Stream Channel Selector Tabs (Always Visible & Clickable) */}
            <div className="bg-white dark:bg-card-dark rounded-2xl p-2.5 border border-border-light dark:border-border-dark shadow-sm">
              <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2">
                <div className="flex flex-1 items-center gap-2 w-full">
                  {sortedChannels.map((channel) => (
                    <button 
                      key={channel.id}
                      onClick={() => {
                        userSelectedRef.current = true;
                        setSelectedSport(channel.id);
                      }}
                      className={`flex-1 h-11 px-3 rounded-xl font-black text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer relative ${
                        selectedSport === channel.id 
                          ? channel.activeStyle 
                          : 'bg-slate-50 dark:bg-surface-dark text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-surface-dark/80'
                      }`}
                    >
                      <span className="material-symbols-outlined !text-[20px]">{channel.icon}</span>
                      <span>{channel.label}</span>
                      {channel.isActive && (
                        <span className="relative flex h-2.5 w-2.5 mr-1">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 3. Action Toolbar & Stream Meta (Desktop & Mobile optimized) */}
            <div className="bg-white dark:bg-card-dark rounded-2xl lg:rounded-3xl p-4 lg:p-5 border border-border-light dark:border-border-dark shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-border-dark">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black bg-primary/10 text-primary border border-primary/20">
                      قناة زعيم الثغر
                    </span>
                    {currentStream?.isActive ? (
                      <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                        إشارة البث نشطة
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black bg-slate-100 dark:bg-surface-dark text-slate-500">
                        غير متصل
                      </span>
                    )}
                  </div>
                  <h1 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                    {currentStream?.title || `بث مباشر: ${getSportTitle()}`}
                  </h1>
                </div>

                {/* Quick Action Buttons (Always Visible on Desktop & Mobile) */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handleReloadPlayer}
                    className="p-2.5 sm:px-3 sm:py-2 rounded-xl bg-slate-50 dark:bg-surface-dark hover:bg-slate-100 dark:hover:bg-surface-dark/80 text-slate-700 dark:text-slate-200 text-xs font-black border border-slate-200 dark:border-border-dark flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                    title="إعادة تحميل إشارة البث"
                  >
                    <RefreshCw size={15} />
                    <span className="hidden sm:inline">إعادة تحميل</span>
                  </button>

                  <button
                    onClick={handleShare}
                    className="p-2.5 sm:px-3 sm:py-2 rounded-xl bg-primary hover:bg-primary-light text-white text-xs font-black flex items-center gap-1.5 shadow-md shadow-primary/20 transition-all cursor-pointer active:scale-95"
                    title="مشاركة رابط البث"
                  >
                    <Share2 size={15} />
                    <span className="hidden sm:inline">مشاركة</span>
                  </button>
                </div>
              </div>

              {/* Match / Broadcaster description */}
              <p className="text-xs text-slate-500 dark:text-slate-400 font-bold leading-relaxed">
                متابعة حية وشاملة لكافة فعاليات وأنشطة نادي الاتحاد السكندري. استمتع بأعلى جودة للبث مع دردشة تفاعلية ومباشرة مع جماهير الأخضر في كل مكان.
              </p>
            </div>
          </div>

          {/* RIGHT COLUMN: Interactive Live Chat (Sticky on Desktop) */}
          <div className="lg:col-span-4">
            <section className="bg-white dark:bg-card-dark rounded-2xl lg:rounded-3xl border border-border-light dark:border-border-dark shadow-sm flex flex-col h-[520px] lg:h-[calc(100vh-140px)] lg:sticky lg:top-24 overflow-hidden">
              
              {/* Chat Header */}
              <div className="p-4 border-b border-border-light dark:border-border-dark flex items-center justify-between bg-slate-50/50 dark:bg-surface-dark/30">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                    <MessageSquare size={16} />
                  </div>
                  <div>
                    <h2 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                      دردشة جماهير زعيم الثغر
                    </h2>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      متصل الآن
                    </span>
                  </div>
                </div>
                <span className="text-[11px] font-black px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-surface-dark text-slate-600 dark:text-slate-300">
                  {comments.length} تعليق
                </span>
              </div>

              {/* Chat Messages Feed */}
              <div 
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-4 space-y-3 scroll-smooth no-scrollbar"
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
                        <div className="w-8 h-8 rounded-xl overflow-hidden bg-slate-200 dark:bg-surface-dark flex items-center justify-center shrink-0 border border-border-light dark:border-border-dark shadow-xs">
                          {comment.userAvatar ? (
                            <img src={comment.userAvatar} alt={comment.userName} className="w-full h-full object-cover" />
                          ) : (
                            <User size={14} className="text-slate-400" />
                          )}
                        </div>
                        <div className="flex-1 bg-slate-50 dark:bg-surface-dark p-3 rounded-2xl rounded-tr-none border border-slate-100 dark:border-border-dark shadow-2xs">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] font-black text-slate-800 dark:text-white">
                                {comment.userName}
                              </span>
                              {isAdmin && (
                                <span className="bg-primary/10 text-primary text-[8px] font-black px-1.5 py-0.5 rounded-md flex items-center gap-0.5 border border-primary/20">
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
                                  className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 p-0.5 transition-opacity cursor-pointer"
                                  title="حذف التعليق"
                                >
                                  <Trash2 size={12} />
                                </button>
                              )}
                            </div>
                          </div>
                          <p className="text-xs text-slate-700 dark:text-slate-200 font-medium leading-relaxed break-words">
                            {comment.text}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Chat Input Footer */}
              <div className="p-3 border-t border-border-light dark:border-border-dark bg-white dark:bg-card-dark">
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
                      className="flex-1 h-11 px-3.5 rounded-xl border border-border-light dark:border-border-dark bg-slate-50 dark:bg-surface-dark text-xs font-bold outline-none focus:border-primary transition-colors text-slate-900 dark:text-white"
                      maxLength={200}
                    />
                    <button
                      type="submit"
                      disabled={!chatMessage.trim() || isSending}
                      className="h-11 px-4 bg-primary hover:bg-primary-light disabled:opacity-50 text-white rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-primary/20 cursor-pointer shrink-0"
                    >
                      {isSending ? (
                        <Loader2 size={15} className="animate-spin" />
                      ) : (
                        <>
                          <span>إرسال</span>
                          <Send size={13} className="rotate-180" />
                        </>
                      )}
                    </button>
                  </form>
                ) : (
                  <div className="bg-slate-50 dark:bg-surface-dark p-3 rounded-xl text-center">
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
          </div>

        </div>

      </div>
    </div>
  );
}
