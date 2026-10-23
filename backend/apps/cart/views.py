from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404
from django.db import transaction
from .models import Cart, CartItem
from .serializers import CartSerializer
from apps.products.models import Product, ProductVariant

# --- HELPER FUNCTION ---
def get_cart(request):
    if request.user.is_authenticated:
        cart, created = Cart.objects.get_or_create(user=request.user)
        
        # Merge anonymous cart if it exists (atomic to prevent race conditions)
        if request.session.session_key:
            with transaction.atomic():
                # Lock the user's cart row to serialize concurrent merges
                cart = Cart.objects.select_for_update().get(pk=cart.pk)
                
                session_cart = Cart.objects.filter(
                    session_key=request.session.session_key, 
                    user__isnull=True
                ).first()
                
                if session_cart and session_cart.items.exists():
                    for item in session_cart.items.all():
                        cart_item, item_created = CartItem.objects.get_or_create(
                            cart=cart,
                            product=item.product,
                            variant=item.variant,
                            defaults={
                                'quantity': item.quantity,
                                'variant_ref': item.variant_ref,
                            }
                        )
                        if not item_created:
                            cart_item.quantity += item.quantity
                            cart_item.save()
                    
                    # Delete the session cart items and the cart itself after merging
                    session_cart.items.all().delete()
                    session_cart.delete()
                
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
    variant = (request.data.get('variant') or '').strip()  # 🆕 Handle Variant label
    variant_id = request.data.get('variant_id')            # 🆕 Handle exact ProductVariant
    quantity = int(request.data.get('quantity', 1))
    
    if not product_id:
        return Response({'error': 'Product ID is required'}, status=400)
    
    try:
        product = Product.objects.get(id=product_id)

        # Resolve the ProductVariant when the client sent one. Accept either an
        # explicit variant_id or derive it from a "Type: Name" label.
        variant_obj = None
        if variant_id:
            variant_obj = ProductVariant.objects.filter(
                id=variant_id, product=product, is_active=True
            ).first()
        elif variant:
            variant_obj = _resolve_variant_from_label(product, variant)

        # Normalise the stored label so identical selections always merge.
        if variant_obj:
            variant = f"{variant_obj.variant_type}: {variant_obj.name}"
        elif not variant:
            variant = ''

        # Stock guard against the exact variant when we have one.
        if variant_obj and variant_obj.stock < quantity:
            return Response(
                {'error': f'Only {variant_obj.stock} in stock for {variant_obj.name}'},
                status=400
            )
        
        # Check specific variant item
        cart_item, created = CartItem.objects.get_or_create(
            cart=cart,
            product=product,
            variant=variant,
            defaults={'quantity': quantity, 'variant_ref': variant_obj}
        )
        
        if not created:
            cart_item.quantity += quantity  # 🆕 Increment instead of replace
            # Backfill the variant ref if it was missing previously.
            if variant_obj and not cart_item.variant_ref_id:
                cart_item.variant_ref = variant_obj
            cart_item.save()
        
        serializer = CartSerializer(cart, context={'request': request})
        return Response(serializer.data)
    
    except Product.DoesNotExist:
        return Response({'error': 'Product not found'}, status=404)


def _resolve_variant_from_label(product, label):
    """Best-effort match of a stored variant label ('Size: 10"') to a ProductVariant."""
    if not label:
        return None
    name = label.split(':', 1)[1].strip() if ':' in label else label.strip()
    return product.variants.filter(name__iexact=name, is_active=True).first()

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