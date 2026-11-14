"""Staff-only review API for AI-submitted product drafts.

Every endpoint here requires an authenticated staff user. The AI token cannot
reach any of them: it authenticates through AIServiceTokenAuthentication, which
is not configured on this viewset, and request.user is None for AI requests.
"""
from django.db import transaction
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response

from apps.ai_access.images import ImageRejected, process_upload

from .draft_serializers import (
    DraftImageSerializer, ProductDraftReadSerializer, ProductDraftUpdateSerializer,
)
from .draft_validation import validate_for_publish
from .models import Product, ProductImage

#: Statuses accepted by the ?status= filter.
STATUS_FILTERS = ('pending', 'approved', 'rejected', 'all')


class DraftNotPublishable(Exception):
    """Raised inside a bulk action when a draft fails publish validation."""

    def __init__(self, problems):
        self.problems = problems
        super().__init__('draft is not publishable')


class ProductDraftViewSet(viewsets.ModelViewSet):
    """Review queue for AI drafts.

    Only products with a source_token are visible, so manually created inactive
    products never appear here.
    """

    # IsAdminUser requires is_staff for EVERY method, including GET.
    # IsAdminOrReadOnly would let anonymous users list AI drafts.
    permission_classes = [IsAdminUser]
    http_method_names = ['get', 'patch', 'post', 'delete', 'head', 'options']

    def get_queryset(self):
        queryset = (
            Product.objects
            .filter(source_token__isnull=False)
            .select_related('category', 'subcategory', 'brand_ref', 'source_token')
            .prefetch_related('images')
            .order_by('-created_at')
        )

        # The status filter applies to the list only. Detail and update must
        # reach a draft in any state, otherwise an approved draft would 404.
        if self.action != 'list':
            return queryset

        requested = self.request.query_params.get('status', 'pending')
        if requested not in STATUS_FILTERS:
            requested = 'pending'
        if requested != 'all':
            queryset = queryset.filter(draft_status=requested)
        return queryset

    def get_serializer_class(self):
        if self.action in ('update', 'partial_update'):
            return ProductDraftUpdateSerializer
        return ProductDraftReadSerializer

    def partial_update(self, request, *args, **kwargs):
        draft = self.get_object()
        if draft.draft_status != 'pending':
            return Response(
                {'error': f'Only pending drafts can be edited (this one is {draft.draft_status}).'},
                status=status.HTTP_409_CONFLICT,
            )
        return super().partial_update(request, *args, **kwargs)

    # --- Bulk transitions ---------------------------------------------------
    def _bulk(self, request, target, allowed_from, mutate):
        ids = request.data.get('ids')
        if not isinstance(ids, list) or not ids:
            return Response(
                {'error': 'Send {"ids": [...]}.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        done, skipped = [], []
        for pk in ids:
            with transaction.atomic():
                draft = (
                    Product.objects
                    .select_for_update()
                    .filter(pk=pk, source_token__isnull=False)
                    .first()
                )
                if draft is None:
                    skipped.append({'id': pk, 'reason': 'not an AI draft'})
                    continue
                if draft.draft_status not in allowed_from:
                    skipped.append({
                        'id': pk,
                        'reason': f'status is {draft.draft_status}, expected {allowed_from}',
                    })
                    continue
                try:
                    mutate(draft)
                except DraftNotPublishable as exc:
                    # Invalid drafts are skipped with a reason, never activated.
                    skipped.append({'id': pk, 'reason': 'invalid', 'problems': exc.problems})
                    continue
                done.append(pk)

        return Response({target: done, 'skipped': skipped})

    @action(detail=False, methods=['post'], url_path='bulk-approve')
    def bulk_approve(self, request):
        # Approval is the only path to is_active=True, so completeness is
        # enforced here rather than at draft creation.
        def publish(draft):
            problems = validate_for_publish(draft)
            if problems:
                raise DraftNotPublishable(problems)
            draft.draft_status = 'approved'
            draft.is_active = True
            draft.save(update_fields=['draft_status', 'is_active', 'updated_at'])

        return self._bulk(request, 'approved', ('pending',), publish)

    @action(detail=False, methods=['post'], url_path='bulk-reject')
    def bulk_reject(self, request):
        def reject(draft):
            # Never deleted: the row and its SKU reservation survive.
            draft.draft_status = 'rejected'
            draft.is_active = False
            draft.save(update_fields=['draft_status', 'is_active', 'updated_at'])

        return self._bulk(request, 'rejected', ('pending',), reject)

    @action(detail=False, methods=['post'], url_path='bulk-reopen')
    def bulk_reopen(self, request):
        def reopen(draft):
            draft.draft_status = 'pending'
            draft.is_active = False
            draft.save(update_fields=['draft_status', 'is_active', 'updated_at'])

        return self._bulk(request, 'reopened', ('rejected',), reopen)

    # --- Image management ---------------------------------------------------
    def _pending_draft_or_error(self, pk):
        """Return ``(draft, error_response)`` for image operations."""
        draft = (
            Product.objects
            .filter(pk=pk, source_token__isnull=False)
            .first()
        )
        if draft is None:
            return None, Response(
                {'error': 'Draft not found.'}, status=status.HTTP_404_NOT_FOUND,
            )
        if draft.draft_status != 'pending':
            return None, Response(
                {'error': f'Images are locked once a draft is {draft.draft_status}.'},
                status=status.HTTP_409_CONFLICT,
            )
        return draft, None

    @action(
        detail=True, methods=['post'], url_path='images',
        parser_classes=[MultiPartParser, FormParser],
    )
    def upload_image(self, request, pk=None):
        """POST /api/admin/drafts/<id>/images/ -- staff upload for a pending draft.

        Authenticated by the staff JWT only. The AI token cannot reach this
        viewset (AIServiceTokenAuthentication is not configured here and
        request.user is None for AI requests), so no AI credential is involved.

        Reuses apps.ai_access.images.process_upload, so the catalogue rules are
        identical to the AI path: JPEG/PNG/WebP in, 1120x1400 WebP under 200 KB
        out, EXIF stripped, padded onto white rather than cropped.
        """
        draft, error = self._pending_draft_or_error(pk)
        if error:
            return error

        uploaded = request.FILES.get('file')
        if uploaded is None:
            return Response(
                {'error': 'Send the image as a multipart "file" field.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            content, width, height, size = process_upload(uploaded)
        except ImageRejected as exc:
            # The draft is left untouched: a bad image must never discard
            # good product data.
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        is_primary = str(request.data.get('is_primary', '')).lower() in ('1', 'true', 'yes')
        has_images = draft.images.exists()

        image = ProductImage(
            product=draft,
            alt_text=(request.data.get('alt_text') or '')[:255],
            # Staff-supplied, so provenance is 'user'. uploaded_by_token stays
            # null: this image did not come from an AI token.
            source_kind=ProductImage.SOURCE_USER,
            order=draft.images.count(),
            is_primary=is_primary or not has_images,
        )
        image.image.save(content.name, content, save=False)
        image.save()

        return Response(
            {
                'image': DraftImageSerializer(image, context={'request': request}).data,
                'width': width,
                'height': height,
                'bytes': size,
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['post'], url_path='images/reorder')
    def reorder_images(self, request, pk=None):
        draft, error = self._pending_draft_or_error(pk)
        if error:
            return error

        order = request.data.get('order')
        if not isinstance(order, list) or not order:
            return Response(
                {'error': 'Send {"order": [image_id, ...]}.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        images = {img.id: img for img in draft.images.all()}
        if set(order) != set(images):
            return Response(
                {'error': 'order must list every image of this draft exactly once.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        for position, image_id in enumerate(order):
            images[image_id].order = position
        ProductImage.objects.bulk_update(images.values(), ['order'])

        return Response({'order': order})

    @action(detail=True, methods=['post'], url_path=r'images/(?P<image_id>\d+)/primary')
    def set_primary_image(self, request, pk=None, image_id=None):
        draft, error = self._pending_draft_or_error(pk)
        if error:
            return error

        image = draft.images.filter(pk=image_id).first()
        if image is None:
            return Response(
                {'error': 'Image not found on this draft.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        # ProductImage.save() demotes any other primary, so exactly one remains.
        image.is_primary = True
        image.save(update_fields=['is_primary'])

        return Response({'primary': image.id})

    @action(
        detail=True, methods=['delete'],
        url_path=r'images/(?P<image_id>\d+)',
    )
    def delete_image(self, request, pk=None, image_id=None):
        draft, error = self._pending_draft_or_error(pk)
        if error:
            return error

        image = draft.images.filter(pk=image_id).first()
        if image is None:
            return Response(
                {'error': 'Image not found on this draft.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        was_primary = image.is_primary
        image.delete()

        # Keep exactly one primary whenever images remain.
        remaining = draft.images.order_by('order', 'created_at')
        if was_primary and remaining.exists():
            promoted = remaining.first()
            promoted.is_primary = True
            promoted.save(update_fields=['is_primary'])

        return Response({'deleted': int(image_id), 'remaining': remaining.count()})
