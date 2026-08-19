import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { parseLiveStreamUrl } from '../../lib/videoUtils';
import { Play, Pause, ExternalLink, RefreshCw, AlertTriangle, Youtube, Volume2, VolumeX, Radio as RadioIcon } from 'lucide-react';

interface LivePlayerProps {
  url?: string;
  title?: string;
  isActive?: boolean;
  sportName?: string;
}

export default function LivePlayer({ url, title, isActive = true, sportName = 'كرة القدم' }: LivePlayerProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  const parsed = parseLiveStreamUrl(url);
  const isRadio = sportName.includes('راديو') || parsed.type === 'audio';

  // Reset states on URL change
  useEffect(() => {
    setHasError(false);
    setIsLoading(true);
    setIsAudioPlaying(false);
  }, [url, reloadKey, sportName]);

  // Audio stream setup
  useEffect(() => {
    if (!isRadio || !url || !isActive) return;
    const audio = audioRef.current;
    if (!audio) return;

    audio.src = url;
    audio.play()
      .then(() => {
        setIsAudioPlaying(true);
        setIsLoading(false);
      })
      .catch(() => {
        // Autoplay may require user gesture
        setIsAudioPlaying(false);
        setIsLoading(false);
      });

    return () => {
      audio.pause();
    };
  }, [url, isRadio, isActive, reloadKey]);

  // HLS stream setup
  useEffect(() => {
    if (!url || parsed.type !== 'hls' || !isActive || isRadio) return;

    const video = videoRef.current;
    if (!video) return;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 30
      });
      hlsRef.current = hls;

      hls.loadSource(parsed.embedUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsLoading(false);
        video.play().catch(() => {});
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              setHasError(true);
              setIsLoading(false);
              hls.destroy();
              break;
          }
        }
      });

      return () => {
        if (hlsRef.current) {
          hlsRef.current.destroy();
          hlsRef.current = null;
        }
      };
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = parsed.embedUrl;
      video.addEventListener('loadedmetadata', () => {
        setIsLoading(false);
        video.play().catch(() => {});
      });
      video.addEventListener('error', () => {
        setHasError(true);
        setIsLoading(false);
      });
    }
  }, [url, parsed.type, parsed.embedUrl, isActive, reloadKey, isRadio]);

  const toggleAudioPlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isAudioPlaying) {
      audio.pause();
      setIsAudioPlaying(false);
    } else {
      audio.play().then(() => setIsAudioPlaying(true)).catch(() => {});
    }
  };

  const toggleMute = () => {
    const audio = audioRef.current;
    if (audio) {
      audio.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  if (!isActive) {
    return (
      <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center p-6 text-center z-10">
        <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mb-4 text-slate-500 shadow-inner">
          <span className="material-symbols-outlined text-3xl">{isRadio ? 'radio' : 'videocam_off'}</span>
        </div>
        <h3 className="text-white font-black text-base mb-1.5">لا يوجد بث مباشر لـ {sportName} حالياً</h3>
        <p className="text-slate-400 text-xs max-w-xs leading-relaxed">
          سيبدأ البث فور انطلاقه من قبل الإدارة. يمكنك متابعة الدردشة والتفاعل أدناه.
        </p>
      </div>
    );
  }

  if (!url || url.trim() === '') {
    return (
      <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center p-6 text-center z-10">
        <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mb-4 text-primary animate-pulse">
          <Play size={28} className="fill-primary ml-1" />
        </div>
        <h3 className="text-white font-black text-sm mb-1">في انتظار إشارة البث</h3>
        <p className="text-slate-400 text-xs">سيظهر البث هنا فور بدئه من قبل الإدارة</p>
      </div>
    );
  }

  // Radio Audio Player View
  if (isRadio) {
    return (
      <div className="relative w-full h-full bg-gradient-to-br from-emerald-950 via-slate-950 to-slate-900 flex flex-col items-center justify-center p-6 text-center overflow-hidden">
        <audio ref={audioRef} preload="auto" onError={() => setHasError(true)} />
        
        {/* Animated Sound Wave Background */}
        <div className="absolute inset-0 flex items-center justify-center opacity-15 pointer-events-none gap-1 px-4">
          {[40, 65, 85, 30, 95, 50, 75, 90, 60, 45, 80, 100, 35, 70, 55, 85].map((h, i) => (
            <div
              key={i}
              className="flex-1 bg-emerald-400 rounded-full transition-all duration-300"
              style={{
                height: isAudioPlaying ? `${Math.max(15, (h * (i % 3 + 1)) % 100)}%` : '10%',
                animation: isAudioPlaying ? `pulse 1.${(i % 5) + 2}s infinite ease-in-out` : 'none'
              }}
            />
          ))}
        </div>

        <div className="relative z-10 flex flex-col items-center gap-3 max-w-xs">
          <div className="relative">
            <div className={`w-20 h-20 rounded-3xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-2xl shadow-emerald-500/30 ${isAudioPlaying ? 'ring-4 ring-emerald-400/40 animate-pulse' : ''}`}>
              <RadioIcon size={36} className="text-white" />
            </div>
            {isAudioPlaying && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 border-2 border-white"></span>
              </span>
            )}
          </div>

          <div>
            <h3 className="text-white font-black text-base">{title || 'راديو زعيم الثغر'}</h3>
            <p className="text-emerald-400 text-xs font-bold mt-0.5">البث الصوتي المباشر 🎙️</p>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3 mt-2">
            <button
              onClick={toggleAudioPlay}
              className="w-12 h-12 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30 transition-all cursor-pointer"
            >
              {isAudioPlaying ? <Pause size={22} /> : <Play size={22} className="fill-white ml-0.5" />}
            </button>
            <button
              onClick={toggleMute}
              className="p-3 rounded-2xl bg-white/10 hover:bg-white/20 active:scale-95 text-white transition-all cursor-pointer"
              title={isMuted ? 'إلغاء الكتم' : 'كتم الصوت'}
            >
              {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-black flex flex-col items-center justify-center overflow-hidden">
      {/* YouTube Stream */}
      {parsed.type === 'youtube' && (
        <div className="relative w-full h-full">
          <iframe
            key={`yt-${reloadKey}-${parsed.embedUrl}`}
            className="w-full h-full absolute inset-0 border-0"
            src={parsed.embedUrl}
            title={title || "YouTube Live Stream"}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            referrerPolicy="origin-when-cross-origin"
            onLoad={() => setIsLoading(false)}
            onError={() => {
              setIsLoading(false);
              setHasError(true);
            }}
          />
          {parsed.directWatchUrl && (
            <a
              href={parsed.directWatchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute bottom-2 right-2 bg-black/80 hover:bg-red-600 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg backdrop-blur-md border border-white/10 flex items-center gap-1.5 transition-colors z-20 shadow-lg"
            >
              <Youtube size={14} className="text-red-500 hover:text-white" />
              <span>مشاهدة على YouTube</span>
              <ExternalLink size={12} />
            </a>
          )}
        </div>
      )}

      {/* HLS Stream */}
      {parsed.type === 'hls' && (
        <div className="relative w-full h-full">
          <video
            ref={videoRef}
            key={`hls-${reloadKey}`}
            className="w-full h-full object-contain absolute inset-0 bg-black"
            controls
            playsInline
            autoPlay
          />
        </div>
      )}

      {/* Direct Video Stream */}
      {parsed.type === 'video' && (
        <video
          key={`vid-${reloadKey}`}
          className="w-full h-full object-contain absolute inset-0 bg-black"
          controls
          playsInline
          autoPlay
          src={parsed.embedUrl}
          onLoadedData={() => setIsLoading(false)}
          onError={() => {
            setIsLoading(false);
            setHasError(true);
          }}
        />
      )}

      {/* Generic Iframe */}
      {parsed.type === 'iframe' && (
        <div className="relative w-full h-full">
          <iframe
            key={`iframe-${reloadKey}`}
            className="w-full h-full absolute inset-0 border-0"
            src={parsed.embedUrl}
            title={title || "Live Stream"}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            onLoad={() => setIsLoading(false)}
            onError={() => {
              setIsLoading(false);
              setHasError(true);
            }}
          />
          {parsed.directWatchUrl && (
            <a
              href={parsed.directWatchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute bottom-2 right-2 bg-black/80 hover:bg-primary text-white text-[11px] font-bold px-3 py-1.5 rounded-lg backdrop-blur-md border border-white/10 flex items-center gap-1.5 transition-colors z-20 shadow-lg"
            >
              <span>فتح البث في نافذة جديدة</span>
              <ExternalLink size={12} />
            </a>
          )}
        </div>
      )}

      {/* Custom Stream Fallback */}
      {parsed.type === 'custom' && (
        <div className="relative w-full h-full flex flex-col items-center justify-center p-6 text-center">
          <iframe
            className="w-full h-full absolute inset-0 border-0"
            src={parsed.embedUrl}
            title={title || "Live Stream"}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            onLoad={() => setIsLoading(false)}
          />
          <a
            href={parsed.directWatchUrl || url}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute bottom-3 bg-primary hover:bg-primary-dark text-white text-xs font-black px-4 py-2 rounded-xl shadow-lg flex items-center gap-2 z-20"
          >
            <span>فتح رابط البث المباشر</span>
            <ExternalLink size={14} />
          </a>
        </div>
      )}

      {/* Error state */}
      {hasError && (
        <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center p-6 text-center z-30">
          <AlertTriangle size={32} className="text-amber-500 mb-3" />
          <h4 className="text-white font-black text-sm mb-1">تعذر تشغيل البث المباشر داخل الصفحة</h4>
          <p className="text-slate-400 text-xs max-w-xs mb-4">
            قد يكون البث مقيداً من المصدر أو يتطلب فتحه مباشرة في تطبيق YouTube أو المتصفح.
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setReloadKey(k => k + 1)}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
            >
              <RefreshCw size={14} />
              إعادة المحاولة
            </button>
            {parsed.directWatchUrl && (
              <a
                href={parsed.directWatchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-lg shadow-red-600/30 transition-all"
              >
                <Youtube size={16} />
                فتح مباشرة على YouTube
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
