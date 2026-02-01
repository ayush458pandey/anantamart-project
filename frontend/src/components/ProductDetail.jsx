import { useState } from 'react';
import { X, Plus, Minus, ShoppingCart, Package, Truck, Shield } from 'lucide-react';
import { useCart } from '../context/CartContext';

export default function ProductDetail({ product, onClose, onAddToCart }) {
  const { fetchCart } = useCart();
  const [quantity, setQuantity] = useState(product.moq || 1);
  const [selectedImage, setSelectedImage] = useState(0);

  const images = product.images?.length > 0
    ? product.images.map(img => img.image_url || img.image)
    : product.image
      ? [product.image]
      : [];

  const discount = Math.round(((product.mrp - product.base_price) / product.mrp) * 100);

  // --- STATE FOR COLOR QUANTITIES ---
  // Map of color -> quantity, e.g. { "Red": 2, "Blue": 1 }
  const [colorQuantities, setColorQuantities] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const hasColors = product.available_colors_list && product.available_colors_list.length > 0;

  // Calculate total quantity from map or single state
  const totalQuantity = hasColors
    ? Object.values(colorQuantities).reduce((sum, q) => sum + q, 0)
    : quantity;

  const currentTotalPrice = parseFloat(product.base_price) * (totalQuantity || 0); // Handle 0 case

  // Helper to update color quantity
  const updateColorQty = (color, delta) => {
    setColorQuantities(prev => {
      const current = prev[color] || 0;
      const newQty = Math.max(0, current + delta);
      if (newQty === 0) {
        const { [color]: removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [color]: newQty };
    });
  };

  // --- NEW HANDLE ADD TO CART ---
  // --- NEW HANDLE ADD TO CART ---
  const handleAddToCart = async () => {
    // Validation
    if (totalQuantity === 0) {
      alert("Please select at least 1 item.");
      return;
    }

    // Verify MOQ
    if (totalQuantity < product.moq) {
      alert(`Minimum Order Quantity is ${product.moq}. Please add more items.`);
      return;
    }

    try {
      // Use cartService to handle auth/cookies correctly
      const { cartService } = await import('../api/services/cartService');

      const itemsToAdd = [];

      if (hasColors) {
        // Prepare list of variants
        Object.entries(colorQuantities).forEach(([color, qty]) => {
          if (qty > 0) {
            itemsToAdd.push({ product_id: product.id, quantity: qty, variant: color });
          }
        });
      } else {
        // Standard single item
        itemsToAdd.push({ product_id: product.id, quantity: quantity, variant: '' });
      }

      // Send requests in parallel using cartService
      const promises = itemsToAdd.map(item =>
        cartService.addToCart(item.product_id, item.quantity, item.variant)
      );

      await Promise.all(promises);

      // Refresh the global cart state so UI updates
      await fetchCart();

      // If we reach here, all requests succeeded
      alert(`✅ Added ${totalQuantity} units to cart!`);
      if (onAddToCart) onAddToCart();
      onClose();

    } catch (error) {
      console.error("Add to cart error:", error);
      // cartService logic might throw, showing the error message in alert would be nice
      const msg = error.response?.data?.error || error.message || "Could not add to cart.";
      alert(`❌ Failed: ${msg}`);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 overflow-y-auto">
      <div className="min-h-screen p-4">
        <div className="bg-white rounded-xl max-w-6xl mx-auto my-8">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between z-10 rounded-t-xl">
            <h2 className="text-xl font-bold text-gray-800">Product Details</h2>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Left: Images */}
              <div>
                {/* Main Image */}
                <div className="bg-gray-50 rounded-xl p-8 mb-4 min-h-[400px] flex items-center justify-center">
                  {images.length > 0 ? (
                    <img
                      src={images[selectedImage]}
                      alt={product.name}
                      className="max-w-full max-h-[400px] object-contain"
                    />
                  ) : (
                    <Package className="w-32 h-32 text-gray-300" />
                  )}
                </div>

                {/* Thumbnail Gallery */}
                {images.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto">
                    {images.map((img, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedImage(idx)}
                        className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-all ${selectedImage === idx ? 'border-emerald-600' : 'border-gray-200'
                          }`}
                      >
                        <img src={img} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Right: Details */}
              <div>
                {/* Product Name */}
                <h1 className="text-2xl font-bold text-gray-900 mb-2">{product.name}</h1>

                {/* Brand & Category */}
                <div className="flex items-center gap-3 mb-4">
                  {product.brand && (
                    <span className="text-sm text-gray-600">
                      Brand: <span className="font-semibold text-gray-900">{product.brand}</span>
                    </span>
                  )}
                  <span className="text-gray-400">•</span>
                  <span className="text-sm text-gray-600">{product.category_name}</span>
                </div>

                {/* --- SELECTION LOGIC --- */}
                {hasColors ? (
                  // MULTI-COLOR SELECTION
                  <div className="mb-6 p-4 border border-gray-200 rounded-xl bg-gray-50 flex flex-col max-h-[500px]">
                    <h3 className="font-bold text-gray-800 mb-2">Select Variants & Quantities</h3>

                    {/* Search Bar */}
                    <div className="mb-3">
                      <input
                        type="text"
                        placeholder="Search color or code..."
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2 overflow-y-auto pr-1 flex-1">
                      {product.available_colors_list
                        .filter(c => c.toLowerCase().includes(searchTerm.toLowerCase()))
                        .map((color, idx) => {
                          // Simple heuristic for color vs code
                          const isHex = color.startsWith('#');
                          const commonColors = ['red', 'blue', 'green', 'black', 'white', 'yellow', 'orange', 'purple', 'pink', 'gray', 'brown', 'teal', 'indigo', 'cyan', 'lime', 'maroon', 'navy', 'olive', 'silver', 'gold', 'beige'];
                          const isCommonColor = commonColors.includes(color.toLowerCase());
                          const isColor = isHex || isCommonColor;

                          return (
                            <div key={idx} className="flex items-center justify-between bg-white p-2 rounded-lg border border-gray-100 shadow-sm">
                              <div className="flex items-center gap-3">
                                {isColor ? (
                                  <span
                                    className="w-8 h-8 rounded-full border border-gray-200 shadow-sm block"
                                    style={{ backgroundColor: color }}
                                  />
                                ) : (
                                  <span className="px-2 py-1 bg-gray-100 border border-gray-200 rounded text-xs font-mono font-bold text-gray-700 min-w-[3rem] text-center">
                                    {color}
                                  </span>
                                )}
                                <span className="font-medium text-gray-700 capitalize text-sm">{color}</span>
                              </div>

                              <div className="flex items-center border border-gray-200 rounded-lg">
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
                  </div>
                ) : (
                  // STANDARD QUANTITY SELECTION
                  <div className="mb-6">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Quantity (MOQ: {product.moq})
                    </label>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center border-2 border-gray-200 rounded-lg">
                        <button
                          onClick={() => setQuantity(Math.max(product.moq, quantity - product.moq))}
                          className="p-3 hover:bg-gray-50 transition-colors"
                        >
                          <Minus className="w-5 h-5 text-gray-600" />
                        </button>
                        <input
                          type="number"
                          value={quantity}
                          onChange={(e) => setQuantity(Math.max(product.moq, parseInt(e.target.value) || product.moq))}
                          className="w-24 text-center font-bold text-lg border-none focus:outline-none"
                          min={product.moq}
                          step={product.moq}
                        />
                        <button
                          onClick={() => setQuantity(quantity + product.moq)}
                          className="p-3 hover:bg-gray-50 transition-colors"
                        >
                          <Plus className="w-5 h-5 text-gray-600" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Total Price Display */}
                <div className="mb-6 flex justify-between items-center bg-gray-100 p-4 rounded-lg">
                  <span className="text-gray-600 font-medium">Total Quantity: {totalQuantity} units</span>
                  <span className="text-xl font-bold text-emerald-700">₹{currentTotalPrice.toFixed(2)}</span>
                </div>

                {/* Add to Cart Button */}
                {/* Add to Cart Button */}
                <button
                  onClick={handleAddToCart}
                  className={`w-full font-bold py-4 rounded-lg transition-colors flex items-center justify-center gap-2 mb-6 ${totalQuantity > 0
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-gray-200 text-gray-500 cursor-not-allowed'}`}
                  disabled={totalQuantity === 0}
                >
                  <ShoppingCart className="w-6 h-6" />
                  {hasColors
                    ? (totalQuantity > 0 ? `Add ${totalQuantity} Items to Cart` : "Select variants to add")
                    : `Add to Cart`}
                </button>

                {/* Benefits */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="flex items-center gap-2">
                    <Truck className="w-5 h-5 text-emerald-600" />
                    <span className="text-xs text-gray-600">Fast Delivery</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-emerald-600" />
                    <span className="text-xs text-gray-600">Quality Assured</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Package className="w-5 h-5 text-emerald-600" />
                    <span className="text-xs text-gray-600">Secure Packaging</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Product Details Table */}
            <div className="mt-8 border-t pt-8">
              <h3 className="text-xl font-bold text-gray-900 mb-6">Product Information</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                {product.brand && <DetailRow label="Brand" value={product.brand} />}
                {product.product_type && <DetailRow label="Product Type" value={product.product_type} />}
                {product.unit && <DetailRow label="Unit" value={product.unit} />}
                {product.weight && <DetailRow label="Weight/Volume" value={product.weight} />}
                {product.packaging_type && <DetailRow label="Packaging Type" value={product.packaging_type} />}
                {product.dietary_preference && <DetailRow label="Dietary Preference" value={product.dietary_preference} />}
                {product.usage_recommendation && <DetailRow label="Usage Recommendation" value={product.usage_recommendation} />}
                <DetailRow label="MOQ" value={`${product.moq} units`} />
                <DetailRow label="Case Size" value={`${product.case_size} units`} />
                <DetailRow label="Stock Available" value={`${product.stock} units`} />
              </div>

              {/* Key Features */}
              {product.key_features_list && product.key_features_list.length > 0 && (
                <div className="mt-6">
                  <h4 className="font-bold text-gray-800 mb-3">Key Features</h4>
                  <ul className="space-y-2">
                    {product.key_features_list.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                        <span className="text-emerald-600 mt-1">✓</span>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Ingredients */}
              {product.ingredients && (
                <div className="mt-6">
                  <h4 className="font-bold text-gray-800 mb-3">Ingredients</h4>
                  <p className="text-sm text-gray-700">{product.ingredients}</p>
                </div>
              )}

              {/* Storage Instructions */}
              {product.storage_instruction && (
                <div className="mt-6">
                  <h4 className="font-bold text-gray-800 mb-3">Storage Instruction</h4>
                  <p className="text-sm text-gray-700">{product.storage_instruction}</p>
                </div>
              )}

              {/* Description */}
              {product.description && (
                <div className="mt-6">
                  <h4 className="font-bold text-gray-800 mb-3">Description</h4>
                  <p className="text-sm text-gray-700">{product.description}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper component for detail rows
function DetailRow({ label, value }) {
  return (
    <div className="flex items-start py-3 border-b border-gray-100">
      <span className="text-sm text-gray-600 w-1/2">{label}</span>
      <span className="text-sm font-semibold text-gray-900 w-1/2">{value}</span>
    </div>
  );
}
