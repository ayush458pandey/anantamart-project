from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
# CRITICAL: Added 'get_addresses' to the import list
from .views import AddressViewSet, RegisterView, ProfileView, get_addresses

router = DefaultRouter()
router.register(r'addresses', AddressViewSet, basename='address')

urlpatterns = [
    # Authentication endpoints
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', TokenObtainPairView.as_view(), name='login'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('me/', ProfileView.as_view(), name='profile'),
    
    # --- CRITICAL FIX: Ensure frontend can reach the list view ---
    # This connects the function we wrote to the URL
    path('get-addresses/', get_addresses, name='get_addresses'),

    # Address endpoints (from router)
    path('', include(router.urls)),
]