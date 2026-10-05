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
    # NOTE: Use raw SQL here. Inside SeparateDatabaseAndState the database
    # operations run against the *old* model state, so the ORM cannot see the
    # newly added 'slug' field yet.
    with connection.cursor() as cursor:
        cursor.execute("SELECT id, name FROM products_product ORDER BY id")
        rows = cursor.fetchall()

        seen = set()
        for product_id, name in rows:
            base_slug = slugify(name or '')[:250] or 'product'
            slug = base_slug
            counter = 1
            while slug in seen:
                counter += 1
                slug = f"{base_slug}-{counter}"
            seen.add(slug)
            cursor.execute(
                "UPDATE products_product SET slug = %s WHERE id = %s",
                [slug, product_id],
            )


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

