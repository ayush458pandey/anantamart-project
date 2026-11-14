/**
 * Product draft payload construction and validation.
 *
 * Field names are taken from the real backend serializer
 * (apps/products/serializers.py -> ProductWriteSerializer), not guessed:
 *
 *   required: name, sku, description, category_name, base_price
 *   optional: subcategory_name, brand_name, tag_names, mrp, purchase_price,
 *             tax_rate, hsn_code, moq, case_size, stock, stock_status, unit,
 *             weight, product_type, key_features, ...
 *
 * Important: taxonomy is submitted by NAME, not by id. The server resolves
 * names against the live catalogue and rejects unknown ones with a structured
 * `*_not_found` error. It never creates taxonomy records.
 */

/** Allowed GST slabs, enforced server-side by validate_tax_rate(). */
export const TAX_RATES = [0, 5, 18, 40];

/** Fields the server requires, with the message to show when missing. */
const REQUIRED_TEXT = [
  ['name', 'Product name is required.'],
  ['sku', 'SKU is required.'],
  ['description', 'Description is required.'],
  ['category_name', 'Category is required.'],
];

/** Characters that survive slugification: lowercase letters, digits, hyphens. */
const SLUG_STRIP = /[^a-z0-9\s-]/g;

/**
 * Build a SKU slug from a full product name.
 *
 * Rules:
 *   - lowercase
 *   - the complete product name, no abbreviations
 *   - spaces become hyphens
 *   - special characters removed
 *   - runs of hyphens collapsed, leading/trailing hyphens trimmed
 *
 * Brand, product type, model and size are preserved simply by keeping every
 * word of the name; nothing is dropped or abbreviated.
 *
 *   "Apsara Non-Dust Eraser"          -> "apsara-non-dust-eraser"
 *   "Jupiter Tailoring Scissors 8 Inch" -> "jupiter-tailoring-scissors-8-inch"
 *   "Coats Polyester Thread 1000m"    -> "coats-polyester-thread-1000m"
 */
export function slugifySku(productName) {
  return String(productName ?? '')
    .normalize('NFKD')
    // Drop combining marks so "Café" -> "cafe" rather than "caf".
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(SLUG_STRIP, '')
    .replace(/[\s-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}

/** The maximum length the backend accepts (Product.sku max_length=100). */
export const SKU_MAX_LENGTH = 100;

/**
 * Normalise a product-description object into an API payload.
 * Undefined / empty optional values are omitted so the server applies its
 * own defaults rather than receiving an empty string.
 */
export function buildDraftPayload(input) {
  const name = String(input.name ?? '').trim();

  // An explicit sku is respected as given; otherwise derive one from the full
  // product name. Existing SKUs are never rewritten by this tool.
  const providedSku = String(input.sku ?? '').trim();
  const sku = providedSku || slugifySku(name);

  const payload = {
    name,
    sku,
    description: String(input.description ?? '').trim(),
    category_name: String(input.category_name ?? '').trim(),
    base_price: input.base_price,
  };

  const optionalText = [
    'subcategory_name',
    'brand_name',
    'hsn_code',
    'unit',
    'weight',
    'product_type',
    'key_features',
    'available_colors',
    'packaging_type',
    'dietary_preference',
    'ingredients',
    'storage_instruction',
    'usage_recommendation',
  ];
  for (const key of optionalText) {
    const value = input[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      payload[key] = String(value).trim();
    }
  }

  const optionalNumbers = ['mrp', 'purchase_price', 'moq', 'case_size', 'stock'];
  for (const key of optionalNumbers) {
    const value = input[key];
    if (value !== undefined && value !== null && value !== '') {
      payload[key] = value;
    }
  }

  if (Array.isArray(input.tag_names) && input.tag_names.length > 0) {
    payload.tag_names = input.tag_names.map((t) => String(t).trim()).filter(Boolean);
  }

  if (input.tax_rate !== undefined && input.tax_rate !== null && input.tax_rate !== '') {
    payload.tax_rate = input.tax_rate;
  }

  // Never send is_active: the server forces is_active=False for every draft,
  // and the CLI must not appear to request publishing.
  return payload;
}

/**
 * Validate a payload against the rules the server actually enforces.
 * Returns an array of { field, message }. Empty means it can be submitted.
 */
export function validateDraftPayload(payload) {
  const problems = [];

  for (const [field, message] of REQUIRED_TEXT) {
    if (!payload[field] || String(payload[field]).trim() === '') {
      problems.push({ field, message });
    }
  }

  const price = Number(payload.base_price);
  if (!Number.isFinite(price) || price <= 0) {
    problems.push({
      field: 'base_price',
      message: 'Selling price must be a number greater than zero.',
    });
  }

  if (payload.mrp !== undefined) {
    const mrp = Number(payload.mrp);
    if (!Number.isFinite(mrp) || mrp <= 0) {
      problems.push({ field: 'mrp', message: 'MRP must be greater than zero.' });
    } else if (Number.isFinite(price) && mrp < price) {
      problems.push({
        field: 'mrp',
        message: 'MRP cannot be lower than the selling price.',
      });
    }
  }

  if (payload.tax_rate !== undefined && !TAX_RATES.includes(Number(payload.tax_rate))) {
    problems.push({
      field: 'tax_rate',
      message: `Tax rate must be one of ${TAX_RATES.join(', ')}.`,
    });
  }

  for (const field of ['moq', 'case_size']) {
    if (payload[field] !== undefined && Number(payload[field]) < 1) {
      problems.push({ field, message: `${field} must be at least 1.` });
    }
  }

  if (payload.stock !== undefined && Number(payload.stock) < 0) {
    problems.push({ field: 'stock', message: 'Stock cannot be negative.' });
  }

  return problems;
}

/**
 * Check a SKU for format and uniqueness.
 *
 * `existingSkus` must come from the live API or a previous submission, never
 * from a local guess. The server's check is authoritative; this is a
 * fail-fast so a clash is reported before any request is made.
 */
export function checkSku(sku, existingSkus = []) {
  const problems = [];
  const value = String(sku ?? '').trim();

  if (!value) {
    problems.push({ field: 'sku', message: 'SKU is required.' });
    return problems;
  }
  if (value.length > SKU_MAX_LENGTH) {
    problems.push({
      field: 'sku',
      message: `SKU is ${value.length} characters; the limit is ${SKU_MAX_LENGTH}.`,
    });
  }
  if (value !== value.toLowerCase()) {
    problems.push({
      field: 'sku',
      message:
        'SKU must be lowercase. Note: the backend currently uppercases every ' +
        'SKU on save, so lowercase is the requested convention but the stored ' +
        'value will be uppercase.',
    });
  }
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(value)) {
    problems.push({
      field: 'sku',
      message: 'SKU may contain only lowercase letters, digits and single hyphens.',
    });
  }

  const clash = existingSkus.some(
    (existing) => String(existing).trim().toLowerCase() === value.toLowerCase(),
  );
  if (clash) {
    problems.push({
      field: 'sku',
      message: `SKU "${value}" is already used by an existing product.`,
    });
  }

  return problems;
}

/** Case-insensitive lookup of a category by name. */
export function findCategory(taxonomy, name) {
  const wanted = String(name ?? '').trim().toLowerCase();
  if (!wanted) return null;
  return taxonomy.categories.find((c) => c.name.toLowerCase() === wanted) ?? null;
}

/** Case-insensitive lookup of a subcategory within a specific category. */
export function findSubcategory(category, name) {
  const wanted = String(name ?? '').trim().toLowerCase();
  if (!wanted || !category) return null;
  return (category.subcategories ?? []).find((s) => s.name.toLowerCase() === wanted) ?? null;
}

/** Case-insensitive lookup of a brand by name. */
export function findBrand(taxonomy, name) {
  const wanted = String(name ?? '').trim().toLowerCase();
  if (!wanted) return null;
  return taxonomy.brands.find((b) => b.name.toLowerCase() === wanted) ?? null;
}

/** Flatten every tag across groups into a single name list. */
export function allTagNames(taxonomy) {
  return taxonomy.tagGroups.flatMap((g) => (g.tags ?? []).map((t) => t.name));
}

/** Find tags by name across all groups. Returns { found, missing }. */
export function resolveTags(taxonomy, names = []) {
  const available = new Map();
  for (const group of taxonomy.tagGroups) {
    for (const tag of group.tags ?? []) {
      available.set(tag.name.toLowerCase(), tag.name);
    }
  }
  const found = [];
  const missing = [];
  for (const name of names) {
    const canonical = available.get(String(name).trim().toLowerCase());
    if (canonical) found.push(canonical);
    else missing.push(name);
  }
  return { found, missing };
}

/**
 * Check the taxonomy references in a payload against the live taxonomy.
 * The server would reject unknown names anyway; catching them locally gives a
 * clearer message before anything is sent.
 */
export function validateAgainstTaxonomy(payload, taxonomy) {
  const problems = [];

  const category = findCategory(taxonomy, payload.category_name);
  if (!category) {
    problems.push({
      field: 'category_name',
      message: `Category "${payload.category_name}" does not exist in the live catalogue.`,
    });
  } else if (payload.subcategory_name) {
    const sub = findSubcategory(category, payload.subcategory_name);
    if (!sub) {
      problems.push({
        field: 'subcategory_name',
        message:
          `Subcategory "${payload.subcategory_name}" does not exist in ` +
          `category "${category.name}".`,
      });
    }
  }

  if (payload.brand_name && !findBrand(taxonomy, payload.brand_name)) {
    problems.push({
      field: 'brand_name',
      message: `Brand "${payload.brand_name}" does not exist in the live catalogue.`,
    });
  }

  if (payload.tag_names?.length) {
    const { missing } = resolveTags(taxonomy, payload.tag_names);
    if (missing.length) {
      problems.push({
        field: 'tag_names',
        message: `Unknown tag(s): ${missing.join(', ')}.`,
      });
    }
  }

  return problems;
}
