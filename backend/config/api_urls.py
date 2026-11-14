"""
API v1 URL configuration.
All versioned API routes are defined here.
"""
from django.urls import path, include
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)

urlpatterns = [
    # --- Auth & User ---
    path('token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('user/', include('apps.users.urls')),

    # --- Orders ---
    path('orders/', include('apps.orders.urls')),

    # Cart & Core must be checked BEFORE Products
    path('', include('apps.cart.urls')),
    path('', include('core.urls')),

    # Products MUST BE LAST (has catch-all patterns)
    path('', include('apps.products.urls')),

    # --- Restricted AI API (token-authenticated, scope-gated) ---
    path('ai/v1/', include('apps.ai_access.urls')),

    # --- Staff-only AI draft review (JWT + is_staff) ---
    path('admin/', include('apps.products.draft_urls')),
]