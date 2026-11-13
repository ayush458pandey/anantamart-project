import React from 'react';
import { Tag } from 'lucide-react';
import { getImageSrcSet, getOptimizedImageUrl } from '../utils/imageUtils';

const TagDirectory = ({ tags, onSelectTag, selectedTags = [] }) => {
    return (
        <div className="flex flex-col py-2 w-full bg-[#f3f4f6]">
            {tags && tags.map((tag, index) => {
                const isActive = selectedTags.includes(tag.id) || selectedTags.includes(String(tag.id));
                
                return (
                    <div
                        key={tag.id}
                        onClick={() => onSelectTag(tag)}
                        className={`relative flex flex-col items-center py-3 cursor-pointer ${isActive ? 'bg-white' : ''}`}
                    >
                        {/* Active Indicator Bar */}
                        {isActive && (
                            <div className="absolute right-0 top-0 bottom-0 w-1 bg-green-600 rounded-l" />
                        )}
                        
                        {/* Circular Image Container */}
                        <div className={`w-14 h-14 rounded-full flex items-center justify-center overflow-hidden mb-1 ${isActive ? 'bg-green-100 ring-2 ring-green-100 ring-offset-1' : 'bg-white shadow-sm'}`}>
                            {tag.image ? (
                                <img
                                    src={getOptimizedImageUrl(tag.image, { width: 112 })}
                                    srcSet={getImageSrcSet(tag.image, [56, 112])}
                                    sizes="56px"
                                    alt={tag.name}
                                    className="w-full h-full object-cover"
                                    loading={index < 8 ? "eager" : "lazy"}
                                    fetchPriority={index < 8 ? "high" : "auto"}
                                />
                            ) : (
                                <Tag className={`w-6 h-6 ${isActive ? 'text-green-600' : 'text-gray-500'}`} />
                            )}
                        </div>
                        
                        {/* Label */}
                        <span className={`text-[10px] text-center leading-tight px-1 font-medium ${isActive ? 'text-gray-900' : 'text-gray-500'}`}>
                            {tag.name}
                        </span>
                    </div>
                );
            })}
            
            {(!tags || tags.length === 0) && (
                <div className="flex flex-col items-center py-4 text-gray-400">
                    <span className="text-[10px] text-center px-2">No options</span>
                </div>
            )}
        </div>
    );
};

export default TagDirectory;
