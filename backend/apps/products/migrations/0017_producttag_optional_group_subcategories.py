from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('products', '0016_taggroup_producttag_product_tags'),
    ]

    operations = [
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
        # 3. Make slug unique (instead of unique_together with group)
        migrations.AlterField(
            model_name='producttag',
            name='slug',
            field=models.SlugField(max_length=100, unique=True, blank=True),
        ),
        # 4. Remove old unique_together constraint
        migrations.AlterUniqueTogether(
            name='producttag',
            unique_together=set(),
        ),
    ]
