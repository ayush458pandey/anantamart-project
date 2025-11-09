import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'  // ✅ Import here only once
import App from './App.jsx'
import { CartProvider } from './context/CartContext'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <CartProvider>
      <App />
    </CartProvider>
  </StrictMode>,
)
