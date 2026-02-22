from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import Order, OrderItem
from .serializers import OrderSerializer
from apps.products.models import Product
from apps.cart.models import Cart, CartItem  # <--- NEW IMPORT
import random
import string
from datetime import datetime
import razorpay
from django.conf import settings
from django.db import transaction
from django.db.models import F

class OrderViewSet(viewsets.ModelViewSet):
    serializer_class = OrderSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return Order.objects.filter(user=self.request.user).prefetch_related('items__product')
    
    def create(self, request):
        """Create a new order"""
        try:
            items_data = request.data.get('items', [])
            if not items_data:
                return Response(
                    {'error': 'No items provided'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            user = request.user

            # Use an atomic transaction so stock changes roll back on failure
            with transaction.atomic():
                # --- STEP 1: Validate stock for ALL items before creating anything ---
                product_ids = [item['product_id'] for item in items_data]
                # Lock the product rows to prevent concurrent stock modifications
                products = {
                    p.id: p for p in Product.objects.select_for_update().filter(id__in=product_ids)
                }

                # Check all products exist
                for item_data in items_data:
                    pid = item_data['product_id']
                    if pid not in products:
                        return Response(
                            {'error': f'Product with id {pid} not found'},
                            status=status.HTTP_404_NOT_FOUND
                        )

                # Check sufficient stock for every item
                out_of_stock_items = []
                for item_data in items_data:
                    product = products[item_data['product_id']]
                    qty = item_data['quantity']
                    if product.stock < qty:
                        out_of_stock_items.append(
                            f"{product.name} (available: {product.stock}, requested: {qty})"
                        )

                if out_of_stock_items:
                    return Response(
                        {'error': f'Insufficient stock for: {", ".join(out_of_stock_items)}'},
                        status=status.HTTP_400_BAD_REQUEST
                    )

                # --- STEP 2: Create the order ---
                order_number = 'ORD' + ''.join(random.choices(string.digits, k=8))

                order = Order.objects.create(
                    user=user,
                    order_number=order_number,
                    subtotal=request.data.get('subtotal'),
                    discount=request.data.get('discount', 0),
                    cgst=request.data.get('cgst'),
                    sgst=request.data.get('sgst'),
                    delivery_charges=request.data.get('delivery_charges', 0),
                    total=request.data.get('total'),
                    delivery_address=request.data.get('delivery_address'),
                    delivery_option=request.data.get('delivery_option'),
                    scheduled_date=request.data.get('scheduled_date'),
                    payment_method=request.data.get('payment_method'),
                    payment_status=request.data.get('payment_status', 'Pending'),
                    transaction_id=request.data.get('transaction_id'),
                    tracking_number='TRK' + ''.join(random.choices(string.digits, k=10)),
                    courier_partner='BlueDart Express'
                )

                # --- STEP 3: Create order items AND decrement stock ---
                for item_data in items_data:
                    product = products[item_data['product_id']]
                    qty = item_data['quantity']

                    OrderItem.objects.create(
                        order=order,
                        product=product,
                        quantity=qty,
                        variant=item_data.get('variant'),
                        price=product.base_price,
                        total=product.base_price * qty
                    )

                    # Atomically decrement stock
                    Product.objects.filter(id=product.id).update(stock=F('stock') - qty)

                    # Refresh and update stock_status
                    product.refresh_from_db()
                    if product.stock == 0:
                        product.stock_status = 'out-of-stock'
                    elif product.stock <= 5:
                        product.stock_status = 'low-stock'
                    else:
                        product.stock_status = 'in-stock'
                    product.save(update_fields=['stock_status'])

                # --- STEP 4: Empty the cart ---
                try:
                    cart = Cart.objects.get(user=user)
                    cart.items.all().delete()
                except Cart.DoesNotExist:
                    pass

            serializer = self.get_serializer(order)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
            
        except Product.DoesNotExist:
            return Response(
                {'error': 'One or more products not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['post'])
    def update_status(self, request, pk=None):
        """Update order status"""
        order = self.get_object()
        new_status = request.data.get('status')
        
        order.status = new_status
        
        if new_status == 'confirmed' and not order.confirmed_at:
            order.confirmed_at = datetime.now()
        elif new_status == 'packed' and not order.packed_at:
            order.packed_at = datetime.now()
        elif new_status == 'shipped' and not order.shipped_at:
            order.shipped_at = datetime.now()
        elif new_status == 'delivered' and not order.delivered_at:
            order.delivered_at = datetime.now()
        
        order.save()
        serializer = self.get_serializer(order)
        return Response(serializer.data)


# 🆕 RAZORPAY PAYMENT INTEGRATION
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_razorpay_order(request):
    """
    Create a Razorpay order for payment processing
    Endpoint: POST /api/orders/payment/create/
    Body: { "amount": 1500.50 }
    """
    try:
        amount = request.data.get('amount')
        
        if not amount:
            return Response(
                {'error': 'Amount is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if Razorpay credentials are configured
        if not settings.RAZORPAY_KEY_ID or not settings.RAZORPAY_KEY_SECRET:
            return Response(
                {'error': 'Payment gateway not configured. Please contact support.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )
        
        # Initialize Razorpay client
        client = razorpay.Client(
            auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET)
        )
        
        # Create Razorpay order
        razorpay_order = client.order.create({
            'amount': int(float(amount) * 100),  # Convert to paise (₹1 = 100 paise)
            'currency': 'INR',
            'payment_capture': 1  # Auto capture payment
        })
        
        return Response({
            'order_id': razorpay_order['id'],
            'amount': razorpay_order['amount'],
            'currency': razorpay_order['currency'],
            'key_id': settings.RAZORPAY_KEY_ID
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response(
            {'error': f'Payment initialization failed: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def verify_razorpay_payment(request):
    """
    Verify Razorpay payment signature
    Endpoint: POST /api/orders/payment/verify/
    Body: {
        "razorpay_order_id": "order_xxx",
        "razorpay_payment_id": "pay_xxx",
        "razorpay_signature": "signature_xxx"
    }
    """
    try:
        razorpay_order_id = request.data.get('razorpay_order_id')
        razorpay_payment_id = request.data.get('razorpay_payment_id')
        razorpay_signature = request.data.get('razorpay_signature')
        
        if not all([razorpay_order_id, razorpay_payment_id, razorpay_signature]):
            return Response(
                {'error': 'Missing payment details'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Initialize Razorpay client
        client = razorpay.Client(
            auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET)
        )
        
        # Verify signature
        params_dict = {
            'razorpay_order_id': razorpay_order_id,
            'razorpay_payment_id': razorpay_payment_id,
            'razorpay_signature': razorpay_signature
        }
        
        client.utility.verify_payment_signature(params_dict)
        
        return Response({
            'status': 'success',
            'message': 'Payment verified successfully',
            'payment_id': razorpay_payment_id
        }, status=status.HTTP_200_OK)
        
    except razorpay.errors.SignatureVerificationError:
        return Response(
            {'error': 'Invalid payment signature. Payment verification failed.'},
            status=status.HTTP_400_BAD_REQUEST
        )
    except Exception as e:
        return Response(
            {'error': f'Payment verification failed: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )