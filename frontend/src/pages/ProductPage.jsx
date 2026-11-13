import { useState, useEffect, lazy, Suspense } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Package, ArrowLeft, ChevronRight } from 'lucide-react';
import { productService } from '../api/services/productService';
import { useCart } from '../context/CartContext';

const ProductDetail = lazy(() => import('../components/ProductDetail'));

const normalizeProductImage = (product) => ({
  ...product,
  image: product.image_url || product.images?.[0]?.image_url || product.images?.[0]?.image || product.image,
});

export default function ProductPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const fetchProduct = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = /^\d+$/.test(slug)
          ? await productService.getProductById(slug)
          : await productService.getProductBySlug(slug);
        if (!cancelled) setProduct(normalizeProductImage(data));
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load product:', err);
          setError(err.response?.status === 404 ? 'Product not found.' : 'Could not load this product.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    if (slug) fetchProduct();
    return () => { cancelled = true; };
  }, [slug]);

  // Update document title for SEO
  useEffect(() => {
    if (product?.name) {
      document.title = `${product.name} | Anantamart`;
    }
    return () => { document.title = 'Anantamart'; };
  }, [product]);

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4 text-center">
        <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-gray-900 mb-2">{error || 'Product not found'}</h1>
        <p className="text-sm text-gray-500 mb-6">The product you are looking for may have been removed or is unavailable.</p>
        <button
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-5 py-2.5 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to catalog
        </button>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
        {/* Breadcrumb */}
        <nav className="flex items-center flex-wrap gap-1 text-xs sm:text-sm text-gray-500 mb-4">
          <Link to="/" className="hover:text-emerald-600 transition-colors">Home</Link>
          {product.category_name && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
              <span>{product.category_name}</span>
            </>
          )}
          <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
          <span className="text-gray-700 font-medium truncate max-w-[200px] sm:max-w-none">{product.name}</span>
        </nav>

        <Suspense fallback={
          <div className="min-h-[60vh] flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
          </div>
        }>
          <ProductDetail
            product={product}
            embedded
            onClose={handleBack}
            onAddToCart={addToCart}
            onBrandClick={(brandName, brandId) => {
              navigate(`/?brand=${encodeURIComponent(brandId || brandName)}`);
            }}
          />
        </Suspense>
      </div>
    </div>
  );
}
