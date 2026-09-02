import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { parseLiveStreamUrl } from '../../lib/videoUtils';
import { Play, Pause, ExternalLink, RefreshCw, AlertTriangle, Youtube, Volume2, VolumeX, Radio as AudioIcon } from 'lucide-react';

interface LivePlayerProps {
  url?: string;
  title?: string;
  isActive?: boolean;
  sportName?: string;
}

const LivePlayer = React.memo(function LivePlayer({ url, title, isActive = true, sportName = 'كرة القدم' }: LivePlayerProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  const parsed = parseLiveStreamUrl(url);
  const isAudio = parsed.type === 'audio';
  const isRawIframe = !!(parsed.rawIframe || (typeof url === 'string' && (url.trim().startsWith('<iframe') || url.includes('<iframe'))));

  // Reset states on URL change
  useEffect(() => {
    setHasError(false);
    setIsLoading(!isRawIframe);
    setIsAudioPlaying(false);

    if (isRawIframe) {
      const timer = setTimeout(() => {
        setIsLoading(false);
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [url, reloadKey, sportName, isRawIframe]);

  // Audio stream setup
  useEffect(() => {
    if (!isAudio || !url || !isActive) return;
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
  }, [url, isAudio, isActive, reloadKey]);

  // HLS stream setup
  useEffect(() => {
    if (!url || parsed.type !== 'hls' || !isActive || isAudio) return;

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
        backBufferLength: 60,
        maxBufferLength: 30,
        maxMaxBufferLength: 120,
        maxBufferSize: 60 * 1000 * 1000,
        autoStartLoad: true
      });
      hlsRef.current = hls;

      hls.loadSource(parsed.embedUrl || url);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsLoading(false);
        setHasError(false);
        const playPromise = video.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {
            // Autoplay with audio was blocked by browser policy - mute and retry
            video.muted = true;
            video.play().catch(() => {});
          });
        }
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.warn('HLS Network Error, attempting reload...', data);
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.warn('HLS Media Error, recovering...', data);
              hls.recoverMediaError();
              break;
            default:
              console.error('HLS Fatal unrecoverable error:', data);
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
      video.src = parsed.embedUrl || url;
      video.addEventListener('loadedmetadata', () => {
        setIsLoading(false);
        setHasError(false);
        const playPromise = video.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {
            video.muted = true;
            video.play().catch(() => {});
          });
        }
      });
      video.addEventListener('error', () => {
        setHasError(true);
        setIsLoading(false);
      });
    }
  }, [url, parsed.type, parsed.embedUrl, isActive, reloadKey, isAudio]);

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
          <span className="material-symbols-outlined text-3xl">videocam_off</span>
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

  // Audio Player View (if audio stream)
  if (isAudio) {
    return (
      <div className="relative w-full h-full bg-gradient-to-br from-indigo-950 via-slate-950 to-slate-900 flex flex-col items-center justify-center p-6 text-center overflow-hidden">
        <audio ref={audioRef} preload="auto" onError={() => setHasError(true)} />
        
        {/* Animated Sound Wave Background */}
        <div className="absolute inset-0 flex items-center justify-center opacity-15 pointer-events-none gap-1 px-4">
          {[40, 65, 85, 30, 95, 50, 75, 90, 60, 45, 80, 100, 35, 70, 55, 85].map((h, i) => (
            <div
              key={i}
              className="flex-1 bg-indigo-400 rounded-full transition-all duration-300"
              style={{
                height: isAudioPlaying ? `${Math.max(15, (h * (i % 3 + 1)) % 100)}%` : '10%',
                animation: isAudioPlaying ? `pulse 1.${(i % 5) + 2}s infinite ease-in-out` : 'none'
              }}
            />
          ))}
        </div>

        <div className="relative z-10 flex flex-col items-center gap-3 max-w-xs">
          <div className="relative">
            <div className={`w-20 h-20 rounded-3xl bg-gradient-to-tr from-indigo-600 to-primary flex items-center justify-center text-white shadow-2xl shadow-indigo-500/30 ${isAudioPlaying ? 'ring-4 ring-indigo-400/40 animate-pulse' : ''}`}>
              <AudioIcon size={36} className="text-white" />
            </div>
            {isAudioPlaying && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 border-2 border-white"></span>
              </span>
            )}
          </div>

          <div>
            <h3 className="text-white font-black text-base">{title || 'البث الصوتي المباشر'}</h3>
            <p className="text-indigo-400 text-xs font-bold mt-0.5">استوديو الصوت المباشر 🎙️</p>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3 mt-2">
            <button
              onClick={toggleAudioPlay}
              className="w-12 h-12 rounded-2xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white flex items-center justify-center shadow-lg shadow-indigo-500/30 transition-all cursor-pointer"
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
      {/* Raw HTML IFrame Stream (preserved exactly as provided) */}
      {isRawIframe && (
        <div
          key={`raw-iframe-${reloadKey}`}
          className="w-full h-full relative overflow-hidden bg-black [&>iframe]:w-full [&>iframe]:h-full [&>iframe]:absolute [&>iframe]:inset-0 [&>iframe]:border-0 [&>iframe]:object-cover"
          dangerouslySetInnerHTML={{
            __html: parsed.rawIframe || (url as string)
          }}
        />
      )}

      {/* YouTube Stream (if not raw iframe) */}
      {!isRawIframe && parsed.type === 'youtube' && (
        <div className="relative w-full h-full">
          <iframe
            key={`yt-${reloadKey}-${parsed.embedUrl}`}
            className="w-full h-full absolute inset-0 border-0"
            src={parsed.embedUrl}
            title={title || "YouTube Live Stream"}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
            allowFullScreen
            referrerPolicy="origin-when-cross-origin"
            onLoad={() => setIsLoading(false)}
            onError={() => {
              setHasError(true);
              setIsLoading(false);
            }}
          />
        </div>
      )}

      {/* Direct Video / HLS Stream */}
      {!isRawIframe && (parsed.type === 'hls' || parsed.type === 'video') && (
        <video
          key={`video-${reloadKey}`}
          ref={videoRef}
          className="w-full h-full object-contain bg-black"
          controls
          playsInline
          autoPlay
          preload="auto"
          onLoadedData={() => {
            setIsLoading(false);
            setHasError(false);
          }}
          onError={() => {
            setHasError(true);
            setIsLoading(false);
          }}
        >
          {parsed.type === 'video' && <source src={parsed.embedUrl || url} />}
          متصفحك لا يدعم تشغيل هذا البث المباشر.
        </video>
      )}

      {/* Embed / IFrame URL Stream (Non-HTML URL that is an iframe source) */}
      {!isRawIframe && parsed.type === 'iframe' && (
        <iframe
          key={`iframe-${reloadKey}`}
          src={parsed.embedUrl}
          className="w-full h-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen; screen-wake-lock; display-capture"
          allowFullScreen
          onLoad={() => setIsLoading(false)}
          onError={() => {
            setHasError(true);
            setIsLoading(false);
          }}
        />
      )}

      {/* Fallback Custom URL */}
      {!isRawIframe && parsed.type === 'custom' && (
        <iframe
          key={`custom-${reloadKey}`}
          src={parsed.embedUrl}
          className="w-full h-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
          allowFullScreen
          onLoad={() => setIsLoading(false)}
          onError={() => {
            setHasError(true);
            setIsLoading(false);
          }}
        />
      )}

      {/* Error Fallback */}
      {hasError && (
        <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center p-6 text-center z-30">
          <AlertTriangle size={36} className="text-amber-400 mb-3" />
          <h4 className="text-white font-black text-sm mb-1">تعذر تشغيل البث المباشر</h4>
          <p className="text-slate-400 text-xs max-w-xs mb-4">
            قد يكون البث غير متاح حالياً أو متوقف من المصدر
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setHasError(false);
                setIsLoading(true);
                setReloadKey(k => k + 1);
              }}
              className="px-4 py-2 bg-primary text-white rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-md"
            >
              <RefreshCw size={13} />
              إعادة المحاولة
            </button>
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {isLoading && !hasError && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center pointer-events-none z-20">
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
            <span className="text-white font-bold text-[11px]">جاري الاتصال بالبث...</span>
          </div>
        </div>
      )}
    </div>
  );
});

export default LivePlayer;
