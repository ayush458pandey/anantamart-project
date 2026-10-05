# Generated manually to add SEO-friendly slug to Product

from django.db import migrations, models
from django.utils.text import slugify


def backfill_product_slugs(apps, schema_editor):
    Product = apps.get_model('products', 'Product')
    seen = set()
    for product in Product.objects.all().order_by('id'):
        base_slug = slugify(product.name)[:250] or 'product'
        slug = base_slug
        counter = 1
        while slug in seen or Product.objects.filter(slug=slug).exclude(pk=product.pk).exists():
            counter += 1
            slug = f"{base_slug}-{counter}"
        seen.add(slug)
        product.slug = slug
        product.save(update_fields=['slug'])


class Migration(migrations.Migration):

    dependencies = [
        ('products', '0018_producttag_image'),
    ]

    operations = [
        # 1. Add the field without the unique constraint so existing rows can be backfilled
        migrations.AddField(
            model_name='product',
            name='slug',
            field=models.SlugField(blank=True, db_index=True, max_length=280),
        ),
        # 2. Populate slugs for existing products
        migrations.RunPython(backfill_product_slugs, migrations.RunPython.noop),
        # 3. Enforce uniqueness now that all rows have a slug
        migrations.AlterField(
            model_name='product',
            name='slug',
            field=models.SlugField(blank=True, db_index=True, max_length=280, unique=True),
        ),
    ]
