"""Tests for the restricted AI API: auth, scopes, taxonomy, drafts, audit."""
import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.ai_access.constants import (
    SCOPE_IMAGE_UPLOAD, SCOPE_PRODUCT_DRAFT, SCOPE_TAXONOMY_READ,
)
from apps.ai_access.models import AIAccessLog, AIAccessToken
from apps.ai_access.services import generate_raw_token
from apps.products.models import Brand, Category, Product, Subcategory, TagGroup

TAXONOMY_URL = '/api/ai/v1/taxonomy/'
DRAFTS_URL = '/api/ai/v1/drafts/'

pytestmark = pytest.mark.django_db


def make_token(scopes=None, **overrides):
    raw, prefix, token_hash = generate_raw_token()
    defaults = {
        'name': 'Test AI',
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


@pytest.fixture
def taxonomy(db):
    category = Category.objects.create(name='Stationery')
    Subcategory.objects.create(name='Erasers', category=category)
    Brand.objects.create(name='Apsara')
    TagGroup.objects.create(name='Business Type')
    return category


def draft_payload(**overrides):
    payload = {
        'name': 'Apsara Non-Dust Eraser',
        'sku': 'APS-ER-500',
        'description': 'White non-dust eraser.',
        'category_name': 'Stationery',
        'subcategory_name': 'Erasers',
        'brand_name': 'Apsara',
        'base_price': '5.00',
        'mrp': '10.00',
        'tax_rate': '18.00',
        'moq': 10,
        'case_size': 100,
        'stock': 500,
    }
    payload.update(overrides)
    return payload


# --- Authentication ---------------------------------------------------------

def test_valid_token_can_read_taxonomy(taxonomy):
    _token, raw = make_token()
    response = client_for(raw).get(TAXONOMY_URL)
    assert response.status_code == 200, response.content
    body = response.json()
    assert body['categories'][0]['name'] == 'Stationery'
    assert body['categories'][0]['subcategories'][0]['name'] == 'Erasers'
    assert body['brands'][0]['name'] == 'Apsara'


def test_missing_authorization_header_is_401(taxonomy):
    assert APIClient().get(TAXONOMY_URL).status_code == 401


def test_malformed_token_is_401(taxonomy):
    assert client_for('not-a-token').get(TAXONOMY_URL).status_code == 401


def test_wrong_secret_with_valid_prefix_is_401(taxonomy):
    token, _raw = make_token()
    forged = f'ai_{token.token_prefix}_' + 'A' * 43
    assert client_for(forged).get(TAXONOMY_URL).status_code == 401


def test_expired_token_is_401(taxonomy):
    _token, raw = make_token(expires_at=timezone.now() - timezone.timedelta(minutes=1))
    assert client_for(raw).get(TAXONOMY_URL).status_code == 401


def test_revoked_token_is_401(taxonomy):
    token, raw = make_token()
    token.revoke()
    assert client_for(raw).get(TAXONOMY_URL).status_code == 401


def test_request_user_stays_none(taxonomy):
    """The AI token must never impersonate a user, or is_staff checks would pass."""
    _token, raw = make_token()
    response = client_for(raw).get(TAXONOMY_URL)
    # DRF leaves request.user as None because authenticate() returned (None, token).
    assert response.wsgi_request.user is None
    assert isinstance(response.wsgi_request.auth, AIAccessToken)


# --- Scopes -----------------------------------------------------------------

def test_missing_scope_is_403(taxonomy):
    _token, raw = make_token(scopes=[SCOPE_TAXONOMY_READ])
    assert client_for(raw).post(DRAFTS_URL, draft_payload(), format='json').status_code == 403


def test_taxonomy_scope_does_not_grant_draft_creation(taxonomy):
    _token, raw = make_token(scopes=[SCOPE_TAXONOMY_READ])
    client_for(raw).post(DRAFTS_URL, draft_payload(), format='json')
    assert not Product.objects.exists()


def test_draft_scope_does_not_grant_taxonomy_read(taxonomy):
    _token, raw = make_token(scopes=[SCOPE_PRODUCT_DRAFT])
    assert client_for(raw).get(TAXONOMY_URL).status_code == 403


# --- Draft creation ---------------------------------------------------------

def test_draft_is_created_inactive(taxonomy):
    _token, raw = make_token()
    response = client_for(raw).post(DRAFTS_URL, draft_payload(), format='json')
    assert response.status_code == 200, response.content

    created = response.json()['created']
    assert len(created) == 1
    product = Product.objects.get(pk=created[0]['id'])
    assert product.is_active is False
    assert product.sku == 'APS-ER-500'


def test_payload_cannot_force_is_active(taxonomy):
    _token, raw = make_token()
    response = client_for(raw).post(
        DRAFTS_URL, draft_payload(is_active=True), format='json',
    )
    assert response.status_code == 200
    product = Product.objects.get(pk=response.json()['created'][0]['id'])
    assert product.is_active is False


def test_draft_records_source_token(taxonomy):
    token, raw = make_token()
    response = client_for(raw).post(DRAFTS_URL, draft_payload(), format='json')
    product = Product.objects.get(pk=response.json()['created'][0]['id'])
    assert product.source_token_id == token.id


def test_unknown_category_is_rejected_without_creating_a_row(taxonomy):
    _token, raw = make_token()
    response = client_for(raw).post(
        DRAFTS_URL, draft_payload(category_name='Nonexistent'), format='json',
    )
    body = response.json()
    assert body['created'] == []
    assert body['failed'][0]['errors']['category_name'][0]['code'] == 'category_not_found'
    assert not Product.objects.exists()


def test_unknown_brand_is_rejected(taxonomy):
    _token, raw = make_token()
    response = client_for(raw).post(
        DRAFTS_URL, draft_payload(brand_name='Apsra'), format='json',
    )
    assert response.json()['failed'][0]['errors']['brand_name'][0]['code'] == 'brand_not_found'


def test_bulk_one_bad_row_does_not_discard_the_good_one(taxonomy):
    _token, raw = make_token()
    response = client_for(raw).post(
        DRAFTS_URL,
        {'products': [draft_payload(), draft_payload(sku='APS-ER-501', brand_name='Nope')]},
        format='json',
    )
    body = response.json()
    assert len(body['created']) == 1
    assert len(body['failed']) == 1
    assert body['failed'][0]['index'] == 1
    assert Product.objects.count() == 1


def test_duplicate_sku_is_rejected(taxonomy):
    _token, raw = make_token()
    client = client_for(raw)
    client.post(DRAFTS_URL, draft_payload(), format='json')
    response = client.post(DRAFTS_URL, draft_payload(), format='json')
    assert response.json()['created'] == []
    assert 'sku' in response.json()['failed'][0]['errors']


def test_bulk_limit_is_enforced(taxonomy):
    _token, raw = make_token()
    response = client_for(raw).post(
        DRAFTS_URL, {'products': [draft_payload()] * 51}, format='json',
    )
    assert response.status_code == 400


def test_quota_is_enforced(taxonomy):
    token, raw = make_token(max_drafts=1)
    client = client_for(raw)
    client.post(DRAFTS_URL, draft_payload(), format='json')
    response = client.post(DRAFTS_URL, draft_payload(sku='APS-ER-502'), format='json')

    assert response.json()['created'] == []
    assert 'quota' in str(response.json()['failed'][0]['errors']).lower()
    token.refresh_from_db()
    assert token.drafts_created == 1


def test_drafts_created_counter_increments(taxonomy):
    token, raw = make_token()
    client_for(raw).post(DRAFTS_URL, draft_payload(), format='json')
    token.refresh_from_db()
    assert token.drafts_created == 1


# --- Audit ------------------------------------------------------------------

def test_taxonomy_read_is_logged(taxonomy):
    _token, raw = make_token()
    client_for(raw).get(TAXONOMY_URL)
    log = AIAccessLog.objects.get(action=AIAccessLog.ACTION_READ)
    assert log.status_code == 200


def test_draft_creation_is_logged(taxonomy):
    _token, raw = make_token()
    client_for(raw).post(DRAFTS_URL, draft_payload(), format='json')
    log = AIAccessLog.objects.get(action=AIAccessLog.ACTION_DRAFT)
    assert log.status_code == 200
    assert 'created=1' in log.detail


def test_denied_request_is_logged(taxonomy):
    _token, raw = make_token(scopes=[SCOPE_TAXONOMY_READ])
    client_for(raw).post(DRAFTS_URL, draft_payload(), format='json')
    assert AIAccessLog.objects.filter(status_code=403).exists()


def test_audit_log_records_ip_and_user_agent(taxonomy):
    _token, raw = make_token()
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {raw}')
    client.get(TAXONOMY_URL, HTTP_USER_AGENT='TestAgent/1.0')
    log = AIAccessLog.objects.get(action=AIAccessLog.ACTION_READ)
    assert log.user_agent == 'TestAgent/1.0'
    assert log.ip_address is not None


# --- Boundary ---------------------------------------------------------------

def test_ai_token_cannot_use_the_public_product_api(taxonomy):
    """The AI token is not a JWT, so ProductViewSet must not accept it."""
    _token, raw = make_token()
    response = client_for(raw).post('/api/products/', draft_payload(), format='json')
    assert response.status_code in (401, 403)


def test_ai_token_cannot_reach_the_admin(taxonomy):
    _token, raw = make_token()
    response = client_for(raw).get('/admin/')
    assert response.status_code in (302, 403)


def test_no_publish_endpoint_exists(taxonomy):
    _token, raw = make_token()
    client = client_for(raw)
    for method in ('post', 'patch', 'put', 'delete'):
        response = getattr(client, method)(f'{DRAFTS_URL}1/', {}, format='json')
        assert response.status_code in (404, 405)
