import React from 'react';

export default function NavButton({ icon: Icon, label, active, onClick, badge }) {
    return (
        <button
            onClick={onClick}
            className={`flex flex-col items-center justify-center py-1.5 sm:py-2 px-2 sm:px-3 rounded-lg transition-colors relative touch-manipulation min-w-[60px] min-h-[60px] sm:min-h-[auto] active:bg-gray-100 ${active ? 'text-amber-500' : 'text-gray-600'
                }`}
        >
            <div className="relative">
                <Icon className="w-5 h-5 sm:w-6 sm:h-6 mb-0.5 sm:mb-1" />
                {badge > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] sm:text-xs rounded-full w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center font-bold">
                        {badge > 99 ? '99+' : badge}
                    </span>
                )}
            </div>
            <span className="text-[10px] sm:text-xs font-medium leading-tight">{label}</span>
        </button>
    );
}
