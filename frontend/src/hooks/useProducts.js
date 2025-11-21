import { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000/api';

export const useProducts = () => {
  const [products, setProducts] = useState([]);  // Initialize as empty array
  const [categories, setCategories] = useState([]);  // Initialize as empty array
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch categories
        const categoriesRes = await axios.get(`${API_BASE_URL}/categories/`);
        console.log('📦 Full Categories Response:', categoriesRes.data);
        
        // Handle both array and paginated response
        const categoriesData = Array.isArray(categoriesRes.data) 
          ? categoriesRes.data 
          : (categoriesRes.data.results || []);
        
        console.log('✅ Categories Array:', categoriesData);
        setCategories(categoriesData);

        // Fetch products
        const productsRes = await axios.get(`${API_BASE_URL}/products/`);
        console.log('📦 Full Products Response:', productsRes.data);
        
        // Handle both array and paginated response
        let productsData = Array.isArray(productsRes.data) 
          ? productsRes.data 
          : (productsRes.data.results || []);
        
        // Ensure image URLs are properly formatted
        productsData = productsData.map(product => {
          // Use image_url if available, otherwise use image, otherwise null
          if (product.image_url) {
            product.image = product.image_url;
          } else if (product.image && !product.image.startsWith('http')) {
            // If image is a relative path, make it absolute
            product.image = `http://localhost:8000${product.image}`;
          }
          return product;
        });
        
        console.log('✅ Products Array:', productsData);
        setProducts(productsData);

        setError(null);
      } catch (err) {
        console.error('❌ Error:', err.message);
        setError('Failed to fetch data. Make sure backend is running.');
        // Set empty arrays on error
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
