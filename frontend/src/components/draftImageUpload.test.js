import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ACCEPTED_MIME_TYPES,
  ACCEPT_ATTRIBUTE,
  MAX_UPLOAD_BYTES,
  buildUploadForm,
  describeUploadError,
  describeUploadSuccess,
  validateImageFile,
} from './draftImageUpload.js';

/** Minimal File stand-in; Node has File but not a DOM FileList. */
function fakeFile({ size = 1024, type = 'image/jpeg', name = 'photo.jpg' } = {}) {
  return { size, type, name };
}

test('accepts JPEG, PNG and WebP', () => {
  for (const type of ACCEPTED_MIME_TYPES) {
    assert.equal(validateImageFile(fakeFile({ type })), '', `expected ${type} to pass`);
  }
});

test('accept attribute lists exactly the supported types', () => {
  assert.equal(ACCEPT_ATTRIBUTE, 'image/jpeg,image/png,image/webp');
});

test('rejects a missing file', () => {
  assert.match(validateImageFile(null), /choose an image/i);
});

test('rejects an empty file', () => {
  assert.match(validateImageFile(fakeFile({ size: 0 })), /empty/i);
});

test('rejects a file over the 8 MB limit', () => {
  const message = validateImageFile(fakeFile({ size: MAX_UPLOAD_BYTES + 1 }));
  assert.match(message, /limit is 8 MB/i);
});

test('accepts a file exactly at the limit', () => {
  assert.equal(validateImageFile(fakeFile({ size: MAX_UPLOAD_BYTES })), '');
});

test('rejects an unsupported declared type', () => {
  assert.match(validateImageFile(fakeFile({ type: 'image/gif' })), /JPG, PNG or WebP/i);
});

test('allows an unknown declared type, because the server re-checks the bytes', () => {
  // Browsers sometimes report '' for files from unusual sources. The backend
  // parses the real content with Pillow, so this must not block the upload.
  assert.equal(validateImageFile(fakeFile({ type: '' })), '');
});

test('buildUploadForm includes the file and alt text', () => {
  // A real File, because FormData stringifies anything that is not a Blob.
  const file = new File([new Uint8Array([1, 2, 3])], 'photo.jpg', { type: 'image/jpeg' });
  const body = buildUploadForm(file, 'Apsara Non-Dust Eraser');

  assert.equal(body.get('file'), file);
  assert.equal(body.get('alt_text'), 'Apsara Non-Dust Eraser');
});

test('buildUploadForm omits blank alt text', () => {
  const file = new File([new Uint8Array([1])], 'photo.jpg', { type: 'image/jpeg' });
  const body = buildUploadForm(file, '');
  assert.equal(body.has('alt_text'), false);
});

test('describeUploadError prefers the server message', () => {
  const message = describeUploadError({
    response: { status: 400, data: { error: 'File is not a readable image.' } },
  });
  assert.equal(message, 'File is not a readable image.');
});

test('describeUploadError explains each status without a server message', () => {
  const cases = [
    [413, /too large/i],
    [409, /locked/i],
    [404, /no longer exists/i],
    [403, /staff access/i],
    [401, /session expired/i],
    [500, /could not upload/i],
  ];
  for (const [status, pattern] of cases) {
    assert.match(
      describeUploadError({ response: { status } }),
      pattern,
      `status ${status}`,
    );
  }
});

test('describeUploadError handles a network failure with no response', () => {
  assert.match(describeUploadError(new Error('Network Error')), /could not upload/i);
});

test('describeUploadSuccess reports the normalised dimensions', () => {
  const message = describeUploadSuccess({ width: 1120, height: 1400, bytes: 26624 });
  assert.match(message, /1120×1400/);
  assert.match(message, /26 KB/);
});

test('describeUploadSuccess degrades gracefully without metadata', () => {
  assert.equal(describeUploadSuccess(null), 'Image uploaded.');
  assert.equal(describeUploadSuccess({}), 'Image uploaded.');
});
