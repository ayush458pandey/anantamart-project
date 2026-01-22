import React from 'react'; // Added React import just in case
import { X, Plus, ShoppingCart, Star, Package } from 'lucide-react';
import { useComparison } from '../context/ComparisonContext';
import { useCart } from '../context/CartContext';

export default function ProductComparison({ onClose }) {
  const { compareList, removeFromCompare, clearCompare } = useComparison();
  const { addToCart } = useCart();

  if (compareList.length === 0) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl max-w-2xl w-full p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">Product Comparison</h2>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
              <X className="w-6 h-6" />
            </button>
          </div>
          <div className="text-center py-12">
            <Package className="w-20 h-20 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-600 mb-2">No Products to Compare</h3>
            <p className="text-gray-500 mb-6">Add products to comparison list to see side-by-side details</p>
            <button
              onClick={onClose}
              className="bg-emerald-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-emerald-700"
            >
              Browse Products
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 overflow-y-auto">
      <div className="min-h-screen p-3 sm:p-4">
        <div className="bg-white rounded-lg sm:rounded-xl max-w-7xl mx-auto my-4 sm:my-8">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 rounded-t-lg sm:rounded-t-xl z-20">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-800">Product Comparison</h2>
              <p className="text-xs sm:text-sm text-gray-600 mt-1">Comparing {compareList.length} products</p>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={clearCompare}
                className="flex-1 sm:flex-none text-red-600 hover:bg-red-50 active:bg-red-100 px-3 sm:px-4 py-2 rounded-lg font-medium text-sm sm:text-base transition-colors touch-manipulation"
              >
                Clear All
              </button>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 active:bg-gray-200 rounded-lg transition-colors touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label="Close"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>
          </div>

          {/* Mobile View - Horizontal Scrolling Side-by-Side Table */}
          <div className="block sm:hidden overflow-x-auto -mx-3 sm:mx-0 scrollbar-hide">
            <div className="inline-block min-w-full px-3">
              <table className="w-full border-collapse comparison-table" style={{ minWidth: `${compareList.length * 240 + 140}px` }}>
                <thead className="bg-gray-50 sticky top-0 z-20">
                  <tr>
                    <th className="p-2 text-left font-bold text-xs text-gray-700 sticky left-0 bg-gray-50 z-30 min-w-[120px] border-r border-gray-200">
                      Feature
                    </th>
                    {compareList.map((product, idx) => (
                      <th key={product.id} className={`p-2 min-w-[240px] max-w-[240px] border-r ${idx === compareList.length - 1 ? 'border-r-0' : 'border-gray-200'}`}>
                        <div className="relative">
                          <button
                            onClick={() => removeFromCompare(product.id)}
                            className="absolute -top-1 -right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 active:bg-red-700 transition-colors touch-manipulation z-10 shadow-md"
                            aria-label="Remove from comparison"
                          >
                            <X className="w-3 h-3" />
                          </button>
                          <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-lg p-2 mb-2 border border-emerald-200">
                            {product.image ? (
                              <img
                                src={product.image}
                                alt={product.name}
                                className="w-full h-20 object-contain"
                                loading="lazy"
                              />
                            ) : (
                              <div className="flex items-center justify-center h-20">
                                <Package className="w-10 h-10 text-emerald-300" />
                              </div>
                            )}
                          </div>
                          <h3 className="font-bold text-xs text-gray-800 line-clamp-2 min-h-[32px] leading-tight">{product.name}</h3>
                          <div className="mt-1">
                            <code className="bg-gray-100 px-1.5 py-0.5 rounded text-[10px] text-gray-600">
                              {product.sku}
                            </code>
                          </div>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Price */}
                  <MobileComparisonRow
                    label="Price"
                    compareList={compareList}
                    values={compareList.map((p) => (
                      <div key={p.id} className="text-center w-full">
                        <span className="text-lg font-bold text-emerald-600 block mb-0.5">
                          ₹{parseFloat(p.base_price).toFixed(2)}
                        </span>
                        <div className="text-[10px] text-gray-400 line-through">
                          ₹{parseFloat(p.mrp).toFixed(2)}
                        </div>
                      </div>
                    ))}
                  />

                  {/* Discount */}
                  <MobileComparisonRow
                    label="Discount"
                    compareList={compareList}
                    values={compareList.map((p) => {
                      const discount = Math.round(((p.mrp - p.base_price) / p.mrp) * 100);
                      return (
                        <div key={p.id} className="text-center">
                          <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-[10px] font-bold inline-block">
                            {discount}% OFF
                          </span>
                        </div>
                      );
                    })}
                  />

                  {/* Brand */}
                  {compareList.some(p => p.brand) && (
                    <MobileComparisonRow
                      label="Brand"
                      compareList={compareList}
                      values={compareList.map((p) => (
                        <div key={p.id} className="text-center">
                          <span className="text-xs font-semibold text-gray-800">
                            {p.brand || 'N/A'}
                          </span>
                        </div>
                      ))}
                    />
                  )}

                  {/* MOQ */}
                  <MobileComparisonRow
                    label="MOQ"
                    compareList={compareList}
                    values={compareList.map((p) => (
                      <div key={p.id} className="text-center">
                        <span className="font-bold text-base text-emerald-600">
                          {p.moq}
                        </span>
                        <span className="text-[10px] text-gray-600 ml-0.5">units</span>
                      </div>
                    ))}
                  />

                  {/* Case Size */}
                  <MobileComparisonRow
                    label="Case Size"
                    compareList={compareList}
                    values={compareList.map((p) => (
                      <div key={p.id} className="text-center">
                        <span className="font-bold text-base text-gray-700">
                          {p.case_size}
                        </span>
                        <span className="text-[10px] text-gray-600 ml-0.5">units</span>
                      </div>
                    ))}
                  />

                  {/* Stock Status */}
                  <MobileComparisonRow
                    label="Stock"
                    compareList={compareList}
                    values={compareList.map((p) => (
                      <div key={p.id} className="text-center">
                        <span
                          className={`px-2 py-1 rounded-full text-[10px] font-bold inline-block ${p.stock_status === 'in-stock'
                              ? 'bg-green-100 text-green-700'
                              : p.stock_status === 'out-of-stock'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-orange-100 text-orange-700'
                            }`}
                        >
                          {p.stock_status === 'in-stock' ? 'In Stock' : p.stock_status === 'out-of-stock' ? 'Out' : 'Low'}
                        </span>
                      </div>
                    ))}
                  />

                  {/* Key Features */}
                  {compareList.some(p => (p.key_features_list && p.key_features_list.length > 0) || p.key_features) && (
                    <MobileComparisonRow
                      label="Features"
                      compareList={compareList}
                      values={compareList.map((p) => {
                        const features = p.key_features_list || (p.key_features ? p.key_features.split('\n').filter(f => f.trim()) : []);
                        return (
                          <div key={p.id} className="text-left text-[10px] w-full">
                            {features.length > 0 ? (
                              <ul className="list-disc list-inside space-y-0.5 text-gray-700">
                                {features.slice(0, 3).map((feature, idx) => (
                                  <li key={idx} className="leading-tight">{feature.trim()}</li>
                                ))}
                                {features.length > 3 && (
                                  <li className="text-gray-400 italic">+{features.length - 3} more</li>
                                )}
                              </ul>
                            ) : (
                              <span className="text-gray-400">None</span>
                            )}
                          </div>
                        );
                      })}
                    />
                  )}

                  {/* Add to Cart */}
                  <MobileComparisonRow
                    label="Actions"
                    compareList={compareList}
                    values={compareList.map((p) => (
                      <div key={p.id} className="w-full flex justify-center">
                        <button
                          onClick={() => addToCart(p.id, p.moq)}
                          className="w-full max-w-[180px] bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5 text-[11px] shadow-md"
                        >
                          <Plus className="w-3 h-3" />
                          Add to Cart
                        </button>
                      </div>
                    ))}
                  />
                </tbody>
              </table>
            </div>
          </div>

          {/* Desktop View - Table Layout */}
          <div className="hidden sm:block overflow-x-auto shadow-inner">
            <table className="w-full border-collapse comparison-table">
              <thead className="bg-gray-50 sticky top-0 z-20">
                <tr>
                  <th className="p-4 text-left font-bold text-gray-700 sticky left-0 bg-gray-50 z-30 min-w-[180px] border-r border-gray-200">
                    Feature
                  </th>
                  {compareList.map((product, idx) => (
                    <th key={product.id} className={`p-4 min-w-[280px] max-w-[320px] border-r ${idx === compareList.length - 1 ? 'border-r-0' : 'border-gray-200'}`}>
                      <div className="relative">
                        <button
                          onClick={() => removeFromCompare(product.id)}
                          className="absolute -top-2 -right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 active:bg-red-700 transition-colors touch-manipulation z-10 shadow-lg"
                          aria-label="Remove from comparison"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-lg p-4 mb-3 border border-emerald-200">
                          {product.image ? (
                            <img
                              src={product.image}
                              alt={product.name}
                              className="w-full h-40 object-contain"
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex items-center justify-center h-40">
                              <Package className="w-16 h-16 text-emerald-300" />
                            </div>
                          )}
                        </div>
                        <h3 className="font-bold text-base text-gray-800 line-clamp-2 min-h-[48px]">{product.name}</h3>
                        <div className="mt-2">
                          <code className="bg-gray-100 px-2 py-1 rounded text-xs text-gray-600">
                            {product.sku}
                          </code>
                        </div>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Price */}
                <ComparisonRow
                  label="Price"
                  compareList={compareList}
                  values={compareList.map((p) => (
                    <div key={p.id} className="text-center w-full">
                      <span className="text-2xl font-bold text-emerald-600 block mb-1">
                        ₹{parseFloat(p.base_price).toFixed(2)}
                      </span>
                      <div className="text-sm text-gray-400 line-through">
                        ₹{parseFloat(p.mrp).toFixed(2)}
                      </div>
                    </div>
                  ))}
                />

                {/* Discount */}
                <ComparisonRow
                  label="Discount"
                  compareList={compareList}
                  values={compareList.map((p) => {
                    const discount = Math.round(((p.mrp - p.base_price) / p.mrp) * 100);
                    return (
                      <div key={p.id} className="text-center">
                        <span className="bg-green-100 text-green-700 px-3 py-1.5 rounded-full text-sm font-bold inline-block">
                          {discount}% OFF
                        </span>
                      </div>
                    );
                  })}
                />

                {/* Category */}
                <ComparisonRow
                  label="Category"
                  compareList={compareList}
                  values={compareList.map((p) => (
                    <div key={p.id} className="text-center">
                      <span className="text-sm font-medium text-gray-700">
                        {p.category_name || 'N/A'}
                      </span>
                    </div>
                  ))}
                />

                {/* Brand */}
                <ComparisonRow
                  label="Brand"
                  compareList={compareList}
                  values={compareList.map((p) => (
                    <div key={p.id} className="text-center">
                      <span className="text-sm font-semibold text-gray-800">
                        {p.brand || 'Generic'}
                      </span>
                    </div>
                  ))}
                />

                {/* Product Type */}
                <ComparisonRow
                  label="Product Type"
                  compareList={compareList}
                  values={compareList.map((p) => (
                    <div key={p.id} className="text-center">
                      <span className="text-sm text-gray-600">
                        {p.product_type || 'Standard'}
                      </span>
                    </div>
                  ))}
                />

                {/* Unit & Weight */}
                <ComparisonRow
                  label="Unit & Weight"
                  compareList={compareList}
                  values={compareList.map((p) => (
                    <div key={p.id} className="text-center text-sm text-gray-600">
                      {p.unit && <div className="font-medium">{p.unit}</div>}
                      {p.weight && <div className="text-xs text-gray-500 mt-1">{p.weight}</div>}
                      {!p.unit && !p.weight && <span className="text-gray-400">N/A</span>}
                    </div>
                  ))}
                />

                {/* Key Features */}
                <ComparisonRow
                  label="Key Features"
                  compareList={compareList}
                  values={compareList.map((p) => {
                    const features = p.key_features_list || (p.key_features ? p.key_features.split('\n').filter(f => f.trim()) : []);
                    return (
                      <div key={p.id} className="text-left text-sm w-full">
                        {features.length > 0 ? (
                          <ul className="list-disc list-inside space-y-1.5 text-gray-700">
                            {features.slice(0, 5).map((feature, idx) => (
                              <li key={idx} className="text-xs leading-relaxed">{feature.trim()}</li>
                            ))}
                            {features.length > 5 && (
                              <li className="text-xs text-gray-400 italic">+{features.length - 5} more</li>
                            )}
                          </ul>
                        ) : (
                          <span className="text-gray-400 text-xs">No features listed</span>
                        )}
                      </div>
                    );
                  })}
                />

                {/* Ingredients */}
                <ComparisonRow
                  label="Ingredients"
                  compareList={compareList}
                  values={compareList.map((p) => (
                    <p key={p.id} className="text-xs text-gray-600 text-left line-clamp-4 w-full">
                      {p.ingredients || <span className="text-gray-400">Not specified</span>}
                    </p>
                  ))}
                />

                {/* Packaging Type */}
                <ComparisonRow
                  label="Packaging"
                  compareList={compareList}
                  values={compareList.map((p) => (
                    <div key={p.id} className="text-center">
                      <span className="text-sm text-gray-700 font-medium">
                        {p.packaging_type || <span className="text-gray-400">N/A</span>}
                      </span>
                    </div>
                  ))}
                />

                {/* Dietary Preference */}
                <ComparisonRow
                  label="Dietary"
                  compareList={compareList}
                  values={compareList.map((p) => (
                    <div key={p.id} className="text-center">
                      <span className={`text-xs px-3 py-1.5 rounded-full font-medium inline-block ${p.dietary_preference
                          ? p.dietary_preference.toLowerCase().includes('veg')
                            ? 'bg-green-100 text-green-700'
                            : 'bg-orange-100 text-orange-700'
                          : 'bg-gray-100 text-gray-500'
                        }`}>
                        {p.dietary_preference || 'N/A'}
                      </span>
                    </div>
                  ))}
                />

                {/* MOQ */}
                <ComparisonRow
                  label="Minimum Order Qty"
                  compareList={compareList}
                  values={compareList.map((p) => (
                    <div key={p.id} className="text-center">
                      <span className="font-bold text-lg text-emerald-600">
                        {p.moq}
                      </span>
                      <span className="text-sm text-gray-600 ml-1">units</span>
                    </div>
                  ))}
                />

                {/* Case Size */}
                <ComparisonRow
                  label="Case Size"
                  compareList={compareList}
                  values={compareList.map((p) => (
                    <div key={p.id} className="text-center">
                      <span className="font-bold text-lg text-gray-700">
                        {p.case_size}
                      </span>
                      <span className="text-sm text-gray-600 ml-1">units</span>
                    </div>
                  ))}
                />

                {/* Stock */}
                <ComparisonRow
                  label="Stock Availability"
                  compareList={compareList}
                  values={compareList.map((p) => (
                    <div key={p.id} className="text-center">
                      <span className="font-bold text-lg text-gray-700">
                        {p.stock || 0}
                      </span>
                      <span className="text-sm text-gray-600 ml-1">units</span>
                    </div>
                  ))}
                />

                {/* Stock Status */}
                <ComparisonRow
                  label="Stock Status"
                  compareList={compareList}
                  values={compareList.map((p) => (
                    <div key={p.id} className="text-center">
                      <span
                        className={`px-3 py-1.5 rounded-full text-sm font-bold inline-block ${p.stock_status === 'in-stock'
                            ? 'bg-green-100 text-green-700'
                            : p.stock_status === 'out-of-stock'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-orange-100 text-orange-700'
                          }`}
                      >
                        {p.stock_status === 'in-stock' ? 'In Stock' : p.stock_status === 'out-of-stock' ? 'Out of Stock' : 'Low Stock'}
                      </span>
                    </div>
                  ))}
                />

                {/* Storage Instructions */}
                <ComparisonRow
                  label="Storage Instructions"
                  compareList={compareList}
                  values={compareList.map((p) => (
                    <p key={p.id} className="text-xs text-gray-600 text-left line-clamp-4 w-full leading-relaxed">
                      {p.storage_instruction || <span className="text-gray-400">Not specified</span>}
                    </p>
                  ))}
                />

                {/* Usage Recommendation */}
                <ComparisonRow
                  label="Usage Recommendation"
                  compareList={compareList}
                  values={compareList.map((p) => (
                    <p key={p.id} className="text-xs text-gray-600 text-left line-clamp-4 w-full leading-relaxed">
                      {p.usage_recommendation || <span className="text-gray-400">Not specified</span>}
                    </p>
                  ))}
                />

                {/* Description */}
                <ComparisonRow
                  label="Description"
                  compareList={compareList}
                  values={compareList.map((p) => (
                    <p key={p.id} className="text-sm text-gray-600 text-left line-clamp-5 w-full leading-relaxed">
                      {p.description || <span className="text-gray-400">No description</span>}
                    </p>
                  ))}
                />

                {/* Add to Cart */}
                <ComparisonRow
                  label="Actions"
                  compareList={compareList}
                  values={compareList.map((p) => (
                    <div key={p.id} className="w-full flex justify-center">
                      <button
                        onClick={() => addToCart(p.id, p.moq)}
                        className="w-full max-w-[220px] bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm shadow-md hover:shadow-lg"
                      >
                        <Plus className="w-4 h-4" />
                        Add to Cart
                      </button>
                    </div>
                  ))}
                />
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper component for desktop table rows
function ComparisonRow({ label, values, compareList }) {
  return (
    <tr className="border-b border-gray-200 hover:bg-gray-50 transition-colors group">
      <td className="p-4 font-semibold text-sm sm:text-base text-gray-700 sticky left-0 bg-white z-10 min-w-[180px] border-r border-gray-200 group-hover:bg-gray-50">
        {label}
      </td>
      {values.map((value, idx) => (
        <td
          key={idx}
          className={`p-4 align-top border-r ${idx === compareList.length - 1 ? 'border-r-0' : 'border-gray-200'} bg-white group-hover:bg-gray-50`}
        >
          <div className="flex items-start justify-center min-h-[50px]">
            <div className="w-full">
              {value}
            </div>
          </div>
        </td>
      ))}
    </tr>
  );
}

// Helper component for mobile table rows
function MobileComparisonRow({ label, values, compareList }) {
  return (
    <tr className="border-b border-gray-200 hover:bg-gray-50 transition-colors group">
      <td className="p-2 font-semibold text-xs text-gray-700 sticky left-0 bg-white z-10 min-w-[120px] border-r border-gray-200 group-hover:bg-gray-50">
        {label}
      </td>
      {values.map((value, idx) => (
        <td
          key={idx}
          className={`p-2 align-top border-r ${idx === compareList.length - 1 ? 'border-r-0' : 'border-gray-200'} bg-white group-hover:bg-gray-50`}
        >
          <div className="flex items-start justify-center min-h-[40px]">
            <div className="w-full">
              {value}
            </div>
          </div>
        </td>
      ))}
    </tr>
  );
}