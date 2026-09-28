# Cloudflare Worker for Anantamart Hybrid Architecture

## Overview

This Cloudflare Worker implements a hybrid architecture combining Cloudflare's CDN, security, and edge computing with Cloudinary's media intelligence for optimal image delivery and performance.

## Architecture

### Components

1. **Cloudflare Worker** (`src/index.js`)
   - Main request handler with middleware stack
   - Edge caching with KV namespace
   - Security middleware with rate limiting
   - Cloudinary URL optimization
   - Analytics and monitoring

2. **Middleware Stack**
   - `middleware/cache.js` - Edge caching using KV
   - `middleware/security.js` - Rate limiting and security headers
   - `middleware/optimization.js` - Cloudinary URL optimization
   - `middleware/analytics.js` - Performance analytics

3. **Supporting Files**
   - `src/config.js` - Configuration and environment variables
   - `src/RateLimiter.js` - Durable Object for rate limiting
   - `wrangler.toml` - Cloudflare Worker configuration
   - `package.json` - Dependencies and scripts

## Features

### Image Optimization
- Automatic Cloudinary URL optimization
- Format selection (f_auto)
- Quality optimization (q_auto)
- Smart cropping (g_auto)
- Background removal support
- Responsive sizing (w_auto)

### Security
- Rate limiting (100 requests/minute per IP)
- DDoS protection
- Security headers (CSP, X-Frame-Options, etc.)
- CORS configuration
- Input validation

### Performance
- Edge caching with 1-hour TTL
- Static asset caching (24 hours)
- API caching (5 minutes)
- HTML caching (1 hour)
- Automatic cache warming

### Analytics
- Request tracking
- Performance metrics
- Cache hit/miss tracking
- Optimization application tracking

## Configuration

### Environment Variables
Set these in Cloudflare dashboard:

```toml
[vars]
ENVIRONMENT = "production"
CLOUDINARY_CLOUD_NAME = "dge0dtvzc"
CLOUDINARY_BASE_URL = "https://res.cloudinary.com/dge0dtvzc/image/upload"
API_BASE_URL = "https://api.ananta-mart.in/api"
FRONTEND_URL = "https://ananta-mart.in"
```

### Required Cloudflare Resources

1. **KV Namespace** (for edge caching):
   ```bash
   wrangler kv:namespace create "EDGE_CACHE"
   ```

2. **R2 Bucket** (for static assets):
   ```bash
   wrangler r2 bucket create anantamart-static
   ```

3. **Durable Object** (for rate limiting):
   - Automatically configured in wrangler.toml

## Deployment

### Local Development
```bash
cd cloudflare
npm run dev
```

### Production Deployment
```bash
npm run deploy:prod
```

### Cloudflare Pages Integration
The worker can be deployed as a Cloudflare Pages function:

```bash
wrangler pages deploy
```

## Usage

### Image Optimization
Cloudinary URLs in HTML will be automatically optimized:

**Before:**
```html
<img src="https://res.cloudinary.com/dge0dtvzc/image/upload/products/summer-dress.jpg">
```

**After:**
```html
<img src="https://res.cloudinary.com/dge0dtvzc/image/upload/f_auto,q_auto,w_auto,g_auto/products/summer-dress.jpg">
```

### API Requests
API requests are cached and secured:
- 5-minute cache TTL
- Security headers applied
- Rate limiting enforced

### Static Assets
Static assets are cached for 24 hours:
- Cloudflare R2 storage
- Immutable cache headers
- Edge caching

## Performance Benefits

1. **Image Optimization**
   - Automatic format selection (WebP, AVIF, JPEG, PNG)
   - Quality optimization based on device
   - Smart cropping for better visuals
   - Background removal for product images

2. **Security**
   - DDoS protection
   - Rate limiting
   - Security headers
   - Input validation

3. **Speed**
   - Edge caching reduces origin load
   - Cloudflare global network
   - Automatic cache warming
   - Optimized image delivery

## Cost Optimization

The hybrid architecture provides significant cost savings:

- **Cloudflare Images**: ~$11/month for 1TB
- **Cloudinary**: ~$350/month for same volume
- **Savings**: ~97% on image hosting costs

## Monitoring

Analytics are tracked for:
- Request performance
- Cache efficiency
- Optimization application
- Security events

## Troubleshooting

### Common Issues

1. **Images not optimizing**
   - Check Cloudinary configuration
   - Verify URL patterns
   - Ensure optimization middleware is loaded

2. **Rate limiting**
   - Check rate limit configuration
   - Verify Durable Object deployment
   - Monitor analytics for rate limit events

3. **Cache misses**
   - Verify KV namespace configuration
   - Check cache TTL settings
   - Monitor cache analytics

### Debugging
```bash
# Enable debug logging
wrangler dev --log-level debug

# Check worker logs
wrangler tail
```

## Future Enhancements

1. **Video Optimization**
   - Cloudinary video transcoding
   - Adaptive streaming
   - Video caching

2. **Advanced Caching**
   - Cache invalidation strategies
   - Geographic caching
   - Edge compute functions

3. **Enhanced Security**
   - Web Application Firewall (WAF)
   - Bot protection
   - Advanced rate limiting

## License

MIT