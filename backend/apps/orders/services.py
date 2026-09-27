"""
Order Services - Business logic extracted from views for testability and reusability.
"""
import random
import string
from datetime import datetime
from decimal import Decimal

import razorpay
from django.conf import settings
from django.db import transaction
from django.db.models import F

from apps.cart.models import Cart
from apps.products.models import Product
from .models import Order, OrderItem
from .utils import send_order_confirmation_email


class OrderService:
    """Service layer for order operations."""
    
    @staticmethod
    def generate_order_number() -> str:
        """Generate a unique order number."""
        return 'ORD' + ''.join(random.choices(string.digits, k=8))
    
    @staticmethod
    def generate_tracking_number() -> str:
        """Generate a tracking number."""
        return 'TRK' + ''.join(random.choices(string.digits, k=10))
    
    @classmethod
    def create_order(cls, user, items_data, order_data, allow_backorder=False, idempotency_key=None):
        """
        Create a new order with atomic transaction.
        
        Args:
            user: The user placing the order
            items_data: List of dicts with product_id, quantity, variant
            order_data: Dict with subtotal, discount, cgst, sgst, delivery_charges, total,
                       delivery_address, delivery_option, scheduled_date, payment_method,
                       payment_status, transaction_id
            allow_backorder: Whether to allow orders with insufficient stock
            idempotency_key: Optional client-generated key to prevent duplicate orders
            
        Returns:
            Order instance
            
        Raises:
            ValueError: If validation fails
            Product.DoesNotExist: If product not found
        """
        if not items_data:
            raise ValueError('No items provided')
        
        # Idempotency check: return existing order if key already used
        if idempotency_key:
            existing = Order.objects.filter(
                user=user, idempotency_key=idempotency_key
            ).first()
            if existing:
                return existing
        
        product_ids = [item['product_id'] for item in items_data]
        
        with transaction.atomic():
            # Lock product rows for stock validation
            products = {
                p.id: p for p in Product.objects.select_for_update().filter(id__in=product_ids)
            }
            
            # Validate all products exist
            for item_data in items_data:
                pid = item_data['product_id']
                if pid not in products:
                    raise Product.DoesNotExist(f'Product with id {pid} not found')
            
            # Validate stock
            if not allow_backorder:
                out_of_stock = []
                for item_data in items_data:
                    product = products[item_data['product_id']]
                    qty = item_data['quantity']
                    if product.stock < qty:
                        out_of_stock.append(
                            f"{product.name} (available: {product.stock}, requested: {qty})"
                        )
                if out_of_stock:
                    raise ValueError(f'Insufficient stock for: {", ".join(out_of_stock)}')
            
            # Create order
            order = Order.objects.create(
                user=user,
                order_number=cls.generate_order_number(),
                tracking_number=cls.generate_tracking_number(),
                courier_partner='BlueDart Express',
                idempotency_key=idempotency_key,
                **order_data
            )
            
            # Create order items and decrement stock
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
                
                # Decrement stock if available
                if product.stock >= qty:
                    Product.objects.filter(id=product.id).update(stock=F('stock') - qty)
                    product.refresh_from_db()
                    cls._update_stock_status(product)
            
            # Clear user's cart
            cls._clear_user_cart(user)
        
        # Send confirmation email (outside transaction)
        send_order_confirmation_email(order)
        
        return order
    
    @staticmethod
    def _update_stock_status(product):
        """Update product stock status based on current stock."""
        if product.stock == 0:
            product.stock_status = 'out-of-stock'
        elif product.stock <= 5:
            product.stock_status = 'low-stock'
        else:
            product.stock_status = 'in-stock'
        product.save(update_fields=['stock_status'])
    
    @staticmethod
    def _clear_user_cart(user):
        """Clear user's cart after successful order."""
        try:
            cart = Cart.objects.get(user=user)
            cart.items.all().delete()
        except Cart.DoesNotExist:
            pass
    
    @classmethod
    def update_order_status(cls, order, new_status):
        """Update order status with timestamp tracking."""
        order.status = new_status
        now = datetime.now()
        
        if new_status == 'confirmed' and not order.confirmed_at:
            order.confirmed_at = now
        elif new_status == 'packed' and not order.packed_at:
            order.packed_at = now
        elif new_status == 'shipped' and not order.shipped_at:
            order.shipped_at = now
        elif new_status == 'delivered' and not order.delivered_at:
            order.delivered_at = now
        
        order.save()
        return order


class PaymentService:
    """Service layer for payment operations."""
    
    @staticmethod
    def _get_razorpay_client():
        """Get configured Razorpay client."""
        if not settings.RAZORPAY_KEY_ID or not settings.RAZORPAY_KEY_SECRET:
            raise ValueError('Payment gateway not configured')
        return razorpay.Client(
            auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET)
        )
    
    @classmethod
    def create_razorpay_order(cls, amount):
        """
        Create a Razorpay order.
        
        Args:
            amount: Amount in rupees (will be converted to paise)
            
        Returns:
            Dict with order_id, amount, currency, key_id
        """
        client = cls._get_razorpay_client()
        
        razorpay_order = client.order.create({
            'amount': int(float(amount) * 100),  # Convert to paise
            'currency': 'INR',
            'payment_capture': 1
        })
        
        return {
            'order_id': razorpay_order['id'],
            'amount': razorpay_order['amount'],
            'currency': razorpay_order['currency'],
            'key_id': settings.RAZORPAY_KEY_ID
        }
    
    @classmethod
    def verify_razorpay_payment(cls, razorpay_order_id, razorpay_payment_id, razorpay_signature):
        """
        Verify Razorpay payment signature.
        
        Args:
            razorpay_order_id: Razorpay order ID
            razorpay_payment_id: Razorpay payment ID
            razorpay_signature: Razorpay signature
            
        Returns:
            Dict with status, message, payment_id
            
        Raises:
            razorpay.errors.SignatureVerificationError: If signature invalid
        """
        client = cls._get_razorpay_client()
        
        params_dict = {
            'razorpay_order_id': razorpay_order_id,
            'razorpay_payment_id': razorpay_payment_id,
            'razorpay_signature': razorpay_signature
        }
        
        client.utility.verify_payment_signature(params_dict)
        
        return {
            'status': 'success',
            'message': 'Payment verified successfully',
            'payment_id': razorpay_payment_id
        }


class StockService:
    """Service layer for stock validation."""
    
    @staticmethod
    def validate_stock(items):
        """
        Validate stock availability for items.
        
        Args:
            items: List of dicts with product_id, quantity
            
        Returns:
            Tuple (is_valid, out_of_stock_list)
        """
        out_of_stock = []
        
        for item in items:
            try:
                product = Product.objects.get(id=item['product_id'])
                qty = item.get('quantity', 1)
                if product.stock < qty:
                    out_of_stock.append({
                        'name': product.name,
                        'available': product.stock,
                        'requested': qty
                    })
            except Product.DoesNotExist:
                out_of_stock.append({
                    'name': f"Product #{item['product_id']}",
                    'available': 0,
                    'requested': item.get('quantity', 1)
                })
        
        return len(out_of_stock) == 0, out_of_stock