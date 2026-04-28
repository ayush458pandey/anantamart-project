import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
// Import ComparisonProvider here (It's easier to find from the root folder)
import { ComparisonProvider } from './context/ComparisonContext';
import { ToastProvider } from './context/ToastContext';
import { Analytics } from '@vercel/analytics/react';
import { GoogleOAuthProvider } from '@react-oauth/google';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <GoogleOAuthProvider clientId="crek4p60hrug0s098qv50i45u6edcpet.apps.googleusercontent.com">
      <BrowserRouter>
        <AuthProvider>
          <CartProvider>
            <ComparisonProvider>
              <ToastProvider>
                <App />
                <Analytics />
              </ToastProvider>
            </ComparisonProvider>
          </CartProvider>
        </AuthProvider>
      </BrowserRouter>
    </GoogleOAuthProvider>
  </StrictMode>,
)