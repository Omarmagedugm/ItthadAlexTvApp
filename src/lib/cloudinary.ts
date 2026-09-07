/**
 * Cloudinary image optimization utility
 */
export const getOptimizedImage = (url: string | undefined | null, width?: number) => {
  if (!url) return '';
  if (
    url.startsWith('/') ||
    url.startsWith('data:') || 
    url.startsWith('blob:') || 
    url.endsWith('.svg') ||
    url.includes('firebasestorage.googleapis.com') ||
    url.includes('storage.googleapis.com') ||
    url.includes('wikimedia.org') ||
    url.includes('wikipedia.org') ||
    url.includes('ui-avatars.com') ||
    url.includes('lh3.googleusercontent.com')
  ) {
    return url;
  }

  const isLogo = url.toLowerCase().includes('logo') || url.toLowerCase().includes('favicon');

  if (!url.includes('cloudinary.com')) {
    // For external non-Cloudinary images, keep original URL if Cloudinary fetch is not desired,
    // or return directly if not a valid http url
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return url;
    }
    // Return original url if fetch fails or if it's already an external source
    return url;
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

