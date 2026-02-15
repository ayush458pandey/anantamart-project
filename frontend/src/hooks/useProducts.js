import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import axios from '../api/axios';

export const useProducts = () => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const location = useLocation();

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch categories and products IN PARALLEL
      const [categoriesRes, productsRes] = await Promise.all([
        axios.get('/categories/'),
        axios.get('/products/'),
      ]);

      const categoriesData = Array.isArray(categoriesRes.data)
        ? categoriesRes.data
        : (categoriesRes.data.results || []);

      setCategories(categoriesData);

      let productsData = Array.isArray(productsRes.data)
        ? productsRes.data
        : (productsRes.data.results || []);

      // Fix Image Logic for Cloudinary
      productsData = productsData.map(product => {
        if (product.image_url) {
          product.image = product.image_url;
        } else if (product.images && product.images.length > 0) {
          product.image = product.images[0].image;
        }
        return product;
      });

      setProducts(productsData);
      setError(null);

    } catch (err) {
      setError(`Failed to fetch data: ${err.message}`);
      setProducts([]);
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Refetch when navigating back to a page that uses this hook
  useEffect(() => {
    fetchData();
  }, [location.pathname, fetchData]);

  return { products, categories, loading, error, refetch: fetchData };
};