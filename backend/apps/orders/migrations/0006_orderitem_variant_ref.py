# Adds a variant reference + widens the variant label on OrderItem so the exact
# ProductVariant (size / colour) that was purchased is recorded on the order.

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0005_order_idempotency_key_order_indexes'),
        ('products', '0020_productvariant'),
    ]

    operations = [
        migrations.AddField(
            model_name='orderitem',
            name='variant_ref',
            field=models.ForeignKey(
                blank=True,
                help_text='The exact ProductVariant purchased (when applicable)',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='order_items',
                to='products.productvariant',
            ),
        ),
        migrations.AlterField(
            model_name='orderitem',
            name='variant',
            field=models.CharField(blank=True, help_text="Selected variant label, e.g. 'Size: 10\"'", max_length=100, null=True),
        ),
    ]
