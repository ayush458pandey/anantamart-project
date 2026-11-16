/**
 * Pure pagination helpers used by useProducts to parallelize page 2..N fetches
 * without pulling React/axios dependencies into Node unit tests.
 */
export const readPage = (data) => {
  if (Array.isArray(data)) {
    return { products: data, nextUrl: null, totalCount: data.length };
  }

  let nextUrl = null;
  if (data.next) {
    try {
      const url = new URL(data.next);
      nextUrl = url.pathname.replace(/^\/api/, '') + url.search;
    } catch {
      nextUrl = null;
    }
  }

  return {
    products: data.results || [],
    nextUrl,
    totalCount: typeof data.count === 'number' ? data.count : null,
  };
};

// Build the remaining page URLs from page 1's `next` link and total `count`
// so pages 2..N can be fetched in parallel instead of sequentially.
export const buildRemainingPageUrls = (nextUrl, page1Size, totalCount) => {
  if (!nextUrl || !page1Size || !totalCount || totalCount <= page1Size) {
    return [];
  }
  const totalPages = Math.ceil(totalCount / page1Size);
  const urls = [];
  const hasPageParam = /([?&])page=\d+/.test(nextUrl);
  for (let page = 2; page <= totalPages; page += 1) {
    if (hasPageParam) {
      urls.push(nextUrl.replace(/([?&])page=\d+/, `$1page=${page}`));
    } else {
      const sep = nextUrl.includes('?') ? '&' : '?';
      urls.push(`${nextUrl}${sep}page=${page}`);
    }
  }
  return urls;
};

// Fetch an ordered list of page URLs with bounded concurrency, preserving
// page order even if later pages finish sooner.
export const fetchPagesInBatches = async (urls, fetchFn, concurrency = 5) => {
  const results = new Array(urls.length);
  for (let start = 0; start < urls.length; start += concurrency) {
    const chunk = urls.slice(start, start + concurrency);
    const responses = await Promise.all(chunk.map((url) => fetchFn(url)));
    responses.forEach((res, idx) => {
      results[start + idx] = res;
    });
  }
  return results;
};
