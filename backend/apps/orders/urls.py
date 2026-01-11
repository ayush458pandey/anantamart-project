from django.urls import path, include
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