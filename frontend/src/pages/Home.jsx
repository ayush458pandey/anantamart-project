import React, { lazy, Suspense, useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
    Search, Package,
    Coffee, Utensils, Droplet, Briefcase, Shirt, Home as HomeIcon, Store,
    ShoppingBag, Box, Tag, Grid, Layers, ChevronLeft, Filter as FilterIcon, HeartPulse
} from 'lucide-react';

import { useProducts } from '../hooks/useProducts';
import { useCart } from '../context/CartContext';

import ProductCard from '../components/ProductCard';

import SubcategoryGrid from '../components/SubcategoryGrid';
import BrandGrid from '../components/BrandGrid';
import FilterSidebar from '../components/FilterSidebar';
import { productService } from '../api/services/productService';
import CategoryDirectory from '../components/CategoryDirectory';

import '../index.css';

const ProductDetail = lazy(() => import('../components/ProductDetail'));
const AllBrands = lazy(() => import('../components/AllBrands'));
const BrandPage = lazy(() => import('../components/BrandPage'));

const ViewFallback = () => (
    <div className="min-h-[45vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
    </div>
);

// --- HELPER FUNCTIONS ---
const getCategoryIcon = (category) => {
    if (!category) return Package;
    const iconName = category.icon?.toLowerCase() || '';
    const categoryName = category.name?.toLowerCase() || '';
    const iconMap = {
        'package': Package, 'box': Box, 'coffee': Coffee, 'food': Coffee,
        'beverage': Coffee, 'utensils': Utensils, 'restaurant': Utensils,
        'hotel': Utensils, 'kitchen suppli': Utensils,
        'droplet': Droplet, 'cleaning': Droplet, 'briefcase': Briefcase,
        'office': Briefcase, 'shirt': Shirt, 'apparel': Shirt,
        'home': HomeIcon, 'store': Store, 'shopping': ShoppingBag,
        'bag': ShoppingBag, 'tag': Tag, 'grid': Grid, 'layers': Layers,
        'health': HeartPulse, 'medical': HeartPulse, 'pharma': HeartPulse,
    };
    for (const [key, icon] of Object.entries(iconMap)) {
        if (iconName.includes(key) || categoryName.includes(key)) return icon;
    }
    return Package;
};

const getEntityId = (value) => {
    if (value && typeof value === 'object') return value.id;
    return value;
};

const getProductCategoryId = (product) => getEntityId(product.category ?? product.category_id);
const getProductSubcategoryId = (product) => getEntityId(product.subcategory ?? product.subcategory_id);

const getProductBrandNames = (product) => [
    product.brand_name,
    typeof product.brand === 'string' ? product.brand : null,
    product.brand_ref?.name,
].filter(Boolean).map(name => String(name).toLowerCase());

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
    const [showBrandRail, setShowBrandRail] = useState(false);
    const [showAllBrands, setShowAllBrands] = useState(false);
    const [filterOptions, setFilterOptions] = useState(null);
    const [selectedBrands, setSelectedBrands] = useState([]);
    const [selectedFilterSubcategories, setSelectedFilterSubcategories] = useState([]);
    const [selectedTags, setSelectedTags] = useState([]);
    const [loadingFilters, setLoadingFilters] = useState(false);
    const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

    // Ref to track intentional navigation
    const intentionalNavRef = React.useRef({ subcategoryId: null, navigating: false });

    const { products, categories, loading, loadingMore, error } = useProducts();
    const { cart, addToCart, removeFromCart, updateQuantity } = useCart();
    const activeFilterSubcategories = useMemo(() => (
        selectedSubcategory ? [selectedSubcategory] : selectedFilterSubcategories
    ), [selectedSubcategory, selectedFilterSubcategories]);

    // --- Browser back button / swipe support ---
    // Push a history entry when entering a deeper view
    useEffect(() => {
        const handlePopState = () => {
            // When back button is pressed, figure out what to close
            if (selectedProduct) {
                setSelectedProduct(null);
            } else if (selectedBrand) {
                setSelectedBrand(null);
            } else if (showAllBrands) {
                setShowAllBrands(false);
            } else if (selectedSubcategory) {
                setSelectedSubcategory(null);
                setShowSubcategoryView(true);
            } else if (selectedCategory !== 'all') {
                setSelectedCategory('all');
            }
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [selectedProduct, selectedBrand, showAllBrands, selectedSubcategory, selectedCategory]);

    // Push history when navigating deeper
    const pushHistory = () => {
        window.history.pushState({ appNav: true }, '');
    };

    // Wrap state setters that represent "deeper" navigation
    const selectBrand = (brand) => {
        pushHistory();
        setSelectedBrand(brand);
    };
    const selectProduct = (product) => {
        pushHistory();
        setSelectedProduct(product);
    };
    const selectSubcategory = (subcat) => {
        pushHistory();
        setSelectedSubcategory(subcat);
        setShowSubcategoryView(false);
    };
    const openAllBrands = () => {
        pushHistory();
        setShowAllBrands(true);
    };

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
        setSelectedBrands([]);
        setSelectedFilterSubcategories([]);
        setSelectedTags([]);
        setFilterOptions(null);
        setMobileFiltersOpen(false);
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

    // Fetch available brand and subcategory filters for the selected category
    useEffect(() => {
        const fetchFilterOptions = async () => {
            if (!selectedCategory || selectedCategory === 'all') {
                setFilterOptions(null);
                return;
            }

            setLoadingFilters(true);
            try {
                const subcategoriesForFilterOptions = selectedSubcategory
                    ? [selectedSubcategory]
                    : selectedFilterSubcategories;
                const data = await productService.getFilterOptions(
                    selectedCategory,
                    subcategoriesForFilterOptions
                );
                setFilterOptions(data);
            } catch (err) {
                console.error('Failed to fetch filter options:', err);
                setFilterOptions(null);
            } finally {
                setLoadingFilters(false);
            }
        };

        fetchFilterOptions();
    }, [selectedCategory, selectedSubcategory, selectedFilterSubcategories]);

    // Fetch brands after the first catalog paint so brand logos do not compete with LCP.
    useEffect(() => {
        let cancelled = false;
        let timeoutId;
        let idleId;

        const fetchBrands = async () => {
            setLoadingBrands(true);
            try {
                const data = await productService.getBrands();
                if (!cancelled) {
                    setBrands(data);
                    setShowBrandRail((data?.length || 0) > 0);
                }
            } catch (err) {
                console.error('Failed to fetch brands:', err);
                if (!cancelled) {
                    setBrands([]);
                    setShowBrandRail(false);
                }
            } finally {
                if (!cancelled) {
                    setLoadingBrands(false);
                }
            }
        };

        const scheduleFetch = () => {
            timeoutId = window.setTimeout(fetchBrands, 800);
        };

        if ('requestIdleCallback' in window) {
            idleId = window.requestIdleCallback(scheduleFetch, { timeout: 2000 });
        } else {
            scheduleFetch();
        }

        return () => {
            cancelled = true;
            window.clearTimeout(timeoutId);
            if (idleId) window.cancelIdleCallback(idleId);
        };
    }, []);

    const handleBackToSubcategories = () => {
        setSelectedSubcategory(null);
        setSelectedFilterSubcategories([]);
        setShowSubcategoryView(true);
    };

    const handleBrandFilterChange = (brands) => {
        setSelectedBrands(brands);
        setShowSubcategoryView(false);
    };

    const handleSubcategoryFilterChange = (subcategories) => {
        setSelectedSubcategory(null);
        setSelectedFilterSubcategories(subcategories);
        setShowSubcategoryView(false);
    };

    const handleTagFilterChange = (tags) => {
        setSelectedTags(tags);
        setShowSubcategoryView(false);
    };

    const clearAllFilters = () => {
        setSelectedBrands([]);
        setSelectedSubcategory(null);
        setSelectedFilterSubcategories([]);
        setSelectedTags([]);
        setShowSubcategoryView(false);
    };

    const navigateToCategory = (categoryId, subcategoryId) => {
        setSearchQuery('');
        setSelectedBrands([]);
        setSelectedFilterSubcategories([]);
        setSelectedTags([]);
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

    const filteredProducts = useMemo(() => {
        return products.filter(product => {
            const query = searchQuery.toLowerCase().trim();
            const productBrandNames = getProductBrandNames(product);
            const matchesSearch = !query || (
                (product.name || '').toLowerCase().includes(query) ||
                (product.sku || '').toLowerCase().includes(query) ||
                productBrandNames.some(brand => brand.includes(query)) ||
                (product.description || '').toLowerCase().includes(query) ||
                (product.category_name || '').toLowerCase().includes(query) ||
                (product.subcategory_name || '').toLowerCase().includes(query) ||
                (product.key_features || '').toLowerCase().includes(query)
            );
            const matchesCategory = selectedCategory === 'all' || String(getProductCategoryId(product)) === String(selectedCategory);
            const matchesSubcategory = activeFilterSubcategories.length === 0 ||
                activeFilterSubcategories.some(subcategoryId => String(getProductSubcategoryId(product)) === String(subcategoryId));
            const matchesBrand = selectedBrands.length === 0 ||
                selectedBrands.some(brand => productBrandNames.includes(String(brand).toLowerCase()));

            // Tag logic: OR within group, AND across groups
            let matchesTags = true;
            if (selectedTags.length > 0 && filterOptions?.tag_groups) {
                // 1. Group selected tags by their TagGroup
                const selectedGroups = {};
                for (const tagId of selectedTags) {
                    // Find which group this tag belongs to
                    const group = filterOptions.tag_groups.find(g => g.tags.some(t => t.id === tagId));
                    if (group) {
                        if (!selectedGroups[group.id]) selectedGroups[group.id] = [];
                        selectedGroups[group.id].push(tagId);
                    }
                }
                
                // 2. Check each group
                const productTagIds = (product.tag_list || []).map(t => t.id);
                for (const groupId in selectedGroups) {
                    const groupSelectedTagIds = selectedGroups[groupId];
                    // Product must have AT LEAST ONE tag from this group (OR logic within group)
                    const hasTagFromGroup = groupSelectedTagIds.some(tagId => productTagIds.includes(tagId));
                    if (!hasTagFromGroup) {
                        matchesTags = false;
                        break; // Failed AND condition across groups
                    }
                }
            }

            return matchesSearch && matchesCategory && matchesSubcategory && matchesBrand && matchesTags;
        });
    }, [products, searchQuery, selectedCategory, activeFilterSubcategories, selectedBrands, selectedTags, filterOptions]);

    const productsByCategory = useMemo(() => {
        const groups = new Map();

        products.forEach((product) => {
            const categoryId = String(getProductCategoryId(product) || '');
            if (!categoryId) return;

            if (!groups.has(categoryId)) {
                groups.set(categoryId, []);
            }
            groups.get(categoryId).push(product);
        });

        return groups;
    }, [products]);

    const brandKeysByCategory = useMemo(() => {
        const groups = new Map();

        products.forEach((product) => {
            const categoryId = String(getProductCategoryId(product) || '');
            if (!categoryId) return;

            if (!groups.has(categoryId)) {
                groups.set(categoryId, new Set());
            }

            const keys = groups.get(categoryId);
            if (product.brand_id) keys.add(`id:${product.brand_id}`);
            if (typeof product.brand === 'object' && product.brand?.id) keys.add(`id:${product.brand.id}`);
            if (typeof product.brand === 'number') keys.add(`id:${product.brand}`);
            getProductBrandNames(product).forEach(name => keys.add(`name:${name}`));
        });

        return groups;
    }, [products]);

    const visibleBrands = useMemo(() => {
        const currentCategoryBrandKeys = selectedCategory === 'all'
            ? null
            : brandKeysByCategory.get(String(selectedCategory));

        return brands.filter(brand => {
            if (selectedCategory === 'all') return true;
            if (!currentCategoryBrandKeys) return false;

            return currentCategoryBrandKeys.has(`id:${brand.id}`) ||
                currentCategoryBrandKeys.has(`name:${brand.name.toLowerCase()}`);
        });
    }, [brands, selectedCategory, brandKeysByCategory]);

    const currentCategoryName = categories.find(c => c.id === selectedCategory)?.name || 'All Products';
    const activeSubcategory = subcategories.find(s => s.id === selectedSubcategory);

    if (loading) {
        return (
            <>
                {/* Desktop Search Portal Skeleton */}
                {document.getElementById('desktop-search-container') && createPortal(
                    <div className="flex items-center bg-gray-100 rounded-lg px-3 py-2 w-full animate-pulse">
                        <div className="w-5 h-5 bg-gray-200 rounded-full flex-shrink-0"></div>
                        <div className="flex-1 ml-2 h-5 bg-gray-200 rounded w-32"></div>
                    </div>,
                    document.getElementById('desktop-search-container')
                )}

                {/* Mobile Search + Category Tabs Skeleton */}
                {document.getElementById('header-extension') && createPortal(
                    <div className="px-3 sm:px-4 pb-2 pt-1 bg-white sm:hidden animate-pulse">
                        <div className="h-10 bg-gray-100 rounded-lg mb-2"></div>
                        <div className="flex gap-2 overflow-hidden pb-1">
                            {[1, 2, 3, 4, 5].map(i => (
                                <div key={i} className="h-9 w-24 bg-gray-100 rounded-lg flex-shrink-0"></div>
                            ))}
                        </div>
                    </div>,
                    document.getElementById('header-extension')
                )}

                <div className="animate-pulse mt-2 sm:mt-4">
                    {/* Skeleton Brand Row */}
                    <div className="mb-6">
                        <div className="h-5 w-32 bg-gray-200 rounded mb-3"></div>
                        <div className="flex gap-3 overflow-hidden">
                            {[1, 2, 3, 4, 5, 6].map(i => (
                                <div key={i} className="w-20 h-20 sm:w-24 sm:h-24 bg-gray-200 rounded-xl flex-shrink-0"></div>
                            ))}
                        </div>
                    </div>

                    {/* Skeleton Product Cards */}
                    <div className="h-5 w-28 bg-gray-200 rounded mb-3"></div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => (
                            <div key={i} className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
                                <div className="h-32 sm:h-40 bg-gray-200 rounded-lg mb-3"></div>
                                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                                <div className="h-3 bg-gray-200 rounded w-1/2 mb-3"></div>
                                <div className="h-6 bg-gray-200 rounded w-1/3"></div>
                            </div>
                        ))}
                    </div>

                    {/* Loading message */}
                    <div className="text-center mt-6">
                        <div className="inline-flex items-center gap-2 text-gray-500 text-sm">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-emerald-600"></div>
                            Loading Anantamart...
                        </div>
                    </div>
                </div>
            </>
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
            <>
                <Suspense fallback={<ViewFallback />}>
                    <BrandPage
                        brand={selectedBrand}
                        allProducts={products}
                        onBack={() => setSelectedBrand(null)}
                        onProductClick={(product) => selectProduct(product)}
                        onAddToCart={addToCart}
                        updateQuantity={updateQuantity}
                    />
                </Suspense>
                {selectedProduct && (
                    <Suspense fallback={null}>
                        <ProductDetail
                            product={selectedProduct}
                            onClose={() => setSelectedProduct(null)}
                            onAddToCart={addToCart}
                            onBrandClick={(brandName, brandId) => {
                                setSelectedProduct(null);
                                const brand = brands.find(b => String(b.id) === String(brandId) || b.name === brandName);
                                if (brand) {
                                    selectBrand(brand);
                                    setShowSubcategoryView(false);
                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                }
                            }}
                        />
                    </Suspense>
                )}
            </>
        );
    }

    // If showing all brands view
    if (showAllBrands) {
        return (
            <Suspense fallback={<ViewFallback />}>
                <AllBrands
                    brands={brands}
                    onBrandClick={(brand) => { selectBrand(brand); setShowAllBrands(false); }}
                    onBack={() => setShowAllBrands(false)}
                />
            </Suspense>
        );
    }

    const isProductView = selectedCategory !== 'all' && !showSubcategoryView && !searchQuery;

    return (
        <>
            {/* Desktop Search Portal (rendered into Layout header) */}
            {document.getElementById('desktop-search-container') && createPortal(
                <div className="flex items-center bg-gray-100 rounded-lg px-3 py-2 w-full">
                    <Search className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    <input
                        type="text"
                        placeholder="Search products..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="flex-1 ml-2 bg-transparent outline-none text-base min-w-0"
                        autoFocus={false}
                    />
                </div>,
                document.getElementById('desktop-search-container')
            )}

            {/* Mobile Search + Category Tabs - rendered inside header via portal */}
            {document.getElementById('header-extension') && createPortal(
                <div className="px-3 sm:px-4 pb-2 pt-1 bg-white sm:hidden">
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

                    {/* Category Tabs - Hidden when viewing products to make room for left sidebar */}
                    <div className={`flex gap-2 overflow-x-auto pb-1 scrollbar-hide ${isProductView ? 'hidden sm:flex' : ''}`}>
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
                                    <span>{category.short_name || category.name}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>,
                document.getElementById('header-extension')
            )}

            {/* Brand Horizontal Scroll */}
            {!selectedSubcategory && showBrandRail && visibleBrands.length > 0 && (
                <div className="mb-8">
                    <div className="flex items-center justify-between mb-3 px-1">
                        <h3 className="text-base sm:text-lg font-bold text-gray-800">
                            Browse by Brand
                        </h3>
                        <button
                            onClick={() => openAllBrands()}
                            className="text-xs sm:text-sm font-medium text-emerald-600 hover:text-emerald-700 transition-colors flex items-center gap-1"
                        >
                            View All <span className="text-lg">›</span>
                        </button>
                    </div>
                    <BrandGrid
                        brands={visibleBrands}
                        onBrandClick={(brand) => selectBrand(brand)}
                        isLoading={loadingBrands}
                    />
                </div>
            )}

            {/* Page Title */}
            <div className="mb-3 sm:mb-4 px-1 flex items-start justify-between gap-3">
                <div className="min-w-0">
                    {searchQuery ? (
                        <h2 className="text-base sm:text-lg font-bold text-gray-800">
                            Search Results for "{searchQuery}"
                            <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded-full border border-gray-200">
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

                {selectedCategory !== 'all' && (
                    <button
                        onClick={() => setMobileFiltersOpen(true)}
                        className="lg:hidden inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-sm active:bg-emerald-700"
                    >
                        <FilterIcon className="w-4 h-4" />
                        <span>Filters</span>
                        {(selectedBrands.length + activeFilterSubcategories.length + selectedTags.length) > 0 && (
                            <span className="bg-white text-emerald-700 rounded-full px-1.5 py-0.5 text-[10px] leading-none">
                                {selectedBrands.length + activeFilterSubcategories.length + selectedTags.length}
                            </span>
                        )}
                    </button>
                )}
            </div>

            <div className="lg:hidden">
                <FilterSidebar
                    categoryId={selectedCategory}
                    filterOptions={filterOptions}
                    selectedBrands={selectedBrands}
                    selectedSubcategories={activeFilterSubcategories}
                    selectedTags={selectedTags}
                    onBrandChange={handleBrandFilterChange}
                    onSubcategoryChange={handleSubcategoryFilterChange}
                    onTagChange={handleTagFilterChange}
                    onClearAll={clearAllFilters}
                    isLoading={loadingFilters}
                    isMobile
                    isOpen={mobileFiltersOpen}
                    onToggle={() => setMobileFiltersOpen(open => !open)}
                />
            </div>

            {/* Subcategory Grid */}
            {selectedCategory !== 'all' && showSubcategoryView && subcategories.length > 0 && !searchQuery && (
                <div className="mb-6">
                    <div className="flex gap-4 items-start">
                        <div className="hidden lg:block">
                            <FilterSidebar
                                categoryId={selectedCategory}
                                filterOptions={filterOptions}
                                selectedBrands={selectedBrands}
                                selectedSubcategories={activeFilterSubcategories}
                                selectedTags={selectedTags}
                                onBrandChange={handleBrandFilterChange}
                                onSubcategoryChange={handleSubcategoryFilterChange}
                                onTagChange={handleTagFilterChange}
                                onClearAll={clearAllFilters}
                                isLoading={loadingFilters}
                            />
                        </div>

                        <div className="flex-1 min-w-0">
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
                                    selectSubcategory(subcat.id);
                                }}
                                isLoading={loadingSubcategories}
                            />
                        </div>
                    </div>
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
                                    const categoryProducts = productsByCategory.get(String(category.id)) || [];

                                    if (categoryProducts.length === 0 && !loadingMore) return null;

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
                                                {categoryProducts.length === 0 && loadingMore && [1, 2, 3, 4].map((item) => (
                                                    <div key={item} className="flex-shrink-0 w-[160px] sm:w-[200px] snap-start">
                                                        <div className="h-[278px] sm:h-[326px] rounded-lg sm:rounded-xl bg-white shadow-sm overflow-hidden animate-pulse">
                                                            <div className="h-[120px] sm:h-[150px] bg-gray-100"></div>
                                                            <div className="p-3 space-y-2">
                                                                <div className="h-6 w-20 rounded bg-gray-100"></div>
                                                                <div className="h-4 w-full rounded bg-gray-100"></div>
                                                                <div className="h-4 w-3/4 rounded bg-gray-100"></div>
                                                                <div className="h-3 w-24 rounded bg-gray-100"></div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                                {categoryProducts.slice(0, 8).map((product, index) => (
                                                    <div key={product.id} className="flex-shrink-0 w-[160px] sm:w-[200px] snap-start">
                                                        <ProductCard
                                                            product={product}
                                                            cart={cart}
                                                            removeFromCart={removeFromCart}
                                                            updateQuantity={updateQuantity}
                                                            onAddToCart={addToCart}
                                                            onViewDetails={() => setSelectedProduct(product)}
                                                            onNavigateToCategory={navigateToCategory}
                                                            priority={false}
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
                        <div className={isProductView ? "flex h-[calc(100vh-130px)] sm:h-auto -mx-3 sm:mx-0 sm:block" : ""}>
                            {/* Mobile Left Sidebar (Only visible in product view) */}
                            {isProductView && (
                                <div className="w-[80px] flex-shrink-0 bg-[#f3f4f6] overflow-y-auto hide-scrollbar sm:hidden h-full border-r border-gray-200">
                                    <CategoryDirectory 
                                        categories={categories} 
                                        layout="vertical"
                                        selectedCategory={selectedCategory}
                                        onSelectCategory={(id) => {
                                            setSelectedCategory(id);
                                            setSelectedBrand(null);
                                            setSelectedSubcategory(null);
                                            setShowSubcategoryView(true);
                                            window.scrollTo({ top: 0, behavior: 'smooth' });
                                        }}
                                    />
                                </div>
                            )}

                            {/* Main Content / Product Grid */}
                            <div className={isProductView ? "flex-1 overflow-y-auto h-full sm:h-auto sm:overflow-visible bg-white relative" : ""}>
                                {/* Sticky Filter Header for Mobile */}
                                {isProductView && (
                                    <div className="sticky top-0 bg-white z-20 px-2 py-2 border-b border-gray-100 sm:hidden flex items-center gap-2 overflow-x-auto hide-scrollbar">
                                        <button 
                                            onClick={() => setMobileFiltersOpen(true)}
                                            className="flex items-center gap-1 border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-700 whitespace-nowrap bg-white shadow-sm"
                                        >
                                            <FilterIcon className="w-3.5 h-3.5" />
                                            Filters
                                            {(selectedBrands.length + activeFilterSubcategories.length + selectedTags.length) > 0 && (
                                                <span className="ml-1 bg-green-600 text-white rounded-full px-1.5 py-0.5 text-[9px] leading-none">
                                                    {selectedBrands.length + activeFilterSubcategories.length + selectedTags.length}
                                                </span>
                                            )}
                                        </button>
                                        <button className="flex items-center gap-1 border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-700 whitespace-nowrap bg-white shadow-sm">
                                            <span className="w-3.5 h-3.5 flex items-center justify-center">↑↓</span>
                                            Sort
                                        </button>
                                        
                                        {/* Horizontal Filter Pills */}
                                        {filterOptions?.tag_groups?.map(group => (
                                            <button key={group.id} onClick={() => setMobileFiltersOpen(true)} className="flex items-center gap-1 border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-700 whitespace-nowrap bg-white shadow-sm">
                                                {group.name}
                                                <span className="w-3 h-3 text-[10px] flex items-center justify-center">▼</span>
                                            </button>
                                        ))}
                                    </div>
                                )}

                                <div className={isProductView ? "px-3 sm:px-0 pt-3 sm:pt-0 pb-10" : ""}>
                                    <div className="flex gap-4 items-start">
                                <div className="hidden lg:block">
                                    <FilterSidebar
                                        categoryId={selectedCategory}
                                        filterOptions={filterOptions}
                                        selectedBrands={selectedBrands}
                                        selectedSubcategories={activeFilterSubcategories}
                                        onBrandChange={handleBrandFilterChange}
                                        onSubcategoryChange={handleSubcategoryFilterChange}
                                        onClearAll={clearAllFilters}
                                        isLoading={loadingFilters}
                                    />
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3 md:gap-4 pb-4">
                                        {filteredProducts.map((product, index) => (
                                            <ProductCard
                                                key={product.id}
                                                product={product}
                                                cart={cart}
                                                removeFromCart={removeFromCart}
                                                updateQuantity={updateQuantity}
                                                onAddToCart={addToCart}
                                                onViewDetails={() => selectProduct(product)}
                                                onNavigateToCategory={navigateToCategory}
                                                priority={index < 4}
                                            />
                                        ))}
                                    </div>

                                    {filteredProducts.length === 0 && (
                                        <div className="text-center py-12 sm:py-16">
                                            <Package className="w-12 h-12 sm:w-16 sm:h-16 text-gray-300 mx-auto mb-3" />
                                            <p className="text-sm sm:text-base text-gray-500">No products found</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Product Detail Modal */}
            {selectedProduct && (
                <Suspense fallback={null}>
                    <ProductDetail
                        product={selectedProduct}
                        onClose={() => setSelectedProduct(null)}
                        onAddToCart={addToCart}
                        onBrandClick={(brandName, brandId) => {
                            setSelectedProduct(null);
                            const brand = brands.find(b => String(b.id) === String(brandId) || b.name === brandName);
                            if (brand) {
                                selectBrand(brand);
                                setShowSubcategoryView(false);
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                            }
                        }}
                    />
                </Suspense>
            )}
        </>
    );
}
