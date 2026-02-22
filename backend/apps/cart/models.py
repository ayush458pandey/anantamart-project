from django.db import models
from apps.products.models import Product


class Cart(models.Model):
    session_key = models.CharField(max_length=40, unique=True, null=True, blank=True)
    user = models.ForeignKey('auth.User', on_delete=models.CASCADE, null=True, blank=True, related_name='carts')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        if self.user:
            return f"Cart for {self.user.username}"
        return f"Cart {self.session_key}"


class CartItem(models.Model):
    cart = models.ForeignKey(Cart, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    variant = models.CharField(max_length=100, blank=True, help_text="Selected variant (e.g. Color)")
    quantity = models.PositiveIntegerField(default=1)
    
    class Meta:
        unique_together = ('cart', 'product', 'variant')
    
    @property
    def total_price(self):
        from decimal import Decimal
        tax_rate = self.product.tax_rate or Decimal('18')
        inclusive_unit = self.product.base_price * (1 + tax_rate / 100)
        return round(inclusive_unit * self.quantity, 2)
    
    def __str__(self):
        if self.variant:
            return f"{self.quantity}x {self.product.name} ({self.variant})"
        return f"{self.quantity}x {self.product.name}"
