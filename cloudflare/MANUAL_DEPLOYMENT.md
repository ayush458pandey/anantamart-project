# Manual Cloudflare Worker Deployment Guide

## Environment Setup

**Note:** This environment has Node.js (v24.21.0) but npm is blocked due to security restrictions. Here are alternative deployment methods.

## Option 1: Cloudflare Workers Dashboard (Recommended)

### Step 1: Access Cloudflare Workers
1. Go to https://dash.cloudflare.com
2. Sign in with your Cloudflare account
3. Select your account
4. Click "Workers" in the left sidebar

### Step 2: Create New Worker
1. Click "Create a new worker"
2. **Name**: `anantamart-hybrid`
3. **Script**: Copy the contents of `src/index.js` into the editor
4. Click "Create and deploy"

### Step 3: Configure Bindings
After creating the worker, configure the required bindings:

#### KV Namespace (for edge caching)
1. In your worker dashboard, click "Manage" or "Edit"
2. Go to "Settings" → "Bindings"
3. Click "Add binding" → "KV Namespace"
4. **Name**: `EDGE_CACHE`
5. **KV Namespace**: Select or create "EDGE_CACHE"
6. Save changes

#### R2 Bucket (for static assets)
1. Go to "Settings" → "Bindings"
2. Click "Add binding" → "R2 Bucket"
3. **Name**: `STATIC_BUCKET`
4. **Bucket**: Select or create "anantamart-static"
5. Save changes

#### Durable Object (for rate limiting)
1. Go to "Settings" → "Bindings"
2. Click "Add binding" → "Durable Object Namespace"
3. **Name**: `RATE_LIMITER`
4. **Class Name**: `RateLimiter`
5. Save changes

### Step 4: Set Environment Variables
1. Go to "Settings" → "Environment Variables"
2. Add the following variables:

| Variable | Value |
|----------|-------|
| `ENVIRONMENT` | `production` |
| `CLOUDINARY_CLOUD_NAME` | `dge0dtvzc` |
| `CLOUDINARY_BASE_URL` | `https://res.cloudinary.com/dge0dtvzc/image/upload` |
| `API_BASE_URL` | `https://api.ananta-mart.in/api` |
| `FRONTEND_URL` | `https://ananta-mart.in` |

### Step 5: Deploy
1. Click "Deploy" in the top-right corner
2. Wait for deployment to complete
3. Your worker is now live at: `https://anantamart-hybrid.your-subdomain.workers.dev`

## Option 2: Cloudflare Pages Deployment

### Step 1: Access Cloudflare Pages
1. Go to https://dash.cloudflare.com
2. Select your account
3. Click "Pages" in the left sidebar
4. Click "Create a Pages project"

### Step 2: Configure Pages
1. **Project name**: `anantamart-pages`
2. **Framework**: "Vite" (if using Vite) or "Next.js"
3. **Build command**: `npm run build`
4. **Build output directory**: `dist` or `.next`
5. Click "Create project"

### Step 3: Deploy Worker as Pages Function
1. In your Pages project, go to "Functions"
2. Click "Add a new function"
3. **Name**: `worker`
4. **Script**: Copy `src/index.js` content
5. Configure bindings as described in Option 1
6. Deploy

## Option 3: Local Development & Testing

### Step 1: Install Wrangler Locally
Since npm is blocked, download wrangler manually:

```bash
# Download wrangler from: https://github.com/cloudflare/wrangler2/releases
# Extract and add to your PATH
# Or use npm in a different environment
```

### Step 2: Local Testing
```bash
# If you can install wrangler locally
cd cloudflare
wrangler dev
```

### Step 3: Test Locally
```bash
# Test your worker locally
wrangler dev --port 8080
```

## Option 4: Using Cloudflare CLI (Alternative)

### Step 1: Install Cloudflare CLI
```bash
# Download from: https://github.com/cloudflare/cloudflare-cli/releases
# Or use: brew install cloudflare/cloudflare-cli/cloudflared
```

### Step 2: Login
```bash
cloudflared tunnel login
```

### Step 3: Create Tunnel
```bash
cloudflared tunnel create anantamart-hybrid
```

### Step 4: Deploy
```bash
cd cloudflare
cloudflared tunnel route add anantamart-hybrid "*.workers.dev"
cloudflared tunnel run anantamart-hybrid
```

## Option 5: Manual File Upload

### Step 1: Prepare Files
1. Ensure all files in `cloudflare/` are ready:
   - `src/index.js`
   - `src/config.js`
   - `src/RateLimiter.js`
   - `src/middleware/*.js`
   - `wrangler.toml`
   - `package.json`

### Step 2: Upload to Cloudflare
1. Go to Cloudflare Workers dashboard
2. Select your existing worker or create new
3. Use "Upload from GitHub" or "Upload from local"
4. Configure bindings as described in Option 1

## Environment Variables Setup

### Using Cloudflare Dashboard
1. Go to "Workers" → "Your Worker" → "Settings"
2. Click "Environment Variables"
3. Add each variable:

```
ENVIRONMENT = production
CLOUDINARY_CLOUD_NAME = dge0dtvzc
CLOUDINARY_BASE_URL = https://res.cloudinary.com/dge0dtvzc/image/upload
API_BASE_URL = https://api.ananta-mart.in/api
FRONTEND_URL = https://ananta-mart.in
```

### Using wrangler (if available)
```bash
wrangler secret put ENVIRONMENT
wrangler secret put CLOUDINARY_CLOUD_NAME
wrangler secret put CLOUDINARY_BASE_URL
wrangler secret put API_BASE_URL
wrangler secret put FRONTEND_URL
```

## Testing Your Deployment

### Step 1: Test Worker
```bash
# Using curl (available in this environment)
curl -X GET https://your-worker-url.workers.dev/

# Test API endpoint
curl -X GET https://your-worker-url.workers.dev/api/products

# Test static asset
curl -X GET https://your-worker-url.workers.dev/static/image.jpg
```

### Step 2: Check Logs
1. Go to Cloudflare Workers dashboard
2. Select your worker
3. Click "Logs" to view worker execution logs
4. Monitor for errors and performance metrics

## Troubleshooting

### Common Issues

1. **Bindings Not Found**
   - Ensure bindings are configured correctly
   - Check that KV, R2, and Durable Objects exist

2. **Environment Variables Missing**
   - Add all required environment variables
   - Verify variable names match exactly

3. **Worker Not Responding**
   - Check worker logs for errors
   - Verify all middleware is loaded correctly
   - Test with simple requests first

4. **Rate Limiting Issues**
   - Check Durable Object configuration
   - Verify rate limit settings

### Debugging Steps

1. **Simple Test**
   ```bash
   curl -X GET https://your-worker-url.workers.dev/
   ```

2. **Check Worker Status**
   - Go to Cloudflare Workers dashboard
   - Verify worker is deployed and active

3. **Review Logs**
   - Check worker execution logs
   - Look for error messages

4. **Test Individual Features**
   - Test image optimization
   - Test caching
   - Test security headers

## Post-Deployment Checklist

### ✅ Pre-Deployment
- [ ] All files are ready
- [ ] wrangler.toml is configured
- [ ] Environment variables are set
- [ ] Cloudflare resources exist (KV, R2, Durable Object)

### ✅ During Deployment
- [ ] Worker deploys successfully
- [ ] All bindings are configured
- [ ] Environment variables are loaded
- [ ] No deployment errors

### ✅ Post-Deployment
- [ ] Worker is accessible
- [ ] API endpoints work
- [ ] Image optimization functions
- [ ] Caching is active
- [ ] Security headers are present
- [ ] Rate limiting is working
- [ ] Analytics are tracking
- [ ] Performance is acceptable

## Monitoring & Maintenance

### Step 1: Set Up Monitoring
1. Enable Cloudflare Analytics
2. Set up performance monitoring
3. Configure error alerts
4. Monitor cache hit/miss ratios

### Step 2: Regular Maintenance
1. Check worker logs weekly
2. Monitor performance metrics
3. Update environment variables as needed
4. Test deployments regularly

### Step 3: Troubleshooting
1. Use Cloudflare Logs for debugging
2. Check worker metrics
3. Monitor error rates
4. Test new features before deployment

## Support & Resources

### Cloudflare Documentation
- Workers: https://developers.cloudflare.com/workers
- Pages: https://developers.cloudflare.com/pages
- Wrangler: https://github.com/cloudflare/wrangler2

### Community Support
- Cloudflare Community Discord
- Stack Overflow with Cloudflare tags
- Cloudflare Forums

## Next Steps

After successful deployment:
1. **Test thoroughly** - Verify all functionality
2. **Monitor performance** - Check analytics and metrics
3. **Optimize** - Adjust cache TTLs and rate limits
4. **Scale** - Monitor usage and upgrade resources if needed

## Security Considerations

1. **Environment Variables**
   - Store sensitive data securely
   - Use Cloudflare's secret management
   - Rotate credentials regularly

2. **Access Control**
   - Restrict worker access to trusted origins
   - Use proper CORS configuration
   - Implement authentication where needed

3. **Monitoring**
   - Set up alerts for unusual activity
   - Monitor rate limiting effectiveness
   - Track performance metrics

## Alternative: Using Cloudflare Workers Builder

If you prefer a no-code approach:

1. Go to: https://workers.cloudflare.com/builder
2. Create a new worker
3. Upload your `src/index.js` file
4. Configure bindings visually
5. Deploy

This approach is simpler but offers less control over the configuration.

## Final Notes

- The worker is **production-ready** with all features implemented
- Choose the deployment method that works best in your environment
- Test thoroughly before going to production
- Monitor performance after deployment
- Have a rollback plan in case of issues

The hybrid architecture provides excellent performance and cost optimization for Anantamart's image delivery needs.