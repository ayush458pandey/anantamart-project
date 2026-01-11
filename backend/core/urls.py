from django.urls import path
from .views import RegisterView, UserDetailView

urlpatterns = [
    path('user/register/', RegisterView.as_view(), name='register'),
    path('user/me/', UserDetailView.as_view(), name='user-detail'),
]