"""Admin management for AI access tokens, including the one-time token reveal."""
from django import forms
from django.contrib import admin, messages
from django.http import HttpResponseForbidden, HttpResponseRedirect
from django.template.response import TemplateResponse
from django.urls import reverse
from django.utils import timezone

from .constants import ALL_SCOPES, DEFAULT_SCOPES
from .models import DEFAULT_TTL_MINUTES, AIAccessLog, AIAccessToken
from .services import generate_raw_token

TTL_CHOICES = [
    (15, '15 minutes'),
    (30, '30 minutes'),
    (60, '1 hour (default)'),
    (120, '2 hours'),
    (480, '8 hours'),
    (1440, '24 hours'),
]


class AIAccessTokenCreateForm(forms.Form):
    """Deliberately not a ModelForm: the raw token does not exist until save."""

    name = forms.CharField(
        max_length=120,
        initial='AI Assistant',
        help_text='Human label, e.g. "ChatGPT Product Assistant".',
    )
    ttl_minutes = forms.TypedChoiceField(
        label='Validity',
        choices=TTL_CHOICES,
        initial=DEFAULT_TTL_MINUTES,
        coerce=int,
    )
    scopes = forms.MultipleChoiceField(
        choices=[(scope, scope) for scope in sorted(ALL_SCOPES)],
        initial=DEFAULT_SCOPES,
        widget=forms.CheckboxSelectMultiple,
        help_text='Only these operations will be permitted.',
    )
    max_drafts = forms.IntegerField(
        required=False,
        min_value=1,
        help_text='Optional cap on drafts this token may submit. Blank means unlimited.',
    )


@admin.register(AIAccessToken)
class AIAccessTokenAdmin(admin.ModelAdmin):
    list_display = (
        'name', 'token_prefix', 'status', 'scopes_display',
        'drafts_created', 'max_drafts', 'created_at', 'expires_at',
    )
    list_filter = ('created_at', 'expires_at', 'revoked_at')
    search_fields = ('name', 'token_prefix')
    readonly_fields = (
        'token_prefix', 'token_hash', 'created_by', 'created_at',
        'last_used_at', 'usage_count', 'drafts_created',
    )
    exclude = ('token_hash',)
    actions = ['revoke_selected']

    def get_form(self, request, obj=None, **kwargs):
        # Creation goes through add_view, which needs the bespoke form.
        if obj is None:
            kwargs['form'] = AIAccessTokenCreateForm
        return super().get_form(request, obj, **kwargs)

    def get_fieldsets(self, request, obj=None):
        if obj is None:
            return [(None, {'fields': ('name', 'ttl_minutes', 'scopes', 'max_drafts')})]
        return super().get_fieldsets(request, obj)

    def get_readonly_fields(self, request, obj=None):
        if obj is None:
            return ()
        return self.readonly_fields

    def has_change_permission(self, request, obj=None):
        # Tokens are immutable once created; only revocation is offered.
        if obj is not None:
            return False
        return super().has_change_permission(request, obj)

    def change_view(self, request, object_id, form_url='', extra_context=None):
        # has_change_permission() alone still renders the form (Django only
        # blocks the POST). Refuse the page outright so an admin cannot even
        # see a token as editable; revocation stays on the changelist action.
        return HttpResponseForbidden(
            'AI access tokens are immutable. Use the "Revoke selected" action '
            'on the token list instead.'
        )

    @admin.display(description='Status')
    def status(self, obj):
        if obj.is_revoked:
            return 'revoked'
        if obj.is_expired:
            return 'expired'
        return 'active'

    @admin.display(description='Scopes')
    def scopes_display(self, obj):
        return ', '.join(obj.scopes or []) or '-'

    # --- One-time reveal ----------------------------------------------------
    def add_view(self, request, form_url='', extra_context=None):
        if not self.has_add_permission(request):
            return HttpResponseRedirect(reverse('admin:index'))

        if request.method != 'POST':
            form = AIAccessTokenCreateForm()
            return self._render_create(request, form)

        form = AIAccessTokenCreateForm(request.POST)
        if not form.is_valid():
            return self._render_create(request, form)

        data = form.cleaned_data
        raw_token, prefix, token_hash = generate_raw_token()

        token = AIAccessToken(
            name=data['name'],
            token_prefix=prefix,
            token_hash=token_hash,
            scopes=list(data['scopes']),
            created_by=request.user if request.user.is_authenticated else None,
            expires_at=timezone.now() + timezone.timedelta(minutes=data['ttl_minutes']),
            max_drafts=data['max_drafts'],
        )
        token.full_clean(exclude=['token_hash'])
        token.save()

        AIAccessLog.objects.create(
            token=token,
            token_name=token.name,
            token_prefix=token.token_prefix,
            action=AIAccessLog.ACTION_DRAFT,
            resource='ai_access.AIAccessToken',
            detail=f'Token created with TTL {data["ttl_minutes"]} minutes.',
        )

        # The raw token exists only in this response body. It is not stored in
        # the session, the database or the redirect URL.
        context = {
            **self.admin_site.each_context(request),
            'title': 'AI access token created',
            'raw_token': raw_token,
            'token': token,
            'opts': self.model._meta,
            'ttl_minutes': data['ttl_minutes'],
        }
        return TemplateResponse(
            request,
            'admin/ai_access/ai_access_token_created.html',
            context,
        )

    def _render_create(self, request, form):
        context = {
            **self.admin_site.each_context(request),
            'title': 'Create AI access token',
            'form': form,
            'opts': self.model._meta,
            'has_view_permission': True,
        }
        return TemplateResponse(
            request,
            'admin/ai_access/ai_access_token_create.html',
            context,
        )

    # --- Revocation ---------------------------------------------------------
    @admin.action(description='Revoke selected AI access tokens')
    def revoke_selected(self, request, queryset):
        revoked = 0
        for token in queryset:
            if token.revoked_at is None:
                token.revoke()
                AIAccessLog.objects.create(
                    token=token,
                    token_name=token.name,
                    token_prefix=token.token_prefix,
                    action=AIAccessLog.ACTION_DENIED,
                    resource='ai_access.AIAccessToken',
                    detail='Token revoked by administrator.',
                )
                revoked += 1
        self.message_user(
            request,
            f'{revoked} token(s) revoked.',
            level=messages.WARNING if revoked else messages.INFO,
        )


@admin.register(AIAccessLog)
class AIAccessLogAdmin(admin.ModelAdmin):
    list_display = (
        'created_at', 'token_prefix', 'token_name', 'action',
        'resource', 'status_code', 'ip_address',
    )
    list_filter = ('action', 'created_at')
    search_fields = ('token_name', 'token_prefix', 'resource', 'detail')
    readonly_fields = tuple(f.name for f in AIAccessLog._meta.fields)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
