import React from 'react';

const BrandGrid = ({ brands, onBrandClick, isLoading }) => {
    if (isLoading) {
        return (
            <div className="flex gap-4 overflow-hidden py-2">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="w-24 h-24 bg-gray-100 rounded-lg animate-pulse flex-shrink-0" />
                ))}
            </div>
        );
    }

    if (!brands || brands.length === 0) return null;

    return (
        // Changed grid-cols to fit 4 (mobile), 6 (tablet), 8 (desktop) for a denser look
        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-3 sm:gap-4">
            {brands.map((brand) => (
                <div
                    key={brand.id}
                    onClick={() => onBrandClick(brand)}
                    className="group flex flex-col items-center cursor-pointer"
                >
                    {/* THE COMPACT BOX */}
                    {/* w-20 h-20 (80px) for mobile, w-24 h-24 (96px) for desktop */}
                    <div className="w-20 h-20 sm:w-24 sm:h-24 bg-white border border-gray-200 rounded-xl flex items-center justify-center p-2 shadow-sm transition-all duration-200 group-hover:shadow-md group-hover:border-emerald-500 group-hover:-translate-y-1">
                        <img
                            src={brand.logo || "/api/placeholder/100/100"}
                            alt={brand.name}
                            className="w-full h-full object-contain filter group-hover:brightness-110"
                            loading="lazy"
                        />
                    </div>

                    {/* Text is strictly limited to 1 line and kept small */}
                    <span className="mt-2 text-[10px] sm:text-xs font-medium text-gray-600 text-center truncate w-full px-1 group-hover:text-emerald-700">
                        {brand.name}
                    </span>
                </div>
            ))}
        </div>
    );
};

export default BrandGrid;