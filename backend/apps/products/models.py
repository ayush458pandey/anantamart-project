from django.db import models
from django.utils.text import slugify
from decimal import Decimal

class Category(models.Model):
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    # Changed from CharField to ImageField
    image = models.ImageField(upload_to='categories/', null=True, blank=True, help_text="Category Image")
    icon = models.CharField(max_length=50, blank=True, help_text="Icon name (optional)")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name_plural = 'Categories'
        ordering = ['name']
    
    def __str__(self):
        return self.name

class Subcategory(models.Model):
    name = models.CharField(max_length=100)
    category = models.ForeignKey(Category, on_delete=models.CASCADE, related_name='subcategories')
    description = models.TextField(blank=True)
    image = models.ImageField(upload_to='subcategories/', null=True, blank=True, help_text="Subcategory icon/image")
    icon_name = models.CharField(max_length=50, blank=True, help_text="Fallback icon name")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name_plural = 'Subcategories'
        ordering = ['name']
        unique_together = ['category', 'name']
    
    def __str__(self):
        return f"{self.category.name} - {self.name}"

class Brand(models.Model):
    name = models.CharField(max_length=100, unique=True)
    slug = models.SlugField(max_length=100, unique=True, blank=True)
    logo = models.ImageField(upload_to='brands/', null=True, blank=True, help_text="Brand logo")
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['name']
    
    def __str__(self):
        return self.name
    
    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

class Product(models.Model):
    STOCK_STATUS_CHOICES = [
        ('in-stock', 'In Stock'),
        ('low-stock', 'Low Stock'),
        ('out-of-stock', 'Out of Stock'),
    ]

    TAX_SLAB_CHOICES = [
        (Decimal('0.00'), '0% (Exempt)'),
        (Decimal('5.00'), '5% (Essentials)'),
        (Decimal('18.00'), '18% (Standard)'),
        (Decimal('40.00'), '40% (Luxury/Demerit)'),
    ]
    
    name = models.CharField(max_length=255)
    sku = models.CharField(max_length=100, unique=True)
    category = models.ForeignKey(Category, on_delete=models.CASCADE, related_name='products')
    subcategory = models.ForeignKey(Subcategory, on_delete=models.SET_NULL, related_name='products', null=True, blank=True)
    description = models.TextField()
    
    brand = models.CharField(max_length=100, default='Generic', blank=True)
    brand_ref = models.ForeignKey(Brand, on_delete=models.SET_NULL, related_name='products', null=True, blank=True, verbose_name="Brand")
    product_type = models.CharField(max_length=100, default='Standard', blank=True)
    key_features = models.TextField(blank=True, help_text="One feature per line")
    ingredients = models.TextField(blank=True)
    packaging_type = models.CharField(max_length=100, blank=True)
    dietary_preference = models.CharField(max_length=50, blank=True, help_text="Veg/Non-Veg/Vegan")
    storage_instruction = models.TextField(blank=True)
    usage_recommendation = models.TextField(blank=True)
    unit = models.CharField(max_length=50, default='1 pack', blank=True)
    weight = models.CharField(max_length=50, blank=True, help_text="e.g., 500 ml, 1 kg")
    
    image = models.ImageField(upload_to='products/', null=True, blank=True)
    
    # --- UPDATED: MRP IS NOW OPTIONAL ---
    mrp = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    # ------------------------------------

    base_price = models.DecimalField(max_digits=10, decimal_places=2)
    
    tax_rate = models.DecimalField(
        max_digits=5, 
        decimal_places=2, 
        choices=TAX_SLAB_CHOICES, 
        default=Decimal('18.00'), 
        help_text="Select applicable GST Slab"
    )
    
    stock = models.PositiveIntegerField(default=0)
    stock_status = models.CharField(max_length=20, choices=STOCK_STATUS_CHOICES, default='in-stock')
    
    moq = models.PositiveIntegerField(default=1, help_text="Minimum Order Quantity")
    case_size = models.PositiveIntegerField(default=1, help_text="Units per case")
    
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return self.name
    
    @property
    def discount_percentage(self):
        if self.mrp and self.mrp > 0:
            return round(((self.mrp - self.base_price) / self.mrp) * 100)
        return 0

class ProductImage(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='images')
    image = models.ImageField(upload_to='products/gallery/')
    order = models.PositiveIntegerField(default=0, help_text="Display order")
    is_primary = models.BooleanField(default=False, help_text="Main product image")
    alt_text = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['order', 'created_at']
        verbose_name = 'Product Image'
        verbose_name_plural = 'Product Images'
    
    def __str__(self):
        return f"Image {self.order} for {self.product.name}"
    
    def save(self, *args, **kwargs):
        if self.is_primary:
            ProductImage.objects.filter(product=self.product, is_primary=True).exclude(id=self.id).update(is_primary=False)
        super().save(*args, **kwargs)

class PriceTier(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='tiers')
    min_quantity = models.PositiveIntegerField()
    max_quantity = models.PositiveIntegerField(null=True, blank=True)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    
    class Meta:
        ordering = ['min_quantity']
        verbose_name = 'Price Tier'
        verbose_name_plural = 'Price Tiers'
    
    def __str__(self):
        if self.max_quantity:
            return f"{self.min_quantity}-{self.max_quantity} units: ₹{self.price}"
        return f"{self.min_quantity}+ units: ₹{self.price}"