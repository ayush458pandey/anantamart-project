import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildDraftPayload,
  checkSku,
  slugifySku,
  SKU_MAX_LENGTH,
  validateDraftPayload,
  findCategory,
  findSubcategory,
  findBrand,
  resolveTags,
  allTagNames,
  validateAgainstTaxonomy,
  TAX_RATES,
} from '../src/draft.js';

const TAXONOMY = {
  categories: [
    {
      id: 1,
      name: 'Stationery',
      subcategories: [
        { id: 11, name: 'Erasers' },
        { id: 12, name: 'Art & Craft Supplies' },
      ],
    },
    { id: 2, name: 'Kitchen', subcategories: [] },
  ],
  brands: [
    { id: 21, name: 'Apsara' },
    { id: 22, name: 'Camlin' },
  ],
  tagGroups: [
    { id: 31, name: 'Use Case', tags: [{ id: 41, name: 'School' }] },
    { id: 32, name: 'Business Type', tags: [{ id: 42, name: 'Retail' }] },
  ],
};

const VALID_INPUT = {
  name: 'Apsara Non-Dust Eraser',
  sku: 'aps-er-100',
  description: 'White non-dust eraser for pencil and ink.',
  category_name: 'Stationery',
  subcategory_name: 'Erasers',
  brand_name: 'Apsara',
  base_price: 5,
  mrp: 10,
  tax_rate: 18,
  moq: 10,
  case_size: 100,
  stock: 500,
};

test('buildDraftPayload preserves an explicit SKU verbatim', () => {
  // SKUs are lowercase by convention; the CLI must not rewrite them to upper.
  assert.equal(buildDraftPayload(VALID_INPUT).sku, 'aps-er-100');
});

test('buildDraftPayload omits empty optional fields', () => {
  const payload = buildDraftPayload({
    ...VALID_INPUT,
    brand_name: '',
    subcategory_name: '   ',
    mrp: null,
  });
  assert.ok(!('brand_name' in payload));
  assert.ok(!('subcategory_name' in payload));
  assert.ok(!('mrp' in payload));
});

test('buildDraftPayload never sends is_active', () => {
  const payload = buildDraftPayload({ ...VALID_INPUT, is_active: true });
  assert.ok(!('is_active' in payload));
});

test('buildDraftPayload trims text fields', () => {
  const payload = buildDraftPayload({ ...VALID_INPUT, name: '  Eraser  ' });
  assert.equal(payload.name, 'Eraser');
});

test('buildDraftPayload keeps tag_names as a trimmed array', () => {
  const payload = buildDraftPayload({ ...VALID_INPUT, tag_names: [' School ', 'Retail'] });
  assert.deepEqual(payload.tag_names, ['School', 'Retail']);
});

test('buildDraftPayload drops an empty tag list', () => {
  const payload = buildDraftPayload({ ...VALID_INPUT, tag_names: [] });
  assert.ok(!('tag_names' in payload));
});

test('a fully valid payload has no problems', () => {
  const payload = buildDraftPayload(VALID_INPUT);
  assert.deepEqual(validateDraftPayload(payload), []);
});

test('missing required fields are reported', () => {
  const problems = validateDraftPayload(buildDraftPayload({}));
  const fields = problems.map((p) => p.field);
  for (const field of ['name', 'sku', 'description', 'category_name']) {
    assert.ok(fields.includes(field), `expected ${field} to be reported`);
  }
});

test('zero or negative price is rejected', () => {
  for (const price of [0, -1, 'abc']) {
    const problems = validateDraftPayload(buildDraftPayload({ ...VALID_INPUT, base_price: price }));
    assert.ok(problems.some((p) => p.field === 'base_price'), `price ${price}`);
  }
});

test('MRP below price is rejected', () => {
  const problems = validateDraftPayload(buildDraftPayload({ ...VALID_INPUT, base_price: 10, mrp: 5 }));
  assert.ok(problems.some((p) => p.field === 'mrp' && /lower/.test(p.message)));
});

test('MRP above price is accepted', () => {
  const problems = validateDraftPayload(buildDraftPayload({ ...VALID_INPUT, base_price: 5, mrp: 9 }));
  assert.ok(!problems.some((p) => p.field === 'mrp'));
});

test('tax_rate outside the allowed slabs is rejected', () => {
  const problems = validateDraftPayload(buildDraftPayload({ ...VALID_INPUT, tax_rate: 12 }));
  assert.ok(problems.some((p) => p.field === 'tax_rate'));
});

test('every allowed tax slab is accepted', () => {
  for (const rate of TAX_RATES) {
    const problems = validateDraftPayload(buildDraftPayload({ ...VALID_INPUT, tax_rate: rate }));
    assert.ok(!problems.some((p) => p.field === 'tax_rate'), `rate ${rate}`);
  }
});

test('moq and case_size below 1 are rejected', () => {
  const problems = validateDraftPayload(buildDraftPayload({ ...VALID_INPUT, moq: 0, case_size: 0 }));
  assert.ok(problems.some((p) => p.field === 'moq'));
  assert.ok(problems.some((p) => p.field === 'case_size'));
});

test('negative stock is rejected', () => {
  const problems = validateDraftPayload(buildDraftPayload({ ...VALID_INPUT, stock: -5 }));
  assert.ok(problems.some((p) => p.field === 'stock'));
});

test('findCategory is case-insensitive', () => {
  assert.equal(findCategory(TAXONOMY, 'stationery').id, 1);
});

test('findCategory returns null for an unknown name', () => {
  assert.equal(findCategory(TAXONOMY, 'Nonexistent'), null);
});

test('findSubcategory is scoped to its category', () => {
  const stationery = findCategory(TAXONOMY, 'Stationery');
  assert.equal(findSubcategory(stationery, 'Erasers').id, 11);
  assert.equal(findSubcategory(stationery, 'Nope'), null);
});

test('findBrand is case-insensitive', () => {
  assert.equal(findBrand(TAXONOMY, 'apsara').id, 21);
});

test('resolveTags separates found and missing names', () => {
  const { found, missing } = resolveTags(TAXONOMY, ['school', 'Nope']);
  assert.deepEqual(found, ['School']);
  assert.deepEqual(missing, ['Nope']);
});

test('allTagNames flattens every group', () => {
  assert.deepEqual(allTagNames(TAXONOMY).sort(), ['Retail', 'School']);
});

test('validateAgainstTaxonomy passes for valid references', () => {
  const payload = buildDraftPayload(VALID_INPUT);
  assert.deepEqual(validateAgainstTaxonomy(payload, TAXONOMY), []);
});

test('validateAgainstTaxonomy rejects an unknown category', () => {
  const payload = buildDraftPayload({ ...VALID_INPUT, category_name: 'Nope' });
  const problems = validateAgainstTaxonomy(payload, TAXONOMY);
  assert.ok(problems.some((p) => p.field === 'category_name'));
});

test('validateAgainstTaxonomy rejects a subcategory from another category', () => {
  const payload = buildDraftPayload({
    ...VALID_INPUT,
    category_name: 'Kitchen',
    subcategory_name: 'Erasers',
  });
  const problems = validateAgainstTaxonomy(payload, TAXONOMY);
  assert.ok(problems.some((p) => p.field === 'subcategory_name'));
});

test('validateAgainstTaxonomy rejects an unknown brand', () => {
  const payload = buildDraftPayload({ ...VALID_INPUT, brand_name: 'Apsra' });
  const problems = validateAgainstTaxonomy(payload, TAXONOMY);
  assert.ok(problems.some((p) => p.field === 'brand_name'));
});

test('validateAgainstTaxonomy rejects an unknown tag', () => {
  const payload = buildDraftPayload({ ...VALID_INPUT, tag_names: ['Nope'] });
  const problems = validateAgainstTaxonomy(payload, TAXONOMY);
  assert.ok(problems.some((p) => p.field === 'tag_names'));
});


// --- SKU generation ---------------------------------------------------------

test('slugifySku matches the three documented examples exactly', () => {
  assert.equal(slugifySku('Apsara Non-Dust Eraser'), 'apsara-non-dust-eraser');
  assert.equal(
    slugifySku('Jupiter Tailoring Scissors 8 Inch'),
    'jupiter-tailoring-scissors-8-inch',
  );
  assert.equal(slugifySku('Coats Polyester Thread 1000m'), 'coats-polyester-thread-1000m');
});

test('slugifySku is always lowercase', () => {
  assert.equal(slugifySku('APSARA NON-DUST ERASER'), 'apsara-non-dust-eraser');
});

test('slugifySku removes special characters', () => {
  assert.equal(slugifySku('Godrej / Almirah @ 4 shelves!'), 'godrej-almirah-4-shelves');
  assert.equal(slugifySku('Kores   Glue Stick  (15 g)'), 'kores-glue-stick-15-g');
});

test('slugifySku preserves model numbers and sizes', () => {
  assert.equal(slugifySku('Faber-Castell 2B Pencil'), 'faber-castell-2b-pencil');
  assert.equal(slugifySku('Coats Thread 1000m'), 'coats-thread-1000m');
});

test('slugifySku transliterates accents instead of dropping the letter', () => {
  assert.equal(slugifySku('Café Crème Notebook'), 'cafe-creme-notebook');
});

test('slugifySku never leaves leading, trailing or doubled hyphens', () => {
  const slug = slugifySku('  --  Apsara   Eraser  --  ');
  assert.equal(slug, 'apsara-eraser');
});

test('slugifySku truncates to the backend limit', () => {
  const long = slugifySku('a'.repeat(60) + ' ' + 'b'.repeat(80));
  assert.equal(long.length, SKU_MAX_LENGTH);
});

test('slugifySku uses the complete product name, not an abbreviation', () => {
  assert.equal(
    slugifySku('Jupiter Tailoring Scissors 8 Inch'),
    'jupiter-tailoring-scissors-8-inch',
  );
  assert.notEqual(slugifySku('Jupiter Tailoring Scissors 8 Inch'), 'jts-8');
});

test('buildDraftPayload derives a slug when sku is omitted', () => {
  const payload = buildDraftPayload({
    name: 'Apsara Non-Dust Eraser',
    description: 'd',
    category_name: 'c',
    base_price: 5,
  });
  assert.equal(payload.sku, 'apsara-non-dust-eraser');
});

test('buildDraftPayload leaves an explicit sku untouched', () => {
  const payload = buildDraftPayload({
    name: 'Apsara Non-Dust Eraser',
    sku: 'aps-custom-99',
    description: 'd',
    category_name: 'c',
    base_price: 5,
  });
  assert.equal(payload.sku, 'aps-custom-99');
});

test('checkSku accepts a well-formed lowercase slug', () => {
  assert.deepEqual(checkSku('apsara-non-dust-eraser'), []);
});

test('checkSku rejects uppercase', () => {
  const problems = checkSku('APSARA-NON-DUST-ERASER');
  assert.ok(problems.some((p) => /lowercase/.test(p.message)));
});

test('checkSku rejects spaces and special characters', () => {
  for (const bad of ['apsara eraser', 'apsara_eraser', 'apsara.eraser', 'apsara--eraser']) {
    const problems = checkSku(bad);
    assert.ok(problems.some((p) => p.field === 'sku'), `expected ${bad} to fail`);
  }
});

test('checkSku rejects an empty sku', () => {
  assert.ok(checkSku('').some((p) => /required/.test(p.message)));
});

test('checkSku rejects a sku longer than the backend limit', () => {
  const problems = checkSku('a'.repeat(SKU_MAX_LENGTH + 1));
  assert.ok(problems.some((p) => /limit is 100/.test(p.message)));
});

test('checkSku detects a clash with an existing sku, case-insensitively', () => {
  const problems = checkSku('apsara-non-dust-eraser', ['APSARA-NON-DUST-ERASER']);
  assert.ok(problems.some((p) => /already used/.test(p.message)));
});

test('checkSku passes when existing skus do not clash', () => {
  assert.deepEqual(checkSku('apsara-non-dust-eraser', ['other-sku']), []);
});
