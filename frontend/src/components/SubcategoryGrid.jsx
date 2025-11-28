import { Package } from 'lucide-react';

/**
 * SubcategoryGrid Component
 * Displays subcategories as visual cards with images
 */
export default function SubcategoryGrid({
    subcategories,
    onSubcategoryClick,
    isLoading = false
}) {
    if (isLoading) {
        return (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
                {[1, 2, 3, 4, 5, 6].map(i => (
                    <SubcategoryCardSkeleton key={i} />
                ))}
            </div>
        );
    }

    if (!subcategories || subcategories.length === 0) {
        return (
            <div className="text-center py-12">
                <Package className="w-16 h-16 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No subcategories available</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
            {subcategories.map(subcategory => (
                <SubcategoryCard
                    key={subcategory.id}
                    subcategory={subcategory}
                    onClick={() => onSubcategoryClick(subcategory)}
                />
            ))}
        </div>
    );
}

// Individual subcategory card
function SubcategoryCard({ subcategory, onClick }) {
    return (
        <button
            onClick={onClick}
            className="group bg-white rounded-xl shadow-sm hover:shadow-md active:shadow-sm transition-all p-4 flex flex-col items-center gap-3 touch-manipulation"
        >
            {/* Image/Icon */}
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-full flex items-center justify-center overflow-hidden group-hover:scale-110 transition-transform">
                {subcategory.image_url ? (
                    <img
                        src={subcategory.image_url}
                        alt={subcategory.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                    />
                ) : (
                    <Package className="w-8 h-8 sm:w-10 sm:h-10 text-emerald-600" />
                )}
            </div>

            {/* Name */}
            <div className="text-center">
                <h3 className="text-xs sm:text-sm font-semibold text-gray-900 line-clamp-2 mb-1">
                    {subcategory.name}
                </h3>
                {subcategory.product_count !== undefined && (
                    <p className="text-[10px] sm:text-xs text-gray-500">
                        {subcategory.product_count} {subcategory.product_count === 1 ? 'product' : 'products'}
                    </p>
                )}
            </div>
        </button>
    );
}

// Loading skeleton
function SubcategoryCardSkeleton() {
    return (
        <div className="bg-white rounded-xl shadow-sm p-4 flex flex-col items-center gap-3 animate-pulse">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gray-200 rounded-full"></div>
            <div className="w-full space-y-2">
                <div className="h-3 bg-gray-200 rounded w-3/4 mx-auto"></div>
                <div className="h-2 bg-gray-200 rounded w-1/2 mx-auto"></div>
            </div>
        </div>
    );
}
