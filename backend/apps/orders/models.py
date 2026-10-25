from django.db import models
from django.contrib.auth.models import User
from apps.products.models import Product

class Order(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('confirmed', 'Confirmed'),
        ('packed', 'Packed'),
        ('shipped', 'Shipped'),
        ('delivered', 'Delivered'),
        ('cancelled', 'Cancelled'),
    ]
    
    PAYMENT_CHOICES = [
        ('credit-terms', 'Credit Terms'),
        ('upi', 'UPI Payment'),
        ('card', 'Credit/Debit Card'),
        ('netbanking', 'Net Banking'),
        ('lc', 'Letter of Credit'),
        ('advance', 'Advance Payment'),
    ]
    
    PAYMENT_STATUS_CHOICES = [
        ('Pending', 'Pending'),
        ('Paid', 'Paid'),
        ('Failed', 'Failed'),
    ]
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='orders')
    order_number = models.CharField(max_length=50, unique=True)
    idempotency_key = models.CharField(
        max_length=64, null=True, blank=True, unique=True, db_index=True,
        help_text="Client-generated key to prevent duplicate orders on retry"
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    
    # Pricing
    subtotal = models.DecimalField(max_digits=10, decimal_places=2)
    discount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    cgst = models.DecimalField(max_digits=10, decimal_places=2)
    sgst = models.DecimalField(max_digits=10, decimal_places=2)
    delivery_charges = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=10, decimal_places=2)
    
    # Delivery
    delivery_address = models.TextField()
    delivery_option = models.CharField(max_length=50)
    scheduled_date = models.DateField(null=True, blank=True)
    
    # Payment
    payment_method = models.CharField(max_length=50, choices=PAYMENT_CHOICES)
    payment_status = models.CharField(max_length=20, choices=PAYMENT_STATUS_CHOICES, default='Pending')
    transaction_id = models.CharField(max_length=255, null=True, blank=True)  # 🆕 NEW FIELD
    
    # Tracking
    tracking_number = models.CharField(max_length=100, blank=True)
    courier_partner = models.CharField(max_length=100, blank=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    confirmed_at = models.DateTimeField(null=True, blank=True)
    packed_at = models.DateTimeField(null=True, blank=True)
    shipped_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['status']),
            models.Index(fields=['payment_status']),
            models.Index(fields=['order_number']),
        ]
    
    def __str__(self):
        return f"Order {self.order_number}"

class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    variant = models.CharField(max_length=100, blank=True, null=True, help_text="Selected variant label, e.g. 'Size: 10\"'")
    variant_ref = models.ForeignKey(
        'products.ProductVariant', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='order_items',
        help_text="The exact ProductVariant purchased (when applicable)"
    )
    quantity = models.PositiveIntegerField()
    price = models.DecimalField(max_digits=10, decimal_places=2)
    total = models.DecimalField(max_digits=10, decimal_places=2)

    # --- Immutable snapshots (GST compliance) ---
    # Frozen copies captured at order time so later edits to the product/variant
    # never change a previously issued invoice or GST return.
    sku = models.CharField(max_length=120, blank=True, null=True, help_text="SKU at time of purchase")
    product_name = models.CharField(max_length=255, blank=True, null=True, help_text="Product name at time of purchase")
    hsn_code = models.CharField(max_length=20, blank=True, null=True, help_text="HSN/SAC at time of purchase")
    tax_rate = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True,
        help_text="GST rate (%) at time of purchase"
    )
    unit = models.CharField(max_length=50, blank=True, null=True, help_text="Unit label at time of purchase")

    @property
    def display_name(self):
        """Name as it should appear on an invoice (falls back to the live product)."""
        name = self.product_name or (self.product.name if self.product else '')
        return f"{name} ({self.variant})" if self.variant else name

    @property
    def effective_sku(self):
        return self.sku or (self.product.sku if self.product else '')

    @property
    def effective_hsn_code(self):
        return self.hsn_code or (self.product.hsn_code if self.product else '')

    @property
    def effective_tax_rate(self):
        if self.tax_rate is not None:
            return self.tax_rate
        if self.product:
            return self.product.tax_rate
        return None

    def __str__(self):
        if self.variant:
            return f"{self.quantity}x {self.product.name} ({self.variant})"
        return f"{self.quantity}x {self.product.name}"