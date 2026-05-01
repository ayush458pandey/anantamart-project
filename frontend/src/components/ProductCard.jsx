import React, { useState, useRef } from 'react';
import { Package, Plus, Minus, GitCompare } from 'lucide-react';
import { useComparison } from '../context/ComparisonContext';
import { formatCaseSize } from '../utils/formatters';

export default function ProductCard({ product, cart, onAddToCart, removeFromCart, updateQuantity, onViewDetails, onNavigateToCategory }) {
    const [mode, setMode] = useState('pcs'); // 'pcs' or 'case'
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState('');
    const inputRef = useRef(null);

    // Check if this product is in the cart
    const cartItem = cart?.items?.find(item => item.product.id === product.id);
    const quantity = cartItem ? cartItem.quantity : (product.moq || 1);

    const moq = product.moq || 1;
    const caseSize = product.case_size || 1;
    const step = mode === 'case' ? caseSize : moq;

    const { addToCompare, removeFromCompare, compareList } = useComparison();
    const isInCompareList = compareList.some(p => p.id === product.id);

    const handleCompareToggle = () => {
        if (isInCompareList) {
            removeFromCompare(product.id);
        } else {
            addToCompare(product);
        }
    };

    // Round to nearest valid MOQ multiple (must be >= moq)
    const roundToMoq = (val) => {
        const num = parseInt(val, 10);
        if (isNaN(num) || num < moq) return moq;
        return Math.round(num / moq) * moq;
    };

    // Add to cart (Initial Add) — uses addToCart (POST, creates item)
    const handleAdd = () => {
        onAddToCart(product.id, step);
    };

    // Increase — uses updateQuantity (PUT, sets exact qty)
    const handleIncrement = () => {
        if (cartItem && updateQuantity) {
            updateQuantity(cartItem.id, quantity + step);
        }
    };

    // Decrease — uses updateQuantity (PUT, sets exact qty)
    const handleDecrement = () => {
        if (quantity <= step) {
            if (cartItem && removeFromCart) {
                removeFromCart(cartItem.id);
            }
        } else if (cartItem && updateQuantity) {
            updateQuantity(cartItem.id, quantity - step);
        }
    };

    // Editable quantity: tap the number to type
    const startEditing = (e) => {
        e.stopPropagation();
        setEditValue(String(quantity));
        setIsEditing(true);
        setTimeout(() => inputRef.current?.select(), 50);
    };

    const commitEdit = () => {
        const rounded = roundToMoq(editValue);
        if (cartItem && updateQuantity) {
            updateQuantity(cartItem.id, rounded);
        } else {
            onAddToCart(product.id, rounded);
        }
        setIsEditing(false);
    };

    const handleEditKeyDown = (e) => {
        if (e.key === 'Enter') commitEdit();
        if (e.key === 'Escape') setIsEditing(false);
    };

    // Display helpers
    const displayQty = mode === 'case'
        ? `${Math.floor(quantity / caseSize)} cs`
        : quantity;
    const unitLabel = product.unit || 'pcs';

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

                            {isEditing ? (
                                <input
                                    ref={inputRef}
                                    type="number"
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onBlur={commitEdit}
                                    onKeyDown={handleEditKeyDown}
                                    onClick={(e) => e.stopPropagation()}
                                    className="w-14 sm:w-16 text-center font-bold text-emerald-600 text-xs sm:text-sm border-0 outline-none bg-emerald-50 rounded py-0.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    autoFocus
                                />
                            ) : (
                                <span
                                    onClick={startEditing}
                                    className="px-2 sm:px-3 font-bold text-emerald-600 min-w-[32px] sm:min-w-[36px] text-center text-xs sm:text-sm cursor-text hover:bg-emerald-50 rounded py-0.5 transition-colors"
                                    title="Tap to type quantity"
                                >
                                    {displayQty}
                                </span>
                            )}

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

                {/* Show category/subcategory - CLICKABLE */}
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

                {/* MOQ + Case info */}
                <p className="text-[10px] sm:text-[11px] text-gray-600 mb-1">
                    <span className="font-semibold text-emerald-600">MOQ: {moq === 1 ? unitLabel : `${moq} ${unitLabel}`}</span>
                    {' • '}
                    <span>Case: {formatCaseSize(caseSize, unitLabel)}</span>
                </p>

                {/* Pcs / Case Toggle */}
                {caseSize > moq && (
                    <div className="flex rounded-md overflow-hidden border border-gray-200 text-[10px] sm:text-[11px] font-semibold">
                        <button
                            onClick={(e) => { e.stopPropagation(); setMode('pcs'); }}
                            className={`flex-1 py-1 px-2 transition-colors ${mode === 'pcs'
                                ? 'bg-emerald-600 text-white'
                                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                                }`}
                        >
                            {unitLabel}
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); setMode('case'); }}
                            className={`flex-1 py-1 px-2 transition-colors ${mode === 'case'
                                ? 'bg-emerald-600 text-white'
                                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                                }`}
                        >
                            Case
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
