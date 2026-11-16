import axiosInstance from '../axios';

export const productService = {
  // Get all products with optional filters
  getAllProducts: async (params = {}) => {
    const response = await axiosInstance.get('/products/', { params });
    return response.data;
  },

  // Get products with brand, subcategory, and tag filtering.
  // Walks pagination only if a caller explicitly passes { allPages: true },
  // or returns the first page when called with positional args for backwards compatibility.
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

  // Get every product for a brand, following pagination.
  // The brand filter paginates at 100 per page, so a large brand like Anchor
  // (281 products) would otherwise be silently truncated to its first page.
  getBrandProducts: async (brandName) => {
    const first = await axiosInstance.get('/products/', {
      params: { brands: brandName },
    });

    if (Array.isArray(first.data)) return first.data;

    const results = [...(first.data.results || [])];
    const totalCount = typeof first.data.count === 'number' ? first.data.count : null;
    let next = first.data.next;

    if (!next) return results;

    // Derive the remaining page URLs from `count` and fetch them in parallel.
    const pageSize = results.length;
    if (totalCount && pageSize > 0 && totalCount > pageSize) {
      const totalPages = Math.ceil(totalCount / pageSize);
      const urls = [];
      for (let page = 2; page <= totalPages; page += 1) {
        urls.push({ brands: brandName, page });
      }
      const pages = await Promise.all(
        urls.map((params) => axiosInstance.get('/products/', { params }))
      );
      for (const res of pages) {
        results.push(...(Array.isArray(res.data) ? res.data : (res.data.results || [])));
      }
      return results;
    }

    // Fallback: follow `next` links sequentially.
    while (next) {
      let path = next;
      try {
        const parsed = new URL(next, window.location.origin);
        path = parsed.pathname.replace(/^\/api/, '') + parsed.search;
      } catch {
        // Leave `next` as-is if it cannot be parsed.
      }
      const res = await axiosInstance.get(path);
      if (Array.isArray(res.data)) {
        results.push(...res.data);
        break;
      }
      results.push(...(res.data.results || []));
      next = res.data.next;
      if (results.length > 5000) break;
    }

    return results;
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

  // Get all brands (cached across calls and fetches remaining pages in parallel
  // so brands beyond page 1 load in one round trip instead of sequentially).
  getBrands: (() => {
    let cachedBrands = null;
    let cachedAt = 0;
    let inflight = null;
    const BRANDS_TTL = 5 * 60 * 1000;

    return async () => {
      if (cachedBrands && Date.now() - cachedAt < BRANDS_TTL) {
        return cachedBrands;
      }
      if (inflight) return inflight;

      inflight = (async () => {
        try {
          const first = await axiosInstance.get('/brands/');
          if (Array.isArray(first.data)) {
            cachedBrands = first.data;
            cachedAt = Date.now();
            return cachedBrands;
          }

          const firstResults = first.data.results || [];
          const results = [...firstResults];
          const next = first.data.next;
          const totalCount = typeof first.data.count === 'number' ? first.data.count : null;

          if (next && totalCount && firstResults.length > 0 && totalCount > firstResults.length) {
            const totalPages = Math.ceil(totalCount / firstResults.length);
            let baseNextPath = next;
            try {
              const parsed = new URL(next, window.location.origin);
              baseNextPath = parsed.pathname.replace(/^\/api/, '') + parsed.search;
            } catch {
              // Leave as-is if relative.
            }
            const urls = [];
            for (let page = 2; page <= totalPages; page += 1) {
              urls.push(
                /([?&])page=\d+/.test(baseNextPath)
                  ? baseNextPath.replace(/([?&])page=\d+/, `$1page=${page}`)
                  : `${baseNextPath}${baseNextPath.includes('?') ? '&' : '?'}page=${page}`
              );
            }
            const pages = await Promise.all(urls.map((u) => axiosInstance.get(u)));
            for (const p of pages) {
              results.push(...(Array.isArray(p.data) ? p.data : (p.data.results || [])));
            }
          } else {
            let cursor = next;
            while (cursor) {
              let path = cursor;
              try {
                const parsed = new URL(cursor, window.location.origin);
                path = parsed.pathname.replace(/^\/api/, '') + parsed.search;
              } catch {
                // Leave `cursor` as-is if it cannot be parsed.
              }
              const page = await axiosInstance.get(path);
              if (Array.isArray(page.data)) {
                results.push(...page.data);
                break;
              }
              results.push(...(page.data.results || []));
              cursor = page.data.next;
              if (results.length > 5000) break;
            }
          }

          cachedBrands = results;
          cachedAt = Date.now();
          return cachedBrands;
        } finally {
          inflight = null;
        }
      })();

      return inflight;
    };
  })(),

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
