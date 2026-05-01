from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
# CRITICAL: We added 'get_addresses' to this import line
from .views import AddressViewSet, RegisterView, ProfileView, get_addresses, PasswordResetRequestView, PasswordResetConfirmView, GoogleLoginView

router = DefaultRouter()
router.register(r'addresses', AddressViewSet, basename='address')

urlpatterns = [
    # Authentication endpoints
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', TokenObtainPairView.as_view(), name='login'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('me/', ProfileView.as_view(), name='profile'),
    path('google-login/', GoogleLoginView.as_view(), name='google_login'),
    
    # Password Reset
    path('password-reset/', PasswordResetRequestView.as_view(), name='password_reset'),
    path('password-reset-confirm/', PasswordResetConfirmView.as_view(), name='password_reset_confirm'),
    
    # --- CRITICAL FIX: This URL was missing before ---
    path('get-addresses/', get_addresses, name='get_addresses'),

    # Address endpoints (from router)
    path('', include(router.urls)),
] #force update