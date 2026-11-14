"""
Phase 1 tests for the AI access token infrastructure.

Scope: the model, token generation, hashing, expiry, revocation, scopes and the
audit log. No HTTP layer exists yet, so nothing here makes a request.
"""
import re

import pytest
from django.core.exceptions import ValidationError
from django.db import IntegrityError, connection, transaction
from django.utils import timezone

from apps.ai_access.constants import (
    ALL_SCOPES,
    DEFAULT_SCOPES,
    SCOPE_PRODUCT_DRAFT,
    SCOPE_TAXONOMY_READ,
)
from apps.ai_access.models import DEFAULT_TTL_MINUTES, AIAccessLog, AIAccessToken
from apps.ai_access.services import (
    TOKEN_PREFIX,
    generate_raw_token,
    hash_token,
    parse_prefix,
    tokens_match,
)


pytestmark = pytest.mark.django_db


def make_token(**overrides):
    """Create a persisted token, returning ``(instance, raw_token)``."""
    raw_token, prefix, token_hash = generate_raw_token()
    defaults = {
        'name': 'Test Assistant',
        'token_prefix': prefix,
        'token_hash': token_hash,
        'scopes': list(DEFAULT_SCOPES),
        'expires_at': timezone.now() + timezone.timedelta(minutes=DEFAULT_TTL_MINUTES),
    }
    defaults.update(overrides)
    token = AIAccessToken(**defaults)
    token.full_clean(exclude=['token_hash'])
    token.save()
    return token, raw_token


# --- 1. Token generation -----------------------------------------------------

def test_token_has_256_bits_of_entropy():
    _raw, _prefix, _hash = generate_raw_token()
    raw, prefix, digest = generate_raw_token()
    secret = raw.split('_', 2)[2]
    # 32 bytes base64url-encoded without padding is 43 characters.
    assert len(secret) == 43
    assert len(digest) == 64


def test_token_format_is_prefixed():
    raw, prefix, _digest = generate_raw_token()
    assert raw.startswith(TOKEN_PREFIX)
    assert raw.split('_')[1] == prefix
    assert len(prefix) == 8
    int(prefix, 16)  # hex-parseable


def test_tokens_are_unique_across_many_generations():
    raw_tokens = {generate_raw_token()[0] for _ in range(1000)}
    assert len(raw_tokens) == 1000


def test_stored_value_never_equals_raw_token():
    token, raw_token = make_token()
    assert token.token_hash != raw_token
    assert raw_token not in token.token_hash
    assert len(token.token_hash) == 64


def test_hash_is_deterministic_and_verifies():
    raw, _prefix, digest = generate_raw_token()
    assert hash_token(raw) == digest
    assert tokens_match(digest, raw) is True
    assert tokens_match(digest, raw + 'x') is False


def test_parse_prefix_rejects_malformed_tokens():
    assert parse_prefix('') is None
    assert parse_prefix('nope') is None
    assert parse_prefix('ai_') is None
    assert parse_prefix('ai_abc') is None
    assert parse_prefix('ai_zzzzzzzz_secret') is None  # not hex


def test_token_hash_is_unique_in_database():
    token, _raw = make_token()
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            AIAccessToken.objects.create(
                name='duplicate',
                token_prefix=token.token_prefix,
                token_hash=token.token_hash,
                scopes=[],
                expires_at=timezone.now() + timezone.timedelta(hours=1),
            )


# --- 2. Expiry ---------------------------------------------------------------

def test_expiry_is_in_the_future_by_default():
    token, _raw = make_token()
    delta = token.expires_at - timezone.now()
    assert timezone.timedelta(minutes=59) < delta <= timezone.timedelta(minutes=60)


def test_fresh_token_is_active():
    token, _raw = make_token()
    assert token.is_active is True
    assert token.is_expired is False
    assert token.is_revoked is False


def test_expired_token_is_not_active():
    token, _raw = make_token(
        expires_at=timezone.now() - timezone.timedelta(seconds=1)
    )
    assert token.is_expired is True
    assert token.is_active is False


# --- 3. Revocation -----------------------------------------------------------

def test_revoked_token_is_not_active():
    token, _raw = make_token()
    token.revoke()
    assert token.revoked_at is not None
    assert token.is_revoked is True
    assert token.is_active is False


def test_revocation_wins_over_a_future_expiry():
    token, _raw = make_token()
    assert token.is_expired is False
    token.revoke()
    assert token.is_active is False


def test_revoke_is_idempotent_and_keeps_the_first_timestamp():
    token, _raw = make_token()
    first = token.revoke()
    second = token.revoke()
    token.refresh_from_db()
    assert token.revoked_at == first
    assert second == first


def test_revocation_persists_to_the_database():
    token, _raw = make_token()
    token.revoke()
    token.refresh_from_db()
    assert token.revoked_at is not None


# --- 4. Scopes ---------------------------------------------------------------

def test_has_scope_matches_granted_scopes():
    token, _raw = make_token(scopes=[SCOPE_TAXONOMY_READ])
    assert token.has_scope(SCOPE_TAXONOMY_READ) is True
    assert token.has_scope(SCOPE_PRODUCT_DRAFT) is False


def test_unknown_scope_is_rejected():
    raw_token, prefix, token_hash = generate_raw_token()
    token = AIAccessToken(
        name='bad scope',
        token_prefix=prefix,
        token_hash=token_hash,
        scopes=['product:delete'],  # not in the allowlist
        expires_at=timezone.now() + timezone.timedelta(hours=1),
    )
    with pytest.raises(ValidationError) as exc:
        token.clean()
    assert 'Unknown scope' in str(exc.value)


def test_scopes_must_be_a_list():
    raw_token, prefix, token_hash = generate_raw_token()
    token = AIAccessToken(
        name='not a list',
        token_prefix=prefix,
        token_hash=token_hash,
        scopes='taxonomy:read',
        expires_at=timezone.now() + timezone.timedelta(hours=1),
    )
    with pytest.raises(ValidationError) as exc:
        token.clean()
    assert 'must be a list' in str(exc.value)


def test_duplicate_scopes_are_rejected():
    raw_token, prefix, token_hash = generate_raw_token()
    token = AIAccessToken(
        name='dupes',
        token_prefix=prefix,
        token_hash=token_hash,
        scopes=[SCOPE_TAXONOMY_READ, SCOPE_TAXONOMY_READ],
        expires_at=timezone.now() + timezone.timedelta(hours=1),
    )
    with pytest.raises(ValidationError) as exc:
        token.clean()
    assert 'Duplicate' in str(exc.value)


def test_default_scopes_exclude_destructive_operations():
    for forbidden in ('product:update', 'product:delete', 'product:publish'):
        assert forbidden not in ALL_SCOPES
        assert forbidden not in DEFAULT_SCOPES


def test_scope_surface_is_exactly_the_drafting_workflow():
    """The AI is a drafting assistant. Any new scope must be a deliberate,
    reviewed change to this list, not an accident."""
    assert ALL_SCOPES == {'taxonomy:read', 'product:draft', 'image:upload'}


def test_no_scope_grants_access_to_other_business_domains():
    forbidden_fragments = (
        'order', 'customer', 'payment', 'inventory', 'user',
        'publish', 'delete', 'update', 'admin', 'settings',
    )
    for scope in ALL_SCOPES:
        for fragment in forbidden_fragments:
            assert fragment not in scope, f'{scope!r} grants {fragment!r}'


# --- 5. Product quota --------------------------------------------------------

def test_null_max_drafts_means_unlimited():
    token, _raw = make_token(max_drafts=None, drafts_created=10_000)
    assert token.quota_reached is False


def test_quota_reached_at_the_limit():
    token, _raw = make_token(max_drafts=2, drafts_created=2)
    assert token.quota_reached is True


def test_quota_not_reached_below_the_limit():
    token, _raw = make_token(max_drafts=2, drafts_created=1)
    assert token.quota_reached is False


# --- 6. Audit log ------------------------------------------------------------

def test_audit_log_records_creation():
    token, _raw = make_token()
    log = AIAccessLog.objects.create(
        token=token,
        token_name=token.name,
        token_prefix=token.token_prefix,
        action=AIAccessLog.ACTION_DRAFT,
        resource='ai_access.AIAccessToken',
    )
    assert log.pk is not None
    assert log.created_at is not None


def test_audit_log_survives_token_deletion():
    token, _raw = make_token()
    AIAccessLog.objects.create(
        token=token,
        token_name=token.name,
        token_prefix=token.token_prefix,
        action=AIAccessLog.ACTION_DRAFT,
    )
    token.delete()
    log = AIAccessLog.objects.get()
    assert log.token is None
    assert log.token_name == 'Test Assistant'
    assert log.token_prefix


# --- 7. Leak prevention ------------------------------------------------------

def test_str_and_repr_never_expose_the_hash():
    token, _raw = make_token()
    for rendered in (str(token), repr(token)):
        assert token.token_hash not in rendered
        assert _raw not in rendered


def test_raw_token_is_not_stored_anywhere_on_the_row():
    token, raw_token = make_token()
    for field in token._meta.fields:
        value = getattr(token, field.name)
        assert raw_token not in str(value)


# --- Admin one-time reveal -------------------------------------------------

ADD_URL = '/admin/ai_access/aiaccesstoken/add/'
RAW_TOKEN_RE = re.compile(r'id="raw-token"[^>]*>([^<]+)<')


@pytest.fixture
def staff_client(client, django_user_model):
    user = django_user_model.objects.create_user(
        username='ai-admin', password='pw-for-tests',
        is_staff=True, is_superuser=True,
    )
    client.force_login(user)
    return client


def create_via_admin(staff_client, **overrides):
    """POST the admin create form and return ``(response, raw_token)``."""
    payload = {
        'name': 'ChatGPT Product Assistant',
        'ttl_minutes': '60',
        'scopes': [SCOPE_TAXONOMY_READ, SCOPE_PRODUCT_DRAFT],
    }
    payload.update(overrides)
    response = staff_client.post(ADD_URL, payload)
    match = RAW_TOKEN_RE.search(response.content.decode())
    return response, (match.group(1).strip() if match else None)


def test_admin_add_page_renders_the_create_form(staff_client):
    response = staff_client.get(ADD_URL)
    assert response.status_code == 200
    assert b'ttl_minutes' in response.content


def test_admin_create_shows_the_raw_token_exactly_once(staff_client):
    response, raw_token = create_via_admin(staff_client)

    assert response.status_code == 200
    assert raw_token is not None
    assert raw_token.startswith(TOKEN_PREFIX)
    # Exactly one occurrence in the whole page: no hidden duplicate field.
    assert response.content.decode().count(raw_token) == 1


def test_admin_create_persists_only_the_hash(staff_client):
    _response, raw_token = create_via_admin(staff_client, name='Hash Check')

    token = AIAccessToken.objects.get(name='Hash Check')
    assert token.token_hash == hash_token(raw_token)
    assert raw_token not in token.token_hash
    assert token.token_prefix == parse_prefix(raw_token)
    assert token.scopes == [SCOPE_TAXONOMY_READ, SCOPE_PRODUCT_DRAFT]
    assert token.max_drafts is None
    assert token.is_active


def test_admin_create_never_echoes_the_hash(staff_client):
    response, _raw = create_via_admin(staff_client, name='No Hash Echo')
    token = AIAccessToken.objects.get(name='No Hash Echo')
    assert token.token_hash not in response.content.decode()


def test_admin_create_applies_the_selected_ttl(staff_client):
    before = timezone.now()
    create_via_admin(staff_client, name='Short Lived', ttl_minutes='15')

    token = AIAccessToken.objects.get(name='Short Lived')
    delta = (token.expires_at - before).total_seconds()
    assert 14 * 60 <= delta <= 16 * 60


def test_admin_create_defaults_to_one_hour(staff_client):
    before = timezone.now()
    create_via_admin(staff_client, name='Default TTL')

    token = AIAccessToken.objects.get(name='Default TTL')
    delta = (token.expires_at - before).total_seconds()
    assert 59 * 60 <= delta <= 61 * 60


def test_admin_create_records_the_creating_staff_user(staff_client):
    create_via_admin(staff_client, name='Attributed')
    token = AIAccessToken.objects.get(name='Attributed')
    assert token.created_by is not None
    assert token.created_by.username == 'ai-admin'


def test_admin_create_writes_an_audit_log(staff_client):
    create_via_admin(staff_client, name='Audited')

    log = AIAccessLog.objects.get(action=AIAccessLog.ACTION_DRAFT)
    assert log.token_name == 'Audited'
    assert log.token is not None


def test_admin_create_rejects_an_unknown_scope(staff_client):
    response, raw_token = create_via_admin(
        staff_client, name='Bad Scope', scopes=['product:delete'],
    )
    assert response.status_code == 200
    assert raw_token is None
    assert not AIAccessToken.objects.filter(name='Bad Scope').exists()


def test_admin_create_requires_staff(client, django_user_model):
    user = django_user_model.objects.create_user(
        username='plain-user', password='pw-for-tests',
    )
    client.force_login(user)
    assert client.get(ADD_URL).status_code == 302


def test_admin_cannot_edit_an_existing_token(staff_client):
    token, _raw = make_token()
    url = f'/admin/ai_access/aiaccesstoken/{token.pk}/change/'

    # The page itself is refused, not just the save.
    assert staff_client.get(url).status_code == 403
    assert staff_client.post(url, {'name': 'Hijacked', 'scopes': []}).status_code == 403

    token.refresh_from_db()
    assert token.name != 'Hijacked'


def test_admin_token_changelist_still_offers_revocation(staff_client):
    token, _raw = make_token()
    response = staff_client.get('/admin/ai_access/aiaccesstoken/')

    assert response.status_code == 200
    assert b'revoke_selected' in response.content
    assert token.token_prefix.encode() in response.content


def test_admin_revoke_action_revokes_and_logs(staff_client):
    token, _raw = make_token()
    staff_client.post(
        '/admin/ai_access/aiaccesstoken/',
        {'action': 'revoke_selected', '_selected_action': [str(token.pk)]},
    )
    token.refresh_from_db()
    assert token.is_revoked
    assert AIAccessLog.objects.filter(
        action=AIAccessLog.ACTION_DENIED, token=token,
    ).exists()


def test_audit_log_admin_is_read_only(staff_client):
    log = AIAccessLog.objects.create(
        token_name='x', token_prefix='abc', action=AIAccessLog.ACTION_DRAFT,
    )
    base = f'/admin/ai_access/aiaccesslog/{log.pk}/'

    # Viewable for auditing, but never addable, editable or deletable.
    assert staff_client.get(f'{base}change/').status_code == 200
    assert staff_client.post(f'{base}change/', {'token_name': 'x'}).status_code == 403
    assert staff_client.get('/admin/ai_access/aiaccesslog/add/').status_code == 403
    assert staff_client.get(f'{base}delete/').status_code == 403
    assert AIAccessLog.objects.filter(pk=log.pk).exists()


# --- Audit log indexing ----------------------------------------------------

def test_audit_log_has_a_token_created_at_index():
    """Phase 2 writes a row per request; the admin reads token+newest-first."""
    with connection.cursor() as cursor:
        constraints = connection.introspection.get_constraints(
            cursor, AIAccessLog._meta.db_table,
        )
    matching = [
        name for name, info in constraints.items()
        if info.get('index') and info.get('columns') == ['token_id', 'created_at']
    ]
    assert matching, f'no (token, created_at) index; found {sorted(constraints)}'
