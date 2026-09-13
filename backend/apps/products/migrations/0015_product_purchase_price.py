from django.db import migrations, models

class Migration(migrations.Migration):

    dependencies = [
        ('products', '0014_category_short_name'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql='ALTER TABLE "products_product" ADD COLUMN IF NOT EXISTS "purchase_price" numeric(10, 2) NULL;',
                    reverse_sql='ALTER TABLE "products_product" DROP COLUMN IF EXISTS "purchase_price";'
                ),
            ],
            state_operations=[
                migrations.AddField(
                    model_name='product',
                    name='purchase_price',
                    field=models.DecimalField(blank=True, decimal_places=2, help_text='Cost/wholesale price paid to supplier (internal only, not shown to customers)', max_digits=10, null=True),
                ),
            ]
        ),
    ]
