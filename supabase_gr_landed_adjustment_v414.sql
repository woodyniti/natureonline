-- v4.14.0: additive landed-cost corrections for an already posted GR.
-- Run once in Supabase SQL Editor before using the new button.
-- No historical rows are rewritten by this migration. Backup before applying.
-- Rollback (only after retiring the UI): DROP FUNCTION public.add_gr_landed_cost(uuid,text,numeric,text,text,numeric,uuid);
-- Keep the audit table/column for accounting history; do not delete posted corrections.

alter table public.landed_costs add column if not exists gr_no text;

create table if not exists public.gr_landed_adjustments (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id),
  gr_no text not null,
  amount numeric not null check (amount > 0),
  cost_type text not null,
  reason text not null,
  allocations jsonb not null default '[]'::jsonb,
  request_id uuid not null unique,
  created_by uuid not null,
  created_at timestamptz not null default now()
);
alter table public.gr_landed_adjustments enable row level security;
grant select on public.gr_landed_adjustments to authenticated;
drop policy if exists gr_landed_adjustments_read on public.gr_landed_adjustments;
create policy gr_landed_adjustments_read on public.gr_landed_adjustments
  for select to authenticated using (
    exists (select 1 from public.shops s where s.id=shop_id and s.owner_id=auth.uid())
    or exists (select 1 from public.shop_members m where m.shop_id=gr_landed_adjustments.shop_id
      and m.user_id=auth.uid() and coalesce(m.active,true))
  );

create or replace function public.add_gr_landed_cost(
  p_shop_id uuid, p_gr_no text, p_amount numeric, p_cost_type text,
  p_reason text, p_expected_total numeric, p_request_id uuid
) returns jsonb
language plpgsql security definer set search_path=public,pg_temp
as $$
declare
  v_move record;
  v_weight numeric;
  v_weight_total numeric;
  v_qty_total numeric;
  v_old_total numeric;
  v_new_total numeric;
  v_remaining numeric;
  v_share numeric;
  v_index integer := 0;
  v_count integer;
  v_allocations jsonb := '[]'::jsonb;
  v_product_ids uuid[];
begin
  if auth.uid() is null then raise exception 'กรุณาเข้าสู่ระบบ'; end if;
  if not (
    exists (select 1 from public.shops s where s.id=p_shop_id and s.owner_id=auth.uid())
    or exists (select 1 from public.shop_members m where m.shop_id=p_shop_id
      and m.user_id=auth.uid() and coalesce(m.active,true) and m.role in ('owner','admin'))
  ) then raise exception 'เฉพาะ Owner/Admin ที่ปรับต้นทุนย้อนหลังได้'; end if;
  if p_gr_no !~ '^GR-[A-Z0-9-]+$' then raise exception 'เลขใบรับเข้าไม่รองรับการปรับต้นทุนย้อนหลัง'; end if;
  if p_amount is null or p_amount<=0 or p_amount>10000000 or p_amount<>round(p_amount,2) then
    raise exception 'ยอด Landed Cost ต้องเป็นบวกและมีทศนิยมไม่เกิน 2 ตำแหน่ง';
  end if;
  if length(trim(coalesce(p_reason,'')))<3 then raise exception 'กรุณาระบุเหตุผลอย่างน้อย 3 ตัวอักษร'; end if;
  if length(trim(coalesce(p_cost_type,'')))<2 then raise exception 'กรุณาระบุประเภทค่าใช้จ่าย'; end if;
  if p_request_id is null then raise exception 'ไม่มีรหัสคำขอ กรุณารีเฟรช'; end if;
  if exists (select 1 from public.gr_landed_adjustments a where a.request_id=p_request_id
    and a.shop_id=p_shop_id and a.gr_no=p_gr_no and a.amount=p_amount
    and a.cost_type=trim(p_cost_type) and a.reason=trim(p_reason)) then
    return jsonb_build_object('gr_no',p_gr_no,'added',p_amount,'already_applied',true);
  end if;
  if exists (select 1 from public.gr_landed_adjustments a where a.request_id=p_request_id) then
    raise exception 'รหัสคำขอนี้ใช้กับรายการอื่นแล้ว';
  end if;

  -- Lock exactly this posted receipt; any failure rolls the whole RPC back.
  perform 1 from public.stock_movements m
    where m.shop_id=p_shop_id and m.move_type='in'
      and m.note like 'GR|'||p_gr_no||'|%'
    for update;
  select count(*),coalesce(sum(m.qty),0),coalesce(sum(m.qty*m.cost_per_unit),0),
         coalesce(sum(greatest(0,m.qty*m.cost_per_unit)),0),array_agg(distinct m.product_id)
    into v_count,v_qty_total,v_old_total,v_weight_total,v_product_ids
    from public.stock_movements m
    where m.shop_id=p_shop_id and m.move_type='in'
      and m.note like 'GR|'||p_gr_no||'|%';
  if v_count=0 or v_qty_total<=0 then raise exception 'ไม่พบรายการรับเข้าของเอกสารนี้'; end if;
  if p_expected_total is null or abs(v_old_total-p_expected_total)>0.02 then
    raise exception 'ต้นทุนเอกสารเปลี่ยนไปแล้ว กรุณารีเฟรชและตรวจอีกครั้ง';
  end if;

  v_remaining := p_amount;
  for v_move in
    select m.id,m.product_id,m.qty,m.cost_per_unit,m.other_cost,m.move_date,m.lot_name,m.po_id
      from public.stock_movements m
      where m.shop_id=p_shop_id and m.move_type='in'
        and m.note like 'GR|'||p_gr_no||'|%'
      order by m.id
  loop
    v_index := v_index+1;
    v_weight := case when v_weight_total>0
      then greatest(0,v_move.qty*v_move.cost_per_unit)/v_weight_total
      else v_move.qty/v_qty_total end;
    v_share := case when v_index=v_count then v_remaining else round(p_amount*v_weight,2) end;
    v_remaining := v_remaining-v_share;
    update public.stock_movements
      set cost_per_unit=round((v_move.qty*v_move.cost_per_unit+v_share)/v_move.qty,4),
          other_cost=round(coalesce(v_move.other_cost,0)+v_share,2)
      where id=v_move.id;
    v_allocations := v_allocations || jsonb_build_array(jsonb_build_object(
      'movement_id',v_move.id,'product_id',v_move.product_id,'qty',v_move.qty,
      'old_unit_cost',v_move.cost_per_unit,'new_unit_cost',round((v_move.qty*v_move.cost_per_unit+v_share)/v_move.qty,4),
      'added_landed',v_share));
  end loop;

  select coalesce(sum(m.qty*m.cost_per_unit),0) into v_new_total
    from public.stock_movements m
    where m.shop_id=p_shop_id and m.move_type='in'
      and m.note like 'GR|'||p_gr_no||'|%';
  if abs(v_new_total-v_old_total-p_amount)>0.02 then
    raise exception 'ความละเอียดต้นทุนต่อชิ้นไม่พอสำหรับยอดนี้ กรุณาเพิ่มยอดปรับหรือให้ผู้ดูแลตรวจสอบ';
  end if;

  insert into public.gr_landed_adjustments(shop_id,gr_no,amount,cost_type,reason,allocations,created_by,request_id)
    values(p_shop_id,p_gr_no,p_amount,trim(p_cost_type),trim(p_reason),v_allocations,auth.uid(),p_request_id);
  insert into public.landed_costs(shop_id,type,amount,note,lot_name,move_date,po_id,gr_no)
    select p_shop_id,trim(p_cost_type),p_amount,
      'ปรับย้อนหลัง GR '||p_gr_no||' · '||trim(p_reason),
      min(m.lot_name),min(m.move_date),
      (array_agg(m.po_id) filter (where m.po_id is not null))[1],p_gr_no
      from public.stock_movements m
      where m.shop_id=p_shop_id and m.note like 'GR|'||p_gr_no||'|%';

  -- Same weighted-average rule as recalcStockQty; quantity and PO receipts are unchanged.
  update public.products p set current_cost=costs.avg_cost
    from (
      select m.product_id,round(sum(m.qty*m.cost_per_unit)/nullif(sum(m.qty),0),2) as avg_cost
      from public.stock_movements m
      where m.shop_id=p_shop_id and m.product_id=any(v_product_ids)
        and m.move_type='in' and coalesce(m.note,'') not like '[ปรับยอดสต๊อก]%'
      group by m.product_id
    ) costs
    where p.id=costs.product_id and p.shop_id=p_shop_id;
  return jsonb_build_object('gr_no',p_gr_no,'added',p_amount,'items',v_count);
end;
$$;
revoke all on function public.add_gr_landed_cost(uuid,text,numeric,text,text,numeric,uuid) from public,anon;
grant execute on function public.add_gr_landed_cost(uuid,text,numeric,text,text,numeric,uuid) to authenticated;
