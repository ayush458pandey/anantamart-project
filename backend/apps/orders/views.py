from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import Order
from .serializers import OrderSerializer
from apps.products.models import Product
from .services import OrderService, PaymentService, StockService
import razorpay


class OrderViewSet(viewsets.ModelViewSet):
    serializer_class = OrderSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return Order.objects.filter(user=self.request.user).prefetch_related('items__product')
    
    def create(self, request):
        """Create a new order using the service layer."""
        items_data = request.data.get('items', [])
        if not items_data:
            return Response(
                {'error': 'No items provided'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Build order data dict from request
        order_data = {
            'subtotal': request.data.get('subtotal'),
            'discount': request.data.get('discount', 0),
            'cgst': request.data.get('cgst'),
            'sgst': request.data.get('sgst'),
            'delivery_charges': request.data.get('delivery_charges', 0),
            'total': request.data.get('total'),
            'delivery_address': request.data.get('delivery_address'),
            'delivery_option': request.data.get('delivery_option'),
            'scheduled_date': request.data.get('scheduled_date'),
            'payment_method': request.data.get('payment_method'),
            'payment_status': request.data.get('payment_status', 'Pending'),
            'transaction_id': request.data.get('transaction_id'),
        }
        
        # Idempotency key from header or body
        idempotency_key = (
            request.headers.get('Idempotency-Key')
            or request.data.get('idempotency_key')
        )
        
        try:
            order = OrderService.create_order(
                user=request.user,
                items_data=items_data,
                order_data=order_data,
                allow_backorder=request.data.get('allow_backorder', False),
                idempotency_key=idempotency_key,
            )
            serializer = self.get_serializer(order)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        
        except Product.DoesNotExist:
            return Response(
                {'error': 'One or more products not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        except ValueError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['post'])
    def update_status(self, request, pk=None):
        """Update order status."""
        order = self.get_object()
        new_status = request.data.get('status')
        
        if not new_status:
            return Response(
                {'error': 'Status is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        order = OrderService.update_order_status(order, new_status)
        serializer = self.get_serializer(order)
        return Response(serializer.data)


# STOCK VALIDATION BEFORE PAYMENT
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def validate_stock(request):
    """
    Validate that all items have sufficient stock before initiating payment.
    Endpoint: POST /api/orders/validate-stock/
    Body: { "items": [{"product_id": 1, "quantity": 2}, ...] }
    """
    items = request.data.get('items', [])
    if not items:
        return Response({'error': 'No items provided'}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        is_valid, out_of_stock = StockService.validate_stock(items)
        
        if not is_valid:
            names = ', '.join([
                f"{i['name']} (available: {i['available']}, requested: {i['requested']})"
                for i in out_of_stock
            ])
            return Response(
                {'error': f'Insufficient stock for: {names}', 'out_of_stock': out_of_stock},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        return Response({'status': 'ok', 'message': 'All items in stock'}, status=status.HTTP_200_OK)
    
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# RAZORPAY PAYMENT INTEGRATION
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_razorpay_order(request):
    """
    Create a Razorpay order for payment processing.
    Endpoint: POST /api/orders/payment/create/
    Body: { "amount": 1500.50 }
    """
    amount = request.data.get('amount')
    
    if not amount:
        return Response(
            {'error': 'Amount is required'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        result = PaymentService.create_razorpay_order(amount)
        return Response(result, status=status.HTTP_200_OK)
    
    except ValueError as e:
        return Response(
            {'error': f'{str(e)}. Please contact support.'},
            status=status.HTTP_503_SERVICE_UNAVAILABLE
        )
    except Exception as e:
        return Response(
            {'error': f'Payment initialization failed: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def verify_razorpay_payment(request):
    """
    Verify Razorpay payment signature.
    Endpoint: POST /api/orders/payment/verify/
    Body: {
        "razorpay_order_id": "order_xxx",
        "razorpay_payment_id": "pay_xxx",
        "razorpay_signature": "signature_xxx"
    }
    """
    razorpay_order_id = request.data.get('razorpay_order_id')
    razorpay_payment_id = request.data.get('razorpay_payment_id')
    razorpay_signature = request.data.get('razorpay_signature')
    
    if not all([razorpay_order_id, razorpay_payment_id, razorpay_signature]):
        return Response(
            {'error': 'Missing payment details'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        result = PaymentService.verify_razorpay_payment(
            razorpay_order_id, razorpay_payment_id, razorpay_signature
        )
        return Response(result, status=status.HTTP_200_OK)
    
    except razorpay.errors.SignatureVerificationError:
        return Response(
            {'error': 'Invalid payment signature. Payment verification failed.'},
            status=status.HTTP_400_BAD_REQUEST
        )
    except ValueError as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_503_SERVICE_UNAVAILABLE
        )
    except Exception as e:
        return Response(
            {'error': f'Payment verification failed: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )