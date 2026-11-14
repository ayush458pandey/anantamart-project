"""Tests for ProductViewSet permission rules.

Verifies that the catalogue stays publicly readable while writes require a
staff account, and that the public ProductSerializer response is unchanged.

Run with:
    python -m pytest tests/test_product_permissions.py -v
"""
import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient

from apps.products.models import Category, Product
from apps.products.serializers import ProductSerializer

PRODUCTS_URL = '/api/products/'


@pytest.fixture
def category(db):
    return Category.objects.create(name='Stationery')


@pytest.fixture
def product(category):
    return Product.objects.create(
        name='Apsara Eraser',
        sku='APS-ER-001',
        description='Non-dust eraser.',
        category=category,
        base_price='5.00',
        mrp='10.00',
        is_active=True,
    )


@pytest.fixture
def draft_product(category):
    return Product.objects.create(
        name='Draft Eraser',
        sku='APS-ER-DRAFT',
        description='Not published yet.',
        category=category,
        base_price='5.00',
        is_active=False,
    )


@pytest.fixture
def anonymous_client():
    return APIClient()


@pytest.fixture
def customer_client(db):
    user = User.objects.create_user(
        username='customer', password='test-pass-123', is_staff=False
    )
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def staff_client(db):
    user = User.objects.create_user(
        username='staff', password='test-pass-123', is_staff=True
    )
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def valid_payload(category, **overrides):
    payload = {
        'name': 'New Eraser',
        'sku': 'NEW-ER-001',
        'description': 'A brand new eraser.',
        'category': category.id,
        'base_price': '5.00',
        'mrp': '10.00',
    }
    payload.update(overrides)
    return payload


# ---------------------------------------------------------------------------
# read access
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_anonymous_can_list_products(anonymous_client, product):
    response = anonymous_client.get(PRODUCTS_URL)

    assert response.status_code == 200
    results = response.json()
    results = results['results'] if isinstance(results, dict) else results
    assert [p['sku'] for p in results] == ['APS-ER-001']


@pytest.mark.django_db
def test_anonymous_can_retrieve_product(anonymous_client, product):
    response = anonymous_client.get(f'{PRODUCTS_URL}{product.id}/')

    assert response.status_code == 200
    assert response.json()['sku'] == 'APS-ER-001'


@pytest.mark.django_db
def test_anonymous_list_hides_draft_products(anonymous_client, product, draft_product):
    """Existing storefront behaviour: drafts never appear in the public list."""
    response = anonymous_client.get(PRODUCTS_URL)

    assert response.status_code == 200
    results = response.json()
    results = results['results'] if isinstance(results, dict) else results
    assert [p['sku'] for p in results] == ['APS-ER-001']


@pytest.mark.django_db
def test_anonymous_retrieve_draft_returns_404(anonymous_client, draft_product):
    response = anonymous_client.get(f'{PRODUCTS_URL}{draft_product.id}/')

    assert response.status_code == 404


# ---------------------------------------------------------------------------
# write access
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_anonymous_post_is_denied(anonymous_client, category):
    response = anonymous_client.post(PRODUCTS_URL, valid_payload(category), format='json')

    assert response.status_code == 401
    assert Product.objects.count() == 0


@pytest.mark.django_db
def test_anonymous_patch_is_denied(anonymous_client, product):
    response = anonymous_client.patch(
        f'{PRODUCTS_URL}{product.id}/', {'name': 'Hacked'}, format='json'
    )

    assert response.status_code == 401
    product.refresh_from_db()
    assert product.name == 'Apsara Eraser'


@pytest.mark.django_db
def test_anonymous_delete_is_denied(anonymous_client, product):
    response = anonymous_client.delete(f'{PRODUCTS_URL}{product.id}/')

    assert response.status_code == 401
    assert Product.objects.filter(id=product.id).exists()


@pytest.mark.django_db
def test_non_staff_post_is_denied(customer_client, category):
    response = customer_client.post(PRODUCTS_URL, valid_payload(category), format='json')

    assert response.status_code == 403
    assert Product.objects.count() == 0


@pytest.mark.django_db
def test_non_staff_patch_is_denied(customer_client, product):
    response = customer_client.patch(
        f'{PRODUCTS_URL}{product.id}/', {'name': 'Hacked'}, format='json'
    )

    assert response.status_code == 403
    product.refresh_from_db()
    assert product.name == 'Apsara Eraser'


@pytest.mark.django_db
def test_non_staff_delete_is_denied(customer_client, product):
    response = customer_client.delete(f'{PRODUCTS_URL}{product.id}/')

    assert response.status_code == 403
    assert Product.objects.filter(id=product.id).exists()


@pytest.mark.django_db
def test_staff_post_is_allowed(staff_client, category):
    response = staff_client.post(PRODUCTS_URL, valid_payload(category), format='json')

    assert response.status_code == 201, response.content
    assert Product.objects.count() == 1
    created = Product.objects.get()
    assert created.sku == 'NEW-ER-001'
    assert created.is_active is True


@pytest.mark.django_db
def test_staff_patch_is_allowed(staff_client, product):
    response = staff_client.patch(
        f'{PRODUCTS_URL}{product.id}/', {'name': 'Renamed Eraser'}, format='json'
    )

    assert response.status_code == 200, response.content
    product.refresh_from_db()
    assert product.name == 'Renamed Eraser'


@pytest.mark.django_db
def test_staff_delete_is_allowed(staff_client, product):
    response = staff_client.delete(f'{PRODUCTS_URL}{product.id}/')

    assert response.status_code == 204
    assert not Product.objects.filter(id=product.id).exists()


# ---------------------------------------------------------------------------
# public response shape
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_public_response_matches_product_serializer(anonymous_client, product):
    """The endpoint must keep returning the unchanged ProductSerializer shape."""
    response = anonymous_client.get(f'{PRODUCTS_URL}{product.id}/')

    assert response.status_code == 200
    body = response.json()
    expected = ProductSerializer(product, context={'request': response.wsgi_request}).data

    assert set(body.keys()) == set(expected.keys())
    for key in ('id', 'name', 'slug', 'sku', 'brand', 'brand_name', 'gst_rate',
                'is_active', 'has_variants', 'images', 'tiers', 'tag_list', 'variants'):
        assert body[key] == expected[key], key


@pytest.mark.django_db
def test_public_response_exposes_read_only_nested_fields(anonymous_client, product):
    """Nested collections stay read-only in the public payload."""
    body = anonymous_client.get(f'{PRODUCTS_URL}{product.id}/').json()

    assert body['images'] == []
    assert body['tiers'] == []
    assert body['tag_list'] == []
    assert body['variants'] == []
    assert body['brand'] == 'Generic'
    assert body['brand_name'] == 'Generic'
