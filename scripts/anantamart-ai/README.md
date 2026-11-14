# AnantaMart AI Product Assistant

A small local CLI that talks to AnantaMart's **restricted AI API** to fetch the
live product taxonomy and prepare **inactive product drafts** for staff review.

It is a standalone utility. It does not touch the Django backend, the database
schema, migrations, or any deployment configuration.

## What it can and cannot do

| Can | Cannot |
| --- | --- |
| Read the taxonomy (`/api/ai/v1/taxonomy/`) | Publish or activate a product |
| Create one draft product at a time | Edit or delete existing products |
| Attach an image to a draft it created | Read orders, customers, payments or inventory |
| Show a preview before submitting | Fetch external image URLs |
| Validate payloads before sending | Access admin operations |

Those limits are enforced **server-side** by the token's scopes
(`taxonomy:read`, `product:draft`, `image:upload`). The CLI has no code path
that could publish even if asked.

Every draft is created with `is_active = false` and appears at
`/admin/drafts` for review.

## Requirements

- Node.js 18 or newer (uses built-in `fetch` and `FormData`)
- An AI access token from **Admin → AI Access Management**

## Setup

```powershell
cd scripts\anantamart-ai
node --version      # must be 18+
```

No `npm install` is required — there are no dependencies.

Set the token **in the terminal session only**. Never put it in a file.

```powershell
$env:ANANTAMART_AI_TOKEN = Read-Host "Paste AI token"
```

`Read-Host` does not echo what you paste.

## Usage

### 1. Verify the connection

```powershell
node src/cli.js taxonomy
```

Prints categories with their subcategories, all brands, and tag groups. If the
token is wrong you get a clear message and a non-zero exit code.

### 2. Validate a file against the live taxonomy (creates nothing)

```powershell
node src/cli.js validate --file examples/apsara-eraser.json
```

Fetches the real taxonomy over the API and checks every reference in the file
against it. Every category, subcategory and brand id printed comes from that
live response - nothing is hardcoded. It then prints the exact JSON payload that
would be posted and the validation result.

Exit codes: `0` ready, `2` not ready.

### 3. Preview a draft (no submission)

```powershell
node src/cli.js draft --file examples/apsara-eraser.json
```

This fetches the taxonomy, validates the payload, resolves every taxonomy
reference against the live catalogue, prints a preview, and then asks for
confirmation. Answer `n` and nothing is sent.

### 4. Create the draft

```powershell
node src/cli.js draft --file examples/apsara-eraser.json
# answer y at the prompt, or pass --yes to skip it

# with an image
node src/cli.js draft --file examples/apsara-eraser.json --image C:\path\to\eraser.webp
```

Prints the new draft id, SKU, and status. The draft is visible in the staff
review screen and is **not** publicly visible until approved.

## SKU rules

SKUs follow this convention:

- lowercase
- the **complete** product name, never an abbreviation
- spaces become hyphens
- special characters removed
- brand, product type, model and size preserved
- unique across the catalogue
- existing product SKUs are never rewritten

```
Apsara Non-Dust Eraser                -> apsara-non-dust-eraser
Jupiter Tailoring Scissors 8 Inch     -> jupiter-tailoring-scissors-8-inch
Coats Polyester Thread 1000m          -> coats-polyester-thread-1000m
```

If you omit `sku` from the product file, the CLI derives one from `name` using
exactly these rules (`slugifySku`). If you supply a `sku`, it is used verbatim.

Uniqueness: set `existing_skus` in the product file to a list of SKUs already in
the catalogue and the CLI will refuse a clash before sending anything. The
server's own `sku__iexact` check remains authoritative.

> **Known limitation - the backend uppercases SKUs.**
> `ProductWriteSerializer.validate_sku()` calls `.upper()` on every SKU, so
> `apsara-non-dust-eraser` is stored as `APSARA-NON-DUST-ERASER`. The CLI sends
> lowercase as requested; the stored value will be uppercase until the backend
> changes. `validate` reports this explicitly.

## Product file format

The API accepts taxonomy **by name**, not by id. Names are matched
case-insensitively against the live catalogue; unknown names are rejected and
never auto-created.

`required`

| Field | Notes |
| --- | --- |
| `name` | Product name |
| `sku` | Uppercased automatically; must be unique |
| `description` | Must not be blank |
| `category_name` | Must already exist |
| `base_price` | Number greater than zero |

`optional`

| Field | Notes |
| --- | --- |
| `subcategory_name` | Must belong to the chosen category |
| `brand_name` | Must already exist |
| `tag_names` | Array of existing tag names |
| `mrp` | Greater than zero, not below `base_price` |
| `purchase_price` | Internal cost |
| `tax_rate` | One of `0`, `5`, `18`, `40` |
| `hsn_code`, `unit`, `weight`, `product_type`, `key_features`, `available_colors`, `packaging_type`, `dietary_preference`, `ingredients`, `storage_instruction`, `usage_recommendation` | Free text |
| `moq`, `case_size` | At least 1 |
| `stock` | Zero or more |

`is_active` is deliberately **not supported**. The server forces every draft to
be inactive, and the CLI strips the field even if present.

## Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Success |
| `1` | Cancelled by the user, or no command given |
| `2` | Missing or malformed token, invalid local payload, or unknown taxonomy |
| `3` | API or network failure |

## Tests

```powershell
node --test "test/*.test.js"
```

78 tests. All network calls are stubbed — **no test creates a real product**.

Coverage includes: missing token, malformed token, whitespace in token, 401/403
handling, non-JSON responses, network failure, malformed payloads, unknown
taxonomy references, and confirmation of the guarantee that `is_active` is never
sent and exactly one draft request is made.

The `validate` tests use a taxonomy response with deliberately unusual ids
(999/555/777) and assert those ids appear in the output, which fails if the CLI
ever falls back to a hardcoded map.

## Token safety

- Read only from `process.env.ANANTAMART_AI_TOKEN`
- Never written to disk, logged, or included in any error message
- Only the first 11 characters are ever shown (`ai_01234567...(redacted)`)
- The token is validated for shape and stray whitespace before any request,
  because a pasted trailing newline makes the `Authorization` header invalid
  and the server rejects it before it reaches the application

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| `HTTP 401 - Invalid AI token.` | Token is not in the database, or the value is wrong |
| `HTTP 401 - This AI token has expired.` | Default lifetime is 60 minutes; create a new token |
| `HTTP 401 - This AI token has been revoked.` | Revoked in admin |
| `HTTP 403 - lacks the required scope` | Token is missing `product:draft` or `image:upload` |
| `does not match the expected format` | A valid token is exactly 55 chars: `ai_` + 8 hex + `_` + 43 base64url |
| `has leading or trailing whitespace` | Re-paste without the newline |
| `Category "X" does not exist` | Run `taxonomy` and use an exact name |
