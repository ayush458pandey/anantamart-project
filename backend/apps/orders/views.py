import razorpay
from django.conf import settings
from rest_framework.decorators import api_view, permission_classes
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated  # 👈 Changed from AllowAny
from .models import Order, OrderItem
from .serializers import OrderSerializer
from apps.products.models import Product
import random
import string
from datetime import datetime

class OrderViewSet(viewsets.ModelViewSet):
    serializer_class = OrderSerializer
    permission_classes = [IsAuthenticated]  # 👈 STRICT SECURITY
    
    def get_queryset(self):
        # 👈 Only return orders belonging to the logged-in user
        return Order.objects.filter(user=self.request.user)
    
    def create(self, request):
        # Generate order number
        order_number = 'ORD' + ''.join(random.choices(string.digits, k=8))
        
        # 👈 Use the real user, not a demo user
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
                price=product.base_price,
                total=product.base_price * item_data['quantity']
            )
        
        serializer = self.get_serializer(order)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['post'])
    def update_status(self, request, pk=None):
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

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_payment_order(request):
    try:
        amount = request.data.get('amount') # Amount in Rupees
        if not amount:
            return Response({'error': 'Amount is required'}, status=400)

        # Initialize Razorpay Client
        client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))

        # Create Order (Amount must be in Paise, so multiply by 100)
        payment_data = {
            'amount': int(float(amount) * 100),
            'currency': 'INR',
            'receipt': f'order_{request.user.id}',
            'payment_capture': 1 
        }

        order = client.order.create(data=payment_data)

        return Response({
            'order_id': order['id'],
            'amount': order['amount'],
            'key_id': settings.RAZORPAY_KEY_ID
        })

    except Exception as e:
        print(f"Payment Error: {str(e)}")
        return Response({'error': str(e)}, status=500)    