import axiosInstance from '../axios';

export const cartService = {
  // Get cart
  getCart: async () => {
    const response = await axiosInstance.get('/cart/my_cart/');
    return response.data;
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
