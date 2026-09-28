// Cache middleware for Cloudflare Worker
// Handles edge caching with KV namespace

export async function createCacheMiddleware(kvNamespace) {
  return async function cacheMiddleware(request, next) {
    const url = new URL(request.url);
    const cacheKey = `${url.pathname}${url.search}`;
    
    // Check cache first
    const cachedResponse = await kvNamespace.get(cacheKey);
    if (cachedResponse) {
      const response = new Response(cachedResponse, {
        headers: {
          'X-Cache': 'HIT',
          'X-Cache-Key': cacheKey,
        }
      });
      return response;
    }
    
    // Execute request and cache response
    const response = await next();
    
    // Cache successful responses
    if (response.ok && response.status >= 200 && response.status < 300) {
      const responseData = await response.clone().arrayBuffer();
      await kvNamespace.put(cacheKey, responseData, {
        expirationTtl: 3600, // 1 hour cache
      });
      
      // Add cache headers
      response.headers.set('X-Cache', 'MISS');
      response.headers.set('X-Cache-Key', cacheKey);
    }
    
    return response;
  };
}