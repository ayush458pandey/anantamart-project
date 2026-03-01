import { useState, useEffect } from 'react';
import { ArrowLeft, Package } from 'lucide-react';
import { productService } from '../api/services/productService';
import ProductCard from './ProductCard';
import { useCart } from '../context/CartContext';

/**
 * BrandPage Component
 * Displays all products from a specific brand
 */
export default function BrandPage({ brand, onBack, onProductClick, onAddToCart }) {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const { cart, removeFromCart } = useCart();

    useEffect(() => {
        const fetchBrandProducts = async () => {
            if (!brand) return;

            setLoading(true);
            setError(null);

            try {
                const data = await productService.getProductsByBrand(brand.slug);
                setProducts(data);
            } catch (err) {
                console.error('Failed to fetch brand products:', err);
                setError('Failed to load products');
            } finally {
                setLoading(false);
            }
        };

        fetchBrandProducts();
    }, [brand]);

    if (!brand) {
        return null;
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white shadow-sm sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4">
                    <button
                        onClick={onBack}
                        className="flex items-center gap-2 text-emerald-600 hover:text-emerald-700 mb-3 touch-manipulation"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        <span className="text-sm font-medium">Back</span>
                    </button>

                    <div className="flex items-center gap-4">
                        {/* Brand Logo */}
                        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white border-2 border-gray-200 rounded-lg flex items-center justify-center p-2 flex-shrink-0">
                            {brand.logo_url ? (
                                <img
                                    src={brand.logo_url}
                                    alt={brand.name}
                                    className="w-full h-full object-contain"
                                />
                            ) : (
                                <div className="text-3xl font-bold text-gray-400">
                                    {brand.name.charAt(0)}
                                </div>
                            )}
                        </div>

                        {/* Brand Info */}
                        <div className="flex-1">
                            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{brand.name}</h1>
                            {brand.description && (
                                <p className="text-sm text-gray-600 mt-1 line-clamp-2">{brand.description}</p>
                            )}
                            <p className="text-sm text-emerald-600 font-medium mt-1">
                                {brand.product_count || products.length} {(brand.product_count || products.length) === 1 ? 'Product' : 'Products'}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Products Grid */}
            <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4">
                {loading && (
                    <div className="flex items-center justify-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-emerald-600"></div>
                    </div>
                )}

                {error && (
                    <div className="text-center py-12">
                        <p className="text-red-600">{error}</p>
                    </div>
                )}

                {!loading && !error && products.length === 0 && (
                    <div className="text-center py-12">
                        <Package className="w-16 h-16 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500">No products found for this brand</p>
                    </div>
                )}

                {!loading && !error && products.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5 sm:gap-3 md:gap-4">
                        {products.map(product => (
                            <ProductCard
                                key={product.id}
                                product={product}
                                cart={cart}
                                removeFromCart={removeFromCart}
                                onAddToCart={onAddToCart}
                                onViewDetails={() => onProductClick(product)}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

