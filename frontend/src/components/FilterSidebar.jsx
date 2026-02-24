import { useState, useEffect } from 'react';
import { X, Filter, ChevronDown, ChevronUp } from 'lucide-react';

/**
 * FilterSidebar Component
 * Displays brand and subcategory filters with product counts
 * Supports multiple selections and dynamic filtering
 */
export default function FilterSidebar({
    categoryId,
    filterOptions,
    selectedBrands,
    selectedSubcategories,
    onBrandChange,
    onSubcategoryChange,
    onClearAll,
    isLoading,
    isMobile = false,
    isOpen = true,
    onToggle
}) {
    const [expandedSections, setExpandedSections] = useState({
        brands: true,
        subcategories: true
    });

    const toggleSection = (section) => {
        setExpandedSections(prev => ({
            ...prev,
            [section]: !prev[section]
        }));
    };

    const handleBrandToggle = (brandName) => {
        if (selectedBrands.includes(brandName)) {
            onBrandChange(selectedBrands.filter(b => b !== brandName));
        } else {
            onBrandChange([...selectedBrands, brandName]);
        }
    };

    const handleSubcategoryToggle = (subcategoryId) => {
        if (selectedSubcategories.includes(subcategoryId)) {
            onSubcategoryChange(selectedSubcategories.filter(s => s !== subcategoryId));
        } else {
            onSubcategoryChange([...selectedSubcategories, subcategoryId]);
        }
    };

    const hasActiveFilters = selectedBrands.length > 0 || selectedSubcategories.length > 0;

    // Don't render if no category is selected
    if (!categoryId || categoryId === 'all') {
        return null;
    }

    // Mobile: Collapsible overlay
    if (isMobile) {
        if (!isOpen) {
            return (
                <button
                    onClick={onToggle}
                    className="fixed bottom-20 right-4 bg-emerald-600 text-white p-3 rounded-full shadow-lg z-40 flex items-center gap-2"
                >
                    <Filter className="w-5 h-5" />
                    {hasActiveFilters && (
                        <span className="bg-white text-emerald-600 text-xs font-bold px-2 py-0.5 rounded-full">
                            {selectedBrands.length + selectedSubcategories.length}
                        </span>
                    )}
                </button>
            );
        }

        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 z-50" onClick={onToggle}>
                <div
                    className="absolute right-0 top-0 bottom-0 w-80 max-w-[85vw] bg-white shadow-xl overflow-y-auto"
                    onClick={(e) => e.stopPropagation()}
                >
                    <FilterContent
                        filterOptions={filterOptions}
                        selectedBrands={selectedBrands}
                        selectedSubcategories={selectedSubcategories}
                        handleBrandToggle={handleBrandToggle}
                        handleSubcategoryToggle={handleSubcategoryToggle}
                        expandedSections={expandedSections}
                        toggleSection={toggleSection}
                        hasActiveFilters={hasActiveFilters}
                        onClearAll={onClearAll}
                        isLoading={isLoading}
                        onClose={onToggle}
                        isMobile={true}
                    />
                </div>
            </div>
        );
    }

    // Desktop: Sidebar
    return (
        <div className="w-64 flex-shrink-0">
            <div className="sticky top-24 bg-white rounded-xl shadow-md overflow-hidden">
                <FilterContent
                    filterOptions={filterOptions}
                    selectedBrands={selectedBrands}
                    selectedSubcategories={selectedSubcategories}
                    handleBrandToggle={handleBrandToggle}
                    handleSubcategoryToggle={handleSubcategoryToggle}
                    expandedSections={expandedSections}
                    toggleSection={toggleSection}
                    hasActiveFilters={hasActiveFilters}
                    onClearAll={onClearAll}
                    isLoading={isLoading}
                    isMobile={false}
                />
            </div>
        </div>
    );
}

// Shared filter content component
function FilterContent({
    filterOptions,
    selectedBrands,
    selectedSubcategories,
    handleBrandToggle,
    handleSubcategoryToggle,
    expandedSections,
    toggleSection,
    hasActiveFilters,
    onClearAll,
    isLoading,
    onClose,
    isMobile
}) {
    return (
        <>
            {/* Header */}
            <div className="bg-emerald-600 text-white p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Filter className="w-5 h-5" />
                    <h3 className="font-bold text-lg">Filters</h3>
                </div>
                {isMobile && (
                    <button onClick={onClose} className="p-1 hover:bg-emerald-700 rounded">
                        <X className="w-5 h-5" />
                    </button>
                )}
            </div>

            {/* Active Filters & Clear All */}
            {hasActiveFilters && (
                <div className="p-4 bg-emerald-50 border-b border-emerald-100">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold text-emerald-800">
                            Active Filters ({selectedBrands.length + selectedSubcategories.length})
                        </span>
                        <button
                            onClick={onClearAll}
                            className="text-xs text-red-600 hover:text-red-700 font-medium"
                        >
                            Clear All
                        </button>
                    </div>

                    {/* Selected Brands */}
                    {selectedBrands.map(brand => (
                        <div
                            key={brand}
                            className="inline-flex items-center gap-1 bg-white border border-emerald-200 rounded-full px-2 py-1 mr-2 mb-2 text-xs"
                        >
                            <span className="text-gray-700">{brand}</span>
                            <button
                                onClick={() => handleBrandToggle(brand)}
                                className="text-gray-500 hover:text-red-600"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                    ))}

                    {/* Selected Subcategories */}
                    {selectedSubcategories.map(subId => {
                        const sub = filterOptions?.subcategories?.find(s => s.id === subId);
                        return sub ? (
                            <div
                                key={subId}
                                className="inline-flex items-center gap-1 bg-white border border-emerald-200 rounded-full px-2 py-1 mr-2 mb-2 text-xs"
                            >
                                <span className="text-gray-700">{sub.name}</span>
                                <button
                                    onClick={() => handleSubcategoryToggle(subId)}
                                    className="text-gray-500 hover:text-red-600"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        ) : null;
                    })}
                </div>
            )}

            {/* Filter Sections */}
            <div className="p-4 space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
                {isLoading ? (
                    <div className="space-y-4">
                        <FilterSkeleton />
                        <FilterSkeleton />
                    </div>
                ) : (
                    <>
                        {/* Subcategories Filter */}
                        {filterOptions?.subcategories && filterOptions.subcategories.length > 0 && (
                            <div className="border-b border-gray-200 pb-4">
                                <button
                                    onClick={() => toggleSection('subcategories')}
                                    className="w-full flex items-center justify-between mb-3 text-left"
                                >
                                    <h4 className="font-bold text-gray-800">Subcategories</h4>
                                    {expandedSections.subcategories ? (
                                        <ChevronUp className="w-4 h-4 text-gray-500" />
                                    ) : (
                                        <ChevronDown className="w-4 h-4 text-gray-500" />
                                    )}
                                </button>

                                {expandedSections.subcategories && (
                                    <div className="space-y-2 max-h-60 overflow-y-auto">
                                        {filterOptions.subcategories.map(subcategory => (
                                            <label
                                                key={subcategory.id}
                                                className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded transition-colors"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={selectedSubcategories.includes(subcategory.id)}
                                                    onChange={() => handleSubcategoryToggle(subcategory.id)}
                                                    className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                                                />
                                                <span className="flex-1 text-sm text-gray-700">
                                                    {subcategory.name}
                                                </span>
                                                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                                                    {subcategory.count}
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Brands Filter */}
                        {filterOptions?.brands && filterOptions.brands.length > 0 && (
                            <div className="pb-4">
                                <button
                                    onClick={() => toggleSection('brands')}
                                    className="w-full flex items-center justify-between mb-3 text-left"
                                >
                                    <h4 className="font-bold text-gray-800">Brands</h4>
                                    {expandedSections.brands ? (
                                        <ChevronUp className="w-4 h-4 text-gray-500" />
                                    ) : (
                                        <ChevronDown className="w-4 h-4 text-gray-500" />
                                    )}
                                </button>

                                {expandedSections.brands && (
                                    <div className="space-y-2 max-h-60 overflow-y-auto">
                                        {filterOptions.brands.map(brand => (
                                            <label
                                                key={brand.name}
                                                className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded transition-colors"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={selectedBrands.includes(brand.name)}
                                                    onChange={() => handleBrandToggle(brand.name)}
                                                    className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                                                />
                                                <span className="flex-1 text-sm text-gray-700">
                                                    {brand.name}
                                                </span>
                                                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                                                    {brand.count}
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* No Filters Available */}
                        {(!filterOptions?.brands || filterOptions.brands.length === 0) &&
                            (!filterOptions?.subcategories || filterOptions.subcategories.length === 0) && (
                                <div className="text-center py-8 text-gray-500">
                                    <Filter className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                                    <p className="text-sm">No filters available</p>
                                </div>
                            )}
                    </>
                )}
            </div>
        </>
    );
}

// Loading skeleton
function FilterSkeleton() {
    return (
        <div className="animate-pulse">
            <div className="h-5 bg-gray-200 rounded w-24 mb-3"></div>
            <div className="space-y-2">
                {[1, 2, 3].map(i => (
                    <div key={i} className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-gray-200 rounded"></div>
                        <div className="h-4 bg-gray-200 rounded flex-1"></div>
                        <div className="h-4 bg-gray-200 rounded w-8"></div>
                    </div>
                ))}
            </div>
        </div>
    );
}
