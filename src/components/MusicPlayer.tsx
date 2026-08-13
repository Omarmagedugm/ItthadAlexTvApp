import React, { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Volume2, 
  VolumeX,
  X,
  ChevronDown,
  ChevronUp,
  Repeat,
  Shuffle,
  Music
} from 'lucide-react';
import { useAppStore } from '../store';

const formatTime = (time: number) => {
  if (isNaN(time)) return '0:00';
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
};

export default function MusicPlayer() {
  const { currentSong, isPlaying, setIsPlaying, setCurrentSong, activePlaylist } = useAppStore();
  const [volume, setVolume] = useState(0.5);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleNext = () => {
    if (!activePlaylist.length || !currentSong) return;
    if (shuffle) {
      const randomIndex = Math.floor(Math.random() * activePlaylist.length);
      setCurrentSong(activePlaylist[randomIndex]);
    } else {
      const currentIndex = activePlaylist.findIndex(s => s.id === currentSong.id);
      const nextIndex = (currentIndex + 1) % activePlaylist.length;
      setCurrentSong(activePlaylist[nextIndex]);
    }
    setIsPlaying(true);
  };

  const handlePrevious = () => {
    if (!activePlaylist.length || !currentSong) return;
    if (audioRef.current && currentTime > 3) {
      audioRef.current.currentTime = 0;
      return;
    }
    const currentIndex = activePlaylist.findIndex(s => s.id === currentSong.id);
    const prevIndex = (currentIndex - 1 + activePlaylist.length) % activePlaylist.length;
    setCurrentSong(activePlaylist[prevIndex]);
    setIsPlaying(true);
  };

  useEffect(() => {
    if (audioRef.current && currentSong?.audioUrl) {
      if (isPlaying) {
        audioRef.current.play().catch(e => {
          console.warn("Playback prevented or failed:", e);
          setIsPlaying(false);
          if (e.name === 'NotAllowedError') {
            setError("التشغيل التلقائي محظور. يرجى الضغط على التشغيل يدوياً.");
          }
        });
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying, currentSong]);

  useEffect(() => {
    setError(null);
  }, [currentSong]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  if (!currentSong) return null;

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      const p = (audioRef.current.currentTime / audioRef.current.duration) * 100;
      setProgress(p || 0);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const p = parseFloat(e.target.value);
    if (audioRef.current && duration) {
      audioRef.current.currentTime = (p / 100) * duration;
      setProgress(p);
    }
  };

  const handleEnded = () => {
    if (repeat && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => setIsPlaying(false));
    } else {
      handleNext();
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className={`fixed z-[100] transition-all duration-300 ${
          expanded 
            ? 'inset-0 bg-background-light dark:bg-background-dark md:inset-auto md:bottom-6 md:left-6 md:right-auto md:w-[350px] md:h-[500px] md:rounded-[32px] md:border md:border-border-light md:dark:border-border-dark md:shadow-2xl' 
            : 'bottom-[120px] left-4 right-4 md:left-auto md:right-6 md:bottom-6 md:w-[350px] h-[72px]'
        }`}
      >
        <audio 
          ref={audioRef}
          src={currentSong.audioUrl || undefined}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={handleEnded}
          onError={(e) => {
            const audio = e.currentTarget;
            const err = audio.error;
            let errorMessage = "حدث خطأ أثناء تحميل الملف";
            if (err) {
              if (err.code === 1) errorMessage = "تم إيقاف التحميل";
              else if (err.code === 2) errorMessage = "خطأ في الشبكة";
              else if (err.code === 3) errorMessage = "خطأ في معالجة الملف";
              else if (err.code === 4) errorMessage = "رابط غير صالح";
            }
            setError(errorMessage);
            setIsPlaying(false);
          }}
        />

        {/* Minimized View */}
        {!expanded && (
          <div 
            onClick={() => setExpanded(true)}
            className="w-full h-full bg-white/95 dark:bg-card-dark/95 backdrop-blur-md rounded-3xl border border-border-light dark:border-border-dark shadow-xl shadow-primary/10 overflow-hidden flex flex-col cursor-pointer hover:border-primary/30 transition-colors"
          >
            <div className="flex-1 flex items-center px-3 gap-3">
              <div className="relative w-12 h-12 rounded-[14px] overflow-hidden shrink-0 shadow-md">
                {currentSong.coverUrl && currentSong.coverUrl.trim() !== '' ? (
                  <img src={currentSong.coverUrl} className={`w-full h-full object-cover ${isPlaying ? 'animate-spin-slow' : ''}`} referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full bg-slate-100 dark:bg-surface-dark flex items-center justify-center">
                    <Music className="text-slate-400" size={20} />
                  </div>
                )}
              </div>
              
              <div className="min-w-0 flex-1">
                <h4 className="text-xs font-black truncate text-primary-dark dark:text-white">{error || currentSong.title}</h4>
                <p className={`text-[10px] font-bold truncate ${error ? 'text-red-500' : 'text-slate-500 dark:text-slate-400'}`}>
                  {error ? 'خطأ التشغيل' : currentSong.artist}
                </p>
              </div>

              <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                <button 
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="w-10 h-10 bg-primary/10 text-primary dark:bg-primary/20 hover:bg-primary hover:text-white rounded-xl flex items-center justify-center transition-all"
                >
                  {isPlaying ? <Pause fill="currentColor" size={16} /> : <Play fill="currentColor" size={16} className="ml-0.5" />}
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); setCurrentSong(null); }}
                  className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-500 rounded-lg"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            {/* Miniature Progress Bar */}
            <div className="h-1 bg-slate-100 dark:bg-surface-dark w-full">
               <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        {/* Expanded View */}
        {expanded && (
          <div className="w-full h-full flex flex-col bg-white dark:bg-card-dark md:rounded-[32px] overflow-hidden relative">
            {/* Header */}
            <div className="flex flex-row items-center justify-between p-6">
              <button onClick={() => setExpanded(false)} className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                <ChevronDown size={24} />
              </button>
              <span className="text-xs font-black text-slate-500 uppercase tracking-widest text-center">مشغل الموسيقى</span>
              <button onClick={() => setCurrentSong(null)} className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                <X size={24} />
              </button>
            </div>

            {/* Artwork */}
            <div className="flex-1 flex items-center justify-center px-8 relative">
               <div className={`relative w-full max-w-[300px] aspect-square rounded-[40px] overflow-hidden shadow-2xl shadow-primary/20 transition-all duration-700 ${isPlaying ? 'scale-100' : 'scale-90 opacity-90'}`}>
                 {currentSong.coverUrl && currentSong.coverUrl.trim() !== '' ? (
                    <img src={currentSong.coverUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-full h-full bg-slate-100 dark:bg-surface-dark flex items-center justify-center">
                      <Music className="text-slate-300" size={64} />
                    </div>
                  )}
               </div>
            </div>

            {/* Info & Controls */}
            <div className="p-8 pb-10">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-black text-primary-dark dark:text-white truncate mb-1">{error || currentSong.title}</h2>
                <p className={`text-sm font-bold ${error ? 'text-red-500' : 'text-slate-500 dark:text-slate-400'}`}>{currentSong.artist}</p>
              </div>

              {/* Progress */}
              <div className="mb-8">
                <div className="relative h-2 group w-full flex items-center">
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={progress}
                    onChange={handleProgressChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className="w-full h-1.5 bg-slate-100 dark:bg-surface-dark rounded-full overflow-hidden">
                    <div className="h-full bg-primary relative" style={{ width: `${progress}%` }} />
                  </div>
                  {/* Thumb */}
                  <div 
                    className="absolute h-3 w-3 bg-white border-2 border-primary rounded-full shadow pointer-events-none group-hover:scale-125 transition-transform"
                    style={{ left: `${progress}%`, marginLeft: '-6px' }}
                  />
                </div>
                <div className="flex justify-between items-center mt-2 px-1">
                  <span className="text-[10px] font-bold text-slate-400">{formatTime(currentTime)}</span>
                  <span className="text-[10px] font-bold text-slate-400">{formatTime(duration)}</span>
                </div>
              </div>

              {/* Main Buttons */}
              <div className="flex items-center justify-between mb-6">
                <button onClick={() => setShuffle(!shuffle)} className={`p-3 rounded-full transition-colors ${shuffle ? 'text-primary bg-primary/10' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                  <Shuffle size={20} />
                </button>
                
                <div className="flex items-center gap-4">
                  <button onClick={handlePrevious} className="p-4 text-primary-dark dark:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                    <SkipBack size={24} fill="currentColor" />
                  </button>
                  
                  <button 
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="w-20 h-20 bg-primary text-white rounded-[28px] flex items-center justify-center shadow-xl shadow-primary/30 transform active:scale-95 transition-all hover:scale-105"
                  >
                    {isPlaying ? <Pause fill="white" size={32} /> : <Play fill="white" size={32} className="ml-1" />}
                  </button>
                  
                  <button onClick={handleNext} className="p-4 text-primary-dark dark:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                    <SkipForward size={24} fill="currentColor" />
                  </button>
                </div>

                <button onClick={() => setRepeat(!repeat)} className={`p-3 rounded-full transition-colors ${repeat ? 'text-primary bg-primary/10' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                  <Repeat size={20} />
                </button>
              </div>
              
              {/* Volume (Desktop Only) */}
              <div className="hidden md:flex items-center gap-3 max-w-[200px] mx-auto opacity-70 hover:opacity-100 transition-opacity">
                 <button onClick={() => setIsMuted(!isMuted)} className="text-slate-400 hover:text-primary transition-colors">
                   {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                 </button>
                 <input 
                   type="range" 
                   min="0" 
                   max="1" 
                   step="0.01"
                   value={isMuted ? 0 : volume}
                   onChange={(e) => setVolume(parseFloat(e.target.value))}
                   className="w-full h-1.5 bg-slate-100 dark:bg-surface-dark rounded-full appearance-none cursor-pointer accent-primary"
                 />
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
