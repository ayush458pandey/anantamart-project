const BASE_URL = 'https://api.ananta-mart.in/api/user/addresses/';
// const BASE_URL = 'http://127.0.0.1:8000/api/user/addresses/';

const getHeaders = () => {
    const token = localStorage.getItem('access_token');
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
};

export const addressService = {
    // Get all addresses for the logged-in user
    getAddresses: async () => {
        const response = await fetch(BASE_URL, {
            method: 'GET',
            headers: getHeaders(),
        });
        if (!response.ok) throw new Error('Failed to fetch addresses');
        return await response.json();
    },

    // Add a new address
    addAddress: async (addressData) => {
        const response = await fetch(BASE_URL, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(addressData)
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(JSON.stringify(errorData));
        }
        return await response.json();
    }
};