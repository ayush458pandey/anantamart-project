from django.db import migrations, models

class Migration(migrations.Migration):

    dependencies = [
        ('products', '0013_product_available_colors'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql='ALTER TABLE "products_category" ADD COLUMN IF NOT EXISTS "short_name" varchar(50) DEFAULT \'\' NOT NULL;',
                    reverse_sql='ALTER TABLE "products_category" DROP COLUMN IF EXISTS "short_name";'
                ),
            ],
            state_operations=[
                migrations.AddField(
                    model_name='category',
                    name='short_name',
                    field=models.CharField(blank=True, default='', help_text="Short display name for mobile (e.g. 'Hotel & Kitchen'). Falls back to full name if blank.", max_length=50),
                ),
            ]
        ),
    ]
