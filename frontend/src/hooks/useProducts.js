// src/hooks/useProducts.js - UPDATED
import { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000/api';

export const useProducts = () => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch categories
        const categoriesRes = await axios.get(`${API_BASE_URL}/categories/`);
        console.log('📦 Categories Response:', categoriesRes.data);
        
        // Handle both array and paginated response
        const categoriesData = Array.isArray(categoriesRes.data) 
          ? categoriesRes.data 
          : (categoriesRes.data.results || []);
        
        setCategories(categoriesData);

        // Fetch products
        const productsRes = await axios.get(`${API_BASE_URL}/products/`);
        console.log('📦 Products Response:', productsRes.data);
        
        // Handle both array and paginated response
        const productsData = Array.isArray(productsRes.data) 
          ? productsRes.data 
          : (productsRes.data.results || []);
        
        setProducts(productsData);

        setError(null);
      } catch (err) {
        console.error('❌ Error:', err.message);
        setError('Failed to fetch data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return { products, categories, loading, error };
};
