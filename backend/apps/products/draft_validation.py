"""Validation rules applied before an AI draft may be published.

Approval is the only path that sets is_active=True, so it is the right place to
enforce completeness. Each draft is validated independently: one invalid draft
must never block or corrupt the others in a bulk request.
"""
from decimal import Decimal, InvalidOperation

from django.conf import settings

from .models import Product

#: Fields that must be present and non-empty before publishing.
REQUIRED_TEXT_FIELDS = ('name', 'sku', 'description')

#: Minimum selling price. Zero would make the product free.
MIN_BASE_PRICE = 0


class DraftValidationError(Exception):
    """Raised with a machine-readable reason when a draft cannot be published."""

    def __init__(self, code, detail):
        self.code = code
        self.detail = detail
        super().__init__(detail)


def _as_decimal(value):
    """Coerce a model value to Decimal, tolerating strings on unsaved instances."""
    if value is None or value == '':
        return None
    if isinstance(value, Decimal):
        return value
    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return None


def validate_for_publish(draft):
    """Return a list of ``{code, detail}`` problems. Empty means publishable."""
    problems = []

    for field in REQUIRED_TEXT_FIELDS:
        value = getattr(draft, field, None)
        if not value or not str(value).strip():
            problems.append({
                'code': f'{field}_required',
                'detail': f'{field} must not be empty.',
            })

    if draft.category_id is None:
        problems.append({
            'code': 'category_required',
            'detail': 'A category is required.',
        })
    elif not draft.category.is_active:
        problems.append({
            'code': 'category_inactive',
            'detail': f"Category '{draft.category.name}' is inactive.",
        })

    if draft.subcategory_id is not None:
        if not draft.subcategory.is_active:
            problems.append({
                'code': 'subcategory_inactive',
                'detail': f"Subcategory '{draft.subcategory.name}' is inactive.",
            })
        elif draft.subcategory.category_id != draft.category_id:
            problems.append({
                'code': 'subcategory_mismatch',
                'detail': 'The subcategory does not belong to the selected category.',
            })

    if draft.brand_ref_id is not None and not draft.brand_ref.is_active:
        problems.append({
            'code': 'brand_inactive',
            'detail': f"Brand '{draft.brand_ref.name}' is inactive.",
        })

    base_price = _as_decimal(draft.base_price)
    mrp = _as_decimal(draft.mrp)

    if base_price is None or base_price <= MIN_BASE_PRICE:
        problems.append({
            'code': 'base_price_invalid',
            'detail': 'Selling price must be greater than zero.',
        })

    if mrp is not None and base_price is not None and mrp < base_price:
        problems.append({
            'code': 'mrp_below_price',
            'detail': 'MRP cannot be lower than the selling price.',
        })

    # SKU uniqueness is enforced by the database, but a draft could have been
    # created before another product took the SKU.
    clash = Product.objects.filter(sku__iexact=draft.sku).exclude(pk=draft.pk)
    if draft.sku and clash.exists():
        problems.append({
            'code': 'sku_duplicate',
            'detail': f"SKU '{draft.sku}' is already used by another product.",
        })

    if getattr(settings, 'AI_DRAFT_REQUIRE_IMAGE', True):
        if not draft.images.exists():
            problems.append({
                'code': 'image_required',
                'detail': 'At least one image is required before publishing.',
            })

    return problems
