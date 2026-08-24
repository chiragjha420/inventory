'use strict';
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import Fuse from 'fuse.js';
import { Search, Package, ArrowRight, AlertTriangle, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { syncToGoogleSheets } from '@/lib/sheets';

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

export default function PublicHomepage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStockFilter, setSelectedStockFilter] = useState<'all' | 'out_of_stock' | 'low_stock' | 'in_stock'>('all');
  const [selectedPhotoFilter, setSelectedPhotoFilter] = useState<'all' | 'with_photo' | 'without_photo'>('all');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
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
        toast.error('Failed to load products. Please check connection.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchProducts();
  }, [supabase]);

  // Handle Search and Filters
  useEffect(() => {
    let filtered = [...products];

    // 1. Apply Search Query
    if (searchQuery.trim()) {
      const fuse = new Fuse(filtered, {
        keys: ['name', 'category', 'tags'],
        threshold: 0.3,
      });
      filtered = fuse.search(searchQuery).map((res) => res.item);
    }

    // 2. Apply Stock Filter
    if (selectedStockFilter === 'out_of_stock') {
      filtered = filtered.filter(p => Number(p.current_quantity) === 0);
    } else if (selectedStockFilter === 'low_stock') {
      filtered = filtered.filter(p => p.low_stock_threshold !== null && Number(p.current_quantity) <= Number(p.low_stock_threshold));
    } else if (selectedStockFilter === 'in_stock') {
      filtered = filtered.filter(p => Number(p.current_quantity) > 0);
    }

    // 3. Apply Photo Filter
    if (selectedPhotoFilter === 'with_photo') {
      filtered = filtered.filter(p => p.image_url !== null && p.image_url !== '');
    } else if (selectedPhotoFilter === 'without_photo') {
      filtered = filtered.filter(p => p.image_url === null || p.image_url === '');
    }

    // 4. Apply Category Filter
    if (selectedCategoryFilter !== 'all') {
      filtered = filtered.filter(p => p.category === selectedCategoryFilter);
    }

    setSearchResults(filtered);
  }, [searchQuery, products, selectedStockFilter, selectedPhotoFilter, selectedCategoryFilter]);

  // Extract unique categories dynamically
  const categories = Array.from(
    new Set(products.map((p) => p.category).filter(Boolean))
  ) as string[];

  // Helper to get public URL of product image
  const getImageUrl = (path: string | null) => {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    const { data } = supabase.storage.from('product-images').getPublicUrl(path);
    return data.publicUrl;
  };

  const openGoogleSheets = async () => {
    const toastId = toast.loading('Syncing latest inventory to Google Sheets...');
    try {
      await syncToGoogleSheets();
    } catch (err) {
      console.error(err);
    } finally {
      toast.dismiss(toastId);
    }
    const url = process.env.NEXT_PUBLIC_GOOGLE_SHEETS_URL || 'https://docs.google.com/spreadsheets/d/14QySZSX5IUrUL8IUe574kmDVL9fOaLHOzjz7dvCE1vo/edit?usp=sharing';
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* Navigation Top Bar */}
      <header className="sticky top-0 z-30 bg-white border-b border-neutral-200/80 backdrop-blur-md bg-white/95">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-2xl">📦</span>
            <span className="font-bold text-xl text-neutral-900 tracking-tight">Godown Stock</span>
          </div>
          <Link
            href="/admin"
            className="inline-flex items-center px-4 py-2 border border-neutral-300 rounded-lg text-sm font-semibold text-neutral-700 bg-white hover:bg-neutral-50 hover:text-neutral-900 transition-colors cursor-pointer min-h-[44px]"
          >
            Admin Panel <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 flex flex-col">
        {/* Sticky Search bar on Homepage */}
        <div className="sticky top-[65px] z-20 bg-neutral-50 py-4 mb-6 space-y-3">
          <div className="flex items-center gap-3 w-full max-w-2xl mx-auto">
            <div className="relative flex-1 rounded-xl shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-neutral-400" aria-hidden="true" />
              </div>
              <input
                type="text"
                name="search"
                id="search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full pl-10 pr-4 py-3.5 border border-neutral-300 rounded-xl bg-white text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900 text-base"
                placeholder="Search products or categories..."
              />
            </div>
            <button
              type="button"
              onClick={openGoogleSheets}
              title="Open Google Sheet"
              className="inline-flex items-center justify-center p-3.5 border border-neutral-300 rounded-xl bg-white text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50 transition-colors shadow-sm cursor-pointer h-[50px] w-[50px] shrink-0"
            >
              <Download className="h-5 w-5" />
            </button>
          </div>

          {/* Filters Row */}
          <div className="grid grid-cols-3 gap-2 w-full max-w-2xl mx-auto bg-white p-3 rounded-xl border border-neutral-200/80 shadow-sm">
            <div>
              <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Stock</label>
              <select
                value={selectedStockFilter}
                onChange={(e: any) => setSelectedStockFilter(e.target.value)}
                className="block w-full border border-neutral-200 rounded-lg p-1.5 bg-neutral-50 text-neutral-800 focus:outline-none text-xs cursor-pointer"
              >
                <option value="all">All</option>
                <option value="in_stock">In Stock</option>
                <option value="out_of_stock">Out of Stock</option>
                <option value="low_stock">Low Stock</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Photos</label>
              <select
                value={selectedPhotoFilter}
                onChange={(e: any) => setSelectedPhotoFilter(e.target.value)}
                className="block w-full border border-neutral-200 rounded-lg p-1.5 bg-neutral-50 text-neutral-800 focus:outline-none text-xs cursor-pointer"
              >
                <option value="all">All</option>
                <option value="with_photo">With Photo</option>
                <option value="without_photo">No Photo</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Category</label>
              <select
                value={selectedCategoryFilter}
                onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                className="block w-full border border-neutral-200 rounded-lg p-1.5 bg-neutral-50 text-neutral-800 focus:outline-none text-xs cursor-pointer"
              >
                <option value="all">All</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Product Cards Grid */}
        {loading ? (
          // Skeleton Loader
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="bg-white border border-neutral-200/60 rounded-2xl p-4 space-y-4 animate-pulse shadow-sm">
                <div className="aspect-video w-full bg-neutral-200 rounded-xl"></div>
                <div className="h-4 bg-neutral-200 rounded w-2/3"></div>
                <div className="h-3 bg-neutral-200 rounded w-1/3"></div>
                <div className="h-5 bg-neutral-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : searchResults.length === 0 ? (
          // Empty State
          <div className="flex-1 flex flex-col items-center justify-center py-12 text-center">
            <div className="inline-flex p-4 rounded-2xl bg-neutral-100 text-neutral-400 mb-4">
              <Package className="h-10 w-10" />
            </div>
            <h3 className="text-lg font-bold text-neutral-900">No products found</h3>
            <p className="mt-1 text-sm text-neutral-500 max-w-sm">
              We couldn't find any products matching "{searchQuery}". Try adjusting your keywords.
            </p>
          </div>
        ) : (
          // Actual Product Grid
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {searchResults.map((product) => {
              const imgUrl = getImageUrl(product.image_url);
              const isLowStock = product.low_stock_threshold !== null && product.current_quantity <= product.low_stock_threshold;
              return (
                <Link
                  key={product.id}
                  href={`/product/${product.id}`}
                  className="group bg-white border border-neutral-200/80 rounded-2xl overflow-hidden hover:shadow-md transition-all duration-300 flex flex-col shadow-sm cursor-pointer"
                >
                  {/* Image container */}
                  <div className="aspect-video w-full bg-neutral-100 relative flex items-center justify-center overflow-hidden border-b border-neutral-100">
                    {imgUrl ? (
                      <img
                        src={imgUrl}
                        alt={product.name}
                        loading="lazy"
                        className="object-cover w-full h-full group-hover:scale-[1.03] transition-transform duration-300"
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
                      <h3 className="font-bold text-neutral-900 group-hover:text-black text-base line-clamp-2 leading-tight">
                        {product.name}
                      </h3>
                      {product.tags && product.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {product.tags.map((tag) => (
                            <span
                              key={tag}
                              className="inline-block bg-neutral-100 text-neutral-600 text-[10px] font-semibold px-2 py-0.5 rounded"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="mt-4 flex items-baseline justify-between border-t border-neutral-100 pt-3">
                      <span className="text-xs text-neutral-500 uppercase tracking-wider font-semibold">Available</span>
                      <span className="text-base font-bold text-neutral-900">
                        {product.current_quantity} <span className="text-sm font-semibold text-neutral-500">{product.unit_type}</span>
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
