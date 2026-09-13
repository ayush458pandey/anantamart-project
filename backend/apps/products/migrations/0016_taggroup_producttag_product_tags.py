from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('products', '0015_product_purchase_price'),
    ]

    operations = [
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
    ]
