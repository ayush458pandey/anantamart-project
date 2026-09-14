from django.db import migrations, models
import django.db.models.deletion


def make_group_nullable_and_add_subcategories(apps, schema_editor):
    """Make ProductTag.group nullable, add subcategories M2M, make slug unique."""
    connection = schema_editor.connection
    existing_tables = set(connection.introspection.table_names())
    
    with connection.cursor() as cursor:
        # 1. Make group_id nullable if it isn't already
        cursor.execute('''
            ALTER TABLE "products_producttag" 
            ALTER COLUMN "group_id" DROP NOT NULL
        ''')
        # Change ON DELETE to SET NULL (drop old FK, add new one)
        # First find and drop the old FK constraint
        cursor.execute('''
            SELECT conname FROM pg_constraint 
            WHERE conrelid = 'products_producttag'::regclass 
            AND contype = 'f' 
            AND conkey = (SELECT array_agg(attnum) FROM pg_attribute WHERE attrelid = 'products_producttag'::regclass AND attname = 'group_id')
        ''')
        fk_rows = cursor.fetchall()
        for row in fk_rows:
            cursor.execute(f'ALTER TABLE "products_producttag" DROP CONSTRAINT IF EXISTS "{row[0]}"')
        
        cursor.execute('''
            ALTER TABLE "products_producttag" 
            ADD CONSTRAINT "products_producttag_group_id_fk" 
            FOREIGN KEY ("group_id") REFERENCES "products_taggroup" ("id") 
            ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED
        ''')
        
        # 2. Create subcategories M2M table if not exists
        if 'products_producttag_subcategories' not in existing_tables:
            cursor.execute('''
                CREATE TABLE "products_producttag_subcategories" (
                    "id" bigserial NOT NULL PRIMARY KEY,
                    "producttag_id" bigint NOT NULL REFERENCES "products_producttag" ("id") DEFERRABLE INITIALLY DEFERRED,
                    "subcategory_id" bigint NOT NULL REFERENCES "products_subcategory" ("id") DEFERRABLE INITIALLY DEFERRED,
                    UNIQUE ("producttag_id", "subcategory_id")
                )
            ''')
        
        # 3. Drop old unique_together constraint if it exists
        cursor.execute('''
            SELECT conname FROM pg_constraint 
            WHERE conrelid = 'products_producttag'::regclass 
            AND contype = 'u'
        ''')
        for row in cursor.fetchall():
            cursor.execute(f'ALTER TABLE "products_producttag" DROP CONSTRAINT IF EXISTS "{row[0]}"')
        
        # 4. Make slug unique (add unique constraint if not exists)
        cursor.execute('''
            SELECT 1 FROM pg_indexes 
            WHERE tablename = 'products_producttag' 
            AND indexdef LIKE '%UNIQUE%' 
            AND indexdef LIKE '%slug%'
            AND indexdef NOT LIKE '%group_id%'
        ''')
        if not cursor.fetchone():
            cursor.execute('''
                ALTER TABLE "products_producttag" 
                ADD CONSTRAINT "products_producttag_slug_unique" UNIQUE ("slug")
            ''')


class Migration(migrations.Migration):

    dependencies = [
        ('products', '0016_taggroup_producttag_product_tags'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunPython(make_group_nullable_and_add_subcategories, migrations.RunPython.noop),
            ],
            state_operations=[
                # 1. Make group optional (nullable)
                migrations.AlterField(
                    model_name='producttag',
                    name='group',
                    field=models.ForeignKey(
                        blank=True, null=True,
                        help_text='Optional grouping for sidebar display',
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name='tags',
                        to='products.taggroup',
                    ),
                ),
                # 2. Add subcategories M2M
                migrations.AddField(
                    model_name='producttag',
                    name='subcategories',
                    field=models.ManyToManyField(
                        blank=True,
                        help_text='Which subcategories this tag applies to. Leave empty for all in the category.',
                        related_name='tag_options',
                        to='products.subcategory',
                    ),
                ),
                # 3. Make slug unique
                migrations.AlterField(
                    model_name='producttag',
                    name='slug',
                    field=models.SlugField(max_length=100, unique=True, blank=True),
                ),
                # 4. Remove old unique_together
                migrations.AlterUniqueTogether(
                    name='producttag',
                    unique_together=set(),
                ),
            ],
        ),
    ]
