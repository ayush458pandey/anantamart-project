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
      <div className="min-h-screen p-4">
        <div className="bg-white rounded-xl max-w-7xl mx-auto">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between rounded-t-xl">
            <div>
              <h2 className="text-2xl font-bold">Product Comparison</h2>
              <p className="text-sm text-gray-600">Comparing {compareList.length} products</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={clearCompare}
                className="text-red-600 hover:bg-red-50 px-4 py-2 rounded-lg font-medium"
              >
                Clear All
              </button>
              <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Comparison Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-4 text-left font-bold text-gray-700 sticky left-0 bg-gray-50 z-10">
                    Feature
                  </th>
                  {compareList.map((product) => (
                    <th key={product.id} className="p-4 min-w-[250px]">
                      <div className="relative">
                        <button
                          onClick={() => removeFromCompare(product.id)}
                          className="absolute top-0 right-0 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-lg p-4 mb-2">
                          {product.image ? (
                            <img
                              src={product.image}
                              alt={product.name}
                              className="w-full h-32 object-contain"
                            />
                          ) : (
                            <div className="flex items-center justify-center h-32">
                              <Package className="w-16 h-16 text-emerald-300" />
                            </div>
                          )}
                        </div>
                        <h3 className="font-bold text-sm text-gray-800">{product.name}</h3>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Price */}
                <ComparisonRow
                  label="Price"
                  values={compareList.map((p) => (
                    <div key={p.id}>
                      <span className="text-2xl font-bold text-emerald-600">
                        ₹{parseFloat(p.base_price).toFixed(2)}
                      </span>
                      <div className="text-sm text-gray-400 line-through mt-1">
                        ₹{parseFloat(p.mrp).toFixed(2)}
                      </div>
                    </div>
                  ))}
                />

                {/* Discount */}
                <ComparisonRow
                  label="Discount"
                  values={compareList.map((p) => {
                    const discount = Math.round(((p.mrp - p.base_price) / p.mrp) * 100);
                    return (
                      <span key={p.id} className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-bold">
                        {discount}% OFF
                      </span>
                    );
                  })}
                />

                {/* SKU */}
                <ComparisonRow
                  label="SKU"
                  values={compareList.map((p) => (
                    <code key={p.id} className="bg-gray-100 px-2 py-1 rounded text-sm">
                      {p.sku}
                    </code>
                  ))}
                />

                {/* Category */}
                <ComparisonRow
                  label="Category"
                  values={compareList.map((p) => (
                    <span key={p.id} className="text-sm text-gray-600">
                      {p.category_name}
                    </span>
                  ))}
                />

                {/* MOQ */}
                <ComparisonRow
                  label="Minimum Order Qty"
                  values={compareList.map((p) => (
                    <span key={p.id} className="font-bold text-emerald-600">
                      {p.moq} units
                    </span>
                  ))}
                />

                {/* Case Size */}
                <ComparisonRow
                  label="Case Size"
                  values={compareList.map((p) => (
                    <span key={p.id} className="font-bold">
                      {p.case_size} units
                    </span>
                  ))}
                />

                {/* Stock */}
                <ComparisonRow
                  label="Stock Availability"
                  values={compareList.map((p) => (
                    <span key={p.id} className="font-bold">
                      {p.stock} units
                    </span>
                  ))}
                />

                {/* Stock Status */}
                <ComparisonRow
                  label="Stock Status"
                  values={compareList.map((p) => (
                    <span
                      key={p.id}
                      className={`px-3 py-1 rounded-full text-sm font-bold ${
                        p.stock_status === 'in-stock'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-orange-100 text-orange-700'
                      }`}
                    >
                      {p.stock_status === 'in-stock' ? 'In Stock' : 'Low Stock'}
                    </span>
                  ))}
                />

                {/* Description */}
                <ComparisonRow
                  label="Description"
                  values={compareList.map((p) => (
                    <p key={p.id} className="text-sm text-gray-600">
                      {p.description}
                    </p>
                  ))}
                />

                {/* Add to Cart */}
                <ComparisonRow
                  label="Actions"
                  values={compareList.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => addToCart(p.id, p.moq)}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      <Plus className="w-5 h-5" />
                      Add to Cart
                    </button>
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

// Helper component for table rows
function ComparisonRow({ label, values }) {
  return (
    <tr className="border-b hover:bg-gray-50">
      <td className="p-4 font-medium text-gray-700 sticky left-0 bg-white">
        {label}
      </td>
      {values.map((value, idx) => (
        <td key={idx} className="p-4 text-center">
          {value}
        </td>
      ))}
    </tr>
  );
}
