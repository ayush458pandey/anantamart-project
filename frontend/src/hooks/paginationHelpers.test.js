import test from 'node:test';
import assert from 'node:assert/strict';
import { readPage, buildRemainingPageUrls, fetchPagesInBatches } from './paginationHelpers.js';

test('readPage extracts nextUrl and totalCount from DRF paginated response', () => {
  const page = readPage({
    count: 1361,
    next: 'https://api.ananta-mart.in/api/products/?page=2',
    results: [{ id: 1 }, { id: 2 }],
  });

  assert.equal(page.products.length, 2);
  assert.equal(page.nextUrl, '/products/?page=2');
  assert.equal(page.totalCount, 1361);
});

test('readPage handles unpaginated array responses', () => {
  const page = readPage([{ id: 1 }, { id: 2 }, { id: 3 }]);

  assert.equal(page.products.length, 3);
  assert.equal(page.nextUrl, null);
  assert.equal(page.totalCount, 3);
});

test('buildRemainingPageUrls generates pages 2..N preserving query params', () => {
  const urls = buildRemainingPageUrls('/products/?page=2&page_size=100', 100, 350);

  assert.deepEqual(urls, [
    '/products/?page=2&page_size=100',
    '/products/?page=3&page_size=100',
    '/products/?page=4&page_size=100',
  ]);
});

test('buildRemainingPageUrls returns empty when everything fits on page 1', () => {
  assert.deepEqual(buildRemainingPageUrls(null, 50, 50), []);
  assert.deepEqual(buildRemainingPageUrls('/products/?page=2', 100, 100), []);
});

test('fetchPagesInBatches preserves page order even when later pages resolve first', async () => {
  const delays = { '/p2': 40, '/p3': 5, '/p4': 25, '/p5': 10 };
  const results = await fetchPagesInBatches(
    ['/p2', '/p3', '/p4', '/p5'],
    (url) => new Promise((resolve) => setTimeout(() => resolve(url), delays[url])),
    2
  );

  assert.deepEqual(results, ['/p2', '/p3', '/p4', '/p5']);
});
