import { useState } from 'react';
import { 
  ShoppingCart, Search, Plus, Minus, Package, 
  Coffee, Eye, FileText, User, X, CheckCircle, GitCompare 
} from 'lucide-react';
import { useProducts } from './hooks/useProducts';
import { useCart } from './context/CartContext';
import { ComparisonProvider, useComparison } from './context/ComparisonContext';
import ProductComparison from './components/ProductComparison';
import ProductDetail from './components/ProductDetail';
import AdvancedCheckout from './components/AdvancedCheckout';
import OrdersList from './components/OrdersList';

import './index.css';

function AppContent() {
  const [currentView, setCurrentView] = useState('catalog');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [showComparison, setShowComparison] = useState(false);

  const { products, categories, loading, error } = useProducts();
  const { cart, addToCart, removeFromCart, updateQuantity } = useCart();
  const { compareProducts } = useComparison();

  // Filter products
  const filteredProducts = products.filter(product => {
    const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.sku.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Calculate totals
  const estimateSubtotal = cart?.items?.reduce((sum, item) =>
    sum + parseFloat(item.total_price), 0) || 0;
  const cgst = estimateSubtotal * 0.09;
  const sgst = estimateSubtotal * 0.09;
  const estimateTotal = estimateSubtotal + cgst + sgst;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Loading Anantamart...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-8 max-w-md">
          <h2 className="text-xl font-bold text-red-600 mb-2">Connection Error</h2>
          <p className="text-red-700 mb-4">{error}</p>
          <p className="text-sm text-gray-600">
            Make sure Django backend is running at:{' '}
            <code className="bg-red-100 px-2 py-1 rounded">http://localhost:8000</code>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* HEADER */}
      <header className="sticky top-0 bg-white shadow-md z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          {/* Logo & Search */}
          <div className="flex items-center gap-4 mb-4">
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-emerald-600">Anantamart</h1>
              <p className="text-xs text-gray-500">B2B Wholesale Platform</p>
            </div>
            
            {/* Search Bar */}
            <div className="flex-1 flex items-center bg-gray-100 rounded-lg px-3 py-2">
              <Search className="w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search products or SKU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 ml-2 bg-transparent outline-none text-sm"
              />
            </div>
          </div>

          {/* CATEGORIES - HORIZONTAL SCROLL */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-all ${
                selectedCategory === 'all'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              All Products
            </button>
            
            {categories && categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-all ${
                  selectedCategory === category.id
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {category.name}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-4">
        {currentView === 'catalog' && (
          <>
            <h2 className="text-lg font-bold text-gray-800 mb-4">
              {selectedCategory === 'all' ? 'All Products' : categories.find(c => c.id === selectedCategory)?.name}
            </h2>
            {/* Horizontal Scrolling Products */}
            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
              {filteredProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onAddToCart={addToCart}
                  onViewDetails={() => setSelectedProduct(product)}
                />
              ))}
            </div>
            {filteredProducts.length === 0 && (
              <div className="text-center py-12">
                <Package className="w-16 h-16 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No products found</p>
              </div>
            )}
          </>
        )}

        {currentView === 'estimate' && (
          <EstimateView
            cart={cart}
            removeFromCart={removeFromCart}
            updateQuantity={updateQuantity}
            subtotal={estimateSubtotal}
            cgst={cgst}
            sgst={sgst}
            total={estimateTotal}
            onCheckout={() => setShowCheckout(true)}
          />
        )}

        {currentView === 'orders' && <OrdersList />}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-around py-2">
            <NavButton
              icon={Package}
              label="Catalog"
              active={currentView === 'catalog'}
              onClick={() => setCurrentView('catalog')}
            />
            <NavButton
              icon={FileText}
              label="Estimate"
              active={currentView === 'estimate'}
              onClick={() => setCurrentView('estimate')}
              badge={cart?.items?.length}
            />
            <NavButton
              icon={GitCompare}
              label="Compare"
              active={showComparison}
              onClick={() => setShowComparison(true)}
              badge={compareProducts?.length || 0}
            />
            <NavButton
              icon={ShoppingCart}
              label="Orders"
              active={currentView === 'orders'}
              onClick={() => setCurrentView('orders')}
            />
            <NavButton
              icon={User}
              label="Profile"
              active={currentView === 'profile'}
              onClick={() => setCurrentView('profile')}
            />
          </div>
        </div>
      </nav>

      {/* Product Detail */}
      {selectedProduct && (
        <ProductDetail
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onAddToCart={addToCart}
        />
      )}

      {/* Advanced Checkout Modal */}
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

      {/* Comparison Modal */}
      {showComparison && (
        <ProductComparison onClose={() => setShowComparison(false)} />
      )}
    </div>
  );
}

// Product Card Component
function ProductCard({ product, onAddToCart, onViewDetails }) {
  const [quantity, setQuantity] = useState(product.moq || 1);
  const [isInCart, setIsInCart] = useState(false);

  const handleAdd = () => {
    onAddToCart(product.id, quantity);
    setIsInCart(true);
  };

  const handleIncrement = () => {
    const newQty = quantity + product.moq;
    setQuantity(newQty);
    onAddToCart(product.id, newQty);
  };

  const handleDecrement = () => {
    const newQty = Math.max(product.moq, quantity - product.moq);
    setQuantity(newQty);
    if (newQty === product.moq) {
      setIsInCart(false);
    }
    onAddToCart(product.id, newQty);
  };

  const discount = Math.round(((product.mrp - product.base_price) / product.mrp) * 100);

  return (
    <div className="flex-shrink-0 w-72 bg-white rounded-xl shadow-md hover:shadow-xl transition-all">
      {/* Product Image */}
      <div className="relative bg-gradient-to-br from-emerald-50 to-emerald-100 h-48 rounded-t-xl overflow-hidden">
        {product.image ? (
          <img src={product.image} alt={product.name} className="w-full h-full object-contain p-4" />
        ) : (
          <div className="flex items-center justify-center h-full">
            <Package className="w-20 h-20 text-emerald-300" />
          </div>
        )}

        {/* Stock Badge - Top Left */}
        <div className="absolute top-2 left-2">
          <span className={`text-xs font-bold px-2 py-1 rounded-full ${
            product.stock_status === 'in-stock' ? 'bg-green-500' : 'bg-orange-500'
          } text-white`}>
            {product.stock_status === 'in-stock' ? 'In Stock' : 'Low Stock'}
          </span>
        </div>

        {/* Discount Badge - Top Right */}
        {discount > 0 && (
          <div className="absolute top-2 right-2">
            <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
              {discount}% OFF
            </span>
          </div>
        )}

        {/* Compare Button - Bottom Left */}
        <button
          onClick={(e) => {
            e.stopPropagation();
          }}
          className="absolute bottom-2 left-2 bg-white p-2 rounded-full shadow-md hover:bg-gray-50 transition-all"
          title="Add to Compare"
        >
          <GitCompare className="w-4 h-4 text-gray-600" />
        </button>

        {/* ADD Button / Quantity Controls - Bottom Right */}
        <div className="absolute bottom-2 right-2">
          {!isInCart ? (
            <button
              onClick={handleAdd}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2 rounded-lg shadow-lg transition-all flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              ADD
            </button>
          ) : (
            <div className="flex items-center bg-white rounded-lg shadow-lg border-2 border-emerald-600">
              <button
                onClick={handleDecrement}
                className="p-2 hover:bg-gray-50 transition-colors"
              >
                <Minus className="w-4 h-4 text-emerald-600" />
              </button>
              <span className="px-3 font-bold text-emerald-600 min-w-[40px] text-center">
                {quantity}
              </span>
              <button
                onClick={handleIncrement}
                className="p-2 hover:bg-gray-50 transition-colors"
              >
                <Plus className="w-4 h-4 text-emerald-600" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Product Info */}
      <div className="p-4">
        <h3 
          onClick={onViewDetails}
          className="font-bold text-sm text-gray-800 mb-1 line-clamp-2 min-h-[2.5rem] cursor-pointer hover:text-emerald-600 transition-colors"
        >
          {product.name}
        </h3>
        
        <p className="text-xs text-gray-500 mb-2">SKU: {product.sku}</p>

        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-xl font-bold text-emerald-600">
            ₹{parseFloat(product.base_price).toFixed(2)}
          </span>
          <span className="text-xs text-gray-400 line-through">
            ₹{parseFloat(product.mrp).toFixed(2)}
          </span>
        </div>

        <p className="text-xs text-gray-600">
          MOQ: <span className="font-semibold text-emerald-600">{product.moq}</span> • 
          Case: {product.case_size}
        </p>
      </div>
    </div>
  );
}

// Estimate View
function EstimateView({ cart, removeFromCart, updateQuantity, subtotal, cgst, sgst, total, onCheckout }) {
  if (!cart || cart.items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <FileText className="w-20 h-20 text-gray-300 mb-4" />
        <h3 className="text-xl font-bold text-gray-600 mb-2">No Items in Estimate</h3>
        <p className="text-gray-500">Add products to create an estimate</p>
      </div>
    );
  }

  const handleDecrease = (product, currentQty) => {
    const moq = product.moq || 1;
    const newQty = Math.max(moq, currentQty - moq);
    updateQuantity(product.id, newQty);
  };

  const handleIncrease = (product, currentQty) => {
    const moq = product.moq || 1;
    const newQty = currentQty + moq;
    updateQuantity(product.id, newQty);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Price Estimate</h2>

      <div className="bg-white rounded-xl shadow-md mb-6">
        {cart.items.map((item, idx) => {
          console.log(`Item ${idx}:`, item.product.name, 'Image:', item.product.image);
          
          return (
            <div key={item.id} className={`p-4 flex items-center gap-4 ${idx !== cart.items.length - 1 ? 'border-b' : ''}`}>
              {/* Product Image */}
              <div className="w-20 h-20 bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                {item.product?.image ? (
                  <img 
                    src={item.product.image} 
                    alt={item.product.name}
                    className="w-full h-full object-contain"
                    style={{ padding: '0.5rem' }}
                    onLoad={() => console.log('✅ Image loaded:', item.product.image)}
                    onError={(e) => {
                      console.error('❌ Image failed:', item.product.image);
                      e.target.style.display = 'none';
                      e.target.parentElement.innerHTML = '<svg class="w-10 h-10 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path></svg>';
                    }}
                  />
                ) : (
                  <Package className="w-10 h-10 text-emerald-400" />
                )}
              </div>

              <div className="flex-1">
                <h4 className="font-bold text-sm">{item.product.name}</h4>
                <p className="text-xs text-gray-500">SKU: {item.product.sku}</p>
                <p className="text-xs text-gray-600 mt-1">MOQ: {item.product.moq} units</p>
                <p className="font-bold text-emerald-600 mt-1">
                  ₹{parseFloat(item.product.base_price).toFixed(2)}
                </p>
              </div>

              {/* Quantity Controls */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDecrease(item.product, item.quantity)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  disabled={item.quantity <= item.product.moq}
                >
                  <Minus className="w-4 h-4 text-gray-600" />
                </button>
                <span className="w-16 text-center font-bold text-emerald-600">
                  {item.quantity}
                </span>
                <button
                  onClick={() => handleIncrease(item.product, item.quantity)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4 text-gray-600" />
                </button>
              </div>

              <div className="text-right">
                <p className="font-bold text-lg">₹{parseFloat(item.total_price).toFixed(2)}</p>
                <button
                  onClick={() => removeFromCart(item.product.id)}
                  className="text-red-600 text-xs hover:underline mt-1 font-medium"
                >
                  Remove
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-xl shadow-md p-6 mb-6">
        <h3 className="font-bold text-lg mb-4">Price Summary</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Subtotal:</span>
            <span className="font-bold">₹{subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">CGST (9%):</span>
            <span className="font-bold">₹{cgst.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">SGST (9%):</span>
            <span className="font-bold">₹{sgst.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-lg font-bold text-emerald-600 border-t pt-2">
            <span>Total Amount:</span>
            <span>₹{total.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <button
        onClick={onCheckout}
        className="w-full bg-emerald-600 text-white font-bold py-3 rounded-lg hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
      >
        <ShoppingCart className="w-5 h-5" />
        Proceed to Checkout
      </button>
    </div>
  );
}

// Bottom Nav Button
function NavButton({ icon: Icon, label, active, onClick, badge }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center py-2 px-3 rounded-lg transition-colors relative ${
        active ? 'text-emerald-600' : 'text-gray-600'
      }`}
    >
      <Icon className="w-6 h-6 mb-1" />
      <span className="text-xs font-medium">{label}</span>
      {badge > 0 && (
        <span className="absolute top-0 right-0 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
          {badge}
        </span>
      )}
    </button>
  );
}

export default function App() {
  return (
    <ComparisonProvider>
      <AppContent />
    </ComparisonProvider>
  );
}
