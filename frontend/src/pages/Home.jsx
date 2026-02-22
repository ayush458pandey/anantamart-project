import React, { useState, useEffect } from 'react';
import {
    Search, Package,
    Coffee, Utensils, Droplet, Briefcase, Shirt, Home as HomeIcon, Store,
    ShoppingBag, Box, Tag, Grid, Layers, ChevronLeft
} from 'lucide-react';

import { useProducts } from '../hooks/useProducts';
import { useCart } from '../context/CartContext';

import ProductCard from '../components/ProductCard';
import ProductDetail from '../components/ProductDetail';
import AllBrands from '../components/AllBrands';

import SubcategoryGrid from '../components/SubcategoryGrid';
import BrandGrid from '../components/BrandGrid';
import BrandPage from '../components/BrandPage';
import { productService } from '../api/services/productService';
import CategoryDirectory from '../components/CategoryDirectory';

import '../index.css';

// --- HELPER FUNCTIONS ---
const getCategoryIcon = (category) => {
    if (!category) return Package;
    const iconName = category.icon?.toLowerCase() || '';
    const categoryName = category.name?.toLowerCase() || '';
    const iconMap = {
        'package': Package, 'box': Box, 'coffee': Coffee, 'food': Coffee,
        'beverage': Coffee, 'utensils': Utensils, 'restaurant': Utensils,
        'droplet': Droplet, 'cleaning': Droplet, 'briefcase': Briefcase,
        'office': Briefcase, 'shirt': Shirt, 'apparel': Shirt,
        'home': HomeIcon, 'store': Store, 'shopping': ShoppingBag,
        'bag': ShoppingBag, 'tag': Tag, 'grid': Grid, 'layers': Layers,
    };
    for (const [key, icon] of Object.entries(iconMap)) {
        if (iconName.includes(key) || categoryName.includes(key)) return icon;
    }
    return Package;
};

export default function Home() {
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedProduct, setSelectedProduct] = useState(null);

    // Visual browsing state
    const [subcategories, setSubcategories] = useState([]);
    const [selectedSubcategory, setSelectedSubcategory] = useState(null);
    const [loadingSubcategories, setLoadingSubcategories] = useState(false);
    const [showSubcategoryView, setShowSubcategoryView] = useState(true);
    const [brands, setBrands] = useState([]);
    const [selectedBrand, setSelectedBrand] = useState(null);
    const [loadingBrands, setLoadingBrands] = useState(false);
    const [showAllBrands, setShowAllBrands] = useState(false);

    // Ref to track intentional navigation
    const intentionalNavRef = React.useRef({ subcategoryId: null, navigating: false });

    const { products, categories, loading, error } = useProducts();
    const { cart, addToCart, removeFromCart } = useCart();

    // Fetch subcategories when category changes
    useEffect(() => {
        if (intentionalNavRef.current.navigating) {
            const targetSubcat = intentionalNavRef.current.subcategoryId;
            intentionalNavRef.current = { subcategoryId: null, navigating: false };

            const fetchSubcategoriesOnly = async () => {
                if (selectedCategory && selectedCategory !== 'all') {
                    setLoadingSubcategories(true);
                    try {
                        const data = await productService.getSubcategoriesWithImages(selectedCategory);
                        setSubcategories(data);
                    } catch (err) {
                        console.error('Failed to fetch subcategories:', err);
                        setSubcategories([]);
                    } finally {
                        setLoadingSubcategories(false);
                    }
                }
            };
            fetchSubcategoriesOnly();

            if (targetSubcat) {
                setSelectedSubcategory(targetSubcat);
                setShowSubcategoryView(false);
            }
            return;
        }

        setSelectedSubcategory(null);
        const fetchSubcategories = async () => {
            if (selectedCategory && selectedCategory !== 'all') {
                setLoadingSubcategories(true);
                try {
                    const data = await productService.getSubcategoriesWithImages(selectedCategory);
                    setSubcategories(data);
                } catch (err) {
                    console.error('Failed to fetch subcategories:', err);
                    setSubcategories([]);
                } finally {
                    setLoadingSubcategories(false);
                }
            } else {
                setSubcategories([]);
            }
        };
        fetchSubcategories();
        setShowSubcategoryView(true);
    }, [selectedCategory]);

    // Fetch brands for catalog view
    useEffect(() => {
        const fetchBrands = async () => {
            setLoadingBrands(true);
            try {
                const data = await productService.getBrands();
                setBrands(data);
            } catch (err) {
                console.error('Failed to fetch brands:', err);
                setBrands([]);
            } finally {
                setLoadingBrands(false);
            }
        };
        fetchBrands();
    }, []);

    const handleBackToSubcategories = () => {
        setSelectedSubcategory(null);
        setShowSubcategoryView(true);
    };

    const navigateToCategory = (categoryId, subcategoryId) => {
        setSearchQuery('');
        if (subcategoryId) {
            intentionalNavRef.current = { subcategoryId: subcategoryId, navigating: true };
        }
        setSelectedCategory(categoryId);
        if (!subcategoryId) {
            setSelectedSubcategory(null);
            setShowSubcategoryView(true);
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const filteredProducts = products.filter(product => {
        const query = searchQuery.toLowerCase().trim();

        if (query) {
            return (
                (product.name || '').toLowerCase().includes(query) ||
                (product.sku || '').toLowerCase().includes(query) ||
                (product.brand || '').toLowerCase().includes(query) ||
                (product.brand_name || '').toLowerCase().includes(query) ||
                (product.description || '').toLowerCase().includes(query) ||
                (product.category_name || '').toLowerCase().includes(query) ||
                (product.subcategory_name || '').toLowerCase().includes(query) ||
                (product.key_features || '').toLowerCase().includes(query)
            );
        }

        const matchesCategory = selectedCategory === 'all' || String(product.category) === String(selectedCategory);
        const matchesSubcategory = !selectedSubcategory || String(product.subcategory) === String(selectedSubcategory);
        return matchesCategory && matchesSubcategory;
    });

    const visibleBrands = brands.filter(brand => {
        if (selectedCategory === 'all') return true;
        const hasProduct = products.some(p => {
            const productCatId = String(p.category || p.category_id || (p.category_obj?.id) || '');
            const currentCatId = String(selectedCategory);
            if (productCatId !== currentCatId) return false;
            const targetBrandId = String(brand.id);
            const targetBrandName = brand.name.toLowerCase();
            if (p.brand && String(p.brand) === targetBrandId) return true;
            if (p.brand_id && String(p.brand_id) === targetBrandId) return true;
            if (typeof p.brand === 'object' && p.brand !== null && String(p.brand.id) === targetBrandId) return true;
            if (typeof p.brand === 'string' && p.brand.toLowerCase() === targetBrandName) return true;
            if (p.brand_name && p.brand_name.toLowerCase() === targetBrandName) return true;
            return false;
        });
        return hasProduct;
    });

    const currentCategoryName = categories.find(c => c.id === selectedCategory)?.name || 'All Products';
    const activeSubcategory = subcategories.find(s => s.id === selectedSubcategory);

    if (loading) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center px-4">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 sm:h-16 sm:w-16 border-b-4 border-emerald-600 mx-auto mb-4"></div>
                    <p className="text-gray-600 text-base sm:text-lg">Loading Anantamart...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center px-4">
                <div className="bg-red-50 border-2 border-red-200 rounded-lg sm:rounded-xl p-6 sm:p-8 max-w-md w-full">
                    <h2 className="text-lg sm:text-xl font-bold text-red-600 mb-2">Connection Error</h2>
                    <p className="text-sm sm:text-base text-red-700 mb-4">{error}</p>
                    <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 w-full">
                        Retry Connection
                    </button>
                </div>
            </div>
        );
    }

    // If a brand is selected, show the brand page
    if (selectedBrand) {
        return (
            <BrandPage
                brand={selectedBrand}
                onBack={() => setSelectedBrand(null)}
                onProductClick={(product) => setSelectedProduct(product)}
                onAddToCart={addToCart}
            />
        );
    }

    // If showing all brands view
    if (showAllBrands) {
        return (
            <AllBrands
                brands={brands}
                onBrandClick={(brand) => { setSelectedBrand(brand); setShowAllBrands(false); }}
                onBack={() => setShowAllBrands(false)}
            />
        );
    }

    return (
        <>
            {/* Search + Category Tabs - fixed on mobile, sticky on desktop */}
            <div className="fixed sm:sticky top-[44px] sm:top-[72px] left-0 right-0 sm:left-auto sm:right-auto z-30 bg-white px-3 sm:-mx-4 sm:px-4 pb-2 pt-1 shadow-md">
                {/* Search Bar */}
                <div className="flex items-center bg-gray-100 rounded-lg px-3 py-2 mb-2">
                    <Search className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    <input
                        type="text"
                        placeholder="Search products..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="flex-1 ml-2 bg-transparent outline-none text-base min-w-0"
                    />
                </div>

                {/* Category Tabs */}
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                    <button
                        onClick={() => {
                            setSelectedCategory('all');
                            setSelectedBrand(null);
                            setSelectedSubcategory(null);
                            setShowSubcategoryView(true);
                        }}
                        className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg font-medium text-xs sm:text-sm whitespace-nowrap transition-all touch-manipulation ${selectedCategory === 'all'
                            ? 'bg-emerald-600 text-white shadow-md'
                            : 'bg-gray-200 text-gray-700 active:bg-gray-300'
                            }`}
                    >
                        <Package className={`w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 ${selectedCategory === 'all' ? 'text-white' : 'text-emerald-600'}`} />
                        <span>All Products</span>
                    </button>

                    {categories && categories.map((category) => {
                        const CategoryIcon = getCategoryIcon(category);
                        const isActive = selectedCategory === category.id;
                        return (
                            <button
                                key={category.id}
                                onClick={() => {
                                    setSelectedCategory(category.id);
                                    setSelectedBrand(null);
                                    setSelectedSubcategory(null);
                                    setShowSubcategoryView(true);
                                }}
                                className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg font-medium text-xs sm:text-sm whitespace-nowrap transition-all touch-manipulation ${isActive
                                    ? 'bg-emerald-600 text-white shadow-md'
                                    : 'bg-gray-200 text-gray-700 active:bg-gray-300'
                                    }`}
                            >
                                <CategoryIcon className={`w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 ${isActive ? 'text-white' : 'text-emerald-600'}`} />
                                <span>{category.name}</span>
                            </button>
                        );
                    })}
                </div>
            </div>
            {/* Spacer for fixed header on mobile */}
            <div className="h-[88px] sm:h-0"></div>

            {/* Brand Horizontal Scroll */}
            {!selectedSubcategory && visibleBrands.length > 0 && (
                <div className="mb-8">
                    <div className="flex items-center justify-between mb-3 px-1">
                        <h3 className="text-base sm:text-lg font-bold text-gray-800">
                            Browse by Brand
                        </h3>
                        <button
                            onClick={() => setShowAllBrands(true)}
                            className="text-xs sm:text-sm font-medium text-emerald-600 hover:text-emerald-700 transition-colors flex items-center gap-1"
                        >
                            View All <span className="text-lg">›</span>
                        </button>
                    </div>
                    <BrandGrid
                        brands={visibleBrands}
                        onBrandClick={(brand) => setSelectedBrand(brand)}
                        isLoading={loadingBrands}
                    />
                </div>
            )}

            {/* Page Title */}
            <div className="mb-3 sm:mb-4 px-1">
                {searchQuery ? (
                    <h2 className="text-base sm:text-lg font-bold text-gray-800">
                        Search Results for "{searchQuery}"
                        <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded-full border border-gray-200 ml-2">
                            {filteredProducts.length} items
                        </span>
                    </h2>
                ) : selectedSubcategory && activeSubcategory ? (
                    <div>
                        <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                            {currentCategoryName}
                        </span>
                        <h2 className="text-xl sm:text-2xl font-bold text-emerald-800 flex items-center gap-2 mt-0.5">
                            {activeSubcategory.name}
                            <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded-full border border-gray-200">
                                {filteredProducts.length} items
                            </span>
                        </h2>
                    </div>
                ) : (
                    <h2 className="text-base sm:text-lg font-bold text-gray-800">
                        {selectedCategory === 'all' ? 'All Products' : currentCategoryName}
                    </h2>
                )}
            </div>

            {/* Subcategory Grid */}
            {selectedCategory !== 'all' && showSubcategoryView && subcategories.length > 0 && !searchQuery && (
                <div className="mb-6">
                    <div className="flex items-center justify-between mb-3 px-1">
                        <h3 className="text-sm sm:text-base font-bold text-gray-700">Browse by Subcategory</h3>
                        <button
                            onClick={() => setShowSubcategoryView(false)}
                            className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
                        >
                            View All Products
                        </button>
                    </div>
                    <SubcategoryGrid
                        subcategories={subcategories}
                        onSubcategoryClick={(subcat) => {
                            setSelectedSubcategory(subcat.id);
                            setShowSubcategoryView(false);
                        }}
                        isLoading={loadingSubcategories}
                    />
                </div>
            )}

            {/* Subcategory Navigation (Back Button) */}
            {selectedSubcategory && (
                <button
                    onClick={handleBackToSubcategories}
                    className="flex items-center text-sm font-medium text-emerald-600 hover:text-emerald-700 mb-3 px-1 transition-colors group"
                >
                    <ChevronLeft className="w-5 h-5 mr-1 group-hover:-translate-x-1 transition-transform" />
                    Back to {currentCategoryName}
                </button>
            )}

            {/* MAIN PRODUCT DISPLAY */}
            {(!showSubcategoryView || selectedCategory === 'all' || searchQuery) && (
                <>
                    {/* SCENARIO A: HOMEPAGE */}
                    {selectedCategory === 'all' && !searchQuery ? (
                        <div className="space-y-8 pb-10">
                            <CategoryDirectory
                                categories={categories}
                                onSelectCategory={(id) => {
                                    setSelectedCategory(id);
                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                }}
                            />

                            <div className="space-y-10 border-t border-gray-100 pt-8">
                                {categories.map((category) => {
                                    const CategoryIcon = getCategoryIcon(category.name);
                                    const categoryProducts = products.filter(p =>
                                        String(p.category) === String(category.id) ||
                                        String(p.category?.id) === String(category.id)
                                    );

                                    if (categoryProducts.length === 0) return null;

                                    return (
                                        <div key={category.id} className="border-b border-gray-100 pb-6 last:border-0">
                                            <div className="flex items-center justify-between mb-4 px-1">
                                                <h3 className="text-lg sm:text-xl font-bold text-gray-800 flex items-center gap-2">
                                                    {CategoryIcon && <CategoryIcon className="w-5 h-5 text-emerald-600" />}
                                                    {category.name}
                                                </h3>
                                                <button
                                                    onClick={() => {
                                                        setSelectedCategory(category.id);
                                                        window.scrollTo({ top: 0, behavior: 'smooth' });
                                                    }}
                                                    className="text-xs sm:text-sm font-medium text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full transition-colors"
                                                >
                                                    View All
                                                </button>
                                            </div>
                                            <div className="flex overflow-x-auto gap-3 sm:gap-4 pb-4 -mx-3 px-3 scrollbar-hide snap-x">
                                                {categoryProducts.slice(0, 8).map((product) => (
                                                    <div key={product.id} className="flex-shrink-0 w-[160px] sm:w-[200px] snap-start">
                                                        <ProductCard
                                                            product={product}
                                                            cart={cart}
                                                            removeFromCart={removeFromCart}
                                                            onAddToCart={addToCart}
                                                            onViewDetails={() => setSelectedProduct(product)}
                                                            onNavigateToCategory={navigateToCategory}
                                                        />
                                                    </div>
                                                ))}
                                                {categoryProducts.length > 8 && (
                                                    <div className="flex-shrink-0 w-[100px] sm:w-[120px] flex items-center justify-center snap-start">
                                                        <button
                                                            onClick={() => {
                                                                setSelectedCategory(category.id);
                                                                window.scrollTo({ top: 0, behavior: 'smooth' });
                                                            }}
                                                            className="flex flex-col items-center gap-2 text-gray-500 hover:text-emerald-600"
                                                        >
                                                            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gray-100 flex items-center justify-center">
                                                                <span className="text-xl font-bold">→</span>
                                                            </div>
                                                            <span className="text-xs font-bold">See All</span>
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        /* SCENARIO B: STANDARD GRID */
                        <>
                            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5 sm:gap-3 md:gap-4 pb-4">
                                {filteredProducts.map((product) => (
                                    <ProductCard
                                        key={product.id}
                                        product={product}
                                        cart={cart}
                                        removeFromCart={removeFromCart}
                                        onAddToCart={addToCart}
                                        onViewDetails={() => setSelectedProduct(product)}
                                        onNavigateToCategory={navigateToCategory}
                                    />
                                ))}
                            </div>
                            {filteredProducts.length === 0 && (
                                <div className="text-center py-12 sm:py-16">
                                    <Package className="w-12 h-12 sm:w-16 sm:h-16 text-gray-300 mx-auto mb-3" />
                                    <p className="text-sm sm:text-base text-gray-500">No products found</p>
                                </div>
                            )}
                        </>
                    )}
                </>
            )}

            {/* Product Detail Modal */}
            {selectedProduct && (
                <ProductDetail
                    product={selectedProduct}
                    onClose={() => setSelectedProduct(null)}
                    onAddToCart={addToCart}
                />
            )}
        </>
    );
}
