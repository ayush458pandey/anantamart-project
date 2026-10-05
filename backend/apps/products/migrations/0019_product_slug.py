# Generated manually to add SEO-friendly slug to Product
#
# This migration is written to be idempotent because a previous deploy may have
# partially applied it. It uses SeparateDatabaseAndState so the database changes
# are guarded with existence checks while Django's migration state still records
# the final field definition.

from django.db import migrations, models, connection
from django.utils.text import slugify


def add_slug_column_if_not_exists(apps, schema_editor):
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_name='products_product' AND column_name='slug'"
        )
        if not cursor.fetchone():
            schema_editor.execute(
                "ALTER TABLE products_product ADD COLUMN slug varchar(280) NOT NULL DEFAULT ''"
            )


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


def create_unique_slug_index_if_not_exists(apps, schema_editor):
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT indexname FROM pg_indexes "
            "WHERE tablename='products_product' AND indexname='products_product_slug_uniq'"
        )
        if not cursor.fetchone():
            schema_editor.execute(
                "CREATE UNIQUE INDEX products_product_slug_uniq ON products_product (slug)"
            )


class Migration(migrations.Migration):

    dependencies = [
        ('products', '0018_producttag_image'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunPython(add_slug_column_if_not_exists, migrations.RunPython.noop),
                migrations.RunPython(backfill_product_slugs, migrations.RunPython.noop),
                migrations.RunPython(create_unique_slug_index_if_not_exists, migrations.RunPython.noop),
            ],
            state_operations=[
                migrations.AddField(
                    model_name='product',
                    name='slug',
                    field=models.SlugField(blank=True, max_length=280, unique=True),
                ),
            ],
        ),
    ]

