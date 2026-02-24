import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import EstimateView from '../components/EstimateView';
import AdvancedCheckout from '../components/AdvancedCheckout';
import { getTaxFromInclusive } from '../utils/priceUtils';

export default function CartPage() {
    const { user } = useAuth();
    const { cart, removeFromCart, updateQuantity } = useCart();
    const [showCheckout, setShowCheckout] = React.useState(false);

    // base_price is already tax-inclusive, so subtotal = sum of base_price * qty
    const estimateSubtotal = cart?.items?.reduce((sum, item) =>
        sum + (parseFloat(item.product.base_price) * item.quantity), 0) || 0;

    // Back-calculate tax from inclusive prices (for display breakdown only)
    const totalTaxAmount = cart?.items?.reduce((total, item) => {
        const itemTotal = parseFloat(item.product.base_price) * item.quantity;
        return total + getTaxFromInclusive(itemTotal, item.product.gst_rate);
    }, 0) || 0;

    const cgst = totalTaxAmount / 2;
    const sgst = totalTaxAmount / 2;
    // Total = subtotal (tax already included, not added again)
    const estimateTotal = estimateSubtotal;

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
