import axiosInstance from '../axios';

export const orderService = {
  // 🟢 FIX: Changed '/orders/create/' back to '/orders/'
  // This is the standard Django REST Framework endpoint for creating items.
  // Supports idempotency via Idempotency-Key header to prevent duplicate orders.
  createOrder: async (orderData, idempotencyKey = null) => {
    try {
      const config = {};
      if (idempotencyKey) {
        config.headers = { 'Idempotency-Key': idempotencyKey };
      }
      const response = await axiosInstance.post('/orders/', orderData, config);
      return response.data;
    } catch (error) {
      // Log the full backend error to help debug if it fails again
      console.error("Create Order Error:", error.response?.data || error.message);
      throw error;
    }
  },

  // Validate stock before payment
  validateStock: async (items) => {
    const response = await axiosInstance.post('/orders/validate-stock/', { items });
    return response.data;
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
