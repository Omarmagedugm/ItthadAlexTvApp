import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { parseLiveStreamUrl } from '../../lib/videoUtils';
import { Play, ExternalLink, RefreshCw, AlertTriangle, Youtube, Volume2, VolumeX } from 'lucide-react';

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
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  const parsed = parseLiveStreamUrl(url);

  // Reset states on URL change
  useEffect(() => {
    setHasError(false);
    setIsLoading(true);
  }, [url, reloadKey]);

  // HLS stream setup
  useEffect(() => {
    if (!url || parsed.type !== 'hls' || !isActive) return;

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
        video.play().catch(() => {
          // Autoplay may be muted by browser
        });
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
      // Native Apple Safari HLS
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
  }, [url, parsed.type, parsed.embedUrl, isActive, reloadKey]);

  if (!isActive) {
    return (
      <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center p-6 text-center z-10">
        <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mb-4 text-slate-500 shadow-inner">
          <span className="material-symbols-outlined text-3xl">videocam_off</span>
        </div>
        <h3 className="text-white font-black text-base mb-1.5">لا يوجد بث مباشر لـ {sportName} حالياً</h3>
        <p className="text-slate-400 text-xs max-w-xs leading-relaxed">
          سيبدأ البث المباشر فور انطلاق أحداث المباراة. يمكنك متابعة التحديثات والدردشة مع الجماهير أدناه.
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
        <h3 className="text-white font-black text-sm mb-1">في انتظار إشارة البث المباشر</h3>
        <p className="text-slate-400 text-xs">سيظهر البث هنا فور بدئه من قبل الإدارة</p>
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
          {/* Quick Fallback bar if YouTube restricts embedding */}
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
