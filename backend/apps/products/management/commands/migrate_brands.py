from django.core.management.base import BaseCommand
from django.utils.text import slugify
from apps.products.models import Product, Brand


class Command(BaseCommand):
    help = 'Migrate brand names from text field to Brand model'

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('\n=== Migrating Brands ===\n'))
        
        # Get all unique brand names from products
        brand_names = Product.objects.exclude(brand='').exclude(brand__isnull=True).values_list('brand', flat=True).distinct()
        
        created_count = 0
        updated_count = 0
        
        for brand_name in brand_names:
            brand_name = brand_name.strip()
            if not brand_name or brand_name.lower() == 'generic':
                continue
            
            # Create or get the Brand object
            brand, created = Brand.objects.get_or_create(
                name=brand_name,
                defaults={'slug': slugify(brand_name)}
            )
            
            if created:
                self.stdout.write(self.style.SUCCESS(f'  ✓ Created brand: {brand_name}'))
                created_count += 1
            
            # Update all products with this brand name
            products = Product.objects.filter(brand=brand_name, brand_ref__isnull=True)
            count = products.count()
            
            if count > 0:
                products.update(brand_ref=brand)
                self.stdout.write(f'    → Linked {count} products to {brand_name}')
                updated_count += count
        
        self.stdout.write(self.style.SUCCESS(f'\n=== Migration Complete ==='))
        self.stdout.write(f'  Brands created: {created_count}')
        self.stdout.write(f'  Products updated: {updated_count}\n')
        
        # Show products still without brand_ref
        no_brand = Product.objects.filter(brand_ref__isnull=True, is_active=True).count()
        if no_brand > 0:
            self.stdout.write(self.style.WARNING(f'  ⚠️  {no_brand} active products still have no brand assigned'))
