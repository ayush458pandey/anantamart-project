// Optimization middleware for Cloudflare Worker
// Handles Cloudinary URL optimization and image transformations

export async function createOptimizationMiddleware(env) {
  return async function optimizationMiddleware(request, next) {
    const url = new URL(request.url);
    const response = await next();
    
    // Optimize images via Cloudinary
    if (isImageRequest(url.pathname)) {
      const optimizedUrl = await optimizeImageUrl(url, env);
      if (optimizedUrl !== url.href) {
        // Redirect to optimized URL
        return Response.redirect(optimizedUrl, 301);
      }
    }
    
    // Optimize HTML content with Cloudinary URLs
    if (response.headers.get('Content-Type')?.includes('text/html')) {
      let html = await response.text();
      
      // Find and optimize Cloudinary image URLs
      html = html.replace(
        new RegExp(env.CLOUDINARY_BASE_URL.replace(/\/g, '\\/') + '/([^"\']+)', 'g'),
        (match, imagePath) => {
          return optimizeCloudinaryUrl(imagePath, env);
        }
      );
      
      return new Response(html, {
        status: response.status,
        statusText: response.statusText,
        headers: {
          ...Object.fromEntries(response.headers.entries()),
          'X-Media-Optimization': 'Cloudinary-Auto',
          'X-Image-Optimization': 'Applied'
        }
      });
    }
    
    return response;
  };
}

function isImageRequest(pathname) {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.avif'];
  return imageExtensions.some(ext => pathname.toLowerCase().endsWith(ext));
}

async function optimizeImageUrl(url, env) {
  const pathname = url.pathname;
  const searchParams = url.searchParams;
  
  // Check if already optimized
  if (searchParams.has('f_auto') || searchParams.has('q_auto') || searchParams.has('w_auto')) {
    return url.href;
  }
  
  // Build optimized Cloudinary URL
  const publicId = pathname.replace(/^\/cloudinary\//, '');
  if (!publicId) return url.href;
  
  const optimizationParams = new URLSearchParams();
  optimizationParams.set('f_auto', '');
  optimizationParams.set('q_auto', '');
  optimizationParams.set('w_auto', '');
  optimizationParams.set('dpr_auto', '');
  
  // Add smart cropping if not specified
  if (!searchParams.has('g')) {
    optimizationParams.set('g', 'auto');
  }
  
  // Add background removal if needed
  if (searchParams.has('bg_removal') && searchParams.get('bg_removal') === 'true') {
    optimizationParams.set('bg_removal', 'true');
  }
  
  return `${env.CLOUDINARY_BASE_URL}/${optimizationParams.toString()}/${publicId}`;
}

function optimizeCloudinaryUrl(imagePath, env) {
  // Add optimization parameters to Cloudinary URLs in HTML
  if (imagePath.includes(env.CLOUDINARY_BASE_URL)) {
    const publicId = imagePath.replace(`${env.CLOUDINARY_BASE_URL}/`, '');
    
    if (!publicId) return imagePath;
    
    // Check if already optimized
    if (publicId.includes('f_auto') || publicId.includes('q_auto') || publicId.includes('w_auto')) {
      return imagePath;
    }
    
    return `${env.CLOUDINARY_BASE_URL}/f_auto,q_auto,w_auto,dpr_auto,g_auto/${publicId}`;
  }
  
  return imagePath;
}