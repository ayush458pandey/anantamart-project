from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Count, Q
from .models import Product, Category, Subcategory, Brand
from .serializers import ProductSerializer, CategorySerializer, SubcategorySerializer, BrandSerializer

class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.filter(is_active=True).select_related('category', 'subcategory').prefetch_related('tiers', 'images')
    serializer_class = ProductSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    
    # Add brand and subcategory to filterset_fields
    filterset_fields = ['category', 'subcategory', 'brand', 'is_active']
    
    search_fields = ['name', 'sku', 'description', 'brand']
    ordering_fields = ['base_price', 'created_at', 'name']
    ordering = ['-created_at']
    
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
                queryset = queryset.filter(brand__in=brand_list)
        
        # Filter by multiple subcategories
        subcategories = self.request.query_params.get('subcategories', '')
        if subcategories:
            subcategory_list = [int(s.strip()) for s in subcategories.split(',') if s.strip().isdigit()]
            if subcategory_list:
                queryset = queryset.filter(subcategory_id__in=subcategory_list)
        
        return queryset
    
    def get_serializer_context(self):
        """Add request context to serializer for full image URLs"""
        context = super().get_serializer_context()
        context['request'] = self.request
        return context
    
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
        
        # If subcategories are selected, filter brands based on those subcategories
        if subcategory_ids:
            subcategory_list = [int(sid.strip()) for sid in subcategory_ids.split(',') if sid.strip()]
            if subcategory_list:
                # Get brands only from selected subcategories
                products_for_brands = products.filter(subcategory_id__in=subcategory_list)
            else:
                products_for_brands = products
        else:
            products_for_brands = products
        
        # Get unique brands with counts (filtered by subcategory if applicable)
        brands = products_for_brands.values('brand').annotate(
            count=Count('id')
        ).filter(brand__isnull=False).exclude(brand='').order_by('brand')
        
        # Get all subcategories with counts (always show all subcategories for the category)
        subcategories = Subcategory.objects.filter(
            category_id=category_id,
            is_active=True
        ).annotate(
            count=Count('products', filter=Q(products__is_active=True))
        ).order_by('name')
        
        return Response({
            'brands': [
                {'name': b['brand'], 'count': b['count']} 
                for b in brands
            ],
            'subcategories': [
                {
                    'id': s.id,
                    'name': s.name,
                    'count': s.count
                }
                for s in subcategories
            ]
        })


class CategoryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    
    @action(detail=True, methods=['get'])
    def subcategories(self, request, pk=None):
        """Get all subcategories for a specific category with images"""
        category = self.get_object()
        subcategories = category.subcategories.filter(is_active=True)
        serializer = SubcategorySerializer(subcategories, many=True, context={'request': request})
        return Response(serializer.data)


class SubcategoryViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for viewing subcategories"""
    queryset = Subcategory.objects.filter(is_active=True)
    serializer_class = SubcategorySerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['category']
    
    def get_serializer_context(self):
        """Add request context to serializer for image URLs"""
        context = super().get_serializer_context()
        context['request'] = self.request
        return context


class BrandViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for viewing brands with logos"""
    queryset = Brand.objects.filter(is_active=True)
    serializer_class = BrandSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'description']
    ordering_fields = ['name', 'created_at']
    ordering = ['name']
    lookup_field = 'slug'
    
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
        ).select_related('category', 'subcategory').prefetch_related('tiers', 'images')
        
        # Apply additional filters if provided
        category_id = request.query_params.get('category')
        if category_id:
            products = products.filter(category_id=category_id)
        
        serializer = ProductSerializer(products, many=True, context={'request': request})
        return Response(serializer.data)
