from django.contrib import admin
from .models import Category, Product, PriceTier, ProductImage


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ['name', 'is_active', 'created_at']
    list_filter = ['is_active']
    search_fields = ['name', 'description']


class ProductImageInline(admin.TabularInline):
    model = ProductImage
    extra = 1
    fields = ['image', 'order', 'is_primary', 'alt_text']


class PriceTierInline(admin.TabularInline):
    model = PriceTier
    extra = 1
    fields = ['min_quantity', 'max_quantity', 'price']


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ['name', 'sku', 'brand', 'category', 'base_price', 'stock', 'stock_status', 'is_active']
    list_filter = ['category', 'brand', 'is_active', 'stock_status', 'dietary_preference']
    search_fields = ['name', 'sku', 'brand', 'description']
    list_editable = ['stock', 'is_active']
    readonly_fields = ['created_at', 'updated_at']
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('name', 'sku', 'category', 'description', 'is_active')
        }),
        ('Product Details', {
            'fields': ('brand', 'product_type', 'key_features', 'ingredients', 
                      'packaging_type', 'dietary_preference', 'unit', 'weight')
        }),
        ('Usage & Storage', {
            'fields': ('usage_recommendation', 'storage_instruction')
        }),
        ('Pricing', {
            'fields': ('mrp', 'base_price')
        }),
        ('Stock', {
            'fields': ('stock', 'stock_status', 'moq', 'case_size')
        }),
        ('Images', {
            'fields': ('image',)
        }),
        ('Metadata', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    inlines = [ProductImageInline, PriceTierInline]


@admin.register(ProductImage)
class ProductImageAdmin(admin.ModelAdmin):
    list_display = ['product', 'order', 'is_primary', 'created_at']
    list_filter = ['is_primary', 'created_at']
    search_fields = ['product__name', 'alt_text']
    list_editable = ['order', 'is_primary']


@admin.register(PriceTier)
class PriceTierAdmin(admin.ModelAdmin):
    list_display = ['product', 'min_quantity', 'max_quantity', 'price']
    list_filter = ['product__category']
    search_fields = ['product__name']
