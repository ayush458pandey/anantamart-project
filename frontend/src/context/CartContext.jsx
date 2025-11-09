import { createContext, useState, useContext, useEffect } from 'react';
import { cartService } from '../api/services/cartService';

const CartContext = createContext();

export const CartProvider = ({ children }) => {
  const [cart, setCart] = useState({ items: [], total_items: 0, total_price: 0 });
  const [loading, setLoading] = useState(false);

  // Fetch cart on mount
  useEffect(() => {
    fetchCart();
  }, []);

  const fetchCart = async () => {
    try {
      setLoading(true);
      const data = await cartService.getCart();
      setCart(data || { items: [], total_items: 0, total_price: 0 });
    } catch (error) {
      console.error('Error fetching cart:', error);
      // Set empty cart if error
      setCart({ items: [], total_items: 0, total_price: 0 });
    } finally {
      setLoading(false);
    }
  };

  const addToCart = async (productId, quantity = 1) => {
    try {
      const data = await cartService.addToCart(productId, quantity);
      setCart(data || { items: [], total_items: 0, total_price: 0 });
      return data;
    } catch (error) {
      console.error('Error adding to cart:', error);
      throw error;
    }
  };

  const removeFromCart = async (productId) => {
    try {
      const data = await cartService.removeFromCart(productId);
      setCart(data || { items: [], total_items: 0, total_price: 0 });
      return data;
    } catch (error) {
      console.error('Error removing from cart:', error);
      throw error;
    }
  };

  const updateQuantity = async (productId, quantity) => {
    try {
      const data = await cartService.updateQuantity(productId, quantity);
      setCart(data || { items: [], total_items: 0, total_price: 0 });
      return data;
    } catch (error) {
      console.error('Error updating quantity:', error);
      throw error;
    }
  };

  const clearCart = async () => {
    try {
      const data = await cartService.clearCart();
      setCart(data || { items: [], total_items: 0, total_price: 0 });
      return data;
    } catch (error) {
      console.error('Error clearing cart:', error);
      throw error;
    }
  };

  return (
    <CartContext.Provider
      value={{
        cart,
        loading,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        fetchCart
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within CartProvider');
  }
  return context;
};
