import React, { useState } from 'react';

/**
 * Converts Unicode emoji country flags (e.g. 🇸🇦, 🇦🇪) to 2-letter ISO code (e.g. 'sa', 'ae')
 */
export function emojiToCountryCode(emoji: string): string | null {
  if (!emoji) return null;
  try {
    const codePoints = Array.from(emoji.trim()).map(c => c.codePointAt(0) || 0);
    if (
      codePoints.length >= 2 &&
      codePoints[0] >= 0x1F1E6 &&
      codePoints[0] <= 0x1F1FF &&
      codePoints[1] >= 0x1F1E6 &&
      codePoints[1] <= 0x1F1FF
    ) {
      const first = String.fromCharCode(codePoints[0] - 0x1F1E6 + 65);
      const second = String.fromCharCode(codePoints[1] - 0x1F1E6 + 65);
      return (first + second).toLowerCase();
    }
  } catch (e) {
    // Ignore error
  }
  return null;
}

/**
 * Resolves any country identifier (code, name, emoji flag) to a 2-letter country code
 */
export function resolveCountryCode(countryIdOrFlagOrName?: string): string {
  if (!countryIdOrFlagOrName) return 'eg';
  const str = countryIdOrFlagOrName.trim().toLowerCase();

  // Try extracting from emoji flag directly
  const extracted = emojiToCountryCode(countryIdOrFlagOrName);
  if (extracted) return extracted;

  // Direct 2-letter code
  if (str.length === 2 && /^[a-z]{2}$/.test(str)) {
    return str;
  }

  // Common country IDs and name aliases
  const aliases: Record<string, string> = {
    ae: 'ae',
    uae: 'ae',
    'الإمارات': 'ae',
    'الإمارات العربية المتحدة': 'ae',
    'دولة الإمارات': 'ae',
    sa: 'sa',
    ksa: 'sa',
    'السعودية': 'sa',
    'المملكة العربية السعودية': 'sa',
    'السعوديه': 'sa',
    kw: 'kw',
    kuwait: 'kw',
    'الكويت': 'kw',
    'دولة الكويت': 'kw',
    qa: 'qa',
    qatar: 'qa',
    'قطر': 'qa',
    'دولة قطر': 'qa',
    om: 'om',
    oman: 'om',
    'عمان': 'om',
    'عُمان': 'om',
    'سلطنة عمان': 'om',
    'سلطنة عُمان': 'om',
    bh: 'bh',
    bahrain: 'bh',
    'البحرين': 'bh',
    'مملكة البحرين': 'bh',
    eg: 'eg',
    egypt: 'eg',
    'مصر': 'eg',
    'جمهورية مصر العربية': 'eg',
    gb: 'gb',
    uk: 'gb',
    'المملكة المتحدة': 'gb',
    'بريطانيا': 'gb',
    'إنجلترا': 'gb',
    'انجلترا': 'gb',
    us: 'us',
    usa: 'us',
    'أمريكا': 'us',
    'امريكا': 'us',
    'الولايات المتحدة': 'us',
    'الولايات المتحدة الأمريكية': 'us',
    eu: 'eu',
    europe: 'eu',
    'الاتحاد الأوروبي': 'eu',
    'أوروبا': 'eu',
    'اوروبا': 'eu',
    de: 'de',
    germany: 'de',
    'ألمانيا': 'de',
    'المانيا': 'de',
    fr: 'fr',
    france: 'fr',
    'فرنسا': 'fr',
    it: 'it',
    italy: 'it',
    'إيطاليا': 'it',
    'ايطاليا': 'it',
    es: 'es',
    spain: 'es',
    'إسبانيا': 'es',
    'اسبانيا': 'es',
    nl: 'nl',
    netherlands: 'nl',
    'هولندا': 'nl',
    tr: 'tr',
    turkey: 'tr',
    'تركيا': 'tr',
    ca: 'ca',
    canada: 'ca',
    'كندا': 'ca',
    au: 'au',
    australia: 'au',
    'أستراليا': 'au',
    'استراليا': 'au',
    ea: 'un',
    east_asia: 'un',
    asia: 'un',
    'شرق آسيا': 'un',
    'آسيا': 'un',
    'اسيا': 'un',
    jo: 'jo',
    jordan: 'jo',
    'الأردن': 'jo',
    'الاردن': 'jo',
    lb: 'lb',
    lebanon: 'lb',
    'لبنان': 'lb',
    sy: 'sy',
    syria: 'sy',
    'سوريا': 'sy',
    iq: 'iq',
    iraq: 'iq',
    'العراق': 'iq',
    ye: 'ye',
    yemen: 'ye',
    'اليمن': 'ye',
    sd: 'sd',
    sudan: 'sd',
    'السودان': 'sd',
    ly: 'ly',
    libya: 'ly',
    'ليبيا': 'ly',
    tn: 'tn',
    tunisia: 'tn',
    'تونس': 'tn',
    dz: 'dz',
    algeria: 'dz',
    'الجزائر': 'dz',
    ma: 'ma',
    morocco: 'ma',
    'المغرب': 'ma',
    world: 'un',
    global: 'un',
  };

  if (aliases[str]) return aliases[str];

  // If starts with 'group_' or contains code
  for (const [key, val] of Object.entries(aliases)) {
    if (str.includes(key)) return val;
  }

  return 'un';
}

export interface CountryFlagProps {
  countryCode?: string;
  flag?: string;
  countryName?: string;
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
  shape?: 'rounded' | 'circle' | 'square';
  showShadow?: boolean;
}

const sizeClasses: Record<string, string> = {
  xs: 'w-4 h-3 text-[10px]',
  sm: 'w-5 h-3.5 text-xs',
  md: 'w-6 h-4 text-sm',
  lg: 'w-8 h-5 text-base',
  xl: 'w-10 h-7 text-lg',
  '2xl': 'w-12 h-8 text-xl',
  '3xl': 'w-16 h-11 text-2xl',
};

const circleSizeClasses: Record<string, string> = {
  xs: 'w-3.5 h-3.5 text-[10px]',
  sm: 'w-5 h-5 text-xs',
  md: 'w-6 h-6 text-sm',
  lg: 'w-8 h-8 text-base',
  xl: 'w-10 h-10 text-lg',
  '2xl': 'w-12 h-12 text-xl',
  '3xl': 'w-16 h-16 text-2xl',
};

export const CountryFlag: React.FC<CountryFlagProps> = ({
  countryCode,
  flag,
  countryName,
  className = '',
  size = 'md',
  shape = 'rounded',
  showShadow = true,
}) => {
  const [hasError, setHasError] = useState(false);

  const isoCode = resolveCountryCode(countryCode || flag || countryName);

  const isCircle = shape === 'circle';
  const sizeClass = isCircle ? circleSizeClasses[size] || circleSizeClasses.md : sizeClasses[size] || sizeClasses.md;

  const shapeClass = isCircle
    ? 'rounded-full'
    : shape === 'square'
    ? 'rounded-none'
    : 'rounded-[3px] sm:rounded-sm';

  const shadowClass = showShadow ? 'shadow-xs border border-black/10 dark:border-white/15' : '';

  // Flag image URL
  const flagUrl = isCircle
    ? `https://hatscripts.github.io/circle-flags/flags/${isoCode}.svg`
    : `https://flagcdn.com/${isoCode}.svg`;

  if (hasError) {
    return (
      <span
        className={`inline-flex items-center justify-center select-none font-normal shrink-0 ${sizeClass} ${className}`}
        role="img"
        aria-label={countryName || isoCode}
      >
        {flag || '🌍'}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 overflow-hidden select-none align-middle ${shapeClass} ${shadowClass} ${sizeClass} ${className}`}
      title={countryName || isoCode.toUpperCase()}
    >
      <img
        src={flagUrl}
        alt={countryName || isoCode}
        className={`w-full h-full object-cover select-none pointer-events-none ${isCircle ? 'rounded-full' : ''}`}
        loading="lazy"
        onError={() => setHasError(true)}
      />
    </span>
  );
};

export default CountryFlag;
