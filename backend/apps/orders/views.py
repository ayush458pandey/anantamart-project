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

class OrderViewSet(viewsets.ModelViewSet):
    serializer_class = OrderSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return Order.objects.filter(user=self.request.user).prefetch_related('items__product')
    
    def create(self, request):
        """Create a new order"""
        try:
            # Generate order number
            order_number = 'ORD' + ''.join(random.choices(string.digits, k=8))
            
            user = request.user
            
            # Create order
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
            
            # Create order items
            for item_data in request.data.get('items', []):
                product = Product.objects.get(id=item_data['product_id'])
                OrderItem.objects.create(
                    order=order,
                    product=product,
                    quantity=item_data['quantity'],
                    variant=item_data.get('variant'),
                    price=product.base_price,
                    total=product.base_price * item_data['quantity']
                )
            
            # --- CRITICAL FIX: EMPTY THE CART ---
            # This deletes all items in the user's cart after order is placed
            try:
                cart = Cart.objects.get(user=user)
                cart.items.all().delete()
            except Cart.DoesNotExist:
                pass # If no cart exists, just ignore
            # ------------------------------------

            # ------------------------------------

            # Send Email Confirmation (Async in production, sync for now)
            from .utils import send_order_confirmation_email
            send_order_confirmation_email(order)

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