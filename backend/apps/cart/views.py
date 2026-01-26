from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404
from .models import Cart, CartItem
from .serializers import CartSerializer
from apps.products.models import Product

# --- HELPER FUNCTION ---
def get_cart(request):
    if request.user.is_authenticated:
        cart, created = Cart.objects.get_or_create(user=request.user)
        return cart
    else:
        if not request.session.session_key:
            request.session.create()
        
        cart, created = Cart.objects.get_or_create(
            session_key=request.session.session_key,
            defaults={'user': None}
        )
        return cart

# --- VIEWS ---

@api_view(['GET'])
@permission_classes([AllowAny])
def my_cart(request):
    cart = get_cart(request)
    serializer = CartSerializer(cart, context={'request': request})
    return Response(serializer.data)

@api_view(['POST'])
@permission_classes([AllowAny])
def add_to_cart(request):
    cart = get_cart(request)
    product_id = request.data.get('product_id')
    variant = request.data.get('variant', '').strip()  # 🆕 Handle Variant
    quantity = int(request.data.get('quantity', 1))
    
    if not product_id:
        return Response({'error': 'Product ID is required'}, status=400)
    
    try:
        product = Product.objects.get(id=product_id)
        
        # Check specific variant item
        cart_item, created = CartItem.objects.get_or_create(
            cart=cart,
            product=product,
            variant=variant,
            defaults={'quantity': quantity}
        )
        
        if not created:
            cart_item.quantity += quantity  # 🆕 Increment instead of replace
            cart_item.save()
        
        serializer = CartSerializer(cart, context={'request': request})
        return Response(serializer.data)
    
    except Product.DoesNotExist:
        return Response({'error': 'Product not found'}, status=404)

@api_view(['PUT'])
@permission_classes([AllowAny])
def update_cart_item(request, item_id):
    cart = get_cart(request)
    cart_item = get_object_or_404(CartItem, id=item_id, cart=cart)
    
    quantity = int(request.data.get('quantity', 1))
    
    if quantity <= 0:
        cart_item.delete()
    else:
        cart_item.quantity = quantity
        cart_item.save()
    
    # CTO NOTE: Fixed the bug here. It was 'cart.cart', changed to 'cart'.
    serializer = CartSerializer(cart, context={'request': request})
    return Response(serializer.data)

@api_view(['DELETE'])
@permission_classes([AllowAny])
def remove_from_cart(request, item_id):
    cart = get_cart(request)
    cart_item = get_object_or_404(CartItem, id=item_id, cart=cart)
    cart_item.delete()
    
    serializer = CartSerializer(cart, context={'request': request})
    return Response(serializer.data)

@api_view(['DELETE'])
@permission_classes([AllowAny])
def clear_cart(request):
    cart = get_cart(request)
    cart.items.all().delete()
    
    serializer = CartSerializer(cart, context={'request': request})
    return Response(serializer.data)