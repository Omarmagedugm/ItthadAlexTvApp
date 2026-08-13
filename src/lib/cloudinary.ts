/**
 * Cloudinary image optimization utility
 */
export const getOptimizedImage = (url: string | undefined | null, width?: number) => {
  if (!url) return '';
  if (
    url.startsWith('data:') || 
    url.startsWith('blob:') || 
    url.endsWith('.svg') ||
    url.includes('wikimedia.org') ||
    url.includes('wikipedia.org') ||
    url.includes('ui-avatars.com') ||
    url.includes('lh3.googleusercontent.com')
  ) {
    return url;
  }

  const isLogo = url.toLowerCase().includes('logo') || url.toLowerCase().includes('favicon');

  if (!url.includes('cloudinary.com')) {
    // Use Cloudinary "fetch" for external non-Cloudinary images
    const transformations = ['f_auto', 'q_auto'];
    if (width && !isLogo) transformations.push(`w_${width}`, 'c_limit');
    return `https://res.cloudinary.com/dqj6gzwfg/image/fetch/${transformations.join(',')}/${encodeURIComponent(url)}`;
  }

  // Handle direct Cloudinary URLs (res.cloudinary.com/...)
  const parts = url.split('/upload/');
  if (parts.length !== 2) return url;

  // Clean existing transformations if present
  let cleanPath = parts[1];
  const pathSegments = cleanPath.split('/');
  if (pathSegments.length > 1 && (pathSegments[0].includes('q_auto') || pathSegments[0].includes('f_auto') || pathSegments[0].includes('w_'))) {
    cleanPath = pathSegments.slice(1).join('/');
  }

  const transformations = ['f_auto', 'q_auto'];
  if (width) {
    transformations.push(`w_${width}`, 'c_scale');
  }

  return `${parts[0]}/upload/${transformations.join(',')}/${cleanPath}`;
};

