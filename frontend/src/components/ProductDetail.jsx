import { useState } from 'react';
import { X, Plus, Minus, ShoppingCart, Package, Truck, Shield } from 'lucide-react';

export default function ProductDetail({ product, onClose, onAddToCart }) {
  const [quantity, setQuantity] = useState(product.moq || 1);
  const [selectedImage, setSelectedImage] = useState(0);

  const images = product.images?.length > 0
    ? product.images.map(img => img.image_url || img.image)
    : product.image
      ? [product.image]
      : [];

  const discount = Math.round(((product.mrp - product.base_price) / product.mrp) * 100);

  // --- NEW HANDLE ADD TO CART ---
  const handleAddToCart = async () => {
    try {
      // 1. Get the Login Token (if user is logged in)
      const token = localStorage.getItem('access_token');

      // 2. Prepare Headers (Attach the ID card if we have it)
      const headers = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // 3. Send Request to Backend
      // ⚠️ IMPORTANT: Verify this URL matches your backend/apps/cart/urls.py
      const response = await fetch('https://api.ananta-mart.in/api/cart/add/', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          product_id: product.id,
          quantity: quantity
        })
      });

      const data = await response.json();

      if (response.ok) {
        // Success!
        alert(`✅ Added ${quantity} units to cart!`);
        if (onAddToCart) onAddToCart(data); // Update parent state if needed
        onClose(); // Close the modal
      } else {
        // Error from Backend
        console.error("Cart Error:", data);
        alert(`❌ Failed to add: ${data.error || 'Unknown error'}`);
      }

    } catch (error) {
      console.error("Network Error:", error);
      alert("❌ Could not connect to the server.");
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

                {/* Available Colors */}
                {product.available_colors_list && product.available_colors_list.length > 0 && (
                  <div className="mb-6">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Available Colors:</h4>
                    <div className="flex flex-wrap gap-2">
                      {product.available_colors_list.map((color, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <span
                            className="w-6 h-6 rounded-full border border-gray-200 shadow-sm block"
                            style={{ backgroundColor: color }}
                            title={color}
                          />
                          <span className="text-xs text-gray-600">{color}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* REVIEWS SECTION REMOVED */}

                {/* Price */}
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-6">
                  <div className="flex items-baseline gap-3 mb-2">
                    <span className="text-4xl font-bold text-emerald-600">
                      ₹{parseFloat(product.base_price).toFixed(2)}
                    </span>
                    <span className="text-xl text-gray-400 line-through">
                      ₹{parseFloat(product.mrp).toFixed(2)}
                    </span>
                    {discount > 0 && (
                      <span className="bg-emerald-600 text-white text-sm font-bold px-3 py-1 rounded-full">
                        {discount}% OFF
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-emerald-700 font-semibold">
                    You save ₹{(product.mrp - product.base_price).toFixed(2)} per {product.unit || 'unit'}
                  </p>
                </div>

                {/* Stock Status */}
                <div className="flex items-center gap-4 mb-6">
                  <span className={`px-4 py-2 rounded-full text-sm font-bold ${product.stock_status === 'in-stock'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-orange-100 text-orange-700'
                    }`}>
                    {product.stock_status === 'in-stock' ? '✓ In Stock' : '⚠ Low Stock'}
                  </span>
                  <span className="text-sm text-gray-600">SKU: {product.sku}</span>
                </div>

                {/* Quantity Selector */}
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
                    <span className="text-sm text-gray-600">
                      Total: ₹{(parseFloat(product.base_price) * quantity).toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Add to Cart Button */}
                <button
                  onClick={handleAddToCart}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-lg transition-colors flex items-center justify-center gap-2 mb-6"
                >
                  <ShoppingCart className="w-6 h-6" />
                  Add to Cart - ₹{(parseFloat(product.base_price) * quantity).toFixed(2)}
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
