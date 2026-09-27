from django.urls import path
from .views import RegisterView, UserDetailView, HealthCheckView

urlpatterns = [
    path('user/register/', RegisterView.as_view(), name='register'),
    path('user/me/', UserDetailView.as_view(), name='user-detail'),
    path('health/', HealthCheckView.as_view(), name='health-check'),
]