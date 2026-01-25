import axiosInstance from '../api/axios';

export const cartService = {
  // Get cart - Fixed URL
  getCart: async () => {
    try {
      // 🟢 FIX: Changed from '/cart/my_cart/' to '/cart/' to match Django urls.py
      const response = await axiosInstance.get('/cart/', {
        timeout: 20000,
      });
      return response.data;
    } catch (error) {
      if (error.code === 'ECONNABORTED') {
        console.warn('Cart fetch timeout. Using empty cart.');
        return { items: [], total_items: 0, total_price: 0 };
      }

      if (error.code === 'ERR_NETWORK') {
        console.warn('Network error. Using empty cart.');
        return { items: [], total_items: 0, total_price: 0 };
      }

      console.warn('Cart fetch error:', error.message);
      return { items: [], total_items: 0, total_price: 0 };
    }
  },

  // Add to cart
  addToCart: async (productId, quantity) => {
    const response = await axiosInstance.post('/cart/add/', {
      product_id: productId,
      quantity: quantity
    });
    return response.data;
  },

  // Update cart item quantity
  updateQuantity: async (productId, quantity) => {
    const response = await axiosInstance.post('/cart/add/', {
      product_id: productId,
      quantity: quantity
    });
    return response.data;
  },

  // Update cart item by item ID
  updateCartItem: async (itemId, quantity) => {
    const response = await axiosInstance.put(`/cart/item/${itemId}/`, {
      quantity: quantity
    });
    return response.data;
  },

  // Remove from cart
  removeFromCart: async (itemId) => {
    const response = await axiosInstance.delete(`/cart/remove/${itemId}/`);
    return response.data;
  },

  // Clear cart
  clearCart: async () => {
    const response = await axiosInstance.delete('/cart/clear/');
    return response.data;
  }
};