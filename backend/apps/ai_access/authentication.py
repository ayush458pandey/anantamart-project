"""DRF authentication for AI service tokens."""
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed

from .models import AIAccessToken
from .services import parse_prefix, tokens_match

HEADER = 'HTTP_AUTHORIZATION'


class AIServiceTokenAuthentication(BaseAuthentication):
    """Authenticate ``Authorization: Bearer ai_<prefix>_<secret>``.

    Returns ``(None, token)``: ``request.auth`` carries the token while
    ``request.user`` stays ``None``. Faking a user object would make
    ``is_staff`` checks elsewhere pass by accident, so we never do it.
    """

    keyword = 'Bearer'

    def authenticate(self, request):
        raw = self._extract(request)
        if raw is None:
            return None  # let any other configured authenticator try

        prefix = parse_prefix(raw)
        if prefix is None:
            raise AuthenticationFailed('Malformed AI token.')

        token = AIAccessToken.objects.filter(token_prefix=prefix).first()
        if token is None or not tokens_match(token.token_hash, raw):
            raise AuthenticationFailed('Invalid AI token.')
        if token.is_revoked:
            raise AuthenticationFailed('This AI token has been revoked.')
        if token.is_expired:
            raise AuthenticationFailed('This AI token has expired.')

        return (None, token)

    def authenticate_header(self, request):
        # Returning a value makes DRF answer 401 instead of 403 when the
        # Authorization header is missing entirely.
        return self.keyword

    def _extract(self, request):
        header = request.META.get(HEADER, '')
        if not header:
            return None
        parts = header.split()
        if len(parts) != 2 or parts[0].lower() != self.keyword.lower():
            return None
        return parts[1].strip() or None
