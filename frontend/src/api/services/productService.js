import axiosInstance from '../axios';

export const productService = {
  // Get all products with optional filters
  getAllProducts: async (params = {}) => {
    const response = await axiosInstance.get('/products/', { params });
    return response.data;
  },

  // Get products with brand and subcategory filtering
  getProducts: async (categoryId, brands = [], subcategories = []) => {
    const params = {};
    if (categoryId && categoryId !== 'all') {
      params.category = categoryId;
    }
    if (brands.length > 0) {
      params.brands = brands.join(',');
    }
    if (subcategories.length > 0) {
      params.subcategories = subcategories.join(',');
    }
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

  // Get filter options (brands and subcategories) for a category
  getFilterOptions: async (categoryId, selectedSubcategories = []) => {
    const params = { category: categoryId };
    if (selectedSubcategories.length > 0) {
      params.subcategory = selectedSubcategories.join(',');
    }
    const response = await axiosInstance.get('/products/filter_options/', { params });
    return response.data;
  },

  // Get subcategories for a category
  getSubcategories: async (categoryId) => {
    const response = await axiosInstance.get('/subcategories/', {
      params: { category: categoryId }
    });
    return response.data;
  },

  // Get subcategories with images for a category
  getSubcategoriesWithImages: async (categoryId) => {
    const response = await axiosInstance.get(`/categories/${categoryId}/subcategories/`);
    return response.data;
  },

  // Get all brands
  getBrands: async () => {
    const response = await axiosInstance.get('/brands/');
    return response.data.results || response.data; // Handle paginated response
  },

  // Get brand by slug
  getBrandBySlug: async (slug) => {
    const response = await axiosInstance.get(`/brands/${slug}/`);
    return response.data;
  },

  // Get products by brand
  getProductsByBrand: async (brandSlug, categoryId = null) => {
    const params = categoryId ? { category: categoryId } : {};
    const response = await axiosInstance.get(`/brands/${brandSlug}/products/`, { params });
    return response.data;
  },
};
