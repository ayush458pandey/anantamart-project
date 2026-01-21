import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
// Import ComparisonProvider here (It's easier to find from the root folder)
import { ComparisonProvider } from './context/ComparisonContext';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          {/* We add the provider HERE instead of in Home.jsx */}
          <ComparisonProvider>
            <App />
          </ComparisonProvider>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)