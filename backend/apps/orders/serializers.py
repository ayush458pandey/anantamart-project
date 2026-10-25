from rest_framework import serializers
from .models import Order, OrderItem
from apps.products.serializers import ProductSerializer, ProductVariantSerializer

class OrderItemSerializer(serializers.ModelSerializer):
    product = ProductSerializer(read_only=True)
    variant_ref = ProductVariantSerializer(read_only=True)

    # Snapshot-aware fields: always present on the order, and backfilled for
    # historical rows, so invoices never depend on the live product.
    display_name = serializers.CharField(read_only=True)
    effective_sku = serializers.CharField(read_only=True)
    effective_hsn_code = serializers.CharField(read_only=True)
    effective_tax_rate = serializers.DecimalField(
        max_digits=5, decimal_places=2, read_only=True, allow_null=True
    )

    class Meta:
        model = OrderItem
        fields = [
            'id', 'product', 'variant', 'variant_ref', 'quantity', 'price', 'total',
            'sku', 'product_name', 'hsn_code', 'tax_rate', 'unit',
            'display_name', 'effective_sku', 'effective_hsn_code', 'effective_tax_rate',
        ]

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
