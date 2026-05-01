from django.contrib import admin
from unfold.admin import ModelAdmin, TabularInline
from .models import Order, OrderItem

class OrderItemInline(TabularInline):
    model = OrderItem
    extra = 0
    fields = ['product', 'variant', 'quantity', 'price', 'total']
    readonly_fields = ['total', 'price']

@admin.register(Order)
class OrderAdmin(ModelAdmin):
    list_display = ['order_number', 'user', 'status', 'total', 'payment_method', 'created_at']
    list_filter = ['status', 'payment_method', 'created_at']
    search_fields = ['order_number', 'user__username']
    inlines = [OrderItemInline]

@admin.register(OrderItem)
class OrderItemAdmin(ModelAdmin):
    list_display = ['order', 'product', 'variant', 'quantity', 'price', 'total']

