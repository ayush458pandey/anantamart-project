from collections import OrderedDict

from django.contrib import admin
from django.contrib import messages
from django.shortcuts import render
from django.utils.html import format_html, format_html_join
from .models import Category, Product, PriceTier, ProductImage, Subcategory, Brand, TagGroup, ProductTag

@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ['name', 'short_name', 'is_active', 'created_at']
    list_filter = ['is_active']
    search_fields = ['name', 'short_name', 'description']

@admin.register(Subcategory)
class SubcategoryAdmin(admin.ModelAdmin):
    list_display = ['name', 'category', 'is_active', 'created_at']
    list_select_related = ['category']
    list_filter = ['category', 'is_active']
    search_fields = ['name', 'description', 'category__name']
    list_editable = ['is_active']
    fields = ['name', 'category', 'description', 'image', 'icon_name', 'is_active']

@admin.register(Brand)
class BrandAdmin(admin.ModelAdmin):
    list_display = ['name', 'slug', 'is_active', 'created_at']
    list_filter = ['is_active']
    search_fields = ['name', 'description']
    list_editable = ['is_active']
    prepopulated_fields = {'slug': ('name',)}
    fields = ['name', 'slug', 'logo', 'description', 'is_active']

class ProductImageInline(admin.TabularInline):
    model = ProductImage
    extra = 1
    fields = ['image', 'image_size_display', 'order', 'is_primary', 'alt_text']
    readonly_fields = ['image_size_display']

    def image_size_display(self, obj):
        if obj.image:
            try:
                size_kb = obj.image.size / 1024
                return f"{size_kb:.2f} KB"
            except Exception:
                return "Unknown"
        return "-"
    image_size_display.short_description = 'Size'

class PriceTierInline(admin.TabularInline):
    model = PriceTier
    extra = 1
    fields = ['min_quantity', 'max_quantity', 'price']

@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    # 🟢 Added 'hsn_code' to the list view
    list_display = ['name', 'sku', 'brand_ref', 'category', 'subcategory', 'base_price', 'purchase_price', 'tax_rate', 'hsn_code', 'stock', 'stock_status', 'is_active']
    list_select_related = ['category', 'subcategory', 'subcategory__category', 'brand_ref']
    
    list_filter = ['category', 'subcategory', 'brand_ref', 'is_active', 'stock_status', 'tax_rate', 'dietary_preference']
    
    # 🟢 Added 'hsn_code' to search (so you can search by it)
    search_fields = ['name', 'sku', 'hsn_code', 'brand', 'brand_ref__name', 'description']
    
    list_editable = ['stock', 'is_active', 'base_price', 'tax_rate']
    
    readonly_fields = ['created_at', 'updated_at', 'image_size_display']
    
    actions = ['bulk_update_subcategory', 'bulk_add_tags', 'bulk_remove_tags']
    
    def image_size_display(self, obj):
        if obj.image:
            try:
                size_kb = obj.image.size / 1024
                return f"{size_kb:.2f} KB"
            except Exception:
                return "Unknown size"
        return "No image"
    image_size_display.short_description = 'Main Image Size'
    
    # --- BULK ACTION: Assign Subcategory ---
    @admin.action(description="🔄 Assign subcategory to selected products")
    def bulk_update_subcategory(self, request, queryset):
        if 'apply' in request.POST:
            category_id = request.POST.get('category')
            subcategory_id = request.POST.get('subcategory')
            
            updated_fields = []
            
            if category_id:
                try:
                    new_category = Category.objects.get(pk=category_id)
                    queryset.update(category=new_category)
                    updated_fields.append(f"category → {new_category.name}")
                except Category.DoesNotExist:
                    self.message_user(request, "Selected category not found.", messages.ERROR)
                    return
            
            if subcategory_id:
                try:
                    new_subcategory = Subcategory.objects.get(pk=subcategory_id)
                    queryset.update(subcategory=new_subcategory)
                    # Also update category to match the subcategory's parent
                    if not category_id:
                        queryset.update(category=new_subcategory.category)
                        updated_fields.append(f"category → {new_subcategory.category.name}")
                    updated_fields.append(f"subcategory → {new_subcategory.name}")
                except Subcategory.DoesNotExist:
                    self.message_user(request, "Selected subcategory not found.", messages.ERROR)
                    return
            
            if updated_fields:
                count = queryset.count()
                changes = ', '.join(updated_fields)
                self.message_user(
                    request,
                    f"✅ Successfully updated {count} product(s): {changes}",
                    messages.SUCCESS
                )
            else:
                self.message_user(request, "No changes were made — nothing was selected.", messages.WARNING)
            return
        
        products = queryset.select_related('category', 'subcategory')
        categories = Category.objects.filter(is_active=True).order_by('name')
        subcategories = Subcategory.objects.filter(is_active=True).select_related('category').order_by('category__name', 'name')
        
        return render(request, 'admin/products/bulk_update_subcategory.html', {
            'products': products,
            'categories': categories,
            'subcategories': subcategories,
            'title': 'Bulk Update Subcategory',
        })
    
    # --- BULK ACTION: Add Tags ---
    @admin.action(description="🏷️ Add tags to selected products")
    def bulk_add_tags(self, request, queryset):
        if 'apply' in request.POST:
            tag_ids = request.POST.getlist('tags')
            if tag_ids:
                tags = ProductTag.objects.filter(pk__in=tag_ids)
                count = 0
                for product in queryset:
                    product.tags.add(*tags)
                    count += 1
                tag_names = ', '.join(t.name for t in tags)
                self.message_user(
                    request,
                    f"✅ Added tags [{tag_names}] to {count} product(s).",
                    messages.SUCCESS
                )
            else:
                self.message_user(request, "No tags were selected.", messages.WARNING)
            return
        
        products = queryset.prefetch_related('tags')
        tags_by_group = self._get_tags_by_group()
        
        return render(request, 'admin/products/bulk_update_tags.html', {
            'products': products,
            'tags_by_group': tags_by_group,
            'mode': 'Add',
            'title': 'Bulk Add Tags',
        })
    
    # --- BULK ACTION: Remove Tags ---
    @admin.action(description="🗑️ Remove tags from selected products")
    def bulk_remove_tags(self, request, queryset):
        if 'apply' in request.POST:
            tag_ids = request.POST.getlist('tags')
            if tag_ids:
                tags = ProductTag.objects.filter(pk__in=tag_ids)
                count = 0
                for product in queryset:
                    product.tags.remove(*tags)
                    count += 1
                tag_names = ', '.join(t.name for t in tags)
                self.message_user(
                    request,
                    f"✅ Removed tags [{tag_names}] from {count} product(s).",
                    messages.SUCCESS
                )
            else:
                self.message_user(request, "No tags were selected.", messages.WARNING)
            return
        
        products = queryset.prefetch_related('tags')
        tags_by_group = self._get_tags_by_group()
        
        return render(request, 'admin/products/bulk_update_tags.html', {
            'products': products,
            'tags_by_group': tags_by_group,
            'mode': 'Remove',
            'title': 'Bulk Remove Tags',
        })
    
    def _get_tags_by_group(self):
        """Helper: returns an OrderedDict of group_name -> [tags] for template rendering."""
        all_tags = ProductTag.objects.filter(is_active=True).select_related('group').order_by('group__display_order', 'group__name', 'display_order', 'name')
        tags_by_group = OrderedDict()
        for tag in all_tags:
            group_name = tag.group.name if tag.group else 'Ungrouped'
            tags_by_group.setdefault(group_name, []).append(tag)
        return tags_by_group
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('name', 'sku', 'category', 'subcategory', 'description', 'tags', 'is_active')
        }),
        ('Product Details', {
            'fields': ('brand_ref', 'product_type', 'available_colors', 'key_features', 'ingredients', 
                       'packaging_type', 'dietary_preference', 'unit', 'weight')
        }),
        ('Usage & Storage', {
            'fields': ('usage_recommendation', 'storage_instruction')
        }),
        ('Pricing', {
            # 🟢 ADDED hsn_code HERE (It will appear right below tax_rate)
            'fields': ('mrp', 'base_price', 'purchase_price', 'tax_rate', 'hsn_code')
        }),
        ('Stock', {
            'fields': ('stock', 'stock_status', 'moq', 'case_size')
        }),
        ('Images', {
            'fields': ('image', 'image_size_display')
        }),
        ('Legacy Fields', {
            'fields': ('brand',),
            'classes': ('collapse',),
            'description': 'Legacy brand field - Use "Brand ref" above instead. This field is kept for backward compatibility only.'
        }),
        ('Metadata', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    inlines = [ProductImageInline, PriceTierInline]
    filter_horizontal = ['tags']

@admin.register(ProductImage)
class ProductImageAdmin(admin.ModelAdmin):
    list_display = ['product', 'image_size_display', 'order', 'is_primary', 'created_at']
    list_select_related = ['product']
    list_filter = ['is_primary', 'created_at']
    search_fields = ['product__name', 'alt_text']
    list_editable = ['order', 'is_primary']
    readonly_fields = ['image_size_display']

    def image_size_display(self, obj):
        if obj.image:
            try:
                size_kb = obj.image.size / 1024
                return f"{size_kb:.2f} KB"
            except Exception:
                return "Unknown"
        return "-"
    image_size_display.short_description = 'Size'

@admin.register(PriceTier)
class PriceTierAdmin(admin.ModelAdmin):
    list_display = ['product', 'min_quantity', 'max_quantity', 'price']
    list_select_related = ['product']
    list_filter = ['product__category']
    search_fields = ['product__name']


class ProductTagInline(admin.TabularInline):
    model = ProductTag
    extra = 1
    prepopulated_fields = {'slug': ('name',)}
    fields = ['name', 'slug', 'display_order', 'is_active']


@admin.register(TagGroup)
class TagGroupAdmin(admin.ModelAdmin):
    list_display = ['name', 'slug', 'display_order', 'is_active']
    list_editable = ['display_order', 'is_active']
    prepopulated_fields = {'slug': ('name',)}
    filter_horizontal = ['categories']
    inlines = [ProductTagInline]
    search_fields = ['name']


@admin.register(ProductTag)
class ProductTagAdmin(admin.ModelAdmin):
    list_display = ['name', 'group', 'slug', 'display_order', 'is_active']
    list_select_related = ['group']
    list_filter = ['group', 'is_active']
    list_editable = ['display_order', 'is_active']
    prepopulated_fields = {'slug': ('name',)}
    search_fields = ['name', 'group__name']
    filter_horizontal = ['subcategories']