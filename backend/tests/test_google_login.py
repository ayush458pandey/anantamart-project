"""Google sign-in must return the same user shape as /user/me/.

The admin route guard reads ``user.is_staff`` from whatever the login response
stored. GoogleLoginView used to hand-build that object and omit ``is_staff``,
so staff users were bounced off /admin/drafts. These tests pin the contract.
"""
from unittest.mock import patch

import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient

GOOGLE_LOGIN_URL = '/api/user/google-login/'
PROFILE_URL = '/api/user/me/'

# Fields /user/me/ returns. The login response must not be a subset.
EXPECTED_USER_FIELDS = {
    'id', 'username', 'email', 'first_name', 'last_name', 'is_staff', 'profile',
}


def _idinfo(email, given_name='Ayush', family_name='Pandey'):
    return {
        'email': email,
        'given_name': given_name,
        'family_name': family_name,
        'email_verified': True,
    }


@pytest.fixture
def google_client():
    return APIClient()


@pytest.mark.django_db
def test_google_login_returns_is_staff_for_staff_user(google_client):
    """The regression: a staff user must come back with is_staff=True."""
    User.objects.create_user(
        username='staffuser',
        email='staff@anantamart.test',
        password='test-pass-123',
        is_staff=True,
    )

    with patch('apps.users.views.id_token.verify_oauth2_token',
               return_value=_idinfo('staff@anantamart.test')):
        response = google_client.post(
            GOOGLE_LOGIN_URL, {'credential': 'fake'}, format='json'
        )

    assert response.status_code == 200
    assert response.data['user']['is_staff'] is True


@pytest.mark.django_db
def test_google_login_returns_is_staff_false_for_customer(google_client):
    User.objects.create_user(
        username='customer',
        email='customer@anantamart.test',
        password='test-pass-123',
        is_staff=False,
    )

    with patch('apps.users.views.id_token.verify_oauth2_token',
               return_value=_idinfo('customer@anantamart.test')):
        response = google_client.post(
            GOOGLE_LOGIN_URL, {'credential': 'fake'}, format='json'
        )

    assert response.status_code == 200
    assert response.data['user']['is_staff'] is False


@pytest.mark.django_db
def test_google_login_user_shape_matches_profile_endpoint(google_client):
    """Login and /user/me/ must agree, or the guard sees two different truths."""
    user = User.objects.create_user(
        username='staffuser',
        email='staff@anantamart.test',
        password='test-pass-123',
        is_staff=True,
    )

    with patch('apps.users.views.id_token.verify_oauth2_token',
               return_value=_idinfo('staff@anantamart.test')):
        login_response = google_client.post(
            GOOGLE_LOGIN_URL, {'credential': 'fake'}, format='json'
        )

    profile_client = APIClient()
    profile_client.force_authenticate(user=user)
    profile_response = profile_client.get(PROFILE_URL)

    assert login_response.status_code == 200
    assert profile_response.status_code == 200
    assert set(login_response.data['user']) == set(profile_response.data)
    assert set(login_response.data['user']) == EXPECTED_USER_FIELDS


@pytest.mark.django_db
def test_google_login_still_returns_tokens_and_created_flag(google_client):
    """The token contract must survive the user-shape change."""
    with patch('apps.users.views.id_token.verify_oauth2_token',
               return_value=_idinfo('brand-new@anantamart.test')):
        response = google_client.post(
            GOOGLE_LOGIN_URL, {'credential': 'fake'}, format='json'
        )

    assert response.status_code == 200
    assert response.data['access']
    assert response.data['refresh']
    assert response.data['created'] is True
    assert response.data['user']['email'] == 'brand-new@anantamart.test'


@pytest.mark.django_db
def test_google_login_existing_user_is_not_created_again(google_client):
    User.objects.create_user(
        username='returning',
        email='returning@anantamart.test',
        password='test-pass-123',
    )

    with patch('apps.users.views.id_token.verify_oauth2_token',
               return_value=_idinfo('returning@anantamart.test')):
        response = google_client.post(
            GOOGLE_LOGIN_URL, {'credential': 'fake'}, format='json'
        )

    assert response.status_code == 200
    assert response.data['created'] is False
    assert User.objects.filter(email='returning@anantamart.test').count() == 1


@pytest.mark.django_db
def test_google_login_rejects_missing_credential(google_client):
    response = google_client.post(GOOGLE_LOGIN_URL, {}, format='json')
    assert response.status_code == 400


@pytest.mark.django_db
def test_google_login_rejects_invalid_token(google_client):
    with patch('apps.users.views.id_token.verify_oauth2_token',
               side_effect=ValueError('bad token')):
        response = google_client.post(
            GOOGLE_LOGIN_URL, {'credential': 'fake'}, format='json'
        )

    assert response.status_code == 400
    assert 'Invalid Google token' in response.data['error']


@pytest.mark.django_db
def test_password_login_then_profile_exposes_is_staff(google_client):
    """The username/password path must keep working unchanged."""
    User.objects.create_user(
        username='staffuser',
        email='staff@anantamart.test',
        password='test-pass-123',
        is_staff=True,
    )

    token_response = google_client.post(
        '/api/user/login/',
        {'username': 'staffuser', 'password': 'test-pass-123'},
        format='json',
    )
    assert token_response.status_code == 200

    authed = APIClient()
    authed.credentials(
        HTTP_AUTHORIZATION=f"Bearer {token_response.data['access']}"
    )
    profile_response = authed.get(PROFILE_URL)

    assert profile_response.status_code == 200
    assert profile_response.data['is_staff'] is True
