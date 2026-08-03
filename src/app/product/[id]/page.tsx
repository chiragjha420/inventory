'use strict';
'use client';

import { use, useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { ArrowLeft, Package, User, Calendar, Receipt, ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';

interface Product {
  id: string;
  name: string;
  category: string | null;
  image_url: string | null;
  unit_type: 'kg' | 'pieces' | 'box' | 'bag' | 'bundle' | 'set';
  current_quantity: number;
}

interface SaleItemWithSale {
  id: string;
  quantity_sold: number;
  unit_type_at_sale: string;
  sales: {
    sold_to: string;
    sold_by: string;
    sale_date: string;
  };
}

export default function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [product, setProduct] = useState<Product | null>(null);
  const [salesHistory, setSalesHistory] = useState<SaleItemWithSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const salesPerPage = 5;
  const supabase = createClient();

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch Product Details
        const { data: prodData, error: prodError } = await supabase
          .from('products')
          .select('id, name, category, image_url, unit_type, current_quantity')
          .eq('id', id)
          .single();

        if (prodError) throw prodError;
        setProduct(prodData);

        // Fetch Product Sales History (Join with Sales table)
        const { data: salesData, error: salesError } = await supabase
          .from('sale_items')
          .select(`
            id,
            quantity_sold,
            unit_type_at_sale,
            sales (
              sold_to,
              sold_by,
              sale_date
            )
          `)
          .eq('product_id', id);

        if (salesError) throw salesError;

        // Typeassertion and sorting (Supabase API can sometimes return array or single object)
        const typedSales = (salesData || []) as any[] as SaleItemWithSale[];
        
        // Sort sales history reverse-chronologically by date
        const sortedSales = typedSales.sort((a, b) => {
          const dateA = new Date(a.sales?.sale_date || 0).getTime();
          const dateB = new Date(b.sales?.sale_date || 0).getTime();
          return dateB - dateA;
        });

        setSalesHistory(sortedSales);
      } catch (err: any) {
        toast.error('Failed to load product details.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [id, supabase]);

  const getImageUrl = (path: string | null) => {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    const { data } = supabase.storage.from('product-images').getPublicUrl(path);
    return data.publicUrl;
  };

  // Pagination Logic
  const indexOfLastSale = currentPage * salesPerPage;
  const indexOfFirstSale = indexOfLastSale - salesPerPage;
  const currentSales = salesHistory.slice(indexOfFirstSale, indexOfLastSale);
  const totalPages = Math.ceil(salesHistory.length / salesPerPage);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full px-4 py-8 space-y-6 animate-pulse">
        <div className="h-6 w-24 bg-neutral-200 rounded"></div>
        <div className="aspect-[2/1] w-full bg-neutral-200 rounded-2xl"></div>
        <div className="space-y-3">
          <div className="h-8 bg-neutral-200 rounded w-2/3"></div>
          <div className="h-4 bg-neutral-200 rounded w-1/4"></div>
          <div className="h-12 bg-neutral-200 rounded w-1/3 mt-6"></div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-neutral-50">
        <Package className="h-16 w-16 text-neutral-400 mb-4 stroke-[1.5]" />
        <h2 className="text-xl font-bold text-neutral-900">Product not found</h2>
        <p className="text-neutral-500 mt-2">The product you are looking for does not exist or has been removed.</p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center px-4 py-2 border border-neutral-300 rounded-lg text-sm font-semibold text-neutral-700 bg-white hover:bg-neutral-50 transition-colors"
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Home
        </Link>
      </div>
    );
  }

  const imgUrl = getImageUrl(product.image_url);

  return (
    <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full px-4 sm:px-6 py-8">
      {/* Back navigation */}
      <div className="mb-6">
        <Link
          href="/"
          className="inline-flex items-center text-sm font-semibold text-neutral-600 hover:text-neutral-900 transition-colors cursor-pointer py-2 min-h-[44px]"
        >
          <ArrowLeft className="mr-2 h-5 w-5" /> Back to Homepage
        </Link>
      </div>

      <div className="bg-white border border-neutral-200/80 rounded-2xl overflow-hidden shadow-sm flex flex-col md:flex-row">
        {/* Large Product Image */}
        <div className="md:w-1/2 aspect-[4/3] md:aspect-auto bg-neutral-100 relative flex items-center justify-center overflow-hidden border-r border-neutral-200/50">
          {imgUrl ? (
            <img src={imgUrl} alt={product.name} className="object-cover w-full h-full" />
          ) : (
            <div className="flex flex-col items-center text-neutral-400">
              <Package className="h-16 w-16 stroke-[1.2]" />
              <span className="text-sm mt-2 font-medium">No Product Image</span>
            </div>
          )}
          {product.category && (
            <span className="absolute top-4 left-4 bg-neutral-900/90 backdrop-blur-sm text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-sm">
              {product.category}
            </span>
          )}
        </div>

        {/* Product Details */}
        <div className="md:w-1/2 p-6 sm:p-8 flex flex-col justify-between">
          <div className="space-y-4">
            <div>
              <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Product Name</span>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 leading-tight mt-1">
                {product.name}
              </h1>
            </div>

            <div className="bg-neutral-50 border border-neutral-100 rounded-xl p-4 sm:p-5">
              <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider block">
                Current Live Stock
              </span>
              <span className="text-3xl sm:text-4xl font-black text-neutral-900 mt-2 block">
                {product.current_quantity}{' '}
                <span className="text-lg font-semibold text-neutral-500">{product.unit_type}</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Sales History Log */}
      <div className="mt-12">
        <h2 className="text-xl font-extrabold text-neutral-900 flex items-center gap-2 mb-6">
          <Receipt className="h-5 w-5 text-neutral-500" /> Sales History log
        </h2>

        {salesHistory.length === 0 ? (
          <div className="bg-white border border-neutral-200/80 rounded-2xl p-8 text-center text-neutral-500 shadow-sm">
            <p className="font-medium text-neutral-600">No sales history found for this product.</p>
            <p className="text-sm text-neutral-400 mt-1">When this product is sold, the history logs will show up here.</p>
          </div>
        ) : (
          <div className="bg-white border border-neutral-200/80 rounded-2xl overflow-hidden shadow-sm">
            {/* Table layout for tablet/desktop, card list for mobile */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="min-w-full divide-y divide-neutral-200">
                <thead className="bg-neutral-50">
                  <tr>
                    <th scope="col" className="px-6 py-3.5 text-left text-xs font-bold text-neutral-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th scope="col" className="px-6 py-3.5 text-left text-xs font-bold text-neutral-500 uppercase tracking-wider">
                      Sold To
                    </th>
                    <th scope="col" className="px-6 py-3.5 text-left text-xs font-bold text-neutral-500 uppercase tracking-wider">
                      Sold By
                    </th>
                    <th scope="col" className="px-6 py-3.5 text-right text-xs font-bold text-neutral-500 uppercase tracking-wider">
                      Quantity Sold
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 bg-white">
                  {currentSales.map((item) => (
                    <tr key={item.id} className="hover:bg-neutral-50/50 transition-colors">
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-neutral-900 font-medium">
                        {item.sales?.sale_date ? new Date(item.sales.sale_date).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        }) : 'N/A'}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-neutral-600">
                        {item.sales?.sold_to || 'N/A'}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-neutral-600">
                        {item.sales?.sold_by || 'N/A'}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-bold text-neutral-900 text-right">
                        {item.quantity_sold} <span className="text-xs font-semibold text-neutral-500">{item.unit_type_at_sale}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile layout (cards list) */}
            <div className="sm:hidden divide-y divide-neutral-200">
              {currentSales.map((item) => (
                <div key={item.id} className="p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-neutral-900 flex items-center gap-1.5">
                      <Calendar className="h-4 w-4 text-neutral-400" />
                      {item.sales?.sale_date ? new Date(item.sales.sale_date).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      }) : 'N/A'}
                    </span>
                    <span className="text-sm font-black text-neutral-900">
                      {item.quantity_sold} <span className="text-xs font-semibold text-neutral-500">{item.unit_type_at_sale}</span>
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-neutral-500">
                    <div className="flex items-center gap-1">
                      <User className="h-3.5 w-3.5 text-neutral-400" />
                      <span>To: <strong>{item.sales?.sold_to || 'N/A'}</strong></span>
                    </div>
                    <div className="flex items-center gap-1">
                      <User className="h-3.5 w-3.5 text-neutral-400" />
                      <span>By: <strong>{item.sales?.sold_by || 'N/A'}</strong></span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="bg-neutral-50 border-t border-neutral-200/80 px-4 py-3 flex items-center justify-between sm:px-6">
                <div className="flex-1 flex justify-between sm:hidden">
                  <button
                    onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-4 py-2 border border-neutral-300 text-sm font-semibold rounded-lg text-neutral-700 bg-white hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px]"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="relative inline-flex items-center px-4 py-2 border border-neutral-300 text-sm font-semibold rounded-lg text-neutral-700 bg-white hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px]"
                  >
                    Next
                  </button>
                </div>
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-neutral-700">
                      Showing page <span className="font-bold">{currentPage}</span> of{' '}
                      <span className="font-bold">{totalPages}</span> ({salesHistory.length} total logs)
                    </p>
                  </div>
                  <div>
                    <nav className="relative z-0 inline-flex rounded-lg shadow-sm -space-x-px" aria-label="Pagination">
                      <button
                        onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className="relative inline-flex items-center px-2 py-2 rounded-l-lg border border-neutral-300 bg-white text-sm font-medium text-neutral-500 hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px]"
                      >
                        <span className="sr-only">Previous</span>
                        <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                      </button>
                      <button
                        onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        className="relative inline-flex items-center px-2 py-2 rounded-r-lg border border-neutral-300 bg-white text-sm font-medium text-neutral-500 hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px]"
                      >
                        <span className="sr-only">Next</span>
                        <ChevronRight className="h-5 w-5" aria-hidden="true" />
                      </button>
                    </nav>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
