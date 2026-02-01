import { useState, useEffect, useRef } from 'react';
import { Search, X, Package, TrendingUp } from 'lucide-react';

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
                .slice(0, 6);
            setSuggestions(filtered);
        } else {
            setSuggestions([]);
        }
    }, [searchQuery, products]);

    // Close suggestions when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelectProduct = (product) => {
        const updated = [product.name, ...recentSearches.filter(s => s !== product.name)].slice(0, 5);
        setRecentSearches(updated);
        localStorage.setItem('recentSearches', JSON.stringify(updated));

        setShowSuggestions(false);
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

    return (
        <div ref={containerRef} className="relative w-full">
            {/* Search Input */}
            <div className="relative">
                {/* Clickable Search Icon */}
                <button
                    type="button"
                    onClick={() => {
                        setSearchQuery('');
                        setSuggestions([]);
                        setShowSuggestions(false);
                        inputRef.current?.blur();
                    }}
                    className="absolute left-2 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-200 active:bg-gray-300 rounded-full transition-colors touch-manipulation z-10"
                >
                    <Search className="w-5 h-5 text-gray-500" />
                </button>
                <input
                    ref={inputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => setShowSuggestions(true)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            handleSearch(searchQuery);
                        }
                        if (e.key === 'Escape') {
                            setShowSuggestions(false);
                            inputRef.current?.blur();
                        }
                    }}
                    placeholder="Search products..."
                    className="w-full pl-11 pr-12 py-2.5 bg-gray-100 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                />
                {searchQuery && (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setSearchQuery('');
                            setSuggestions([]);
                            inputRef.current?.focus();
                        }}
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 p-2 hover:bg-gray-200 active:bg-gray-300 rounded-full transition-colors touch-manipulation z-10"
                    >
                        <X className="w-5 h-5 text-gray-600" />
                    </button>
                )}
            </div>

            {/* Compact Suggestions Dropdown */}
            {
                showSuggestions && (suggestions.length > 0 || (recentSearches.length > 0 && !searchQuery)) && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-lg border border-gray-200 z-50 max-h-[280px] overflow-y-auto">

                        {/* Recent Searches */}
                        {!searchQuery && recentSearches.length > 0 && (
                            <div className="p-2.5 border-b border-gray-100">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                                        <TrendingUp className="w-3 h-3" />
                                        <span>Recent</span>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setRecentSearches([]);
                                            localStorage.removeItem('recentSearches');
                                        }}
                                        className="text-[11px] text-red-500 hover:text-red-600 active:text-red-700 font-medium touch-manipulation"
                                    >
                                        Clear
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {recentSearches.map((term, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => handleRecentClick(term)}
                                            className="px-2.5 py-1.5 bg-gray-100 active:bg-emerald-100 rounded-full text-xs font-medium transition-colors touch-manipulation"
                                        >
                                            {term}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Compact Product Suggestions */}
                        {suggestions.length > 0 && (
                            <div className="py-1">
                                {suggestions.map((product) => (
                                    <button
                                        key={product.id}
                                        onClick={() => handleSelectProduct(product)}
                                        className="w-full px-3 py-2 flex items-center gap-2.5 active:bg-gray-100 transition-colors text-left touch-manipulation"
                                    >
                                        {/* Small Product Image */}
                                        <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                                            {product.image ? (
                                                <img
                                                    src={product.image}
                                                    alt={product.name}
                                                    className="w-full h-full object-contain"
                                                />
                                            ) : (
                                                <Package className="w-5 h-5 text-gray-300" />
                                            )}
                                        </div>

                                        {/* Product Info - Compact */}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-800 truncate">
                                                {product.name}
                                            </p>
                                            <p className="text-xs text-gray-500 truncate">
                                                {product.brand || product.category_name}
                                            </p>
                                        </div>

                                        {/* Price */}
                                        <p className="text-sm font-bold text-emerald-600 flex-shrink-0">
                                            ₹{parseFloat(product.base_price).toFixed(0)}
                                        </p>
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* No Results */}
                        {searchQuery.length >= 2 && suggestions.length === 0 && (
                            <div className="p-4 text-center">
                                <p className="text-sm text-gray-500">No results for "{searchQuery}"</p>
                            </div>
                        )}
                    </div>
                )
            }
        </div >
    );
}
