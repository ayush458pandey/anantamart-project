import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Package, ChevronRight, LayoutGrid } from 'lucide-react';
import { productService } from '../api/services/productService';
import ProductCard from './ProductCard';
import { useCart } from '../context/useCart';
import {
    groupProductsBySubcategory,
    shouldShowSubcategoryTiles,
} from '../utils/brandGrouping';

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
    // null = showing the subcategory tiles; otherwise the selected group id.
    const [activeGroupId, setActiveGroupId] = useState(null);
    const { cart, removeFromCart } = useCart();

    const fallbackProducts = useMemo(() => (
        allProducts.filter(product => productMatchesBrand(product, brand))
    ), [allProducts, brand]);

    useEffect(() => {
        const fetchBrandProducts = async () => {
            if (!brand) return;

            // Show any already-loaded matches right away while the authoritative
            // brand endpoint finishes, avoiding a full-screen loading delay.
            if (fallbackProducts.length > 0) {
                setProducts(fallbackProducts);
                setLoading(false);
            } else {
                setLoading(true);
            }
            setError(null);

            try {
                // Follows pagination, so a large brand (Anchor: 281 products) is not
                // truncated to the first 100. Falls back to the slug endpoint only
                // when the name filter returns nothing.
                let data = await productService.getBrandProducts(brand.name);

                if (data.length === 0 && brand.slug) {
                    data = normalizeProductResponse(await productService.getProductsByBrand(brand.slug));
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

    const groups = groupProductsBySubcategory(displayProducts);
    const showTiles = shouldShowSubcategoryTiles(groups);
    const activeGroup = activeGroupId
        ? groups.find((g) => g.id === activeGroupId) || null
        : null;
    // Tiles are the landing view; picking one drills into that subcategory.
    const visibleProducts = activeGroup ? activeGroup.products : displayProducts;

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

                {/* Subcategory tiles: the landing view for a brand that spans
                    more than one subcategory. */}
                {!loading && !error && showTiles && (
                    <div className="mb-5">
                        <div className="flex items-center justify-between mb-3 px-1">
                            <h2 className="text-sm sm:text-base font-bold text-gray-800">
                                Shop {brand.name} by Category
                            </h2>
                            {activeGroup && (
                                <button
                                    onClick={() => setActiveGroupId(null)}
                                    className="text-xs font-semibold text-emerald-600 hover:text-emerald-700"
                                >
                                    Show all
                                </button>
                            )}
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3">
                            <button
                                onClick={() => setActiveGroupId(null)}
                                className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                                    activeGroupId === null
                                        ? 'border-emerald-500 bg-emerald-50'
                                        : 'border-gray-200 bg-white hover:border-emerald-300'
                                }`}
                            >
                                <span className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
                                    <LayoutGrid className="w-4 h-4" />
                                </span>
                                <span className="min-w-0">
                                    <span className="block text-sm font-semibold text-gray-900 truncate">
                                        All Products
                                    </span>
                                    <span className="block text-xs text-gray-500">
                                        {productCount} {productCount === 1 ? 'item' : 'items'}
                                    </span>
                                </span>
                            </button>

                            {groups.map((group) => {
                                const isActive = activeGroupId === group.id;
                                return (
                                    <button
                                        key={group.id}
                                        onClick={() => setActiveGroupId(group.id)}
                                        className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                                            isActive
                                                ? 'border-emerald-500 bg-emerald-50'
                                                : 'border-gray-200 bg-white hover:border-emerald-300'
                                        }`}
                                    >
                                        <span className="w-9 h-9 rounded-lg bg-gray-100 text-gray-600 flex items-center justify-center flex-shrink-0">
                                            <Package className="w-4 h-4" />
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block text-sm font-semibold text-gray-900 truncate">
                                                {group.name}
                                            </span>
                                            <span className="block text-xs text-gray-500">
                                                {group.count} {group.count === 1 ? 'item' : 'items'}
                                            </span>
                                        </span>
                                        <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                    </button>
                                );
                            })}
                        </div>
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

                {!loading && !error && visibleProducts.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5 sm:gap-3 md:gap-4">
                        {visibleProducts.map((product, index) => (
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

