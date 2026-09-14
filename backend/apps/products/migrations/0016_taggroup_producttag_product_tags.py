from django.db import migrations, models
import django.db.models.deletion


def create_tables_if_not_exist(apps, schema_editor):
    """Create TagGroup, ProductTag tables and Product.tags M2M only if they don't exist."""
    connection = schema_editor.connection
    
    # Check which tables already exist
    existing_tables = set(connection.introspection.table_names())
    
    with connection.cursor() as cursor:
        # 1. Create TagGroup table if not exists
        if 'products_taggroup' not in existing_tables:
            cursor.execute('''
                CREATE TABLE "products_taggroup" (
                    "id" bigserial NOT NULL PRIMARY KEY,
                    "name" varchar(100) NOT NULL,
                    "slug" varchar(100) NOT NULL UNIQUE,
                    "display_order" integer NOT NULL DEFAULT 0 CHECK ("display_order" >= 0),
                    "is_active" boolean NOT NULL DEFAULT true,
                    "created_at" timestamp with time zone NOT NULL DEFAULT NOW()
                )
            ''')
        
        # 2. Create TagGroup-Category M2M table if not exists
        if 'products_taggroup_categories' not in existing_tables:
            cursor.execute('''
                CREATE TABLE "products_taggroup_categories" (
                    "id" bigserial NOT NULL PRIMARY KEY,
                    "taggroup_id" bigint NOT NULL REFERENCES "products_taggroup" ("id") DEFERRABLE INITIALLY DEFERRED,
                    "category_id" bigint NOT NULL REFERENCES "products_category" ("id") DEFERRABLE INITIALLY DEFERRED,
                    UNIQUE ("taggroup_id", "category_id")
                )
            ''')
        
        # 3. Create ProductTag table if not exists
        if 'products_producttag' not in existing_tables:
            cursor.execute('''
                CREATE TABLE "products_producttag" (
                    "id" bigserial NOT NULL PRIMARY KEY,
                    "name" varchar(100) NOT NULL,
                    "slug" varchar(100) NOT NULL,
                    "display_order" integer NOT NULL DEFAULT 0 CHECK ("display_order" >= 0),
                    "is_active" boolean NOT NULL DEFAULT true,
                    "group_id" bigint NOT NULL REFERENCES "products_taggroup" ("id") DEFERRABLE INITIALLY DEFERRED,
                    UNIQUE ("group_id", "slug")
                )
            ''')
        
        # 4. Create Product-Tag M2M table if not exists
        if 'products_product_tags' not in existing_tables:
            cursor.execute('''
                CREATE TABLE "products_product_tags" (
                    "id" bigserial NOT NULL PRIMARY KEY,
                    "product_id" bigint NOT NULL REFERENCES "products_product" ("id") DEFERRABLE INITIALLY DEFERRED,
                    "producttag_id" bigint NOT NULL REFERENCES "products_producttag" ("id") DEFERRABLE INITIALLY DEFERRED,
                    UNIQUE ("product_id", "producttag_id")
                )
            ''')


class Migration(migrations.Migration):

    dependencies = [
        ('products', '0015_product_purchase_price'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunPython(create_tables_if_not_exist, migrations.RunPython.noop),
            ],
            state_operations=[
                migrations.CreateModel(
                    name='TagGroup',
                    fields=[
                        ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                        ('name', models.CharField(help_text="Display name, e.g. 'Use Case'", max_length=100)),
                        ('slug', models.SlugField(blank=True, max_length=100, unique=True)),
                        ('display_order', models.PositiveIntegerField(default=0, help_text='Order in filter sidebar')),
                        ('is_active', models.BooleanField(default=True)),
                        ('created_at', models.DateTimeField(auto_now_add=True)),
                        ('categories', models.ManyToManyField(blank=True, help_text='Which categories this filter group applies to. Leave empty for all.', related_name='tag_groups', to='products.category')),
                    ],
                    options={
                        'verbose_name': 'Tag Group',
                        'verbose_name_plural': 'Tag Groups',
                        'ordering': ['display_order', 'name'],
                    },
                ),
                migrations.CreateModel(
                    name='ProductTag',
                    fields=[
                        ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                        ('name', models.CharField(help_text="Display name, e.g. 'Kitchen'", max_length=100)),
                        ('slug', models.SlugField(blank=True, max_length=100)),
                        ('display_order', models.PositiveIntegerField(default=0)),
                        ('is_active', models.BooleanField(default=True)),
                        ('group', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='tags', to='products.taggroup')),
                    ],
                    options={
                        'verbose_name': 'Product Tag',
                        'verbose_name_plural': 'Product Tags',
                        'ordering': ['display_order', 'name'],
                        'unique_together': {('group', 'slug')},
                    },
                ),
                migrations.AddField(
                    model_name='product',
                    name='tags',
                    field=models.ManyToManyField(blank=True, help_text='Filterable attribute tags', related_name='products', to='products.producttag'),
                ),
            ],
        ),
    ]
