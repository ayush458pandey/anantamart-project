"""Models for temporary, scoped AI access tokens."""
from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

from .constants import ALL_SCOPES

#: Default lifetime for a newly created token, in minutes.
DEFAULT_TTL_MINUTES = 60


class AIAccessToken(models.Model):
    """
    A short-lived bearer token that lets an AI assistant use a narrow subset of
    the API. The raw token is shown once at creation and only its SHA-256 hash
    is stored.
    """

    name = models.CharField(
        max_length=120,
        help_text='Human label, e.g. "ChatGPT Product Assistant".',
    )
    token_prefix = models.CharField(
        max_length=12,
        db_index=True,
        help_text='Public part of the token, safe to display for identification.',
    )
    token_hash = models.CharField(
        max_length=64,
        unique=True,
        help_text='SHA-256 hex digest of the full token. Never the token itself.',
    )
    scopes = models.JSONField(
        default=list,
        help_text='Allowlisted scopes granted to this token.',
    )

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='ai_access_tokens',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(db_index=True)
    revoked_at = models.DateTimeField(null=True, blank=True, db_index=True)

    last_used_at = models.DateTimeField(null=True, blank=True)
    usage_count = models.PositiveIntegerField(default=0)
    drafts_created = models.PositiveIntegerField(default=0)
    max_drafts = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text='Optional cap on drafts this token may submit. Blank means unlimited.',
    )

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'AI access token'
        verbose_name_plural = 'AI access tokens'

    def __str__(self):
        # Deliberately excludes the hash: this string lands in admin lists,
        # logs and error pages.
        return f'{self.name} ({self.token_prefix}…)'

    def __repr__(self):
        return f'<AIAccessToken pk={self.pk} prefix={self.token_prefix}>'

    # --- Validation ---------------------------------------------------------
    def clean(self):
        super().clean()
        if not isinstance(self.scopes, list):
            raise ValidationError({'scopes': 'Scopes must be a list.'})
        unknown = sorted(set(self.scopes) - ALL_SCOPES)
        if unknown:
            raise ValidationError(
                {'scopes': f'Unknown scope(s): {", ".join(unknown)}. '
                           f'Allowed: {", ".join(sorted(ALL_SCOPES))}.'}
            )
        duplicates = len(self.scopes) != len(set(self.scopes))
        if duplicates:
            raise ValidationError({'scopes': 'Duplicate scopes are not allowed.'})

    # --- State --------------------------------------------------------------
    @property
    def is_revoked(self):
        return self.revoked_at is not None

    @property
    def is_expired(self):
        return timezone.now() >= self.expires_at

    @property
    def is_active(self):
        """Usable right now. Revocation always wins over a future expiry."""
        return not self.is_revoked and not self.is_expired

    @property
    def quota_reached(self):
        if self.max_drafts is None:
            return False
        return self.drafts_created >= self.max_drafts

    def has_scope(self, scope):
        return scope in (self.scopes or [])

    # --- Mutations ----------------------------------------------------------
    def revoke(self, when=None):
        """Revoke immediately. Idempotent: the first timestamp is kept."""
        if self.revoked_at is None:
            self.revoked_at = when or timezone.now()
            self.save(update_fields=['revoked_at'])
        return self.revoked_at


class AIAccessLog(models.Model):
    """
    Append-only audit trail. Rows outlive the token they reference, so history
    survives revocation and deletion (``token`` becomes NULL on delete while the
    denormalised name/prefix keep the record readable).
    """

    ACTION_READ = 'read'
    ACTION_DRAFT = 'draft'
    ACTION_IMAGE = 'image'
    ACTION_DENIED = 'denied'
    ACTION_CHOICES = [
        (ACTION_READ, 'Read'),
        (ACTION_DRAFT, 'Draft'),
        (ACTION_IMAGE, 'Image'),
        (ACTION_DENIED, 'Denied'),
    ]

    token = models.ForeignKey(
        AIAccessToken,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='logs',
    )
    token_name = models.CharField(max_length=120)
    token_prefix = models.CharField(max_length=12)

    action = models.CharField(max_length=16, choices=ACTION_CHOICES)
    resource = models.CharField(
        max_length=120,
        blank=True,
        help_text='Endpoint or model touched, e.g. "products.Product".',
    )
    detail = models.TextField(blank=True)
    status_code = models.PositiveSmallIntegerField(null=True, blank=True)

    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'AI access log'
        verbose_name_plural = 'AI access logs'
        indexes = [
            # Phase 2 writes one row per API request and the admin always reads
            # "this token, newest first". Named explicitly so a future Django
            # version cannot silently rename it (see apps/orders migration 0008).
            models.Index(
                fields=['token', 'created_at'],
                name='ai_log_token_created_idx',
            ),
        ]

    def __str__(self):
        return f'{self.created_at:%Y-%m-%d %H:%M} {self.token_prefix} {self.action}'
