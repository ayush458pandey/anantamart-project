import axiosInstance from '../axios';

export const addressService = {
    // Get all addresses
    getAddresses: async () => {
        // axiosInstance already knows the base URL and adds the token automatically
        const response = await axiosInstance.get('/user/addresses/');
        return response.data;
    },

    // Add a new address
    addAddress: async (addressData) => {
        const response = await axiosInstance.post('/user/addresses/', addressData);
        return response.data;
    },

    // Optional: Delete address (useful for future)
    deleteAddress: async (id) => {
        await axiosInstance.delete(`/user/addresses/${id}/`);
        return id;
    },

    // Optional: Update address
    updateAddress: async (id, addressData) => {
        const response = await axiosInstance.put(`/user/addresses/${id}/`, addressData);
        return response.data;
    }
};