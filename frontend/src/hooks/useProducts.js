import { useState, useEffect, useCallback, useRef } from 'react';
import axios from '../api/axios';
import { readPage, buildRemainingPageUrls, fetchPagesInBatches } from './paginationHelpers';

// Module-level cache persists across component remounts and route changes.
let cachedProducts = null;
let cachedCategories = null;
let lastFetchTime = 0;
// Keep the cache warm long enough that switching tabs or navigating back
// doesn't re-walk 14+ paginated requests every few seconds.
const CACHE_TTL = 60 * 1000; // 60 seconds
const FOCUS_REFRESH_MIN_AGE = 30 * 1000; // 30 seconds
const PAGE_CONCURRENCY = 5;

const normalizeProducts = (productsData) => productsData.map(product => ({
  ...product,
  image: product.image_url || product.images?.[0]?.image || product.image,
}));

export const useProducts = () => {
  const [products, setProducts] = useState(cachedProducts || []);
  const [categories, setCategories] = useState(cachedCategories || []);
  const [loading, setLoading] = useState(!cachedProducts);
  const [loadingMore, setLoadingMore] = useState(false);
  // True once every page has been fetched (or the walk gave up). Consumers use
  // this to tell "still loading" apart from "genuinely no matches", because the
  // catalogue is paginated and filters only see what has arrived so far.
  const [allLoaded, setAllLoaded] = useState(Boolean(cachedProducts));
  const [error, setError] = useState(null);
  const fetchingRef = useRef(false);

  const fetchData = useCallback(async (force = false) => {
    const now = Date.now();
    const isCacheValid = cachedProducts && cachedCategories && (now - lastFetchTime < CACHE_TTL);

    if (isCacheValid && !force) {
      setProducts(cachedProducts);
      setCategories(cachedCategories);
      setLoading(false);
      return;
    }

    if (fetchingRef.current) return;
    fetchingRef.current = true;

    try {
      if (!cachedProducts) {
        setLoading(true);
      }

      const categoriesPromise = axios.get('/categories/');
      const firstProductsPromise = axios.get('/products/');

      const [categoriesRes, firstProductsRes] = await Promise.all([
        categoriesPromise,
        firstProductsPromise,
      ]);

      const categoriesData = Array.isArray(categoriesRes.data)
        ? categoriesRes.data
        : (categoriesRes.data.results || []);

      const firstPage = readPage(firstProductsRes.data);
      const firstProductsData = normalizeProducts(firstPage.products);

      // Only overwrite visible products immediately on initial cold load; during a
      // background refresh keep the existing full list until all pages settle.
      if (!cachedProducts) {
        cachedProducts = firstProductsData;
        setProducts(firstProductsData);
      }
      cachedCategories = categoriesData;
      lastFetchTime = Date.now();

      setCategories(categoriesData);
      setError(null);
      setLoading(false);
      setLoadingMore(Boolean(firstPage.nextUrl));
      if (!firstPage.nextUrl) {
        cachedProducts = firstProductsData;
        setProducts(firstProductsData);
        setAllLoaded(true);
        return;
      }

      let productsData = firstProductsData;
      const remainingUrls = buildRemainingPageUrls(
        firstPage.nextUrl,
        firstProductsData.length,
        firstPage.totalCount
      );

      if (remainingUrls.length > 0) {
        // Fetch pages 2..N in parallel batches so 1,361 products load in ~3s instead of ~20-40s.
        const pageResponses = await fetchPagesInBatches(
          remainingUrls,
          (url) => axios.get(url),
          PAGE_CONCURRENCY
        );
        for (const pageRes of pageResponses) {
          const page = readPage(pageRes.data);
          productsData = productsData.concat(normalizeProducts(page.products));
        }
      } else {
        // Fallback sequential walk if `count` wasn't returned.
        let nextUrl = firstPage.nextUrl;
        while (nextUrl) {
          const nextRes = await axios.get(nextUrl);
          const nextPage = readPage(nextRes.data);
          productsData = productsData.concat(normalizeProducts(nextPage.products));
          nextUrl = nextPage.nextUrl;
        }
      }

      cachedProducts = productsData;
      lastFetchTime = Date.now();
      setProducts(productsData);
      setLoadingMore(false);
      setAllLoaded(true);
    } catch (err) {
      if (cachedProducts) {
        setProducts(cachedProducts);
        setCategories(cachedCategories);
      } else {
        setError(`Failed to fetch data: ${err.message}`);
        setProducts([]);
        setCategories([]);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
      // A failed page walk must not leave the UI stuck on "loading more".
      setAllLoaded(true);
      fetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Re-fetch when the user returns to the tab only if the cache is stale,
  // avoiding a full multi-page reload on every window click/focus.
  useEffect(() => {
    const refreshIfStale = () => {
      if (Date.now() - lastFetchTime >= FOCUS_REFRESH_MIN_AGE) {
        fetchData(true);
      }
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        refreshIfStale();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', refreshIfStale);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', refreshIfStale);
    };
  }, [fetchData]);

  return {
    products,
    categories,
    loading,
    loadingMore,
    allLoaded,
    error,
    refetch: () => fetchData(true),
  };
};
