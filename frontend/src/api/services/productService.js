import axiosInstance from '../axios';

export const productService = {
  // Get all products with optional filters
  getAllProducts: async (params = {}) => {
    const response = await axiosInstance.get('/products/', { params });
    return response.data;
  },

  // Get products with brand, subcategory, and tag filtering
  getProducts: async (categoryId, brands = [], subcategories = [], tags = []) => {
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
    if (tags.length > 0) {
      params.tags = tags.join(',');
    }
    const response = await axiosInstance.get('/products/', { params });
    return response.data;
  },

  // Get single product
  getProductById: async (id) => {
    const response = await axiosInstance.get(`/products/${id}/`);
    return response.data;
  },

  // Get single product by slug (SEO-friendly URL)
  getProductBySlug: async (slug) => {
    const response = await axiosInstance.get(`/products/by-slug/${slug}/`);
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

  // Get all brands (follows pagination so brands beyond the first page,
  // e.g. TAPARIA, are included with their logos).
  getBrands: async () => {
    const first = await axiosInstance.get('/brands/');

    // Unpaginated response (plain array).
    if (Array.isArray(first.data)) return first.data;

    const results = [...(first.data.results || [])];
    let next = first.data.next;

    // Follow `next` links, rewriting the absolute API host to a relative path
    // so the request goes through the configured axios baseURL/proxy.
    while (next) {
      let path = next;
      try {
        const parsed = new URL(next, window.location.origin);
        path = parsed.pathname.replace(/^\/api/, '') + parsed.search;
      } catch {
        // Leave `next` as-is if it cannot be parsed.
      }
      const page = await axiosInstance.get(path);
      if (Array.isArray(page.data)) {
        results.push(...page.data);
        break;
      }
      results.push(...(page.data.results || []));
      next = page.data.next;
      // Safety valve against an unexpected infinite loop.
      if (results.length > 5000) break;
    }

    return results;
  },

  // Get brand by slug
  getBrandBySlug: async (slug) => {
    const response = await axiosInstance.get(`/brands/${slug}/`);
    return response.data;
  },

  // Get tag group by slug
  getTagGroupBySlug: async (slug) => {
    const response = await axiosInstance.get(`/tag-groups/${slug}/`);
    return response.data;
  },

  // Get products by brand
  getProductsByBrand: async (brandSlug, categoryId = null) => {
    const params = categoryId ? { category: categoryId } : {};
    const response = await axiosInstance.get(`/brands/${brandSlug}/products/`, { params });
    return response.data;
  },
};
