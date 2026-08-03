'use strict';
'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import Fuse from 'fuse.js';
import { ArrowLeft, Search, Check, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface Product {
  id: string;
  name: string;
  category: string | null;
  unit_type: 'kg' | 'pieces' | 'box' | 'bag';
  current_quantity: number;
}

function ReceiveStockContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedProductId = searchParams.get('product_id');
  const supabase = createClient();

  // Product Selection States
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Form Fields
  const [quantity, setQuantity] = useState('');
  const [receivedFrom, setReceivedFrom] = useState('');
  const [receivedBy, setReceivedBy] = useState('');
  const [receiptDate, setReceiptDate] = useState(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });
  const [notes, setNotes] = useState('');
  
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [saving, setSaving] = useState(false);

  // Fetch Products
  useEffect(() => {
    async function fetchProducts() {
      try {
        const { data, error } = await supabase
          .from('products')
          .select('id, name, category, unit_type, current_quantity')
          .order('name', { ascending: true });

        if (error) throw error;
        const prodList = data || [];
        setProducts(prodList);
        setFilteredProducts(prodList);

        // Pre-select if query param exists
        if (preselectedProductId) {
          const match = prodList.find((p) => p.id === preselectedProductId);
          if (match) {
            setSelectedProduct(match);
            setSearchQuery(match.name);
          }
        }
      } catch (err: any) {
        toast.error('Failed to load products list.');
        console.error(err);
      } finally {
        setLoadingProducts(false);
      }
    }
    fetchProducts();
  }, [supabase, preselectedProductId]);

  // Handle fuzzy searching on dropdown
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredProducts(products);
      return;
    }

    // If search matches the selected product name exactly, don't filter down
    if (selectedProduct && selectedProduct.name === searchQuery) {
      return;
    }

    const fuse = new Fuse(products, {
      keys: ['name', 'category'],
      threshold: 0.3,
    });

    const results = fuse.search(searchQuery).map((res) => res.item);
    setFilteredProducts(results);
  }, [searchQuery, products, selectedProduct]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleProductSelect = (product: Product) => {
    setSelectedProduct(product);
    setSearchQuery(product.name);
    setDropdownOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedProduct) {
      toast.error('Please select a product');
      return;
    }

    const qty = parseFloat(quantity);
    if (isNaN(qty)) {
      toast.error('Please enter a valid quantity');
      return;
    }

    if (qty === 0) {
      toast.error('Quantity cannot be zero');
      return;
    }

    if (!receivedBy.trim()) {
      toast.error("Please enter the receiver's name ('Received By')");
      return;
    }

    // Safety check for negative correction
    if (qty < 0 && (selectedProduct.current_quantity + qty) < 0) {
      toast.error(`Adjustment would result in negative stock. Current stock is ${selectedProduct.current_quantity} ${selectedProduct.unit_type}.`);
      return;
    }

    setSaving(true);
    try {
      const { data: receiptId, error } = await supabase.rpc('receive_stock', {
        p_product_id: selectedProduct.id,
        p_quantity: qty,
        p_received_from: receivedFrom.trim() || null,
        p_received_by: receivedBy.trim(),
        p_receipt_date: receiptDate,
        p_notes: notes.trim() || null,
      });

      if (error) {
        throw error;
      }

      toast.success('Stock received and updated successfully!');
      router.refresh();
      router.push('/admin');
    } catch (err: any) {
      toast.error(err.message || 'Failed to record stock receipt');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full px-4 py-8">
      {/* Back button */}
      <div className="mb-6">
        <Link
          href="/admin"
          className="inline-flex items-center text-sm font-semibold text-neutral-600 hover:text-neutral-900 transition-colors cursor-pointer py-2 min-h-[44px]"
        >
          <ArrowLeft className="mr-2 h-5 w-5" /> Back to Dashboard
        </Link>
      </div>

      <div className="bg-white border border-neutral-200/80 rounded-2xl p-6 sm:p-8 shadow-sm">
        <h1 className="text-2xl font-black text-neutral-900 tracking-tight mb-2">
          Receive Stock (Inflow)
        </h1>
        <p className="text-sm text-neutral-500 mb-8">
          Log warehouse incoming shipments or perform stock corrections. All changes are logged into the audit log.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Searchable Product Dropdown Picker */}
          <div className="relative" ref={dropdownRef}>
            <label className="block text-sm font-bold text-neutral-700 mb-2">
              Select Product *
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-neutral-400" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setDropdownOpen(true);
                  if (selectedProduct && e.target.value !== selectedProduct.name) {
                    setSelectedProduct(null);
                  }
                }}
                onFocus={() => setDropdownOpen(true)}
                className="block w-full pl-10 pr-4 py-3 border border-neutral-300 rounded-lg bg-white text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900 text-base"
                placeholder={loadingProducts ? 'Loading products...' : 'Type product name or category...'}
                disabled={loadingProducts}
              />
            </div>

            {/* Dropdown Items */}
            {dropdownOpen && !loadingProducts && (
              <div className="absolute z-50 mt-1 w-full rounded-lg bg-white border border-neutral-200 shadow-lg max-h-60 overflow-y-auto">
                {filteredProducts.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-neutral-500">
                    No products found
                  </div>
                ) : (
                  filteredProducts.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleProductSelect(p)}
                      className="w-full text-left px-4 py-3 text-sm hover:bg-neutral-50 transition-colors flex items-center justify-between border-b border-neutral-100 last:border-0 min-h-[44px]"
                    >
                      <div>
                        <p className="font-bold text-neutral-900">{p.name}</p>
                        <p className="text-xs text-neutral-500">
                          {p.category ? `${p.category} • ` : ''}Current: {p.current_quantity} {p.unit_type}
                        </p>
                      </div>
                      {selectedProduct?.id === p.id && (
                        <Check className="h-4 w-4 text-neutral-900" />
                      )}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Form inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="recv-qty" className="block text-sm font-bold text-neutral-700">
                Quantity Received * {selectedProduct && `(Unit: ${selectedProduct.unit_type})`}
              </label>
              <input
                type="number"
                id="recv-qty"
                step="any"
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="mt-1.5 block w-full border border-neutral-300 rounded-lg p-3 bg-white text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900 text-base"
                placeholder="E.g., 50 or -5 for correction"
              />
            </div>

            <div>
              <label htmlFor="recv-date" className="block text-sm font-bold text-neutral-700">
                Date *
              </label>
              <input
                type="date"
                id="recv-date"
                required
                value={receiptDate}
                onChange={(e) => setReceiptDate(e.target.value)}
                className="mt-1.5 block w-full border border-neutral-300 rounded-lg p-3 bg-white text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900 text-base h-[50px]"
              />
            </div>

            <div>
              <label htmlFor="recv-from" className="block text-sm font-bold text-neutral-700">
                Received From / Supplier (Optional)
              </label>
              <input
                type="text"
                id="recv-from"
                value={receivedFrom}
                onChange={(e) => setReceivedFrom(e.target.value)}
                className="mt-1.5 block w-full border border-neutral-300 rounded-lg p-3 bg-white text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900 text-base"
                placeholder="E.g., ABC Supplier Ltd"
              />
            </div>

            <div>
              <label htmlFor="recv-by" className="block text-sm font-bold text-neutral-700">
                Received By (Receiver Name) *
              </label>
              <input
                type="text"
                id="recv-by"
                required
                value={receivedBy}
                onChange={(e) => setReceivedBy(e.target.value)}
                className="mt-1.5 block w-full border border-neutral-300 rounded-lg p-3 bg-white text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900 text-base"
                placeholder="E.g., John Doe"
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="recv-notes" className="block text-sm font-bold text-neutral-700">
                Notes / Explanation (Optional)
              </label>
              <textarea
                id="recv-notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1.5 block w-full border border-neutral-300 rounded-lg p-3 bg-white text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900 text-base"
                placeholder="Write any additional details, or reason for correction..."
              />
            </div>
          </div>

          <div className="pt-4 border-t border-neutral-100 flex items-center justify-end gap-3">
            <Link
              href="/admin"
              className="inline-flex items-center justify-center px-5 py-3 border border-neutral-300 rounded-xl text-base font-semibold text-neutral-700 bg-white hover:bg-neutral-50 transition-colors cursor-pointer min-h-[48px]"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center px-5 py-3 border border-transparent rounded-xl text-base font-semibold text-white bg-neutral-900 hover:bg-neutral-850 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-neutral-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all min-h-[48px]"
            >
              {saving ? (
                <>
                  <Loader2 className="animate-spin mr-2 h-5 w-5" /> Saving...
                </>
              ) : (
                'Log Receipt'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ReceiveStockPage() {
  return (
    <Suspense fallback={
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="animate-spin h-8 w-8 text-neutral-500" />
      </div>
    }>
      <ReceiveStockContent />
    </Suspense>
  );
}
