-- Database Schema Update (Migration V5)

-- 1. Create the sync_products_from_sheet function
create or replace function sync_products_from_sheet(p_products jsonb)
returns jsonb as $$
declare
  v_item jsonb;
  v_id uuid;
  v_name text;
  v_unit_type text;
  v_qty numeric;
  v_created_products jsonb := '[]'::jsonb;
begin
  for v_item in select * from jsonb_array_elements(p_products) loop
    v_id := null;
    if v_item->>'id' is not null and v_item->>'id' <> '' then
      begin
        v_id := (v_item->>'id')::uuid;
      exception when others then
        v_id := null;
      end;
    end if;
    
    v_name := v_item->>'name';
    v_unit_type := v_item->>'unit_type';
    v_qty := (v_item->>'current_quantity')::numeric;

    -- Normalize unit type to match constraints
    if v_unit_type not in ('kg', 'pieces', 'box', 'bag', 'bundle', 'set') then
      v_unit_type := 'pieces';
    end if;

    if v_qty is null or v_qty < 0 then
      v_qty := 0;
    end if;

    if v_id is not null and exists (select 1 from products where id = v_id) then
      -- Update existing product
      update products
      set name = v_name,
          unit_type = v_unit_type,
          current_quantity = v_qty,
          updated_at = now()
      where id = v_id;
    else
      -- Insert new product
      insert into products (name, unit_type, current_quantity)
      values (v_name, v_unit_type, v_qty)
      returning id into v_id;

      v_created_products := v_created_products || jsonb_build_object('name', v_name, 'id', v_id);
    end if;
  end loop;

  return v_created_products;
end;
$$ language plpgsql security definer;
