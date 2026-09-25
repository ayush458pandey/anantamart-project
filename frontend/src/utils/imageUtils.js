export const getOptimizedImageUrl = (url, { width = 400, quality = 'auto' } = {}) => {
  if (!url || typeof url !== 'string') return url;
  if (!url.includes('res.cloudinary.com') || !url.includes('/upload/')) return url;

  const transformation = `f_auto,q_${quality === 'auto' ? 'auto:good' : quality},c_limit,w_${width}`;
  
  // Look for a version string like /v1234567/ and replace everything between /upload/ and /v.../
  const match = url.match(/(\/upload\/)(?:.*\/)?(v\d+\/.*)$/);
  if (match) {
    return url.replace(match[0], `${match[1]}${transformation}/${match[2]}`);
  }

  // Fallback: just append after /upload/ if no version string is found
  return url.replace('/upload/', `/upload/${transformation}/`);
};

export const getImageSrcSet = (url, widths = [240, 400, 640]) => {
  if (!url || typeof url !== 'string' || !url.includes('res.cloudinary.com')) return undefined;

  return widths
    .map(width => `${getOptimizedImageUrl(url, { width })} ${width}w`)
    .join(', ');
};
