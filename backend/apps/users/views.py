from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.decorators import api_view, permission_classes
from django.contrib.auth.models import User
from .models import Address, UserProfile
from .serializers import AddressSerializer, UserSerializer, RegisterSerializer


# --- CRITICAL FIX: The specific API endpoint the frontend is calling ---
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_addresses(request):
    try:
        # Get all addresses for this user
        addresses = Address.objects.filter(user=request.user)
        # many=True ensures we return a LIST (Array), not a single object
        serializer = AddressSerializer(addresses, many=True)
        return Response(serializer.data)
    except Exception as e:
        return Response({'error': str(e)}, status=500)

# Address ViewSet (Kept for compatibility)
class AddressViewSet(viewsets.ModelViewSet):
    serializer_class = AddressSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return Address.objects.filter(user=self.request.user)
    
    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

# Register View
class RegisterView(APIView):
    permission_classes = [AllowAny]
    
    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            return Response({
                'user': {
                    'id': user.id,
                    'username': user.username,
                    'email': user.email,
                },
                'message': 'User registered successfully'
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

# Profile View — now supports nested profile (GST, phone, business_name)
class ProfileView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        # Ensure profile exists
        UserProfile.objects.get_or_create(user=request.user)
        serializer = UserSerializer(request.user)
        return Response(serializer.data)
    
    def put(self, request):
        user = request.user
        
        # Update basic user fields
        user_fields = ['first_name', 'last_name', 'email']
        for field in user_fields:
            if field in request.data:
                setattr(user, field, request.data[field])
        user.save()
        
        # Update profile fields (gst_number, phone_number, business_name)
        profile_data = request.data.get('profile', {})
        if profile_data:
            profile, _ = UserProfile.objects.get_or_create(user=user)
            for field in ['gst_number', 'phone_number', 'business_name']:
                if field in profile_data:
                    setattr(profile, field, profile_data[field])
            profile.save()
        
        serializer = UserSerializer(user)
        return Response(serializer.data)