-- Database Schema Update (Migration V2)

-- 1. Rename existing columns in sales table
alter table sales rename column sold_to to sent_to;
alter table sales rename column sold_by to received_by;

-- 2. Add new sold_by column representing the salesperson
alter table sales add column sold_by text;

-- Fill in default values for existing records using the received_by column value
update sales set sold_by = received_by where sold_by is null;

-- Enforce NOT NULL constraint on the new column
alter table sales alter column sold_by set not null;

-- 3. Recreate the log_sale function with the updated parameters and columns
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
