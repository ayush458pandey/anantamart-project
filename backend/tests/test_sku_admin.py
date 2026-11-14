"""Tests for the lowercase SKU standard across every creation path.

Covers the Django admin, which bypasses ProductWriteSerializer and therefore
needs its own normalisation (ProductAdminForm / ProductVariantAdminForm).
"""
import pytest
from django.contrib.auth.models import User
from django.test import Client

from apps.products.models import Category, Product, ProductVariant

pytestmark = pytest.mark.django_db


@pytest.fixture
def admin_client(db):
    user = User.objects.create_superuser(
        username='admin', password='pw', email='admin@example.com',
    )
    client = Client()
    client.force_login(user)
    return client


@pytest.fixture
def category(db):
    return Category.objects.create(name='Stationery')


def product_form(category, name, sku):
    data = {
        'name': name, 'sku': sku, 'description': 'x', 'category': category.id,
        'base_price': '5.00', 'tax_rate': '18.00', 'stock': '0',
        'stock_status': 'in-stock', 'moq': '1', 'case_size': '1', 'unit': '1 pack',
        'brand': 'Generic', 'product_type': 'Standard',
        'variant_display_type': 'dropdown', 'available_colors': '',
        'key_features': '', 'ingredients': '', 'packaging_type': '',
        'dietary_preference': '', 'storage_instruction': '',
        'usage_recommendation': '', 'weight': '', '_save': 'Save',
    }
    for prefix in ('images', 'tiers', 'variants'):
        data[f'{prefix}-TOTAL_FORMS'] = '0'
        data[f'{prefix}-INITIAL_FORMS'] = '0'
        data[f'{prefix}-MIN_NUM_FORMS'] = '0'
        data[f'{prefix}-MAX_NUM_FORMS'] = '1000'
    return data


# --- Django admin -----------------------------------------------------------

def test_admin_add_lowercases_the_sku(admin_client, category):
    response = admin_client.post(
        '/admin/products/product/add/',
        product_form(category, 'Admin Eraser', 'APS-ADMIN-UPPER'),
    )
    assert response.status_code == 302, response.content

    product = Product.objects.get(name='Admin Eraser')
    assert product.sku == 'aps-admin-upper'


def test_admin_add_rejects_a_case_only_duplicate(admin_client, category):
    Product.objects.create(
        name='Existing', sku='aps-admin-upper', description='x',
        category=category, base_price='5.00',
    )
    response = admin_client.post(
        '/admin/products/product/add/',
        product_form(category, 'Duplicate', 'APS-ADMIN-UPPER'),
    )
    # Re-rendered with an error rather than saved.
    assert response.status_code == 200
    assert not Product.objects.filter(name='Duplicate').exists()


def test_admin_edit_does_not_rewrite_an_existing_sku(admin_client, category):
    product = Product.objects.create(
        name='Legacy', sku='Legacy-Mixed-Case', description='x',
        category=category, base_price='5.00',
    )
    response = admin_client.post(
        f'/admin/products/product/{product.pk}/change/',
        product_form(category, 'Legacy Renamed', 'Legacy-Mixed-Case'),
    )
    assert response.status_code == 302, response.content

    product.refresh_from_db()
    assert product.sku == 'Legacy-Mixed-Case'
    assert product.name == 'Legacy Renamed'


def test_admin_edit_rejects_a_case_variant_of_another_products_sku(
    admin_client, category,
):
    """Isolates the case-insensitive check from Django's exact-match unique rule.

    ``validate_unique()`` already rejects an exact duplicate, so this test uses a
    SKU that differs ONLY in casing. A pass therefore proves our form's
    ``sku__iexact`` check fired, not Django's default constraint.
    """
    Product.objects.create(
        name='Taken', sku='taken-sku', description='x',
        category=category, base_price='5.00',
    )
    product = Product.objects.create(
        name='Mine', sku='mine-sku', description='x',
        category=category, base_price='5.00',
    )

    response = admin_client.post(
        f'/admin/products/product/{product.pk}/change/',
        product_form(category, 'Mine', 'TAKEN-SKU'),
    )

    # Rejected and re-rendered; the stored value is untouched.
    assert response.status_code == 200
    assert 'already exists' in response.content.decode()
    product.refresh_from_db()
    assert product.sku == 'mine-sku'


def test_admin_edit_allows_keeping_its_own_sku(admin_client, category):
    """The uniqueness check must exclude the object being edited."""
    product = Product.objects.create(
        name='Mine', sku='mine-sku', description='x',
        category=category, base_price='5.00',
    )
    response = admin_client.post(
        f'/admin/products/product/{product.pk}/change/',
        product_form(category, 'Mine Renamed', 'mine-sku'),
    )
    assert response.status_code == 302, response.content

    product.refresh_from_db()
    assert product.sku == 'mine-sku'
    assert product.name == 'Mine Renamed'


def test_admin_form_exposes_the_case_insensitive_check(admin_client, category):
    """Directly exercises ProductAdminForm.clean_sku with a case-variant clash."""
    from apps.products.admin import ProductAdminForm

    Product.objects.create(
        name='Taken', sku='taken-sku', description='x',
        category=category, base_price='5.00',
    )
    form = ProductAdminForm(data=product_form(category, 'New', 'TAKEN-SKU'))

    assert not form.is_valid()
    assert 'sku' in form.errors
    assert 'already exists' in ' '.join(form.errors['sku'])


def test_admin_form_lowercases_on_create_but_not_on_edit(category):
    """clean_sku() behaviour in isolation, with no HTTP layer."""
    from apps.products.admin import ProductAdminForm

    creating = ProductAdminForm(data=product_form(category, 'New', 'MIXED-Case'))
    assert creating.is_valid(), creating.errors
    assert creating.cleaned_data['sku'] == 'mixed-case'

    existing = Product.objects.create(
        name='Old', sku='Old-Mixed', description='x',
        category=category, base_price='5.00',
    )
    editing = ProductAdminForm(
        data=product_form(category, 'Old', 'Old-Mixed'), instance=existing,
    )
    assert editing.is_valid(), editing.errors
    assert editing.cleaned_data['sku'] == 'Old-Mixed'


# --- Variant SKUs -----------------------------------------------------------

def test_variant_admin_form_lowercases_a_new_variant(category):
    from apps.products.admin import ProductVariantAdminForm

    product = Product.objects.create(
        name='P', sku='p-1', description='x', category=category, base_price='5.00',
    )
    form = ProductVariantAdminForm(data={
        'product': product.id, 'variant_type': 'Size', 'name': 'Large',
        'sku': 'APS-VARIANT-L', 'base_price': '5.00', 'mrp': '', 'stock': '0',
        'stock_status': 'in-stock', 'moq': '1', 'case_size': '1',
        'hex_color': '', 'sort_order': '0', 'is_active': 'on',
    })
    assert form.is_valid(), form.errors
    assert form.cleaned_data['sku'] == 'aps-variant-l'


def test_variant_admin_form_allows_a_blank_sku(category):
    from apps.products.admin import ProductVariantAdminForm

    product = Product.objects.create(
        name='P', sku='p-1', description='x', category=category, base_price='5.00',
    )
    form = ProductVariantAdminForm(data={
        'product': product.id, 'variant_type': 'Size', 'name': 'Large',
        'sku': '', 'base_price': '5.00', 'mrp': '', 'stock': '0',
        'stock_status': 'in-stock', 'moq': '1', 'case_size': '1',
        'hex_color': '', 'sort_order': '0', 'is_active': 'on',
    })
    assert form.is_valid(), form.errors
    assert form.cleaned_data['sku'] == ''


def test_variant_admin_form_rejects_a_case_only_duplicate(category):
    from apps.products.admin import ProductVariantAdminForm

    product = Product.objects.create(
        name='P', sku='p-1', description='x', category=category, base_price='5.00',
    )
    ProductVariant.objects.create(
        product=product, variant_type='Size', name='Small', sku='dup-variant',
    )
    form = ProductVariantAdminForm(data={
        'product': product.id, 'variant_type': 'Size', 'name': 'Large',
        'sku': 'DUP-VARIANT', 'base_price': '5.00', 'mrp': '', 'stock': '0',
        'stock_status': 'in-stock', 'moq': '1', 'case_size': '1',
        'hex_color': '', 'sort_order': '0', 'is_active': 'on',
    })
    assert not form.is_valid()
    assert 'sku' in form.errors
