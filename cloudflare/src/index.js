// Cloudflare Worker for Anantamart Hybrid Architecture
// Handles: CDN + Security + Edge + Cloudinary URL optimization

import { config } from './config';
import { createCacheMiddleware } from './middleware/cache';
import { createSecurityMiddleware } from './middleware/security';
import { createOptimizationMiddleware } from './middleware/optimization';
import { createAnalyticsMiddleware } from './middleware/analytics';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const startTime = Date.now();
    
    // Apply middleware stack
    const response = await createCacheMiddleware(env.EDGE_CACHE)(request, async (req) => {
      return await createSecurityMiddleware(env.RATE_LIMITER)(req, async (securedReq) => {
        return await createOptimizationMiddleware(env)(securedReq, async (optimizedReq) => {
          return await createAnalyticsMiddleware(startTime)(optimizedReq, async (finalReq) => {
            // Route to appropriate handlers
            if (finalReq.url.includes('/api/')) {
              return handleAPIRequests(finalReq, env);
            } else if (finalReq.url.includes('/static/')) {
              return handleStaticAssets(finalReq, env);
            } else {
              return handleHTMLPages(finalReq, env);
            }
          });
        });
      });
    });
    
    // Add performance headers
    response.headers.set('X-Worker-Time', `${Date.now() - startTime}ms`);
    response.headers.set('X-CDN', 'Cloudflare');
    response.headers.set('X-Media-Optimization', 'Cloudinary');
    
    return response;
  }
};

async function handleAPIRequests(request, env) {
  // API requests go through Cloudflare for security + caching
  const response = await fetch(request, {
    cf: {
      cacheTtl: config.cache.apiCacheTtl,
      cacheKey: request.url,
      cacheEverything: true,
    }
  });
  
  // Add security headers
  response.headers.set('Access-Control-Allow-Origin', config.security.corsOrigins[0]);
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  return response;
}

async function handleStaticAssets(request, env) {
  // Static assets with Cloudflare caching
  const response = await env.STATIC_BUCKET.get(request.url.replace(`${env.STATIC_BUCKET.bucket_name}/`, ''));
  
  if (response) {
    // Set cache headers for static assets
    const headers = new Headers(response.headers);
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    headers.set('X-Static-Asset', 'Cloudflare-R2');
    
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: headers
    });
  }
  
  // Fallback to origin
  return fetch(request, {
    cf: {
      cacheTtl: config.cache.staticCacheTtl,
      cacheEverything: true,
    }
  });
}

async function handleHTMLPages(request, env) {
  // HTML pages with Cloudinary URL optimization
  const response = await fetch(request, {
    cf: {
      cacheTtl: config.cache.htmlCacheTtl,
      cacheEverything: true,
    }
  });
  
  if (response.ok && response.headers.get('Content-Type')?.includes('text/html')) {
    let html = await response.text();
    
    // Optimize Cloudinary URLs in HTML
    const cloudinaryBaseUrl = config.cloudinary.baseUrl;
    const baseUrlForRegex = cloudinaryBaseUrl.replace(/\\/g, '\\\\/');
    const regexPattern = baseUrlForRegex + '/([^"\\\']+)';
    const simpleRegex = new RegExp(regexPattern, 'g');
    html = html.replace(
      simpleRegex,
      (match, imagePath) => {
        // Add optimization parameters if not present
        if (!imagePath.includes('f_auto') && !imagePath.includes('q_auto')) {
          return cloudinaryBaseUrl + '/f_auto,q_auto,w_auto/' + imagePath;
        }
        return match;
      }
    );
    
    return new Response(html, {
      status: response.status,
      statusText: response.statusText,
      headers: {
        ...Object.fromEntries(response.headers.entries()),
        'X-Media-Optimization': 'Cloudinary-Auto',
        'X-CDN-Cache': 'HIT'
      }
    });
  }
  
  return response;
}