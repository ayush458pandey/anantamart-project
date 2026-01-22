import axios from 'axios';

const API_URL = 'https://api.ananta-mart.in/api';

// Create an axios instance with the token automatically attached
const getAuthHeader = () => {
  const token = localStorage.getItem('access_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const cartService = {
  // ✅ FIX: Change 'cart/my_cart/' to 'cart/'
  getCart: async () => {
    try {
      const response = await axios.get(`${API_URL}/cart/`, {
        headers: getAuthHeader()
      });
      // If the backend returns a list, return the first item or empty
      if (Array.isArray(response.data)) {
        return response.data[0] || { items: [], total_items: 0, total_price: 0 };
      }
      return response.data;
    } catch (error) {
      // If 404 (No cart exists yet), return empty cart silently
      if (error.response && error.response.status === 404) {
        return { items: [], total_items: 0, total_price: 0 };
      }
      throw error;
    }
  },

  addToCart: async (productId, quantity = 1) => {
    const response = await axios.post(`${API_URL}/cart/add_item/`, {
      product_id: productId,
      quantity: quantity
    }, { headers: getAuthHeader() });
    return response.data;
  },

  removeFromCart: async (itemId) => {
    const response = await axios.delete(`${API_URL}/cart/remove_item/`, {
      data: { product_id: itemId }, // Pass ID in body for some backends, or modify URL if needed
      headers: getAuthHeader()
    });
    return response.data;
  },

  updateQuantity: async (itemId, quantity) => {
    const response = await axios.patch(`${API_URL}/cart/update_quantity/`, {
      product_id: itemId,
      quantity: quantity
    }, { headers: getAuthHeader() });
    return response.data;
  },

  clearCart: async () => {
    const response = await axios.post(`${API_URL}/cart/clear/`, {}, {
      headers: getAuthHeader()
    });
    return response.data;
  }
};