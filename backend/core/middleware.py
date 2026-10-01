"""
Middleware to prevent caching of API responses.
Ensures admin changes are immediately visible on the frontend.
"""

class NoCacheAPIMiddleware:
    """
    Adds no-cache headers to all API responses.
    This prevents Cloudflare, browser, and intermediate proxies from caching API data.
    """
    
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        
        # Only apply to API endpoints
        if request.path.startswith('/api/'):
            # Prevent all forms of caching
            response['Cache-Control'] = 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0'
            response['Pragma'] = 'no-cache'
            response['Expires'] = '0'
            response['Surrogate-Control'] = 'no-store'
            
            # Ensure Vary header for proper cache behavior
            vary = response.get('Vary', '')
            if 'Cookie' not in vary:
                response['Vary'] = (vary + ', Cookie').lstrip(', ')
        
        return response


class SecurityHeadersMiddleware:
    """
    Adds security headers to all responses.
    """
    
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        
        # Security headers
        response['X-Content-Type-Options'] = 'nosniff'
        response['X-Frame-Options'] = 'DENY'
        response['X-XSS-Protection'] = '1; mode=block'
        response['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        
        # Only add HSTS in production with HTTPS
        from django.conf import settings
        if not settings.DEBUG and request.is_secure():
            response['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains; preload'
        
        return response