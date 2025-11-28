from django.core.management.base import BaseCommand
from apps.products.models import Product, Subcategory, Category


class Command(BaseCommand):
    help = 'Debug product counts by subcategory'

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('\n=== Product Count Debug ===\n'))
        
        categories = Category.objects.filter(is_active=True)
        
        for category in categories:
            self.stdout.write(self.style.WARNING(f'\nCategory: {category.name}'))
            self.stdout.write('-' * 50)
            
            subcategories = category.subcategories.filter(is_active=True)
            
            for subcat in subcategories:
                active_count = subcat.products.filter(is_active=True).count()
                total_count = subcat.products.count()
                inactive_count = subcat.products.filter(is_active=False).count()
                
                self.stdout.write(
                    f'  Subcategory: {subcat.name}\n'
                    f'    - Active products: {active_count}\n'
                    f'    - Inactive products: {inactive_count}\n'
                    f'    - Total products: {total_count}'
                )
                
                if active_count > 0:
                    self.stdout.write('    Products:')
                    for product in subcat.products.filter(is_active=True):
                        self.stdout.write(f'      - {product.name} (SKU: {product.sku})')
                
                self.stdout.write('')
            
            # Check products without subcategory
            no_subcat = Product.objects.filter(
                category=category,
                subcategory__isnull=True,
                is_active=True
            ).count()
            
            if no_subcat > 0:
                self.stdout.write(
                    self.style.ERROR(
                        f'  ⚠️  {no_subcat} products in {category.name} have NO subcategory assigned!'
                    )
                )
        
        self.stdout.write(self.style.SUCCESS('\n=== Debug Complete ===\n'))
