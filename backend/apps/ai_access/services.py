"""
Token generation, hashing and verification for AI access tokens.

Design notes
------------
* 32 random bytes come from ``secrets.token_bytes``, i.e. 256 bits of entropy.
  No salt is stored: the secret is already high-entropy random data, so a plain
  SHA-256 digest is sufficient and lets us look the token up by an indexed
  prefix without a per-row salt lookup.
* Verification uses ``hmac.compare_digest`` rather than ``==`` so a comparison
  cannot leak information through timing.
* The raw token is returned to the caller exactly once, at creation. It is never
  persisted, never logged and never placed in a URL by this module.
"""
import base64
import hashlib
import hmac
import secrets

TOKEN_PREFIX = 'ai_'
TOKEN_BYTES = 32
_PREFIX_HEX_BYTES = 4  # 8 hex characters, used for indexed lookup


def _b64url(raw):
    """URL-safe base64 without padding, so the token needs no escaping."""
    return base64.urlsafe_b64encode(raw).rstrip(b'=').decode('ascii')


def generate_raw_token():
    """Return ``(raw_token, prefix, token_hash)`` for a new 256-bit token."""
    prefix = secrets.token_hex(_PREFIX_HEX_BYTES)
    secret = _b64url(secrets.token_bytes(TOKEN_BYTES))
    raw_token = f'{TOKEN_PREFIX}{prefix}_{secret}'
    return raw_token, prefix, hash_token(raw_token)


def hash_token(raw_token):
    """SHA-256 hex digest of the full raw token."""
    return hashlib.sha256(raw_token.encode('utf-8')).hexdigest()


def parse_prefix(raw_token):
    """Extract the lookup prefix, or ``None`` if the shape is wrong."""
    if not raw_token or not raw_token.startswith(TOKEN_PREFIX):
        return None
    remainder = raw_token[len(TOKEN_PREFIX):]
    prefix, sep, secret = remainder.partition('_')
    if not sep or not prefix or not secret:
        return None
    if len(prefix) != _PREFIX_HEX_BYTES * 2:
        return None
    try:
        int(prefix, 16)
    except ValueError:
        return None
    return prefix


def tokens_match(stored_hash, raw_token):
    """Constant-time comparison of a presented token against a stored hash."""
    if not stored_hash or not raw_token:
        return False
    return hmac.compare_digest(stored_hash, hash_token(raw_token))
