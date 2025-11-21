import axiosInstance from '../axios';

export const cartService = {
  // Get cart with extended timeout and better error handling
  getCart: async () => {
    try {
      const response = await axiosInstance.get('/cart/my_cart/', {
        timeout: 20000, // Extended timeout for cart fetch (20 seconds)
      });
      return response.data;
    } catch (error) {
      // Handle timeout and network errors gracefully
      if (error.code === 'ECONNABORTED') {
        console.warn('Cart fetch timeout - backend may be slow or unavailable. Using empty cart.');
        return { items: [], total_items: 0, total_price: 0 };
      }
      
      if (error.code === 'ERR_NETWORK' || error.message?.includes('Network Error')) {
        console.warn('Network error - backend may not be running. Using empty cart.');
        return { items: [], total_items: 0, total_price: 0 };
      }
      
      // For other errors (like 404, 500), still return empty cart but log the error
      if (error.response) {
        console.warn('Cart API error:', error.response.status, error.response.data);
      } else {
        console.warn('Cart fetch error:', error.message);
      }
      
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
  
  // Update cart item quantity - ADDED THIS
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
