import { X, Scale } from 'lucide-react';
import { useComparison } from '../context/ComparisonContext';

const ComparisonView = () => {
  const { compareProducts, removeFromCompare, clearComparison } = useComparison();

  if (compareProducts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <Scale className="w-16 h-16 text-gray-300 mb-4" />
        <p className="text-gray-500">No products to compare</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-4 min-w-max p-4">
        {compareProducts.map((product) => (
          <div key={product.id} className="w-64 bg-white rounded-xl shadow-lg p-4">
            <div className="relative">
              <img
                src={product.image ? `http://localhost:8000${product.image}` : 'https://via.placeholder.com/200'}
                alt={product.name}
                className="w-full h-48 object-cover rounded-lg"
              />
              <button
                onClick={() => removeFromCompare(product.id)}
                className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <h3 className="font-bold text-lg mt-4">{product.name}</h3>
            {/* Add any extra product info for comparison */}
          </div>
        ))}
      </div>
      
      <div className="flex justify-center mt-6">
        <button onClick={clearComparison} className="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600">
          Clear All Comparisons
        </button>
      </div>
    </div>
  );
};

export default ComparisonView;
