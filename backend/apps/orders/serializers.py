from rest_framework import serializers
from .models import Order, OrderItem
from apps.products.serializers import ProductSerializer

class OrderItemSerializer(serializers.ModelSerializer):
    product = ProductSerializer(read_only=True)
    
    class Meta:
        model = OrderItem
        fields = ['id', 'product', 'variant', 'quantity', 'price', 'total']

class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    
    class Meta:
        model = Order
        fields = [
            'id', 'order_number', 'status', 'status_display',
            'subtotal', 'discount', 'cgst', 'sgst', 'delivery_charges', 'total',
            'delivery_address', 'delivery_option', 'scheduled_date',
            'payment_method', 'payment_status',
            'tracking_number', 'courier_partner',
            'created_at', 'updated_at', 'confirmed_at', 'packed_at', 'shipped_at', 'delivered_at',
            'items'
        ]
