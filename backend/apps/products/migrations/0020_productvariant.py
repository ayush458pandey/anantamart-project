# Generated to add purchasable ProductVariant (size / colour / etc.)
#
# Written idempotently: an earlier partial deploy may have already created the
# table (which then blocked a plain CreateModel with "relation already exists").
# SeparateDatabaseAndState lets us guard the real DDL while Django's migration
# state still records the final model definition.

import django.db.models.deletion
from django.apps import apps as global_apps
from django.db import migrations, models


def create_variant_table_if_missing(apps, schema_editor):
    """Create products_productvariant only when it does not already exist.

    NOTE: inside SeparateDatabaseAndState the `apps` argument reflects the OLD
    state (before this migration), so ProductVariant is not visible there. Use
    the real app registry instead.
    """
    ProductVariant = global_apps.get_model('products', 'ProductVariant')
    table = ProductVariant._meta.db_table
    connection = schema_editor.connection

    if table not in connection.introspection.table_names():
        schema_editor.create_model(ProductVariant)
        return

    # Table already exists — make sure the unique constraint is present too, in
    # case a previous partial run created the table without it.
    with connection.cursor() as cursor:
        constraints = connection.introspection.get_constraints(cursor, table)
    expected_cols = {'product_id', 'variant_type', 'name'}
    has_unique = any(
        c.get('unique') and set(c.get('columns') or []) == expected_cols
        for c in constraints.values()
    )
    if not has_unique:
        schema_editor.execute(
            'ALTER TABLE products_productvariant '
            'ADD CONSTRAINT products_productvariant_product_type_name_uniq '
            'UNIQUE (product_id, variant_type, name)'
        )


class Migration(migrations.Migration):

    dependencies = [
        ('products', '0019_product_slug'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunPython(
                    create_variant_table_if_missing,
                    migrations.RunPython.noop,
                ),
            ],
            state_operations=[
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
            ],
        ),
    ]
