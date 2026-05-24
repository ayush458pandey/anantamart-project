import { useState, useEffect, useCallback, useRef } from 'react';
import axios from '../api/axios';

// Module-level cache persists across component remounts and route changes.
let cachedProducts = null;
let cachedCategories = null;
let lastFetchTime = 0;
const CACHE_TTL = 1 * 60 * 1000; // 1 minute

const normalizeProducts = (productsData) => productsData.map(product => ({
  ...product,
  image: product.image_url || product.images?.[0]?.image || product.image,
}));

const readPage = (data) => {
  if (Array.isArray(data)) {
    return { products: data, nextUrl: null };
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

  return { products: data.results || [], nextUrl };
};

export const useProducts = () => {
  const [products, setProducts] = useState(cachedProducts || []);
  const [categories, setCategories] = useState(cachedCategories || []);
  const [loading, setLoading] = useState(!cachedProducts);
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

      // Paint with the first page quickly; pull the rest in after LCP is no longer blocked.
      cachedProducts = firstProductsData;
      cachedCategories = categoriesData;
      lastFetchTime = Date.now();

      setProducts(firstProductsData);
      setCategories(categoriesData);
      setError(null);
      setLoading(false);

      let productsData = firstProductsData;
      let nextUrl = firstPage.nextUrl;

      while (nextUrl) {
        const nextRes = await axios.get(nextUrl);
        const nextPage = readPage(nextRes.data);
        productsData = productsData.concat(normalizeProducts(nextPage.products));
        cachedProducts = productsData;
        lastFetchTime = Date.now();
        setProducts(productsData);
        nextUrl = nextPage.nextUrl;
      }
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
      fetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { products, categories, loading, error, refetch: () => fetchData(true) };
};
