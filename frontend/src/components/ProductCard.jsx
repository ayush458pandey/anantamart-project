import React from 'react';
import { Package, Plus, Minus, GitCompare } from 'lucide-react';
import { useComparison } from '../context/ComparisonContext';

export default function ProductCard({ product, cart, onAddToCart, removeFromCart, onViewDetails, onNavigateToCategory }) {
    // 1. Check if this specific product is already in the global cart
    const cartItem = cart?.items?.find(item => item.product.id === product.id);

    // 2. If in cart, use that quantity. If not, default to MOQ.
    const quantity = cartItem ? cartItem.quantity : (product.moq || 1);

    const { addToCompare, removeFromCompare, compareList } = useComparison();
    const isInCompareList = compareList.some(p => p.id === product.id);

    const handleCompareToggle = () => {
        if (isInCompareList) {
            removeFromCompare(product.id);
        } else {
            addToCompare(product);
        }
    };

    // Add to cart (Initial Add)
    const handleAdd = () => {
        onAddToCart(product.id, product.moq || 1);
    };

    // Increase Quantity
    const handleIncrement = () => {
        const step = product.moq || 1;
        const newQty = quantity + step;
        onAddToCart(product.id, newQty);
    };

    // Decrease Quantity
    const handleDecrement = () => {
        const step = product.moq || 1;

        // If decreasing would go below MOQ, we remove the item
        if (quantity <= step) {
            if (cartItem && removeFromCart) {
                removeFromCart(cartItem.id); // Remove using the Cart Item ID
            }
        } else {
            // Otherwise, just lower the quantity
            onAddToCart(product.id, quantity - step);
        }
    };

    const discountPercent = product.mrp ? Math.round(((product.mrp - product.base_price) / product.mrp) * 100) : 0;

    return (
        <div className="w-full bg-white rounded-lg sm:rounded-xl shadow-sm hover:shadow-md active:shadow-sm transition-all overflow-hidden touch-manipulation">
            <div
                className="relative bg-gradient-to-br from-gray-50 to-gray-100 cursor-pointer"
                style={{ aspectRatio: '4 / 3' }}
                onClick={onViewDetails}
            >
                <div className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2 z-10">
                    <span className={`text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full ${product.stock_status === 'in-stock'
                        ? 'bg-green-600 text-white'
                        : 'bg-orange-500 text-white'
                        }`}>
                        {product.stock_status === 'in-stock' ? 'In Stock' : 'Out of Stock'}
                    </span>
                </div>

                {product.image ? (
                    <img
                        src={product.image}
                        alt={product.name}
                        className="absolute inset-0 w-full h-full object-contain p-2 sm:p-4"
                        loading="lazy"
                    />
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Package className="w-8 h-8 sm:w-12 sm:h-12 text-gray-300" />
                    </div>
                )}

                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        handleCompareToggle();
                    }}
                    className={`absolute bottom-1.5 left-1.5 sm:bottom-2 sm:left-2 p-1.5 sm:p-2 rounded-full shadow-md hover:bg-gray-50 active:scale-95 transition-all z-10 touch-manipulation min-w-[36px] min-h-[36px] flex items-center justify-center ${isInCompareList
                        ? 'bg-emerald-100 border-2 border-emerald-600'
                        : 'bg-white'
                        }`}
                >
                    <GitCompare className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isInCompareList ? 'text-emerald-600' : 'text-gray-600'}`} />
                </button>

                <div className="absolute bottom-1.5 right-1.5 sm:bottom-2 sm:right-2 z-10">
                    {!cartItem ? (
                        /* STATE 1: NOT IN CART - Show ADD Button */
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleAdd();
                            }}
                            className="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold px-3 sm:px-5 py-1.5 sm:py-2 rounded-lg shadow-lg active:scale-95 transition-all text-xs sm:text-sm touch-manipulation"
                        >
                            + ADD
                        </button>
                    ) : (
                        /* STATE 2: IN CART - Show Counter */
                        <div className="flex items-center bg-white rounded-lg shadow-lg border-2 border-emerald-600">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleDecrement();
                                }}
                                className="p-1.5 sm:p-2 hover:bg-gray-50 active:bg-gray-100 transition-colors touch-manipulation min-w-[36px] min-h-[36px] flex items-center justify-center"
                            >
                                <Minus className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600" />
                            </button>
                            <span className="px-2 sm:px-3 font-bold text-emerald-600 min-w-[32px] sm:min-w-[36px] text-center text-xs sm:text-sm">
                                {quantity}
                            </span>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleIncrement();
                                }}
                                className="p-1.5 sm:p-2 hover:bg-gray-50 active:bg-gray-100 transition-colors touch-manipulation min-w-[36px] min-h-[36px] flex items-center justify-center"
                            >
                                <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600" />
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div className="p-2 sm:p-3">
                <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
                    <div className="bg-emerald-600 text-white px-2 sm:px-2.5 py-0.5 sm:py-1 rounded">
                        <span className="text-xs sm:text-sm font-bold">₹{Math.round(product.base_price)}</span>
                    </div>
                    {product.mrp && (
                        <span className="text-gray-400 line-through text-[10px] sm:text-xs">
                            ₹{Math.round(product.mrp)}
                        </span>
                    )}
                </div>

                {discountPercent > 0 && (
                    <div className="text-[10px] sm:text-[11px] text-gray-600 mb-1.5 sm:mb-2 font-semibold">
                        {discountPercent}% OFF
                    </div>
                )}

                <h3
                    onClick={onViewDetails}
                    className="text-xs sm:text-sm font-semibold text-gray-900 line-clamp-2 min-h-[32px] sm:min-h-[36px] mb-1 cursor-pointer hover:text-emerald-600 active:text-emerald-700 transition-colors"
                >
                    {product.name}
                </h3>

                <p className="text-[10px] sm:text-[11px] text-gray-500 mb-0.5 sm:mb-1">
                    SKU: <span className="font-medium text-gray-700">{product.sku}</span>
                </p>

                {/* Color Options */}
                {product.available_colors_list && product.available_colors_list.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-1 items-center">
                        {product.available_colors_list.slice(0, 5).map((color, idx) => {
                            const isHex = color.startsWith('#');
                            const commonColors = ['red', 'blue', 'green', 'black', 'white', 'yellow', 'orange', 'purple', 'pink', 'gray', 'brown', 'teal', 'indigo', 'cyan', 'lime', 'maroon', 'navy', 'olive', 'silver', 'gold', 'beige'];
                            const isCommonColor = commonColors.includes(color.toLowerCase());
                            const isColor = isHex || isCommonColor;

                            if (isColor) {
                                return (
                                    <span
                                        key={idx}
                                        className="w-3 h-3 rounded-full border border-gray-200 shadow-sm block"
                                        style={{ backgroundColor: color }}
                                        title={color}
                                    />
                                );
                            } else {
                                return (
                                    <span key={idx} className="px-1 py-0.5 bg-gray-100 border border-gray-200 rounded text-[9px] font-mono font-bold text-gray-600 leading-none">
                                        {color}
                                    </span>
                                );
                            }
                        })}
                        {product.available_colors_list.length > 5 && (
                            <span className="text-[10px] text-gray-400">+{product.available_colors_list.length - 5}</span>
                        )}
                    </div>
                )}

                {/* Show category/subcategory so users know where the product is - CLICKABLE */}
                {(product.category_name || product.subcategory_name) && (
                    <p
                        onClick={(e) => {
                            e.stopPropagation();
                            if (product.category && onNavigateToCategory) {
                                onNavigateToCategory(product.category, product.subcategory);
                            }
                        }}
                        className="text-[10px] sm:text-[11px] text-emerald-600 mb-0.5 sm:mb-1 truncate cursor-pointer hover:underline hover:text-emerald-700"
                    >
                        📍 {product.category_name}{product.subcategory_name ? ` › ${product.subcategory_name}` : ''}
                    </p>
                )}

                <p className="text-[10px] sm:text-[11px] text-gray-600 mb-0.5 sm:mb-1">
                    1 pack ({product.moq} {product.unit || 'ml'})
                </p>

                <p className="text-[10px] sm:text-[11px] text-gray-600">
                    <span className="font-semibold text-emerald-600">MOQ: {product.moq}</span>
                    {' • '}
                    <span>Case: {product.case_size}</span>
                </p>
            </div>
        </div>
    );
}
