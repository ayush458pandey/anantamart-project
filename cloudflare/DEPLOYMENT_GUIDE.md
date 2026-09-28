# Cloudflare Worker Deployment Guide

## Prerequisites

1. **Cloudflare Account**
   - Sign up at https://dash.cloudflare.com
   - Ensure you have access to Workers and Pages

2. **Cloudflare CLI (Wrangler)**
   ```bash
   # Install wrangler globally
   npm install -g wrangler
   
   # Or install locally
   npm init -y
   npm install wrangler
   ```

3. **Cloudflare API Token**
   - Create a token with Workers and R2 permissions
   - Store in environment variables

## Step 1: Configure Environment Variables

Set these in your Cloudflare dashboard or environment:

```bash
# wrangler.toml variables
[vars]
ENVIRONMENT = "production"
CLOUDINARY_CLOUD_NAME = "dge0dtvzc"
CLOUDINARY_BASE_URL = "https://res.cloudinary.com/dge0dtvzc/image/upload"
API_BASE_URL = "https://api.ananta-mart.in/api"
FRONTEND_URL = "https://ananta-mart.in"
```

## Step 2: Create Required Cloudflare Resources

### KV Namespace (for edge caching)
```bash
wrangler kv:namespace create "EDGE_CACHE"
```

### R2 Bucket (for static assets)
```bash
wrangler r2 bucket create anantamart-static
```

### Durable Object (for rate limiting)
```bash
wrangler durable-objects create RateLimiter
```

## Step 3: Update wrangler.toml

Replace placeholder IDs with actual resource IDs:

```toml
[[kv_namespaces]]
binding = "EDGE_CACHE"
id = "your-actual-kv-namespace-id"

[[r2_buckets]]
binding = "STATIC_BUCKET"
bucket_name = "anantamart-static"

[[durable_objects.bindings]]
name = "RATE_LIMITER"
class_name = "RateLimiter"
```

## Step 4: Deploy the Worker

### Local Development
```bash
cd cloudflare
wrangler dev
```

### Production Deployment
```bash
cd cloudflare
wrangler deploy
```

### Production with Environment
```bash
cd cloudflare
wrangler deploy --env production
```

## Step 5: Configure Cloudflare Pages (Optional)

If you want to deploy as a Pages function:

```bash
cd cloudflare
wrangler pages deploy
```

## Step 6: Verify Deployment

### Test the Worker
```bash
# Test API endpoint
curl -X GET https://your-worker.your-domain.com/api/products

# Test static asset
curl -X GET https://your-worker.your-domain.com/static/image.jpg

# Test HTML optimization
curl -X GET https://your-worker.your-domain.com/
```

### Check Logs
```bash
wrangler tail
```

## Step 7: Monitor and Optimize

### Analytics
- Enable Cloudflare Analytics
- Monitor performance metrics
- Check cache hit/miss ratios

### Performance
- Test image optimization
- Verify security headers
- Monitor rate limiting

## Troubleshooting

### Common Issues

1. **KV Namespace Not Found**
   ```bash
   wrangler kv:namespace list
   ```

2. **R2 Bucket Not Found**
   ```bash
   wrangler r2 bucket list
   ```

3. **Durable Object Issues**
   ```bash
   wrangler durable-objects list
   ```

4. **Environment Variables**
   ```bash
   wrangler env list
   ```

### Deployment Errors

1. **Permission Denied**
   - Ensure your API token has correct permissions
   - Check account membership

2. **Resource Already Exists**
   - Use existing resource IDs
   - Update configuration instead of creating new

## Post-Deployment Checklist

- [ ] Worker deployed successfully
- [ ] Environment variables configured
- [ ] KV namespace created
- [ ] R2 bucket created
- [ ] Durable object configured
- [ ] Security headers working
- [ ] Rate limiting active
- [ ] Image optimization functional
- [ ] Analytics enabled
- [ ] Performance monitoring set up

## Alternative: Manual Deployment

If you prefer not to use Wrangler:

1. **Upload to Cloudflare Workers**
   - Go to Cloudflare Workers dashboard
   - Create new worker
   - Upload src/index.js as the worker code
   - Configure bindings manually

2. **Set Environment Variables**
   - Add all variables from wrangler.toml
   - Configure KV, R2, and Durable Object bindings

3. **Deploy**
   - Use "Deploy from GitHub" or upload files
   - Test the deployment

## Support

For issues with this deployment guide:
1. Check Cloudflare Workers documentation
2. Review Wrangler CLI documentation
3. Contact Cloudflare support if needed

## Next Steps

After deployment:
1. **Test thoroughly** - Verify all functionality
2. **Monitor performance** - Check analytics and metrics
3. **Optimize** - Adjust cache TTLs and rate limits
4. **Scale** - Monitor usage and upgrade resources if needed

## Security Considerations

1. **API Keys**
   - Store Cloudinary credentials securely
   - Use Cloudflare environment variables

2. **Rate Limiting**
   - Monitor for abuse
   - Adjust limits as needed

3. **CORS Configuration**
   - Restrict origins appropriately
   - Use environment-specific settings

4. **Content Security Policy**
   - Review and adjust CSP headers
   - Ensure proper image source restrictions