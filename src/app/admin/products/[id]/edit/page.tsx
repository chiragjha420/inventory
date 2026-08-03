'use strict';
'use client';

import { use, useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { compressImage } from '@/lib/utils/image';
import { ArrowLeft, Upload, Package, X, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [unitType, setUnitType] = useState<'kg' | 'pieces' | 'box' | 'bag'>('pieces');
  const [lowStockThreshold, setLowStockThreshold] = useState('');
  const [existingImagePath, setExistingImagePath] = useState<string | null>(null);
  
  const [imageFile, setImageFile] = useState<Blob | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function fetchProduct() {
      try {
        const { data, error } = await supabase
          .from('products')
          .select('id, name, category, image_url, unit_type, low_stock_threshold')
          .eq('id', id)
          .single();

        if (error) throw error;
        if (data) {
          setName(data.name);
          setCategory(data.category || '');
          setUnitType(data.unit_type as any);
          setLowStockThreshold(data.low_stock_threshold !== null ? String(data.low_stock_threshold) : '');
          setExistingImagePath(data.image_url);
          
          if (data.image_url) {
            const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(data.image_url);
            setImagePreview(urlData.publicUrl);
          }
        }
      } catch (err: any) {
        toast.error('Failed to load product details.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchProduct();
  }, [id, supabase]);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    setUploading(true);
    try {
      // Compress image client side
      const compressed = await compressImage(file, 800, 800, 0.8);
      setImageFile(compressed);
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(compressed);
    } catch (err: any) {
      toast.error('Error processing image.');
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    setUploading(true);
    try {
      const compressed = await compressImage(file, 800, 800, 0.8);
      setImageFile(compressed);
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(compressed);
    } catch (err: any) {
      toast.error('Error processing dropped image.');
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setExistingImagePath(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('Product name is required');
      return;
    }

    const threshold = lowStockThreshold.trim() ? parseFloat(lowStockThreshold) : null;
    if (threshold !== null && (isNaN(threshold) || threshold < 0)) {
      toast.error('Low stock threshold must be a positive number');
      return;
    }

    setSaving(true);
    try {
      let imagePath = existingImagePath;

      // 1. If a new image was selected, upload it
      if (imageFile) {
        const fileExt = 'jpg';
        const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
        const { data, error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(fileName, imageFile, {
            contentType: 'image/jpeg',
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) {
          throw uploadError;
        }
        imagePath = data.path;
      }

      // 2. Update the product database record
      // Notice: we do NOT include or update the 'current_quantity' here!
      const { error: updateError } = await supabase
        .from('products')
        .update({
          name: name.trim(),
          category: category.trim() || null,
          image_url: imagePath,
          unit_type: unitType,
          low_stock_threshold: threshold,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (updateError) {
        throw updateError;
      }

      toast.success('Product updated successfully!');
      router.refresh();
      router.push('/admin');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update product');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full px-4 py-8 space-y-6 animate-pulse">
        <div className="h-6 w-24 bg-neutral-200 rounded"></div>
        <div className="h-10 bg-neutral-200 rounded w-1/2"></div>
        <div className="aspect-video w-full bg-neutral-200 rounded-xl"></div>
        <div className="space-y-4">
          <div className="h-12 bg-neutral-200 rounded"></div>
          <div className="h-12 bg-neutral-200 rounded"></div>
        </div>
      </div>
    );
  }

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
          Edit Product Details
        </h1>
        <p className="text-sm text-neutral-500 mb-8">
          Update general details for this item. Quantity edits are blocked to ensure audit logs remain intact.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Drag & Drop Image Upload Container */}
          <div>
            <span className="block text-sm font-bold text-neutral-700 mb-2">
              Product Image
            </span>
            {imagePreview ? (
              <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-neutral-100 border border-neutral-200 flex items-center justify-center">
                <img src={imagePreview} alt="Preview" className="object-cover w-full h-full" />
                <button
                  type="button"
                  onClick={clearImage}
                  className="absolute top-3 right-3 p-2 bg-neutral-900/80 hover:bg-neutral-950 text-white rounded-full transition-colors"
                  title="Remove Image"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="aspect-video w-full rounded-xl border-2 border-dashed border-neutral-300 hover:border-neutral-400 bg-neutral-50/50 hover:bg-neutral-50 flex flex-col items-center justify-center cursor-pointer transition-all p-4 group"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageChange}
                  accept="image/*"
                  className="hidden"
                />
                {uploading ? (
                  <Loader2 className="animate-spin h-10 w-10 text-neutral-400" />
                ) : (
                  <>
                    <Upload className="h-10 w-10 text-neutral-400 group-hover:text-neutral-500 transition-colors stroke-[1.5]" />
                    <p className="mt-2 text-sm font-semibold text-neutral-700 text-center">
                      Drag & drop new photo, or click to browse
                    </p>
                    <p className="mt-1 text-xs text-neutral-400 text-center">
                      Auto-compressed (target &lt; 200KB)
                    </p>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Form Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label htmlFor="edit-name" className="block text-sm font-bold text-neutral-700">
                Product Name *
              </label>
              <input
                type="text"
                id="edit-name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1.5 block w-full border border-neutral-350 rounded-lg p-3 bg-white text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900 text-base"
                placeholder="E.g., Basmati Rice Premium"
              />
            </div>

            <div>
              <label htmlFor="edit-category" className="block text-sm font-bold text-neutral-700">
                Category (Optional)
              </label>
              <input
                type="text"
                id="edit-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1.5 block w-full border border-neutral-350 rounded-lg p-3 bg-white text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900 text-base"
                placeholder="E.g., Grains"
              />
            </div>

            <div>
              <label htmlFor="edit-unit" className="block text-sm font-bold text-neutral-700">
                Unit Type *
              </label>
              <select
                id="edit-unit"
                value={unitType}
                onChange={(e) => setUnitType(e.target.value as any)}
                className="mt-1.5 block w-full border border-neutral-350 rounded-lg p-3 bg-white text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900 text-base h-[50px]"
              >
                <option value="pieces">Pieces</option>
                <option value="kg">kg (Kilogram)</option>
                <option value="box">Box</option>
                <option value="bag">Bag</option>
              </select>
            </div>

            <div>
              <label htmlFor="edit-threshold" className="block text-sm font-bold text-neutral-700">
                Low Stock Threshold (Optional)
              </label>
              <input
                type="number"
                id="edit-threshold"
                min="0"
                step="any"
                value={lowStockThreshold}
                onChange={(e) => setLowStockThreshold(e.target.value)}
                className="mt-1.5 block w-full border border-neutral-350 rounded-lg p-3 bg-white text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900 text-base"
                placeholder="E.g., 10"
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
                'Save Changes'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
