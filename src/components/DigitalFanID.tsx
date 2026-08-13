import React, { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { Download, Loader2 } from 'lucide-react';
import { useAppStore } from '../store';
import { getOptimizedImage } from '../lib/cloudinary';

interface DigitalFanIDProps {
  username: string;
  memberId?: string;
  avatarUrl: string;
  role?: string;
  tier?: string;
}

export default function DigitalFanID({ username, memberId, avatarUrl, role, tier }: DigitalFanIDProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const { appSettings } = useAppStore();

  const getBadgeLabel = () => {
    if (role === 'admin') return 'مدير التطبيق 🛡️';
    if (role === 'moderator') return 'مشرف النظام ⚡';
    if (tier === 'premium') return 'عضو ملكي 👑';
    if (tier === 'diamond') return 'عضو ماسي 💎';
    if (tier === 'gold') return 'عضو ذهبي 🥇';
    if (tier === 'silver') return 'عضو فضي 🥈';
    if (tier === 'bronze') return 'عضو برونزي 🥉';
    return 'عضو مشجع 🟢';
  };

  const handleDownload = async () => {
    if (!cardRef.current) return;
    try {
      setDownloading(true);
      const canvas = await html2canvas(cardRef.current, {
        scale: 2, // High resolution
        useCORS: true,
        backgroundColor: null,
      });
      
      const link = document.createElement('a');
      link.download = `Ittihad-Fan-ID-${username}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('Failed to generate image:', err);
    } finally {
      setDownloading(false);
    }
  };

  const displayId = memberId || '#UC-1906';

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      {/* The ID Card */}
      <div 
        ref={cardRef}
        className="relative overflow-hidden rounded-2xl shadow-2xl flex flex-col justify-between"
        style={{
          width: '360px',
          height: '220px',
          background: 'linear-gradient(135deg, #0A5C36 0%, #158A4D 50%, #ffffff 100%)',
          color: 'white',
          direction: 'rtl',
        }}
      >
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-2xl -mt-10 -mr-10" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}></div>
        <div className="absolute bottom-0 left-0 w-40 h-40 rounded-full blur-3xl -mb-10 -ml-10" style={{ backgroundColor: 'rgba(0,0,0,0.1)' }}></div>

        {/* Top Header */}
        <div className="flex justify-between items-start p-4 relative z-10">
          <div>
            <h3 className="font-black text-lg drop-shadow-md" style={{ color: '#ffffff' }}>بطاقة مشجع رقمية</h3>
            <p className="text-[10px] font-bold drop-shadow-md" style={{ color: 'rgba(255,255,255,0.9)' }}>تطبيق جماهير نادي الاتحاد السكندري</p>
          </div>
          <div className="text-[10px] font-black uppercase px-2 py-1 rounded-md backdrop-blur-sm tracking-wider" style={{ backgroundColor: 'rgba(0,0,0,0.2)', color: 'rgba(255,255,255,0.9)' }}>
            Est. 1906
          </div>
        </div>

        {/* Middle Content */}
        <div className="flex items-center gap-4 px-4 relative z-10">
          <div className="w-16 h-16 rounded-full border-2 shadow-xl overflow-hidden shrink-0" style={{ borderColor: '#ffffff', backgroundColor: '#f1f5f9' }}>
            <img 
              src={avatarUrl} 
              alt={username} 
              className="w-full h-full object-cover"
              crossOrigin="anonymous"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="min-w-0">
            <h2 className="font-black text-xl truncate drop-shadow-md pb-1" style={{ color: '#ffffff' }}>{username}</h2>
            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              <div className="text-xs font-bold px-2 py-0.5 rounded-md inline-block shadow-sm" style={{ color: '#1e293b', backgroundColor: 'rgba(255,255,255,0.85)' }}>
                {displayId}
              </div>
              <div className="text-[10px] font-black px-2 py-0.5 rounded-md inline-block shadow-sm" style={{ color: '#0f172a', backgroundColor: 'rgba(255,255,255,0.95)' }}>
                {getBadgeLabel()}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Footer */}
        <div className="p-4 flex justify-between items-end relative z-10">
          <div className="font-black text-sm drop-shadow-md px-3 py-1 rounded-full backdrop-blur-md" style={{ color: '#14532d', backgroundColor: 'rgba(255,255,255,0.4)' }}>
            سيد البلد 🟢⚪
          </div>
          
          {/* A small watermark / logo could go here */}
          <div className="h-8 w-8 opacity-50 grayscale brightness-200">
            <img 
              src={getOptimizedImage(appSettings.appLogo, 100)} 
              onError={(e) => { e.currentTarget.src = 'https://res.cloudinary.com/dqj6gzwfg/image/upload/v1777716805/favicon_gd0ic4.png'; }}
              alt="Logo" 
              className="w-full h-full object-contain"
              crossOrigin="anonymous" 
            />
          </div>
        </div>
      </div>

      {/* Download Button */}
      <button 
        onClick={handleDownload}
        disabled={downloading}
        className="flex items-center gap-2 bg-primary dark:bg-primary text-white font-black px-6 py-3 rounded-xl shadow-lg hover:bg-primary-dark transition-all disabled:opacity-70 disabled:cursor-not-allowed"
      >
        {downloading ? (
          <Loader2 size={20} className="animate-spin" />
        ) : (
          <Download size={20} />
        )}
        تحميل بطاقة المشجع (PNG)
      </button>
    </div>
  );
}
