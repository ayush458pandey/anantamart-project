import { useState, useMemo, useEffect } from 'react';
import { X, ArrowLeft, Plus, Minus, ShoppingCart, Package, Truck, Shield } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { formatCaseSize } from '../utils/formatters';

// Smart price formatter: shows decimals only when needed (e.g., 100, 99.25, 0.50)
const formatPrice = (price) => {
  const num = parseFloat(price);
  if (isNaN(num)) return '0';
  return num % 1 === 0 ? num.toString() : num.toFixed(2);
};

export default function ProductDetail({ product, onClose, onAddToCart, onBrandClick, embedded = false }) {
  const { fetchCart } = useCart();
  const toast = useToast();
  const [quantity, setQuantity] = useState(product.moq || 1);
  const [selectedImage, setSelectedImage] = useState(0);

  // --- STRUCTURED VARIANTS (size / colour / etc.) ---
  // Group the product's variants by variant_type so each dimension renders as
  // its own row of selectable options.
  const variantGroups = useMemo(() => {
    const groups = new Map();
    (product.variants || []).forEach((v) => {
      const type = v.variant_type || 'Option';
      if (!groups.has(type)) groups.set(type, []);
      groups.get(type).push(v);
    });
    return Array.from(groups, ([type, options]) => ({ type, options }));
  }, [product.variants]);

  const hasVariantOptions = variantGroups.length > 0;

  // Legacy colour options — only used when a product has no structured variants.
  const hasColors =
    !hasVariantOptions &&
    product.available_colors_list &&
    product.available_colors_list.length > 0;

  // Selection state: variantType -> chosen variant object. Defaults to the first
  // option of every group.
  const [selectedVariants, setSelectedVariants] = useState(() => {
    const initial = {};
    (product.variants || []).forEach((v) => {
      const type = v.variant_type || 'Option';
      if (!(type in initial)) initial[type] = v;
    });
    return initial;
  });

  const selectedVariantList = useMemo(
    () => variantGroups.map((g) => selectedVariants[g.type]).filter(Boolean),
    [variantGroups, selectedVariants]
  );

  // The variant that drives price / MOQ / case size / stock. Prefer one with an
  // explicit price override, otherwise fall back to the first selected option.
  const pricingVariant = useMemo(() => {
    if (selectedVariantList.length === 0) return null;
    return selectedVariantList.find((v) => v.base_price != null) || selectedVariantList[0];
  }, [selectedVariantList]);

  const effectivePrice = pricingVariant
    ? parseFloat(pricingVariant.effective_base_price)
    : parseFloat(product.base_price);
  const effectiveMrp = pricingVariant
    ? (pricingVariant.effective_mrp != null ? parseFloat(pricingVariant.effective_mrp) : null)
    : (product.mrp != null ? parseFloat(product.mrp) : null);
  const effectiveMoq = (pricingVariant ? pricingVariant.effective_moq : product.moq) || 1;
  const effectiveCaseSize =
    (pricingVariant ? pricingVariant.effective_case_size : product.case_size) || 1;
  const effectiveStock =
    pricingVariant && pricingVariant.stock != null ? pricingVariant.stock : product.stock;

  const selectVariant = (type, option) => {
    setSelectedVariants((prev) => ({ ...prev, [type]: option }));
  };

  // Keep the quantity valid for the currently selected variant's MOQ.
  useEffect(() => {
    setQuantity(effectiveMoq);
  }, [effectiveMoq]);

  // --- STATE FOR LEGACY COLOR QUANTITIES ---
  // Map of color -> quantity, e.g. { "Red": 2, "Blue": 1 }
  const [colorQuantities, setColorQuantities] = useState({});
  const [searchTerm, setSearchTerm] = useState('');

  // Images: product gallery first, then any variant-specific images.
  const images = useMemo(() => {
    const base = product.images?.length > 0
      ? product.images.map((img) => img.image_url || img.image)
      : product.image
        ? [product.image]
        : [];
    const variantImgs = (product.variants || []).map((v) => v.image_url).filter(Boolean);
    return [...base, ...variantImgs.filter((url) => !base.includes(url))];
  }, [product.images, product.image, product.variants]);

  // Jump the gallery to the selected variant's image when it changes.
  useEffect(() => {
    if (pricingVariant?.image_url) {
      const idx = images.indexOf(pricingVariant.image_url);
      if (idx >= 0) setSelectedImage(idx);
    }
  }, [pricingVariant, images]);

  // Calculate total quantity from map or single state
  const totalQuantity = hasColors
    ? Object.values(colorQuantities).reduce((sum, q) => sum + q, 0)
    : quantity;

  const currentTotalPrice = effectivePrice * (totalQuantity || 0);

  // Helper to update color quantity
  const updateColorQty = (color, delta) => {
    setColorQuantities(prev => {
      const current = prev[color] || 0;
      const newQty = Math.max(0, current + delta);
      if (newQty === 0) {
        const next = { ...prev };
        delete next[color];
        return next;
      }
      return { ...prev, [color]: newQty };
    });
  };

  // --- HANDLE ADD TO CART ---
  const handleAddToCart = async () => {
    // Validation
    if (totalQuantity === 0) {
      toast.error("Please select at least 1 item");
      return;
    }

    // Verify MOQ
    if (totalQuantity < effectiveMoq) {
      toast.error(`Minimum order quantity is ${effectiveMoq}`);
      return;
    }

    try {
      // Use cartService to handle auth/cookies correctly
      const { cartService } = await import('../api/services/cartService');

      const itemsToAdd = [];

      if (hasColors) {
        // Legacy colour options: one cart line per selected colour.
        Object.entries(colorQuantities).forEach(([color, qty]) => {
          if (qty > 0) {
            itemsToAdd.push({ product_id: product.id, quantity: qty, variant: color });
          }
        });
      } else if (hasVariantOptions) {
        // Combine every selected dimension into one label, e.g.
        // 'Size: 10", Colour: Red', and pin the pricing variant for stock/price.
        const variantLabel = selectedVariantList
          .map((v) => `${v.variant_type}: ${v.name}`)
          .join(', ');
        itemsToAdd.push({
          product_id: product.id,
          quantity: quantity,
          variant: variantLabel,
          variantId: pricingVariant?.id,
        });
      } else {
        // Standard single item
        itemsToAdd.push({ product_id: product.id, quantity: quantity, variant: '' });
      }

      // Send requests in parallel using cartService
      const promises = itemsToAdd.map(item =>
        cartService.addToCart(item.product_id, item.quantity, item.variant, item.variantId)
      );

      await Promise.all(promises);

      // Refresh the global cart state so UI updates
      await fetchCart();

      // Show toast and close modal
      toast.cart(`Added ${totalQuantity} item${totalQuantity > 1 ? 's' : ''} to cart`);
      if (onAddToCart) onAddToCart();
      // On a dedicated page, stay put; only close when shown as a modal
      if (onClose && !embedded) onClose();

    } catch (error) {
      console.error("Add to cart error:", error);
      const msg = error.response?.data?.error || error.message || "Could not add to cart.";
      toast.error(msg);
    }
  };

  const wrapperClass = embedded
    ? 'w-full'
    : 'fixed inset-0 bg-black bg-opacity-50 z-50 overflow-y-auto';
  const innerClass = embedded
    ? ''
    : 'min-h-screen p-4';
  const cardClass = embedded
    ? 'max-w-6xl mx-auto'
    : 'bg-white rounded-xl max-w-6xl mx-auto my-8';

  return (
    <div className={wrapperClass}>
      <div className={innerClass}>
        <div className={cardClass}>
          {/* Header */}
          {embedded ? (
            <button
              onClick={onClose}
              className="flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-emerald-600 transition-colors mb-3"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to catalog
            </button>
          ) : (
            <div className="sticky top-0 bg-white border-b border-gray-100 px-4 sm:px-6 py-3.5 flex items-center justify-between z-20 rounded-t-xl">
              <h2 className="text-lg font-bold text-gray-900">Product Details</h2>
              <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
          )}

          <div className={embedded ? '' : 'px-4 sm:px-6 py-5 sm:py-6'}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6 lg:gap-8">
              {/* LEFT: Image Gallery (sticky on desktop) */}
              <div className="lg:sticky lg:top-24 lg:self-start">
                <div className="flex flex-col-reverse sm:flex-row gap-3">
                  {/* Thumbnail rail */}
                  {images.length > 1 && (
                    <div className="flex sm:flex-col gap-2 overflow-x-auto sm:overflow-x-visible sm:max-h-[520px] sm:overflow-y-auto flex-shrink-0">
                      {images.map((img, idx) => (
                        <button
                          key={idx}
                          onClick={() => setSelectedImage(idx)}
                          className={`flex-shrink-0 w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden border-2 bg-white transition-all ${
                            selectedImage === idx
                              ? 'border-emerald-600'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <img src={img} alt="" className="w-full h-full object-contain p-1" />
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Main image */}
                  <div className="flex-1 bg-white border border-gray-100 rounded-2xl aspect-square flex items-center justify-center overflow-hidden">
                    {images.length > 0 ? (
                      <img
                        src={images[selectedImage]}
                        alt={product.name}
                        className="w-full h-full object-contain p-4 sm:p-6"
                      />
                    ) : (
                      <Package className="w-24 h-24 text-gray-300" />
                    )}
                  </div>
                </div>
              </div>

              {/* RIGHT: Info Cards */}
              <div className="space-y-4">
                {/* Card 1 — Product summary */}
                <div className="bg-white border border-gray-200 rounded-2xl p-5">
                  {product.brand_name && (
                    <button
                      onClick={() => onBrandClick && onBrandClick(product.brand_name, product.brand_ref || product.brand)}
                      className="text-sm font-semibold text-emerald-700 hover:underline"
                    >
                      {product.brand_name}
                    </button>
                  )}
                  <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mt-1 leading-snug">
                    {product.name}
                  </h1>
                  <p className="text-sm text-gray-500 mt-1.5">
                    {product.unit ? `Net quantity - ${product.unit}` : 'Inclusive of all taxes'}
                  </p>

                  {/* Price */}
                  <div className="flex items-center gap-3 flex-wrap mt-4">
                    <span className="bg-emerald-600 text-white text-xl font-bold px-3 py-1 rounded-lg">
                      ₹{formatPrice(effectivePrice)}
                    </span>
                    {effectiveMrp > effectivePrice && (
                      <>
                        <span className="text-gray-400 line-through text-sm">
                          MRP ₹{formatPrice(effectiveMrp)}
                        </span>
                        <span className="text-emerald-600 text-sm font-semibold">
                          ₹{formatPrice(effectiveMrp - effectivePrice)} OFF
                        </span>
                      </>
                    )}
                  </div>

                  {/* Benefit badges */}
                  <div className="grid grid-cols-3 gap-3 mt-5 pt-5 border-t border-gray-100">
                    <div className="flex flex-col items-center text-center gap-1.5">
                      <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center">
                        <Truck className="w-5 h-5 text-emerald-600" />
                      </div>
                      <span className="text-[11px] text-gray-600 leading-tight">Fast Delivery</span>
                    </div>
                    <div className="flex flex-col items-center text-center gap-1.5">
                      <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center">
                        <Shield className="w-5 h-5 text-emerald-600" />
                      </div>
                      <span className="text-[11px] text-gray-600 leading-tight">Quality Assured</span>
                    </div>
                    <div className="flex flex-col items-center text-center gap-1.5">
                      <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center">
                        <Package className="w-5 h-5 text-emerald-600" />
                      </div>
                      <span className="text-[11px] text-gray-600 leading-tight">Secure Packaging</span>
                    </div>
                  </div>
                </div>

                {/* Card 2 — Order / quantity */}
                <div className="bg-white border border-gray-200 rounded-2xl p-5">
                  {/* Structured variants (size / colour / etc.) */}
                  {hasVariantOptions && (
                    <div className="space-y-4 mb-4">
                      {variantGroups.map((group) => (
                        <div key={group.type}>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-semibold text-gray-900">
                              {group.type}
                            </span>
                            <span className="text-xs text-gray-500">
                              {selectedVariants[group.type]?.name}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {group.options.map((option) => {
                              const isActive = selectedVariants[group.type]?.id === option.id;
                              const isOutOfStock = option.stock === 0;
                              const hasHex = !!option.hex_color;
                              return (
                                <button
                                  key={option.id}
                                  type="button"
                                  disabled={isOutOfStock}
                                  onClick={() => selectVariant(group.type, option)}
                                  title={isOutOfStock ? 'Out of stock' : option.name}
                                  className={`relative flex items-center gap-2 rounded-xl border-2 px-3 py-2 text-sm transition-all ${
                                    isActive
                                      ? 'border-emerald-600 bg-emerald-50 text-emerald-800 font-semibold'
                                      : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                                  } ${isOutOfStock ? 'opacity-40 cursor-not-allowed line-through' : ''}`}
                                >
                                  {hasHex && (
                                    <span
                                      className="w-4 h-4 rounded-full border border-gray-200"
                                      style={{ backgroundColor: option.hex_color }}
                                    />
                                  )}
                                  {!hasHex && option.image_url && (
                                    <img
                                      src={option.image_url}
                                      alt=""
                                      className="w-6 h-6 rounded object-contain bg-white"
                                    />
                                  )}
                                  <span>{option.name}</span>
                                  <span className="text-xs text-gray-500">
                                    ₹{formatPrice(option.effective_base_price)}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {hasColors ? (
                    <>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-semibold text-gray-900">Select Variants</span>
                        <span className="text-xs text-gray-500">MOQ: {product.moq}</span>
                      </div>

                      <input
                        type="text"
                        placeholder="Search color or code..."
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 mb-3"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />

                      <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                        {product.available_colors_list
                          .filter(c => c.toLowerCase().includes(searchTerm.toLowerCase()))
                          .map((color, idx) => {
                            const isHex = color.startsWith('#');
                            const commonColors = ['red', 'blue', 'green', 'black', 'white', 'yellow', 'orange', 'purple', 'pink', 'gray', 'brown', 'teal', 'indigo', 'cyan', 'lime', 'maroon', 'navy', 'olive', 'silver', 'gold', 'beige'];
                            const isColor = isHex || commonColors.includes(color.toLowerCase());

                            return (
                              <div key={idx} className="flex items-center justify-between bg-gray-50 p-2 rounded-xl border border-gray-100">
                                <div className="flex items-center gap-3">
                                  {isColor ? (
                                    <span
                                      className="w-7 h-7 rounded-full border border-gray-200 shadow-sm block"
                                      style={{ backgroundColor: color }}
                                    />
                                  ) : (
                                    <span className="px-2 py-1 bg-white border border-gray-200 rounded text-xs font-mono font-bold text-gray-700 min-w-[3rem] text-center">
                                      {color}
                                    </span>
                                  )}
                                  <span className="font-medium text-gray-700 capitalize text-sm">{color}</span>
                                </div>

                                <div className="flex items-center border border-gray-200 rounded-lg bg-white">
                                  <button
                                    onClick={() => updateColorQty(color, -1)}
                                    className="p-1 hover:bg-gray-100 text-gray-600 w-8 h-8 flex items-center justify-center"
                                  >
                                    <Minus className="w-3 h-3" />
                                  </button>
                                  <span className="w-8 text-center font-bold text-gray-800 text-sm">
                                    {colorQuantities[color] || 0}
                                  </span>
                                  <button
                                    onClick={() => updateColorQty(color, 1)}
                                    className="p-1 hover:bg-gray-100 text-emerald-600 w-8 h-8 flex items-center justify-center"
                                  >
                                    <Plus className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        {product.available_colors_list.filter(c => c.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 && (
                          <p className="text-center text-gray-500 py-4 text-sm">No variants found.</p>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-semibold text-gray-900">Quantity</span>
                        <span className="text-xs text-gray-500">MOQ: {effectiveMoq}</span>
                      </div>
                      <div className="flex items-center border border-gray-200 rounded-xl w-fit">
                        <button
                          onClick={() => setQuantity(Math.max(effectiveMoq, quantity - effectiveMoq))}
                          className="p-2.5 hover:bg-gray-50 transition-colors rounded-l-xl"
                        >
                          <Minus className="w-4 h-4 text-gray-600" />
                        </button>
                        <input
                          type="number"
                          value={quantity}
                          onChange={(e) => setQuantity(Math.max(effectiveMoq, parseInt(e.target.value) || effectiveMoq))}
                          className="w-16 text-center font-bold text-base border-none focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          min={effectiveMoq}
                          step={effectiveMoq}
                        />
                        <button
                          onClick={() => setQuantity(quantity + effectiveMoq)}
                          className="p-2.5 hover:bg-gray-50 transition-colors rounded-r-xl"
                        >
                          <Plus className="w-4 h-4 text-gray-600" />
                        </button>
                      </div>
                    </>
                  )}

                  {/* Total */}
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                    <span className="text-sm text-gray-600">
                      Total ({totalQuantity} × {product.unit || 'unit'})
                    </span>
                    <span className="text-lg font-bold text-gray-900">₹{currentTotalPrice.toFixed(2)}</span>
                  </div>

                  {/* Add to cart */}
                  <button
                    onClick={handleAddToCart}
                    className={`w-full font-bold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2 mt-4 ${
                      totalQuantity > 0
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    }`}
                    disabled={totalQuantity === 0}
                  >
                    <ShoppingCart className="w-5 h-5" />
                    {hasColors
                      ? (totalQuantity > 0 ? `Add ${totalQuantity} Items to Cart` : 'Select variants to add')
                      : 'Add to Cart'}
                  </button>
                </div>

                {/* Card 3 — Highlights */}
                <div className="bg-white border border-gray-200 rounded-2xl p-5">
                  <h2 className="text-base font-bold text-gray-900 mb-3">Highlights</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                    {product.brand_name && (
                      <DetailRow label="Brand" value={product.brand_name} highlight />
                    )}
                    {product.product_type && <DetailRow label="Product Type" value={product.product_type} />}
                    {product.unit && <DetailRow label="Unit" value={product.unit} />}
                    {product.weight && <DetailRow label="Weight / Volume" value={product.weight} />}
                    {product.packaging_type && <DetailRow label="Packaging Type" value={product.packaging_type} />}
                    {product.dietary_preference && <DetailRow label="Dietary Preference" value={product.dietary_preference} />}
                    <DetailRow
                      label="MOQ"
                      value={effectiveMoq === 1 ? (product.unit || 'unit') : `${effectiveMoq} ${product.unit || 'units'}`}
                    />
                    <DetailRow label="Case Size" value={formatCaseSize(effectiveCaseSize, product.unit)} />
                    <DetailRow label="Stock Available" value={`${effectiveStock} units`} />
                  </div>
                </div>

                {/* Card 4 — Description & details */}
                {(product.description || (product.key_features_list && product.key_features_list.length > 0) || product.ingredients || product.storage_instruction || product.usage_recommendation) && (
                  <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-5">
                    {product.description && (
                      <div>
                        <h2 className="text-base font-bold text-gray-900 mb-2">Description</h2>
                        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{product.description}</p>
                      </div>
                    )}

                    {product.key_features_list && product.key_features_list.length > 0 && (
                      <div>
                        <h2 className="text-base font-bold text-gray-900 mb-2">Key Features</h2>
                        <ul className="space-y-2">
                          {product.key_features_list.map((feature, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                              <span className="text-emerald-600 mt-0.5">✓</span>
                              <span>{feature}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {product.ingredients && (
                      <div>
                        <h2 className="text-base font-bold text-gray-900 mb-2">Ingredients</h2>
                        <p className="text-sm text-gray-700 leading-relaxed">{product.ingredients}</p>
                      </div>
                    )}

                    {product.usage_recommendation && (
                      <div>
                        <h2 className="text-base font-bold text-gray-900 mb-2">Usage Recommendation</h2>
                        <p className="text-sm text-gray-700 leading-relaxed">{product.usage_recommendation}</p>
                      </div>
                    )}

                    {product.storage_instruction && (
                      <div>
                        <h2 className="text-base font-bold text-gray-900 mb-2">Storage Instruction</h2>
                        <p className="text-sm text-gray-700 leading-relaxed">{product.storage_instruction}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper component for detail rows (Highlights grid)
function DetailRow({ label, value, highlight = false }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-gray-100">
      <span className="text-sm text-gray-500">{label}</span>
      <span className={`text-sm font-medium text-right ${highlight ? 'text-emerald-700' : 'text-gray-900'}`}>
        {value}
      </span>
    </div>
  );
}
