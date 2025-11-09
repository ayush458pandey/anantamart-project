import axiosInstance from '../axios';

export const orderService = {
  // Get all orders
  getAllOrders: async () => {
    const response = await axiosInstance.get('/orders/');
    return response.data;
  },
  
  // Get single order
  getOrderById: async (id) => {
    const response = await axiosInstance.get(`/orders/${id}/`);
    return response.data;
  },
  
  // Create new order
  createOrder: async (orderData) => {
    const response = await axiosInstance.post('/orders/', orderData);
    return response.data;
  },
  
  // Update order status
  updateOrderStatus: async (orderId, status) => {
    const response = await axiosInstance.post(`/orders/${orderId}/update_status/`, {
      status
    });
    return response.data;
  }
};
