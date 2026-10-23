# Generated to add purchasable ProductVariant (size / colour / etc.)
# This is a brand-new table, so a standard CreateModel is safe and trackable.

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('products', '0019_product_slug'),
    ]

    operations = [
        migrations.CreateModel(
            name='ProductVariant',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('variant_type', models.CharField(blank=True, default='Size', help_text="Dimension this option belongs to, e.g. 'Size' or 'Colour'", max_length=50)),
                ('name', models.CharField(help_text="Option label, e.g. '10\"' or 'Red'", max_length=100)),
                ('sku', models.CharField(blank=True, default='', help_text='Optional variant-level SKU (falls back to parent SKU)', max_length=120)),
                ('base_price', models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True)),
                ('mrp', models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True)),
                ('stock', models.PositiveIntegerField(default=0)),
                ('stock_status', models.CharField(choices=[('in-stock', 'In Stock'), ('low-stock', 'Low Stock'), ('out-of-stock', 'Out of Stock')], default='in-stock', max_length=20)),
                ('moq', models.PositiveIntegerField(default=1, help_text='Minimum Order Quantity')),
                ('case_size', models.PositiveIntegerField(default=1, help_text='Units per case')),
                ('image', models.ImageField(blank=True, help_text='Variant-specific image (falls back to parent product image)', null=True, upload_to='variants/')),
                ('hex_color', models.CharField(blank=True, default='', help_text='Optional colour hex for swatches, e.g. #FF0000', max_length=20)),
                ('sort_order', models.PositiveIntegerField(default=0)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('product', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='variants', to='products.product')),
            ],
            options={
                'verbose_name': 'Product Variant',
                'verbose_name_plural': 'Product Variants',
                'ordering': ['variant_type', 'sort_order', 'id'],
                'unique_together': {('product', 'variant_type', 'name')},
            },
        ),
    ]
