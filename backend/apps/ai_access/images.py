"""
Image validation and normalisation for AI-submitted product images.

The AI uploads bytes; the backend never fetches a URL. Everything here works on
an in-memory file object, so a malicious payload is parsed by Pillow rather than
trusted because of its filename or declared MIME type.

Normalisation rules (AnantaMart catalogue standard):
  * WebP output, 4:5 portrait, 1120x1400, strictly under 200 KB.
  * Padded onto white, never cropped, so packaging and labels survive.
  * EXIF stripped, which also removes GPS and camera metadata.
"""
import base64
import binascii
import io

from django.core.files.base import ContentFile
from PIL import Image, ImageOps, UnidentifiedImageError

#: Hard ceiling for the stored file.
MAX_BYTES = 200 * 1024

#: Target canvas. 4:5 portrait.
TARGET_WIDTH = 1120
TARGET_HEIGHT = 1400

#: Refuse to decode anything larger than this, to blunt decompression bombs.
MAX_PIXELS = TARGET_WIDTH * TARGET_HEIGHT * 2

#: Reject absurd uploads before handing them to Pillow at all.
MAX_UPLOAD_BYTES = 8 * 1024 * 1024

#: Formats we accept on the way in. Everything is re-encoded to WebP.
ALLOWED_FORMATS = frozenset({'JPEG', 'PNG', 'WEBP'})

#: Tried in order; the first result under MAX_BYTES wins.
QUALITY_LADDER = (82, 75, 70, 65, 60, 55, 50, 45, 40, 35, 30)

WHITE = (255, 255, 255)


class ImageRejected(Exception):
    """Raised when an upload cannot be turned into a catalogue image."""


def decode_base64_payload(data, filename='upload'):
    """Turn a base64 string (optionally a data: URI) into a ContentFile."""
    if not data or not isinstance(data, str):
        raise ImageRejected('file_base64 must be a non-empty string.')

    if data.startswith('data:'):
        _, _, data = data.partition(',')

    try:
        raw = base64.b64decode(data, validate=True)
    except (binascii.Error, ValueError):
        raise ImageRejected('file_base64 is not valid base64.')

    if not raw:
        raise ImageRejected('file_base64 decoded to zero bytes.')
    if len(raw) > MAX_UPLOAD_BYTES:
        raise ImageRejected('Decoded file is too large.')

    return ContentFile(raw, name=filename or 'upload')


def _fit_4x5_on_white(img):
    """Scale to fit inside the 4:5 canvas and centre on white.

    Padding rather than cropping is deliberate: cropping would cut off product
    packaging, branding and printed information.
    """
    img = img.convert('RGB')
    scale = min(TARGET_WIDTH / img.width, TARGET_HEIGHT / img.height)
    new_size = (max(1, round(img.width * scale)), max(1, round(img.height * scale)))
    if new_size != img.size:
        img = img.resize(new_size, Image.LANCZOS)

    canvas = Image.new('RGB', (TARGET_WIDTH, TARGET_HEIGHT), WHITE)
    canvas.paste(img, ((TARGET_WIDTH - new_size[0]) // 2,
                       (TARGET_HEIGHT - new_size[1]) // 2))
    return canvas


def process_upload(uploaded):
    """Validate and normalise an uploaded image.

    Returns ``(content_file, width, height, byte_size)``. Raises
    ``ImageRejected`` with a human-readable reason on any failure.
    """
    if uploaded is None:
        raise ImageRejected('No file was supplied.')
    if getattr(uploaded, 'size', 0) > MAX_UPLOAD_BYTES:
        raise ImageRejected('File is too large to process.')

    # verify() parses the real bytes, so a renamed ZIP or script fails here
    # regardless of its extension or declared content type.
    try:
        probe = Image.open(uploaded)
        probe.verify()
    except (UnidentifiedImageError, OSError, ValueError):
        raise ImageRejected('File is not a readable image.')

    # verify() consumes the stream, so reopen from the start.
    uploaded.seek(0)
    try:
        img = Image.open(uploaded)
        img.load()
    except (UnidentifiedImageError, OSError, ValueError):
        raise ImageRejected('File is not a readable image.')

    if img.format not in ALLOWED_FORMATS:
        raise ImageRejected(
            f'Unsupported image format: {img.format}. Use JPEG, PNG or WebP.'
        )
    if img.width * img.height > MAX_PIXELS:
        raise ImageRejected('Image dimensions are too large.')

    # Bake orientation into pixels before the metadata is discarded.
    img = ImageOps.exif_transpose(img)
    canvas = _fit_4x5_on_white(img)

    for quality in QUALITY_LADDER:
        buffer = io.BytesIO()
        canvas.save(buffer, format='WEBP', quality=quality, method=6)
        if buffer.tell() < MAX_BYTES:
            return (
                ContentFile(buffer.getvalue(), name='draft.webp'),
                TARGET_WIDTH,
                TARGET_HEIGHT,
                buffer.tell(),
            )

    raise ImageRejected(
        'Could not compress this image below 200 KB without unacceptable '
        'quality loss. Try a simpler image.'
    )
