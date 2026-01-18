import React from 'react';

const BrandGrid = ({ brands, onBrandClick, isLoading }) => {
    // Loading Skeleton (Horizontal)
    if (isLoading) {
        return (
            <div className="flex gap-4 overflow-hidden py-2">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="w-20 h-20 sm:w-24 sm:h-24 bg-gray-100 rounded-xl animate-pulse flex-shrink-0" />
                ))}
            </div>
        );
    }

    if (!brands || brands.length === 0) return null;

    return (
        // HORIZONTAL SCROLL CONTAINER
        // flex-nowrap: prevents wrapping to next line
        // overflow-x-auto: enables horizontal scrolling
        // scrollbar-hide: clean look (requires tailwind plugin, or standard CSS)
        <div className="flex flex-nowrap overflow-x-auto gap-3 sm:gap-4 pb-4 -mx-1 px-1 snap-x scrollbar-hide">
            {brands.map((brand) => (
                <div
                    key={brand.id}
                    onClick={() => onBrandClick(brand)}
                    className="group flex flex-col items-center cursor-pointer flex-shrink-0 snap-start"
                >
                    {/* COMPACT BOX */}
                    <div className="w-20 h-20 sm:w-24 sm:h-24 bg-white border border-gray-200 rounded-xl flex items-center justify-center p-3 shadow-sm transition-all duration-200 group-hover:shadow-md group-hover:border-emerald-500 group-hover:-translate-y-1">
                        <img
                            src={brand.logo || "/api/placeholder/100/100"}
                            alt={brand.name}
                            className="w-full h-full object-contain filter group-hover:brightness-105"
                            loading="lazy"
                        />
                    </div>

                    {/* LABEL */}
                    <span className="mt-2 text-[10px] sm:text-xs font-medium text-gray-600 text-center truncate w-20 sm:w-24 px-1 group-hover:text-emerald-700">
                        {brand.name}
                    </span>
                </div>
            ))}
        </div>
    );
};

export default BrandGrid;