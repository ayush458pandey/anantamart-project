import { useState, useEffect } from 'react';
// Import the custom axios instance we configured earlier
// MAKE SURE THIS PATH MATCHES WHERE YOU SAVED axios.js
import axios from '../api/axios';

export const useProducts = () => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // 1. Fetch Categories
        // We use simple paths ('/categories/') because the Base URL is in axios.js
        const categoriesRes = await axios.get('/categories/');
        console.log('📦 Full Categories Response:', categoriesRes.data);

        const categoriesData = Array.isArray(categoriesRes.data)
          ? categoriesRes.data
          : (categoriesRes.data.results || []);

        setCategories(categoriesData);

        // 2. Fetch Products
        const productsRes = await axios.get('/products/');
        console.log('📦 Full Products Response:', productsRes.data);

        let productsData = Array.isArray(productsRes.data)
          ? productsRes.data
          : (productsRes.data.results || []);

        // 3. Fix Image Logic for Cloudinary
        productsData = productsData.map(product => {
          // Cloudinary gives us full URLs, so we don't need "localhost" anymore.
          // We prioritize 'image_url' if it exists.
          if (product.image_url) {
            product.image = product.image_url;
          }
          // If we have gallery images, use the first one as the main image
          else if (product.images && product.images.length > 0) {
            product.image = product.images[0].image;
          }
          return product;
        });

        console.log('✅ Products Array:', productsData);
        setProducts(productsData);
        setError(null);

      } catch (err) {
        console.error('❌ Error:', err);
        setError(`Failed to fetch data: ${err.message}`);
        setProducts([]);
        setCategories([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return { products, categories, loading, error };
};