import React from 'react';
import {
    Package, Coffee, Utensils, Droplet, Briefcase,
    Shirt, Home, Store, ShoppingBag, Tag, Grid, Layers,
    Scissors, Armchair, Sparkles // Added specific icons for your niche
} from 'lucide-react';

// Helper to match category names to icons
const getCategoryIcon = (categoryName) => {
    const name = categoryName?.toLowerCase() || '';

    // Map keywords to Lucide Icons
    if (name.includes('scissor') || name.includes('cut')) return Scissors;
    if (name.includes('furniture') || name.includes('chair')) return Armchair;
    if (name.includes('cosmetic') || name.includes('beauty')) return Sparkles;
    if (name.includes('food') || name.includes('beverage')) return Coffee;
    if (name.includes('utensil') || name.includes('restaurant')) return Utensils;
    if (name.includes('clean')) return Droplet;
    if (name.includes('office')) return Briefcase;
    if (name.includes('cloth') || name.includes('apparel')) return Shirt;
    if (name.includes('home')) return Home;

    return Package; // Default icon
};

const CategoryRail = ({ categories, selectedCategory, onSelectCategory }) => {
    return (
        <div className="mb-8">
            <h3 className="text-base sm:text-lg font-bold text-gray-800 mb-4 px-1">
                Shop by Category
            </h3>

            <div className="flex overflow-x-auto gap-4 pb-4 -mx-1 px-1 scrollbar-hide snap-x">
                {/* "All" Option */}
                <div
                    onClick={() => onSelectCategory('all')}
                    className="flex flex-col items-center gap-2 cursor-pointer flex-shrink-0 snap-start group"
                >
                    <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center transition-all ${selectedCategory === 'all'
                            ? 'bg-emerald-600 text-white shadow-lg scale-105'
                            : 'bg-emerald-50 text-emerald-600 border border-emerald-100 group-hover:bg-emerald-100'
                        }`}>
                        <Grid className="w-6 h-6 sm:w-8 sm:h-8" />
                    </div>
                    <span className={`text-xs font-medium ${selectedCategory === 'all' ? 'text-emerald-700 font-bold' : 'text-gray-600'}`}>
                        All
                    </span>
                </div>

                {/* Dynamic Categories */}
                {categories.map((category) => {
                    const Icon = getCategoryIcon(category.name);
                    const isSelected = selectedCategory === category.id;

                    return (
                        <div
                            key={category.id}
                            onClick={() => onSelectCategory(category.id)}
                            className="flex flex-col items-center gap-2 cursor-pointer flex-shrink-0 snap-start group"
                        >
                            <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center transition-all ${isSelected
                                    ? 'bg-emerald-600 text-white shadow-lg scale-105'
                                    : 'bg-white border border-gray-200 text-gray-500 group-hover:border-emerald-500 group-hover:text-emerald-600 shadow-sm'
                                }`}>
                                <Icon className="w-6 h-6 sm:w-8 sm:h-8" />
                            </div>
                            <span className={`text-xs font-medium text-center w-20 truncate ${isSelected ? 'text-emerald-700 font-bold' : 'text-gray-600'}`}>
                                {category.name}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default CategoryRail;