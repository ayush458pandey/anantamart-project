"""Regression tests: unpublished (is_active=False) products must be unbuyable.

A draft product -- including one submitted by an AI token -- must be invisible
to browsing AND impossible to purchase. Browsing was already covered by
tests/test_product_permissions.py; this file covers the cart and checkout paths,
which previously accepted any product id.

Run with:
    python -m pytest tests/test_inactive_products.py -v
"""
import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient

from apps.cart.models import CartItem
from apps.orders.models import Order
from apps.orders.services import OrderService
from apps.products.models import Category, Product

PRODUCTS_URL = '/api/products/'
CART_ADD_URL = '/api/cart/add/'
ORDERS_URL = '/api/orders/'


@pytest.fixture
def category(db):
    return Category.objects.create(name='Stationery')


@pytest.fixture
def live_product(category):
    return Product.objects.create(
        name='Apsara Eraser', sku='APS-ER-001', description='Non-dust eraser.',
        category=category, base_price='5.00', mrp='10.00',
        stock=100, is_active=True,
    )


@pytest.fixture
def draft_product(category):
    return Product.objects.create(
        name='Draft Eraser', sku='APS-ER-DRAFT', description='Not published yet.',
        category=category, base_price='5.00', stock=100, is_active=False,
    )


@pytest.fixture
def anonymous_client():
    return APIClient()


@pytest.fixture
def customer_client(db):
    user = User.objects.create_user(
        username='customer', password='test-pass-123', is_staff=False,
    )
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def staff_client(db):
    user = User.objects.create_user(
        username='staff', password='test-pass-123', is_staff=True,
    )
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def order_payload(product, quantity=1):
    return {
        'items': [{'product_id': product.id, 'quantity': quantity}],
        'subtotal': '5.00', 'cgst': '0.45', 'sgst': '0.45', 'total': '5.90',
        'delivery_address': '1 Test Street', 'delivery_option': 'standard',
        'payment_method': 'upi',
    }


# --- Browsing (already correct; locked in here) -----------------------------

def test_draft_is_absent_from_public_list(anonymous_client, live_product, draft_product):
    body = anonymous_client.get(PRODUCTS_URL).json()
    rows = body['results'] if isinstance(body, dict) else body
    ids = [row['id'] for row in rows]
    assert live_product.id in ids
    assert draft_product.id not in ids


def test_draft_detail_returns_404(anonymous_client, draft_product):
    assert anonymous_client.get(f'{PRODUCTS_URL}{draft_product.id}/').status_code == 404


def test_draft_by_slug_returns_404(anonymous_client, draft_product):
    response = anonymous_client.get(f'{PRODUCTS_URL}by-slug/{draft_product.slug}/')
    assert response.status_code == 404


# --- Cart -------------------------------------------------------------------

def test_cannot_add_draft_to_cart(anonymous_client, draft_product):
    response = anonymous_client.post(
        CART_ADD_URL, {'product_id': draft_product.id, 'quantity': 1}, format='json',
    )
    assert response.status_code == 404
    assert not CartItem.objects.filter(product=draft_product).exists()


def test_can_add_live_product_to_cart(anonymous_client, live_product):
    response = anonymous_client.post(
        CART_ADD_URL, {'product_id': live_product.id, 'quantity': 2}, format='json',
    )
    assert response.status_code == 200
    assert CartItem.objects.get(product=live_product).quantity == 2


def test_cannot_increase_quantity_of_a_deactivated_cart_line(
    anonymous_client, live_product,
):
    anonymous_client.post(
        CART_ADD_URL, {'product_id': live_product.id, 'quantity': 1}, format='json',
    )
    item = CartItem.objects.get(product=live_product)

    # Admin unpublishes the product while it sits in the cart.
    Product.objects.filter(id=live_product.id).update(is_active=False)

    response = anonymous_client.put(
        f'/api/cart/update/{item.id}/', {'quantity': 5}, format='json',
    )
    assert response.status_code == 400
    item.refresh_from_db()
    assert item.quantity == 1


def test_can_still_remove_a_deactivated_cart_line(anonymous_client, live_product):
    anonymous_client.post(
        CART_ADD_URL, {'product_id': live_product.id, 'quantity': 1}, format='json',
    )
    item = CartItem.objects.get(product=live_product)
    Product.objects.filter(id=live_product.id).update(is_active=False)

    # Removing must stay possible, otherwise the line is stuck in the cart.
    response = anonymous_client.put(
        f'/api/cart/update/{item.id}/', {'quantity': 0}, format='json',
    )
    assert response.status_code == 200
    assert not CartItem.objects.filter(id=item.id).exists()


# --- Checkout ---------------------------------------------------------------

def test_checkout_rejects_a_draft_product(customer_client, draft_product):
    response = customer_client.post(
        ORDERS_URL, order_payload(draft_product), format='json',
    )
    assert response.status_code == 400
    assert not Order.objects.exists()


def test_checkout_rejects_a_product_deactivated_after_being_carted(
    customer_client, live_product,
):
    customer_client.post(
        CART_ADD_URL, {'product_id': live_product.id, 'quantity': 1}, format='json',
    )
    Product.objects.filter(id=live_product.id).update(is_active=False)

    response = customer_client.post(
        ORDERS_URL, order_payload(live_product), format='json',
    )
    assert response.status_code == 400
    assert not Order.objects.exists()


def test_checkout_still_accepts_a_live_product(customer_client, live_product):
    response = customer_client.post(
        ORDERS_URL, order_payload(live_product), format='json',
    )
    assert response.status_code == 201, response.content
    assert Order.objects.count() == 1


def test_service_layer_refuses_a_draft_even_without_the_http_layer(
    customer_client, draft_product,
):
    """Defence in depth: the guard lives in the service, not only the view."""
    user = User.objects.get(username='customer')
    with pytest.raises(ValueError, match='not available for purchase'):
        OrderService.create_order(
            user=user,
            items_data=[{'product_id': draft_product.id, 'quantity': 1}],
            order_data={
                'subtotal': '5.00', 'cgst': '0.45', 'sgst': '0.45',
                'total': '5.90', 'delivery_address': '1 Test Street',
                'delivery_option': 'standard', 'payment_method': 'upi',
            },
        )
    assert not Order.objects.exists()


def test_service_layer_still_raises_does_not_exist_for_unknown_ids(customer_client):
    user = User.objects.get(username='customer')
    with pytest.raises(Product.DoesNotExist):
        OrderService.create_order(
            user=user,
            items_data=[{'product_id': 999_999, 'quantity': 1}],
            order_data={
                'subtotal': '5.00', 'cgst': '0.45', 'sgst': '0.45',
                'total': '5.90', 'delivery_address': '1 Test Street',
                'delivery_option': 'standard', 'payment_method': 'upi',
            },
        )


# --- Activation stays an admin-only action ----------------------------------

def test_staff_can_activate_a_draft_via_django_admin(db, draft_product):
    """The Django admin is the only place a draft can be published today."""
    from django.test import Client

    admin_user = User.objects.create_superuser(
        username='admin', password='test-pass-123', email='admin@example.com',
    )
    admin_client = Client()
    admin_client.force_login(admin_user)

    data = {
        'name': draft_product.name, 'sku': draft_product.sku,
        'description': draft_product.description,
        'category': draft_product.category_id,
        'base_price': '5.00', 'tax_rate': '18.00', 'stock': '0',
        'stock_status': 'in-stock', 'moq': '1', 'case_size': '1',
        'unit': '1 pack', 'brand': 'Generic', 'product_type': 'Standard',
        'variant_display_type': 'dropdown', 'available_colors': '',
        'key_features': '', 'ingredients': '', 'packaging_type': '',
        'dietary_preference': '', 'storage_instruction': '',
        'usage_recommendation': '', 'weight': '',
        'is_active': 'on', '_save': 'Save',
    }
    for prefix in ('images', 'tiers', 'variants'):
        data[f'{prefix}-TOTAL_FORMS'] = '0'
        data[f'{prefix}-INITIAL_FORMS'] = '0'
        data[f'{prefix}-MIN_NUM_FORMS'] = '0'
        data[f'{prefix}-MAX_NUM_FORMS'] = '1000'

    response = admin_client.post(
        f'/admin/products/product/{draft_product.id}/change/', data,
    )
    assert response.status_code == 302, response.content
    draft_product.refresh_from_db()
    assert draft_product.is_active is True


def test_rest_api_cannot_reach_a_draft_even_as_staff(staff_client, draft_product):
    """ProductViewSet.queryset filters is_active=True, so a draft is 404 for
    everyone over REST. Publishing therefore requires the admin or a dedicated
    endpoint -- which is why Phase 2C adds one."""
    assert staff_client.get(f'{PRODUCTS_URL}{draft_product.id}/').status_code == 404
    assert staff_client.patch(
        f'{PRODUCTS_URL}{draft_product.id}/', {'is_active': True}, format='json',
    ).status_code == 404

    draft_product.refresh_from_db()
    assert draft_product.is_active is False


def test_customer_cannot_activate_a_draft(customer_client, draft_product):
    response = customer_client.patch(
        f'{PRODUCTS_URL}{draft_product.id}/', {'is_active': True}, format='json',
    )
    assert response.status_code in (403, 404)
    draft_product.refresh_from_db()
    assert draft_product.is_active is False


def test_anonymous_cannot_activate_a_draft(anonymous_client, draft_product):
    response = anonymous_client.patch(
        f'{PRODUCTS_URL}{draft_product.id}/', {'is_active': True}, format='json',
    )
    assert response.status_code in (401, 403, 404)
    draft_product.refresh_from_db()
    assert draft_product.is_active is False
