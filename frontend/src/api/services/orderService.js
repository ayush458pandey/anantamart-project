import axiosInstance from '../axios';

export const orderService = {
  // 🟢 FIX: Changed '/orders/create/' back to '/orders/'
  // This is the standard Django REST Framework endpoint for creating items.
  createOrder: async (orderData) => {
    try {
      const response = await axiosInstance.post('/orders/', orderData);
      return response.data;
    } catch (error) {
      // Log the full backend error to help debug if it fails again
      console.error("Create Order Error:", error.response?.data || error.message);
      throw error;
    }
  },

  // Get order history
  getAllOrders: async () => {
    const response = await axiosInstance.get('/orders/');
    return response.data;
  },

  // Get single order
  getOrderById: async (id) => {
    const response = await axiosInstance.get(`/orders/${id}/`);
    return response.data;
  },

  createPaymentOrder: async (amount) => {
    const response = await axiosInstance.post('/orders/payment/create/', { amount });
    return response.data;
  },

  verifyRazorpayPayment: async (paymentDetails) => {
    const response = await axiosInstance.post('/orders/payment/verify/', paymentDetails);
    return response.data;
  }
};
