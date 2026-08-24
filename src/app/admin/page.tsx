'use strict';
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Fuse from 'fuse.js';
import { Search, Package, Plus, LogOut, ArrowUpRight, ArrowDownRight, Edit3, Eye, AlertTriangle, Download } from 'lucide-react';
import toast from 'react-hot-toast';

interface Product {
  id: string;
  name: string;
  category: string | null;
  image_url: string | null;
  unit_type: 'kg' | 'pieces' | 'box' | 'bag' | 'bundle' | 'set';
  current_quantity: number;
  low_stock_threshold: number | null;
  tags?: string[];
}

export default function AdminDashboard() {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function fetchProducts() {
      try {
        const { data, error } = await supabase
          .from('products')
          .select('id, name, category, image_url, unit_type, current_quantity, low_stock_threshold, tags')
          .order('name', { ascending: true });

        if (error) {
          throw error;
        }

        setProducts(data || []);
        setSearchResults(data || []);
      } catch (err: any) {
        toast.error('Failed to load products.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchProducts();
  }, [supabase]);

  // Handle Fuse.js Search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(products);
      return;
    }

    const fuse = new Fuse(products, {
      keys: ['name', 'category', 'tags'],
      threshold: 0.3,
    });

    const results = fuse.search(searchQuery).map((res) => res.item);
    setSearchResults(results);
  }, [searchQuery, products]);

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      toast.success('Logged out successfully');
      router.refresh();
      router.push('/admin/login');
    } catch (err: any) {
      toast.error('Error signing out');
      console.error(err);
    }
  };

  const getImageUrl = (path: string | null) => {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    const { data } = supabase.storage.from('product-images').getPublicUrl(path);
    return data.publicUrl;
  };

  const downloadCSV = () => {
    const headers = ['Product Name', 'QTY Type', 'Available Pieces'];
    
    const rows = products.map((product) => {
      const nameEscaped = `"${product.name.replace(/"/g, '""')}"`;
      const qtyType = product.unit_type;
      const qty = product.current_quantity;
      
      return [nameEscaped, qtyType, qty].join(',');
    });
    
    const csvContent = [headers.join(','), ...rows].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `products_inventory_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex-1 flex flex-col bg-neutral-50">
      {/* Navigation Top Bar */}
      <header className="sticky top-0 z-30 bg-white border-b border-neutral-200/80 backdrop-blur-md bg-white/95 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-2xl">📦</span>
            <span className="font-extrabold text-xl text-neutral-900 tracking-tight">Godown Admin</span>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={handleSignOut}
              className="inline-flex items-center justify-center p-2.5 rounded-lg border border-neutral-200 text-neutral-600 hover:text-red-600 hover:bg-red-50 hover:border-red-100 transition-colors min-h-[44px] min-w-[44px] cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Action Quick Bar */}
      <section className="bg-white border-b border-neutral-200/50 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-wrap gap-3">
          <Link
            href="/admin/products/new"
            className="inline-flex items-center px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-neutral-900 hover:bg-neutral-850 transition-all shadow-sm cursor-pointer min-h-[44px]"
          >
            <Plus className="mr-2 h-4 w-4" /> Add Product
          </Link>
          <Link
            href="/admin/receive-stock"
            className="inline-flex items-center px-4 py-2.5 rounded-xl text-sm font-bold text-neutral-700 bg-neutral-100 hover:bg-neutral-200/80 transition-colors cursor-pointer min-h-[44px]"
          >
            <ArrowDownRight className="mr-2 h-4 w-4 text-emerald-600" /> Receive Stock
          </Link>
          <Link
            href="/admin/log-sale"
            className="inline-flex items-center px-4 py-2.5 rounded-xl text-sm font-bold text-neutral-700 bg-neutral-100 hover:bg-neutral-200/80 transition-colors cursor-pointer min-h-[44px]"
          >
            <ArrowUpRight className="mr-2 h-4 w-4 text-amber-600" /> Log a Sale
          </Link>
          <Link
            href="/"
            className="inline-flex items-center px-4 py-2.5 rounded-xl text-sm font-bold text-neutral-700 bg-neutral-100 hover:bg-neutral-200/80 transition-colors cursor-pointer ml-auto min-h-[44px]"
          >
            <Eye className="mr-2 h-4 w-4" /> View Public Site
          </Link>
        </div>
      </section>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 flex flex-col">
        {/* Sticky Search bar */}
        <div className="sticky top-[65px] z-20 bg-neutral-50 py-4 mb-6">
          <div className="flex items-center gap-3 w-full max-w-2xl mx-auto">
            <div className="relative flex-1 rounded-xl shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-neutral-400" aria-hidden="true" />
              </div>
              <input
                type="text"
                name="search"
                id="admin-search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full pl-10 pr-4 py-3.5 border border-neutral-300 rounded-xl bg-white text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900 text-base"
                placeholder="Search products to manage..."
              />
            </div>
            <button
              type="button"
              onClick={downloadCSV}
              title="Download Excel Sheet"
              className="inline-flex items-center justify-center p-3.5 border border-neutral-300 rounded-xl bg-white text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50 transition-colors shadow-sm cursor-pointer h-[50px] w-[50px] shrink-0"
            >
              <Download className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Product Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-white border border-neutral-200/60 rounded-2xl p-4 space-y-4 animate-pulse shadow-sm">
                <div className="aspect-video w-full bg-neutral-200 rounded-xl"></div>
                <div className="h-4 bg-neutral-200 rounded w-2/3"></div>
                <div className="h-3 bg-neutral-200 rounded w-1/3"></div>
                <div className="h-5 bg-neutral-200 rounded w-1/2"></div>
                <div className="h-10 bg-neutral-200 rounded w-full mt-4"></div>
              </div>
            ))}
          </div>
        ) : searchResults.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-12 text-center">
            <div className="inline-flex p-4 rounded-2xl bg-neutral-100 text-neutral-400 mb-4">
              <Package className="h-10 w-10" />
            </div>
            <h3 className="text-lg font-bold text-neutral-900">No products found</h3>
            <p className="mt-1 text-sm text-neutral-500 max-w-sm">
              Try typing a different product name or category.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {searchResults.map((product) => {
              const imgUrl = getImageUrl(product.image_url);
              const isLowStock = product.low_stock_threshold !== null && product.current_quantity <= product.low_stock_threshold;
              return (
                <div
                  key={product.id}
                  className="group bg-white border border-neutral-200/80 rounded-2xl overflow-hidden shadow-sm flex flex-col hover:shadow-md transition-shadow"
                >
                  {/* Image Header */}
                  <div className="aspect-video w-full bg-neutral-100 relative flex items-center justify-center overflow-hidden border-b border-neutral-100">
                    {imgUrl ? (
                      <img
                        src={imgUrl}
                        alt={product.name}
                        loading="lazy"
                        className="object-cover w-full h-full"
                      />
                    ) : (
                      <div className="flex flex-col items-center text-neutral-400">
                        <Package className="h-8 w-8 stroke-[1.5]" />
                        <span className="text-xs mt-1 font-medium text-neutral-500">No Image</span>
                      </div>
                    )}
                    {product.category && (
                      <span className="absolute top-3 left-3 bg-neutral-900/90 backdrop-blur-sm text-white text-xs font-semibold px-2.5 py-1 rounded-lg">
                        {product.category}
                      </span>
                    )}
                    {isLowStock && (
                      <span className="absolute top-3 right-3 bg-amber-500 text-white text-xs font-semibold px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-sm">
                        <AlertTriangle className="h-3.5 w-3.5" /> Low Stock
                      </span>
                    )}
                  </div>

                  {/* Body Content */}
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start gap-2">
                        <h3 className="font-bold text-neutral-900 text-base line-clamp-2 leading-tight">
                          {product.name}
                        </h3>
                        <Link
                          href={`/admin/products/${product.id}/edit`}
                          className="inline-flex items-center justify-center p-2 text-neutral-500 hover:text-neutral-950 hover:bg-neutral-50 border border-neutral-200 rounded-lg transition-colors cursor-pointer min-h-[38px] min-w-[38px]"
                          title="Edit Product Details"
                        >
                          <Edit3 className="h-4 w-4" />
                        </Link>
                      </div>
                    </div>

                    <div className="mt-4 flex items-baseline justify-between border-t border-neutral-100 pt-3 mb-4">
                      <span className="text-xs text-neutral-500 uppercase tracking-wider font-semibold">Available</span>
                      <span className="text-base font-bold text-neutral-900">
                        {product.current_quantity} <span className="text-sm font-semibold text-neutral-500">{product.unit_type}</span>
                      </span>
                    </div>

                    {/* Quick actions bar */}
                    <div className="grid grid-cols-2 gap-2 mt-auto">
                      <Link
                        href={`/admin/receive-stock?product_id=${product.id}`}
                        className="inline-flex items-center justify-center py-2 px-2.5 rounded-lg text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors cursor-pointer min-h-[40px] text-center border border-emerald-100/50"
                      >
                        <ArrowDownRight className="mr-1 h-3.5 w-3.5" /> Recv Stock
                      </Link>
                      <Link
                        href={`/admin/log-sale?product_id=${product.id}`}
                        className="inline-flex items-center justify-center py-2 px-2.5 rounded-lg text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors cursor-pointer min-h-[40px] text-center border border-amber-100/50"
                      >
                        <ArrowUpRight className="mr-1 h-3.5 w-3.5" /> Log Sale
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
