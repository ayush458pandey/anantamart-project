import { createContext, useContext, useState } from 'react';

const ComparisonContext = createContext();

export const ComparisonProvider = ({ children }) => {
  const [compareList, setCompareList] = useState([]);

  const addToCompare = (product) => {
    if (compareList.find(p => p.id === product.id)) return;
    if (compareList.length >= 4) {
      alert('You can compare up to 4 products only!');
      return;
    }
    setCompareList(prev => [...prev, product]);
  };

  const removeFromCompare = (id) =>
    setCompareList(prev => prev.filter(p => p.id !== id));

  const clearCompare = () => setCompareList([]);

  return (
    <ComparisonContext.Provider value={{ compareList, addToCompare, removeFromCompare, clearCompare }}>
      {children}
    </ComparisonContext.Provider>
  );
};

export const useComparison = () => useContext(ComparisonContext);
