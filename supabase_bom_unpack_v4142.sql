-- v4.14.2: turn purchased BOM boxes into their individual stock SKUs.
-- Run this schema/function migration in Supabase SQL Editor before using BOM unpack.
-- It does NOT change existing stock until an authenticated user confirms unpack in the app.
-- Rollback: retire the app button first; keep audit and stock movements as accounting history.

create table if not exists public.bom_unpack_audit (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id),
  source_movement_id uuid not null unique references public.stock_movements(id),
  kit_product_id uuid not null references public.products(id),
  box_qty numeric not null,
  kit_cost_total numeric not null,
  component_movements jsonb not null,
  created_by uuid not null,
  created_at timestamptz not null default now()
);
alter table public.bom_unpack_audit enable row level security;
grant select on public.bom_unpack_audit to authenticated;
drop policy if exists bom_unpack_audit_read on public.bom_unpack_audit;
create policy bom_unpack_audit_read on public.bom_unpack_audit for select to authenticated using (
  exists(select 1 from public.shops s where s.id=bom_unpack_audit.shop_id and s.owner_id=auth.uid())
  or exists(select 1 from public.shop_members m where m.shop_id=bom_unpack_audit.shop_id
    and m.user_id=auth.uid() and coalesce(m.active,true))
);

create or replace function public.unpack_bom_receipt(p_source_movement_id uuid, p_expected_qty numeric)
returns jsonb language plpgsql security definer set search_path=public,pg_temp
as $$
declare
  v_source public.stock_movements%rowtype;
  v_kit public.products%rowtype;
  v_component_product public.products%rowtype;
  v_bom jsonb;
  v_components jsonb;
  v_component jsonb;
  v_sku text;
  v_component_qty numeric;
  v_component_unit_cost numeric;
  v_weight numeric;
  v_weight_total numeric;
  v_use_cost_weights boolean;
  v_total_cost numeric;
  v_remaining_cost numeric;
  v_total_other numeric;
  v_movement_stock numeric;
  v_remaining_other numeric;
  v_other_share numeric;
  v_index integer := 0;
  v_count integer;
  v_match_count integer;
  v_out_id uuid;
  v_in_id uuid;
  v_postings jsonb := '[]'::jsonb;
  v_note_prefix text;
begin
  if auth.uid() is null then raise exception 'กรุณาเข้าสู่ระบบ'; end if;
  select * into v_source from public.stock_movements
    where id=p_source_movement_id and move_type='in' for update;
  if not found then raise exception 'ไม่พบรายการรับเข้ากล่อง BOM'; end if;
  if not (
    exists(select 1 from public.shops s where s.id=v_source.shop_id and s.owner_id=auth.uid())
    or exists(select 1 from public.shop_members m where m.shop_id=v_source.shop_id
      and m.user_id=auth.uid() and coalesce(m.active,true) and m.role in ('owner','admin'))
  ) then raise exception 'เฉพาะ Owner/Admin ที่แปลงสต๊อกกล่อง BOM ได้'; end if;
  if exists(select 1 from public.bom_unpack_audit a where a.source_movement_id=p_source_movement_id) then
    return jsonb_build_object('already_unpacked',true,'source_movement_id',p_source_movement_id);
  end if;
  if v_source.qty<=0 or v_source.qty<>trunc(v_source.qty)
    or p_expected_qty is null or v_source.qty<>p_expected_qty then
    raise exception 'จำนวนกล่องเปลี่ยนไป กรุณารีเฟรชและตรวจรายการรับเข้า';
  end if;
  if coalesce(v_source.note,'') not like 'GR|%' then
    raise exception 'รับแปลงเฉพาะกล่องที่มีเอกสารรับเข้า GR';
  end if;
  select * into v_kit from public.products
    where id=v_source.product_id and shop_id=v_source.shop_id for update;
  if not found then raise exception 'ไม่พบสินค้าแม่ BOM'; end if;
  -- The GR was just inserted; products.stock_qty is recalculated by the client later.
  select coalesce(sum(case when move_type='in' then qty when move_type='out' then -qty else 0 end),0)
    into v_movement_stock from public.stock_movements
    where shop_id=v_source.shop_id and product_id=v_kit.id;
  if v_movement_stock<v_source.qty then
    raise exception 'กล่อง BOM คงเหลือไม่พอแปลง (% กล่องตาม movement)',v_movement_stock;
  end if;
  v_sku := substring(coalesce(v_kit.application_note,'') from '\[\[BOM64:([A-Za-z0-9+/=]+)\]\]');
  if v_sku is null then raise exception 'สินค้าแม่ไม่มี BOM'; end if;
  v_bom := convert_from(decode(v_sku,'base64'),'UTF8')::jsonb;
  if (v_bom->>'stock_mode')<>'purchased_box' or (v_bom->>'version')<>'1'
    or jsonb_typeof(v_bom->'components')<>'array' then
    raise exception 'BOM ไม่ใช่ชุดกล่องที่รองรับ';
  end if;
  v_components := v_bom->'components';
  v_count := jsonb_array_length(v_components);
  if v_count=0 then raise exception 'BOM ไม่มีรายการชิ้นส่วน'; end if;
  select bool_and(coalesce((c->>'allocated_unit_cost')::numeric,0)>0)
    into v_use_cost_weights from jsonb_array_elements(v_components) c;
  select sum((c->>'qty')::numeric * case when v_use_cost_weights
    then (c->>'allocated_unit_cost')::numeric else 1 end)
    into v_weight_total from jsonb_array_elements(v_components) c;
  if coalesce(v_weight_total,0)<=0 then raise exception 'จำนวน/สัดส่วนต้นทุน BOM ไม่ถูกต้อง'; end if;
  v_total_cost := v_source.qty*coalesce(v_source.cost_per_unit,0);
  v_remaining_cost := v_total_cost;
  v_total_other := coalesce(v_source.other_cost,0);
  v_remaining_other := v_total_other;
  v_note_prefix := 'BOM_UNPACK|'||v_source.id::text||'|'||v_kit.sku||'|';

  -- Validate every SKU before writing any movements.
  for v_component in select value from jsonb_array_elements(v_components) loop
    v_sku := trim(v_component->>'sku');
    if v_sku='' or coalesce((v_component->>'qty')::numeric,0)<=0
      or (v_component->>'qty')::numeric<>trunc((v_component->>'qty')::numeric) then
      raise exception 'BOM มี SKU หรือจำนวนชิ้นส่วนไม่ถูกต้อง';
    end if;
    select count(*) into v_match_count from public.products p
      where p.shop_id=v_source.shop_id and p.sku=v_sku and p.active;
    if v_match_count>1 then
      raise exception 'SKU ชิ้นส่วนซ้ำในฐานข้อมูล: %',v_sku;
    end if;
    if v_match_count=0 then
      raise exception 'ไม่พบ SKU ชิ้นส่วน: %',v_sku;
    end if;
  end loop;

  insert into public.stock_movements(shop_id,product_id,move_type,qty,cost_per_unit,
    other_cost,lot_name,move_date,po_id,note)
  values(v_source.shop_id,v_kit.id,'out',v_source.qty,v_source.cost_per_unit,
    0,v_source.lot_name,v_source.move_date,v_source.po_id,v_note_prefix||'OUT')
  returning id into v_out_id;

  for v_component in select value from jsonb_array_elements(v_components) loop
    v_index := v_index+1;
    v_sku := trim(v_component->>'sku');
    select * into v_component_product from public.products
      where shop_id=v_source.shop_id and sku=v_sku and active for update;
    v_component_qty := v_source.qty*(v_component->>'qty')::numeric;
    v_weight := (v_component->>'qty')::numeric * case when v_use_cost_weights
      then (v_component->>'allocated_unit_cost')::numeric else 1 end;
    v_component_unit_cost := case when v_index=v_count
      then round(v_remaining_cost/v_component_qty,4)
      else round(v_total_cost*v_weight/v_weight_total/v_component_qty,4) end;
    v_remaining_cost := v_remaining_cost-v_component_unit_cost*v_component_qty;
    v_other_share := case when v_index=v_count then v_remaining_other
      else round(v_total_other*v_weight/v_weight_total,2) end;
    v_remaining_other := v_remaining_other-v_other_share;
    insert into public.stock_movements(shop_id,product_id,move_type,qty,cost_per_unit,
      other_cost,lot_name,move_date,po_id,note)
    values(v_source.shop_id,v_component_product.id,'in',v_component_qty,v_component_unit_cost,
      v_other_share,v_source.lot_name,v_source.move_date,v_source.po_id,v_note_prefix||v_sku)
    returning id into v_in_id;
    v_postings := v_postings||jsonb_build_array(jsonb_build_object('movement_id',v_in_id,
      'product_id',v_component_product.id,'sku',v_sku,'qty',v_component_qty,
      'unit_cost',v_component_unit_cost));
  end loop;
  if abs(v_remaining_cost)>0.03 or abs(v_remaining_other)>0.01 then
    raise exception 'ต้นทุนชิ้นส่วนหลังปัดเศษไม่ตรงกับต้นทุนกล่อง';
  end if;
  insert into public.bom_unpack_audit(shop_id,source_movement_id,kit_product_id,box_qty,
    kit_cost_total,component_movements,created_by)
  values(v_source.shop_id,v_source.id,v_kit.id,v_source.qty,v_total_cost,v_postings,auth.uid());
  return jsonb_build_object('source_movement_id',v_source.id,'kit_id',v_kit.id,
    'box_qty',v_source.qty,'out_movement_id',v_out_id,'components',v_postings);
end;
$$;
revoke all on function public.unpack_bom_receipt(uuid,numeric) from public,anon;
grant execute on function public.unpack_bom_receipt(uuid,numeric) to authenticated;
