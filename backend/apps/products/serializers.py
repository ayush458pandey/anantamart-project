from rest_framework import serializers
from .models import Product, Category, PriceTier, ProductImage, Subcategory, Brand

# ... [Keep your Category, Subcategory, Brand, PriceTier, ProductImage serializers exactly as they are] ...
# (Only replace the ProductSerializer class below)

class ProductSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    subcategory_name = serializers.CharField(source='subcategory.name', read_only=True, allow_null=True)
    brand_name = serializers.SerializerMethodField()
    brand_logo = serializers.SerializerMethodField()
    stock_status = serializers.CharField(read_only=True)
    images = ProductImageSerializer(many=True, read_only=True)
    key_features_list = serializers.SerializerMethodField()
    image_url = serializers.SerializerMethodField()
    
    # 🟢 MAPPING: This looks for 'tax_rate' in your database and sends it as 'gst_rate'
    # If your model field is named something else (like 'gst'), change source='gst'
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
            'gst_rate',  # 🟢 Only this alias is needed
            # 'hsn_code', ❌ REMOVED: This causes a 500 error if not in your models.py!
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