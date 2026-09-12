from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('products', '0013_product_available_colors'),
    ]

    operations = [
        migrations.AddField(
            model_name='category',
            name='short_name',
            field=models.CharField(blank=True, help_text="Short display name for mobile (e.g. 'Hotel & Kitchen'). Falls back to full name if blank.", max_length=50),
        ),
    ]
