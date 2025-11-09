import { Package, Coffee, Utensils, Droplet, Briefcase, Shirt, Home } from 'lucide-react';

export const categories = [
  { 
    id: 'all', 
    name: 'All Products', 
    icon: Package,
    subcategories: []
  },
  { 
    id: 'food', 
    name: 'Food & Beverage', 
    icon: Coffee,
    subcategories: ['Coffee & Tea', 'Spices', 'Grains & Pulses', 'Dairy Products', 'Snacks']
  },
  { 
    id: 'restaurant', 
    name: 'Restaurant Supplies', 
    icon: Utensils,
    subcategories: ['Cookware', 'Cutlery', 'Serving Items', 'Kitchen Tools', 'Disposables']
  },
  { 
    id: 'cleaning', 
    name: 'Cleaning', 
    icon: Droplet,
    subcategories: ['Detergents', 'Disinfectants', 'Mops & Brooms', 'Cleaning Tools', 'Trash Bags']
  },
  { 
    id: 'office', 
    name: 'Office Supplies', 
    icon: Briefcase,
    subcategories: ['Stationery', 'Files & Folders', 'Desk Accessories', 'Packaging', 'Electronics']
  },
  { 
    id: 'apparel', 
    name: 'Apparel', 
    icon: Shirt,
    subcategories: ['Uniforms', 'Safety Wear', 'Workwear', 'Footwear', 'Accessories']
  },
  { 
    id: 'home', 
    name: 'Home & Living', 
    icon: Home,
    subcategories: ['Furniture', 'Decor', 'Kitchen', 'Bedding', 'Storage']
  },
];
