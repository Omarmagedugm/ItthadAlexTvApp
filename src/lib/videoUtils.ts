/**
 * Utility functions for YouTube, Facebook, and Audio Stream embeds and parsing
 */

export function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  
  // youtu.be/<id>
  const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (shortMatch) return shortMatch[1];

  // youtube.com/watch?v=<id>
  const watchMatch = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (watchMatch) return watchMatch[1];

  // youtube.com/live/<id>
  const liveMatch = url.match(/youtube\.com\/live\/([a-zA-Z0-9_-]{11})/);
  if (liveMatch) return liveMatch[1];

  // youtube.com/embed/<id>
  const embedMatch = url.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/);
  if (embedMatch) return embedMatch[1];

  // youtube.com/shorts/<id>
  const shortsMatch = url.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/);
  if (shortsMatch) return shortsMatch[1];

  return null;
}

export function getYouTubeEmbedUrl(url: string, autoplay = true): string {
  const id = extractYouTubeId(url);
  if (id) {
    return `https://www.youtube.com/embed/${id}?autoplay=${autoplay ? 1 : 0}&enablejsapi=1&rel=0&modestbranding=1`;
  }
  return url;
}

export function getYouTubeThumbnail(url: string, quality: 'mqdefault' | 'hqdefault' | 'maxresdefault' = 'hqdefault'): string | null {
  const id = extractYouTubeId(url);
  if (id) {
    return `https://img.youtube.com/vi/${id}/${quality}.jpg`;
  }
  return null;
}

export function isYouTubeUrl(url: string): boolean {
  if (!url) return false;
  return url.includes('youtube.com') || url.includes('youtu.be');
}

export function isFacebookUrl(url: string): boolean {
  if (!url) return false;
  return url.includes('facebook.com') || url.includes('fb.watch') || url.includes('fb.com');
}

export function getFacebookEmbedUrl(url: string, autoplay = true): string {
  if (!url) return '';
  if (url.includes('facebook.com/plugins/video.php')) {
    return url;
  }
  return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=0&autoplay=${autoplay ? 1 : 0}&width=500`;
}

export function detectMediaType(url: string): 'youtube' | 'facebook' | 'audio' | 'custom_stream' {
  if (!url) return 'audio';
  if (isYouTubeUrl(url)) return 'youtube';
  if (isFacebookUrl(url)) return 'facebook';
  if (url.endsWith('.mp3') || url.endsWith('.ogg') || url.endsWith('.wav') || url.endsWith('.aac') || url.includes('icecast') || url.includes('shoutcast')) {
    return 'audio';
  }
  return 'custom_stream';
}
