from django.core.management.base import BaseCommand
from apps.products.models import TagGroup, ProductTag

class Command(BaseCommand):
    help = 'Sets up the Business Type tag group and tags'

    def handle(self, *args, **kwargs):
        group_name = 'Business Type'
        tags = [
            'Beauty & Salon',
            'Tailors & Boutiques',
            'Stationery Shops',
            'General Stores',
            'Gift & Toy Shops',
            'Hotels & Restaurants',
            'Office Buyers',
            'Puja Stores'
        ]

        group, created = TagGroup.objects.get_or_create(
            name=group_name,
            defaults={'display_order': 100} # Arbitrary high order to keep it distinct
        )

        if created:
            self.stdout.write(self.style.SUCCESS(f'Created TagGroup: {group_name}'))
        else:
            self.stdout.write(self.style.WARNING(f'TagGroup already exists: {group_name}'))

        for i, tag_name in enumerate(tags):
            tag, tag_created = ProductTag.objects.get_or_create(
                name=tag_name,
                group=group,
                defaults={'display_order': i}
            )
            if tag_created:
                self.stdout.write(self.style.SUCCESS(f'  Created Tag: {tag_name}'))
            else:
                self.stdout.write(self.style.WARNING(f'  Tag already exists: {tag_name}'))

        self.stdout.write(self.style.SUCCESS('Successfully completed setting up business tags.'))
