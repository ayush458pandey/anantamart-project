from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404
from .models import Cart, CartItem
from .serializers import CartSerializer
from apps.products.models import Product

# --- HELPER FUNCTION ---
def get_cart(request):
    """
    Logic to get the correct cart:
    1. If user is logged in -> Get User Cart
    2. If guest -> Get Session Cart
    """
    if request.user.is_authenticated:
        # Get or create a cart linked to the USER
        cart, created = Cart.objects.get_or_create(user=request.user)
        return cart
    else:
        # Ensure session exists
        if not request.session.session_key:
            request.session.create()
        
        # Get or create a cart linked to the SESSION
        cart, created = Cart.objects.get_or_create(
            session_key=request.session.session_key,
            defaults={'user': None}
        )
        return cart

# --- VIEWS ---

@api_view(['GET'])
@permission_classes([AllowAny]) # Open to everyone
def my_cart(request):
    """Get current user's (or guest's) cart"""
    cart = get_cart(request)
    serializer = CartSerializer(cart, context={'request': request})
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([AllowAny]) # Open to everyone
def add_to_cart(request):
    """Add item to cart or update quantity"""
    cart = get_cart(request)
    
    product_id = request.data.get('product_id')
    quantity = int(request.data.get('quantity', 1))
    
    if not product_id:
        return Response({'error': 'Product ID is required'}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        product = Product.objects.get(id=product_id)
        
        # Get or create cart item
        cart_item, created = CartItem.objects.get_or_create(
            cart=cart,
            product=product,
            defaults={'quantity': quantity}
        )
        
        # If item already exists, just update the quantity
        if not created:
            cart_item.quantity = quantity # Or use += quantity if you want to increment
            cart_item.save()
        
        serializer = CartSerializer(cart, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)
    
    except Product.DoesNotExist:
        return Response({'error': 'Product not found'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['PUT'])
@permission_classes([AllowAny])
def update_cart_item(request, item_id):
    """Update cart item quantity"""
    cart = get_cart(request)
    
    # Security: Ensure we only modify items in OUR cart
    cart_item = get_object_or_404(CartItem, id=item_id, cart=cart)
    
    quantity = int(request.data.get('quantity', 1))
    
    if quantity <= 0:
        cart_item.delete()
    else:
        cart_item.quantity = quantity
        cart_item.save()
    
    serializer = CartSerializer(cart.cart, context={'request': request}) # cart_item.cart points to parent
    return Response(serializer.data)


@api_view(['DELETE'])
@permission_classes([AllowAny])
def remove_from_cart(request, item_id):
    """Remove item from cart"""
    cart = get_cart(request)
    
    # Security: Ensure we only delete items from OUR cart
    cart_item = get_object_or_404(CartItem, id=item_id, cart=cart)
    cart_item.delete()
    
    serializer = CartSerializer(cart, context={'request': request})
    return Response(serializer.data)


@api_view(['DELETE'])
@permission_classes([AllowAny])
def clear_cart(request):
    """Clear all items from cart"""
    cart = get_cart(request)
    cart.items.all().delete()
    
    serializer = CartSerializer(cart, context={'request': request})
    return Response(serializer.data)