import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// 1. Import your 1300-line file (It is in the same folder, so path is ./)
import Home from './pages/Home';

// 2. Import the new pages
import Login from './pages/Login';
import AdvancedCheckout from './components/AdvancedCheckout';

// 3. Import Layouts (Only if they aren't already inside Home.jsx)
// Since your Home.jsx is massive, it likely already contains Navbar/Footer.
// So we don't import them here to avoid double headers.

function App() {
  return (
    <div className="app-container">
      <Routes>
        {/* The "Home" route now loads your massive file */}
        <Route path="/" element={<Home />} />

        {/* The "Login" route loads the new login page */}
        <Route path="/login" element={<Login />} />

        {/* The "Checkout" route */}
        <Route path="/checkout" element={<AdvancedCheckout />} />

        {/* Catch-all: Send unknown links to Home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

export default App;