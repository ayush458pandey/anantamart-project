#!/usr/bin/env node
/**
 * AnantaMart AI Product Assistant -- local CLI.
 *
 * Commands:
 *   taxonomy                 Verify the token and print the live taxonomy.
 *   draft --file <path>      Validate, preview, then (after confirmation)
 *                            create ONE draft product.
 *
 * Safety: this tool can only reach /taxonomy/, /drafts/ and
 * /drafts/{id}/images/. It has no ability to publish, edit or delete anything,
 * because the token it uses has no scope for those operations.
 */
import process from 'node:process';
import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';

import { createClient, readToken, redactToken, MissingTokenError, ApiError } from './client.js';
import {
  buildDraftPayload,
  checkSku,
  validateDraftPayload,
  validateAgainstTaxonomy,
  findCategory,
  findSubcategory,
  findBrand,
  allTagNames,
} from './draft.js';

const HERE = dirname(fileURLToPath(import.meta.url));

const MIME_BY_EXT = {
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
};

function usage() {
  return `
AnantaMart AI Product Assistant

Usage:
  node src/cli.js taxonomy
  node src/cli.js validate --file <product.json>
  node src/cli.js draft --file <product.json> [--image <file>] [--yes]

Options:
  --file <path>    JSON file describing the product draft (see README).
  validate         Fetch the live taxonomy and check the file against it.
                   Creates nothing.
  --image <path>   Optional image to upload (jpeg, png or webp).
  --yes            Skip the interactive confirmation prompt.
  --help           Show this message.

The token is read from ANANTAMART_AI_TOKEN and never printed.
`.trim();
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') args.help = true;
    else if (arg === '--yes' || arg === '-y') args.yes = true;
    else if (arg === '--file' || arg === '--image') {
      const key = arg.slice(2);
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) {
        throw new Error(`${arg} requires a value.`);
      }
      args[key] = value;
      i += 1;
    } else if (arg.startsWith('--')) {
      throw new Error(`Unknown option: ${arg}`);
    } else {
      args._.push(arg);
    }
  }
  return args;
}

function printTaxonomy(taxonomy) {
  console.log(`Categories (${taxonomy.categories.length})`);
  for (const category of taxonomy.categories) {
    console.log(`  [${category.id}] ${category.name}`);
    for (const sub of category.subcategories ?? []) {
      console.log(`        - [${sub.id}] ${sub.name}`);
    }
  }

  console.log(`\nBrands (${taxonomy.brands.length})`);
  const names = taxonomy.brands.map((b) => b.name);
  for (let i = 0; i < names.length; i += 6) {
    console.log(`  ${names.slice(i, i + 6).join(', ')}`);
  }

  console.log(`\nTag groups (${taxonomy.tagGroups.length})`);
  for (const group of taxonomy.tagGroups) {
    const tags = (group.tags ?? []).map((t) => t.name).join(', ') || '(none)';
    console.log(`  [${group.id}] ${group.name}: ${tags}`);
  }
}

/** Resolve the taxonomy references in a payload and describe what matched. */
function describeMapping(payload, taxonomy) {
  const lines = [];
  const category = findCategory(taxonomy, payload.category_name);
  lines.push(
    category
      ? `category    : ${payload.category_name}  -> id ${category.id}`
      : `category    : ${payload.category_name}  -> NOT FOUND`,
  );

  if (payload.subcategory_name) {
    const sub = findSubcategory(category, payload.subcategory_name);
    lines.push(
      sub
        ? `subcategory : ${payload.subcategory_name}  -> id ${sub.id}`
        : `subcategory : ${payload.subcategory_name}  -> NOT FOUND`,
    );
  }

  if (payload.brand_name) {
    const brand = findBrand(taxonomy, payload.brand_name);
    lines.push(
      brand
        ? `brand       : ${payload.brand_name}  -> id ${brand.id}`
        : `brand       : ${payload.brand_name}  -> NOT FOUND`,
    );
  }

  if (payload.tag_names?.length) {
    lines.push(`tags        : ${payload.tag_names.join(', ')}`);
  }
  return lines;
}

function printPreview(payload, taxonomy, imagePath) {
  console.log('\n--- DRAFT PREVIEW -------------------------------------------');
  console.log(`name        : ${payload.name}`);
  console.log(`sku         : ${payload.sku}`);
  console.log(`description : ${payload.description}`);
  for (const line of describeMapping(payload, taxonomy)) console.log(line);
  console.log(`base_price  : ${payload.base_price}`);
  if (payload.mrp !== undefined) console.log(`mrp         : ${payload.mrp}`);
  if (payload.tax_rate !== undefined) console.log(`tax_rate    : ${payload.tax_rate}%`);
  if (payload.moq !== undefined) console.log(`moq         : ${payload.moq}`);
  if (payload.stock !== undefined) console.log(`stock       : ${payload.stock}`);
  if (imagePath) console.log(`image       : ${imagePath}`);
  console.log('status      : will be created as INACTIVE (draft); never published');
  console.log('-------------------------------------------------------------');
}

async function confirm(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question(`${question} [y/N] `);
    return /^y(es)?$/i.test(answer.trim());
  } finally {
    rl.close();
  }
}

async function runTaxonomy(client) {
  const taxonomy = await client.getTaxonomy();
  printTaxonomy(taxonomy);
  console.log(
    `\nOK: taxonomy retrieved (${taxonomy.categories.length} categories, ` +
      `${taxonomy.brands.length} brands, ${taxonomy.tagGroups.length} tag groups).`,
  );
  return 0;
}

/**
 * Fetch the live taxonomy and validate a product file against it.
 *
 * This is the only trustworthy way to prove a mapping: every id and name comes
 * from the API response, never from a local fixture.
 */
async function runValidate(client, args) {
  if (!args.file) {
    throw new Error('validate requires --file <product.json>.');
  }
  const filePath = resolve(process.cwd(), args.file);
  if (!existsSync(filePath)) {
    throw new Error(`Product file not found: ${filePath}`);
  }

  let input;
  try {
    input = JSON.parse(readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`Could not parse ${filePath}: ${error.message}`);
  }

  const payload = buildDraftPayload(input);
  const taxonomy = await client.getTaxonomy();

  console.log('\n--- LIVE TAXONOMY MATCH -------------------------------------');
  console.log(`source: GET ${'/api/ai/v1/taxonomy/'} (live response)`);
  console.log(`categories: ${taxonomy.categories.length}, brands: ${taxonomy.brands.length}, tag groups: ${taxonomy.tagGroups.length}`);
  console.log('');
  for (const line of describeMapping(payload, taxonomy)) console.log(line);
  console.log('-------------------------------------------------------------');

  console.log('\n--- PAYLOAD THAT WOULD BE POSTED ----------------------------');
  console.log(JSON.stringify(payload, null, 2));

  const localProblems = validateDraftPayload(payload);
  const taxonomyProblems = validateAgainstTaxonomy(payload, taxonomy);
  const skuProblems = checkSku(payload.sku, input.existing_skus ?? []);

  console.log('\n--- VALIDATION ----------------------------------------------');
  console.log(`local rules      : ${localProblems.length ? 'FAIL' : 'pass'}`);
  for (const p of localProblems) console.log(`  - ${p.field}: ${p.message}`);
  console.log(`sku format       : ${skuProblems.length ? 'FAIL' : 'pass'}`);
  for (const p of skuProblems) console.log(`  - ${p.field}: ${p.message}`);
  console.log(`live taxonomy    : ${taxonomyProblems.length ? 'FAIL' : 'pass'}`);
  for (const p of taxonomyProblems) console.log(`  - ${p.field}: ${p.message}`);
  console.log(`is_active sent   : ${Object.prototype.hasOwnProperty.call(payload, 'is_active') ? 'YES (bad)' : 'no (correct - server forces inactive)'}`);
  console.log('-------------------------------------------------------------');

  const failed = localProblems.length + taxonomyProblems.length + skuProblems.length;
  if (failed) {
    console.error('\nNOT READY: fix the problems above before creating a draft.');
    return 2;
  }
  console.log('\nREADY: all references exist in the live catalogue. Nothing was created.');
  return 0;
}

async function runDraft(client, args) {
  if (!args.file) {
    throw new Error('draft requires --file <product.json>.');
  }
  const filePath = resolve(process.cwd(), args.file);
  if (!existsSync(filePath)) {
    throw new Error(`Product file not found: ${filePath}`);
  }

  let input;
  try {
    input = JSON.parse(readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`Could not parse ${filePath}: ${error.message}`);
  }

  const payload = buildDraftPayload(input);

  const localProblems = validateDraftPayload(payload);
  if (localProblems.length) {
    console.error('\nPayload is invalid:');
    for (const p of localProblems) console.error(`  - ${p.field}: ${p.message}`);
    return 2;
  }

  const taxonomy = await client.getTaxonomy();

  const skuProblems = checkSku(payload.sku, input.existing_skus ?? []);
  if (skuProblems.length) {
    console.error('\nSKU check failed:');
    for (const p of skuProblems) console.error(`  - ${p.field}: ${p.message}`);
    return 2;
  }

  const taxonomyProblems = validateAgainstTaxonomy(payload, taxonomy);
  if (taxonomyProblems.length) {
    console.error('\nTaxonomy check failed against the live catalogue:');
    for (const p of taxonomyProblems) console.error(`  - ${p.field}: ${p.message}`);
    console.error('\nAvailable categories:', taxonomy.categories.map((c) => c.name).join(', '));
    const tags = allTagNames(taxonomy);
    if (tags.length) console.error('Available tags:', tags.join(', '));
    return 2;
  }

  let imageBytes = null;
  let imageFilename = null;
  let imageContentType = null;
  if (args.image) {
    const imagePath = resolve(process.cwd(), args.image);
    if (!existsSync(imagePath)) throw new Error(`Image not found: ${imagePath}`);
    const ext = extname(imagePath).toLowerCase();
    imageContentType = MIME_BY_EXT[ext];
    if (!imageContentType) {
      throw new Error(`Unsupported image type "${ext}". Use .jpg, .jpeg, .png or .webp.`);
    }
    imageBytes = readFileSync(imagePath);
    imageFilename = imagePath.split(/[\\/]/).pop();
  }

  printPreview(payload, taxonomy, args.image);

  if (!args.yes) {
    const ok = await confirm('Create this draft in AnantaMart?');
    if (!ok) {
      console.log('Cancelled. Nothing was sent.');
      return 1;
    }
  }

  const created = await client.createDraft(payload);
  console.log(`\nDraft created: id=${created.id} sku=${created.sku} status=${created.is_active ? 'ACTIVE' : 'inactive'}`);

  if (created.is_active) {
    console.warn('WARNING: the server returned an active product. Investigate immediately.');
  }

  if (imageBytes) {
    const image = await client.uploadImage(created.id, {
      bytes: imageBytes,
      filename: imageFilename,
      contentType: imageContentType,
      sourceKind: 'user',
      altText: payload.name,
      isPrimary: true,
    });
    console.log(
      `Image attached: id=${image.id} ${image.width}x${image.height} ${image.bytes} bytes`,
    );
  }

  console.log('\nThe draft is waiting for staff review at /admin/drafts.');
  return 0;
}

export async function main(argv = process.argv.slice(2), env = process.env) {
  let args;
  try {
    args = parseArgs(argv);
  } catch (error) {
    console.error(error.message);
    console.error(usage());
    return 2;
  }

  if (args.help || args._.length === 0) {
    console.log(usage());
    return args.help ? 0 : 1;
  }

  const command = args._[0];

  let token;
  try {
    token = readToken(env);
  } catch (error) {
    if (error instanceof MissingTokenError) {
      console.error(error.message);
      return 2;
    }
    throw error;
  }

  console.log(`Using token ${redactToken(token)}`);

  const client = createClient({ token });

  try {
    if (command === 'taxonomy') return await runTaxonomy(client);
    if (command === 'validate') return await runValidate(client, args);
    if (command === 'draft') return await runDraft(client, args);
    console.error(`Unknown command: ${command}`);
    console.error(usage());
    return 2;
  } catch (error) {
    if (error instanceof ApiError) {
      console.error(`\nRequest failed: ${error.message}`);
      return 3;
    }
    console.error(`\nError: ${error.message}`);
    return 3;
  }
}

// Only run when executed directly, so tests can import main().
const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (invokedDirectly) {
  main().then((code) => process.exit(code));
}
