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
    """Populate snapshot columns for historical rows from the live product.

    NOTE: inside SeparateDatabaseAndState the `apps` argument reflects the OLD
    state, so the newly added snapshot columns are NOT visible on the historical
    OrderItem model. Use raw SQL against the real table instead.
    """
    connection = schema_editor.connection

    with connection.cursor() as cursor:
        # 1) Prefer the variant's SKU where a variant was purchased.
        cursor.execute("""
            UPDATE orders_orderitem AS oi
            SET sku = pv.sku
            FROM products_productvariant AS pv
            WHERE pv.id = oi.variant_ref_id
              AND oi.sku IS NULL
              AND pv.sku IS NOT NULL
              AND pv.sku <> ''
        """)

        # 2) Fill everything else from the product, never overwriting a value
        #    that was already captured at order time.
        cursor.execute("""
            UPDATE orders_orderitem AS oi
            SET
                product_name = COALESCE(oi.product_name, p.name),
                hsn_code     = COALESCE(oi.hsn_code, p.hsn_code),
                tax_rate     = COALESCE(oi.tax_rate, p.tax_rate),
                unit         = COALESCE(oi.unit, p.unit),
                sku          = COALESCE(oi.sku, p.sku)
            FROM products_product AS p
            WHERE oi.product_id = p.id
              AND (
                    oi.product_name IS NULL
                 OR oi.hsn_code   IS NULL
                 OR oi.tax_rate   IS NULL
                 OR oi.unit       IS NULL
                 OR oi.sku        IS NULL
              )
        """)


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
