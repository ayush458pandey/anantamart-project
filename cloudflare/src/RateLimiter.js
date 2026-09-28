// Durable Object for rate limiting
// Implements sliding window rate limiting

export class RateLimiter {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.storage = new Map(); // In-memory storage for demo
  }
  
  async check({ limit, window, key }) {
    const now = Date.now();
    const windowStart = now - window * 1000;
    
    // Get existing requests for this key
    const requests = this.storage.get(key) || [];
    
    // Remove old requests outside the window
    const validRequests = requests.filter(timestamp => timestamp > windowStart);
    this.storage.set(key, validRequests);
    
    const remaining = Math.max(0, limit - validRequests.length);
    const allowed = validRequests.length < limit;
    
    if (allowed) {
      // Add current request
      validRequests.push(now);
      this.storage.set(key, validRequests);
    }
    
    const reset = validRequests.length > 0 ? Math.min(...validRequests) + window * 1000 : now + window * 1000;
    
    return {
      allowed,
      remaining,
      reset
    };
  }
}