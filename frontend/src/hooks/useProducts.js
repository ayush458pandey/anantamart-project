import { useState, useEffect, useCallback, useRef } from 'react';
import axios from '../api/axios';

// Module-level cache — persists across component remounts and route changes
let cachedProducts = null;
let cachedCategories = null;
let lastFetchTime = 0;
const CACHE_TTL = 1 * 60 * 1000; // 1 minute

export const useProducts = () => {
  const [products, setProducts] = useState(cachedProducts || []);
  const [categories, setCategories] = useState(cachedCategories || []);
  const [loading, setLoading] = useState(!cachedProducts);
  const [error, setError] = useState(null);
  const fetchingRef = useRef(false);

  const fetchData = useCallback(async (force = false) => {
    const now = Date.now();
    const isCacheValid = cachedProducts && cachedCategories && (now - lastFetchTime < CACHE_TTL);

    // If cache is valid and not forced, skip fetch
    if (isCacheValid && !force) {
      setProducts(cachedProducts);
      setCategories(cachedCategories);
      setLoading(false);
      return;
    }

    // Prevent duplicate concurrent fetches
    if (fetchingRef.current) return;
    fetchingRef.current = true;

    try {
      // Only show loading spinner if we have no cached data at all
      if (!cachedProducts) {
        setLoading(true);
      }

      // Fetch categories
      const categoriesRes = await axios.get('/categories/');
      const categoriesData = Array.isArray(categoriesRes.data)
        ? categoriesRes.data
        : (categoriesRes.data.results || []);

      // Fetch ALL pages of products (handles DRF pagination)
      let productsData = [];
      let nextUrl = '/products/';
      while (nextUrl) {
        const productsRes = await axios.get(nextUrl);
        const data = productsRes.data;
        if (Array.isArray(data)) {
          // No pagination — got raw array
          productsData = data;
          break;
        } else {
          productsData = productsData.concat(data.results || []);
          // Extract relative URL for next page (remove base URL if present)
          if (data.next) {
            try {
              const url = new URL(data.next);
              nextUrl = url.pathname.replace(/^\/api/, '') + url.search;
            } catch {
              nextUrl = null;
            }
          } else {
            nextUrl = null;
          }
        }
      }

      // Fix Image Logic for Cloudinary
      productsData = productsData.map(product => {
        if (product.image_url) {
          product.image = product.image_url;
        } else if (product.images && product.images.length > 0) {
          product.image = product.images[0].image;
        }
        return product;
      });

      // Update cache
      cachedProducts = productsData;
      cachedCategories = categoriesData;
      lastFetchTime = Date.now();

      setProducts(productsData);
      setCategories(categoriesData);
      setError(null);
    } catch (err) {
      // If we have cached data, keep showing it despite the error
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