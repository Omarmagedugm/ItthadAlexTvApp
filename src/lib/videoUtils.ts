export interface LiveStreamFormat {
  originalUrl: string;
  embedUrl: string;
  directWatchUrl: string;
  type: 'youtube' | 'hls' | 'video' | 'iframe' | 'custom';
  videoId?: string;
}

/**
 * Extracts YouTube Video ID from any YouTube URL format:
 * - youtube.com/watch?v=ID
 * - youtu.be/ID
 * - youtube.com/live/ID
 * - youtube.com/embed/ID
 * - youtube.com/shorts/ID
 * - Raw 11 character ID
 */
export function extractYouTubeId(url?: string): string | null {
  if (!url || typeof url !== 'string') return null;
  let trimmed = url.trim();

  // If it's already an 11-char ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  // If it's wrapped in an iframe tag
  if (trimmed.includes('<iframe')) {
    const matchSrc = trimmed.match(/src=["']([^"']+)["']/i);
    if (matchSrc && matchSrc[1]) {
      trimmed = matchSrc[1];
    }
  }

  // Match all YouTube patterns
  const match = trimmed.match(/(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?|live|shorts)\/|.*[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);
  return match && match[1] ? match[1] : null;
}

/**
 * Checks if a URL is a YouTube URL
 */
export function isYouTubeUrl(url?: string): boolean {
  if (!url || typeof url !== 'string') return false;
  return /^(https?:\/\/)?(www\.|m\.)?(youtube\.com|youtu\.be)\/.+/i.test(url.trim()) || /^[a-zA-Z0-9_-]{11}$/.test(url.trim());
}

/**
 * Gets standard embed URL for YouTube
 */
export function getYouTubeEmbedUrl(url?: string, autoplay = true): string {
  if (!url) return '';
  const videoId = extractYouTubeId(url);
  if (videoId) {
    const params = new URLSearchParams({
      autoplay: autoplay ? '1' : '0',
      playsinline: '1',
      rel: '0',
      modestbranding: '1',
      enablejsapi: '1'
    });
    return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
  }
  return url;
}

/**
 * Gets high quality YouTube thumbnail URL
 */
export function getYouTubeThumbnail(url?: string): string {
  const videoId = extractYouTubeId(url);
  if (videoId) {
    return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  }
  return '';
}

/**
 * Checks if a URL is a Facebook video URL
 */
export function isFacebookUrl(url?: string): boolean {
  if (!url || typeof url !== 'string') return false;
  return /^(https?:\/\/)?(www\.|web\.|m\.)?(facebook\.com|fb\.watch)\/.+/i.test(url.trim());
}

/**
 * Gets Facebook video embed URL
 */
export function getFacebookEmbedUrl(url?: string, autoplay = true): string {
  if (!url) return '';
  const encoded = encodeURIComponent(url.trim());
  return `https://www.facebook.com/plugins/video.php?href=${encoded}&show_text=0&autoplay=${autoplay ? '1' : '0'}`;
}

/**
 * Detects media stream / video type for stations
 */
export function detectMediaType(url?: string): 'audio' | 'youtube' | 'facebook' | 'custom_stream' {
  if (!url || typeof url !== 'string') return 'custom_stream';
  const trimmed = url.trim().toLowerCase();

  if (isYouTubeUrl(trimmed)) return 'youtube';
  if (isFacebookUrl(trimmed)) return 'facebook';
  if (trimmed.endsWith('.mp3') || trimmed.endsWith('.aac') || trimmed.endsWith('.ogg') || trimmed.includes('audio') || trimmed.includes('radio')) return 'audio';

  return 'custom_stream';
}

/**
 * Universal Live Stream Parser for YouTube Live, HLS (m3u8), MP4, and iframes
 */
export function parseLiveStreamUrl(rawUrl?: string): LiveStreamFormat {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { originalUrl: '', embedUrl: '', directWatchUrl: '', type: 'custom' };
  }

  const trimmed = rawUrl.trim();

  // 1. Iframe Code detection
  if (trimmed.startsWith('<iframe') || trimmed.includes('<iframe')) {
    const match = trimmed.match(/src=["']([^"']+)["']/i);
    const src = match ? match[1] : trimmed;
    
    // Check if the iframe src is actually YouTube
    const ytId = extractYouTubeId(src);
    if (ytId) {
      return {
        originalUrl: trimmed,
        embedUrl: `https://www.youtube.com/embed/${ytId}?autoplay=1&playsinline=1&rel=0&modestbranding=1&enablejsapi=1`,
        directWatchUrl: `https://www.youtube.com/watch?v=${ytId}`,
        type: 'youtube',
        videoId: ytId
      };
    }

    return {
      originalUrl: trimmed,
      embedUrl: src,
      directWatchUrl: src,
      type: 'iframe'
    };
  }

  // 2. YouTube URLs (including live, watch, youtu.be, embed, shorts)
  const videoId = extractYouTubeId(trimmed);
  if (videoId) {
    return {
      originalUrl: trimmed,
      embedUrl: `https://www.youtube.com/embed/${videoId}?autoplay=1&playsinline=1&rel=0&modestbranding=1&enablejsapi=1`,
      directWatchUrl: `https://www.youtube.com/watch?v=${videoId}`,
      type: 'youtube',
      videoId
    };
  }

  // 3. Direct YouTube Live channel URL
  if (trimmed.includes('youtube.com/') && trimmed.includes('/live')) {
    return {
      originalUrl: trimmed,
      embedUrl: trimmed,
      directWatchUrl: trimmed,
      type: 'youtube'
    };
  }

  // 4. Facebook video URL
  if (isFacebookUrl(trimmed)) {
    return {
      originalUrl: trimmed,
      embedUrl: getFacebookEmbedUrl(trimmed, true),
      directWatchUrl: trimmed,
      type: 'iframe'
    };
  }

  // 5. HLS .m3u8 stream
  if (trimmed.endsWith('.m3u8') || trimmed.includes('.m3u8?')) {
    return {
      originalUrl: trimmed,
      embedUrl: trimmed,
      directWatchUrl: trimmed,
      type: 'hls'
    };
  }

  // 6. Direct MP4/WebM video streams
  if (trimmed.endsWith('.mp4') || trimmed.endsWith('.webm') || trimmed.includes('.mp4?') || trimmed.includes('.webm?')) {
    return {
      originalUrl: trimmed,
      embedUrl: trimmed,
      directWatchUrl: trimmed,
      type: 'video'
    };
  }

  // 7. Generic HTTPS embed / stream
  return {
    originalUrl: trimmed,
    embedUrl: trimmed,
    directWatchUrl: trimmed,
    type: 'custom'
  };
}
