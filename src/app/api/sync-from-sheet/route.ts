import { createClient } from '@/lib/supabase/client';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { products } = body;

    if (!Array.isArray(products)) {
      return NextResponse.json({ status: 'error', message: 'Products array is required' }, { status: 400 });
    }

    const supabase = createClient();

    // Call the security definer RPC function to sync products
    const { data, error } = await supabase.rpc('sync_products_from_sheet', {
      p_products: products
    });

    if (error) {
      console.error('Database sync error:', error);
      return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
    }

    return NextResponse.json({
      status: 'success',
      createdProducts: data || []
    });
  } catch (err: any) {
    console.error('Webhook error:', err);
    return NextResponse.json({ status: 'error', message: err.message }, { status: 500 });
  }
}
