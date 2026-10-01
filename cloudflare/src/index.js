// Cloudflare Worker for Anantamart
// Frontend: Vercel
// Backend: Render
// Static assets: R2

import { config } from './config';
import { createCacheMiddleware } from './middleware/cache';
import { createSecurityMiddleware } from './middleware/security';
import { createOptimizationMiddleware } from './middleware/optimization';
import { createAnalyticsMiddleware } from './middleware/analytics';

export { RateLimiter } from './RateLimiter';

const FRONTEND_ORIGIN =
  'https://anantamart-project.vercel.app';

export default {
  async fetch(request, env, ctx) {
    const startTime = Date.now();

    const response = await createCacheMiddleware(env.EDGE_CACHE)(
      request,
      async (req) => {
        return await createSecurityMiddleware(env.RATE_LIMITER)(
          req,
          async (securedReq) => {
            return await createOptimizationMiddleware(env)(
              securedReq,
              async (optimizedReq) => {
                return await createAnalyticsMiddleware(startTime)(
                  optimizedReq,
                  async (finalReq) => {
                    const url = new URL(finalReq.url);

                    if (url.pathname.startsWith('/api/')) {
                      return handleAPIRequests(finalReq, env);
                    }

                    if (url.pathname.startsWith('/static/')) {
                      return handleStaticAssets(finalReq, env);
                    }

                    return handleFrontend(finalReq);
                  }
                );
              }
            );
          }
        );
      }
    );

    response.headers.set(
      'X-Worker-Time',
      `${Date.now() - startTime}ms`
    );
    response.headers.set('X-CDN', 'Cloudflare');

    return response;
  }
};

async function handleAPIRequests(request, env) {
  const incomingUrl = new URL(request.url);
  const apiBase = new URL(env.API_BASE_URL);

  const apiPath = incomingUrl.pathname.replace(/^\/api/, '') || '/';

  apiBase.pathname = `/api${apiPath}`;
  apiBase.search = incomingUrl.search;

  const headers = new Headers(request.headers);
  headers.set('Host', apiBase.host);

  const apiRequest = new Request(apiBase.toString(), {
    method: request.method,
    headers,
    body: ['GET', 'HEAD'].includes(request.method)
      ? undefined
      : request.body,
    redirect: 'follow'
  });

  const response = await fetch(apiRequest);

  const newHeaders = new Headers(response.headers);
  newHeaders.set(
    'Access-Control-Allow-Origin',
    env.FRONTEND_URL
  );
  newHeaders.set(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, PATCH, DELETE, OPTIONS'
  );
  newHeaders.set(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization'
  );
  
  // Prevent caching of API responses
  newHeaders.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  newHeaders.set('Pragma', 'no-cache');
  newHeaders.set('Expires', '0');
  newHeaders.set('Surrogate-Control', 'no-store');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders
  });
}

async function handleStaticAssets(request, env) {
  const url = new URL(request.url);

  const key = url.pathname.replace(/^\/static\//, '');

  if (!key) {
    return new Response('Not Found', { status: 404 });
  }

  const object = await env.STATIC_BUCKET.get(key);

  if (object) {
    const headers = new Headers();

    object.writeHttpMetadata(headers);

    headers.set(
      'Cache-Control',
      'public, max-age=31536000, immutable'
    );
    headers.set('X-Static-Asset', 'Cloudflare-R2');

    return new Response(object.body, {
      status: 200,
      headers
    });
  }

  return new Response('Not Found', {
    status: 404,
    headers: {
      'Content-Type': 'text/plain'
    }
  });
}

async function handleFrontend(request) {
  const incomingUrl = new URL(request.url);
  const frontendUrl = new URL(
    incomingUrl.pathname + incomingUrl.search,
    FRONTEND_ORIGIN
  );

  const frontendRequest = new Request(frontendUrl.toString(), {
    method: request.method,
    headers: request.headers,
    body: ['GET', 'HEAD'].includes(request.method)
      ? undefined
      : request.body,
    redirect: 'follow'
  });

  const response = await fetch(frontendRequest);

  const headers = new Headers(response.headers);
  headers.set('X-Frontend-Origin', 'Vercel');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}