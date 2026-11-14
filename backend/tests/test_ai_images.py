"""Tests for AI image upload: validation, normalisation and attachment rules."""
import base64
import io

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from PIL import Image
from rest_framework.test import APIClient

from apps.ai_access.constants import (
    SCOPE_IMAGE_UPLOAD, SCOPE_PRODUCT_DRAFT, SCOPE_TAXONOMY_READ,
)
from apps.ai_access.images import (
    MAX_BYTES, TARGET_HEIGHT, TARGET_WIDTH, ImageRejected, process_upload,
)
from apps.ai_access.models import AIAccessLog, AIAccessToken
from apps.ai_access.services import generate_raw_token
from apps.products.models import Category, Product, ProductImage

pytestmark = pytest.mark.django_db


def make_token(scopes=None, **overrides):
    raw, prefix, token_hash = generate_raw_token()
    defaults = {
        'name': 'Image AI',
        'token_prefix': prefix,
        'token_hash': token_hash,
        'scopes': list(scopes if scopes is not None else
                       (SCOPE_TAXONOMY_READ, SCOPE_PRODUCT_DRAFT, SCOPE_IMAGE_UPLOAD)),
        'expires_at': timezone.now() + timezone.timedelta(hours=1),
    }
    defaults.update(overrides)
    return AIAccessToken.objects.create(**defaults), raw


def client_for(raw):
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {raw}')
    return client


def image_bytes(fmt='JPEG', size=(800, 600), colour=(200, 40, 40)):
    buffer = io.BytesIO()
    Image.new('RGB', size, colour).save(buffer, format=fmt)
    return buffer.getvalue()


def upload(data, name='photo.jpg', content_type='image/jpeg'):
    return SimpleUploadedFile(name, data, content_type=content_type)


@pytest.fixture
def draft(db):
    category = Category.objects.create(name='Stationery')
    token, _raw = make_token()
    product = Product.objects.create(
        name='Draft Eraser', sku='IMG-1', description='x', category=category,
        base_price='5.00', is_active=False, source_token=token,
    )
    return product, token


# --- Pipeline ---------------------------------------------------------------

def test_jpeg_is_converted_to_webp_at_target_size():
    content, width, height, size = process_upload(upload(image_bytes('JPEG')))
    assert (width, height) == (TARGET_WIDTH, TARGET_HEIGHT)
    assert size < MAX_BYTES
    assert content.name.endswith('.webp')

    reopened = Image.open(io.BytesIO(content.read()))
    assert reopened.format == 'WEBP'
    assert reopened.size == (TARGET_WIDTH, TARGET_HEIGHT)


def test_png_and_webp_are_accepted():
    for fmt in ('PNG', 'WEBP'):
        content, _w, _h, size = process_upload(upload(image_bytes(fmt)))
        assert size < MAX_BYTES


def test_non_image_bytes_are_rejected():
    with pytest.raises(ImageRejected):
        process_upload(upload(b'this is not an image', 'fake.jpg'))


def test_zip_renamed_as_jpg_is_rejected():
    import zipfile
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, 'w') as archive:
        archive.writestr('payload.txt', 'x' * 100)
    with pytest.raises(ImageRejected):
        process_upload(upload(buffer.getvalue(), 'archive.jpg'))


def test_oversized_dimensions_are_rejected():
    with pytest.raises(ImageRejected):
        process_upload(upload(image_bytes('PNG', size=(4000, 4000))))


def test_landscape_image_is_padded_not_cropped():
    """A wide image must keep its full width; padding goes on top and bottom."""
    content, _w, _h, _size = process_upload(upload(image_bytes('PNG', size=(1000, 200))))
    img = Image.open(io.BytesIO(content.read())).convert('RGB')
    assert img.size == (TARGET_WIDTH, TARGET_HEIGHT)
    # Top edge is padding (white), middle row contains the red product.
    assert img.getpixel((TARGET_WIDTH // 2, 5)) == (255, 255, 255)
    assert img.getpixel((TARGET_WIDTH // 2, TARGET_HEIGHT // 2)) != (255, 255, 255)


def test_exif_is_stripped():
    buffer = io.BytesIO()
    img = Image.new('RGB', (600, 800), (10, 120, 200))
    exif = img.getexif()
    exif[0x010F] = 'SecretCameraMake'   # Make
    exif[0x0110] = 'SecretCameraModel'  # Model
    img.save(buffer, format='JPEG', exif=exif)

    content, _w, _h, _size = process_upload(upload(buffer.getvalue()))
    out = Image.open(io.BytesIO(content.read()))
    assert not out.getexif()
    assert b'SecretCameraMake' not in content.read()


def test_base64_payload_is_decoded():
    from apps.ai_access.images import decode_base64_payload
    encoded = base64.b64encode(image_bytes('PNG')).decode()
    content = decode_base64_payload(encoded, 'x.png')
    assert content.size > 0


def test_invalid_base64_is_rejected():
    from apps.ai_access.images import decode_base64_payload
    with pytest.raises(ImageRejected):
        decode_base64_payload('!!!not base64!!!')


# --- Endpoint ---------------------------------------------------------------

def test_multipart_upload_attaches_image(draft):
    product, token = draft
    _t, raw = make_token()
    # Re-point the draft at the calling token.
    product.source_token = AIAccessToken.objects.get(token_prefix=raw.split('_')[1])
    product.save(update_fields=['source_token'])

    response = client_for(raw).post(
        f'/api/ai/v1/drafts/{product.id}/images/',
        {'file': upload(image_bytes('JPEG')), 'source_kind': 'web',
         'source_url': 'https://example.com/eraser.jpg', 'alt_text': 'Eraser'},
        format='multipart',
    )
    assert response.status_code == 201, response.content
    body = response.json()
    assert body['width'] == TARGET_WIDTH
    assert body['bytes'] < MAX_BYTES

    image = ProductImage.objects.get(pk=body['id'])
    assert image.product_id == product.id
    assert image.source_kind == 'web'
    assert image.source_url == 'https://example.com/eraser.jpg'
    assert image.uploaded_by_token_id == product.source_token_id
    assert image.is_primary is True


def test_base64_upload_attaches_image(draft):
    product, _token = draft
    _t, raw = make_token()
    product.source_token = AIAccessToken.objects.get(token_prefix=raw.split('_')[1])
    product.save(update_fields=['source_token'])

    response = client_for(raw).post(
        f'/api/ai/v1/drafts/{product.id}/images/',
        {'file_base64': base64.b64encode(image_bytes('PNG')).decode(),
         'filename': 'eraser.png', 'source_kind': 'generated'},
        format='json',
    )
    assert response.status_code == 201, response.content
    assert ProductImage.objects.count() == 1


def test_bad_image_does_not_discard_the_draft(draft):
    product, _token = draft
    _t, raw = make_token()
    product.source_token = AIAccessToken.objects.get(token_prefix=raw.split('_')[1])
    product.save(update_fields=['source_token'])

    response = client_for(raw).post(
        f'/api/ai/v1/drafts/{product.id}/images/',
        {'file': upload(b'not an image', 'bad.jpg')},
        format='multipart',
    )
    assert response.status_code == 400
    assert Product.objects.filter(pk=product.id).exists()
    assert ProductImage.objects.count() == 0


def test_cannot_attach_to_another_tokens_draft(draft):
    product, _owner = draft
    _t, raw = make_token()   # different token
    response = client_for(raw).post(
        f'/api/ai/v1/drafts/{product.id}/images/',
        {'file': upload(image_bytes())},
        format='multipart',
    )
    assert response.status_code == 404
    assert ProductImage.objects.count() == 0


def test_cannot_attach_to_a_published_product(draft):
    product, _token = draft
    _t, raw = make_token()
    product.source_token = AIAccessToken.objects.get(token_prefix=raw.split('_')[1])
    product.is_active = True
    product.save(update_fields=['source_token', 'is_active'])

    response = client_for(raw).post(
        f'/api/ai/v1/drafts/{product.id}/images/',
        {'file': upload(image_bytes())},
        format='multipart',
    )
    assert response.status_code == 409


def test_missing_scope_is_403(draft):
    product, _token = draft
    _t, raw = make_token(scopes=[SCOPE_PRODUCT_DRAFT])
    product.source_token = AIAccessToken.objects.get(token_prefix=raw.split('_')[1])
    product.save(update_fields=['source_token'])

    response = client_for(raw).post(
        f'/api/ai/v1/drafts/{product.id}/images/',
        {'file': upload(image_bytes())},
        format='multipart',
    )
    assert response.status_code == 403


def test_multiple_images_only_one_primary(draft):
    product, _token = draft
    _t, raw = make_token()
    product.source_token = AIAccessToken.objects.get(token_prefix=raw.split('_')[1])
    product.save(update_fields=['source_token'])
    client = client_for(raw)

    for _ in range(3):
        response = client.post(
            f'/api/ai/v1/drafts/{product.id}/images/',
            {'file': upload(image_bytes())},
            format='multipart',
        )
        assert response.status_code == 201

    assert ProductImage.objects.filter(product=product).count() == 3
    assert ProductImage.objects.filter(product=product, is_primary=True).count() == 1


def test_invalid_source_kind_is_rejected(draft):
    product, _token = draft
    _t, raw = make_token()
    product.source_token = AIAccessToken.objects.get(token_prefix=raw.split('_')[1])
    product.save(update_fields=['source_token'])

    response = client_for(raw).post(
        f'/api/ai/v1/drafts/{product.id}/images/',
        {'file': upload(image_bytes()), 'source_kind': 'stolen'},
        format='multipart',
    )
    assert response.status_code == 400


def test_image_upload_is_logged(draft):
    product, _token = draft
    _t, raw = make_token()
    product.source_token = AIAccessToken.objects.get(token_prefix=raw.split('_')[1])
    product.save(update_fields=['source_token'])

    client_for(raw).post(
        f'/api/ai/v1/drafts/{product.id}/images/',
        {'file': upload(image_bytes())},
        format='multipart',
    )
    log = AIAccessLog.objects.get(action=AIAccessLog.ACTION_IMAGE)
    assert log.status_code == 201


def test_source_url_is_never_fetched(draft, monkeypatch):
    """The backend must not dereference source_url."""
    import urllib.request

    def explode(*args, **kwargs):
        raise AssertionError('backend attempted to fetch a URL')

    monkeypatch.setattr(urllib.request, 'urlopen', explode)

    product, _token = draft
    _t, raw = make_token()
    product.source_token = AIAccessToken.objects.get(token_prefix=raw.split('_')[1])
    product.save(update_fields=['source_token'])

    response = client_for(raw).post(
        f'/api/ai/v1/drafts/{product.id}/images/',
        {'file': upload(image_bytes()),
         'source_url': 'http://169.254.169.254/latest/meta-data/'},
        format='multipart',
    )
    assert response.status_code == 201
    assert ProductImage.objects.get().source_url.startswith('http://169.254')
