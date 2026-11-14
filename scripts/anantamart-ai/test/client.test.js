import test from 'node:test';
import assert from 'node:assert/strict';

import {
  readToken,
  redactToken,
  createClient,
  MissingTokenError,
  ApiError,
} from '../src/client.js';

const VALID = 'ai_0123abcd_' + 'A'.repeat(43);

test('readToken accepts a correctly shaped token', () => {
  assert.equal(readToken({ ANANTAMART_AI_TOKEN: VALID }), VALID);
});

test('readToken rejects a missing token', () => {
  assert.throws(() => readToken({}), MissingTokenError);
});

test('readToken rejects a trailing newline', () => {
  assert.throws(
    () => readToken({ ANANTAMART_AI_TOKEN: `${VALID}\n` }),
    /whitespace/,
  );
});

test('readToken rejects internal whitespace', () => {
  assert.throws(
    () => readToken({ ANANTAMART_AI_TOKEN: `ai_0123abcd_AAAA AAAA${'A'.repeat(35)}` }),
    MissingTokenError,
  );
});

test('readToken rejects a wrong-length token', () => {
  assert.throws(() => readToken({ ANANTAMART_AI_TOKEN: 'ai_0123abcd_tooshort' }), /55 characters/);
});

test('readToken rejects a token without the ai_ prefix', () => {
  assert.throws(
    () => readToken({ ANANTAMART_AI_TOKEN: 'xx_0123abcd_' + 'A'.repeat(43) }),
    MissingTokenError,
  );
});

test('readToken error messages never contain the token', () => {
  try {
    readToken({ ANANTAMART_AI_TOKEN: `${VALID}\n` });
  } catch (error) {
    assert.ok(!error.message.includes(VALID));
  }
});

test('redactToken never reveals the full token', () => {
  const redacted = redactToken(VALID);
  assert.ok(!redacted.includes(VALID));
  assert.ok(redacted.includes('redacted'));
});

test('redactToken handles empty input', () => {
  assert.equal(redactToken(''), '***');
  assert.equal(redactToken(undefined), '***');
});

function mockFetch({ status = 200, body = '', ok = null } = {}) {
  const calls = [];
  const impl = async (url, options) => {
    calls.push({ url, options });
    return {
      ok: ok === null ? status >= 200 && status < 300 : ok,
      status,
      text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
    };
  };
  impl.calls = calls;
  return impl;
}

test('createClient sends the bearer token and never the raw token in the URL', async () => {
  const fetchImpl = mockFetch({ body: { categories: [], brands: [], tag_groups: [] } });
  const client = createClient({ token: VALID, fetchImpl });

  await client.getTaxonomy();

  const [{ url, options }] = fetchImpl.calls;
  assert.equal(options.headers.Authorization, `Bearer ${VALID}`);
  assert.ok(!url.includes(VALID));
});

test('getTaxonomy normalises a missing payload into empty arrays', async () => {
  const fetchImpl = mockFetch({ body: {} });
  const client = createClient({ token: VALID, fetchImpl });

  assert.deepEqual(await client.getTaxonomy(), {
    categories: [],
    brands: [],
    tagGroups: [],
  });
});

test('getTaxonomy maps tag_groups to tagGroups', async () => {
  const fetchImpl = mockFetch({
    body: {
      categories: [{ id: 1, name: 'Stationery', subcategories: [] }],
      brands: [{ id: 2, name: 'Apsara' }],
      tag_groups: [{ id: 3, name: 'Use Case', tags: [{ id: 4, name: 'School' }] }],
    },
  });
  const client = createClient({ token: VALID, fetchImpl });
  const taxonomy = await client.getTaxonomy();

  assert.equal(taxonomy.categories[0].name, 'Stationery');
  assert.equal(taxonomy.brands[0].name, 'Apsara');
  assert.equal(taxonomy.tagGroups[0].tags[0].name, 'School');
});

test('401 produces a helpful error without the token', async () => {
  const fetchImpl = mockFetch({
    status: 401,
    body: { detail: 'Invalid AI token.' },
  });
  const client = createClient({ token: VALID, fetchImpl });

  await assert.rejects(
    () => client.getTaxonomy(),
    (error) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.status, 401);
      assert.match(error.message, /401/);
      assert.match(error.message, /expired|revoked/);
      assert.ok(!error.message.includes(VALID));
      return true;
    },
  );
});

test('403 explains the missing scope', async () => {
  const fetchImpl = mockFetch({ status: 403, body: { detail: 'no scope' } });
  const client = createClient({ token: VALID, fetchImpl });

  await assert.rejects(() => client.getTaxonomy(), /lacks the required scope/);
});

test('non-JSON success body raises a clear error', async () => {
  const fetchImpl = mockFetch({ status: 200, body: '<html>oops</html>' });
  const client = createClient({ token: VALID, fetchImpl });

  await assert.rejects(() => client.getTaxonomy(), /non-JSON response/);
});

test('network failure is reported without leaking the token', async () => {
  const fetchImpl = async () => {
    throw new Error('ECONNREFUSED');
  };
  const client = createClient({ token: VALID, fetchImpl });

  await assert.rejects(
    () => client.getTaxonomy(),
    (error) => {
      assert.match(error.message, /Network error/);
      assert.ok(!error.message.includes(VALID));
      return true;
    },
  );
});

test('createDraft returns the created entry', async () => {
  const fetchImpl = mockFetch({
    body: { created: [{ index: 0, id: 42, sku: 'APS-1', name: 'Eraser', is_active: false }], failed: [] },
  });
  const client = createClient({ token: VALID, fetchImpl });

  const created = await client.createDraft({ name: 'Eraser' });
  assert.equal(created.id, 42);
  assert.equal(created.is_active, false);
});

test('createDraft surfaces server-side field errors', async () => {
  const fetchImpl = mockFetch({
    body: {
      created: [],
      failed: [{ index: 0, errors: { category_name: ['Category not found.'] } }],
    },
  });
  const client = createClient({ token: VALID, fetchImpl });

  await assert.rejects(
    () => client.createDraft({ name: 'Eraser' }),
    (error) => {
      assert.ok(error instanceof ApiError);
      assert.match(JSON.stringify(error.body), /Category not found/);
      return true;
    },
  );
});

test('createDraft sends JSON content type', async () => {
  const fetchImpl = mockFetch({ body: { created: [{ id: 1 }], failed: [] } });
  const client = createClient({ token: VALID, fetchImpl });

  await client.createDraft({ name: 'x' });
  assert.equal(fetchImpl.calls[0].options.headers['Content-Type'], 'application/json');
});

test('uploadImage posts multipart form data', async () => {
  const fetchImpl = mockFetch({ status: 201, body: { id: 9, bytes: 100 } });
  const client = createClient({ token: VALID, fetchImpl });

  const result = await client.uploadImage(42, {
    bytes: Buffer.from([1, 2, 3]),
    filename: 'x.webp',
    contentType: 'image/webp',
    sourceKind: 'user',
  });

  assert.equal(result.id, 9);
  const [{ options }] = fetchImpl.calls;
  assert.ok(options.body instanceof FormData);
  assert.equal(options.headers['Content-Type'], undefined);
});
