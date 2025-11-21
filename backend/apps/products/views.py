from rest_framework import viewsets, filters
from django_filters.rest_framework import DjangoFilterBackend
from .models import Product, Category
from .serializers import ProductSerializer, CategorySerializer

class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.filter(is_active=True).select_related('category').prefetch_related('tiers', 'images')
    serializer_class = ProductSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    
    # Remove 'stock_status' - it's a property, not a field
    filterset_fields = ['category', 'is_active']  # Only real database fields
    
    search_fields = ['name', 'sku', 'description']
    ordering_fields = ['base_price', 'created_at', 'name']
    ordering = ['-created_at']
    
    def get_serializer_context(self):
        """Add request context to serializer for full image URLs"""
        context = super().get_serializer_context()
        context['request'] = self.request
        return context

class CategoryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
