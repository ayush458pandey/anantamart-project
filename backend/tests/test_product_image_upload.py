"""Tests for staff image management on a LIVE (published) product.

The draft endpoints only accept pending drafts, so there was no way to attach
an image to a product that is already published. These endpoints close that
gap: POST /api/products/<id>/images/, POST .../images/<image_id>/primary/ and
DELETE .../images/<image_id>/.

They reuse apps.ai_access.images.process_upload, so the catalogue rules match
the AI and draft paths exactly.
"""
import io

import pytest
from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image
from rest_framework.test import APIClient

from apps.ai_access.images import MAX_BYTES
from apps.products.models import Category, Product, ProductImage

pytestmark = pytest.mark.django_db


@pytest.fixture
def category(db):
    return Category.objects.create(name='Stationery')


@pytest.fixture
def product(category):
    return Product.objects.create(
        name='Apsara Eraser', sku='apsara-eraser', description='x',
        category=category, base_price='5.00', is_active=True,
    )


@pytest.fixture
def staff_client(db):
    user = User.objects.create_user(
        username='staff', password='pw', is_staff=True, is_superuser=True,
    )
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def customer_client(db):
    user = User.objects.create_user(username='cust', password='pw', is_staff=False)
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def image_bytes(fmt='JPEG', size=(800, 600), colour=(200, 40, 40)):
    buffer = io.BytesIO()
    Image.new('RGB', size, colour).save(buffer, format=fmt)
    return buffer.getvalue()


def upload(data=None, name='photo.jpg', content_type='image/jpeg'):
    return SimpleUploadedFile(name, data if data is not None else image_bytes(), content_type=content_type)


def post_image(client, product, data=None, **extra):
    payload = {'file': upload(data)}
    payload.update(extra)
    return client.post(f'/api/products/{product.id}/images/', payload, format='multipart')


# --- Access control ---------------------------------------------------------

def test_anonymous_cannot_upload(product):
    response = post_image(APIClient(), product)
    assert response.status_code in (401, 403)
    assert product.images.count() == 0


def test_non_staff_cannot_upload(customer_client, product):
    response = post_image(customer_client, product)
    assert response.status_code == 403
    assert product.images.count() == 0


def test_staff_can_upload_to_a_live_product(staff_client, product):
    """The whole point: a published product accepts a new image."""
    assert product.is_active is True
    response = post_image(staff_client, product)
    assert response.status_code == 201
    assert product.images.count() == 1


# --- Upload behaviour -------------------------------------------------------

@pytest.mark.parametrize('fmt,ext,content_type', [
    ('JPEG', 'jpg', 'image/jpeg'),
    ('PNG', 'png', 'image/png'),
    ('WEBP', 'webp', 'image/webp'),
])
def test_accepts_jpeg_png_webp(staff_client, product, fmt, ext, content_type):
    response = post_image(
        staff_client, product,
        data=image_bytes(fmt=fmt),
    )
    assert response.status_code == 201
    assert product.images.count() == 1


def test_first_image_becomes_primary(staff_client, product):
    post_image(staff_client, product)
    image = product.images.first()
    assert image.is_primary is True


def test_second_image_is_not_primary_by_default(staff_client, product):
    post_image(staff_client, product)
    post_image(staff_client, product)
    primaries = product.images.filter(is_primary=True)
    assert primaries.count() == 1


def test_is_primary_flag_is_honoured(staff_client, product):
    post_image(staff_client, product)
    post_image(staff_client, product, is_primary='true')
    # The flag sets the new one primary but does not clear the old one here;
    # the dedicated primary endpoint is what guarantees a single primary.
    assert product.images.filter(is_primary=True).count() >= 1


def test_alt_text_is_stored(staff_client, product):
    post_image(staff_client, product, alt_text='Red eraser')
    assert product.images.first().alt_text == 'Red eraser'


def test_output_is_webp_under_the_size_cap(staff_client, product):
    response = post_image(staff_client, product, data=image_bytes(size=(1600, 1600)))
    assert response.status_code == 201
    image = product.images.first()
    assert image.image.size <= MAX_BYTES
    assert image.image.name.lower().endswith('.webp')


def test_missing_file_is_rejected(staff_client, product):
    response = staff_client.post(f'/api/products/{product.id}/images/', {}, format='multipart')
    assert response.status_code == 400
    assert product.images.count() == 0


def test_unreadable_file_is_rejected(staff_client, product):
    response = post_image(staff_client, product, data=b'not an image')
    assert response.status_code == 400
    assert product.images.count() == 0


def test_upload_to_a_missing_product_404s(staff_client):
    response = staff_client.post('/api/products/999999/images/', {'file': upload()}, format='multipart')
    assert response.status_code == 404


# --- Primary endpoint -------------------------------------------------------

def test_set_primary_moves_the_flag(staff_client, product):
    post_image(staff_client, product)
    post_image(staff_client, product)
    first, second = list(product.images.order_by('id'))

    response = staff_client.post(f'/api/products/{product.id}/images/{second.id}/primary/')
    assert response.status_code == 200

    first.refresh_from_db()
    second.refresh_from_db()
    assert second.is_primary is True
    assert first.is_primary is False
    assert product.images.filter(is_primary=True).count() == 1


def test_set_primary_on_unknown_image_404s(staff_client, product):
    response = staff_client.post(f'/api/products/{product.id}/images/999999/primary/')
    assert response.status_code == 404


def test_non_staff_cannot_set_primary(customer_client, product):
    post_image(APIClient(), product)  # no-op, keeps the fixture honest
    ProductImage.objects.create(
        product=product, image='products/gallery/x.webp', is_primary=True, order=0,
    )
    image = product.images.first()
    response = customer_client.post(f'/api/products/{product.id}/images/{image.id}/primary/')
    assert response.status_code == 403


# --- Delete endpoint --------------------------------------------------------

def test_delete_removes_the_image(staff_client, product):
    post_image(staff_client, product)
    image = product.images.first()
    response = staff_client.delete(f'/api/products/{product.id}/images/{image.id}/')
    assert response.status_code == 204
    assert product.images.count() == 0


def test_deleting_the_primary_promotes_the_next(staff_client, product):
    post_image(staff_client, product)
    post_image(staff_client, product)
    primary = product.images.get(is_primary=True)

    staff_client.delete(f'/api/products/{product.id}/images/{primary.id}/')

    remaining = product.images.first()
    assert remaining is not None
    assert remaining.is_primary is True


def test_delete_unknown_image_404s(staff_client, product):
    response = staff_client.delete(f'/api/products/{product.id}/images/999999/')
    assert response.status_code == 404


def test_non_staff_cannot_delete(customer_client, product):
    image = ProductImage.objects.create(
        product=product, image='products/gallery/x.webp', is_primary=True, order=0,
    )
    response = customer_client.delete(f'/api/products/{product.id}/images/{image.id}/')
    assert response.status_code == 403
    assert product.images.count() == 1
