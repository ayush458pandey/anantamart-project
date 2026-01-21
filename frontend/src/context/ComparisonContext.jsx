import React, { createContext, useContext, useState, useEffect } from 'react';

const ComparisonContext = createContext();

export const ComparisonProvider = ({ children }) => {
  // Support both naming conventions to prevent errors
  const [compareList, setCompareList] = useState([]);
  const [isOpen, setIsOpen] = useState(false); // UI needs this for the drawer

  // Load from Local Storage
  useEffect(() => {
    const saved = localStorage.getItem('compareList');
    if (saved) {
      try {
        setCompareList(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load comparison list", e);
      }
    }
  }, []);

  // Save to Local Storage
  useEffect(() => {
    localStorage.setItem('compareList', JSON.stringify(compareList));
  }, [compareList]);

  const addToCompare = (product) => {
    setCompareList(prev => {
      if (prev.find(p => p.id === product.id)) return prev;
      if (prev.length >= 4) {
        alert('You can compare up to 4 products only!');
        return prev;
      }
      setIsOpen(true); // Open the drawer when added
      return [...prev, product];
    });
  };

  const removeFromCompare = (id) =>
    setCompareList(prev => prev.filter(p => p.id !== id));

  const clearCompare = () => {
    setCompareList([]);
    setIsOpen(false);
  };

  return (
    <ComparisonContext.Provider value={{
      compareList,
      compareItems: compareList, // Alias for compatibility
      addToCompare,
      removeFromCompare,
      clearCompare,
      isOpen,      // Required for UI
      setIsOpen    // Required for UI
    }}>
      {children}
    </ComparisonContext.Provider>
  );
};

export const useComparison = () => useContext(ComparisonContext);