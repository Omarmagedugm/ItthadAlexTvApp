import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Radio as RadioIcon, 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Share2, 
  Heart, 
  MessageSquare, 
  Calendar, 
  Clock, 
  Users, 
  Sparkles, 
  Tv, 
  Music, 
  Mic, 
  Flame, 
  Headphones, 
  ChevronRight, 
  Search, 
  Send, 
  CheckCircle,
  ExternalLink,
  ShieldCheck,
  Disc,
  RadioTower,
  Volume1,
  Maximize2,
  Waves
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppStore, RadioStation } from '../store';
import { DEFAULT_RADIO_STATIONS } from '../data/defaultRadioData';
import { 
  getYouTubeEmbedUrl, 
  getFacebookEmbedUrl, 
  isYouTubeUrl, 
  isFacebookUrl,
  getYouTubeThumbnail 
} from '../lib/videoUtils';
import AudioVisualizer from '../components/AudioVisualizer';
import { db, auth } from '../lib/firebase';
import { collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp, doc, updateDoc, increment, arrayUnion, arrayRemove } from 'firebase/firestore';

export default function Radio() {
  const { radioStations, profile } = useAppStore();
  const stationsList = radioStations || [];
  const activeStations = stationsList.filter(s => s.isActive !== false);

  // Primary or default selected station
  const defaultStation = activeStations.find(s => s.isPrimary) || activeStations[0] || DEFAULT_RADIO_STATIONS[0];
  const [currentStation, setCurrentStation] = useState<RadioStation | null>(defaultStation || null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [volume, setVolume] = useState(0.9);
  const [isMuted, setIsMuted] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [likesCount, setLikesCount] = useState(0);
  const [hasLiked, setHasLiked] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [showVideoEmbed, setShowVideoEmbed] = useState(true);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const heroPlayerRef = useRef<HTMLDivElement | null>(null);
  const ytIframeRef = useRef<HTMLIFrameElement | null>(null);
  const bgIframeRef = useRef<HTMLIFrameElement | null>(null);

  // Sync likes with currentStation
  useEffect(() => {
    if (currentStation) {
      const likesList = Array.isArray((currentStation as any).likes) ? (currentStation as any).likes : [];
      const uid = auth.currentUser?.uid;
      setHasLiked(uid ? likesList.includes(uid) : false);
      const count = likesList.length > 0 ? likesList.length : (Number((currentStation as any).likesCount) || 0);
      setLikesCount(count);
    } else {
      setLikesCount(0);
      setHasLiked(false);
    }
  }, [currentStation, auth.currentUser?.uid]);

  // Keep selected station in sync if stations update
  useEffect(() => {
    if (activeStations.length > 0) {
      const match = activeStations.find(s => s.id === currentStation?.id);
      if (!match) {
        setCurrentStation(activeStations[0]);
      }
    } else {
      setCurrentStation(null);
    }
  }, [radioStations]);

  // Audio player control
  useEffect(() => {
    if (currentStation?.type === 'audio' || currentStation?.type === 'custom_stream') {
      if (audioRef.current) {
        audioRef.current.volume = isMuted ? 0 : volume;
        if (isPlaying) {
          audioRef.current.play().catch(e => {
            console.warn('Audio autoplay prevented:', e);
            setIsPlaying(false);
          });
        } else {
          audioRef.current.pause();
        }
      }
    }
  }, [isPlaying, volume, isMuted, currentStation]);

  // YouTube / Video iframe control on play/pause
  useEffect(() => {
    if (currentStation?.type === 'youtube') {
      const msg = JSON.stringify({
        event: 'command',
        func: isPlaying ? 'playVideo' : 'pauseVideo',
        args: []
      });
      if (ytIframeRef.current?.contentWindow) {
        try {
          ytIframeRef.current.contentWindow.postMessage(msg, '*');
        } catch (e) {}
      }
      if (bgIframeRef.current?.contentWindow) {
        try {
          bgIframeRef.current.contentWindow.postMessage(msg, '*');
        } catch (e) {}
      }
    }
  }, [isPlaying, currentStation]);

  // Realtime comments for current station
  useEffect(() => {
    if (!currentStation?.id) return;
    const q = query(
      collection(db, 'radio_comments'),
      orderBy('createdAt', 'desc'),
      limit(25)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }));
      setComments(list);
    }, (error) => {
      console.warn('Radio comments listener error:', error);
    });

    return () => unsub();
  }, [currentStation?.id]);

  // Handle station selection
  const handleSelectStation = (station: RadioStation) => {
    setCurrentStation(station);
    setIsPlaying(true);
    // If it's a direct audio station, always show audio visualizer
    if (station.type === 'audio' || station.type === 'custom_stream') {
      setShowVideoEmbed(false);
    } else {
      setShowVideoEmbed(true);
    }
    
    // Smooth scroll to hero player on mobile
    if (heroPlayerRef.current && window.innerWidth < 768) {
      heroPlayerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleTogglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  const handleShare = () => {
    if (!currentStation) return;
    if (navigator.share) {
      navigator.share({
        title: `${currentStation.title} - راديو زعيم الثغر`,
        text: currentStation.subtitle || currentStation.title,
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success('تم نسخ رابط الراديو للمشاركة 🎙️');
    }
  };

  const handleLike = async () => {
    if (!currentStation) return;
    const uid = auth.currentUser?.uid;
    const isNowLiked = !hasLiked;
    setHasLiked(isNowLiked);
    setLikesCount(prev => isNowLiked ? prev + 1 : Math.max(0, prev - 1));
    
    if (isNowLiked) {
      toast.success('شكراً لتفاعلك وحبك لزعيم الثغر 💚');
    }

    if (currentStation.id && !currentStation.id.startsWith('default_')) {
      try {
        const stationRef = doc(db, 'radio_stations', currentStation.id);
        if (uid) {
          await updateDoc(stationRef, {
            likes: isNowLiked ? arrayUnion(uid) : arrayRemove(uid),
            likesCount: increment(isNowLiked ? 1 : -1)
          });
        } else {
          await updateDoc(stationRef, {
            likesCount: increment(isNowLiked ? 1 : -1)
          });
        }
      } catch (err) {
        console.error('Failed to sync like in firestore:', err);
      }
    }
  };

  const handleSendComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setIsSubmittingComment(true);
    try {
      await addDoc(collection(db, 'radio_comments'), {
        stationId: currentStation?.id || 'main',
        stationTitle: currentStation?.title || 'إذاعة زعيم الثغر',
        userName: profile?.name || auth.currentUser?.displayName || 'مشجع اتحادي',
        userAvatar: profile?.avatar || auth.currentUser?.photoURL || 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=200',
        userId: auth.currentUser?.uid || 'guest',
        text: newComment.trim(),
        createdAt: new Date().toISOString(),
        timestamp: serverTimestamp()
      });

      setNewComment('');
      toast.success('تم إرسال رسالتك لاستوديو الراديو 📻');
    } catch (err: any) {
      console.error('Failed to send comment:', err);
      toast.error('تعذر إرسال التعليق، يرجى المحاولة لاحقاً');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  // Filter stations
  const filteredStations = activeStations.filter(s => {
    if (activeTab === 'live' && !s.isLive) return false;
    if (activeTab === 'youtube' && s.type !== 'youtube') return false;
    if (activeTab === 'facebook' && s.type !== 'facebook') return false;
    if (activeTab === 'podcast' && s.category !== 'podcast' && s.category !== 'talkshow') return false;
    if (activeTab === 'chants' && s.category !== 'chants') return false;
    if (activeTab === 'studio' && s.category !== 'studio' && s.category !== 'live_match') return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = s.title?.toLowerCase().includes(q);
      const matchSub = s.subtitle?.toLowerCase().includes(q);
      const matchPresenter = s.presenter?.toLowerCase().includes(q);
      const matchDesc = s.description?.toLowerCase().includes(q);
      if (!matchTitle && !matchSub && !matchPresenter && !matchDesc) return false;
    }
    return true;
  });

  const getSourceIcon = (type: string) => {
    if (type === 'youtube') return <span className="text-red-500 font-bold">YouTube 🔴</span>;
    if (type === 'facebook') return <span className="text-blue-500 font-bold">Facebook 🔵</span>;
    return <span className="text-emerald-500 font-bold">بث صوتي 🎙️</span>;
  };

  const getCategoryLabel = (cat?: string) => {
    switch (cat) {
      case 'live_match': return 'تغطية المباريات';
      case 'studio': return 'استوديو تحليلي';
      case 'podcast': return 'بودكاست';
      case 'chants': return 'أهازيج وأغاني';
      case 'news': return 'نشرات إخبارية';
      case 'talkshow': return 'برامج حوارية';
      default: return 'إذاعة عامة';
    }
  };

  const isVideoSource = currentStation?.type === 'youtube' || currentStation?.type === 'facebook';
  const isDirectAudioSource = currentStation?.type === 'audio' || currentStation?.type === 'custom_stream';

  return (
    <div className="flex-1 w-full max-w-6xl mx-auto px-4 py-6 pb-28 text-slate-800 dark:text-slate-100 min-h-screen animate-fade-in">
      
      {/* Top Hero Brand Banner */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-slate-900 via-primary-950 to-slate-950 p-6 sm:p-8 text-white shadow-2xl border border-white/10 mb-8">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/20 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-black animate-pulse">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                بث مباشر ON AIR
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 text-emerald-300 border border-white/10 text-xs font-bold">
                <RadioTower size={14} className="text-emerald-400" />
                صوت الإسكندرية وسيد البلد
              </span>
              <span className="px-3 py-1.5 rounded-xl bg-white/5 text-slate-300 text-xs font-mono">
                90.5 FM DIGITAL
              </span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white flex items-center gap-3">
              <RadioIcon className="text-primary-light" size={36} />
              راديو وتلفزيون زعيم الثغر
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
              إذاعة نادي الاتحاد السكندري الرقمية - بث مباشر متواصل، استوديوهات تحليلية فيديو، وبودكاست أسبوعي وتغطيات حصرية لأقوى مباريات كرة القدم وكرة السلة.
            </p>
          </div>

          {/* Equalizer Visualizer & Stats */}
          <div className="flex flex-col items-center md:items-end gap-3 shrink-0">
            <div className="flex items-center gap-1.5 p-3 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10">
              <div className="flex items-end gap-1 h-8 px-2">
                <span className={`w-1.5 bg-emerald-400 rounded-full transition-all duration-300 ${isPlaying ? 'h-7 animate-pulse' : 'h-2'}`} />
                <span className={`w-1.5 bg-emerald-500 rounded-full transition-all duration-300 ${isPlaying ? 'h-4 animate-bounce' : 'h-3'}`} />
                <span className={`w-1.5 bg-primary-light rounded-full transition-all duration-300 ${isPlaying ? 'h-8 animate-pulse' : 'h-1.5'}`} />
                <span className={`w-1.5 bg-emerald-400 rounded-full transition-all duration-300 ${isPlaying ? 'h-5 animate-bounce' : 'h-2'}`} />
                <span className={`w-1.5 bg-emerald-300 rounded-full transition-all duration-300 ${isPlaying ? 'h-6 animate-pulse' : 'h-1.5'}`} />
              </div>
              <div className="text-right pr-2">
                <div className="text-xs font-black text-white">{currentStation?.listenersCount ? `${currentStation.listenersCount} مستمع` : 'إذاعة مباشرة'}</div>
                <div className="text-[10px] text-emerald-300 font-bold">متصلون بالبث الآن 🟢</div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button 
                onClick={handleShare}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-black border border-white/15 transition-all"
              >
                <Share2 size={14} />
                <span>مشاركة البث</span>
              </button>
              <button
                onClick={handleLike}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black transition-all ${
                  hasLiked ? 'bg-rose-500 text-white' : 'bg-white/10 hover:bg-white/20 text-white border border-white/15'
                }`}
              >
                <Heart size={14} className={hasLiked ? 'fill-current' : ''} />
                <span>{likesCount}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Interactive Player Section */}
      <div ref={heroPlayerRef} className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        
        {/* Hero Player Container (2 Cols on desktop) */}
        <div className="lg:col-span-2 bg-slate-950 rounded-3xl overflow-hidden shadow-2xl border border-slate-800 flex flex-col">
          
          {!currentStation ? (
            <div className="aspect-video w-full flex flex-col items-center justify-center p-8 text-center text-slate-400 space-y-3">
              <RadioIcon size={48} className="text-slate-600 animate-pulse" />
              <h3 className="font-black text-lg text-white">لا توجد إذاعة أو بث مباشر حالياً</h3>
              <p className="text-xs text-slate-400 max-w-sm">
                يمكن للمشرفين إضافة محطات واستوديوهات جديدة من لوحة التحكم.
              </p>
            </div>
          ) : (
            <>
              {/* Media Viewport */}
              <div className="relative aspect-video w-full bg-slate-900 overflow-hidden flex items-center justify-center">
                
                {/* 1. VISIBLE VIDEO MODE: YouTube Embed Player */}
                {currentStation.type === 'youtube' && isYouTubeUrl(currentStation.url) && showVideoEmbed && (
                  <iframe
                    ref={ytIframeRef}
                    className="w-full h-full absolute inset-0 border-0"
                    src={getYouTubeEmbedUrl(currentStation.url, isPlaying)}
                    title={currentStation.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                )}

                {/* 2. VISIBLE VIDEO MODE: Facebook Video Embed Player */}
                {currentStation.type === 'facebook' && isFacebookUrl(currentStation.url) && showVideoEmbed && (
                  <iframe
                    className="w-full h-full absolute inset-0 border-0"
                    src={getFacebookEmbedUrl(currentStation.url, isPlaying)}
                    title={currentStation.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
                    allowFullScreen
                  />
                )}

                {/* 3. AUDIO-ONLY MODE & DIRECT STREAMS: Professional Visualizer */}
                {(!showVideoEmbed || isDirectAudioSource) && (
                  <div className="w-full h-full absolute inset-0">
                    <AudioVisualizer
                      isPlaying={isPlaying}
                      coverUrl={currentStation.coverUrl || (currentStation.type === 'youtube' ? getYouTubeThumbnail(currentStation.url) || '' : undefined)}
                      title={currentStation.title}
                      presenter={currentStation.presenter}
                      frequency={currentStation.frequency || '90.5 FM'}
                      volume={volume}
                      isMuted={isMuted}
                    />
                  </div>
                )}

                {/* Hidden Background Player for Audio-only mode on YouTube/FB so sound is never cut off */}
                {!showVideoEmbed && currentStation.type === 'youtube' && isYouTubeUrl(currentStation.url) && (
                  <div className="absolute -top-[9999px] -left-[9999px] w-[1px] h-[1px] opacity-0 pointer-events-none overflow-hidden">
                    <iframe
                      ref={bgIframeRef}
                      className="w-[200px] h-[200px]"
                      src={getYouTubeEmbedUrl(currentStation.url, isPlaying)}
                      title={`${currentStation.title} (Background Audio)`}
                      allow="autoplay"
                    />
                  </div>
                )}

                {!showVideoEmbed && currentStation.type === 'facebook' && isFacebookUrl(currentStation.url) && (
                  <div className="absolute -top-[9999px] -left-[9999px] w-[1px] h-[1px] opacity-0 pointer-events-none overflow-hidden">
                    <iframe
                      className="w-[200px] h-[200px]"
                      src={getFacebookEmbedUrl(currentStation.url, isPlaying)}
                      title={`${currentStation.title} (Background Audio)`}
                      allow="autoplay"
                    />
                  </div>
                )}

                {/* Direct HTML5 Audio stream element */}
                {isDirectAudioSource && (
                  <audio
                    ref={audioRef}
                    src={currentStation.url}
                    preload="auto"
                    onEnded={() => setIsPlaying(false)}
                  />
                )}

                {/* Live Indicator Overlay */}
                {currentStation.isLive && (
                  <div className="absolute top-4 right-4 z-20 flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-600/90 backdrop-blur-md text-white text-xs font-black shadow-lg">
                    <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                    مباشر LIVE
                  </div>
                )}

                {/* Video / Audio Switcher toggle for YouTube & Facebook */}
                {isVideoSource && (
                  <button
                    onClick={() => setShowVideoEmbed(!showVideoEmbed)}
                    className="absolute top-4 left-4 z-20 flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-black/70 hover:bg-black/90 backdrop-blur-md text-white text-xs font-bold border border-white/20 transition-all shadow-lg hover:scale-105"
                    title="تبديل وضع العرض"
                  >
                    {showVideoEmbed ? (
                      <>
                        <Headphones size={15} className="text-emerald-400" />
                        <span>الوضع الصوتي (Visualizer 📻)</span>
                      </>
                    ) : (
                      <>
                        <Tv size={15} className="text-blue-400" />
                        <span>وضع الفيديو (📺)</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Player Info & Bottom Controls Bar */}
              <div className="p-4 sm:p-6 bg-slate-900 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-400 text-[11px] font-black border border-emerald-500/20">
                      {getCategoryLabel(currentStation.category)}
                    </span>
                    <span className="text-xs text-slate-400 font-bold">
                      {getSourceIcon(currentStation.type)}
                    </span>
                    {currentStation.airTime && (
                      <span className="flex items-center gap-1 text-[11px] text-slate-400 font-medium">
                        <Clock size={12} />
                        {currentStation.airTime}
                      </span>
                    )}
                  </div>

                  <h2 className="text-lg sm:text-xl font-black text-white truncate">
                    {currentStation.title}
                  </h2>
                  {currentStation.subtitle && (
                    <p className="text-xs text-slate-400 line-clamp-1">
                      {currentStation.subtitle}
                    </p>
                  )}
                </div>

                {/* Action & Playback Controls */}
                <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                  {/* Volume Slider & Mute */}
                  <div className="flex items-center gap-2 bg-slate-800/90 px-3 py-2 rounded-xl border border-slate-700">
                    <button 
                      onClick={() => setIsMuted(!isMuted)} 
                      className="text-slate-400 hover:text-white transition-colors"
                      title={isMuted ? "إلغاء الكتم" : "كتم الصوت"}
                    >
                      {isMuted || volume === 0 ? <VolumeX size={17} className="text-rose-400" /> : <Volume2 size={17} className="text-emerald-400" />}
                    </button>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={isMuted ? 0 : volume}
                      onChange={(e) => {
                        setVolume(parseFloat(e.target.value));
                        setIsMuted(false);
                      }}
                      className="w-16 sm:w-20 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                    />
                  </div>

                  {/* Play / Pause Main Button */}
                  <button
                    onClick={handleTogglePlay}
                    className="flex items-center gap-2 px-6 py-3.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-2xl font-black text-sm shadow-xl shadow-emerald-500/25 transition-all hover:scale-105 active:scale-95"
                  >
                    {isPlaying ? <Pause size={18} /> : <Play size={18} className="fill-current" />}
                    <span>{isPlaying ? 'إيقاف مؤقت' : 'تشغيل البث'}</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Live Chat / Listener Messages Sidebar */}
        <div className="bg-white dark:bg-card-dark rounded-3xl p-5 shadow-lg border border-slate-100 dark:border-border-dark flex flex-col h-[480px]">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-border-dark mb-3">
            <div className="flex items-center gap-2">
              <MessageSquare size={18} className="text-primary" />
              <h3 className="font-black text-sm text-slate-800 dark:text-slate-100">
                شات وتفاعل المستمعين 🎙️
              </h3>
            </div>
            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
              مباشر الآن
            </span>
          </div>

          {/* Comments stream */}
          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 text-xs">
            {comments.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-4 text-slate-400 space-y-2">
                <Mic size={32} className="text-slate-300 dark:text-slate-700" />
                <p className="font-bold">كن أول من يرسل تحياته ومشاركته للاستوديو!</p>
                <p className="text-[11px] opacity-75">رسالتك ستظهر لجميع مشجعي زعيم الثغر</p>
              </div>
            ) : (
              comments.map((c) => (
                <div key={c.id} className="p-2.5 rounded-2xl bg-slate-50 dark:bg-surface-dark border border-slate-100 dark:border-border-dark flex items-start gap-2.5 animate-fade-in">
                  <img
                    src={c.userAvatar || 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=100'}
                    alt={c.userName}
                    className="w-7 h-7 rounded-full object-cover shrink-0 border border-slate-200 dark:border-border-dark"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span className="font-black text-slate-800 dark:text-slate-200 truncate">{c.userName}</span>
                      <span className="text-[10px] text-slate-400">الآن</span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 text-xs break-words leading-snug">
                      {c.text}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Send comment form */}
          <form onSubmit={handleSendComment} className="mt-3 pt-3 border-t border-slate-100 dark:border-border-dark flex items-center gap-2">
            <input
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="اكتب رسالتك للمذيع والمستمعين..."
              className="flex-1 px-3.5 py-2.5 bg-slate-50 dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-slate-800 dark:text-white"
            />
            <button
              type="submit"
              disabled={isSubmittingComment || !newComment.trim()}
              className="p-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold shadow-md transition-all disabled:opacity-50"
            >
              <Send size={15} />
            </button>
          </form>
        </div>
      </div>

      {/* Category Tabs & Search Bar */}
      <div className="bg-white dark:bg-card-dark rounded-3xl p-4 sm:p-5 shadow-sm border border-slate-100 dark:border-border-dark mb-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          {/* Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full">
            {[
              { id: 'all', label: 'كل المحطات والبرامج', icon: <RadioIcon size={14} /> },
              { id: 'live', label: '🔴 مباشر الآن', icon: <Flame size={14} /> },
              { id: 'youtube', label: 'فيديو يوتيوب', icon: <Tv size={14} /> },
              { id: 'facebook', label: 'فيديو فيسبوك', icon: <Tv size={14} /> },
              { id: 'studio', label: 'استوديو المباريات', icon: <Sparkles size={14} /> },
              { id: 'podcast', label: 'بودكاست وبرامج', icon: <Mic size={14} /> },
              { id: 'chants', label: 'أهازيج وأغاني', icon: <Music size={14} /> },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-black text-xs whitespace-nowrap transition-all ${
                  activeTab === tab.id
                    ? 'bg-primary text-white shadow-md shadow-primary/20 scale-[1.02]'
                    : 'bg-slate-100 dark:bg-surface-dark text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative w-full md:w-72 shrink-0">
            <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث عن برنامج أو حلقة..."
              className="w-full pl-4 pr-10 py-2 bg-slate-50 dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-slate-800 dark:text-white"
            />
          </div>
        </div>
      </div>

      {/* Stations Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Headphones size={20} className="text-primary" />
            دليل القنوات والمحطات الإذاعية ({filteredStations.length})
          </h3>
          <span className="text-xs text-slate-400 font-bold">
            اضغط على أي إذاعة للاستماع الفوري 🎧
          </span>
        </div>

        {filteredStations.length === 0 ? (
          <div className="bg-white dark:bg-card-dark rounded-3xl p-12 text-center border border-slate-100 dark:border-border-dark space-y-3">
            <RadioIcon size={40} className="mx-auto text-slate-400" />
            <h4 className="font-black text-slate-700 dark:text-slate-200">لا توجد محطات تطابق الفلتر</h4>
            <p className="text-xs text-slate-400">جرب اختيار تصنيف آخر أو مسح كلمة البحث.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredStations.map((station) => {
              const isSelected = currentStation?.id === station.id;

              return (
                <div
                  key={station.id}
                  onClick={() => handleSelectStation(station)}
                  className={`group cursor-pointer bg-white dark:bg-card-dark rounded-2xl p-4 border transition-all duration-200 hover:shadow-xl hover:-translate-y-1 flex flex-col justify-between ${
                    isSelected
                      ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-500/[0.02]'
                      : 'border-slate-100 dark:border-border-dark hover:border-slate-300'
                  }`}
                >
                  <div className="space-y-3">
                    {/* Cover Thumbnail */}
                    <div className="relative aspect-video rounded-xl overflow-hidden bg-slate-900">
                      <img
                        src={station.coverUrl || (station.type === 'youtube' ? getYouTubeThumbnail(station.url) || '' : 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?q=80&w=800')}
                        alt={station.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

                      {/* Badges on top */}
                      <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                        {station.isLive ? (
                          <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-600 text-white text-[10px] font-black shadow-md animate-pulse">
                            <span className="w-1.5 h-1.5 rounded-full bg-white" />
                            مباشر
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-white text-[10px] font-bold">
                            🎙️ مسجل
                          </span>
                        )}
                      </div>

                      {/* Source tag on left */}
                      <div className="absolute top-2.5 left-2.5">
                        <span className="px-2 py-0.5 rounded-lg bg-black/60 backdrop-blur-md text-[10px] font-bold text-white">
                          {station.type === 'youtube' ? 'YouTube' : station.type === 'facebook' ? 'Facebook' : 'Audio Stream'}
                        </span>
                      </div>

                      {/* Play Action Hover overlay */}
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                        <div className="w-12 h-12 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform">
                          <Play size={20} className="fill-current mr-0.5" />
                        </div>
                      </div>

                      {/* Bottom frequency/airTime */}
                      <div className="absolute bottom-2 right-2 left-2 flex items-center justify-between text-white text-[11px] font-bold">
                        <span>{station.frequency || 'صوت الشاطبي'}</span>
                        {station.airTime && <span>{station.airTime}</span>}
                      </div>
                    </div>

                    {/* Metadata text */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold text-primary dark:text-primary-light">
                          {getCategoryLabel(station.category)}
                        </span>
                        {station.listenersCount && (
                          <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                            <Users size={11} />
                            {station.listenersCount}
                          </span>
                        )}
                      </div>

                      <h4 className="font-black text-sm sm:text-base text-slate-900 dark:text-slate-100 line-clamp-1 group-hover:text-primary transition-colors">
                        {station.title}
                      </h4>

                      {station.subtitle && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                          {station.subtitle}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Footer Card */}
                  <div className="pt-3 mt-3 border-t border-slate-100 dark:border-border-dark flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1 text-slate-500">
                      <Mic size={13} className="text-emerald-500" />
                      <span className="font-bold truncate max-w-[140px]">{station.presenter || 'طاقم الإذاعة'}</span>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectStation(station);
                      }}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-xl font-black text-xs transition-all ${
                        isSelected && isPlaying
                          ? 'bg-emerald-500 text-white'
                          : 'bg-slate-100 dark:bg-surface-dark hover:bg-emerald-50 text-slate-700 dark:text-slate-200 hover:text-emerald-600'
                      }`}
                    >
                      {isSelected && isPlaying ? <Pause size={13} /> : <Play size={13} className="fill-current" />}
                      <span>{isSelected && isPlaying ? 'يشتغل الآن' : 'استماع'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Broadcast Schedule Section */}
      <div className="mt-12 bg-white dark:bg-card-dark rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-border-dark">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Calendar size={22} className="text-primary" />
            <div>
              <h3 className="font-black text-lg text-slate-900 dark:text-white">جدول البرامج اليومية والأسبوعية 📅</h3>
              <p className="text-xs text-slate-500">مواعيد البث المباشر والبرامج الحوارية على راديو زعيم الثغر</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-surface-dark border border-slate-100 dark:border-border-dark space-y-2">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-1 rounded-lg bg-red-500/10 text-red-500 font-black text-[11px]">أيام المباريات</span>
              <span className="text-xs text-slate-400 font-mono">قبل اللقاء بساعة</span>
            </div>
            <h4 className="font-black text-sm text-slate-800 dark:text-slate-100">الاستوديو التحليلي المباشر</h4>
            <p className="text-xs text-slate-500">تحليل فني حصري لكواليس مواجهات الاتحاد السكندري وتغطية خاصة من قلب استاد الإسكندرية.</p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-surface-dark border border-slate-100 dark:border-border-dark space-y-2">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-500 font-black text-[11px]">الخميس 9:00 م</span>
              <span className="text-xs text-slate-400 font-mono">أسبوعياً</span>
            </div>
            <h4 className="font-black text-sm text-slate-800 dark:text-slate-100">بودكاست ملوك الشاطبي</h4>
            <p className="text-xs text-slate-500">حوارات خاصة مع أساطير كرة السلة والكرة وذكريات البطولات الذهبية لنادي الاتحاد السكندري.</p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-surface-dark border border-slate-100 dark:border-border-dark space-y-2">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-500 font-black text-[11px]">يومياً 24/7</span>
              <span className="text-xs text-slate-400 font-mono">متواصل</span>
            </div>
            <h4 className="font-black text-sm text-slate-800 dark:text-slate-100">صوت الجماهير والمدرجات</h4>
            <p className="text-xs text-slate-500">أجمل الأغاني والأهازيج ونشرات الأخبار السريعة على مدار الساعة طوال أيام الأسبوع.</p>
          </div>
        </div>
      </div>

    </div>
  );
}

