from rest_framework import generics
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from django.contrib.auth import get_user_model
from django.db import connection
from django.core.cache import cache
from .serializers import UserRegistrationSerializer

class RegisterView(generics.CreateAPIView):
    queryset = get_user_model().objects.all()
    permission_classes = (AllowAny,)
    serializer_class = UserRegistrationSerializer

class UserDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        return Response({
            'id': user.id,
            'email': user.email,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'is_superuser': user.is_superuser
        })


class HealthCheckView(APIView):
    """
    Health check endpoint for load balancers and monitoring.
    Returns status of database and cache connections.
    """
    permission_classes = [AllowAny]
    
    def get(self, request):
        health = {
            'status': 'ok',
            'database': False,
            'redis': False,
            'timestamp': None,
        }
        
        # Check database
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                cursor.fetchone()
            health['database'] = True
        except Exception:
            health['status'] = 'degraded'
        
        # Check Redis cache
        try:
            cache.set('health_check', 'ok', 10)
            if cache.get('health_check') == 'ok':
                health['redis'] = True
            else:
                health['status'] = 'degraded'
        except Exception:
            health['status'] = 'degraded'
        
        from django.utils import timezone
        health['timestamp'] = timezone.now().isoformat()
        
        status_code = 200 if health['status'] == 'ok' else 503
        return Response(health, status=status_code)