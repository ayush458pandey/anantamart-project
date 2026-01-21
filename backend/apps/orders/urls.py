from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import OrderViewSet, create_razorpay_order, verify_razorpay_payment

router = DefaultRouter()
router.register(r'', OrderViewSet, basename='orders')

urlpatterns = [
    # Payment Endpoints
    path('payment/create/', create_razorpay_order, name='create_payment'),
    path('payment/verify/', verify_razorpay_payment, name='verify_payment'),

    # Standard Order Router
    path('', include(router.urls)),
]