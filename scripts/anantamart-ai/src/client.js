/**
 * AnantaMart AI API client.
 *
 * Talks to the restricted AI API only:
 *   GET  /taxonomy/
 *   POST /drafts/
 *   POST /drafts/{id}/images/
 *
 * The bearer token is read exclusively from process.env.ANANTAMART_AI_TOKEN and
 * is never returned in an error, written to disk, or included in output.
 */
import process from 'node:process';

export const DEFAULT_BASE_URL = 'https://api.ananta-mart.in/api/ai/v1';

/** A valid token is exactly 55 chars: "ai_" + 8 hex + "_" + 43 base64url. */
const TOKEN_SHAPE = /^ai_[0-9a-f]{8}_[A-Za-z0-9_-]{43}$/;

export class ApiError extends Error {
  constructor(message, { status = null, body = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

export class MissingTokenError extends Error {
  constructor(message) {
    super(message);
    this.name = 'MissingTokenError';
  }
}

/**
 * Read and shape-check the token without ever exposing its value.
 * Throws MissingTokenError with a reason that contains no secret material.
 */
export function readToken(env = process.env) {
  const raw = env.ANANTAMART_AI_TOKEN;
  if (!raw) {
    throw new MissingTokenError(
      'ANANTAMART_AI_TOKEN is not set. In PowerShell run:\n' +
        '  $env:ANANTAMART_AI_TOKEN = Read-Host "Paste AI token"',
    );
  }

  // A token pasted with a trailing newline is the most common cause of a
  // header the server rejects before it ever reaches Django.
  if (raw !== raw.trim()) {
    throw new MissingTokenError(
      'ANANTAMART_AI_TOKEN has leading or trailing whitespace, which makes the ' +
        'Authorization header invalid. Re-set it without copying a newline.',
    );
  }
  if (/\s/.test(raw)) {
    throw new MissingTokenError(
      'ANANTAMART_AI_TOKEN contains whitespace. It must be a single token.',
    );
  }
  if (!TOKEN_SHAPE.test(raw)) {
    throw new MissingTokenError(
      `ANANTAMART_AI_TOKEN does not match the expected format ` +
        `(expected 55 characters: ai_ + 8 hex + _ + 43 base64url; got ${raw.length}). ` +
        'Copy it again from Admin -> AI Access Management.',
    );
  }
  return raw;
}

/** Redact a token for logging. Only ever used on already-validated tokens. */
export function redactToken(token) {
  if (!token || token.length < 12) return '***';
  return `${token.slice(0, 11)}...(redacted)`;
}

/**
 * Turn a fetch failure or non-2xx response into a readable ApiError.
 * The token is never part of the message.
 */
function describeHttpError(status, text) {
  let detail = '';
  if (text) {
    try {
      const parsed = JSON.parse(text);
      detail = parsed.detail || parsed.error || '';
      if (!detail && parsed.errors) detail = JSON.stringify(parsed.errors);
    } catch {
      detail = text.slice(0, 200);
    }
  }

  const hints = {
    401: 'Token rejected. Check it exists, has not expired, and has not been revoked.',
    403: 'Token is valid but lacks the required scope for this operation.',
    404: 'Endpoint or draft not found.',
    409: 'Draft is already published; images are locked.',
    429: 'Rate limited. Wait a minute and retry.',
  };

  const base = `HTTP ${status}`;
  const parts = [base];
  if (detail) parts.push(detail);
  if (hints[status]) parts.push(hints[status]);
  return parts.join(' - ');
}

export function createClient({
  token,
  baseUrl = DEFAULT_BASE_URL,
  fetchImpl = globalThis.fetch,
  timeoutMs = 30000,
} = {}) {
  if (!token) throw new MissingTokenError('A token is required.');
  if (typeof fetchImpl !== 'function') {
    throw new Error('No fetch implementation available (Node 18+ required).');
  }

  const root = baseUrl.replace(/\/+$/, '');

  async function request(path, { method = 'GET', body, headers = {} } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let response;
    try {
      response = await fetchImpl(`${root}/${path.replace(/^\/+/, '')}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          ...headers,
        },
        body,
        signal: controller.signal,
      });
    } catch (error) {
      const reason =
        error?.name === 'AbortError'
          ? `Request timed out after ${timeoutMs}ms.`
          : `Network error: ${error?.message || 'unknown'}`;
      throw new ApiError(reason);
    } finally {
      clearTimeout(timer);
    }

    const text = await response.text();

    if (!response.ok) {
      throw new ApiError(describeHttpError(response.status, text), {
        status: response.status,
        body: text,
      });
    }

    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      throw new ApiError('Server returned a non-JSON response.', {
        status: response.status,
        body: text.slice(0, 300),
      });
    }
  }

  return {
    /** GET /taxonomy/ -- categories, subcategories, brands and tag groups. */
    async getTaxonomy() {
      const data = await request('taxonomy/', { method: 'GET' });
      return {
        categories: Array.isArray(data?.categories) ? data.categories : [],
        brands: Array.isArray(data?.brands) ? data.brands : [],
        tagGroups: Array.isArray(data?.tag_groups) ? data.tag_groups : [],
      };
    },

    /** POST /drafts/ -- submit one product payload. Returns the created entry. */
    async createDraft(payload) {
      const data = await request('drafts/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const created = Array.isArray(data?.created) ? data.created : [];
      const failed = Array.isArray(data?.failed) ? data.failed : [];

      if (created.length === 0) {
        const problems = failed[0]?.errors ?? data ?? 'No draft was created.';
        throw new ApiError('Draft was rejected by the server.', {
          status: 200,
          body: problems,
        });
      }
      return created[0];
    },

    /** POST /drafts/{id}/images/ -- upload raw bytes as multipart/form-data. */
    async uploadImage(draftId, { bytes, filename, contentType, sourceUrl, sourceKind, altText, isPrimary }) {
      const form = new FormData();
      form.append('file', new Blob([bytes], { type: contentType }), filename);
      if (sourceUrl) form.append('source_url', sourceUrl);
      if (sourceKind) form.append('source_kind', sourceKind);
      if (altText) form.append('alt_text', altText);
      if (isPrimary) form.append('is_primary', 'true');

      return request(`drafts/${encodeURIComponent(draftId)}/images/`, {
        method: 'POST',
        body: form,
      });
    },
  };
}
