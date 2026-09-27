from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('chaining/', include('smart_selects.urls')),

    # --- Versioned API (recommended) ---
    path('api/v1/', include('config.api_urls')),

    # --- Legacy unversioned API (kept for backward compatibility) ---
    # TODO: Deprecate once frontend migrates to /api/v1/
    path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/user/', include('apps.users.urls')), 
    
    # --- Orders ---
    path('api/orders/', include('apps.orders.urls')),

    # ✅ MOVED UP: Cart & Core must be checked BEFORE Products
    path('api/', include('apps.cart.urls')),
    path('api/', include('core.urls')),

    # 👇 PRODUCTS MUST BE LAST (because it has "catch-all" patterns)
    path('api/', include('apps.products.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)