# Adds a variant reference + widens the variant label on OrderItem so the exact
# ProductVariant (size / colour) that was purchased is recorded on the order.
#
# Idempotent: guards against the column/constraint already existing from an
# earlier partial deploy.

import django.db.models.deletion
from django.db import migrations, models


def add_variant_ref_if_missing(apps, schema_editor):
    """Add orders_orderitem.variant_ref + FK constraint, and widen `variant`."""
    table = 'orders_orderitem'
    with schema_editor.connection.cursor() as cursor:
        columns = [
            c.name for c in
            schema_editor.connection.introspection.get_table_description(cursor, table)
        ]
    if 'variant_ref_id' not in columns:
        schema_editor.execute(
            'ALTER TABLE orders_orderitem ADD COLUMN variant_ref_id bigint NULL'
        )

    with schema_editor.connection.cursor() as cursor:
        constraints = schema_editor.connection.introspection.get_constraints(cursor, table)
    if not any(
        c.get('foreign_key') and c.get('columns') == ['variant_ref_id']
        for c in constraints.values()
    ):
        schema_editor.execute(
            'ALTER TABLE orders_orderitem '
            'ADD CONSTRAINT orders_orderitem_variant_ref_id_fk '
            'FOREIGN KEY (variant_ref_id) REFERENCES products_productvariant (id) '
            'DEFERRABLE INITIALLY DEFERRED'
        )

    # Widen the variant label to 100 chars (was 50) so "Size: 10\", Colour: Red"
    # labels are never truncated. Harmless when already wider.
    schema_editor.execute(
        'ALTER TABLE orders_orderitem ALTER COLUMN variant TYPE varchar(100)'
    )


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0005_order_idempotency_key_order_indexes'),
        ('products', '0020_productvariant'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunPython(
                    add_variant_ref_if_missing,
                    migrations.RunPython.noop,
                ),
            ],
            state_operations=[
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
            ],
        ),
    ]
