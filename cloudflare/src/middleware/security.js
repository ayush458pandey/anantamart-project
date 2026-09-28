// Security middleware for Cloudflare Worker
// Handles rate limiting, DDoS protection, and security headers

export function createSecurityMiddleware(durableObjectNamespace) {
  return async function securityMiddleware(request, next) {
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const userAgent = request.headers.get('User-Agent') || '';
    const now = Date.now();
    
    // Rate limiting using Durable Object
    const rateLimitId = durableObjectNamespace.idFromName(ip);
    const rateLimitStub = durableObjectNamespace.get(rateLimitId);
    
    const { allowed, remaining, reset } = await rateLimitStub.check({
      limit: 100, // requests per minute
      window: 60,
      key: ip
    });
    
    if (!allowed) {
      return new Response(JSON.stringify({
        error: 'Rate limit exceeded',
        reset: new Date(reset).toISOString(),
        remaining
      }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': '100',
          'X-RateLimit-Remaining': remaining.toString(),
          'X-RateLimit-Reset': new Date(reset).toISOString(),
        }
      });
    }
    
    // Add security headers
    const response = await next(request);
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-XSS-Protection', '1; mode=block');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set(
  'Content-Security-Policy',
  "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' https://res.cloudinary.com data: blob:;"
);
    response.headers.set('X-RateLimit-Limit', '100');
    response.headers.set('X-RateLimit-Remaining', remaining.toString());
    response.headers.set('X-RateLimit-Reset', new Date(reset).toISOString());
    
    return response;
  };
}