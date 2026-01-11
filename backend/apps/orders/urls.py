from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import OrderViewSet
from .views import create_payment_order

router = DefaultRouter()
router.register(r'orders', OrderViewSet, basename='order')

urlpatterns = [
    path('', include(router.urls)),
    path('payment/create/', create_payment_order, name='create-payment'),
]
