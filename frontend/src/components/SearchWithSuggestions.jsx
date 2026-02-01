import { useState, useEffect, useRef } from 'react';
import { Search, X, Package, TrendingUp, ArrowLeft } from 'lucide-react';

export default function SearchWithSuggestions({
    products,
    searchQuery,
    setSearchQuery,
    onProductSelect,
    onSearch
}) {
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [suggestions, setSuggestions] = useState([]);
    const [recentSearches, setRecentSearches] = useState([]);
    const [isMobileExpanded, setIsMobileExpanded] = useState(false);
    const inputRef = useRef(null);
    const containerRef = useRef(null);

    // Load recent searches from localStorage
    useEffect(() => {
        const saved = localStorage.getItem('recentSearches');
        if (saved) {
            setRecentSearches(JSON.parse(saved));
        }
    }, []);

    // Filter products based on search query
    useEffect(() => {
        if (searchQuery.trim().length >= 2 && products) {
            const query = searchQuery.toLowerCase();
            const filtered = products
                .filter(p =>
                    p.name?.toLowerCase().includes(query) ||
                    p.brand?.toLowerCase().includes(query) ||
                    p.sku?.toLowerCase().includes(query) ||
                    p.category_name?.toLowerCase().includes(query)
                )
                .slice(0, 8);
            setSuggestions(filtered);
        } else {
            setSuggestions([]);
        }
    }, [searchQuery, products]);

    // Close suggestions when clicking outside (desktop only)
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Handle body scroll lock on mobile
    useEffect(() => {
        if (isMobileExpanded) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isMobileExpanded]);

    const handleFocus = () => {
        setShowSuggestions(true);
        // On mobile, expand to fullscreen
        if (window.innerWidth < 640) {
            setIsMobileExpanded(true);
        }
    };

    const handleClose = () => {
        setShowSuggestions(false);
        setIsMobileExpanded(false);
        setSearchQuery('');
        inputRef.current?.blur();
    };

    const handleSelectProduct = (product) => {
        const updated = [product.name, ...recentSearches.filter(s => s !== product.name)].slice(0, 5);
        setRecentSearches(updated);
        localStorage.setItem('recentSearches', JSON.stringify(updated));

        setShowSuggestions(false);
        setIsMobileExpanded(false);
        setSearchQuery('');
        if (onProductSelect) {
            onProductSelect(product);
        }
    };

    const handleSearch = (query) => {
        if (query.trim()) {
            const updated = [query, ...recentSearches.filter(s => s !== query)].slice(0, 5);
            setRecentSearches(updated);
            localStorage.setItem('recentSearches', JSON.stringify(updated));
        }
        setShowSuggestions(false);
        setIsMobileExpanded(false);
        if (onSearch) {
            onSearch(query);
        }
    };

    const handleRecentClick = (term) => {
        setSearchQuery(term);
    };

    const clearSearch = () => {
        setSearchQuery('');
        setSuggestions([]);
        inputRef.current?.focus();
    };

    // Mobile fullscreen search
    if (isMobileExpanded) {
        return (
            <div className="fixed inset-0 bg-white z-[100] flex flex-col">
                {/* Mobile Search Header */}
                <div className="flex items-center gap-3 p-3 border-b border-gray-200 bg-white">
                    <button
                        onClick={handleClose}
                        className="p-2 -ml-1 hover:bg-gray-100 rounded-full transition-colors touch-manipulation"
                    >
                        <ArrowLeft className="w-5 h-5 text-gray-600" />
                    </button>
                    <div className="flex-1 relative">
                        <input
                            ref={inputRef}
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    handleSearch(searchQuery);
                                }
                            }}
                            placeholder="Search products, brands..."
                            className="w-full py-2.5 px-4 bg-gray-100 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            autoFocus
                        />
                        {searchQuery && (
                            <button
                                onClick={clearSearch}
                                className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1.5 hover:bg-gray-200 rounded-full"
                            >
                                <X className="w-4 h-4 text-gray-500" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Mobile Suggestions List */}
                <div className="flex-1 overflow-y-auto">
                    {/* Recent Searches */}
                    {!searchQuery && recentSearches.length > 0 && (
                        <div className="p-4 border-b border-gray-100">
                            <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
                                <TrendingUp className="w-4 h-4" />
                                <span className="font-medium">Recent Searches</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {recentSearches.map((term, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => handleRecentClick(term)}
                                        className="px-4 py-2.5 bg-gray-100 active:bg-emerald-100 rounded-full text-sm font-medium transition-colors touch-manipulation"
                                    >
                                        {term}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Product Suggestions */}
                    {suggestions.length > 0 && (
                        <div className="divide-y divide-gray-100">
                            {suggestions.map((product) => (
                                <button
                                    key={product.id}
                                    onClick={() => handleSelectProduct(product)}
                                    className="w-full p-4 flex items-center gap-4 active:bg-gray-50 transition-colors text-left touch-manipulation"
                                >
                                    {/* Product Image */}
                                    <div className="w-16 h-16 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden">
                                        {product.image ? (
                                            <img
                                                src={product.image}
                                                alt={product.name}
                                                className="w-full h-full object-contain p-1"
                                            />
                                        ) : (
                                            <Package className="w-8 h-8 text-gray-300" />
                                        )}
                                    </div>

                                    {/* Product Info */}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-base font-medium text-gray-800 line-clamp-2">
                                            {product.name}
                                        </p>
                                        <p className="text-sm text-gray-500 mt-0.5">
                                            {product.brand && <span>{product.brand} • </span>}
                                            {product.category_name}
                                        </p>
                                        <p className="text-base font-bold text-emerald-600 mt-1">
                                            ₹{parseFloat(product.base_price).toFixed(0)}
                                        </p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}

                    {/* No Results */}
                    {searchQuery.length >= 2 && suggestions.length === 0 && (
                        <div className="p-8 text-center">
                            <Package className="w-16 h-16 text-gray-200 mx-auto mb-4" />
                            <p className="text-gray-500">No products found</p>
                            <p className="text-sm text-gray-400 mt-1">Try a different search term</p>
                        </div>
                    )}

                    {/* Empty State */}
                    {!searchQuery && recentSearches.length === 0 && (
                        <div className="p-8 text-center">
                            <Search className="w-16 h-16 text-gray-200 mx-auto mb-4" />
                            <p className="text-gray-500">Search for products</p>
                            <p className="text-sm text-gray-400 mt-1">By name, brand, or category</p>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // Desktop view
    return (
        <div ref={containerRef} className="relative w-full">
            {/* Search Input */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                    ref={inputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={handleFocus}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            handleSearch(searchQuery);
                        }
                    }}
                    placeholder="Search products, brands, SKUs..."
                    className="w-full pl-10 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                />
                {searchQuery && (
                    <button
                        onClick={clearSearch}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-200 rounded-full transition-colors"
                    >
                        <X className="w-4 h-4 text-gray-400" />
                    </button>
                )}
            </div>

            {/* Desktop Suggestions Dropdown */}
            {showSuggestions && (suggestions.length > 0 || recentSearches.length > 0) && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-100 z-50 max-h-[70vh] overflow-y-auto">

                    {/* Recent Searches */}
                    {!searchQuery && recentSearches.length > 0 && (
                        <div className="p-3 border-b border-gray-100">
                            <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                                <TrendingUp className="w-3 h-3" />
                                <span>Recent Searches</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {recentSearches.map((term, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => handleRecentClick(term)}
                                        className="px-3 py-1.5 bg-gray-100 hover:bg-emerald-50 hover:text-emerald-700 rounded-full text-xs font-medium transition-colors"
                                    >
                                        {term}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Product Suggestions */}
                    {suggestions.length > 0 && (
                        <div className="py-2">
                            {suggestions.map((product) => (
                                <button
                                    key={product.id}
                                    onClick={() => handleSelectProduct(product)}
                                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
                                >
                                    {/* Product Image */}
                                    <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                                        {product.image ? (
                                            <img
                                                src={product.image}
                                                alt={product.name}
                                                className="w-full h-full object-contain p-1"
                                            />
                                        ) : (
                                            <Package className="w-6 h-6 text-gray-300" />
                                        )}
                                    </div>

                                    {/* Product Info */}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-800 truncate">
                                            {product.name}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            {product.brand && <span>{product.brand} • </span>}
                                            {product.category_name}
                                        </p>
                                    </div>

                                    {/* Price */}
                                    <div className="text-right flex-shrink-0">
                                        <p className="text-sm font-bold text-emerald-600">
                                            ₹{parseFloat(product.base_price).toFixed(0)}
                                        </p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}

                    {/* No Results */}
                    {searchQuery.length >= 2 && suggestions.length === 0 && (
                        <div className="p-6 text-center">
                            <Package className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                            <p className="text-sm text-gray-500">No products found for "{searchQuery}"</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
