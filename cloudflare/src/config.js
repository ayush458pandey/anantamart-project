// Configuration for Cloudflare Worker
// Contains environment variables and settings

export const config = {
  cloudinary: {
    baseUrl: 'https://res.cloudinary.com/dge0dtvzc/image/upload',
    cloudName: 'dge0dtvzc',
    apiKey: 'YOUR_CLOUDINARY_API_KEY',
    apiSecret: 'YOUR_CLOUDINARY_API_SECRET',
  },
  
  app: {
    name: 'Anantamart',
    version: '1.0.0',
    domain: 'https://ananta-mart.in',
    apiDomain: 'https://api.ananta-mart.in',
  },
  
  cache: {
    edgeCacheTtl: 3600, // 1 hour
    apiCacheTtl: 300, // 5 minutes
    staticCacheTtl: 86400, // 24 hours
    htmlCacheTtl: 3600, // 1 hour
  },
  
  rateLimit: {
    window: 60, // 1 minute
    limit: 100, // requests per window
  },
  
  security: {
    ddosProtection: true,
    corsOrigins: ['https://ananta-mart.in'],
    csp: {
      'default-src': "'self'",
      'script-src': "'self' 'unsafe-inline'",
      'style-src': "'self' 'unsafe-inline'",
      'img-src': "'self' https://res.cloudinary.com https://*.cloudinary.com",
      'connect-src': "'self' https://api.ananta-mart.in",
    }
  }
};

export const { cloudinary, app, cache, rateLimit, security } = config;