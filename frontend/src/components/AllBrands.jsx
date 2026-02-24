import React, { useState } from 'react';
import { Search, ChevronLeft, Info } from 'lucide-react';

const AllBrands = ({ brands, onBrandClick, onBack }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedLetter, setSelectedLetter] = useState('All');

    // Generate A-Z Array
    const alphabet = ['All', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')];

    // Filter Logic
    const filteredBrands = brands.filter(brand => {
        const matchesSearch = brand.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesLetter = selectedLetter === 'All' || brand.name.charAt(0).toUpperCase() === selectedLetter;
        return matchesSearch && matchesLetter;
    });

    return (
        <div className="min-h-screen bg-white">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b z-10 px-4 py-3 flex items-center gap-3">
                <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full">
                    <ChevronLeft className="w-6 h-6 text-gray-700" />
                </button>
                <div className="flex-1">
                    <h1 className="text-xl font-bold text-gray-800">Brand Directory</h1>
                    <p className="text-xs text-gray-500">{brands.length} brands available</p>
                </div>
            </div>

            <div className="p-4 max-w-7xl mx-auto">
                {/* Search Bar */}
                <div className="relative mb-6">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                        type="text"
                        placeholder="Find a brand..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                    />
                </div>

                {/* A-Z Filter (Horizontal Scroll) */}
                <div className="flex overflow-x-auto gap-2 pb-2 mb-6 scrollbar-hide -mx-4 px-4">
                    {alphabet.map(letter => (
                        <button
                            key={letter}
                            onClick={() => setSelectedLetter(letter)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-bold flex-shrink-0 transition-colors ${selectedLetter === letter
                                    ? 'bg-emerald-600 text-white shadow-md'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                        >
                            {letter}
                        </button>
                    ))}
                </div>

                {/* Brands Grid */}
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 sm:gap-4 mb-12">
                    {filteredBrands.length > 0 ? (
                        filteredBrands.map(brand => (
                            <div
                                key={brand.id}
                                onClick={() => onBrandClick(brand)}
                                className="group flex flex-col items-center cursor-pointer"
                            >
                                <div className="w-20 h-20 sm:w-24 sm:h-24 bg-white border border-gray-200 rounded-xl flex items-center justify-center p-3 shadow-sm group-hover:shadow-md group-hover:border-emerald-500 transition-all">
                                    <img
                                        src={brand.logo || "/api/placeholder/100/100"}
                                        alt={brand.name}
                                        className="w-full h-full object-contain filter group-hover:brightness-105"
                                    />
                                </div>
                                <span className="mt-2 text-xs font-medium text-gray-700 text-center line-clamp-1 group-hover:text-emerald-700">
                                    {brand.name}
                                </span>
                            </div>
                        ))
                    ) : (
                        <div className="col-span-full text-center py-12 text-gray-500">
                            No brands found starting with "{selectedLetter}"
                        </div>
                    )}
                </div>

                {/* LEGAL DISCLAIMER (Crucial for Non-Authorized Distributors) */}
                <div className="bg-gray-50 rounded-xl p-4 flex gap-3 items-start border border-gray-100">
                    <Info className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-gray-500 leading-relaxed">
                        <strong>Disclaimer:</strong> Ananta Mart is an independent wholesale platform.
                        All brand names, logos, and trademarks displayed on this site are the property of their respective owners.
                        We are not an authorized distributor or official partner for all brands listed, unless explicitly stated.
                        We source genuine products for B2B supply.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default AllBrands;