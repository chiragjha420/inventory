-- Database Schema for Godown Inventory Management

-- Enable UUID extension (usually enabled by default in Supabase)
create extension if not exists "uuid-ossp";

-- 1. Create Products Table
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  image_url text,
  unit_type text not null constraint check_unit_type check (unit_type in ('kg', 'pieces', 'box', 'bag', 'bundle', 'set')),
  current_quantity numeric not null default 0 constraint check_current_quantity_non_negative check (current_quantity >= 0),
  low_stock_threshold numeric constraint check_low_stock_threshold_non_negative check (low_stock_threshold >= 0),
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

-- 2. Create Sales Table
create table if not exists sales (
  id uuid primary key default gen_random_uuid(),
  sent_to text not null,
  received_by text not null,
  sold_by text not null,
  sale_date date not null default current_date,
  created_at timestamp with time zone default now() not null
);

-- 3. Create Sale Items Table (FK to Sales and Products)
create table if not exists sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references sales(id) on delete cascade,
  product_id uuid not null references products(id) on delete restrict,
  quantity_sold numeric not null constraint check_quantity_sold_positive check (quantity_sold > 0),
  unit_type_at_sale text not null,
  created_at timestamp with time zone default now() not null
);

-- 4. Create Stock Receipts Table (FK to Products)
create table if not exists stock_receipts (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  quantity_received numeric not null, -- can be negative for corrections
  received_from text,
  received_by text not null,
  receipt_date date not null default current_date,
  notes text,
  created_at timestamp with time zone default now() not null
);

-- 5. Row Level Security Configuration
alter table products enable row level security;
alter table sales enable row level security;
alter table sale_items enable row level security;
alter table stock_receipts enable row level security;

-- Products Policies
drop policy if exists "Allow public read access to products" on products;
create policy "Allow public read access to products" on products
  for select using (true);

drop policy if exists "Allow auth admins full access to products" on products;
create policy "Allow auth admins full access to products" on products
  for all using (auth.role() = 'authenticated');

-- Sales Policies
drop policy if exists "Allow public read access to sales" on sales;
create policy "Allow public read access to sales" on sales
  for select using (true);

drop policy if exists "Allow auth admins full access to sales" on sales;
create policy "Allow auth admins full access to sales" on sales
  for all using (auth.role() = 'authenticated');

-- Sale Items Policies
drop policy if exists "Allow public read access to sale_items" on sale_items;
create policy "Allow public read access to sale_items" on sale_items
  for select using (true);

drop policy if exists "Allow auth admins full access to sale_items" on sale_items;
create policy "Allow auth admins full access to sale_items" on sale_items
  for all using (auth.role() = 'authenticated');

-- Stock Receipts Policies
drop policy if exists "Allow public read access to stock_receipts" on stock_receipts;
create policy "Allow public read access to stock_receipts" on stock_receipts
  for select using (true);

drop policy if exists "Allow auth admins full access to stock_receipts" on stock_receipts;
create policy "Allow auth admins full access to stock_receipts" on stock_receipts
  for all using (auth.role() = 'authenticated');

-- 6. Storage Bucket Configuration
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists "Allow public access to product-images" on storage.objects;
create policy "Allow public access to product-images" on storage.objects
  for select using (bucket_id = 'product-images');

drop policy if exists "Allow authenticated users to upload to product-images" on storage.objects;
create policy "Allow authenticated users to upload to product-images" on storage.objects
  for all using (bucket_id = 'product-images' and auth.role() = 'authenticated');

-- 7. Database Stored Functions for Transactional Atomicity

-- Log Sale Function
create or replace function log_sale(
  p_sent_to text,
  p_received_by text,
  p_sold_by text,
  p_sale_date date,
  p_items jsonb -- array of {product_id, quantity}
) returns uuid as $$
declare
  v_sale_id uuid;
  v_item jsonb;
  v_product_id uuid;
  v_quantity numeric;
  v_current_stock numeric;
  v_unit_type text;
begin
  -- Insert the parent sale record
  insert into sales (sent_to, received_by, sold_by, sale_date)
  values (p_sent_to, p_received_by, p_sold_by, p_sale_date)
  returning id into v_sale_id;

  -- Loop through each item in the sale
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_product_id := (v_item->>'product_id')::uuid;
    v_quantity := (v_item->>'quantity')::numeric;

    if v_quantity <= 0 then
      raise exception 'Quantity for product % must be greater than zero', v_product_id;
    end if;

    -- Lock the product row to prevent concurrency race conditions
    select current_quantity, unit_type into v_current_stock, v_unit_type
    from products
    where id = v_product_id
    for update;

    if not found then
      raise exception 'Product % not found', v_product_id;
    end if;

    if v_current_stock < v_quantity then
      raise exception 'Insufficient stock for product. Available: %, Requested: %', v_current_stock, v_quantity;
    end if;

    -- Decrement the stock quantity
    update products
    set current_quantity = current_quantity - v_quantity,
        updated_at = now()
    where id = v_product_id;

    -- Insert the individual sale item
    insert into sale_items (sale_id, product_id, quantity_sold, unit_type_at_sale)
    values (v_sale_id, v_product_id, v_quantity, v_unit_type);
  end loop;

  return v_sale_id;
end;
$$ language plpgsql security definer;

-- Receive Stock Function
create or replace function receive_stock(
  p_product_id uuid,
  p_quantity numeric,
  p_received_from text,
  p_received_by text,
  p_receipt_date date,
  p_notes text
) returns uuid as $$
declare
  v_receipt_id uuid;
  v_current_quantity numeric;
begin
  -- Lock the product row to check constraints/prevent conflicts
  select current_quantity into v_current_quantity
  from products
  where id = p_product_id
  for update;

  if not found then
    raise exception 'Product % not found', p_product_id;
  end if;

  if (v_current_quantity + p_quantity) < 0 then
    raise exception 'Correction would result in negative stock. Current: %, Correction: %', v_current_quantity, p_quantity;
  end if;

  -- Insert the receipt record
  insert into stock_receipts (product_id, quantity_received, received_from, received_by, receipt_date, notes)
  values (p_product_id, p_quantity, p_received_from, p_received_by, p_receipt_date, p_notes)
  returning id into v_receipt_id;

  -- Update the product quantity (can be positive or negative)
  update products
  set current_quantity = current_quantity + p_quantity,
      updated_at = now()
  where id = p_product_id;

  return v_receipt_id;
end;
$$ language plpgsql security definer;
