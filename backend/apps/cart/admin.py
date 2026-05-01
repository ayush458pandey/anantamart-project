from django.contrib import admin
from unfold.admin import ModelAdmin, TabularInline
from .models import Cart, CartItem


class CartItemInline(TabularInline):
    model = CartItem
    extra = 0
    readonly_fields = ['total_price']
    fields = ['product', 'quantity', 'total_price']


@admin.register(Cart)
class CartAdmin(ModelAdmin):
    list_display = ['id', 'session_key', 'user', 'created_at', 'updated_at']
    list_filter = ['created_at', 'updated_at']
    search_fields = ['session_key', 'user__username']
    readonly_fields = ['created_at', 'updated_at']
    inlines = [CartItemInline]


@admin.register(CartItem)
class CartItemAdmin(ModelAdmin):
    list_display = ['id', 'cart', 'product', 'quantity', 'total_price']
    list_filter = ['cart', 'product']
    search_fields = ['product__name']
    readonly_fields = ['total_price']
