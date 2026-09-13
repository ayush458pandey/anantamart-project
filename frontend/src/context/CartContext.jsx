import { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { cartService } from '../api/services/cartService';

// Create the Context
const CartContext = createContext();

export const CartProvider = ({ children }) => {
  // Initialize state
  const [cart, setCart] = useState({ items: [], total_items: 0, total_price: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const location = useLocation();

  // --- Actions ---

  const fetchCart = useCallback(async () => {
    if (!localStorage.getItem('access_token')) {
      setCart({ items: [], total_items: 0, total_price: 0 });
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await cartService.getCart();
      setCart(data || { items: [], total_items: 0, total_price: 0 });
    } catch {
      // Don't set global error for 404s (empty cart), just reset state
      setCart({ items: [], total_items: 0, total_price: 0 });
    } finally {
      setLoading(false);
    }
  }, []);

  // Refetch cart when navigating between pages for signed-in users only.
  useEffect(() => {
    if (localStorage.getItem('access_token')) {
      fetchCart();
    } else {
      setCart({ items: [], total_items: 0, total_price: 0 });
    }
  }, [fetchCart, location.pathname]);

  const addToCart = async (productId, quantity = 1, variant = null) => {
    try {
      setLoading(true);
      const data = await cartService.addToCart(productId, quantity, variant);
      setCart(data);
      return { success: true, data };
    } catch (err) {
      setError('Failed to add item to cart');
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  const removeFromCart = async (productId) => {
    try {
      setLoading(true);
      const data = await cartService.removeFromCart(productId);
      setCart(data);
    } catch {
      setError('Failed to remove item');
    } finally {
      setLoading(false);
    }
  };

  const updateQuantity = async (itemId, quantity) => {
    try {
      setLoading(true);
      const data = await cartService.updateCartItem(itemId, quantity);
      setCart(data);
    } catch {
      setError('Failed to update quantity');
    } finally {
      setLoading(false);
    }
  };

  const clearCart = async () => {
    try {
      setLoading(true);
      const data = await cartService.clearCart();
      setCart(data);
    } catch {
      setError('Failed to clear cart');
    } finally {
      setLoading(false);
    }
  };

  // The value object passed to consumers
  const value = {
    cart,
    loading,
    error,
    fetchCart,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
};

// --- Custom Hook (Exported) ---
export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
