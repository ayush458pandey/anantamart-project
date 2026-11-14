"""Serializers for the staff-only AI draft review screen.

Deliberately separate from ProductWriteSerializer (create-only) and
ProductSerializer (read-only in practice). Keeping them apart means the review
screen cannot accidentally publish a product: is_active, source_token and
draft_status are read-only here, and publishing happens only through the
explicit bulk-approve action.
"""
from rest_framework import serializers

from .models import Product, ProductImage


class DraftImageSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = ProductImage
        fields = [
            'id', 'image_url', 'order', 'is_primary', 'alt_text',
            'source_url', 'source_kind',
        ]

    def get_image_url(self, obj):
        if not obj.image:
            return None
        request = self.context.get('request')
        return request.build_absolute_uri(obj.image.url) if request else obj.image.url


class ProductDraftReadSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    subcategory_name = serializers.CharField(
        source='subcategory.name', read_only=True, default=None,
    )
    brand_name = serializers.SerializerMethodField()
    images = DraftImageSerializer(many=True, read_only=True)
    token_name = serializers.CharField(source='source_token.name', read_only=True, default=None)

    class Meta:
        model = Product
        fields = [
            'id', 'name', 'slug', 'sku', 'description',
            'category', 'category_name', 'subcategory', 'subcategory_name',
            'brand_ref', 'brand_name',
            'base_price', 'mrp', 'purchase_price', 'tax_rate', 'hsn_code',
            'stock', 'moq', 'case_size', 'unit', 'weight',
            'is_active', 'draft_status', 'source_token', 'token_name',
            'images', 'created_at', 'updated_at',
        ]

    def get_brand_name(self, obj):
        if obj.brand_ref:
            return obj.brand_ref.name
        return obj.brand or 'Generic'


class ProductDraftUpdateSerializer(serializers.ModelSerializer):
    """Narrow editor for a pending draft.

    is_active, source_token and draft_status are intentionally absent from
    ``fields``, so a PATCH cannot publish or re-attribute a draft.
    """

    class Meta:
        model = Product
        fields = [
            'name', 'description', 'sku',
            'category', 'subcategory', 'brand_ref',
            'base_price', 'mrp', 'purchase_price', 'tax_rate', 'hsn_code',
            'stock', 'moq', 'case_size', 'unit', 'weight',
        ]

    def validate_sku(self, value):
        # Lowercase, matching ProductWriteSerializer. Uniqueness stays
        # case-insensitive so existing mixed-case rows still block a clash.
        value = (value or '').strip().lower()
        if not value:
            raise serializers.ValidationError('SKU is required.')
        clash = Product.objects.filter(sku__iexact=value).exclude(pk=self.instance.pk)
        if clash.exists():
            raise serializers.ValidationError('A product with this SKU already exists.')
        return value

    def validate(self, attrs):
        base_price = attrs.get('base_price', getattr(self.instance, 'base_price', None))
        mrp = attrs.get('mrp', getattr(self.instance, 'mrp', None))
        if base_price is not None and mrp is not None and mrp < base_price:
            raise serializers.ValidationError(
                {'mrp': 'MRP cannot be lower than the selling price.'}
            )
        return attrs
