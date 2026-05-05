import os
import sys
import django

# Set up Django environment
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.base')
django.setup()

from apps.products.models import Product, ProductImage, Category, Subcategory, Brand

def get_size_mb(size_in_bytes):
    return size_in_bytes / (1024 * 1024)

def check_images():
    total_size = 0
    large_images = []
    
    print("Checking Product Main Images...")
    for p in Product.objects.all():
        if p.image:
            try:
                size = p.image.size
                total_size += size
                large_images.append(('Product Main Image', p.name, p.image.name, size))
            except Exception as e:
                pass
                
    print("Checking Product Gallery Images...")
    for pi in ProductImage.objects.all():
        if pi.image:
            try:
                size = pi.image.size
                total_size += size
                large_images.append(('Gallery Image', pi.product.name, pi.image.name, size))
            except Exception as e:
                pass
                
    print(f"\nTotal Local Image Size: {get_size_mb(total_size):.2f} MB\n")
    
    print("--- Top 20 Largest Images ---")
    # Sort by size descending
    large_images.sort(key=lambda x: x[3], reverse=True)
    
    for type_name, name, path, size in large_images[:20]:
        print(f"[{get_size_mb(size):.2f} MB] - {name} ({type_name})")
        print(f"   Path: {path}")

if __name__ == '__main__':
    check_images()
