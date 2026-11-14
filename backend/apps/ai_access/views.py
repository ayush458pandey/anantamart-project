"""Restricted AI API: taxonomy read, draft submission, image attachment.

Every view here is authenticated by an AI service token and authorised by an
explicit scope. Nothing in this module can publish, edit or delete a product.
"""
import ipaddress

from django.db import transaction
from django.db.models import F
from rest_framework import status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.products.models import (
    Brand, Category, Product, ProductImage, TagGroup,
)
from apps.products.serializers import ProductWriteSerializer

from .authentication import AIServiceTokenAuthentication
from .constants import (
    SCOPE_IMAGE_UPLOAD, SCOPE_PRODUCT_DRAFT, SCOPE_TAXONOMY_READ,
)
from .images import ImageRejected, decode_base64_payload, process_upload
from .models import AIAccessLog
from .permissions import HasAIScope
from .throttling import AITokenRateThrottle

#: Maximum drafts accepted in one request.
MAX_DRAFTS_PER_REQUEST = 50


def _client_ip(request):
    """Normalise the client IP, unwrapping IPv4-mapped IPv6 addresses."""
    raw = request.META.get('HTTP_X_FORWARDED_FOR', '').split(',')[0].strip()
    if not raw:
        raw = request.META.get('REMOTE_ADDR', '')
    if not raw:
        return None
    try:
        addr = ipaddress.ip_address(raw)
    except ValueError:
        return None
    if isinstance(addr, ipaddress.IPv6Address) and addr.ipv4_mapped:
        return str(addr.ipv4_mapped)
    return str(addr)


class AIBaseView(APIView):
    """Shared authentication, throttling and audit logging."""

    authentication_classes = [AIServiceTokenAuthentication]
    permission_classes = [HasAIScope]
    throttle_classes = [AITokenRateThrottle]
    required_scopes = ()

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        # Record the request as soon as it is authenticated, so a failure in
        # the handler still leaves a trace.
        self._log_action = getattr(self, 'log_action', AIAccessLog.ACTION_READ)

    def finalize_response(self, request, response, *args, **kwargs):
        token = getattr(request, 'auth', None)
        if token is not None:
            AIAccessLog.objects.create(
                token=token,
                token_name=token.name,
                token_prefix=token.token_prefix,
                action=getattr(self, 'log_action', AIAccessLog.ACTION_READ),
                resource=self.__class__.__name__,
                detail=getattr(self, 'log_detail', ''),
                status_code=response.status_code,
                ip_address=_client_ip(request),
                user_agent=request.META.get('HTTP_USER_AGENT', '')[:255],
            )
        return super().finalize_response(request, response, *args, **kwargs)


class AITaxonomyView(AIBaseView):
    """GET /api/ai/v1/taxonomy/ -- the existing catalogue taxonomy."""

    required_scopes = (SCOPE_TAXONOMY_READ,)
    log_action = AIAccessLog.ACTION_READ

    def get(self, request):
        categories = Category.objects.filter(is_active=True).prefetch_related(
            'subcategories'
        ).order_by('name')

        payload = {
            'categories': [
                {
                    'id': category.id,
                    'name': category.name,
                    'subcategories': [
                        {'id': sub.id, 'name': sub.name}
                        for sub in category.subcategories.all()
                        if sub.is_active
                    ],
                }
                for category in categories
            ],
            'brands': [
                {'id': brand.id, 'name': brand.name}
                for brand in Brand.objects.filter(is_active=True).order_by('name')
            ],
            'tag_groups': [
                {
                    'id': group.id,
                    'name': group.name,
                    'tags': [
                        {'id': tag.id, 'name': tag.name}
                        for tag in group.tags.all()
                        if tag.is_active
                    ],
                }
                for group in TagGroup.objects.filter(is_active=True)
                .prefetch_related('tags').order_by('name')
            ],
        }
        return Response(payload)


class AIProductDraftView(AIBaseView):
    """POST /api/ai/v1/drafts/ -- create one or many draft products."""

    required_scopes = (SCOPE_PRODUCT_DRAFT,)
    log_action = AIAccessLog.ACTION_DRAFT

    def post(self, request):
        items = request.data.get('products')
        if items is None:
            items = [request.data]
        if not isinstance(items, list) or not items:
            return Response(
                {'error': 'Send a product object or {"products": [...]}.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if len(items) > MAX_DRAFTS_PER_REQUEST:
            return Response(
                {'error': f'At most {MAX_DRAFTS_PER_REQUEST} drafts per request.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        token = request.auth
        created, failed = [], []

        for index, item in enumerate(items):
            if not isinstance(item, dict):
                failed.append({'index': index, 'errors': {'detail': 'Not an object.'}})
                continue

            # Quota is checked and consumed under a row lock so two concurrent
            # requests cannot both slip past the limit.
            with transaction.atomic():
                locked = type(token).objects.select_for_update().get(pk=token.pk)
                if locked.quota_reached:
                    failed.append({
                        'index': index,
                        'errors': {'detail': 'Draft quota reached for this token.'},
                    })
                    continue

                serializer = ProductWriteSerializer(
                    data=item, context={'request': request},
                )
                if not serializer.is_valid():
                    failed.append({'index': index, 'errors': serializer.errors})
                    continue

                product = serializer.save()
                # Provenance: only AI-submitted products carry a source token,
                # and only they enter the review queue.
                Product.objects.filter(pk=product.pk).update(
                    source_token=token, draft_status='pending',
                )
                type(token).objects.filter(pk=token.pk).update(
                    drafts_created=F('drafts_created') + 1,
                    usage_count=F('usage_count') + 1,
                )

            created.append({
                'index': index,
                'id': product.id,
                'sku': product.sku,
                'name': product.name,
                'is_active': product.is_active,
            })

        self.log_detail = f'created={len(created)} failed={len(failed)}'
        return Response(
            {'created': created, 'failed': failed},
            status=status.HTTP_200_OK,
        )


class AIDraftImageView(AIBaseView):
    """POST /api/ai/v1/drafts/<id>/images/ -- attach an image to a draft.

    Accepts multipart/form-data (``file``) or JSON (``file_base64``). The
    backend never fetches a URL; ``source_url`` is stored for review only.
    """

    required_scopes = (SCOPE_IMAGE_UPLOAD,)
    log_action = AIAccessLog.ACTION_IMAGE
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request, pk):
        token = request.auth

        # Only drafts this token created, and only while still unpublished.
        draft = Product.objects.filter(pk=pk, source_token=token).first()
        if draft is None:
            return Response(
                {'error': 'Draft not found for this token.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        if draft.is_active:
            return Response(
                {'error': 'This product is already published; images are locked.'},
                status=status.HTTP_409_CONFLICT,
            )

        uploaded = request.FILES.get('file')
        if uploaded is None and request.data.get('file_base64'):
            try:
                uploaded = decode_base64_payload(
                    request.data.get('file_base64'),
                    request.data.get('filename') or 'upload',
                )
            except ImageRejected as exc:
                return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        if uploaded is None:
            return Response(
                {'error': 'Send a "file" upload or a "file_base64" field.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            content, width, height, size = process_upload(uploaded)
        except ImageRejected as exc:
            # The draft is deliberately left untouched: a bad image must never
            # discard good product data.
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        source_kind = request.data.get('source_kind') or ''
        if source_kind and source_kind not in dict(ProductImage.SOURCE_CHOICES):
            return Response(
                {'error': 'source_kind must be one of: '
                          + ', '.join(dict(ProductImage.SOURCE_CHOICES))},
                status=status.HTTP_400_BAD_REQUEST,
            )

        is_primary = str(request.data.get('is_primary', '')).lower() in ('1', 'true', 'yes')
        has_images = draft.images.exists()

        image = ProductImage(
            product=draft,
            alt_text=(request.data.get('alt_text') or '')[:255],
            source_url=(request.data.get('source_url') or '')[:500],
            source_kind=source_kind,
            uploaded_by_token=token,
            order=draft.images.count(),
            is_primary=is_primary or not has_images,
        )
        image.image.save(content.name, content, save=False)
        image.save()

        type(token).objects.filter(pk=token.pk).update(
            usage_count=F('usage_count') + 1,
        )

        self.log_detail = f'draft={draft.pk} image={image.pk} bytes={size}'
        return Response(
            {
                'id': image.id,
                'image_url': request.build_absolute_uri(image.image.url),
                'width': width,
                'height': height,
                'bytes': size,
                'is_primary': image.is_primary,
                'source_kind': image.source_kind,
            },
            status=status.HTTP_201_CREATED,
        )
