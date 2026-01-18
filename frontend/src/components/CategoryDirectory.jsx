import React from 'react';
import {
    Scissors, Armchair, Sparkles, Coffee,
    Utensils, Droplet, Briefcase, Shirt,
    Home, Grid, Package
} from 'lucide-react';

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
        <div className="pb-4">
            <div className="flex items-center justify-between mb-4 px-1">
                <h3 className="text-base sm:text-lg font-bold text-gray-800">
                    Shop by Category
                </h3>
            </div>

            {/* UPDATED GRID: Matches BrandGrid exactly (4 cols mobile, 8 cols desktop) */}
            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-3 sm:gap-4">
                {categories.map((category) => {
                    const Icon = getCategoryIcon(category.name);

                    return (
                        <div
                            key={category.id}
                            onClick={() => onSelectCategory(category.id)}
                            className="group flex flex-col items-center cursor-pointer"
                        >
                            {/* THE BOX: Exact match to BrandGrid size (w-20/w-24) */}
                            <div className="w-20 h-20 sm:w-24 sm:h-24 bg-white border border-gray-200 rounded-xl flex items-center justify-center p-3 shadow-sm transition-all duration-200 group-hover:shadow-md group-hover:border-emerald-500 group-hover:-translate-y-1">
                                {category.image ? (
                                    <img
                                        src={category.image}
                                        alt={category.name}
                                        className="w-full h-full object-contain"
                                    />
                                ) : (
                                    <Icon className="w-8 h-8 sm:w-10 sm:h-10 text-emerald-600 group-hover:scale-110 transition-transform" />
                                )}
                            </div>

                            {/* LABEL: Compact text below */}
                            <span className="mt-2 text-[10px] sm:text-xs font-medium text-gray-600 text-center truncate w-full px-1 group-hover:text-emerald-700">
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