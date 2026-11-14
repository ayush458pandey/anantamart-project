/**
 * Upload rules for the staff draft image control, kept free of React so they
 * can be unit-tested without a DOM.
 *
 * The server is authoritative for image validation (it re-parses the bytes with
 * Pillow and re-encodes to WebP). These checks only fail fast on things the
 * browser already knows, so the user gets an instant message instead of a
 * round-trip.
 */

/** Mirrors apps.ai_access.images.MAX_UPLOAD_BYTES. */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

/** Mirrors apps.ai_access.images.ALLOWED_FORMATS, as MIME types. */
export const ACCEPTED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** Value for an <input type="file" accept="..."> attribute. */
export const ACCEPT_ATTRIBUTE = ACCEPTED_MIME_TYPES.join(',');

/**
 * Validate a File before uploading.
 * @returns {string} an error message, or '' when the file looks acceptable.
 */
export function validateImageFile(file) {
  if (!file) return 'Choose an image to upload.';

  if (file.size === 0) return 'That file is empty.';
  if (file.size > MAX_UPLOAD_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    return `That file is ${mb} MB. The limit is 8 MB.`;
  }

  // Some browsers report an empty type for files dragged from odd sources.
  // The server re-checks the real bytes, so an unknown type is not fatal here.
  if (file.type && !ACCEPTED_MIME_TYPES.includes(file.type)) {
    return 'Use a JPG, PNG or WebP image.';
  }

  return '';
}

/** Build the multipart body for POST /admin/drafts/<id>/images/. */
export function buildUploadForm(file, altText = '') {
  const body = new FormData();
  body.append('file', file);
  if (altText) body.append('alt_text', altText);
  return body;
}

/** Turn an axios failure into a message worth showing a staff user. */
export function describeUploadError(error) {
  const status = error?.response?.status;
  const detail = error?.response?.data?.error;

  if (detail) return detail;
  if (status === 413) return 'That file is too large for the server to accept.';
  if (status === 409) return 'Images are locked once a draft is no longer pending.';
  if (status === 404) return 'This draft no longer exists.';
  if (status === 403) return 'You do not have staff access to upload images.';
  if (status === 401) return 'Your session expired. Sign in again.';
  return 'Could not upload this image.';
}

/** Human-readable summary of a successful upload. */
export function describeUploadSuccess(payload) {
  if (!payload) return 'Image uploaded.';
  const { width, height, bytes } = payload;
  if (!width || !height || !bytes) return 'Image uploaded.';
  return `Uploaded and converted to WebP (${width}\u00d7${height}, ${Math.round(bytes / 1024)} KB).`;
}
