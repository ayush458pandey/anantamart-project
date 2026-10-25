# Adds immutable GST snapshot columns to OrderItem so that later edits to a
# product's HSN / tax slab / name never alter a previously issued invoice.
#
# Idempotent and additive: each column is added only when missing, and existing
# rows are backfilled from the live product so historical invoices keep working.

from django.db import migrations, models


NEW_COLUMNS = {
    'sku': "varchar(120) NULL",
    'product_name': "varchar(255) NULL",
    'hsn_code': "varchar(20) NULL",
    'tax_rate': 'numeric(5, 2) NULL',
    'unit': "varchar(50) NULL",
}


def add_snapshot_columns(apps, schema_editor):
    table = 'orders_orderitem'
    connection = schema_editor.connection

    with connection.cursor() as cursor:
        existing = {
            c.name for c in
            connection.introspection.get_table_description(cursor, table)
        }

    for column, definition in NEW_COLUMNS.items():
        if column not in existing:
            schema_editor.execute(
                f'ALTER TABLE {table} ADD COLUMN "{column}" {definition}'
            )


def backfill_snapshots(apps, schema_editor):
    """Populate snapshot columns for historical rows from the live product."""
    OrderItem = apps.get_model('orders', 'OrderItem')
    ProductVariant = apps.get_model('products', 'ProductVariant')

    variant_skus = {
        v.id: v.sku
        for v in ProductVariant.objects.exclude(sku='').only('id', 'sku')
    }

    for item in OrderItem.objects.select_related('product').iterator():
        product = item.product
        if product is None:
            continue
        updates = []
        if not item.product_name:
            item.product_name = product.name
            updates.append('product_name')
        if not item.hsn_code:
            item.hsn_code = product.hsn_code
            updates.append('hsn_code')
        if item.tax_rate is None:
            item.tax_rate = product.tax_rate
            updates.append('tax_rate')
        if not item.unit:
            item.unit = product.unit
            updates.append('unit')
        if not item.sku:
            item.sku = (
                variant_skus.get(item.variant_ref_id) or product.sku
            )
            updates.append('sku')
        if updates:
            item.save(update_fields=updates)


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0006_orderitem_variant_ref'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunPython(add_snapshot_columns, migrations.RunPython.noop),
                migrations.RunPython(backfill_snapshots, migrations.RunPython.noop),
            ],
            state_operations=[
                migrations.AddField(
                    model_name='orderitem',
                    name='sku',
                    field=models.CharField(
                        blank=True, help_text='SKU at time of purchase',
                        max_length=120, null=True,
                    ),
                ),
                migrations.AddField(
                    model_name='orderitem',
                    name='product_name',
                    field=models.CharField(
                        blank=True, help_text='Product name at time of purchase',
                        max_length=255, null=True,
                    ),
                ),
                migrations.AddField(
                    model_name='orderitem',
                    name='hsn_code',
                    field=models.CharField(
                        blank=True, help_text='HSN/SAC at time of purchase',
                        max_length=20, null=True,
                    ),
                ),
                migrations.AddField(
                    model_name='orderitem',
                    name='tax_rate',
                    field=models.DecimalField(
                        blank=True, decimal_places=2,
                        help_text='GST rate (%) at time of purchase',
                        max_digits=5, null=True,
                    ),
                ),
                migrations.AddField(
                    model_name='orderitem',
                    name='unit',
                    field=models.CharField(
                        blank=True, help_text='Unit label at time of purchase',
                        max_length=50, null=True,
                    ),
                ),
            ],
        ),
    ]
