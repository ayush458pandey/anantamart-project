from django.contrib import admin
from django.urls import path, include
<<<<<<< Updated upstream
from rest_framework.routers import DefaultRouter
from .views import OrderViewSet, create_razorpay_order, verify_razorpay_payment

router = DefaultRouter()
router.register(r'', OrderViewSet, basename='order')

urlpatterns = [
    # Payment endpoints (must come BEFORE router)
    path('payment/create/', create_razorpay_order, name='create-payment'),
    path('payment/verify/', verify_razorpay_payment, name='verify-payment'),
    
    # Order CRUD endpoints
    path('', include(router.urls)),
]
=======
from django.conf import settings
from django.conf.urls.static import static
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)

urlpatterns = [
    path('admin/', admin.site.urls),
    
    # --- Auth & User ---
    path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/user/', include('apps.users.urls')), 
    
    # --- CRITICAL FIX: Give 'orders' its own path ---
    # Before: path('api/', include('apps.orders.urls')) -> Result: api/payment/create/
    # Now:    path('api/orders/', include('apps.orders.urls')) -> Result: api/orders/payment/create/
    path('api/orders/', include('apps.orders.urls')),

    # --- Other Apps ---
    path('api/', include('apps.products.urls')),
    path('api/', include('apps.cart.urls')),
    path('api/', include('core.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
>>>>>>> Stashed changes
