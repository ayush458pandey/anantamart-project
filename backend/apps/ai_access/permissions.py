"""DRF permissions for AI service tokens."""
from rest_framework.permissions import BasePermission

from .models import AIAccessToken


class HasAIScope(BasePermission):
    """Require every scope listed in ``view.required_scopes``.

    Deny by default: a view that declares no scopes is refused, so a new
    endpoint cannot be exposed by forgetting to configure it.
    """

    message = 'This AI token lacks the required scope.'

    def has_permission(self, request, view):
        token = request.auth
        if not isinstance(token, AIAccessToken):
            return False
        required = getattr(view, 'required_scopes', ())
        if not required:
            return False
        return all(token.has_scope(scope) for scope in required)
