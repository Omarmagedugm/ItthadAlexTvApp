export interface LiveStreamFormat {
  originalUrl: string;
  embedUrl: string;
  directWatchUrl: string;
  type: 'youtube' | 'hls' | 'video' | 'iframe' | 'custom' | 'audio';
  videoId?: string;
  rawIframe?: string;
}

/**
 * Extracts src URL if the string is an HTML <iframe> tag or embed code
 */
export function extractEmbedSrc(input?: string): string {
  if (!input || typeof input !== 'string') return '';
  const trimmed = input.trim();
  if (trimmed.includes('<iframe') || trimmed.includes('<video')) {
    const match = trimmed.match(/src=["']([^"']+)["']/i);
    if (match && match[1]) {
      return match[1].replace(/&amp;/g, '&');
    }
  }
  return trimmed;
}

/**
 * Checks if input is an HTML embed code (contains <iframe>, <embed>, etc.)
 */
export function isEmbedCode(input?: string): boolean {
  if (!input || typeof input !== 'string') return false;
  const trimmed = input.trim().toLowerCase();
  return trimmed.includes('<iframe') || trimmed.includes('<embed') || trimmed.includes('<video') || trimmed.includes('<object');
}

/**
 * Extracts YouTube Video ID from any YouTube URL or Embed format:
 * - youtube.com/watch?v=ID
 * - youtu.be/ID
 * - youtube.com/live/ID
 * - youtube.com/embed/ID
 * - youtube.com/shorts/ID
 * - Raw 11 character ID
 * - <iframe src="https://www.youtube.com/embed/ID"...></iframe>
 */
export function extractYouTubeId(url?: string): string | null {
  if (!url || typeof url !== 'string') return null;
  let trimmed = extractEmbedSrc(url).trim();

  // If it's already an 11-char ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  // Match all YouTube patterns
  const match = trimmed.match(/(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?|live|shorts)\/|.*[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);
  return match && match[1] ? match[1] : null;
}

/**
 * Checks if a URL / Embed code is YouTube
 */
export function isYouTubeUrl(url?: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const cleaned = extractEmbedSrc(url).trim();
  return /^(https?:\/\/)?(www\.|m\.)?(youtube\.com|youtu\.be)\/.+/i.test(cleaned) || /^[a-zA-Z0-9_-]{11}$/.test(cleaned);
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
  return extractEmbedSrc(url);
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
 * Checks if a URL / Embed code is a Facebook video
 */
export function isFacebookUrl(url?: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const cleaned = extractEmbedSrc(url).trim();
  return /^(https?:\/\/)?(www\.|web\.|m\.)?(facebook\.com|fb\.watch)\/.+/i.test(cleaned);
}

/**
 * Gets Facebook video embed URL
 */
export function getFacebookEmbedUrl(url?: string, autoplay = true): string {
  if (!url) return '';
  const cleaned = extractEmbedSrc(url).trim();

  // If already a facebook plugin iframe src
  if (cleaned.includes('facebook.com/plugins/video.php')) {
    return cleaned;
  }

  const encoded = encodeURIComponent(cleaned);
  return `https://www.facebook.com/plugins/video.php?href=${encoded}&show_text=0&autoplay=${autoplay ? '1' : '0'}`;
}

/**
 * Detects media stream / video type for stations
 */
export function detectMediaType(url?: string): 'audio' | 'youtube' | 'facebook' | 'custom_stream' {
  if (!url || typeof url !== 'string') return 'custom_stream';
  const trimmed = extractEmbedSrc(url).trim().toLowerCase();

  if (isYouTubeUrl(trimmed)) return 'youtube';
  if (isFacebookUrl(trimmed)) return 'facebook';
  if (trimmed.endsWith('.mp3') || trimmed.endsWith('.aac') || trimmed.endsWith('.ogg') || trimmed.includes('audio') || trimmed.includes('radio')) return 'audio';

  return 'custom_stream';
}

/**
 * Checks if a URL is an HLS (.m3u8) live stream
 */
export function isHlsUrl(url?: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const lower = extractEmbedSrc(url).trim().toLowerCase();
  return lower.includes('.m3u8') || 
         lower.includes('/hls/') || 
         lower.includes('playlist-hls') ||
         lower.includes('manifest.m3u8') ||
         lower.includes('.m3u8?') ||
         lower.endsWith('.m3u8');
}

/**
 * Universal Live Stream Parser for YouTube Live, HLS (m3u8), MP4, and iframes
 */
export function parseLiveStreamUrl(rawUrl?: string): LiveStreamFormat {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { originalUrl: '', embedUrl: '', directWatchUrl: '', type: 'custom' };
  }

  const trimmed = rawUrl.trim();

  // 1. Iframe Code detection - preserve raw iframe HTML exactly
  if (trimmed.startsWith('<iframe') || trimmed.includes('<iframe')) {
    const src = extractEmbedSrc(trimmed);
    
    // Check if the iframe src is actually YouTube
    const ytId = extractYouTubeId(src);
    if (ytId) {
      return {
        originalUrl: trimmed,
        embedUrl: `https://www.youtube.com/embed/${ytId}?autoplay=1&playsinline=1&rel=0&modestbranding=1&enablejsapi=1`,
        directWatchUrl: `https://www.youtube.com/watch?v=${ytId}`,
        type: 'iframe',
        videoId: ytId,
        rawIframe: trimmed
      };
    }

    if (isFacebookUrl(src)) {
      return {
        originalUrl: trimmed,
        embedUrl: getFacebookEmbedUrl(src, true),
        directWatchUrl: src,
        type: 'iframe',
        rawIframe: trimmed
      };
    }

    return {
      originalUrl: trimmed,
      embedUrl: src,
      directWatchUrl: src,
      type: 'iframe',
      rawIframe: trimmed
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

  // 5. HLS .m3u8 stream (Brightcove, Akamai, Cloudflare, Fastly, Custom CDN)
  if (isHlsUrl(trimmed)) {
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
