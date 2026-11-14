import re
from decimal import Decimal

from django.db import transaction
from rest_framework import serializers
from .models import Product, Category, PriceTier, ProductImage, Subcategory, Brand, TagGroup, ProductTag, ProductVariant

def optimize_cloudinary_url(url):
    """Automatically compress and optimize Cloudinary images"""
    if url and isinstance(url, str) and 'res.cloudinary.com' in url and '/upload/' in url and 'q_auto' not in url:
        return url.replace('/upload/', '/upload/q_auto,f_auto/', 1)
    return url

class OptimizedImageMixin:
    """Mixin to apply Cloudinary optimization to all URL fields in the serializer"""
    def to_representation(self, instance):
        ret = super().to_representation(instance)
        for key, value in ret.items():
            if isinstance(value, str) and 'res.cloudinary.com' in value:
                ret[key] = optimize_cloudinary_url(value)
        return ret

class CategorySerializer(OptimizedImageMixin, serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'name', 'short_name', 'description', 'icon', 'image', 'is_active']

class SubcategorySerializer(OptimizedImageMixin, serializers.ModelSerializer):
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
        # Use pre-annotated count from viewset queryset (avoids N+1)
        return getattr(obj, '_product_count', obj.products.filter(is_active=True).count())

class BrandSerializer(OptimizedImageMixin, serializers.ModelSerializer):
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
        # Use pre-annotated count from viewset queryset (avoids N+1)
        return getattr(obj, '_product_count', obj.products.filter(is_active=True).count())

class PriceTierSerializer(serializers.ModelSerializer):
    class Meta:
        model = PriceTier
        # ✅ Corrected: Only fields that actually exist in PriceTier model
        fields = ['min_quantity', 'max_quantity', 'price']

# ✅ Defined BEFORE ProductSerializer
class ProductImageSerializer(OptimizedImageMixin, serializers.ModelSerializer):
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

# Tag serializers (defined before ProductSerializer)
class ProductTagInlineSerializer(serializers.ModelSerializer):
    """Lightweight tag serializer for embedding in product responses"""
    group_name = serializers.SerializerMethodField()
    group_slug = serializers.SerializerMethodField()
    subcategory_ids = serializers.SerializerMethodField()

    class Meta:
        model = ProductTag
        fields = ['id', 'name', 'slug', 'group_name', 'group_slug', 'subcategory_ids']

    def get_group_name(self, obj):
        return obj.group.name if obj.group else None

    def get_group_slug(self, obj):
        return obj.group.slug if obj.group else None

    def get_subcategory_ids(self, obj):
        return list(obj.subcategories.values_list('id', flat=True))

class ProductTagSerializer(OptimizedImageMixin, serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()
    
    class Meta:
        model = ProductTag
        fields = ['id', 'name', 'slug', 'image', 'image_url', 'display_order']
        
    def get_image_url(self, obj):
        if obj.image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.image.url)
        return None

class TagGroupSerializer(serializers.ModelSerializer):
    tags = ProductTagSerializer(many=True, read_only=True)
    
    class Meta:
        model = TagGroup
        fields = ['id', 'name', 'slug', 'display_order', 'tags']


class ProductVariantSerializer(OptimizedImageMixin, serializers.ModelSerializer):
    """Purchasable variation (size / colour / etc.) with fallbacks to parent product."""
    image_url = serializers.SerializerMethodField()
    effective_base_price = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    effective_mrp = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True, allow_null=True)
    effective_sku = serializers.CharField(read_only=True)
    effective_moq = serializers.IntegerField(read_only=True)
    effective_case_size = serializers.IntegerField(read_only=True)

    class Meta:
        model = ProductVariant
        fields = [
            'id', 'variant_type', 'name', 'sku', 'effective_sku',
            'base_price', 'mrp', 'effective_base_price', 'effective_mrp',
            'stock', 'stock_status', 'moq', 'case_size', 'effective_moq', 'effective_case_size',
            'image', 'image_url', 'hex_color', 'sort_order', 'is_active',
        ]

    def get_image_url(self, obj):
        # Variant image wins; otherwise fall back to the parent product's image.
        image = obj.image or (obj.product.image if obj.product_id else None)
        if not image:
            return None
        request = self.context.get('request')
        if request:
            return request.build_absolute_uri(image.url)
        return image.url


class ProductSerializer(OptimizedImageMixin, serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    subcategory_name = serializers.CharField(source='subcategory.name', read_only=True, allow_null=True)
    brand = serializers.SerializerMethodField()
    brand_name = serializers.SerializerMethodField()
    brand_logo = serializers.SerializerMethodField()
    stock_status = serializers.CharField(read_only=True)
    
    images = ProductImageSerializer(many=True, read_only=True)
    
    key_features_list = serializers.SerializerMethodField()
    available_colors_list = serializers.SerializerMethodField()
    image_url = serializers.SerializerMethodField()
    
    # ✅ ENABLED: Maps your DB 'tax_rate' to Frontend 'gst_rate'
    gst_rate = serializers.DecimalField(source='tax_rate', max_digits=5, decimal_places=2, read_only=True)
    
    tiers = PriceTierSerializer(many=True, read_only=True)
    tag_list = ProductTagInlineSerializer(source='tags', many=True, read_only=True)
    variants = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            'id', 'name', 'slug', 'sku', 'category', 'category_name', 'subcategory', 'subcategory_name', 'description',
            'brand', 'brand_ref', 'brand_name', 'brand_logo', 'product_type', 'key_features', 'key_features_list',
            'available_colors', 'available_colors_list',
            'ingredients', 'packaging_type', 'dietary_preference',
            'storage_instruction', 'usage_recommendation', 'unit', 'weight',
            'image', 'image_url', 'images', 'mrp', 'base_price', 
            'tax_rate', 'gst_rate', 'hsn_code',  # ✅ tax_rate for writes, gst_rate for reads
            'stock', 'stock_status',
            'moq', 'case_size', 'is_active', 'created_at', 'tiers', 'tag_list',
            'has_variants', 'variants',
        ]

    def get_variants(self, obj):
        """Only active variants, serialized with request context for absolute image URLs."""
        active_variants = [v for v in obj.variants.all() if v.is_active]
        return ProductVariantSerializer(
            active_variants, many=True, context=self.context
        ).data
    
    def get_brand_name(self, obj):
        if obj.brand_ref:
            return obj.brand_ref.name
        return obj.brand or 'Generic'

    def get_brand(self, obj):
        return self.get_brand_name(obj)
    
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

    def get_available_colors_list(self, obj):
        if obj.available_colors:
            return [c.strip() for c in obj.available_colors.split(',')]
        return []
    
    def get_image_url(self, obj):
        if obj.image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.image.url)
            return obj.image.url if obj.image else None
        return None


# =============================================================================
# WRITE SERIALIZERS
# -----------------------------------------------------------------------------
# Used for creating products from the admin import flow, REST import endpoints
# and future AI/MCP clients. The read-only ProductSerializer above is unchanged
# and remains the single source of truth for storefront responses.
#
# Rules enforced here:
#   * Taxonomy (category / subcategory / brand / tags) is resolved by name and
#     never created automatically.
#   * SKUs are normalised to uppercase and checked case-insensitively.
#   * Products are always created as drafts (is_active=False).
#   * Nested images / tiers / variants are created inside one transaction.
# =============================================================================


class ProductImageWriteSerializer(serializers.ModelSerializer):
    """Gallery image. Kept separate from Product.image (the main image)."""

    class Meta:
        model = ProductImage
        fields = ['image', 'order', 'is_primary', 'alt_text']
        extra_kwargs = {
            'order': {'required': False},
            'is_primary': {'required': False},
            'alt_text': {'required': False},
        }


class PriceTierWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = PriceTier
        fields = ['min_quantity', 'max_quantity', 'price']

    def validate_min_quantity(self, value):
        if value < 1:
            raise serializers.ValidationError('Minimum quantity must be at least 1.')
        return value

    def validate_price(self, value):
        if value <= 0:
            raise serializers.ValidationError('Tier price must be greater than zero.')
        return value

    def validate(self, attrs):
        max_quantity = attrs.get('max_quantity')
        if max_quantity is not None and max_quantity <= attrs['min_quantity']:
            raise serializers.ValidationError(
                'Maximum quantity must be greater than the minimum quantity.'
            )
        return attrs


class ProductVariantWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductVariant
        fields = [
            'variant_type', 'name', 'sku', 'base_price', 'mrp',
            'stock', 'stock_status', 'moq', 'case_size',
            'image', 'hex_color', 'sort_order', 'is_active',
        ]
        extra_kwargs = {
            'sku': {'required': False},
            'base_price': {'required': False},
            'mrp': {'required': False},
            'image': {'required': False},
            'hex_color': {'required': False},
            'sort_order': {'required': False},
            'is_active': {'required': False},
        }

    def validate_variant_type(self, value):
        value = (value or '').strip()
        if not value:
            raise serializers.ValidationError('Variant type is required (e.g. Size, Colour).')
        return value

    def validate_name(self, value):
        value = (value or '').strip()
        if not value:
            raise serializers.ValidationError('Variant option name is required.')
        return value

    def validate_hex_color(self, value):
        if value and not re.fullmatch(r'#[0-9A-Fa-f]{6}', value):
            raise serializers.ValidationError('Use a hex colour such as #FF0000.')
        return value

    def validate_base_price(self, value):
        if value is not None and value <= 0:
            raise serializers.ValidationError('Variant price must be greater than zero.')
        return value

    def validate_mrp(self, value):
        if value is not None and value <= 0:
            raise serializers.ValidationError('Variant MRP must be greater than zero.')
        return value

    def validate_stock(self, value):
        if value < 0:
            raise serializers.ValidationError('Stock cannot be negative.')
        return value

    def validate_moq(self, value):
        if value < 1:
            raise serializers.ValidationError('Minimum order quantity must be at least 1.')
        return value

    def validate_case_size(self, value):
        if value < 1:
            raise serializers.ValidationError('Case size must be at least 1.')
        return value

    def validate_sort_order(self, value):
        if value < 0:
            raise serializers.ValidationError('Sort order cannot be negative.')
        return value

    def validate(self, attrs):
        base_price = attrs.get('base_price')
        mrp = attrs.get('mrp')
        if base_price is not None and mrp is not None and mrp < base_price:
            raise serializers.ValidationError({
                'mrp': 'Variant MRP cannot be lower than the variant price.'
            })
        return attrs


class ProductWriteSerializer(serializers.ModelSerializer):
    """Create-only serializer for products.

    Taxonomy is supplied by name so CSV rows and AI payloads stay readable.
    Unknown categories, subcategories, brands and tags are rejected rather than
    created, so the catalogue taxonomy stays curated.
    """

    category_name = serializers.CharField(write_only=True)
    subcategory_name = serializers.CharField(
        write_only=True, required=False, allow_blank=True, default=''
    )
    brand_name = serializers.CharField(
        write_only=True, required=False, allow_blank=True, default=''
    )
    tag_names = serializers.ListField(
        child=serializers.CharField(), write_only=True, required=False, default=list
    )
    # Declared explicitly so "18", "18.0" and "18.00" are all accepted. The model
    # choice field would only accept the exact string "18.00".
    tax_rate = serializers.DecimalField(
        max_digits=5, decimal_places=2, required=False, default=Decimal('18.00')
    )

    images = ProductImageWriteSerializer(many=True, required=False, write_only=True)
    tiers = PriceTierWriteSerializer(many=True, required=False, write_only=True)
    variants = ProductVariantWriteSerializer(many=True, required=False, write_only=True)

    class Meta:
        model = Product
        fields = [
            'name', 'sku', 'description',
            'category_name', 'subcategory_name', 'brand_name', 'tag_names',
            'base_price', 'mrp', 'purchase_price', 'tax_rate', 'hsn_code',
            'moq', 'case_size', 'stock', 'stock_status', 'unit', 'weight',
            'product_type', 'key_features', 'available_colors',
            'packaging_type', 'dietary_preference', 'ingredients',
            'storage_instruction', 'usage_recommendation',
            'is_active', 'has_variants', 'image',
            'images', 'tiers', 'variants',
        ]
        extra_kwargs = {
            'description': {'allow_blank': False},
            'is_active': {'required': False},
            'has_variants': {'required': False},
            'image': {'required': False},
        }

    # --- field level ---------------------------------------------------------

    def validate_name(self, value):
        value = (value or '').strip()
        if not value:
            raise serializers.ValidationError('Product name is required.')
        return value

    def validate_sku(self, value):
        # SKUs are stored lowercase. Case is normalised rather than preserved
        # so 'ABC-1' and 'abc-1' cannot coexist; uniqueness stays
        # case-insensitive via sku__iexact below.
        value = (value or '').strip().lower()
        if not value:
            raise serializers.ValidationError('SKU is required.')
        if Product.objects.filter(sku__iexact=value).exists():
            raise serializers.ValidationError(
                f"A product with SKU '{value}' already exists."
            )
        return value

    def validate_description(self, value):
        value = (value or '').strip()
        if not value:
            raise serializers.ValidationError('Description is required.')
        return value

    def validate_base_price(self, value):
        if value is None or value <= 0:
            raise serializers.ValidationError('Selling price must be greater than zero.')
        return value

    def validate_mrp(self, value):
        if value is not None and value <= 0:
            raise serializers.ValidationError('MRP must be greater than zero.')
        return value

    def validate_purchase_price(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError('Purchase price cannot be negative.')
        return value

    def validate_tax_rate(self, value):
        allowed = {Decimal('0'), Decimal('5'), Decimal('18'), Decimal('40')}
        if value not in allowed:
            raise serializers.ValidationError('Tax rate must be 0, 5, 18 or 40.')
        return value

    def validate_moq(self, value):
        if value < 1:
            raise serializers.ValidationError('Minimum order quantity must be at least 1.')
        return value

    def validate_case_size(self, value):
        if value < 1:
            raise serializers.ValidationError('Case size must be at least 1.')
        return value

    def validate_stock(self, value):
        if value < 0:
            raise serializers.ValidationError('Stock cannot be negative.')
        return value

    # --- taxonomy resolution -------------------------------------------------

    def _resolve_category(self, name):
        name = (name or '').strip()
        if not name:
            raise serializers.ValidationError({'category_name': 'Category is required.'})

        matches = list(Category.objects.filter(name__iexact=name, is_active=True))
        if not matches:
            raise serializers.ValidationError({
                'category_name': [{
                    'code': 'category_not_found',
                    'detail': f"Category '{name}' does not exist.",
                    'suggestion': 'Create the category in admin, then retry.',
                }]
            })
        if len(matches) > 1:
            raise serializers.ValidationError({
                'category_name': f"Category name '{name}' is ambiguous."
            })
        return matches[0]

    def _resolve_subcategory(self, name, category):
        name = (name or '').strip()
        if not name:
            return None

        matches = list(Subcategory.objects.filter(
            name__iexact=name, category=category, is_active=True
        ))
        if not matches:
            raise serializers.ValidationError({
                'subcategory_name': [{
                    'code': 'subcategory_not_found',
                    'detail': (
                        f"Subcategory '{name}' does not exist in category "
                        f"'{category.name}'."
                    ),
                    'suggestion': 'Create the subcategory in admin, then retry.',
                }]
            })
        if len(matches) > 1:
            raise serializers.ValidationError({
                'subcategory_name': f"Subcategory name '{name}' is ambiguous."
            })
        return matches[0]

    def _resolve_brand(self, name):
        name = (name or '').strip()
        if not name:
            return None

        matches = list(Brand.objects.filter(name__iexact=name, is_active=True))
        if not matches:
            # Structured so the import engine can flag the brand for approval
            # instead of creating it automatically.
            raise serializers.ValidationError({
                'brand_name': [{
                    'code': 'brand_not_found',
                    'detail': f"Brand '{name}' does not exist.",
                    'suggestion': 'Create the brand in admin, then retry.',
                }]
            })
        if len(matches) > 1:
            raise serializers.ValidationError({
                'brand_name': f"Brand name '{name}' is ambiguous."
            })
        return matches[0]

    def _resolve_tags(self, names):
        resolved = []
        errors = []

        for raw_name in names or []:
            name = (raw_name or '').strip()
            if not name:
                continue

            matches = list(ProductTag.objects.filter(name__iexact=name, is_active=True))
            if not matches:
                errors.append({
                    'code': 'tag_not_found',
                    'detail': f"Tag '{name}' does not exist.",
                    'suggestion': 'Create the tag in admin, then retry.',
                })
            elif len(matches) > 1:
                errors.append({
                    'code': 'tag_ambiguous',
                    'detail': f"Tag name '{name}' matches multiple tags.",
                    'suggestion': 'Tag names must be unique across groups.',
                })
            else:
                resolved.append(matches[0])

        if errors:
            raise serializers.ValidationError({'tag_names': errors})
        return resolved

    # --- object level --------------------------------------------------------

    def validate(self, attrs):
        category = self._resolve_category(attrs.pop('category_name', ''))
        attrs['category'] = category

        subcategory = self._resolve_subcategory(
            attrs.pop('subcategory_name', ''), category
        )
        if subcategory is not None:
            attrs['subcategory'] = subcategory

        brand = self._resolve_brand(attrs.pop('brand_name', ''))
        if brand is not None:
            # Keep the legacy string and the FK in sync so the "Unbranded"
            # filter (which keys off brand == 'Generic') stays accurate.
            attrs['brand_ref'] = brand
            attrs['brand'] = brand.name
        else:
            attrs['brand_ref'] = None
            attrs['brand'] = 'Generic'

        attrs['_tags'] = self._resolve_tags(attrs.pop('tag_names', []))

        mrp = attrs.get('mrp')
        if mrp is not None and mrp < attrs['base_price']:
            raise serializers.ValidationError({
                'mrp': 'MRP cannot be lower than the selling price.'
            })

        self._validate_tiers(attrs.get('tiers', []))
        self._validate_variants(attrs.get('variants', []))
        self._validate_images(attrs.get('images', []))

        if attrs.get('variants'):
            attrs['has_variants'] = True

        # Publishing is a separate authorised action; imports always land as drafts.
        attrs['is_active'] = False

        return attrs

    def _validate_tiers(self, tiers):
        if not tiers:
            return

        ordered = sorted(tiers, key=lambda t: t['min_quantity'])
        open_ended = [t for t in ordered if t.get('max_quantity') is None]

        if len(open_ended) > 1:
            raise serializers.ValidationError({
                'tiers': 'Only one price tier may be open-ended (no maximum quantity).'
            })
        if open_ended and ordered[-1].get('max_quantity') is not None:
            raise serializers.ValidationError({
                'tiers': 'The open-ended tier must be the last tier.'
            })

        for previous, current in zip(ordered, ordered[1:]):
            previous_max = previous.get('max_quantity')
            if previous_max is not None and current['min_quantity'] <= previous_max:
                raise serializers.ValidationError({
                    'tiers': (
                        f"Tier starting at {current['min_quantity']} overlaps the "
                        f"tier ending at {previous_max}."
                    )
                })

    def _validate_images(self, images):
        if not images:
            return

        primaries = [img for img in images if img.get('is_primary')]
        if len(primaries) > 1:
            raise serializers.ValidationError({
                'images': (
                    'Only one gallery image may be marked as primary. '
                    f'{len(primaries)} were supplied.'
                )
            })

    def _validate_variants(self, variants):
        if not variants:
            return

        seen = set()
        seen_skus = set()
        for variant in variants:
            # variant_type is optional on the model (defaults to 'Size'), so it
            # may be absent from validated_data.
            variant_type = variant.get('variant_type') or 'Size'
            key = (variant_type.lower(), variant['name'].lower())
            if key in seen:
                raise serializers.ValidationError({
                    'variants': (
                        f"Duplicate variant '{variant_type}: "
                        f"{variant['name']}'."
                    )
                })
            seen.add(key)

            sku = (variant.get('sku') or '').strip().lower()
            if sku:
                if sku in seen_skus:
                    raise serializers.ValidationError({
                        'variants': f"Duplicate variant SKU '{sku}'."
                    })
                seen_skus.add(sku)

    # --- creation ------------------------------------------------------------

    @transaction.atomic
    def create(self, validated_data):
        images_data = validated_data.pop('images', [])
        tiers_data = validated_data.pop('tiers', [])
        variants_data = validated_data.pop('variants', [])
        tags = validated_data.pop('_tags', [])

        product = Product.objects.create(**validated_data)

        if tags:
            product.tags.set(tags)

        if images_data:
            has_primary = any(img.get('is_primary') for img in images_data)
            for index, image_data in enumerate(images_data):
                image_data.setdefault('order', index)
                if not has_primary and index == 0:
                    image_data['is_primary'] = True
                ProductImage.objects.create(product=product, **image_data)

        for tier_data in tiers_data:
            PriceTier.objects.create(product=product, **tier_data)

        for variant_data in variants_data:
            sku = (variant_data.get('sku') or '').strip().lower()
            variant_data['sku'] = sku
            ProductVariant.objects.create(product=product, **variant_data)

        return product
