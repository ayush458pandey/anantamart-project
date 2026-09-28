export function createCacheMiddleware() {
  return async function cacheMiddleware(request, next) {
    return next(request);
  };
}