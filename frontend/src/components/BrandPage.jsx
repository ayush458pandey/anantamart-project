import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Package } from 'lucide-react';
import { productService } from '../api/services/productService';
import ProductCard from './ProductCard';
import { useCart } from '../context/CartContext';

const normalizeProductResponse = (data) => Array.isArray(data)
    ? data
    : (data?.results || []);

const normalizeProductImage = (product) => ({
    ...product,
    image: product.image_url || product.images?.[0]?.image || product.image,
});

const productMatchesBrand = (product, brand) => {
    const brandId = String(brand.id);
    const brandName = brand.name.toLowerCase();

    return String(product.brand_ref || '') === brandId ||
        String(product.brand_id || '') === brandId ||
        String(product.brand?.id || '') === brandId ||
        String(product.brand || '').toLowerCase() === brandName ||
        String(product.brand_name || '').toLowerCase() === brandName;
};

/**
 * BrandPage Component
 * Displays all products from a specific brand
 */
export default function BrandPage({ brand, allProducts = [], onBack, onProductClick, onAddToCart, updateQuantity }) {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const { cart, removeFromCart } = useCart();

    const fallbackProducts = useMemo(() => (
        allProducts.filter(product => productMatchesBrand(product, brand))
    ), [allProducts, brand]);

    useEffect(() => {
        const fetchBrandProducts = async () => {
            if (!brand) return;

            setLoading(true);
            setError(null);

            try {
                let data = [];

                if (brand.slug) {
                    data = normalizeProductResponse(await productService.getProductsByBrand(brand.slug));
                }

                if (data.length === 0) {
                    data = normalizeProductResponse(await productService.getProducts(null, [brand.name]));
                }

                setProducts(data.map(normalizeProductImage));
            } catch (err) {
                console.error('Failed to fetch brand products:', err);
                if (fallbackProducts.length > 0) {
                    setProducts(fallbackProducts);
                } else {
                    setError('Failed to load products');
                }
            } finally {
                setLoading(false);
            }
        };

        fetchBrandProducts();
    }, [brand, fallbackProducts]);

    if (!brand) {
        return null;
    }

    const displayProducts = products.length > 0 ? products : fallbackProducts;
    const productCount = displayProducts.length;
    const logoUrl = brand.logo_url || brand.logo;
    const headerExtension = document.getElementById('header-extension');

    const mobileBrandHeader = headerExtension && createPortal(
        <div className="px-3 pb-3 pt-1 bg-white sm:hidden">
            <button
                onClick={onBack}
                className="inline-flex items-center gap-2 text-emerald-600 active:text-emerald-700 py-2 touch-manipulation"
            >
                <ArrowLeft className="w-5 h-5" />
                <span className="text-sm font-semibold">Back</span>
            </button>
            <div className="flex items-center gap-3 rounded-lg border border-gray-100 bg-white">
                <div className="w-14 h-14 bg-white border border-gray-200 rounded-lg flex items-center justify-center p-2 flex-shrink-0">
                    {logoUrl ? (
                        <img src={logoUrl} alt={brand.name} className="w-full h-full object-contain" />
                    ) : (
                        <div className="text-2xl font-bold text-gray-400">{brand.name.charAt(0)}</div>
                    )}
                </div>
                <div className="min-w-0">
                    <h1 className="text-lg font-bold text-gray-900 truncate">{brand.name}</h1>
                    <p className="text-sm text-emerald-600 font-semibold">
                        {productCount} {productCount === 1 ? 'Product' : 'Products'}
                    </p>
                </div>
            </div>
        </div>,
        headerExtension
    );

    return (
        <div className="min-h-screen bg-gray-50">
            {mobileBrandHeader}
            {/* Header */}
            <div className="hidden sm:block bg-white shadow-sm sticky top-0 z-10">
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
                            {logoUrl ? (
                                <img
                                    src={logoUrl}
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
                                {productCount} {productCount === 1 ? 'Product' : 'Products'}
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

                {!loading && !error && displayProducts.length === 0 && (
                    <div className="min-h-[45vh] flex items-center justify-center text-center px-4">
                        <div>
                            <Package className="w-16 h-16 text-gray-300 mx-auto mb-3" />
                            <h2 className="font-semibold text-gray-800">No products listed yet</h2>
                            <p className="text-sm text-gray-500 mt-1">This brand is available in the directory, but products have not been linked yet.</p>
                            <button
                                onClick={onBack}
                                className="mt-4 inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white active:bg-emerald-700"
                            >
                                Browse other brands
                            </button>
                        </div>
                    </div>
                )}

                {!loading && !error && displayProducts.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5 sm:gap-3 md:gap-4">
                        {displayProducts.map((product, index) => (
                            <ProductCard
                                key={product.id}
                                product={product}
                                cart={cart}
                                removeFromCart={removeFromCart}
                                updateQuantity={updateQuantity}
                                onAddToCart={onAddToCart}
                                onViewDetails={() => onProductClick(product)}
                                priority={index < 4}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

