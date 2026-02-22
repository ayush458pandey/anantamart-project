import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import EstimateView from '../components/EstimateView';
import AdvancedCheckout from '../components/AdvancedCheckout';
import { getInclusivePriceExact, getTaxFromInclusive } from '../utils/priceUtils';

export default function CartPage() {
    const { user } = useAuth();
    const { cart, removeFromCart, updateQuantity } = useCart();
    const [showCheckout, setShowCheckout] = React.useState(false);

    // Subtotal is now INCLUSIVE of GST
    const estimateSubtotal = cart?.items?.reduce((sum, item) => {
        const inclusiveUnitPrice = getInclusivePriceExact(item.product.base_price, item.product.gst_rate);
        return sum + (inclusiveUnitPrice * item.quantity);
    }, 0) || 0;

    // Tax is back-calculated from inclusive prices (for display only)
    const totalTaxAmount = cart?.items?.reduce((total, item) => {
        const inclusiveUnitPrice = getInclusivePriceExact(item.product.base_price, item.product.gst_rate);
        const itemTotal = inclusiveUnitPrice * item.quantity;
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
