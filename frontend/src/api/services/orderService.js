import axiosInstance from '../axios';

export const orderService = {
  // Create new order (Matches AdvancedCheckout.jsx)
  createOrder: async (orderData) => {
    // ⚠️ IMPORTANT: If your backend url is just '/orders/', change this line. 
    // But usually it is '/orders/create/' for explicit creation endpoints.
    const response = await axiosInstance.post('/orders/create/', orderData);
    return response.data;
  },

  // Get order history (Matches "My Orders" page)
  getAllOrders: async () => {
    const response = await axiosInstance.get('/orders/history/'); // or '/orders/' depending on urls.py
    return response.data;
  },

  // Get single order
  getOrderById: async (id) => {
    const response = await axiosInstance.get(`/orders/${id}/`);
    return response.data;
  }
};