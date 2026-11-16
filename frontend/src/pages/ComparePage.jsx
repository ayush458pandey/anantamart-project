import React from 'react';
import { useNavigate } from 'react-router-dom';
import ProductComparison from '../components/ProductComparison';

export default function ComparePage() {
    const navigate = useNavigate();

    return (
        <ProductComparison onClose={() => navigate('/')} />
    );
}
