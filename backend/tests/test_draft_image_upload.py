"""Tests for staff image upload on a pending AI draft.

The AI token must never be involved: this endpoint is authenticated by the
staff JWT only. These tests pin that, plus the reuse of the shared image
pipeline (JPEG/PNG/WebP in, 1120x1400 WebP under 200 KB out).
"""
import io

import pytest
from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from PIL import Image
from rest_framework.test import APIClient

from apps.ai_access.constants import (
    SCOPE_IMAGE_UPLOAD, SCOPE_PRODUCT_DRAFT, SCOPE_TAXONOMY_READ,
)
from apps.ai_access.images import MAX_BYTES, TARGET_HEIGHT, TARGET_WIDTH
from apps.ai_access.models import AIAccessToken
from apps.ai_access.services import generate_raw_token
from apps.products.models import Category, Product, ProductImage

DRAFTS_URL = '/api/admin/drafts/'

pytestmark = pytest.mark.django_db


@pytest.fixture
def category(db):
    return Category.objects.create(name='Stationery')


@pytest.fixture
def ai_token(db):
    raw, prefix, token_hash = generate_raw_token()
    token = AIAccessToken.objects.create(
        name='Apsara AI', token_prefix=prefix, token_hash=token_hash,
        scopes=[SCOPE_TAXONOMY_READ, SCOPE_PRODUCT_DRAFT, SCOPE_IMAGE_UPLOAD],
        expires_at=timezone.now() + timezone.timedelta(hours=1),
    )
    return token, raw


def make_draft(category, token, status='pending', sku='APS-1', with_image=False, **overrides):
    defaults = {
        'name': 'Apsara Eraser', 'sku': sku, 'description': 'x',
        'category': category, 'base_price': '5.00', 'is_active': False,
        'source_token': token, 'draft_status': status,
    }
    defaults.update(overrides)
    product = Product.objects.create(**defaults)
    if with_image:
        ProductImage.objects.create(
            product=product, image='products/gallery/test.webp',
            is_primary=True, order=0,
        )
    return product


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


def upload(data, name='photo.jpg', content_type='image/jpeg'):
    return SimpleUploadedFile(name, data, content_type=content_type)


def post_image(client, draft, data=None, **extra):
    payload = {'file': upload(data if data is not None else image_bytes())}
    payload.update(extra)
    return client.post(f'{DRAFTS_URL}{draft.id}/images/', payload, format='multipart')


# --- Access control ---------------------------------------------------------

def test_anonymous_cannot_upload(category, ai_token):
    token, _raw = ai_token
    draft = make_draft(category, token)
    response = post_image(APIClient(), draft)
    assert response.status_code in (401, 403)
    assert draft.images.count() == 0


def test_non_staff_cannot_upload(customer_client, category, ai_token):
    token, _raw = ai_token
    draft = make_draft(category, token)
    response = post_image(customer_client, draft)
    assert response.status_code == 403
    assert draft.images.count() == 0


def test_ai_token_cannot_upload(category, ai_token):
    """The AI token must not authenticate against the staff review API."""
    token, raw = ai_token
    draft = make_draft(category, token)
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {raw}')
    response = post_image(client, draft)
    assert response.status_code in (401, 403)
    assert draft.images.count() == 0


# --- Successful uploads -----------------------------------------------------

@pytest.mark.parametrize('fmt,ext,content_type', [
    ('JPEG', 'jpg', 'image/jpeg'),
    ('PNG', 'png', 'image/png'),
    ('WEBP', 'webp', 'image/webp'),
])
def test_staff_can_upload_each_supported_format(
    staff_client, category, ai_token, fmt, ext, content_type,
):
    token, _raw = ai_token
    draft = make_draft(category, token)

    response = staff_client.post(
        f'{DRAFTS_URL}{draft.id}/images/',
        {'file': upload(image_bytes(fmt), f'photo.{ext}', content_type)},
        format='multipart',
    )

    assert response.status_code == 201
    assert response.data['width'] == TARGET_WIDTH
    assert response.data['height'] == TARGET_HEIGHT
    assert response.data['bytes'] < MAX_BYTES
    assert draft.images.count() == 1


def test_uploaded_file_is_normalised_to_webp(staff_client, category, ai_token):
    token, _raw = ai_token
    draft = make_draft(category, token)

    post_image(staff_client, draft)

    image = draft.images.get()
    assert image.image.name.endswith('.webp')
    with Image.open(image.image.path) as stored:
        assert stored.format == 'WEBP'
        assert stored.size == (TARGET_WIDTH, TARGET_HEIGHT)


def test_first_upload_becomes_primary(staff_client, category, ai_token):
    token, _raw = ai_token
    draft = make_draft(category, token)

    response = post_image(staff_client, draft)

    assert response.status_code == 201
    assert response.data['image']['is_primary'] is True
    assert draft.images.filter(is_primary=True).count() == 1


def test_second_upload_is_not_primary_by_default(staff_client, category, ai_token):
    token, _raw = ai_token
    draft = make_draft(category, token, with_image=True)

    response = post_image(staff_client, draft)

    assert response.status_code == 201
    assert response.data['image']['is_primary'] is False
    assert draft.images.filter(is_primary=True).count() == 1


def test_upload_can_request_primary(staff_client, category, ai_token):
    token, _raw = ai_token
    draft = make_draft(category, token, with_image=True)

    response = post_image(staff_client, draft, is_primary='true')

    assert response.status_code == 201
    assert response.data['image']['is_primary'] is True
    # ProductImage.save() demotes the previous primary.
    assert draft.images.filter(is_primary=True).count() == 1


def test_upload_records_staff_provenance(staff_client, category, ai_token):
    token, _raw = ai_token
    draft = make_draft(category, token)

    post_image(staff_client, draft)

    image = draft.images.get()
    assert image.source_kind == ProductImage.SOURCE_USER
    # Not attributed to an AI token: this came from a staff session.
    assert image.uploaded_by_token is None


def test_upload_appends_to_the_end_of_the_order(staff_client, category, ai_token):
    token, _raw = ai_token
    draft = make_draft(category, token, with_image=True)

    post_image(staff_client, draft)

    orders = list(draft.images.order_by('order').values_list('order', flat=True))
    assert orders == [0, 1]


def test_upload_does_not_publish_or_activate(staff_client, category, ai_token):
    token, _raw = ai_token
    draft = make_draft(category, token)

    post_image(staff_client, draft)

    draft.refresh_from_db()
    assert draft.is_active is False
    assert draft.draft_status == 'pending'


def test_upload_preserves_product_fields(staff_client, category, ai_token):
    token, _raw = ai_token
    draft = make_draft(category, token, sku='apsara-non-dust-eraser')

    post_image(staff_client, draft)

    draft.refresh_from_db()
    assert draft.name == 'Apsara Eraser'
    assert draft.sku == 'apsara-non-dust-eraser'
    assert str(draft.base_price) == '5.00'


# --- Rejections -------------------------------------------------------------

def test_missing_file_is_rejected(staff_client, category, ai_token):
    token, _raw = ai_token
    draft = make_draft(category, token)

    response = staff_client.post(f'{DRAFTS_URL}{draft.id}/images/', {}, format='multipart')

    assert response.status_code == 400
    assert 'file' in response.data['error']
    assert draft.images.count() == 0


def test_non_image_is_rejected(staff_client, category, ai_token):
    token, _raw = ai_token
    draft = make_draft(category, token)

    response = staff_client.post(
        f'{DRAFTS_URL}{draft.id}/images/',
        {'file': upload(b'not an image at all', 'evil.jpg', 'image/jpeg')},
        format='multipart',
    )

    assert response.status_code == 400
    assert draft.images.count() == 0


def test_renamed_archive_is_rejected(staff_client, category, ai_token):
    """A ZIP renamed to .jpg must fail on content, not on filename."""
    token, _raw = ai_token
    draft = make_draft(category, token)

    response = staff_client.post(
        f'{DRAFTS_URL}{draft.id}/images/',
        {'file': upload(b'PK\x03\x04' + b'\x00' * 200, 'photo.jpg', 'image/jpeg')},
        format='multipart',
    )

    assert response.status_code == 400
    assert draft.images.count() == 0


def test_unsupported_format_is_rejected(staff_client, category, ai_token):
    token, _raw = ai_token
    draft = make_draft(category, token)

    buffer = io.BytesIO()
    Image.new('RGB', (100, 100), (10, 10, 10)).save(buffer, format='BMP')

    response = staff_client.post(
        f'{DRAFTS_URL}{draft.id}/images/',
        {'file': upload(buffer.getvalue(), 'photo.bmp', 'image/bmp')},
        format='multipart',
    )

    assert response.status_code == 400
    assert draft.images.count() == 0


def test_oversized_upload_is_rejected(staff_client, category, ai_token):
    token, _raw = ai_token
    draft = make_draft(category, token)

    response = staff_client.post(
        f'{DRAFTS_URL}{draft.id}/images/',
        {'file': upload(b'\x00' * (9 * 1024 * 1024), 'huge.jpg', 'image/jpeg')},
        format='multipart',
    )

    assert response.status_code == 400
    assert draft.images.count() == 0


def test_rejected_upload_leaves_existing_images_intact(staff_client, category, ai_token):
    token, _raw = ai_token
    draft = make_draft(category, token, with_image=True)

    response = staff_client.post(
        f'{DRAFTS_URL}{draft.id}/images/',
        {'file': upload(b'garbage', 'bad.jpg', 'image/jpeg')},
        format='multipart',
    )

    assert response.status_code == 400
    assert draft.images.count() == 1
    assert draft.images.filter(is_primary=True).count() == 1


# --- Draft state guards -----------------------------------------------------

def test_upload_to_approved_draft_is_409(staff_client, category, ai_token):
    token, _raw = ai_token
    draft = make_draft(category, token, status='approved', with_image=True)

    response = post_image(staff_client, draft)

    assert response.status_code == 409
    assert draft.images.count() == 1


def test_upload_to_rejected_draft_is_409(staff_client, category, ai_token):
    token, _raw = ai_token
    draft = make_draft(category, token, status='rejected')

    response = post_image(staff_client, draft)

    assert response.status_code == 409
    assert draft.images.count() == 0


def test_upload_to_unknown_draft_is_404(staff_client):
    response = staff_client.post(
        f'{DRAFTS_URL}999999/images/',
        {'file': upload(image_bytes())},
        format='multipart',
    )
    assert response.status_code == 404


def test_upload_to_a_non_ai_product_is_404(staff_client, category):
    """A manually created inactive product is not a draft and must not accept uploads."""
    manual = Product.objects.create(
        name='Manual', sku='MAN-1', description='x', category=category,
        base_price='5.00', is_active=False,
    )

    response = post_image(staff_client, manual)

    assert response.status_code == 404
    assert manual.images.count() == 0


# --- Interaction with the existing image actions ----------------------------

def test_uploaded_image_can_be_reordered_and_deleted(staff_client, category, ai_token):
    token, _raw = ai_token
    draft = make_draft(category, token, with_image=True)
    post_image(staff_client, draft)

    ids = list(draft.images.order_by('order').values_list('id', flat=True))
    assert len(ids) == 2

    reorder = staff_client.post(
        f'{DRAFTS_URL}{draft.id}/images/reorder/',
        {'order': list(reversed(ids))}, format='json',
    )
    assert reorder.status_code == 200

    delete = staff_client.delete(f'{DRAFTS_URL}{draft.id}/images/{ids[0]}/')
    assert delete.status_code == 200
    assert draft.images.count() == 1


def test_uploaded_image_appears_in_the_draft_read_payload(staff_client, category, ai_token):
    token, _raw = ai_token
    draft = make_draft(category, token)
    post_image(staff_client, draft)

    response = staff_client.get(f'{DRAFTS_URL}{draft.id}/')

    assert response.status_code == 200
    assert len(response.data['images']) == 1
    assert response.data['images'][0]['image_url']
