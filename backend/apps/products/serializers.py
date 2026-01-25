from rest_framework import serializers
from .models import Product, Category, PriceTier, ProductImage, Subcategory, Brand

class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'name', 'description', 'icon', 'image', 'is_active']

class SubcategorySerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    image_url = serializers.SerializerMethodField()
    product_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Subcategory
        fields = ['id', 'name', 'category', 'category_name', 'description', 'image', 'image_url', 'icon_name', 'product_count', 'is_active']
    
    def get_image_url(self, obj):
        if obj.image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.image.url)
        return None
    
    def get_product_count(self, obj):
        return obj.products.filter(is_active=True).count()

class BrandSerializer(serializers.ModelSerializer):
    logo_url = serializers.SerializerMethodField()
    product_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Brand
        fields = ['id', 'name', 'slug', 'logo', 'logo_url', 'description', 'product_count', 'is_active']
    
    def get_logo_url(self, obj):
        if obj.logo:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.logo.url)
        return None
    
    def get_product_count(self, obj):
        return obj.products.filter(is_active=True).count()

class PriceTierSerializer(serializers.ModelSerializer):
    class Meta:
        model = PriceTier
        # ✅ Corrected: Only fields that actually exist in PriceTier model
        fields = ['min_quantity', 'max_quantity', 'price']

# ✅ Defined BEFORE ProductSerializer
class ProductImageSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()
    
    class Meta:
        model = ProductImage
        fields = ['id', 'image', 'image_url', 'order', 'is_primary']
    
    def get_image_url(self, obj):
        if obj.image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.image.url)
        return None

class ProductSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    subcategory_name = serializers.CharField(source='subcategory.name', read_only=True, allow_null=True)
    brand_name = serializers.SerializerMethodField()
    brand_logo = serializers.SerializerMethodField()
    stock_status = serializers.CharField(read_only=True)
    
    images = ProductImageSerializer(many=True, read_only=True)
    
    key_features_list = serializers.SerializerMethodField()
    image_url = serializers.SerializerMethodField()
    
    # ✅ ENABLED: Maps your DB 'tax_rate' to Frontend 'gst_rate'
    gst_rate = serializers.DecimalField(source='tax_rate', max_digits=5, decimal_places=2, read_only=True)
    
    tiers = PriceTierSerializer(many=True, read_only=True)

    class Meta:
        model = Product
        fields = [
            'id', 'name', 'sku', 'category', 'category_name', 'subcategory', 'subcategory_name', 'description',
            'brand', 'brand_ref', 'brand_name', 'brand_logo', 'product_type', 'key_features', 'key_features_list',
            'ingredients', 'packaging_type', 'dietary_preference',
            'storage_instruction', 'usage_recommendation', 'unit', 'weight',
            'image', 'image_url', 'images', 'mrp', 'base_price', 
            'gst_rate',  # ✅ Correctly exposed to frontend
            'stock', 'stock_status',
            'moq', 'case_size', 'is_active', 'created_at', 'tiers'
        ]
    
    def get_brand_name(self, obj):
        if obj.brand_ref:
            return obj.brand_ref.name
        return obj.brand or 'Generic'
    
    def get_brand_logo(self, obj):
        if obj.brand_ref and obj.brand_ref.logo:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.brand_ref.logo.url)
        return None
    
    def get_key_features_list(self, obj):
        if obj.key_features:
            return [f.strip() for f in obj.key_features.split('\n') if f.strip()]
        return []
    
    def get_image_url(self, obj):
        if obj.image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.image.url)
            return obj.image.url if obj.image else None
        return None