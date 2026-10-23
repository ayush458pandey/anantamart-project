# Repair migration.
#
# The production entrypoint previously ran `migrate cart --fake`, which marked
# 0004_cartitem_variant_ref as applied WITHOUT creating the column. This
# DB-only migration guarantees the column + FK actually exist, and is a no-op
# when they already do (e.g. fresh databases where 0004 ran for real).

from django.db import migrations


def ensure_variant_ref_column(apps, schema_editor):
    table = 'cart_cartitem'
    connection = schema_editor.connection

    with connection.cursor() as cursor:
        columns = [
            c.name for c in
            connection.introspection.get_table_description(cursor, table)
        ]
    if 'variant_ref_id' not in columns:
        schema_editor.execute(
            'ALTER TABLE cart_cartitem ADD COLUMN variant_ref_id bigint NULL'
        )

    with connection.cursor() as cursor:
        constraints = connection.introspection.get_constraints(cursor, table)
    has_fk = any(
        c.get('foreign_key') and c.get('columns') == ['variant_ref_id']
        for c in constraints.values()
    )
    if not has_fk:
        schema_editor.execute(
            'ALTER TABLE cart_cartitem '
            'ADD CONSTRAINT cart_cartitem_variant_ref_id_fk '
            'FOREIGN KEY (variant_ref_id) REFERENCES products_productvariant (id) '
            'DEFERRABLE INITIALLY DEFERRED'
        )


class Migration(migrations.Migration):

    dependencies = [
        ('cart', '0004_cartitem_variant_ref'),
        ('products', '0020_productvariant'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunPython(ensure_variant_ref_column, migrations.RunPython.noop),
            ],
            state_operations=[],
        ),
    ]
