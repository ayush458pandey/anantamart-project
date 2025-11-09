import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { CartProvider } from './context/CartContext'
import { ComparisonProvider } from './context/ComparisonContext'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <CartProvider>
      <ComparisonProvider>
        <App />
      </ComparisonProvider>
    </CartProvider>
  </React.StrictMode>,
)
