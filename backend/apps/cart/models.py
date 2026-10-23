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
    # `variant` stores a label like 'Size: 10"' or 'Colour: Red' (empty for no variant).
    # `variant_ref` links to the ProductVariant row when one exists, so we can price
    # and validate stock against the exact variant that was selected.
    variant = models.CharField(max_length=100, blank=True, help_text="Selected variant label, e.g. 'Size: 10\"'")
    variant_ref = models.ForeignKey(
        'products.ProductVariant', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='cart_items',
        help_text="The exact ProductVariant selected (when applicable)"
    )
    quantity = models.PositiveIntegerField(default=1)
    
    class Meta:
        unique_together = ('cart', 'product', 'variant')
    
    @property
    def unit_price(self):
        """Price per unit — uses the variant price when a variant is selected."""
        if self.variant_ref_id and self.variant_ref:
            return self.variant_ref.effective_base_price
        return self.product.base_price
    
    @property
    def total_price(self):
        return self.unit_price * self.quantity
    
    def __str__(self):
        if self.variant:
            return f"{self.quantity}x {self.product.name} ({self.variant})"
        return f"{self.quantity}x {self.product.name}"
