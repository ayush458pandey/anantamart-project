"""Tests for the staff-only AI draft review API."""
import pytest
from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework.test import APIClient

from apps.ai_access.constants import (
    SCOPE_IMAGE_UPLOAD, SCOPE_PRODUCT_DRAFT, SCOPE_TAXONOMY_READ,
)
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
    return AIAccessToken.objects.create(
        name='Apsara AI', token_prefix=prefix, token_hash=token_hash,
        scopes=[SCOPE_TAXONOMY_READ, SCOPE_PRODUCT_DRAFT, SCOPE_IMAGE_UPLOAD],
        expires_at=timezone.now() + timezone.timedelta(hours=1),
    ), raw


def make_draft(category, token, status='pending', sku='APS-1', with_image=True, **overrides):
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


# --- Access control ---------------------------------------------------------

def test_anonymous_is_denied(category, ai_token):
    token, _raw = ai_token
    make_draft(category, token)
    assert APIClient().get(DRAFTS_URL).status_code in (401, 403)


def test_non_staff_is_denied(customer_client, category, ai_token):
    token, _raw = ai_token
    make_draft(category, token)
    assert customer_client.get(DRAFTS_URL).status_code == 403


def test_ai_token_cannot_reach_the_review_api(category, ai_token):
    """The critical boundary: an AI token must never approve its own drafts."""
    token, raw = ai_token
    draft = make_draft(category, token)

    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {raw}')

    assert client.get(DRAFTS_URL).status_code in (401, 403)
    assert client.post(
        f'{DRAFTS_URL}bulk-approve/', {'ids': [draft.id]}, format='json',
    ).status_code in (401, 403)

    draft.refresh_from_db()
    assert draft.is_active is False
    assert draft.draft_status == 'pending'


def test_staff_can_list(staff_client, category, ai_token):
    token, _raw = ai_token
    make_draft(category, token)
    response = staff_client.get(DRAFTS_URL)
    assert response.status_code == 200


# --- Listing ----------------------------------------------------------------

def test_default_filter_is_pending(staff_client, category, ai_token):
    token, _raw = ai_token
    make_draft(category, token, 'pending', sku='P-1')
    make_draft(category, token, 'approved', sku='A-1')
    make_draft(category, token, 'rejected', sku='R-1')

    body = staff_client.get(DRAFTS_URL).json()
    rows = body['results'] if isinstance(body, dict) else body
    assert [r['sku'] for r in rows] == ['P-1']


def test_status_filters(staff_client, category, ai_token):
    token, _raw = ai_token
    make_draft(category, token, 'pending', sku='P-1')
    make_draft(category, token, 'approved', sku='A-1')
    make_draft(category, token, 'rejected', sku='R-1')

    for status_value, expected in (
        ('approved', ['A-1']), ('rejected', ['R-1']), ('all', None),
    ):
        body = staff_client.get(f'{DRAFTS_URL}?status={status_value}').json()
        rows = body['results'] if isinstance(body, dict) else body
        skus = sorted(r['sku'] for r in rows)
        if expected is None:
            assert skus == ['A-1', 'P-1', 'R-1']
        else:
            assert skus == expected


def test_manually_created_inactive_product_never_appears(staff_client, category):
    Product.objects.create(
        name='Manual Draft', sku='MAN-1', description='x', category=category,
        base_price='5.00', is_active=False, source_token=None, draft_status=None,
    )
    body = staff_client.get(f'{DRAFTS_URL}?status=all').json()
    rows = body['results'] if isinstance(body, dict) else body
    assert rows == []


def test_published_product_does_not_appear(staff_client, category, ai_token):
    token, _raw = ai_token
    make_draft(category, token, 'approved', sku='LIVE-1', is_active=True)
    body = staff_client.get(f'{DRAFTS_URL}?status=pending').json()
    rows = body['results'] if isinstance(body, dict) else body
    assert rows == []


# --- Transitions ------------------------------------------------------------

def test_approve_publishes(staff_client, category, ai_token):
    token, _raw = ai_token
    draft = make_draft(category, token)

    response = staff_client.post(
        f'{DRAFTS_URL}bulk-approve/', {'ids': [draft.id]}, format='json',
    )
    assert response.status_code == 200
    assert response.json()['approved'] == [draft.id]

    draft.refresh_from_db()
    assert draft.is_active is True
    assert draft.draft_status == 'approved'


def test_reject_keeps_the_row_and_the_sku(staff_client, category, ai_token):
    token, _raw = ai_token
    draft = make_draft(category, token, sku='KEEP-1')

    staff_client.post(f'{DRAFTS_URL}bulk-reject/', {'ids': [draft.id]}, format='json')

    draft.refresh_from_db()
    assert draft.draft_status == 'rejected'
    assert draft.is_active is False
    assert Product.objects.filter(sku='KEEP-1').exists()


def test_reopen_moves_rejected_back_to_pending(staff_client, category, ai_token):
    token, _raw = ai_token
    draft = make_draft(category, token, 'rejected')

    response = staff_client.post(
        f'{DRAFTS_URL}bulk-reopen/', {'ids': [draft.id]}, format='json',
    )
    assert response.json()['reopened'] == [draft.id]

    draft.refresh_from_db()
    assert draft.draft_status == 'pending'
    assert draft.is_active is False


def test_approve_skips_a_non_pending_draft(staff_client, category, ai_token):
    token, _raw = ai_token
    draft = make_draft(category, token, 'rejected')

    body = staff_client.post(
        f'{DRAFTS_URL}bulk-approve/', {'ids': [draft.id]}, format='json',
    ).json()
    assert body['approved'] == []
    assert body['skipped'][0]['id'] == draft.id

    draft.refresh_from_db()
    assert draft.is_active is False


def test_bulk_with_mixed_ids_is_partial(staff_client, category, ai_token):
    token, _raw = ai_token
    good = make_draft(category, token, sku='G-1')
    bad = make_draft(category, token, 'approved', sku='B-1')

    body = staff_client.post(
        f'{DRAFTS_URL}bulk-approve/', {'ids': [good.id, bad.id, 999999]},
        format='json',
    ).json()
    assert body['approved'] == [good.id]
    assert len(body['skipped']) == 2


def test_bulk_requires_ids(staff_client):
    assert staff_client.post(
        f'{DRAFTS_URL}bulk-approve/', {}, format='json',
    ).status_code == 400


# --- Editing ----------------------------------------------------------------

def test_patch_updates_allowed_fields(staff_client, category, ai_token):
    token, _raw = ai_token
    draft = make_draft(category, token)

    response = staff_client.patch(
        f'{DRAFTS_URL}{draft.id}/',
        {'name': 'Apsara Eraser (Large)', 'base_price': '7.50'},
        format='json',
    )
    assert response.status_code == 200, response.content

    draft.refresh_from_db()
    assert draft.name == 'Apsara Eraser (Large)'
    assert str(draft.base_price) == '7.50'


def test_patch_cannot_publish(staff_client, category, ai_token):
    token, _raw = ai_token
    draft = make_draft(category, token)

    staff_client.patch(
        f'{DRAFTS_URL}{draft.id}/',
        {'is_active': True, 'draft_status': 'approved'}, format='json',
    )
    draft.refresh_from_db()
    assert draft.is_active is False
    assert draft.draft_status == 'pending'


def test_patch_on_approved_draft_is_409(staff_client, category, ai_token):
    token, _raw = ai_token
    draft = make_draft(category, token, 'approved', is_active=True)

    response = staff_client.patch(
        f'{DRAFTS_URL}{draft.id}/', {'name': 'Changed'}, format='json',
    )
    assert response.status_code == 409


def test_patch_rejects_duplicate_sku(staff_client, category, ai_token):
    token, _raw = ai_token
    make_draft(category, token, sku='TAKEN-1')
    other = make_draft(category, token, sku='OTHER-1')

    response = staff_client.patch(
        f'{DRAFTS_URL}{other.id}/', {'sku': 'taken-1'}, format='json',
    )
    assert response.status_code == 400


# --- Integrity --------------------------------------------------------------

def test_approved_draft_becomes_publicly_visible(staff_client, category, ai_token):
    token, _raw = ai_token
    draft = make_draft(category, token)

    assert APIClient().get(f'/api/products/{draft.id}/').status_code == 404

    staff_client.post(f'{DRAFTS_URL}bulk-approve/', {'ids': [draft.id]}, format='json')

    assert APIClient().get(f'/api/products/{draft.id}/').status_code == 200


def test_rejected_draft_stays_invisible(staff_client, category, ai_token):
    token, _raw = ai_token
    draft = make_draft(category, token)

    staff_client.post(f'{DRAFTS_URL}bulk-reject/', {'ids': [draft.id]}, format='json')

    assert APIClient().get(f'/api/products/{draft.id}/').status_code == 404


def test_rejected_sku_still_blocks_reuse(staff_client, category, ai_token):
    token, _raw = ai_token
    draft = make_draft(category, token, sku='RESERVED-1')
    staff_client.post(f'{DRAFTS_URL}bulk-reject/', {'ids': [draft.id]}, format='json')

    other = make_draft(category, token, sku='OTHER-2')
    response = staff_client.patch(
        f'{DRAFTS_URL}{other.id}/', {'sku': 'RESERVED-1'}, format='json',
    )
    assert response.status_code == 400


# --- Approval validation ----------------------------------------------------

def test_approve_skips_a_draft_without_an_image(staff_client, category, ai_token):
    token, _raw = ai_token
    draft = make_draft(category, token, with_image=False)

    body = staff_client.post(
        f'{DRAFTS_URL}bulk-approve/', {'ids': [draft.id]}, format='json',
    ).json()

    assert body['approved'] == []
    assert body['skipped'][0]['reason'] == 'invalid'
    codes = [p['code'] for p in body['skipped'][0]['problems']]
    assert 'image_required' in codes

    draft.refresh_from_db()
    assert draft.is_active is False
    assert draft.draft_status == 'pending'


def test_approve_skips_a_draft_with_blank_name(staff_client, category, ai_token):
    token, _raw = ai_token
    draft = make_draft(category, token)
    Product.objects.filter(pk=draft.pk).update(name='   ')

    body = staff_client.post(
        f'{DRAFTS_URL}bulk-approve/', {'ids': [draft.id]}, format='json',
    ).json()
    codes = [p['code'] for p in body['skipped'][0]['problems']]
    assert 'name_required' in codes

    draft.refresh_from_db()
    assert draft.is_active is False


def test_approve_skips_a_draft_with_zero_price(staff_client, category, ai_token):
    token, _raw = ai_token
    draft = make_draft(category, token)
    Product.objects.filter(pk=draft.pk).update(base_price=0)

    body = staff_client.post(
        f'{DRAFTS_URL}bulk-approve/', {'ids': [draft.id]}, format='json',
    ).json()
    codes = [p['code'] for p in body['skipped'][0]['problems']]
    assert 'base_price_invalid' in codes


def test_approve_skips_a_draft_with_an_inactive_category(staff_client, category, ai_token):
    token, _raw = ai_token
    draft = make_draft(category, token)
    Category.objects.filter(pk=category.pk).update(is_active=False)

    body = staff_client.post(
        f'{DRAFTS_URL}bulk-approve/', {'ids': [draft.id]}, format='json',
    ).json()
    codes = [p['code'] for p in body['skipped'][0]['problems']]
    assert 'category_inactive' in codes


def test_validator_flags_a_duplicate_sku(category, ai_token, monkeypatch):
    """The DB unique constraint normally prevents this, so the validator branch
    is exercised directly. It exists to turn a race into a clean skip rather
    than an IntegrityError in the middle of a bulk approval."""
    from apps.products import draft_validation

    token, _raw = ai_token
    draft = make_draft(category, token, sku='RACE-1')

    class _Clash:
        def exclude(self, **kwargs):
            return self

        def exists(self):
            return True

    monkeypatch.setattr(
        draft_validation.Product.objects, 'filter', lambda **kw: _Clash(),
    )

    codes = [p['code'] for p in draft_validation.validate_for_publish(draft)]
    assert 'sku_duplicate' in codes


def test_valid_draft_is_approved_alongside_an_invalid_one(staff_client, category, ai_token):
    token, _raw = ai_token
    good = make_draft(category, token, sku='GOOD-1')
    bad = make_draft(category, token, sku='BAD-1', with_image=False)

    body = staff_client.post(
        f'{DRAFTS_URL}bulk-approve/', {'ids': [good.id, bad.id]}, format='json',
    ).json()

    assert body['approved'] == [good.id]
    assert body['skipped'][0]['id'] == bad.id

    good.refresh_from_db()
    bad.refresh_from_db()
    assert good.is_active is True
    assert bad.is_active is False


def test_validation_can_be_relaxed_by_setting(staff_client, category, ai_token, settings):
    settings.AI_DRAFT_REQUIRE_IMAGE = False
    token, _raw = ai_token
    draft = make_draft(category, token, with_image=False)

    body = staff_client.post(
        f'{DRAFTS_URL}bulk-approve/', {'ids': [draft.id]}, format='json',
    ).json()
    assert body['approved'] == [draft.id]


# --- Image management -------------------------------------------------------

def add_image(draft, order=1, primary=False):
    return ProductImage.objects.create(
        product=draft, image='products/gallery/x.webp',
        order=order, is_primary=primary,
    )


def test_reorder_images(staff_client, category, ai_token):
    token, _raw = ai_token
    draft = make_draft(category, token)
    second = add_image(draft, order=1)
    first = draft.images.get(is_primary=True)

    response = staff_client.post(
        f'{DRAFTS_URL}{draft.id}/images/reorder/',
        {'order': [second.id, first.id]}, format='json',
    )
    assert response.status_code == 200, response.content

    first.refresh_from_db()
    second.refresh_from_db()
    assert second.order == 0
    assert first.order == 1


def test_reorder_rejects_an_incomplete_list(staff_client, category, ai_token):
    token, _raw = ai_token
    draft = make_draft(category, token)
    add_image(draft, order=1)

    response = staff_client.post(
        f'{DRAFTS_URL}{draft.id}/images/reorder/',
        {'order': [draft.images.first().id]}, format='json',
    )
    assert response.status_code == 400


def test_set_primary_image_keeps_exactly_one(staff_client, category, ai_token):
    token, _raw = ai_token
    draft = make_draft(category, token)
    other = add_image(draft, order=1)

    response = staff_client.post(
        f'{DRAFTS_URL}{draft.id}/images/{other.id}/primary/', {}, format='json',
    )
    assert response.status_code == 200, response.content

    assert ProductImage.objects.filter(product=draft, is_primary=True).count() == 1
    other.refresh_from_db()
    assert other.is_primary is True


def test_delete_image_promotes_a_replacement_primary(staff_client, category, ai_token):
    token, _raw = ai_token
    draft = make_draft(category, token)
    primary = draft.images.get(is_primary=True)
    add_image(draft, order=1)

    response = staff_client.delete(f'{DRAFTS_URL}{draft.id}/images/{primary.id}/')
    assert response.status_code == 200, response.content

    assert ProductImage.objects.filter(product=draft).count() == 1
    assert ProductImage.objects.filter(product=draft, is_primary=True).count() == 1


def test_delete_last_image_leaves_no_primary(staff_client, category, ai_token):
    token, _raw = ai_token
    draft = make_draft(category, token)
    primary = draft.images.get(is_primary=True)

    staff_client.delete(f'{DRAFTS_URL}{draft.id}/images/{primary.id}/')
    assert ProductImage.objects.filter(product=draft).count() == 0


def test_image_operations_are_blocked_on_approved_drafts(staff_client, category, ai_token):
    token, _raw = ai_token
    draft = make_draft(category, token, 'approved', is_active=True)
    image = draft.images.first()

    assert staff_client.post(
        f'{DRAFTS_URL}{draft.id}/images/reorder/', {'order': [image.id]}, format='json',
    ).status_code == 409
    assert staff_client.post(
        f'{DRAFTS_URL}{draft.id}/images/{image.id}/primary/', {}, format='json',
    ).status_code == 409
    assert staff_client.delete(
        f'{DRAFTS_URL}{draft.id}/images/{image.id}/',
    ).status_code == 409


def test_image_operations_require_staff(customer_client, category, ai_token):
    token, _raw = ai_token
    draft = make_draft(category, token)
    image = draft.images.first()

    assert customer_client.post(
        f'{DRAFTS_URL}{draft.id}/images/reorder/', {'order': [image.id]}, format='json',
    ).status_code == 403
    assert customer_client.delete(
        f'{DRAFTS_URL}{draft.id}/images/{image.id}/',
    ).status_code == 403


def test_ai_token_cannot_manage_images(category, ai_token):
    token, raw = ai_token
    draft = make_draft(category, token)
    image = draft.images.first()

    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {raw}')

    assert client.delete(
        f'{DRAFTS_URL}{draft.id}/images/{image.id}/',
    ).status_code in (401, 403)
    assert ProductImage.objects.filter(pk=image.id).exists()


def test_image_operations_cannot_touch_another_draft(staff_client, category, ai_token):
    token, _raw = ai_token
    draft = make_draft(category, token, sku='OWN-1')
    other = make_draft(category, token, sku='OTHER-1')
    foreign_image = other.images.first()

    response = staff_client.delete(
        f'{DRAFTS_URL}{draft.id}/images/{foreign_image.id}/',
    )
    assert response.status_code == 404
    assert ProductImage.objects.filter(pk=foreign_image.id).exists()
