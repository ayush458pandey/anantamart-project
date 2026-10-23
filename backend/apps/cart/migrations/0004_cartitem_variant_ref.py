# Adds a nullable FK from CartItem to ProductVariant so cart lines can be
# priced and stock-validated against the exact variant selected.

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('cart', '0003_alter_cartitem_unique_together_cartitem_variant_and_more'),
        ('products', '0020_productvariant'),
    ]

    operations = [
        migrations.AddField(
            model_name='cartitem',
            name='variant_ref',
            field=models.ForeignKey(
                blank=True,
                help_text='The exact ProductVariant selected (when applicable)',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='cart_items',
                to='products.productvariant',
            ),
        ),
        migrations.AlterField(
            model_name='cartitem',
            name='variant',
            field=models.CharField(blank=True, help_text="Selected variant label, e.g. 'Size: 10\"'", max_length=100),
        ),
    ]
