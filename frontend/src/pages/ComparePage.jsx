import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useComparison } from '../context/ComparisonContext';
import ProductComparison from '../components/ProductComparison';

export default function ComparePage() {
    const navigate = useNavigate();
    const { compareList } = useComparison();

    return (
        <ProductComparison onClose={() => navigate('/')} />
    );
}
