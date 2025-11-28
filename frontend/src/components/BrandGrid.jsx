import { Package } from 'lucide-react';

/**
 * BrandGrid Component
 * Displays brands as visual cards with logos
 */
export default function BrandGrid({
    brands,
    onBrandClick,
    isLoading = false
}) {
    if (isLoading) {
        return (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
                {[1, 2, 3, 4, 5, 6].map(i => (
                    <BrandCardSkeleton key={i} />
                ))}
            </div>
        );
    }

    if (!brands || brands.length === 0) {
        return (
            <div className="text-center py-12">
                <Package className="w-16 h-16 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No brands available</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
            {brands.map(brand => (
                <BrandCard
                    key={brand.id}
                    brand={brand}
                    onClick={() => onBrandClick(brand)}
                />
            ))}
        </div>
    );
}

// Individual brand card
function BrandCard({ brand, onClick }) {
    return (
        <button
            onClick={onClick}
            className="group bg-white rounded-xl shadow-sm hover:shadow-md active:shadow-sm transition-all p-4 flex flex-col items-center gap-3 touch-manipulation"
        >
            {/* Logo */}
            <div className="w-20 h-20 sm:w-24 sm:h-24 bg-white border-2 border-gray-100 rounded-lg flex items-center justify-center overflow-hidden group-hover:border-emerald-200 transition-colors p-2">
                {brand.logo_url ? (
                    <img
                        src={brand.logo_url}
                        alt={brand.name}
                        className="w-full h-full object-contain"
                        loading="lazy"
                    />
                ) : (
                    <div className="text-center">
                        <div className="text-2xl font-bold text-gray-400">
                            {brand.name.charAt(0)}
                        </div>
                    </div>
                )}
            </div>

            {/* Name */}
            <div className="text-center w-full">
                <h3 className="text-xs sm:text-sm font-semibold text-gray-900 line-clamp-1">
                    {brand.name}
                </h3>
            </div>
        </button>
    );
}

// Loading skeleton
function BrandCardSkeleton() {
    return (
        <div className="bg-white rounded-xl shadow-sm p-4 flex flex-col items-center gap-3 animate-pulse">
            <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gray-200 rounded-lg"></div>
            <div className="w-full space-y-2">
                <div className="h-3 bg-gray-200 rounded w-3/4 mx-auto"></div>
                <div className="h-2 bg-gray-200 rounded w-1/2 mx-auto"></div>
            </div>
        </div>
    );
}
