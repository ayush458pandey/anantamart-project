export const getOptimizedImageUrl = (url, { width = 400, quality = 'auto' } = {}) => {
  if (!url || typeof url !== 'string') return url;
  if (!url.includes('res.cloudinary.com') || !url.includes('/upload/')) return url;

  const transformation = `f_auto,q_${quality},c_limit,w_${width}`;
  if (url.includes('/upload/f_auto') || url.includes('/upload/q_auto') || url.includes('/upload/c_limit')) {
    return url.replace('/upload/', `/upload/${transformation}/`);
  }

  return url.replace('/upload/', `/upload/${transformation}/`);
};

export const getImageSrcSet = (url, widths = [240, 400, 640]) => {
  if (!url || typeof url !== 'string' || !url.includes('res.cloudinary.com')) return undefined;

  return widths
    .map(width => `${getOptimizedImageUrl(url, { width })} ${width}w`)
    .join(', ');
};
