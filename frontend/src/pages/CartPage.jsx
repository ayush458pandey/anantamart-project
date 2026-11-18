import React, { lazy, Suspense } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { useCart } from '../context/useCart';
import { getTaxFromInclusive } from '../utils/priceUtils';
import { cartLineTotal, cartSubtotal } from '../utils/cartPricing';

// Lazy-load heavy components (PDF libs) so they don't bloat the initial bundle
const EstimateView = lazy(() => import('../components/EstimateView'));
const AdvancedCheckout = lazy(() => import('../components/AdvancedCheckout'));

export default function CartPage() {
    const { user } = useAuth();
    const { cart, removeFromCart, updateQuantity } = useCart();
    const [showCheckout, setShowCheckout] = React.useState(false);

    // Prices are tax-inclusive. Use the per-line price so a variant is charged
    // its own amount rather than the parent product's price.
    const estimateSubtotal = cartSubtotal(cart);

    // Back-calculate tax from inclusive prices (for display breakdown only)
    const totalTaxAmount = cart?.items?.reduce((total, item) => {
        return total + getTaxFromInclusive(cartLineTotal(item), item.product.gst_rate);
    }, 0) || 0;

    const cgst = totalTaxAmount / 2;
    const sgst = totalTaxAmount / 2;
    // Total = subtotal (tax already included, not added again)
    const estimateTotal = estimateSubtotal;

    return (
        <>
            <Suspense fallback={
                <div className="min-h-[45vh] flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
                </div>
            }>
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
            </Suspense>
        </>
    );
}
