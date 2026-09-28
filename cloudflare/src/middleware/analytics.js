// Analytics middleware for Cloudflare Worker
// Tracks performance metrics and usage analytics

export async function createAnalyticsMiddleware(startTime) {
  return async function analyticsMiddleware(request, next) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const method = request.method;
    
    // Track request metrics
    const requestStart = Date.now();
    const response = await next();
    const requestDuration = Date.now() - requestStart;
    const totalDuration = Date.now() - startTime;
    
    // Log analytics data
    const analyticsData = {
      timestamp: new Date().toISOString(),
      method,
      pathname,
      status: response.status,
      duration: requestDuration,
      totalDuration,
      userAgent: request.headers.get('User-Agent'),
      ip: request.headers.get('CF-Connecting-IP'),
      cacheStatus: response.headers.get('X-Cache'),
      optimizationApplied: response.headers.get('X-Image-Optimization'),
      cdnProvider: 'Cloudflare',
      mediaProvider: 'Cloudinary'
    };
    
    // Send to analytics endpoint (could be logging service)
    await logAnalytics(analyticsData);
    
    // Add performance headers
    response.headers.set('X-Request-Duration', `${requestDuration}ms`);
    response.headers.set('X-Total-Duration', `${totalDuration}ms`);
    response.headers.set('X-Worker-Version', '1.0.0');
    
    return response;
  };
}

async function logAnalytics(data) {
  // In production, this would send to analytics service
  // For now, we'll just log to console
  console.log('Analytics:', JSON.stringify(data));
  
  // Could also write to KV for later analysis
  // await ANALYTICS_KV.put(`req_${Date.now()}`, JSON.stringify(data), {
  //   expirationTtl: 86400 // 24 hours
  // });
}