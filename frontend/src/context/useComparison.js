import { useContext } from 'react';
import { ComparisonContext } from './ComparisonContext';

export const useComparison = () => useContext(ComparisonContext);
