import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import EstimateView from '../components/EstimateView';
import AdvancedCheckout from '../components/AdvancedCheckout';

export default function CartPage() {
    const { user } = useAuth();
    const { cart, removeFromCart, updateQuantity } = useCart();
    const [showCheckout, setShowCheckout] = React.useState(false);

    const estimateSubtotal = cart?.items?.reduce((sum, item) =>
        sum + parseFloat(item.total_price), 0) || 0;

    const totalTaxAmount = cart?.items?.reduce((total, item) => {
        const itemTotal = parseFloat(item.total_price);
        const itemRate = parseFloat(item.product.gst_rate || 18);
        return total + (itemTotal * (itemRate / 100));
    }, 0) || 0;

    const cgst = totalTaxAmount / 2;
    const sgst = totalTaxAmount / 2;
    const estimateTotal = estimateSubtotal + totalTaxAmount;

    return (
        <>
            <EstimateView
                cart={cart}
                removeFromCart={removeFromCart}
                updateQuantity={updateQuantity}
                subtotal={estimateSubtotal}
                cgst={cgst}
                sgst={sgst}
                total={estimateTotal}
                onCheckout={() => {
                    if (user) {
                        setShowCheckout(true);
                    } else {
                        // Will be handled by Navigate
                        window.location.href = '/login';
                    }
                }}
            />

            {showCheckout && (
                <AdvancedCheckout
                    cart={cart}
                    onClose={() => setShowCheckout(false)}
                    onPlaceOrder={(orderData) => {
                        console.log('Order placed:', orderData);
                        setShowCheckout(false);
                    }}
                />
            )}
        </>
    );
}
