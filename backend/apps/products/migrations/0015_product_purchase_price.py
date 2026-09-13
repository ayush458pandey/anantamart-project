from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('products', '0014_category_short_name'),
    ]

    operations = [
        migrations.AddField(
            model_name='product',
            name='purchase_price',
            field=models.DecimalField(blank=True, decimal_places=2, help_text='Cost/wholesale price paid to supplier (internal only, not shown to customers)', max_digits=10, null=True),
        ),
    ]
