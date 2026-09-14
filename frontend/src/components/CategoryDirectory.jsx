import React from 'react';
import {
    Scissors, Armchair, Sparkles, Coffee,
    Utensils, Droplet, Briefcase, Shirt,
    Home, Grid, Package, HeartPulse
} from 'lucide-react';
import { getImageSrcSet, getOptimizedImageUrl } from '../utils/imageUtils';

const getCategoryIcon = (categoryName) => {
    const name = categoryName?.toLowerCase() || '';
    if (name.includes('scissor') || name.includes('cut')) return Scissors;
    if (name.includes('furniture') || name.includes('chair')) return Armchair;
    if (name.includes('cosmetic') || name.includes('beauty')) return Sparkles;
    if (name.includes('health') || name.includes('medical') || name.includes('pharma')) return HeartPulse;
    if (name.includes('hotel') || name.includes('kitchen suppli')) return Utensils;
    if (name.includes('food') || name.includes('beverage')) return Coffee;
    if (name.includes('utensil') || name.includes('restaurant')) return Utensils;
    if (name.includes('clean')) return Droplet;
    if (name.includes('office')) return Briefcase;
    if (name.includes('cloth') || name.includes('apparel')) return Shirt;
    if (name.includes('home')) return Home;
    return Package;
};

const CategoryDirectory = ({ categories, onSelectCategory, layout = 'grid', selectedCategory = null }) => {
    if (layout === 'vertical') {
        return (
            <div className="flex flex-col py-2 w-full bg-[#f3f4f6]">
                {categories.map((category, index) => {
                    const isActive = selectedCategory === category.id;
                    const Icon = getCategoryIcon(category.name);
                    
                    return (
                        <div
                            key={category.id}
                            onClick={() => onSelectCategory(category.id)}
                            className={`relative flex flex-col items-center py-3 cursor-pointer ${isActive ? 'bg-white' : ''}`}
                        >
                            {/* Active Indicator Bar */}
                            {isActive && (
                                <div className="absolute right-0 top-0 bottom-0 w-1 bg-green-600 rounded-l" />
                            )}
                            
                            {/* Circular Image Container */}
                            <div className={`w-14 h-14 rounded-full flex items-center justify-center overflow-hidden mb-1 ${isActive ? 'bg-green-100 ring-2 ring-green-100 ring-offset-1' : 'bg-white shadow-sm'}`}>
                                {category.image ? (
                                    <img
                                        src={getOptimizedImageUrl(category.image, { width: 112 })}
                                        srcSet={getImageSrcSet(category.image, [56, 112])}
                                        sizes="56px"
                                        alt={category.name}
                                        className="w-full h-full object-cover"
                                        loading={index < 8 ? "eager" : "lazy"}
                                        fetchPriority={index < 8 ? "high" : "auto"}
                                    />
                                ) : (
                                    <Icon className={`w-6 h-6 ${isActive ? 'text-green-600' : 'text-gray-500'}`} />
                                )}
                            </div>
                            
                            {/* Label */}
                            <span className={`text-[10px] text-center leading-tight px-1 font-medium ${isActive ? 'text-gray-900' : 'text-gray-500'}`}>
                                {category.short_name || category.name}
                            </span>
                        </div>
                    );
                })}
            </div>
        );
    }

    return (
        <div className="pb-4">
            <div className="flex items-center justify-between mb-4 px-1">
                <h3 className="text-base sm:text-lg font-bold text-gray-800">
                    Shop by Category
                </h3>
            </div>

            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-3 sm:gap-4">
                {categories.map((category, index) => {
                    const Icon = getCategoryIcon(category.name);

                    return (
                        <div
                            key={category.id}
                            onClick={() => onSelectCategory(category.id)}
                            className="group flex flex-col items-center cursor-pointer"
                        >
                            {/* SQUARE CONTAINER */}
                            <div className={`w-20 h-20 sm:w-24 sm:h-24 bg-white border border-gray-200 rounded-xl flex items-center justify-center shadow-sm transition-all duration-200 group-hover:shadow-md group-hover:border-emerald-500 group-hover:-translate-y-1 overflow-hidden ${category.image ? '' : 'p-3'}`}>
                                {category.image ? (
                                    <img
                                        src={getOptimizedImageUrl(category.image, { width: 192 })}
                                        srcSet={getImageSrcSet(category.image, [96, 160, 192])}
                                        sizes="(min-width: 640px) 96px, 80px"
                                        alt={category.name}
                                        width="192"
                                        height="192"
                                        className="w-full h-full object-cover"
                                        loading={index < 4 ? "eager" : "lazy"}
                                        fetchPriority={index < 4 ? "high" : "auto"}
                                        decoding={index < 4 ? "sync" : "async"}
                                    />
                                ) : (
                                    <Icon className="w-8 h-8 sm:w-10 sm:h-10 text-emerald-600 group-hover:scale-110 transition-transform" />
                                )}
                            </div>

                            {/* Mobile: show short_name (falls back to name) */}
                            <span className="mt-2 text-[10px] font-medium text-gray-600 text-center w-full px-1 group-hover:text-emerald-700 line-clamp-2 sm:hidden">
                                {category.short_name || category.name}
                            </span>
                            {/* Desktop: always show full name */}
                            <span className="mt-2 text-xs font-medium text-gray-600 text-center w-full px-1 group-hover:text-emerald-700 line-clamp-2 hidden sm:block">
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
