from django.contrib import admin
from .models import Category, Product, PriceTier, ProductImage, Subcategory, Brand

@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ['name', 'is_active', 'created_at']
    list_filter = ['is_active']
    search_fields = ['name', 'description']

@admin.register(Subcategory)
class SubcategoryAdmin(admin.ModelAdmin):
    list_display = ['name', 'category', 'is_active', 'created_at']
    list_filter = ['category', 'is_active']
    search_fields = ['name', 'description', 'category__name']
    list_editable = ['is_active']
    fields = ['name', 'category', 'description', 'image', 'icon_name', 'is_active']

@admin.register(Brand)
class BrandAdmin(admin.ModelAdmin):
    list_display = ['name', 'slug', 'is_active', 'created_at']
    list_filter = ['is_active']
    search_fields = ['name', 'description']
    list_editable = ['is_active']
    prepopulated_fields = {'slug': ('name',)}
    fields = ['name', 'slug', 'logo', 'description', 'is_active']

class ProductImageInline(admin.TabularInline):
    model = ProductImage
    extra = 1
    fields = ['image', 'image_size_display', 'order', 'is_primary', 'alt_text']
    readonly_fields = ['image_size_display']

    def image_size_display(self, obj):
        if obj.image:
            try:
                size_kb = obj.image.size / 1024
                return f"{size_kb:.2f} KB"
            except Exception:
                return "Unknown"
        return "-"
    image_size_display.short_description = 'Size'

class PriceTierInline(admin.TabularInline):
    model = PriceTier
    extra = 1
    fields = ['min_quantity', 'max_quantity', 'price']

@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    # 🟢 Added 'hsn_code' to the list view
    list_display = ['name', 'sku', 'brand_ref', 'category', 'subcategory', 'base_price', 'tax_rate', 'hsn_code', 'stock', 'stock_status', 'is_active']
    
    list_filter = ['category', 'subcategory', 'brand_ref', 'is_active', 'stock_status', 'tax_rate', 'dietary_preference']
    
    # 🟢 Added 'hsn_code' to search (so you can search by it)
    search_fields = ['name', 'sku', 'hsn_code', 'brand', 'brand_ref__name', 'description']
    
    list_editable = ['stock', 'is_active', 'base_price', 'tax_rate']
    
    readonly_fields = ['created_at', 'updated_at', 'image_size_display']
    
    def image_size_display(self, obj):
        if obj.image:
            try:
                size_kb = obj.image.size / 1024
                return f"{size_kb:.2f} KB"
            except Exception:
                return "Unknown size"
        return "No image"
    image_size_display.short_description = 'Main Image Size'
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('name', 'sku', 'category', 'subcategory', 'description', 'is_active')
        }),
        ('Product Details', {
            'fields': ('brand_ref', 'product_type', 'available_colors', 'key_features', 'ingredients', 
                       'packaging_type', 'dietary_preference', 'unit', 'weight')
        }),
        ('Usage & Storage', {
            'fields': ('usage_recommendation', 'storage_instruction')
        }),
        ('Pricing', {
            # 🟢 ADDED hsn_code HERE (It will appear right below tax_rate)
            'fields': ('mrp', 'base_price', 'tax_rate', 'hsn_code')
        }),
        ('Stock', {
            'fields': ('stock', 'stock_status', 'moq', 'case_size')
        }),
        ('Images', {
            'fields': ('image', 'image_size_display')
        }),
        ('Legacy Fields', {
            'fields': ('brand',),
            'classes': ('collapse',),
            'description': 'Legacy brand field - Use "Brand ref" above instead. This field is kept for backward compatibility only.'
        }),
        ('Metadata', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    inlines = [ProductImageInline, PriceTierInline]

@admin.register(ProductImage)
class ProductImageAdmin(admin.ModelAdmin):
    list_display = ['product', 'image_size_display', 'order', 'is_primary', 'created_at']
    list_filter = ['is_primary', 'created_at']
    search_fields = ['product__name', 'alt_text']
    list_editable = ['order', 'is_primary']
    readonly_fields = ['image_size_display']

    def image_size_display(self, obj):
        if obj.image:
            try:
                size_kb = obj.image.size / 1024
                return f"{size_kb:.2f} KB"
            except Exception:
                return "Unknown"
        return "-"
    image_size_display.short_description = 'Size'

@admin.register(PriceTier)
class PriceTierAdmin(admin.ModelAdmin):
    list_display = ['product', 'min_quantity', 'max_quantity', 'price']
    list_filter = ['product__category']
    search_fields = ['product__name']