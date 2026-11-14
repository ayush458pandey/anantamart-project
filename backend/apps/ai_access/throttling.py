"""Per-token throttling for AI service tokens."""
from rest_framework.throttling import SimpleRateThrottle


class AITokenRateThrottle(SimpleRateThrottle):
    """Rate limit keyed on the token prefix, not the client IP.

    An AI provider may call from many addresses, so IP-based limits would be
    both easy to evade and unfair to shared egress.
    """

    scope = 'ai_token'

    def get_cache_key(self, request, view):
        token = request.auth
        prefix = getattr(token, 'token_prefix', None)
        if not prefix:
            return None
        return self.cache_format % {'scope': self.scope, 'ident': prefix}
