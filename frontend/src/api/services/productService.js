import axiosInstance from '../axios';

export const productService = {
  // Get all products
  getAllProducts: async (params = {}) => {
    const response = await axiosInstance.get('/products/', { params });
    return response.data;
  },
  
  // Get single product
  getProductById: async (id) => {
    const response = await axiosInstance.get(`/products/${id}/`);
    return response.data;
  },
  
  // Get categories
  getCategories: async () => {
    const response = await axiosInstance.get('/categories/');
    return response.data;
  },
};
