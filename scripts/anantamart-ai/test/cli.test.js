import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { main } from '../src/cli.js';

const VALID = 'ai_0123abcd_' + 'A'.repeat(43);

const TAXONOMY_BODY = {
  categories: [
    { id: 1, name: 'Stationery', subcategories: [{ id: 11, name: 'Erasers' }] },
  ],
  brands: [{ id: 21, name: 'Apsara' }],
  tag_groups: [],
};

/** Stub global fetch so no real network call is ever made in tests. */
function withFetch(handler, fn) {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return handler(url, options);
  };
  return Promise.resolve(fn(calls)).finally(() => {
    globalThis.fetch = original;
  });
}

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  };
}

let workDir;
test.beforeEach(() => {
  workDir = mkdtempSync(join(tmpdir(), 'anantamart-ai-'));
});
test.afterEach(() => {
  rmSync(workDir, { recursive: true, force: true });
});

test('main reports a missing token and exits 2', async () => {
  const code = await main(['taxonomy'], {});
  assert.equal(code, 2);
});

test('main rejects a malformed token before any network call', async () => {
  let called = false;
  await withFetch(
    () => {
      called = true;
      return jsonResponse({});
    },
    async () => {
      const code = await main(['taxonomy'], { ANANTAMART_AI_TOKEN: 'bad' });
      assert.equal(code, 2);
    },
  );
  assert.equal(called, false);
});

test('taxonomy command prints the catalogue and exits 0', async () => {
  await withFetch(
    () => jsonResponse(TAXONOMY_BODY),
    async () => {
      const code = await main(['taxonomy'], { ANANTAMART_AI_TOKEN: VALID });
      assert.equal(code, 0);
    },
  );
});

test('taxonomy command returns 3 on a 401 from the server', async () => {
  await withFetch(
    () => jsonResponse({ detail: 'Invalid AI token.' }, 401),
    async () => {
      const code = await main(['taxonomy'], { ANANTAMART_AI_TOKEN: VALID });
      assert.equal(code, 3);
    },
  );
});

test('draft requires --file', async () => {
  await withFetch(
    () => jsonResponse(TAXONOMY_BODY),
    async () => {
      const code = await main(['draft'], { ANANTAMART_AI_TOKEN: VALID });
      assert.equal(code, 3);
    },
  );
});

test('draft rejects an invalid payload without calling the API', async () => {
  const file = join(workDir, 'bad.json');
  writeFileSync(file, JSON.stringify({ name: 'Only a name' }));

  let draftCalls = 0;
  await withFetch(
    (url) => {
      if (String(url).includes('/drafts/')) draftCalls += 1;
      return jsonResponse(TAXONOMY_BODY);
    },
    async () => {
      const code = await main(['draft', '--file', file, '--yes'], {
        ANANTAMART_AI_TOKEN: VALID,
      });
      assert.equal(code, 2);
    },
  );
  assert.equal(draftCalls, 0);
});

test('draft rejects an unknown category without calling the API', async () => {
  const file = join(workDir, 'unknown-cat.json');
  writeFileSync(
    file,
    JSON.stringify({
      name: 'Apsara Non-Dust Eraser',
      sku: 'aps-er-100',
      description: 'White eraser.',
      category_name: 'Nonexistent Category',
      base_price: 5,
    }),
  );

  let draftCalls = 0;
  await withFetch(
    (url) => {
      if (String(url).includes('/drafts/')) draftCalls += 1;
      return jsonResponse(TAXONOMY_BODY);
    },
    async () => {
      const code = await main(['draft', '--file', file, '--yes'], {
        ANANTAMART_AI_TOKEN: VALID,
      });
      assert.equal(code, 2);
    },
  );
  assert.equal(draftCalls, 0);
});

test('draft --yes creates exactly one draft and never publishes', async () => {
  const file = join(workDir, 'good.json');
  writeFileSync(
    file,
    JSON.stringify({
      name: 'Apsara Non-Dust Eraser',
      sku: 'aps-er-100',
      description: 'White non-dust eraser.',
      category_name: 'Stationery',
      subcategory_name: 'Erasers',
      brand_name: 'Apsara',
      base_price: 5,
      mrp: 10,
      tax_rate: 18,
    }),
  );

  const requests = [];
  await withFetch(
    (url, options) => {
      requests.push({ url: String(url), options });
      if (String(url).includes('/taxonomy/')) return jsonResponse(TAXONOMY_BODY);
      return jsonResponse({
        created: [{ index: 0, id: 77, sku: 'aps-er-100', name: 'x', is_active: false }],
        failed: [],
      });
    },
    async () => {
      const code = await main(['draft', '--file', file, '--yes'], {
        ANANTAMART_AI_TOKEN: VALID,
      });
      assert.equal(code, 0);
    },
  );

  const drafts = requests.filter((r) => r.url.includes('/drafts/'));
  assert.equal(drafts.length, 1, 'exactly one draft request');

  const sent = JSON.parse(drafts[0].options.body);
  assert.equal(sent.is_active, undefined, 'is_active must never be sent');
  assert.equal(sent.category_name, 'Stationery');
  assert.equal(sent.subcategory_name, 'Erasers');
  assert.equal(sent.brand_name, 'Apsara');
  assert.equal(sent.sku, 'aps-er-100');
});

test('draft exits 3 when the server rejects the payload', async () => {
  const file = join(workDir, 'rejected.json');
  writeFileSync(
    file,
    JSON.stringify({
      name: 'Apsara Non-Dust Eraser',
      sku: 'aps-er-100',
      description: 'White eraser.',
      category_name: 'Stationery',
      base_price: 5,
    }),
  );

  await withFetch(
    (url) => {
      if (String(url).includes('/taxonomy/')) return jsonResponse(TAXONOMY_BODY);
      return jsonResponse({
        created: [],
        failed: [{ index: 0, errors: { sku: ['A product with this SKU already exists.'] } }],
      });
    },
    async () => {
      const code = await main(['draft', '--file', file, '--yes'], {
        ANANTAMART_AI_TOKEN: VALID,
      });
      assert.equal(code, 3);
    },
  );
});

test('--help exits 0 without needing a token', async () => {
  const code = await main(['--help'], {});
  assert.equal(code, 0);
});

test('an unknown command exits 2', async () => {
  await withFetch(
    () => jsonResponse(TAXONOMY_BODY),
    async () => {
      const code = await main(['publish'], { ANANTAMART_AI_TOKEN: VALID });
      assert.equal(code, 2);
    },
  );
});


// --- validate command -------------------------------------------------------
//
// These tests deliberately use a taxonomy response that differs from any
// fixture used elsewhere, so a passing result proves the CLI reads the live
// response rather than a hardcoded map.

test('validate reports READY when the file matches the live taxonomy', async () => {
  const file = join(workDir, 'live-ok.json');
  writeFileSync(
    file,
    JSON.stringify({
      name: 'Apsara Non-Dust Eraser',
      sku: 'apsara-non-dust-eraser',
      description: 'White non-dust eraser.',
      category_name: 'Stationery/School Supplies',
      subcategory_name: 'Writing Instruments',
      brand_name: 'Apsara',
      base_price: 5,
      mrp: 10,
      tax_rate: 18,
    }),
  );

  let posted = 0;
  await withFetch(
    (url, options) => {
      if (String(url).includes('/drafts/') && options?.method === 'POST') posted += 1;
      return jsonResponse({
        categories: [
          {
            id: 4,
            name: 'Stationery/School Supplies',
            subcategories: [
              { id: 5, name: 'Writing Instruments' },
              { id: 70, name: 'Art & Craft Supplies' },
            ],
          },
        ],
        brands: [
          { id: 26, name: 'Apsara' },
          { id: 2, name: 'Camlin' },
        ],
        tag_groups: [
          { id: 2, name: 'Business Type', tags: [{ id: 8, name: 'Restaurants' }] },
        ],
      });
    },
    async () => {
      const code = await main(['validate', '--file', file], {
        ANANTAMART_AI_TOKEN: VALID,
      });
      assert.equal(code, 0);
    },
  );

  assert.equal(posted, 0, 'validate must never POST a draft');
});

test('validate fails when the subcategory exists only in another category', async () => {
  const file = join(workDir, 'wrong-sub.json');
  writeFileSync(
    file,
    JSON.stringify({
      name: 'Apsara Non-Dust Eraser',
      sku: 'apsara-non-dust-eraser',
      description: 'White non-dust eraser.',
      category_name: 'Stationery/School Supplies',
      subcategory_name: 'Kitchen Knives',
      base_price: 5,
    }),
  );

  let posted = 0;
  await withFetch(
    (url, options) => {
      if (String(url).includes('/drafts/') && options?.method === 'POST') posted += 1;
      return jsonResponse({
        categories: [
          { id: 4, name: 'Stationery/School Supplies', subcategories: [{ id: 5, name: 'Writing Instruments' }] },
          { id: 14, name: 'Hotel & Kitchen Supplies', subcategories: [{ id: 67, name: 'Kitchen Knives' }] },
        ],
        brands: [{ id: 26, name: 'Apsara' }],
        tag_groups: [],
      });
    },
    async () => {
      const code = await main(['validate', '--file', file], {
        ANANTAMART_AI_TOKEN: VALID,
      });
      assert.equal(code, 2);
    },
  );

  assert.equal(posted, 0);
});

test('validate fails when the brand is absent from the live response', async () => {
  const file = join(workDir, 'no-brand.json');
  writeFileSync(
    file,
    JSON.stringify({
      name: 'Apsara Non-Dust Eraser',
      sku: 'apsara-non-dust-eraser',
      description: 'White non-dust eraser.',
      category_name: 'Stationery/School Supplies',
      brand_name: 'Apsara',
      base_price: 5,
    }),
  );

  await withFetch(
    () =>
      jsonResponse({
        categories: [
          { id: 4, name: 'Stationery/School Supplies', subcategories: [] },
        ],
        brands: [{ id: 2, name: 'Camlin' }],
        tag_groups: [],
      }),
    async () => {
      const code = await main(['validate', '--file', file], {
        ANANTAMART_AI_TOKEN: VALID,
      });
      assert.equal(code, 2);
    },
  );
});

test('validate reflects ids from the response rather than any local constant', async () => {
  const file = join(workDir, 'ids.json');
  writeFileSync(
    file,
    JSON.stringify({
      name: 'X',
      sku: 'x-1',
      description: 'd',
      category_name: 'Stationery/School Supplies',
      subcategory_name: 'Writing Instruments',
      brand_name: 'Apsara',
      base_price: 5,
    }),
  );

  const seen = [];
  const originalLog = console.log;
  console.log = (...args) => {
    seen.push(args.join(' '));
    originalLog(...args);
  };

  try {
    await withFetch(
      () =>
        jsonResponse({
          categories: [
            { id: 999, name: 'Stationery/School Supplies', subcategories: [{ id: 555, name: 'Writing Instruments' }] },
          ],
          brands: [{ id: 777, name: 'Apsara' }],
          tag_groups: [],
        }),
      async () => {
        const code = await main(['validate', '--file', file], {
          ANANTAMART_AI_TOKEN: VALID,
        });
        assert.equal(code, 0);
      },
    );
  } finally {
    console.log = originalLog;
  }

  const output = seen.join(String.fromCharCode(10));
  assert.match(output, /id 999/, 'category id must come from the response');
  assert.match(output, /id 555/, 'subcategory id must come from the response');
  assert.match(output, /id 777/, 'brand id must come from the response');
});
