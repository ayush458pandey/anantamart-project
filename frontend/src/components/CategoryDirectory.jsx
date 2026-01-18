import React from 'react';
import {
    Scissors, Armchair, Sparkles, Coffee,
    Utensils, Droplet, Briefcase, Shirt,
    Home, Grid, Package
} from 'lucide-react';

// Helper to get icons
const getCategoryIcon = (categoryName) => {
    const name = categoryName?.toLowerCase() || '';
    if (name.includes('scissor') || name.includes('cut')) return Scissors;
    if (name.includes('furniture') || name.includes('chair')) return Armchair;
    if (name.includes('cosmetic') || name.includes('beauty')) return Sparkles;
    if (name.includes('food') || name.includes('beverage')) return Coffee;
    if (name.includes('utensil') || name.includes('restaurant')) return Utensils;
    if (name.includes('clean')) return Droplet;
    if (name.includes('office')) return Briefcase;
    if (name.includes('cloth') || name.includes('apparel')) return Shirt;
    if (name.includes('home')) return Home;
    return Package;
};

const CategoryDirectory = ({ categories, onSelectCategory }) => {
    return (
        <div className="pb-8">
            {/* Section Header */}
            <div className="flex items-center justify-between mb-4 px-1">
                <h3 className="text-lg sm:text-xl font-bold text-gray-800">
                    Shop by Category
                </h3>
            </div>

            {/* The Grid */}
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 sm:gap-4">
                {categories.map((category) => {
                    const Icon = getCategoryIcon(category.name);

                    return (
                        <div
                            key={category.id}
                            onClick={() => onSelectCategory(category.id)}
                            className="flex flex-col items-center gap-2 cursor-pointer group"
                        >
                            <div className="w-full aspect-square bg-emerald-50 rounded-2xl flex items-center justify-center border border-emerald-100 group-hover:border-emerald-500 group-hover:shadow-md transition-all">
                                {category.image ? (
                                    <img
                                        src={category.image}
                                        alt={category.name}
                                        className="w-3/4 h-3/4 object-contain"
                                    />
                                ) : (
                                    <Icon className="w-10 h-10 sm:w-12 sm:h-12 text-emerald-600 group-hover:scale-110 transition-transform" />
                                )}
                            </div>

                            <span className="text-xs sm:text-sm font-bold text-gray-700 text-center leading-tight px-1 group-hover:text-emerald-700">
                                {category.name}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default CategoryDirectory;