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
import { SpeedInsights } from '@vercel/speed-insights/react';

// --- Stale-chunk recovery -----------------------------------------------------
// Every deploy gives each JS chunk a new content hash. A tab opened before a
// deploy still holds the OLD index bundle, so a later lazy() import can request
// a chunk that no longer exists -> "Failed to fetch dynamically imported module"
// (404). Vite fires `vite:preloadError` in exactly that case; reload once to
// fetch the fresh index.html. A session flag prevents any reload loop.
window.addEventListener('vite:preloadError', (event) => {
  const RELOAD_KEY = 'anantamart:chunk-reload';

  // Prevent the default so Vite's own handler doesn't also act on it.
  if (event?.preventDefault) event.preventDefault();

  if (sessionStorage.getItem(RELOAD_KEY)) return; // already reloaded this session
  sessionStorage.setItem(RELOAD_KEY, '1');

  window.location.reload();
});

// Clear the flag once the app has booted successfully, so a future stale-chunk
// (a later deploy) can trigger another recovery reload.
window.addEventListener('load', () => {
  window.setTimeout(() => sessionStorage.removeItem('anantamart:chunk-reload'), 3000);
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <ComparisonProvider>
            <ToastProvider>
              <App />
              <Analytics />
              <SpeedInsights />
            </ToastProvider>
          </ComparisonProvider>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)