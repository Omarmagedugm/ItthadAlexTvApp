import React, { useState, useEffect, useRef } from 'react';
import { getOptimizedImage } from '../lib/cloudinary';

export const getTeamLogoWithFallback = (teamName?: string, logoUrl?: string): string => {
  if (logoUrl && logoUrl.trim().length > 5) {
    return logoUrl.trim();
  }
  if (!teamName) return 'https://res.cloudinary.com/dqj6gzwfg/image/upload/v1777720049/admin_homeLogo/bsxn6a8jxy6yfbyh56df.png';
  
  const name = teamName.trim().toLowerCase();

  if (name.includes('اتحاد') || name.includes('ittihad')) return 'https://res.cloudinary.com/dqj6gzwfg/image/upload/v1777720049/admin_homeLogo/bsxn6a8jxy6yfbyh56df.png';
  if (name.includes('أهلي') || name.includes('اهلي') || name.includes('ahly')) return 'https://upload.wikimedia.org/wikipedia/en/thumb/e/ef/Al_Ahly_SC_logo.svg/1200px-Al_Ahly_SC_logo.svg.png';
  if (name.includes('زمالك') || name.includes('zamalek')) return 'https://upload.wikimedia.org/wikipedia/en/thumb/0/04/Zamalek_SC_logo.svg/1200px-Zamalek_SC_logo.svg.png';
  if (name.includes('بيراميدز') || name.includes('pyramids')) return 'https://upload.wikimedia.org/wikipedia/en/thumb/c/c9/Pyramids_FC_logo.svg/1200px-Pyramids_FC_logo.svg.png';
  if (name.includes('سموحة') || name.includes('smouha')) return 'https://upload.wikimedia.org/wikipedia/ar/thumb/8/87/Smouha_SC_logo.png/1200px-Smouha_SC_logo.png';
  if (name.includes('إسماعيلي') || name.includes('اسماعيلي') || name.includes('ismaily')) return 'https://upload.wikimedia.org/wikipedia/ar/thumb/0/00/Ismaily_SC_logo.png/1200px-Ismaily_SC_logo.png';
  if (name.includes('مصري') || name.includes('masry')) return 'https://upload.wikimedia.org/wikipedia/ar/thumb/f/f6/Al_Masry_SC_logo.png/1200px-Al_Masry_SC_logo.png';
  if (name.includes('سيراميكا') || name.includes('ceramica')) return 'https://upload.wikimedia.org/wikipedia/ar/thumb/2/23/Ceramica_Cleopatra_FC_logo.png/1200px-Ceramica_Cleopatra_FC_logo.png';
  if (name.includes('إنبي') || name.includes('انبي') || name.includes('enppi')) return 'https://upload.wikimedia.org/wikipedia/ar/thumb/f/f2/ENPPI_Club_logo.png/1200px-ENPPI_Club_logo.png';
  if (name.includes('محلة') || name.includes('mahalla')) return 'https://upload.wikimedia.org/wikipedia/ar/0/03/%D8%BA%D8%B2%D9%84_%D8%A7%D9%84%D9%85%D8%AD%D9%84%D8%A9.png';
  if (name.includes('مقاولون') || name.includes('mokawloon')) return 'https://upload.wikimedia.org/wikipedia/ar/thumb/d/d3/Arab_Contractors_SC_logo.png/1200px-Arab_Contractors_SC_logo.png';
  if (name.includes('سبورتنج') || name.includes('sporting')) return 'https://upload.wikimedia.org/wikipedia/ar/thumb/3/30/Alexandria_Sporting_Club_Logo.png/1200px-Alexandria_Sporting_Club_Logo.png';
  if (name.includes('أوليمبي') || name.includes('اوليمبي') || name.includes('olympi')) return 'https://upload.wikimedia.org/wikipedia/ar/thumb/3/38/El_Olympi_Club_logo.png/1200px-El_Olympi_Club_logo.png';

  return 'https://res.cloudinary.com/dqj6gzwfg/image/upload/v1777720049/admin_homeLogo/bsxn6a8jxy6yfbyh56df.png';
};

interface SafeImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  width?: number;
  fallback?: string;
  teamName?: string;
  fetchPriority?: 'high' | 'low' | 'auto';
}

export const SafeImage: React.FC<SafeImageProps> = ({ 
  src, 
  alt, 
  className = '', 
  width, 
  fallback,
  teamName,
  fetchPriority,
  ...props 
}) => {
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  const effectiveSrc = teamName ? getTeamLogoWithFallback(teamName, src as string) : (src || fallback || 'https://res.cloudinary.com/dqj6gzwfg/image/upload/v1777720049/admin_homeLogo/bsxn6a8jxy6yfbyh56df.png');
  const optimizedSrc = getOptimizedImage(hasError ? (fallback || getTeamLogoWithFallback(teamName)) : effectiveSrc, width);

  useEffect(() => {
    setHasError(false);
    setIsLoaded(false);
    if (imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth > 0) {
      setIsLoaded(true);
    }
  }, [src, teamName]);

  const isContain = className.includes('object-contain');
  const fitClass = isContain ? 'object-contain' : 'object-cover';

  return (
    <div className={`relative overflow-hidden ${className} flex items-center justify-center shrink-0`}>
      {/* Fast Football Icon Placeholder while loading */}
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-100/30 dark:bg-slate-800/30 rounded-full z-0">
          <span className="material-symbols-outlined text-amber-500 animate-pulse text-[1.4em] select-none">
            sports_soccer
          </span>
        </div>
      )}

      <img
        {...props}
        ref={imgRef}
        src={optimizedSrc}
        alt={alt || teamName || ''}
        fetchPriority={fetchPriority}
        onLoad={() => setIsLoaded(true)}
        onError={() => {
          if (!hasError) {
            setHasError(true);
          } else {
            setIsLoaded(true);
          }
        }}
        className={`relative z-10 w-full h-full ${fitClass} transition-opacity duration-200 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
        referrerPolicy="no-referrer"
      />
    </div>
  );
};


