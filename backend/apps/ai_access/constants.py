"""
Fixed, allowlisted scopes for AI access tokens.

Deny by default: a scope is only valid if it appears in SCOPE_CHOICES. The
model validates against this list, so a typo or a hand-edited admin form
cannot silently grant a permission that no view knows how to enforce.

The AI is a product-drafting assistant, nothing more. It reads the existing
taxonomy, submits drafts for human review and attaches images to those drafts.
It cannot publish, edit live products, delete, or touch orders, customers,
payments, inventory or users -- those operations have no scope at all, so no
token can ever be granted them.
"""

# --- Individual scopes -------------------------------------------------------
SCOPE_TAXONOMY_READ = 'taxonomy:read'
SCOPE_PRODUCT_DRAFT = 'product:draft'
SCOPE_IMAGE_UPLOAD = 'image:upload'

SCOPE_CHOICES = [
    (SCOPE_TAXONOMY_READ, 'Read categories, subcategories, brands and tags'),
    (SCOPE_PRODUCT_DRAFT, 'Submit product drafts for human review'),
    (SCOPE_IMAGE_UPLOAD, 'Attach images to drafts this token created'),
]

ALL_SCOPES = frozenset(value for value, _label in SCOPE_CHOICES)

#: Scopes granted to a newly created token. All three are required for the
#: drafting workflow: read the taxonomy to map a draft onto it, submit the
#: draft, then attach an image to that draft. Publishing is not a scope.
DEFAULT_SCOPES = [
    SCOPE_TAXONOMY_READ,
    SCOPE_PRODUCT_DRAFT,
    SCOPE_IMAGE_UPLOAD,
]
