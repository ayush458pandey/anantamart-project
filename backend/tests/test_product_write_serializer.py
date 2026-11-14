"""Tests for ProductWriteSerializer.

Covers the 22 scenarios agreed in review: happy paths, taxonomy resolution,
SKU handling, draft protection, nested validation and transaction rollback.

Run with:
    python -m pytest tests/test_product_write_serializer.py -v
"""
from decimal import Decimal
from io import BytesIO
from unittest import mock

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image

from apps.products.models import (
    Brand,
    Category,
    PriceTier,
    Product,
    ProductImage,
    ProductTag,
    ProductVariant,
    Subcategory,
    TagGroup,
)
from apps.products.serializers import ProductSerializer, ProductWriteSerializer


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

def png_file(name='test.png'):
    """A real, Pillow-decodable PNG so ImageField validation passes."""
    buffer = BytesIO()
    Image.new('RGB', (2, 2), (200, 30, 30)).save(buffer, format='PNG')
    return SimpleUploadedFile(name, buffer.getvalue(), content_type='image/png')


@pytest.fixture
def taxonomy(db):
    """A minimal but realistic taxonomy tree."""
    stationery = Category.objects.create(name='Stationery')
    erasers = Subcategory.objects.create(name='Erasers', category=stationery)
    scissors = Subcategory.objects.create(name='Scissors', category=stationery)

    kitchen = Category.objects.create(name='Kitchen')
    Subcategory.objects.create(name='Cookware', category=kitchen)

    apsara = Brand.objects.create(name='Apsara')

    use_case = TagGroup.objects.create(name='Use Case')
    school = ProductTag.objects.create(name='School Supplies', group=use_case)
    office = ProductTag.objects.create(name='Office', group=use_case)
    school.subcategories.add(erasers)

    return {
        'category': stationery,
        'erasers': erasers,
        'scissors': scissors,
        'kitchen': kitchen,
        'brand': apsara,
        'tag_school': school,
        'tag_office': office,
    }


def base_payload(taxonomy, **overrides):
    payload = {
        'name': 'Apsara Non-Dust Eraser',
        'sku': 'APS-ER-001',
        'description': 'Non-dust eraser for everyday writing.',
        'category_name': 'Stationery',
        'subcategory_name': 'Erasers',
        'brand_name': 'Apsara',
        'base_price': '5.00',
        'mrp': '10.00',
        'moq': 20,
        'case_size': 20,
        'unit': 'Piece',
        'tax_rate': '18.00',
        'tag_names': ['School Supplies'],
    }
    payload.update(overrides)
    return payload


def create_product(taxonomy, **overrides):
    """Validate and save a product, failing loudly on validation errors."""
    serializer = ProductWriteSerializer(data=base_payload(taxonomy, **overrides))
    assert serializer.is_valid(), serializer.errors
    return serializer.save()


# ---------------------------------------------------------------------------
# 1-2. happy paths
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_create_minimal_product(taxonomy):
    """Scenario 1: only the required fields, no brand, tags or nested data."""
    serializer = ProductWriteSerializer(data={
        'name': 'Plain Notebook',
        'sku': 'NB-001',
        'description': 'A plain ruled notebook.',
        'category_name': 'Stationery',
        'base_price': '40.00',
    })

    assert serializer.is_valid(), serializer.errors
    product = serializer.save()

    assert Product.objects.count() == 1
    assert product.name == 'Plain Notebook'
    assert product.sku == 'nb-001'
    assert product.category == taxonomy['category']
    assert product.subcategory is None
    assert product.brand == 'Generic'
    assert product.brand_ref is None
    assert product.base_price == Decimal('40.00')
    assert product.tax_rate == Decimal('18.00')
    assert product.moq == 1
    assert product.case_size == 1
    assert product.stock == 0
    assert product.has_variants is False
    assert product.slug == 'plain-notebook'


@pytest.mark.django_db
def test_create_full_product(taxonomy):
    """Scenario 2: brand, tags, 3 gallery images, 2 tiers and 3 variants."""
    payload = base_payload(
        taxonomy,
        images=[
            {'image': png_file('a.png'), 'is_primary': True, 'alt_text': 'front'},
            {'image': png_file('b.png')},
            {'image': png_file('c.png')},
        ],
        tiers=[
            {'min_quantity': 1, 'max_quantity': 9, 'price': '5.00'},
            {'min_quantity': 10, 'max_quantity': None, 'price': '4.50'},
        ],
        variants=[
            {'variant_type': 'Size', 'name': 'Small', 'base_price': '5.00', 'mrp': '10.00'},
            {'variant_type': 'Size', 'name': 'Medium', 'base_price': '6.00', 'mrp': '12.00'},
            {'variant_type': 'Colour', 'name': 'Red', 'hex_color': '#FF0000'},
        ],
    )

    serializer = ProductWriteSerializer(data=payload)
    assert serializer.is_valid(), serializer.errors
    product = serializer.save()

    assert product.brand == 'Apsara'
    assert product.brand_ref == taxonomy['brand']
    assert list(product.tags.values_list('name', flat=True)) == ['School Supplies']
    assert product.images.count() == 3
    assert product.images.filter(is_primary=True).count() == 1
    assert product.images.get(is_primary=True).alt_text == 'front'
    assert product.tiers.count() == 2
    assert product.variants.count() == 3
    assert product.has_variants is True
    assert product.variants.get(name='Red').hex_color == '#FF0000'


# ---------------------------------------------------------------------------
# 3-5. brand handling
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_brand_omitted_defaults_to_generic(taxonomy):
    """Scenario 3: omitted brand keeps brand='Generic' and brand_ref=None."""
    payload = base_payload(taxonomy)
    payload.pop('brand_name')

    serializer = ProductWriteSerializer(data=payload)
    assert serializer.is_valid(), serializer.errors
    product = serializer.save()

    assert product.brand == 'Generic'
    assert product.brand_ref is None


@pytest.mark.django_db
def test_blank_brand_defaults_to_generic(taxonomy):
    """An explicitly blank brand is treated the same as an omitted one."""
    serializer = ProductWriteSerializer(data=base_payload(taxonomy, brand_name='   '))
    assert serializer.is_valid(), serializer.errors
    product = serializer.save()

    assert product.brand == 'Generic'
    assert product.brand_ref is None


@pytest.mark.django_db
def test_brand_matching_is_case_insensitive(taxonomy):
    """Scenario 4: 'apsara' resolves to the existing 'Apsara' brand."""
    serializer = ProductWriteSerializer(data=base_payload(taxonomy, brand_name='apsara'))
    assert serializer.is_valid(), serializer.errors
    product = serializer.save()

    assert product.brand_ref == taxonomy['brand']
    assert product.brand == 'Apsara'
    assert Brand.objects.count() == 1


@pytest.mark.django_db
def test_unknown_brand_returns_structured_error(taxonomy):
    """Scenario 5: unknown brands are flagged, never auto-created."""
    serializer = ProductWriteSerializer(data=base_payload(taxonomy, brand_name='Nonexistent'))

    assert not serializer.is_valid()
    error = serializer.errors['brand_name'][0]
    assert error['code'] == 'brand_not_found'
    assert 'Nonexistent' in error['detail']
    assert Brand.objects.count() == 1
    assert Product.objects.count() == 0


# ---------------------------------------------------------------------------
# 6-7. category / subcategory resolution
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_unknown_category_returns_structured_error(taxonomy):
    """Scenario 6a: unknown category is rejected with a structured code."""
    serializer = ProductWriteSerializer(data=base_payload(taxonomy, category_name='Nope'))

    assert not serializer.is_valid()
    error = serializer.errors['category_name'][0]
    assert error['code'] == 'category_not_found'
    assert Category.objects.count() == 2
    assert Product.objects.count() == 0


@pytest.mark.django_db
def test_unknown_subcategory_returns_structured_error(taxonomy):
    """Scenario 6b: unknown subcategory is rejected with a structured code."""
    serializer = ProductWriteSerializer(
        data=base_payload(taxonomy, subcategory_name='Staplers')
    )

    assert not serializer.is_valid()
    error = serializer.errors['subcategory_name'][0]
    assert error['code'] == 'subcategory_not_found'
    assert Subcategory.objects.count() == 3
    assert Product.objects.count() == 0


@pytest.mark.django_db
def test_subcategory_from_other_category_is_rejected(taxonomy):
    """Scenario 7: a subcategory must belong to the selected category."""
    serializer = ProductWriteSerializer(
        data=base_payload(taxonomy, subcategory_name='Cookware')
    )

    assert not serializer.is_valid()
    error = serializer.errors['subcategory_name'][0]
    assert error['code'] == 'subcategory_not_found'
    assert 'Stationery' in error['detail']


@pytest.mark.django_db
def test_category_matching_is_case_insensitive(taxonomy):
    serializer = ProductWriteSerializer(
        data=base_payload(taxonomy, category_name='stationery', subcategory_name='erasers')
    )
    assert serializer.is_valid(), serializer.errors
    product = serializer.save()

    assert product.category == taxonomy['category']
    assert product.subcategory == taxonomy['erasers']


# ---------------------------------------------------------------------------
# 8. tags
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_unknown_tag_returns_structured_error(taxonomy):
    """Scenario 8a: unknown tags are rejected, never auto-created."""
    serializer = ProductWriteSerializer(
        data=base_payload(taxonomy, tag_names=['School Supplies', 'Ghost Tag'])
    )

    assert not serializer.is_valid()
    error = serializer.errors['tag_names'][0]
    assert error['code'] == 'tag_not_found'
    assert 'Ghost Tag' in error['detail']
    assert ProductTag.objects.count() == 2
    assert Product.objects.count() == 0


@pytest.mark.django_db
def test_ambiguous_tag_is_rejected(taxonomy):
    """Scenario 8b: a name matching two tags is rejected, not guessed."""
    group = TagGroup.objects.create(name='Size')
    ProductTag.objects.create(name='Large', slug='large-a', group=group)
    ProductTag.objects.create(name='Large', slug='large-b', group=group)

    serializer = ProductWriteSerializer(data=base_payload(taxonomy, tag_names=['Large']))

    assert not serializer.is_valid()
    error = serializer.errors['tag_names'][0]
    assert error['code'] == 'tag_ambiguous'


@pytest.mark.django_db
def test_tag_not_linked_to_subcategory_is_allowed(taxonomy):
    """Decision 3: an unlinked tag is accepted (a warning, not an error)."""
    serializer = ProductWriteSerializer(
        data=base_payload(taxonomy, tag_names=['Office'])
    )
    assert serializer.is_valid(), serializer.errors
    product = serializer.save()

    assert list(product.tags.values_list('name', flat=True)) == ['Office']


@pytest.mark.django_db
def test_duplicate_tag_names_are_deduplicated(taxonomy):
    serializer = ProductWriteSerializer(
        data=base_payload(taxonomy, tag_names=['Office', 'office', 'Office'])
    )
    assert serializer.is_valid(), serializer.errors
    product = serializer.save()

    assert product.tags.count() == 1


# ---------------------------------------------------------------------------
# 9-10. SKU handling
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_duplicate_sku_is_rejected(taxonomy):
    """Scenario 9a: an exact duplicate SKU is rejected."""
    create_product(taxonomy)

    serializer = ProductWriteSerializer(
        data=base_payload(taxonomy, name='Another Eraser')
    )

    assert not serializer.is_valid()
    assert 'already exists' in str(serializer.errors['sku'][0])
    assert Product.objects.count() == 1


@pytest.mark.django_db
def test_duplicate_sku_different_case_is_rejected(taxonomy):
    """Scenario 9b: case-insensitive duplicate detection."""
    create_product(taxonomy)

    serializer = ProductWriteSerializer(
        data=base_payload(taxonomy, name='Another Eraser', sku='aps-er-001')
    )

    assert not serializer.is_valid()
    assert 'already exists' in str(serializer.errors['sku'][0])
    assert Product.objects.count() == 1


@pytest.mark.django_db
def test_sku_is_normalised_to_lowercase(taxonomy):
    """Scenario 10: lowercase input is stored uppercase."""
    serializer = ProductWriteSerializer(data=base_payload(taxonomy, sku='APS-ER-001'))
    assert serializer.is_valid(), serializer.errors
    product = serializer.save()

    assert product.sku == 'aps-er-001'


@pytest.mark.django_db
def test_blank_sku_is_rejected(taxonomy):
    serializer = ProductWriteSerializer(data=base_payload(taxonomy, sku='   '))

    assert not serializer.is_valid()
    assert 'sku' in serializer.errors


# ---------------------------------------------------------------------------
# 11. draft protection
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_is_active_is_forced_to_false(taxonomy):
    """Scenario 11: publishing is a separate action; imports always land as drafts."""
    serializer = ProductWriteSerializer(data=base_payload(taxonomy, is_active=True))
    assert serializer.is_valid(), serializer.errors
    product = serializer.save()

    assert product.is_active is False
    product.refresh_from_db()
    assert product.is_active is False


# ---------------------------------------------------------------------------
# 12-13. gallery images
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_multiple_primary_images_are_rejected(taxonomy):
    """Scenario 12: two is_primary=True images is a validation error."""
    serializer = ProductWriteSerializer(data=base_payload(taxonomy, images=[
        {'image': png_file('a.png'), 'is_primary': True},
        {'image': png_file('b.png'), 'is_primary': True},
    ]))

    assert not serializer.is_valid()
    assert 'images' in serializer.errors
    assert 'Only one gallery image' in str(serializer.errors['images'][0])
    assert Product.objects.count() == 0
    assert ProductImage.objects.count() == 0


@pytest.mark.django_db
def test_first_image_becomes_primary_when_none_specified(taxonomy):
    """Scenario 13: no primary flag means the first image wins."""
    serializer = ProductWriteSerializer(data=base_payload(taxonomy, images=[
        {'image': png_file('a.png')},
        {'image': png_file('b.png')},
    ]))
    assert serializer.is_valid(), serializer.errors
    product = serializer.save()

    assert product.images.count() == 2
    assert product.images.filter(is_primary=True).count() == 1
    assert product.images.get(is_primary=True).order == 0


@pytest.mark.django_db
def test_single_primary_image_is_preserved(taxonomy):
    serializer = ProductWriteSerializer(data=base_payload(taxonomy, images=[
        {'image': png_file('a.png')},
        {'image': png_file('b.png'), 'is_primary': True},
    ]))
    assert serializer.is_valid(), serializer.errors
    product = serializer.save()

    primary = product.images.get(is_primary=True)
    assert primary.order == 1


# ---------------------------------------------------------------------------
# 14. price tiers
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_overlapping_price_tiers_are_rejected(taxonomy):
    """Scenario 14a: overlapping quantity ranges are rejected."""
    serializer = ProductWriteSerializer(data=base_payload(taxonomy, tiers=[
        {'min_quantity': 1, 'max_quantity': 10, 'price': '5.00'},
        {'min_quantity': 10, 'max_quantity': 20, 'price': '4.50'},
    ]))

    assert not serializer.is_valid()
    assert 'overlaps' in str(serializer.errors['tiers'][0])
    assert PriceTier.objects.count() == 0


@pytest.mark.django_db
def test_multiple_open_ended_tiers_are_rejected(taxonomy):
    """Scenario 14b: only one tier may be open-ended."""
    serializer = ProductWriteSerializer(data=base_payload(taxonomy, tiers=[
        {'min_quantity': 1, 'max_quantity': None, 'price': '5.00'},
        {'min_quantity': 10, 'max_quantity': None, 'price': '4.50'},
    ]))

    assert not serializer.is_valid()
    assert 'open-ended' in str(serializer.errors['tiers'][0])


@pytest.mark.django_db
def test_open_ended_tier_must_be_last(taxonomy):
    serializer = ProductWriteSerializer(data=base_payload(taxonomy, tiers=[
        {'min_quantity': 1, 'max_quantity': None, 'price': '5.00'},
        {'min_quantity': 10, 'max_quantity': 20, 'price': '4.50'},
    ]))

    assert not serializer.is_valid()
    assert 'open-ended' in str(serializer.errors['tiers'][0])


@pytest.mark.django_db
def test_tier_price_must_be_positive(taxonomy):
    serializer = ProductWriteSerializer(data=base_payload(taxonomy, tiers=[
        {'min_quantity': 1, 'max_quantity': 10, 'price': '0.00'},
    ]))

    assert not serializer.is_valid()
    assert 'tiers' in serializer.errors


@pytest.mark.django_db
def test_tier_max_must_exceed_min(taxonomy):
    serializer = ProductWriteSerializer(data=base_payload(taxonomy, tiers=[
        {'min_quantity': 10, 'max_quantity': 10, 'price': '5.00'},
    ]))

    assert not serializer.is_valid()
    assert 'tiers' in serializer.errors


# ---------------------------------------------------------------------------
# 15-17. variants
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_duplicate_variant_is_rejected(taxonomy):
    """Scenario 15a: same (variant_type, name) twice is rejected."""
    serializer = ProductWriteSerializer(data=base_payload(taxonomy, variants=[
        {'variant_type': 'Size', 'name': 'Large'},
        {'variant_type': 'size', 'name': 'large'},
    ]))

    assert not serializer.is_valid()
    assert 'Duplicate variant' in str(serializer.errors['variants'][0])
    assert ProductVariant.objects.count() == 0


@pytest.mark.django_db
def test_duplicate_variant_sku_is_rejected(taxonomy):
    """Scenario 15b: two variants sharing a SKU is rejected."""
    serializer = ProductWriteSerializer(data=base_payload(taxonomy, variants=[
        {'variant_type': 'Size', 'name': 'Large', 'sku': 'APS-ER-001-L'},
        {'variant_type': 'Size', 'name': 'Small', 'sku': 'aps-er-001-l'},
    ]))

    assert not serializer.is_valid()
    assert 'Duplicate variant SKU' in str(serializer.errors['variants'][0])


@pytest.mark.django_db
def test_variant_mrp_below_price_is_rejected(taxonomy):
    """Scenario 16: variant MRP must not be lower than the variant price."""
    serializer = ProductWriteSerializer(data=base_payload(taxonomy, variants=[
        {'variant_type': 'Size', 'name': 'Large', 'base_price': '10.00', 'mrp': '9.00'},
    ]))

    assert not serializer.is_valid()
    assert 'mrp' in serializer.errors['variants'][0]


@pytest.mark.django_db
def test_variant_mrp_must_be_positive(taxonomy):
    serializer = ProductWriteSerializer(data=base_payload(taxonomy, variants=[
        {'variant_type': 'Size', 'name': 'Large', 'mrp': '0.00'},
    ]))

    assert not serializer.is_valid()
    assert 'mrp' in serializer.errors['variants'][0]


@pytest.mark.django_db
def test_variant_type_defaults_to_size(taxonomy):
    """Scenario 17: omitting variant_type must not raise KeyError."""
    serializer = ProductWriteSerializer(data=base_payload(taxonomy, variants=[
        {'name': 'Large'},
        {'name': 'Small'},
    ]))
    assert serializer.is_valid(), serializer.errors
    product = serializer.save()

    assert product.variants.count() == 2
    assert set(product.variants.values_list('variant_type', flat=True)) == {'Size'}


@pytest.mark.django_db
def test_variant_type_default_does_not_hide_duplicates(taxonomy):
    """Two variants with no type and the same name are still duplicates."""
    serializer = ProductWriteSerializer(data=base_payload(taxonomy, variants=[
        {'name': 'Large'},
        {'name': 'large'},
    ]))

    assert not serializer.is_valid()
    assert 'Duplicate variant' in str(serializer.errors['variants'][0])


@pytest.mark.django_db
def test_variant_sku_is_normalised_to_lowercase(taxonomy):
    serializer = ProductWriteSerializer(data=base_payload(taxonomy, variants=[
        {'variant_type': 'Size', 'name': 'Large', 'sku': 'aps-l'},
    ]))
    assert serializer.is_valid(), serializer.errors
    product = serializer.save()

    assert product.variants.get(name='Large').sku == 'aps-l'


@pytest.mark.django_db
def test_variant_negative_stock_is_rejected(taxonomy):
    serializer = ProductWriteSerializer(data=base_payload(taxonomy, variants=[
        {'variant_type': 'Size', 'name': 'Large', 'stock': -1},
    ]))

    assert not serializer.is_valid()
    assert 'stock' in serializer.errors['variants'][0]


@pytest.mark.django_db
def test_variant_zero_moq_is_rejected(taxonomy):
    serializer = ProductWriteSerializer(data=base_payload(taxonomy, variants=[
        {'variant_type': 'Size', 'name': 'Large', 'moq': 0},
    ]))

    assert not serializer.is_valid()
    assert 'moq' in serializer.errors['variants'][0]


@pytest.mark.django_db
def test_variant_zero_case_size_is_rejected(taxonomy):
    serializer = ProductWriteSerializer(data=base_payload(taxonomy, variants=[
        {'variant_type': 'Size', 'name': 'Large', 'case_size': 0},
    ]))

    assert not serializer.is_valid()
    assert 'case_size' in serializer.errors['variants'][0]


@pytest.mark.django_db
def test_variant_invalid_hex_colour_is_rejected(taxonomy):
    serializer = ProductWriteSerializer(data=base_payload(taxonomy, variants=[
        {'variant_type': 'Colour', 'name': 'Red', 'hex_color': 'red'},
    ]))

    assert not serializer.is_valid()
    assert 'hex_color' in serializer.errors['variants'][0]


# ---------------------------------------------------------------------------
# 18-19. numeric field validation
# ---------------------------------------------------------------------------

@pytest.mark.django_db
@pytest.mark.parametrize('value', ['18', '18.0', '18.00'])
def test_tax_rate_accepts_equivalent_decimals(taxonomy, value):
    """Scenario 18a: '18', '18.0' and '18.00' all validate."""
    serializer = ProductWriteSerializer(data=base_payload(taxonomy, tax_rate=value))
    assert serializer.is_valid(), serializer.errors
    assert serializer.save().tax_rate == Decimal('18.00')


@pytest.mark.django_db
@pytest.mark.parametrize('value', ['0', '5', '40'])
def test_tax_rate_accepts_all_slabs(taxonomy, value):
    serializer = ProductWriteSerializer(data=base_payload(taxonomy, tax_rate=value))
    assert serializer.is_valid(), serializer.errors


@pytest.mark.django_db
def test_invalid_tax_rate_is_rejected(taxonomy):
    """Scenario 18b: a rate outside the GST slabs is rejected."""
    serializer = ProductWriteSerializer(data=base_payload(taxonomy, tax_rate='12.00'))

    assert not serializer.is_valid()
    assert 'tax_rate' in serializer.errors


@pytest.mark.django_db
def test_product_mrp_below_price_is_rejected(taxonomy):
    """Scenario 19: product MRP must not be lower than the selling price."""
    serializer = ProductWriteSerializer(
        data=base_payload(taxonomy, base_price='10.00', mrp='9.00')
    )

    assert not serializer.is_valid()
    assert 'mrp' in serializer.errors


@pytest.mark.django_db
def test_product_mrp_must_be_positive(taxonomy):
    serializer = ProductWriteSerializer(data=base_payload(taxonomy, mrp='0.00'))

    assert not serializer.is_valid()
    assert 'mrp' in serializer.errors


@pytest.mark.django_db
def test_base_price_must_be_positive(taxonomy):
    serializer = ProductWriteSerializer(data=base_payload(taxonomy, base_price='0.00'))

    assert not serializer.is_valid()
    assert 'base_price' in serializer.errors


@pytest.mark.django_db
def test_negative_purchase_price_is_rejected(taxonomy):
    serializer = ProductWriteSerializer(
        data=base_payload(taxonomy, purchase_price='-1.00')
    )

    assert not serializer.is_valid()
    assert 'purchase_price' in serializer.errors


@pytest.mark.django_db
def test_negative_stock_is_rejected(taxonomy):
    serializer = ProductWriteSerializer(data=base_payload(taxonomy, stock=-5))

    assert not serializer.is_valid()
    assert 'stock' in serializer.errors


@pytest.mark.django_db
def test_zero_moq_is_rejected(taxonomy):
    serializer = ProductWriteSerializer(data=base_payload(taxonomy, moq=0))

    assert not serializer.is_valid()
    assert 'moq' in serializer.errors


@pytest.mark.django_db
def test_zero_case_size_is_rejected(taxonomy):
    serializer = ProductWriteSerializer(data=base_payload(taxonomy, case_size=0))

    assert not serializer.is_valid()
    assert 'case_size' in serializer.errors


@pytest.mark.django_db
def test_blank_description_is_rejected(taxonomy):
    serializer = ProductWriteSerializer(data=base_payload(taxonomy, description='   '))

    assert not serializer.is_valid()
    assert 'description' in serializer.errors


@pytest.mark.django_db
def test_blank_name_is_rejected(taxonomy):
    serializer = ProductWriteSerializer(data=base_payload(taxonomy, name='   '))

    assert not serializer.is_valid()
    assert 'name' in serializer.errors


# ---------------------------------------------------------------------------
# 20. transaction rollback
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_nested_creation_rolls_back_on_failure(taxonomy):
    """Scenario 20: a failure while creating variants leaves no orphan rows."""
    payload = base_payload(
        taxonomy,
        images=[{'image': png_file('a.png')}],
        tiers=[{'min_quantity': 1, 'max_quantity': 10, 'price': '5.00'}],
        variants=[{'variant_type': 'Size', 'name': 'Large'}],
    )

    serializer = ProductWriteSerializer(data=payload)
    assert serializer.is_valid(), serializer.errors

    with mock.patch.object(
        ProductVariant, 'save', side_effect=RuntimeError('simulated failure')
    ):
        with pytest.raises(RuntimeError, match='simulated failure'):
            serializer.save()

    assert Product.objects.count() == 0
    assert ProductImage.objects.count() == 0
    assert PriceTier.objects.count() == 0
    assert ProductVariant.objects.count() == 0


@pytest.mark.django_db
def test_rollback_does_not_remove_pre_existing_rows(taxonomy):
    """Rollback must only undo the failed attempt, not earlier products."""
    create_product(taxonomy)
    assert Product.objects.count() == 1

    serializer = ProductWriteSerializer(
        data=base_payload(
            taxonomy,
            name='Second',
            sku='APS-ER-002',
            variants=[{'variant_type': 'Size', 'name': 'Large'}],
        )
    )
    assert serializer.is_valid(), serializer.errors

    with mock.patch.object(
        ProductVariant, 'save', side_effect=RuntimeError('simulated failure')
    ):
        with pytest.raises(RuntimeError):
            serializer.save()

    assert Product.objects.count() == 1
    assert Product.objects.get().sku == 'aps-er-001'


# ---------------------------------------------------------------------------
# 21. public serializer output
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_created_product_serializes_with_public_serializer(taxonomy):
    """Scenario 21: the created product renders through ProductSerializer."""
    serializer = ProductWriteSerializer(data=base_payload(
        taxonomy,
        images=[{'image': png_file('a.png'), 'is_primary': True}],
        tiers=[{'min_quantity': 1, 'max_quantity': 10, 'price': '5.00'}],
        variants=[{'variant_type': 'Size', 'name': 'Large', 'base_price': '5.00'}],
    ))
    assert serializer.is_valid(), serializer.errors
    product = serializer.save()

    data = ProductSerializer(product).data

    assert data['name'] == 'Apsara Non-Dust Eraser'
    assert data['sku'] == 'aps-er-001'
    assert data['brand'] == 'Apsara'
    assert data['brand_name'] == 'Apsara'
    assert data['category_name'] == 'Stationery'
    assert data['subcategory_name'] == 'Erasers'
    assert data['gst_rate'] == '18.00'
    assert data['is_active'] is False
    assert data['has_variants'] is True
    assert len(data['images']) == 1
    assert len(data['tiers']) == 1
    assert len(data['variants']) == 1
    assert [t['name'] for t in data['tag_list']] == ['School Supplies']


@pytest.mark.django_db
def test_public_serializer_brand_falls_back_to_generic(taxonomy):
    """The read serializer still reports 'Generic' for unbranded products."""
    payload = base_payload(taxonomy)
    payload.pop('brand_name')
    serializer = ProductWriteSerializer(data=payload)
    assert serializer.is_valid(), serializer.errors
    product = serializer.save()

    data = ProductSerializer(product).data
    assert data['brand'] == 'Generic'
    assert data['brand_name'] == 'Generic'
    assert data['brand_ref'] is None


@pytest.mark.django_db
def test_public_serializer_hides_inactive_variants(taxonomy):
    """Existing storefront behaviour: only active variants are returned."""
    serializer = ProductWriteSerializer(data=base_payload(taxonomy, variants=[
        {'variant_type': 'Size', 'name': 'Large', 'is_active': True},
        {'variant_type': 'Size', 'name': 'Small', 'is_active': False},
    ]))
    assert serializer.is_valid(), serializer.errors
    product = serializer.save()

    data = ProductSerializer(product).data
    assert [v['name'] for v in data['variants']] == ['Large']


# =============================================================================
# SKU case standard
# -----------------------------------------------------------------------------
# SKUs are stored lowercase. Case is normalised on write, uniqueness stays
# case-insensitive, and existing rows are never rewritten.
# =============================================================================

def test_uppercase_input_is_stored_lowercase(taxonomy):
    serializer = ProductWriteSerializer(data=base_payload(taxonomy, sku='APSARA-ND-ERASER'))
    assert serializer.is_valid(), serializer.errors
    assert serializer.save().sku == 'apsara-nd-eraser'


def test_mixed_case_input_is_stored_lowercase(taxonomy):
    serializer = ProductWriteSerializer(data=base_payload(taxonomy, sku='Apsara-Nd-Eraser'))
    assert serializer.is_valid(), serializer.errors
    assert serializer.save().sku == 'apsara-nd-eraser'


def test_already_lowercase_sku_is_unchanged(taxonomy):
    serializer = ProductWriteSerializer(data=base_payload(taxonomy, sku='apsara-nd-eraser'))
    assert serializer.is_valid(), serializer.errors
    assert serializer.save().sku == 'apsara-nd-eraser'


def test_uniqueness_is_case_insensitive(taxonomy):
    first = ProductWriteSerializer(data=base_payload(taxonomy, sku='apsara-nd-eraser'))
    assert first.is_valid(), first.errors
    first.save()

    # Same SKU in a different case must still be rejected.
    second = ProductWriteSerializer(data=base_payload(taxonomy, sku='APSARA-ND-ERASER'))
    assert not second.is_valid()
    assert 'sku' in second.errors


def test_existing_uppercase_row_still_blocks_a_lowercase_duplicate(taxonomy):
    """Legacy rows were saved through admin, bypassing the serializer."""
    Product.objects.create(
        name='Legacy', sku='LEGACY-SKU', description='x',
        category=taxonomy['category'], base_price='5.00',
    )
    serializer = ProductWriteSerializer(data=base_payload(taxonomy, sku='legacy-sku'))
    assert not serializer.is_valid()
    assert 'sku' in serializer.errors


def test_existing_sku_is_never_rewritten(taxonomy):
    """A pre-existing mixed-case SKU keeps its stored value."""
    legacy = Product.objects.create(
        name='Legacy', sku='Udyogi-vista-8001-lrx-helmet', description='x',
        category=taxonomy['category'], base_price='5.00',
    )
    other = ProductWriteSerializer(data=base_payload(taxonomy, sku='brand-new-sku'))
    assert other.is_valid(), other.errors
    other.save()

    legacy.refresh_from_db()
    assert legacy.sku == 'Udyogi-vista-8001-lrx-helmet'


def test_draft_update_serializer_lowercases_sku(taxonomy):
    from apps.products.draft_serializers import ProductDraftUpdateSerializer

    product = Product.objects.create(
        name='Draft', sku='old-sku', description='x',
        category=taxonomy['category'], base_price='5.00', is_active=False,
    )
    serializer = ProductDraftUpdateSerializer(
        product, data={'sku': 'NEW-SKU-NAME'}, partial=True,
    )
    assert serializer.is_valid(), serializer.errors
    assert serializer.save().sku == 'new-sku-name'


def test_draft_update_serializer_still_blocks_case_insensitive_clash(taxonomy):
    from apps.products.draft_serializers import ProductDraftUpdateSerializer

    Product.objects.create(
        name='Taken', sku='taken-sku', description='x',
        category=taxonomy['category'], base_price='5.00',
    )
    product = Product.objects.create(
        name='Draft', sku='other-sku', description='x',
        category=taxonomy['category'], base_price='5.00', is_active=False,
    )
    serializer = ProductDraftUpdateSerializer(
        product, data={'sku': 'TAKEN-SKU'}, partial=True,
    )
    assert not serializer.is_valid()
    assert 'sku' in serializer.errors
