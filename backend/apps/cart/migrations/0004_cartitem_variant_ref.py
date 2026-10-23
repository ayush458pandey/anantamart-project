# Adds a nullable FK from CartItem to ProductVariant so cart lines can be
# priced and stock-validated against the exact variant selected.
#
# Idempotent: an earlier partial deploy (or the entrypoint's `migrate cart --fake`)
# may have already added the column, so each operation is guarded.

import django.db.models.deletion
from django.db import migrations, models


def add_variant_ref_if_missing(apps, schema_editor):
    """Add cart_cartitem.variant_ref + its FK constraint when absent."""
    table = 'cart_cartitem'
    with schema_editor.connection.cursor() as cursor:
        columns = [
            c.name for c in
            schema_editor.connection.introspection.get_table_description(cursor, table)
        ]
    if 'variant_ref_id' not in columns:
        schema_editor.execute(
            'ALTER TABLE cart_cartitem ADD COLUMN variant_ref_id bigint NULL'
        )

    # Ensure the FK constraint exists (added separately so it is also guarded).
    with schema_editor.connection.cursor() as cursor:
        constraints = schema_editor.connection.introspection.get_constraints(cursor, table)
    if not any(
        c.get('foreign_key') and c.get('columns') == ['variant_ref_id']
        for c in constraints.values()
    ):
        schema_editor.execute(
            'ALTER TABLE cart_cartitem '
            'ADD CONSTRAINT cart_cartitem_variant_ref_id_fk '
            'FOREIGN KEY (variant_ref_id) REFERENCES products_productvariant (id) '
            'DEFERRABLE INITIALLY DEFERRED'
        )


class Migration(migrations.Migration):

    dependencies = [
        ('cart', '0003_alter_cartitem_unique_together_cartitem_variant_and_more'),
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
                    model_name='cartitem',
                    name='variant_ref',
                    field=models.ForeignKey(
                        blank=True,
                        help_text='The exact ProductVariant selected (when applicable)',
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name='cart_items',
                        to='products.productvariant',
                    ),
                ),
                migrations.AlterField(
                    model_name='cartitem',
                    name='variant',
                    field=models.CharField(blank=True, help_text="Selected variant label, e.g. 'Size: 10\"'", max_length=100),
                ),
            ],
        ),
    ]
