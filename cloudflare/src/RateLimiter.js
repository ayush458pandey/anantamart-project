// Durable Object for rate limiting
// Implements sliding-window rate limiting using Durable Object storage

import { DurableObject } from 'cloudflare:workers';

export class RateLimiter extends DurableObject {
  async check({ limit, window, key }) {
    const now = Date.now();
    const windowStart = now - window * 1000;

    const storageKey = `ratelimit:${key}`;

    // Get existing request timestamps from Durable Object storage
    const stored = await this.ctx.storage.get(storageKey);
    const requests = Array.isArray(stored) ? stored : [];

    // Remove requests outside the current window
    const validRequests = requests.filter(
      (timestamp) => timestamp > windowStart
    );

    const remaining = Math.max(0, limit - validRequests.length);
    const allowed = validRequests.length < limit;

    if (allowed) {
      validRequests.push(now);

      await this.ctx.storage.put(
        storageKey,
        validRequests
      );
    }

    const reset =
      validRequests.length > 0
        ? Math.min(...validRequests) + window * 1000
        : now + window * 1000;

    return {
      allowed,
      remaining: Math.max(0, limit - validRequests.length),
      reset
    };
  }
}