import React from 'react';
import { Package } from 'lucide-react';

/**
 * SubcategoryGrid Component (Compact Version)
 * Displays subcategories as small, clickable squares
 */
export default function SubcategoryGrid({
    subcategories,
    onSubcategoryClick,
    isLoading = false
}) {
    // Loading Skeleton
    if (isLoading) {
        return (
            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-3 sm:gap-4 animate-pulse">
                {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                    <div key={i} className="flex flex-col items-center gap-2">
                        <div className="w-20 h-20 bg-gray-100 rounded-xl" />
                        <div className="h-3 w-16 bg-gray-100 rounded" />
                    </div>
                ))}
            </div>
        );
    }

    if (!subcategories || subcategories.length === 0) {
        return (
            <div className="text-center py-8">
                <Package className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No subcategories found</p>
            </div>
        );
    }

    return (
        // Grid Layout: 4 cols on mobile, up to 8 on desktop (Matches Brands)
        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-3 sm:gap-4">
            {subcategories.map(subcategory => (
                <div
                    key={subcategory.id}
                    onClick={() => onSubcategoryClick(subcategory)}
                    className="group flex flex-col items-center cursor-pointer"
                >
                    {/* Compact Box Container */}
                    <div className="w-20 h-20 sm:w-24 sm:h-24 bg-white border border-gray-200 rounded-xl flex items-center justify-center p-2 shadow-sm transition-all duration-200 group-hover:shadow-md group-hover:border-emerald-500 group-hover:-translate-y-1">
                        {subcategory.image_url ? (
                            <img
                                src={subcategory.image_url}
                                alt={subcategory.name}
                                className="w-full h-full object-contain rounded-lg"
                                loading="lazy"
                            />
                        ) : (
                            // Fallback Icon
                            <Package className="w-8 h-8 text-emerald-600 opacity-50" />
                        )}
                    </div>

                    {/* Compact Name Label */}
                    <span className="mt-2 text-[10px] sm:text-xs font-medium text-gray-600 text-center truncate w-full px-1 group-hover:text-emerald-700">
                        {subcategory.name}
                    </span>
                </div>
            ))}
        </div>
    );
}