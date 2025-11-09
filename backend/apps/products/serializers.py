from rest_framework import serializers
from .models import Product, Category, PriceTier ,ProductImage

class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'name', 'description', 'icon', 'is_active']

class PriceTierSerializer(serializers.ModelSerializer):
    class Meta:
        model = PriceTier
        fields = ['min_quantity', 'max_quantity', 'price', 'mrp']


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
    stock_status = serializers.CharField(read_only=True)
    images = ProductImageSerializer(many=True, read_only=True)
    key_features_list = serializers.SerializerMethodField()
    
    class Meta:
        model = Product
        fields = [
            'id', 'name', 'sku', 'category', 'category_name', 'description',
            'brand', 'product_type', 'key_features', 'key_features_list',
            'ingredients', 'packaging_type', 'dietary_preference',
            'storage_instruction', 'usage_recommendation', 'unit', 'weight',
            'image', 'images', 'mrp', 'base_price', 'stock', 'stock_status',
            'moq', 'case_size', 'is_active', 'created_at', 'tiers'
        ]
    
    def get_key_features_list(self, obj):
        if obj.key_features:
            return [f.strip() for f in obj.key_features.split('\n') if f.strip()]
        return []