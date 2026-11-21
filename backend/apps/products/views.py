from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Count, Q
from django.utils.decorators import method_decorator
from django.views.decorators.cache import cache_page
from core.permissions import IsAdminOrReadOnly
from apps.ai_access.images import ImageRejected, process_upload
from .draft_serializers import DraftImageSerializer
from .models import Product, Category, Subcategory, Brand, TagGroup, ProductTag, ProductImage
from .serializers import ProductSerializer, CategorySerializer, SubcategorySerializer, BrandSerializer, TagGroupSerializer


class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.filter(is_active=True).select_related(
        'category', 'subcategory', 'brand_ref'
    ).prefetch_related('tiers', 'images', 'tags__group', 'variants')
    serializer_class = ProductSerializer
    permission_classes = [IsAdminOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    
    # Add brand and subcategory to filterset_fields
    filterset_fields = ['category', 'subcategory', 'brand', 'brand_ref', 'is_active']
    
    search_fields = ['name', 'sku', 'description', 'brand', 'brand_ref__name']
    ordering_fields = ['base_price', 'created_at', 'name']
    ordering = ['-created_at']
    
    @method_decorator(cache_page(300))
    def list(self, request, *args, **kwargs):
        """Cache product list for 5 minutes"""
        return super().list(request, *args, **kwargs)
    
    def get_queryset(self):
        """
        Override to support filtering by multiple brands and subcategories.
        Supports comma-separated values: ?brands=Samsung,Apple&subcategories=1,2
        """
        queryset = super().get_queryset()
        
        # Filter by multiple brands
        brands = self.request.query_params.get('brands', '')
        if brands:
            brand_list = [b.strip() for b in brands.split(',') if b.strip()]
            if brand_list:
                queryset = queryset.filter(
                    Q(brand_ref__name__in=brand_list) |
                    Q(brand_ref__isnull=True, brand__in=brand_list)
                )
        
        # Filter by multiple subcategories
        subcategories = self.request.query_params.get('subcategories', '')
        if subcategories:
            subcategory_list = [int(s.strip()) for s in subcategories.split(',') if s.strip().isdigit()]
            if subcategory_list:
                queryset = queryset.filter(subcategory_id__in=subcategory_list)
        
        # Filter by tags (OR within group, AND across groups; ungrouped tags use OR)
        tags_param = self.request.query_params.get('tags', '')
        if tags_param:
            tag_ids = [int(t.strip()) for t in tags_param.split(',') if t.strip().isdigit()]
            if tag_ids:
                # Group tag IDs by their TagGroup (None for ungrouped)
                tag_objects = ProductTag.objects.filter(id__in=tag_ids).select_related('group')
                groups = {}
                for tag in tag_objects:
                    group_key = tag.group_id  # None for ungrouped
                    groups.setdefault(group_key, []).append(tag.id)
                
                # AND across groups: each group must have at least one match
                for group_key, group_tag_ids in groups.items():
                    queryset = queryset.filter(tags__id__in=group_tag_ids)
                
                queryset = queryset.distinct()
        
        return queryset
    
    def get_serializer_context(self):
        """Add request context to serializer for full image URLs"""
        context = super().get_serializer_context()
        context['request'] = self.request
        return context
    
    @action(detail=False, methods=['get'], url_path=r'by-slug/(?P<slug>[^/.]+)')
    def by_slug(self, request, slug=None):
        """Retrieve a single product by its slug. Usage: /api/products/by-slug/<slug>/"""
        try:
            product = self.get_queryset().get(slug=slug)
        except Product.DoesNotExist:
            return Response({'error': 'Product not found'}, status=404)
        serializer = self.get_serializer(product)
        return Response(serializer.data)

    # --- Image management for LIVE products ---------------------------------
    # The draft endpoints only accept pending drafts, so there was no way to
    # attach an image to a product that is already published. These three
    # actions close that gap. They reuse apps.ai_access.images.process_upload so
    # the catalogue rules match the AI and draft paths exactly: JPEG/PNG/WebP
    # in, 1120x1400 WebP under 200 KB out, EXIF stripped, padded onto white.

    def _staff_only(self, request):
        """Return an error Response unless the caller is staff."""
        if not (request.user and request.user.is_authenticated and request.user.is_staff):
            return Response(
                {'error': 'Only staff can manage product images.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        return None

    @action(
        detail=True, methods=['post'], url_path='images',
        parser_classes=[MultiPartParser, FormParser],
    )
    def upload_image(self, request, pk=None):
        """POST /api/products/<id>/images/ -- append an image to a live product.

        Accepts a multipart ``file`` field plus optional ``alt_text`` and
        ``is_primary``. The first image on a product is always primary.
        """
        denied = self._staff_only(request)
        if denied:
            return denied

        product = self.get_object()

        uploaded = request.FILES.get('file')
        if uploaded is None:
            return Response(
                {'error': 'Send the image as a multipart "file" field.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            content, width, height, size = process_upload(uploaded)
        except ImageRejected as exc:
            # The product is left untouched: a bad image must never discard
            # good product data.
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        is_primary = str(request.data.get('is_primary', '')).lower() in ('1', 'true', 'yes')
        has_images = product.images.exists()

        image = ProductImage(
            product=product,
            alt_text=(request.data.get('alt_text') or '')[:255],
            source_kind=ProductImage.SOURCE_USER,
            order=product.images.count(),
            is_primary=is_primary or not has_images,
        )
        image.image.save(content.name, content, save=False)
        image.save()

        return Response(
            {
                'image': DraftImageSerializer(image, context={'request': request}).data,
                'width': width,
                'height': height,
                'bytes': size,
            },
            status=status.HTTP_201_CREATED,
        )

    @action(
        detail=True, methods=['post'], url_path=r'images/(?P<image_id>\d+)/primary',
    )
    def set_primary_image(self, request, pk=None, image_id=None):
        """POST /api/products/<id>/images/<image_id>/primary/ -- make one image primary."""
        denied = self._staff_only(request)
        if denied:
            return denied

        product = self.get_object()
        image = product.images.filter(pk=image_id).first()
        if image is None:
            return Response(
                {'error': 'Image not found on this product.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Exactly one primary per product.
        product.images.exclude(pk=image.pk).update(is_primary=False)
        image.is_primary = True
        image.save(update_fields=['is_primary'])

        return Response(
            DraftImageSerializer(image, context={'request': request}).data,
            status=status.HTTP_200_OK,
        )

    @action(
        detail=True, methods=['delete'], url_path=r'images/(?P<image_id>\d+)',
    )
    def delete_image(self, request, pk=None, image_id=None):
        """DELETE /api/products/<id>/images/<image_id>/ -- remove one image."""
        denied = self._staff_only(request)
        if denied:
            return denied

        product = self.get_object()
        image = product.images.filter(pk=image_id).first()
        if image is None:
            return Response(
                {'error': 'Image not found on this product.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        was_primary = image.is_primary
        image.delete()

        # Promote the next image so a product never loses its primary silently.
        if was_primary:
            replacement = product.images.order_by('order', 'id').first()
            if replacement:
                replacement.is_primary = True
                replacement.save(update_fields=['is_primary'])

        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=['get'])
    def filter_options(self, request):
        """
        Get available filter options (brands and subcategories) for a given category.
        Usage: /api/products/filter_options/?category=1&subcategory=2,3
        Returns brands and subcategories with product counts.
        Supports filtering brands by selected subcategories.
        """
        category_id = request.query_params.get('category')
        subcategory_ids = request.query_params.get('subcategory', '')
        
        if not category_id:
            return Response({'error': 'category parameter is required'}, status=400)
        
        # Base queryset for products in this category
        products = Product.objects.filter(category_id=category_id, is_active=True)
        
        # Parse subcategory IDs
        subcategory_list = []
        if subcategory_ids:
            subcategory_list = [int(sid.strip()) for sid in subcategory_ids.split(',') if sid.strip()]
        
        # If subcategories are selected, filter brands based on those subcategories
        if subcategory_list:
            products_for_brands = products.filter(subcategory_id__in=subcategory_list)
        else:
            products_for_brands = products
        
        # Get unique brands with counts, preferring the linked Brand model.
        # The legacy Product.brand field often contains "Generic", even when
        # brand_ref points to the real brand.
        # "Generic" / blank means unbranded, so it is counted separately and
        # surfaced as a dedicated "Unbranded" filter instead of a brand.
        brand_counts = {}
        unbranded_count = 0
        for product in products_for_brands.select_related('brand_ref').only('brand', 'brand_ref__name'):
            brand_name = product.brand_ref.name if product.brand_ref else product.brand
            if not brand_name or brand_name.strip().lower() == 'generic':
                unbranded_count += 1
                continue
            brand_counts[brand_name] = brand_counts.get(brand_name, 0) + 1
        
        # Get all subcategories with counts (always show all subcategories for the category)
        subcategories = Subcategory.objects.filter(
            category_id=category_id,
            is_active=True
        ).annotate(
            count=Count('products', filter=Q(products__is_active=True))
        ).order_by('name')
        
        # Resolve the full Brand records so the UI can render logos. The legacy
        # Product.brand string has no logo, so fall back to the linked Brand.
        brand_objs = {
            b.name: b
            for b in Brand.objects.filter(
                name__in=list(brand_counts.keys()), is_active=True
            ).only('id', 'name', 'slug', 'logo')
        }
        brands_list = []
        for name, count in sorted(brand_counts.items()):
            brand_obj = brand_objs.get(name)
            logo_url = None
            if brand_obj and brand_obj.logo:
                logo_url = self.request.build_absolute_uri(brand_obj.logo.url)
            brands_list.append({
                'id': brand_obj.id if brand_obj else None,
                'name': name,
                'slug': brand_obj.slug if brand_obj else None,
                'logo_url': logo_url,
                'count': count,
            })
        # Append the "Unbranded" pseudo-filter so buyers can find items without a brand.
        if unbranded_count:
            brands_list.append({
                'name': 'Unbranded',
                'count': unbranded_count,
                'is_unbranded': True,
            })
        
        return Response({
            'brands': brands_list,
            'subcategories': [
                {
                    'id': s.id,
                    'name': s.name,
                    'count': s.count
                }
                for s in subcategories
            ],
            # Count tags over the same scope as the tag list, so the number shown
            # next to a tag matches the products returned when it is selected.
            'tag_groups': self._get_tag_groups_for_category(
                category_id, subcategory_list, products_for_brands
            )
        })
    
    def _get_tag_groups_for_category(self, category_id, subcategory_list, products_qs):
        """Get tag groups applicable to this category, with tag counts.
        
        Tags are scoped by subcategory: if a subcategory is selected,
        ONLY tags explicitly assigned to that subcategory will be shown.
        Category-wide tags (Group tags) will only show when viewing the parent category.
        """
        # Get all active tags that belong to groups linked to this category,
        # OR ungrouped tags linked to subcategories in this category
        category_subcategory_ids = list(
            Subcategory.objects.filter(category_id=category_id, is_active=True).values_list('id', flat=True)
        )
        
        # All tags that could appear for this category:
        # 1. Tags in groups linked to this category
        # 2. Tags linked to subcategories of this category (regardless of group)
        tags = ProductTag.objects.filter(
            is_active=True
        ).filter(
            Q(group__categories__id=category_id) |
            Q(group__categories__isnull=True, group__isnull=False) |
            Q(subcategories__id__in=category_subcategory_ids)
        ).distinct().select_related('group').prefetch_related('subcategories')
        
        # If specific subcategories are selected, ONLY show tags explicitly assigned to them
        if subcategory_list:
            tags = tags.filter(
                subcategories__id__in=subcategory_list
            ).distinct()
        
        # Group tags by their TagGroup (None key for ungrouped)
        grouped = {}
        for tag in tags:
            count = products_qs.filter(tags=tag).count()
            
            group_key = tag.group_id
            if group_key not in grouped:
                grouped[group_key] = {
                    'group': tag.group,
                    'tags': []
                }
            tag_image_url = None
            if tag.image:
                tag_image_url = self.request.build_absolute_uri(tag.image.url) if hasattr(self, 'request') and self.request else tag.image.url

            grouped[group_key]['tags'].append({
                'id': tag.id,
                'name': tag.name,
                'slug': tag.slug,
                'image': tag_image_url,
                'count': count
            })
        
        result = []
        # First add grouped tags (sorted by group display_order)
        for group_key, data in sorted(
            grouped.items(),
            key=lambda x: (x[0] is None, x[1]['group'].display_order if x[1]['group'] else 999)
        ):
            if data['group']:
                result.append({
                    'id': data['group'].id,
                    'name': data['group'].name,
                    'slug': data['group'].slug,
                    'tags': data['tags']
                })
            else:
                # Ungrouped tags get a virtual group
                result.append({
                    'id': None,
                    'name': 'Tags',
                    'slug': 'tags',
                    'tags': data['tags']
                })
        
        return result


class CategoryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [AllowAny]
    
    # Cache categories for 5 minutes (rarely change)
    @method_decorator(cache_page(300))
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)
    
    @action(detail=True, methods=['get'])
    def subcategories(self, request, pk=None):
        """Get all subcategories for a specific category with images"""
        category = self.get_object()
        subcategories = category.subcategories.filter(is_active=True).annotate(
            _product_count=Count('products', filter=Q(products__is_active=True))
        )
        serializer = SubcategorySerializer(subcategories, many=True, context={'request': request})
        return Response(serializer.data)


class SubcategoryViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for viewing subcategories"""
    queryset = Subcategory.objects.filter(is_active=True)
    serializer_class = SubcategorySerializer
    permission_classes = [AllowAny]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['category']
    
    def get_queryset(self):
        return super().get_queryset().annotate(
            _product_count=Count('products', filter=Q(products__is_active=True))
        )
    
    def get_serializer_context(self):
        """Add request context to serializer for image URLs"""
        context = super().get_serializer_context()
        context['request'] = self.request
        return context


class BrandViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for viewing brands with logos"""
    queryset = Brand.objects.filter(is_active=True).exclude(name__iexact='Generic')
    serializer_class = BrandSerializer
    permission_classes = [AllowAny]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'description']
    ordering_fields = ['name', 'created_at']
    ordering = ['name']
    lookup_field = 'slug'
    
    def get_queryset(self):
        return super().get_queryset().annotate(
            _product_count=Count('products', filter=Q(products__is_active=True))
        )
    
    # Cache brands for 5 minutes
    @method_decorator(cache_page(300))
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)
    
    def get_serializer_context(self):
        """Add request context to serializer for logo URLs"""
        context = super().get_serializer_context()
        context['request'] = self.request
        return context
    
    @action(detail=True, methods=['get'])
    def products(self, request, slug=None):
        """Get all products for a specific brand"""
        brand = self.get_object()
        products = Product.objects.filter(
            brand_ref=brand,
            is_active=True
        ).select_related('category', 'subcategory', 'brand_ref').prefetch_related('tiers', 'images')
        
        # Apply additional filters if provided
        category_id = request.query_params.get('category')
        if category_id:
            products = products.filter(category_id=category_id)
        
        serializer = ProductSerializer(products, many=True, context={'request': request})
        return Response(serializer.data)

class TagGroupViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for viewing tag groups and their tags"""
    queryset = TagGroup.objects.filter(is_active=True).prefetch_related('tags')
    serializer_class = TagGroupSerializer
    permission_classes = [AllowAny]
    lookup_field = 'slug'

    @method_decorator(cache_page(300))
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context
