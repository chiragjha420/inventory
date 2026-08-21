'use strict';
'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import Fuse from 'fuse.js';
import confetti from 'canvas-confetti';
import { ArrowLeft, Search, Plus, Trash2, Check, Package, Loader2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface Product {
  id: string;
  name: string;
  category: string | null;
  image_url: string | null;
  unit_type: 'kg' | 'pieces' | 'box' | 'bag' | 'bundle' | 'set';
  current_quantity: number;
}

interface SaleItemInput {
  product: Product;
  quantity: number;
}

function LogSaleContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedProductId = searchParams.get('product_id');
  const supabase = createClient();

  // Data states
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedItems, setSelectedItems] = useState<SaleItemInput[]>([]);
  
  // Modal / Dropdown selection search
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Form Metadata
  const [sentTo, setSentTo] = useState('');
  const [sentBy, setSentBy] = useState('');
  const [soldBy, setSoldBy] = useState('');
  const [saleDate, setSaleDate] = useState(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });

  const [loadingProducts, setLoadingProducts] = useState(true);
  const [saving, setSaving] = useState(false);

  // Fetch Products
  useEffect(() => {
    async function fetchProducts() {
      try {
        const { data, error } = await supabase
          .from('products')
          .select('id, name, category, image_url, unit_type, current_quantity')
          .order('name', { ascending: true });

        if (error) throw error;
        setProducts(data || []);
      } catch (err: any) {
        toast.error('Failed to load products.');
        console.error(err);
      } finally {
        setLoadingProducts(false);
      }
    }
    fetchProducts();
  }, [supabase]);

  // Pre-load product if query param is set
  useEffect(() => {
    if (products.length > 0 && preselectedProductId) {
      const match = products.find((p) => p.id === preselectedProductId);
      if (match) {
        // Prevent duplicate pre-addition
        if (!selectedItems.some((item) => item.product.id === match.id)) {
          setSelectedItems([{ product: match, quantity: 1 }]);
        }
      }
    }
  }, [products, preselectedProductId]);

  // Fuzzy search selector logic
  useEffect(() => {
    if (!searchQuery.trim()) {
      // Exclude already added products from selection dropdown
      const unselected = products.filter(
        (p) => !selectedItems.some((item) => item.product.id === p.id)
      );
      setFilteredProducts(unselected);
      return;
    }

    const unselected = products.filter(
      (p) => !selectedItems.some((item) => item.product.id === p.id)
    );

    const fuse = new Fuse(unselected, {
      keys: ['name', 'category'],
      threshold: 0.3,
    });

    const results = fuse.search(searchQuery).map((res) => res.item);
    setFilteredProducts(results);
  }, [searchQuery, products, selectedItems]);

  // Click outside picker to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setPickerOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getImageUrl = (path: string | null) => {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    const { data } = supabase.storage.from('product-images').getPublicUrl(path);
    return data.publicUrl;
  };

  const handleAddItem = (product: Product) => {
    setSelectedItems((prev) => [...prev, { product, quantity: 1 }]);
    setSearchQuery('');
    setPickerOpen(false);
  };

  const handleRemoveItem = (index: number) => {
    setSelectedItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleQuantityChange = (index: number, val: string) => {
    const num = parseFloat(val);
    setSelectedItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, quantity: isNaN(num) ? 0 : num } : item))
    );
  };

  // Perform checks
  const validateForm = () => {
    if (!sentTo.trim()) {
      toast.error('"Sent To" customer/destination name is required');
      return false;
    }
    if (!sentBy.trim()) {
      toast.error('"Sent By" sender/dispatcher name is required');
      return false;
    }
    if (!soldBy.trim()) {
      toast.error('"Sold By" salesperson name is required');
      return false;
    }
    if (selectedItems.length === 0) {
      toast.error('Please add at least one product to the sale');
      return false;
    }

    // Check stock for each item client-side
    for (const item of selectedItems) {
      if (item.quantity <= 0) {
        toast.error(`Quantity for product "${item.product.name}" must be greater than zero`);
        return false;
      }
      if (item.quantity > item.product.current_quantity) {
        toast.error(`Insufficient stock for "${item.product.name}". Available: ${item.product.current_quantity}`);
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setSaving(true);
    try {
      // Structure the payload for the RPC function log_sale(p_sent_to, p_sent_by, p_sold_by, p_sale_date, p_items)
      const saleItemsPayload = selectedItems.map((item) => ({
        product_id: item.product.id,
        quantity: item.quantity,
      }));

      const { data: saleId, error } = await supabase.rpc('log_sale', {
        p_sent_to: sentTo.trim(),
        p_sent_by: sentBy.trim(),
        p_sold_by: soldBy.trim(),
        p_sale_date: saleDate,
        p_items: saleItemsPayload,
      });

      if (error) {
        throw error;
      }

      // Confetti WOW factor!
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 },
      });

      toast.success('Sale logged successfully!');
      
      // Reset form
      setSelectedItems([]);
      setSentTo('');
      setSentBy('');
      setSoldBy('');
      
      router.refresh();
      router.push('/admin');
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit sale');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  // Check if any product is invalid (quantity > stock or quantity <= 0)
  const hasValidationErrors = selectedItems.some(
    (item) => item.quantity <= 0 || item.quantity > item.product.current_quantity
  );

  return (
    <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full px-4 py-8">
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
          Log a Sale (Outflow)
        </h1>
        <p className="text-sm text-neutral-500 mb-8">
          Enter customer details and add products to log stock outflow. The transaction is atomic and will fail if stock is insufficient.
        </p>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Sale details header */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 border-b border-neutral-100 pb-6">
            <div>
              <label htmlFor="sale-to" className="block text-sm font-bold text-neutral-700">
                Sent To (Customer) *
              </label>
              <input
                type="text"
                id="sale-to"
                required
                value={sentTo}
                onChange={(e) => setSentTo(e.target.value)}
                className="mt-1.5 block w-full border border-neutral-300 rounded-lg p-3 bg-white text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900 text-base"
                placeholder="Customer or company name"
              />
            </div>

            <div>
              <label htmlFor="sent-by" className="block text-sm font-bold text-neutral-700">
                Sent By *
              </label>
              <input
                type="text"
                id="sent-by"
                required
                value={sentBy}
                onChange={(e) => setSentBy(e.target.value)}
                className="mt-1.5 block w-full border border-neutral-300 rounded-lg p-3 bg-white text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900 text-base"
                placeholder="Sender's name"
              />
            </div>

            <div>
              <label htmlFor="sale-by" className="block text-sm font-bold text-neutral-700">
                Sold By (Salesperson) *
              </label>
              <input
                type="text"
                id="sale-by"
                required
                value={soldBy}
                onChange={(e) => setSoldBy(e.target.value)}
                className="mt-1.5 block w-full border border-neutral-300 rounded-lg p-3 bg-white text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900 text-base"
                placeholder="Salesperson name"
              />
            </div>

            <div>
              <label htmlFor="sale-date" className="block text-sm font-bold text-neutral-700">
                Date *
              </label>
              <input
                type="date"
                id="sale-date"
                required
                value={saleDate}
                onChange={(e) => setSaleDate(e.target.value)}
                className="mt-1.5 block w-full border border-neutral-300 rounded-lg p-3 bg-white text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900 text-base h-[50px]"
              />
            </div>
          </div>

          {/* Sale Items List */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-neutral-900">Sale Products List</h2>
              
              {/* Product Picker trigger dropdown button */}
              <div className="relative" ref={pickerRef}>
                <button
                  type="button"
                  onClick={() => setPickerOpen((prev) => !prev)}
                  className="inline-flex items-center px-4 py-2 border border-neutral-300 rounded-lg text-sm font-bold text-neutral-700 bg-white hover:bg-neutral-50 transition-colors cursor-pointer min-h-[40px]"
                  disabled={loadingProducts}
                >
                  <Plus className="mr-1.5 h-4 w-4 text-neutral-600" /> Add Product
                </button>

                {pickerOpen && (
                  <div className="absolute right-0 mt-1 w-72 rounded-lg bg-white border border-neutral-200 shadow-xl z-50 p-2">
                    <div className="relative mb-2">
                      <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                        <Search className="h-4 w-4 text-neutral-400" />
                      </div>
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search product name..."
                        className="block w-full pl-8 pr-3 py-1.5 border border-neutral-300 rounded-md bg-neutral-50 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-900"
                        autoFocus
                      />
                    </div>

                    <div className="max-h-48 overflow-y-auto divide-y divide-neutral-100">
                      {filteredProducts.length === 0 ? (
                        <p className="p-3 text-xs text-neutral-500 text-center">No products left to select</p>
                      ) : (
                        filteredProducts.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => handleAddItem(p)}
                            className="w-full text-left px-2 py-2.5 hover:bg-neutral-50 text-xs flex justify-between items-center transition-colors min-h-[38px] rounded"
                          >
                            <div className="pr-2">
                              <p className="font-semibold text-neutral-900 line-clamp-1">{p.name}</p>
                              <p className="text-[10px] text-neutral-400">Stock: {p.current_quantity} {p.unit_type}</p>
                            </div>
                            <span className="shrink-0 bg-neutral-100 text-neutral-600 font-medium px-1.5 py-0.5 rounded text-[9px]">
                              {p.unit_type}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Render selected items rows */}
            {selectedItems.length === 0 ? (
              <div className="border border-dashed border-neutral-200 rounded-xl p-8 text-center text-neutral-400">
                <Package className="h-8 w-8 mx-auto stroke-[1.2] text-neutral-300 mb-2" />
                <p className="text-sm font-semibold">No products added yet</p>
                <p className="text-xs text-neutral-400 mt-1">Tap 'Add Product' above to build the sale.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {selectedItems.map((item, index) => {
                  const itemImgUrl = getImageUrl(item.product.image_url);
                  const isExceeded = item.quantity > item.product.current_quantity;
                  const isZeroOrNegative = item.quantity <= 0;

                  return (
                    <div
                      key={item.product.id}
                      className={`flex items-center gap-4 p-4 bg-neutral-50 border rounded-xl transition-all ${
                        isExceeded ? 'border-red-200 bg-red-50/10' : 'border-neutral-200/80 bg-white'
                      }`}
                    >
                      {/* Image Thumbnail */}
                      <div className="h-14 w-14 shrink-0 bg-neutral-100 border border-neutral-200/80 rounded-lg overflow-hidden flex items-center justify-center">
                        {itemImgUrl ? (
                          <img src={itemImgUrl} alt={item.product.name} className="h-full w-full object-cover" />
                        ) : (
                          <Package className="h-6 w-6 text-neutral-400 stroke-[1.2]" />
                        )}
                      </div>

                      {/* Product details */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-neutral-900 line-clamp-1">{item.product.name}</p>
                        <p className="text-xs text-neutral-500 mt-0.5">
                          Available: <strong>{item.product.current_quantity} {item.product.unit_type}</strong>
                        </p>
                      </div>

                      {/* Quantity input */}
                      <div className="w-28 shrink-0">
                        <div className="relative rounded-md shadow-sm">
                          <input
                            type="number"
                            min="0.1"
                            step="any"
                            value={item.quantity === 0 ? '' : item.quantity}
                            onChange={(e) => handleQuantityChange(index, e.target.value)}
                            className={`block w-full pr-10 border rounded-lg p-2.5 bg-white text-neutral-900 focus:outline-none focus:ring-1 text-sm ${
                              isExceeded || isZeroOrNegative
                                ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                                : 'border-neutral-300 focus:ring-neutral-950 focus:border-neutral-950'
                            }`}
                          />
                          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                            <span className="text-xs font-semibold text-neutral-400">{item.product.unit_type}</span>
                          </div>
                        </div>
                      </div>

                      {/* Delete Action button */}
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(index)}
                        className="p-2.5 text-neutral-450 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer min-h-[40px] min-w-[40px]"
                        title="Remove product"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Inline warning summary */}
            {hasValidationErrors && (
              <div className="mt-4 p-3 bg-red-50 border border-red-150 rounded-lg flex items-center text-xs text-red-700 gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>Some items have incorrect quantities. Ensure quantity is greater than 0 and does not exceed available stock.</span>
              </div>
            )}
          </div>

          {/* Form Actions footer */}
          <div className="pt-4 border-t border-neutral-100 flex items-center justify-end gap-3">
            <Link
              href="/admin"
              className="inline-flex items-center justify-center px-5 py-3 border border-neutral-300 rounded-xl text-base font-semibold text-neutral-700 bg-white hover:bg-neutral-50 transition-colors cursor-pointer min-h-[48px]"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving || hasValidationErrors || selectedItems.length === 0}
              className="inline-flex items-center justify-center px-5 py-3 border border-transparent rounded-xl text-base font-bold text-white bg-neutral-900 hover:bg-neutral-850 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-neutral-900 disabled:opacity-40 disabled:cursor-not-allowed transition-all min-h-[48px]"
            >
              {saving ? (
                <>
                  <Loader2 className="animate-spin mr-2 h-5 w-5" /> Submitting...
                </>
              ) : (
                'Submit Sale'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function LogSalePage() {
  return (
    <Suspense fallback={
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="animate-spin h-8 w-8 text-neutral-500" />
      </div>
    }>
      <LogSaleContent />
    </Suspense>
  );
}
