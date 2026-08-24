import { createClient } from './supabase/client';

export async function syncToGoogleSheets() {
  const scriptUrl = process.env.NEXT_PUBLIC_GOOGLE_APPS_SCRIPT_URL;
  if (!scriptUrl) {
    console.warn('Google Apps Script URL is not configured. Google Sheets sync is skipped.');
    return;
  }

  try {
    const supabase = createClient();
    
    // Fetch current state of all products in database
    const { data: products, error } = await supabase
      .from('products')
      .select('id, name, unit_type, current_quantity')
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching products for sheets sync:', error);
      return;
    }

    // Trigger post request to Google Apps Script Web App
    const response = await fetch(scriptUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'sync_all',
        products: products || []
      }),
      // Keep it non-blocking
      mode: 'cors'
    });

    const result = await response.json();
    if (result.status !== 'success') {
      console.error('Google Sheets Web App responded with error:', result.message);
    }
  } catch (err) {
    console.error('Failed to sync database to Google Sheets:', err);
  }
}
