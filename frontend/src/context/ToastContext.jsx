import { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle, X, AlertCircle, Info, ShoppingCart } from 'lucide-react';

const ToastContext = createContext();

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);

    const addToast = useCallback((message, type = 'success', duration = 3000) => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);

        setTimeout(() => {
            setToasts(prev => prev.filter(toast => toast.id !== id));
        }, duration);
    }, []);

    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(toast => toast.id !== id));
    }, []);

    // Convenience methods
    const success = useCallback((message) => addToast(message, 'success'), [addToast]);
    const error = useCallback((message) => addToast(message, 'error'), [addToast]);
    const info = useCallback((message) => addToast(message, 'info'), [addToast]);
    const cart = useCallback((message) => addToast(message, 'cart'), [addToast]);

    return (
        <ToastContext.Provider value={{ addToast, success, error, info, cart }}>
            {children}
            <ToastContainer toasts={toasts} removeToast={removeToast} />
        </ToastContext.Provider>
    );
};

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within ToastProvider');
    }
    return context;
};

// Toast Container Component
function ToastContainer({ toasts, removeToast }) {
    return (
        <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 z-[9999] flex flex-col gap-2 pointer-events-none">
            {toasts.map(toast => (
                <Toast key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
            ))}
        </div>
    );
}

// Individual Toast Component
function Toast({ toast, onClose }) {
    const icons = {
        success: <CheckCircle className="w-5 h-5 text-green-500" />,
        error: <AlertCircle className="w-5 h-5 text-red-500" />,
        info: <Info className="w-5 h-5 text-blue-500" />,
        cart: <ShoppingCart className="w-5 h-5 text-emerald-500" />
    };

    const bgColors = {
        success: 'bg-green-50 border-green-200',
        error: 'bg-red-50 border-red-200',
        info: 'bg-blue-50 border-blue-200',
        cart: 'bg-emerald-50 border-emerald-200'
    };

    return (
        <div
            className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border pointer-events-auto animate-slide-up ${bgColors[toast.type] || bgColors.success}`}
            style={{
                animation: 'slideUp 0.3s ease-out'
            }}
        >
            {icons[toast.type] || icons.success}
            <span className="text-sm font-medium text-gray-800">{toast.message}</span>
            <button
                onClick={onClose}
                className="ml-2 p-1 hover:bg-gray-200 rounded-full transition-colors"
            >
                <X className="w-4 h-4 text-gray-500" />
            </button>
        </div>
    );
}

export default ToastContext;
