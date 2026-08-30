-- ============================================================================
-- M-TEK FIRE & SAFETY LTD — Supabase initial schema (0001_init.sql)
-- Sections: people / inventory / billing / documents / core (settings+serials)
-- One Postgres project; tables are strictly sectioned and RLS-isolated.
-- MongoDB (separate databases per section in the cluster) holds MILS logs,
-- the document archive and the audit trail — see backend/api/README.md.
--
-- Deploy (from backend/.env):
--   psql "$SUPABASE_DB_URL" -v ceo_uid="$MTEK_CEO_UID" -v ceo_sig="$MTEK_CEO_SIG" \
--        -f supabase/migrations/0001_init.sql
--   (or) supabase db push   after copying into a supabase/CLI project
-- ============================================================================

create extension if not exists pgcrypto;

-- ===========================================================================
-- PEOPLE — profiles (staff identity + authority level)
-- ===========================================================================
create table if not exists public.profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  full_name         text not null default '',
  role              text not null default 'sales' check (role in ('ceo','admin','sales')),
  sig_passcode_hash text,
  signature_png     text,
  phone             text default '',
  created_at        timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)), 'sales')
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- CEO identity: hardcoded, never registered (owner directive 2026-08-30).
-- UID is fixed; role is forced back to 'ceo' on every deploy. The signature
-- passcode hash comes from the deploy script (:ceo_sig) — never stored in git.
insert into public.profiles (id, full_name, role)
values ('d9c7fd50-0a60-4a16-b4ab-041cb568a49b', 'CEO', 'ceo')
on conflict (id) do update set role = 'ceo';

-- ===========================================================================
-- INVENTORY — products & adjustments (edits: CEO/Admin only, enforced twice:
-- RLS on the table AND explicit checks inside the money RPCs)
-- ===========================================================================
create table if not exists public.products (
  id            text primary key,
  name          text not null,
  category      text not null default 'Fire',
  cost_price    numeric not null default 0 check (cost_price >= 0),
  selling_price numeric not null default 0 check (selling_price >= 0),
  qty_on_hand   integer not null default 0 check (qty_on_hand >= 0),
  reorder_level integer not null default 0 check (reorder_level >= 0),
  unit          text not null default 'unit',
  is_service    boolean not null default false,
  updated_at    timestamptz not null default now()
);

create table if not exists public.stock_adjustments (
  id         uuid primary key default gen_random_uuid(),
  product_id text not null references public.products(id),
  delta      integer not null,
  reason     text not null,
  note       text default '',
  by_user    uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- ===========================================================================
-- PEOPLE — customers (with signature capture)
-- ===========================================================================
create table if not exists public.customers (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  kind           text not null default 'individual' check (kind in ('individual','corporate')),
  phone          text default '',
  email          text default '',
  address        text default '',
  credit_balance numeric not null default 0 check (credit_balance >= 0),
  signature_png  text,
  created_by     uuid references public.profiles(id),
  created_at     timestamptz not null default now()
);

-- ===========================================================================
-- BILLING — sales / transactions / invoices / receipts
-- ===========================================================================
create table if not exists public.sales (
  id                 uuid primary key default gen_random_uuid(),
  customer_id        uuid references public.customers(id),
  method             text not null check (method in ('cash','transfer','pos','credit')),
  discount           numeric not null default 0 check (discount >= 0),
  total              numeric not null default 0,
  signed_by          uuid references public.profiles(id),
  signed_name        text default '',
  customer_signature text,
  created_at         timestamptz not null default now()
);

create table if not exists public.sale_items (
  id         uuid primary key default gen_random_uuid(),
  sale_id    uuid not null references public.sales(id) on delete cascade,
  product_id text not null references public.products(id),
  qty        numeric not null check (qty > 0),
  unit_price numeric not null
);

create table if not exists public.transactions (
  id         uuid primary key default gen_random_uuid(),
  txn_type   text not null check (txn_type in ('salePayment','invoicePayment','refund','expense','other')),
  method     text not null check (method in ('cash','transfer','pos','credit')),
  amount     numeric not null check (amount >= 0),
  reference  text default '',
  txn_date   timestamptz not null default now(),
  created_by uuid references public.profiles(id)
);

create table if not exists public.invoices (
  no                 text primary key,
  customer_id        uuid references public.customers(id),
  status             text not null default 'sent' check (status in ('draft','sent','partial','paid','overdue')),
  subtotal           numeric not null default 0,
  vat                numeric not null default 0,
  total              numeric not null default 0,
  amount_paid        numeric not null default 0 check (amount_paid >= 0),
  mils_ref           text default '',
  receipt_ref        text default '',
  lpo                text default '',
  issued_by          uuid references public.profiles(id),
  customer_signature text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table if not exists public.receipts (
  no                 text primary key,
  amount             numeric not null check (amount >= 0),
  method             text not null,
  source             text not null default 'sale',
  customer_id        uuid references public.customers(id),
  customer_name      text default '',
  issued_by          uuid references public.profiles(id),
  issued_name        text default '',
  customer_signature text,
  txn_id             uuid references public.transactions(id),
  created_at         timestamptz not null default now()
);

create table if not exists public.invoice_payments (
  id         uuid primary key default gen_random_uuid(),
  invoice_no text not null references public.invoices(no),
  amount     numeric not null check (amount > 0),
  method     text not null,
  receipt_no text references public.receipts(no),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- ===========================================================================
-- DOCUMENTS — serial counters (paper-book continuity) + issued-doc ledger
-- ===========================================================================
create table if not exists public.serials (
  doc_type  text primary key check (doc_type in ('receipt','invoice','mils','waybill','deliverynote','receiptIssue')),
  last_used bigint not null default 0
);

insert into public.serials (doc_type, last_used) values
  ('receipt', 2131), ('invoice', 4335), ('mils', 925),
  ('waybill', 174), ('deliverynote', 19790088), ('receiptIssue', 0)
on conflict (doc_type) do nothing;

create table if not exists public.document_issues (
  id          uuid primary key default gen_random_uuid(),
  doc_type    text not null check (doc_type in ('receipt','invoice','mils','waybill','deliverynote')),
  serial      bigint not null,
  customer    text default '—',
  total       numeric not null default 0,
  signed_by   uuid references public.profiles(id),
  signed_name text default '',
  verify_hash text default '',
  filename    text default '',
  issued_at   timestamptz not null default now()
);

-- ===========================================================================
-- CORE — settings singleton (seedable: CEO only)
-- ===========================================================================
create table if not exists public.settings (
  id          integer primary key default 1 check (id = 1),
  vat_enabled boolean not null default false,
  vat_rate    numeric not null default 0.075,
  watermark   boolean not null default true,
  updated_at  timestamptz not null default now()
);
insert into public.settings (id) values (1) on conflict (id) do nothing;

-- ===========================================================================
-- HELPER — current user's role (stable across policies & RPCs)
-- ===========================================================================
create or replace function public.mtek_my_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

-- ===========================================================================
-- RPC — signature passcode verification (server-side gate, never client-side)
-- ===========================================================================
create or replace function public.mtek_verify_signature(p_passcode text)
returns boolean language plpgsql security definer set search_path = public as $$
declare ok boolean;
begin
  select case
           when sig_passcode_hash is null or sig_passcode_hash = '' then false
           else crypt(p_passcode, sig_passcode_hash) = sig_passcode_hash
         end
    into ok from public.profiles where id = auth.uid();
  return coalesce(ok, false);
end $$;

-- Guard: nobody can change their own (or anyone's) role over the API.
-- Role changes happen only via the CEO account or service-role migrations.
create or replace function public.mtek_profiles_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if; -- service-role / migration context
  if new.role is distinct from old.role and public.mtek_my_role() <> 'ceo' then
    raise exception 'Only the CEO can change staff roles';
  end if;
  return new;
end $$;

drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard before update on public.profiles
  for each row execute function public.mtek_profiles_guard();

-- ===========================================================================
-- RPC — atomic document serial assignment (paper-book continuity)
-- Passcode is verified here too: a stolen JWT alone cannot issue documents.
-- ===========================================================================
create or replace function public.mtek_issue_document(
  p_type text, p_customer text, p_total numeric, p_verify_hash text, p_passcode text)
returns table (serial bigint, doc_type text)
language plpgsql security definer set search_path = public as $$
declare v_serial bigint; v_name text;
begin
  if not public.mtek_verify_signature(p_passcode) then
    raise exception 'Signature passcode does not match — document NOT issued';
  end if;
  if p_type not in ('receipt','invoice','mils','waybill','deliverynote') then
    raise exception 'Unknown document type';
  end if;
  update public.serials set last_used = last_used + 1 where doc_type = p_type returning last_used into v_serial;
  select full_name into v_name from public.profiles where id = auth.uid();
  insert into public.document_issues (doc_type, serial, customer, total, signed_by, signed_name, verify_hash, filename)
  values (p_type, v_serial, coalesce(nullif(trim(p_customer), ''), '—'), coalesce(p_total, 0), auth.uid(), v_name,
          coalesce(p_verify_hash, ''), 'mtek_' || p_type || '_' || v_serial || '_' ||
          extract(epoch from now())::bigint || '.pdf');
  return query select v_serial, p_type;
end $$;

-- ===========================================================================
-- RPC — complete a sale ATOMICALLY (stock check → decrement → sale + items
-- + transaction + receipt, one server transaction). Sales staff need NO
-- direct write access to inventory tables.
-- p_items jsonb: [{"product_id":"F002","qty":2}, ...]
-- ===========================================================================
create or replace function public.mtek_complete_sale(
  p_customer_id uuid, p_method text, p_items jsonb, p_discount numeric,
  p_customer_signature text, p_passcode text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_sale_id uuid; v_total numeric := 0; v_line numeric;
  v_price numeric; v_qty int; v_rec text; v_txn uuid; v_name text;
  v_is_credit boolean; v_item jsonb;
begin
  if not public.mtek_verify_signature(p_passcode) then
    raise exception 'Signature passcode does not match — sale NOT recorded';
  end if;
  if p_method not in ('cash','transfer','pos','credit') then
    raise exception 'Unknown payment method';
  end if;
  select full_name into v_name from public.profiles where id = auth.uid();

  -- validate + price the basket from server-side prices (never trust the client)
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'qty')::int;
    if v_qty is null or v_qty <= 0 then raise exception 'Invalid quantity'; end if;
    if not exists (select 1 from public.products where id = v_item->>'product_id') then
      raise exception 'Unknown product %', v_item->>'product_id';
    end if;
    if not (select is_service from public.products where id = v_item->>'product_id')
       and (select qty_on_hand from public.products where id = v_item->>'product_id') < v_qty then
      raise exception 'Only % of % in stock',
        (select qty_on_hand from public.products where id = v_item->>'product_id'),
        (select name from public.products where id = v_item->>'product_id');
    end if;
  end loop;

  insert into public.sales (customer_id, method, discount, total, signed_by, signed_name, customer_signature)
  values (p_customer_id, p_method, coalesce(p_discount, 0), 0, auth.uid(), v_name, p_customer_signature)
  returning id into v_sale_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    select selling_price, (v_item->>'qty')::int into v_price, v_qty
      from public.products where id = v_item->>'product_id';
    v_line := v_price * v_qty;
    v_total := v_total + v_line;
    insert into public.sale_items (sale_id, product_id, qty, unit_price)
    values (v_sale_id, v_item->>'product_id', v_qty, v_price);
    update public.products
      set qty_on_hand = qty_on_hand - v_qty, updated_at = now()
      where id = v_item->>'product_id' and is_service = false;
  end loop;

  v_total := greatest(v_total - coalesce(p_discount, 0), 0);
  update public.sales set total = v_total where id = v_sale_id;

  insert into public.transactions (txn_type, method, amount, reference, created_by)
  values ('salePayment', p_method, v_total, v_sale_id::text, auth.uid())
  returning id into v_txn;

  update public.serials set last_used = last_used + 1 where doc_type = 'receiptIssue'
    returning last_used into v_rec;
  v_rec := 'MTK-REC-' || lpad(v_rec::text, 4, '0');
  insert into public.receipts (no, amount, method, source, customer_id, issued_by, issued_name, customer_signature, txn_id)
  values (v_rec, v_total, p_method, 'sale', p_customer_id, auth.uid(), v_name, p_customer_signature, v_txn);

  return jsonb_build_object('sale_id', v_sale_id, 'total', v_total,
                            'receipt_no', v_rec, 'txn_id', v_txn);
end $$;

-- ===========================================================================
-- RPC — record an invoice payment (status → paid/partial, txn + receipt)
-- ===========================================================================
create or replace function public.mtek_pay_invoice(
  p_invoice_no text, p_amount numeric, p_method text, p_passcode text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_paid numeric; v_total numeric; v_rec text; v_txn uuid;
begin
  if not public.mtek_verify_signature(p_passcode) then
    raise exception 'Signature passcode does not match — payment NOT recorded';
  end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Payment must be positive'; end if;
  select total, amount_paid into v_total, v_paid from public.invoices where no = p_invoice_no;
  if not found then raise exception 'Unknown invoice %', p_invoice_no; end if;

  update public.invoices
    set amount_paid = least(amount_paid + p_amount, total),
        status = case when amount_paid + p_amount >= total then 'paid' else 'partial' end,
        updated_at = now()
    where no = p_invoice_no;

  insert into public.transactions (txn_type, method, amount, reference, created_by)
  values ('invoicePayment', p_method, p_amount, p_invoice_no, auth.uid())
  returning id into v_txn;

  update public.serials set last_used = last_used + 1 where doc_type = 'receiptIssue'
    returning last_used into v_rec;
  v_rec := 'MTK-REC-' || lpad(v_rec::text, 4, '0');
  insert into public.receipts (no, amount, method, source, customer_id, issued_by, issued_name, txn_id)
  select v_rec, p_amount, p_method, 'invoice', i.customer_id, auth.uid(), p.full_name, v_txn
    from public.invoices i, public.profiles p where i.no = p_invoice_no and p.id = auth.uid();

  insert into public.invoice_payments (invoice_no, amount, method, receipt_no, created_by)
  values (p_invoice_no, p_amount, p_method, v_rec, auth.uid());

  return jsonb_build_object('receipt_no', v_rec, 'status',
    case when v_paid + p_amount >= v_total then 'paid' else 'partial' end);
end $$;

-- ===========================================================================
-- RPC — stock adjustment (CEO/Admin ONLY — raised + RLS enforced)
-- ===========================================================================
create or replace function public.mtek_adjust_stock(
  p_product_id text, p_delta int, p_reason text, p_note text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.mtek_my_role() not in ('ceo','admin') then
    raise exception 'Only CEO or Admin can edit stock';
  end if;
  if not exists (select 1 from public.products where id = p_product_id) then
    raise exception 'Unknown product %', p_product_id;
  end if;
  if (select qty_on_hand from public.products where id = p_product_id) + p_delta < 0 then
    raise exception 'Adjustment would drive stock negative';
  end if;
  update public.products set qty_on_hand = qty_on_hand + p_delta, updated_at = now()
    where id = p_product_id;
  insert into public.stock_adjustments (product_id, delta, reason, note, by_user)
  values (p_product_id, p_delta, p_reason, coalesce(p_note, ''), auth.uid());
end $$;

-- ===========================================================================
-- RPC — settings update (CEO ONLY — seeding authority)
-- ===========================================================================
create or replace function public.mtek_update_settings(
  p_vat_enabled boolean, p_vat_rate numeric, p_watermark boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.mtek_my_role() <> 'ceo' then
    raise exception 'Only the CEO can change settings or seed data';
  end if;
  update public.settings set
    vat_enabled = coalesce(p_vat_enabled, vat_enabled),
    vat_rate    = coalesce(p_vat_rate, vat_rate),
    watermark   = coalesce(p_watermark, watermark),
    updated_at  = now()
  where id = 1;
end $$;

-- ===========================================================================
-- RPC — serial reseed (CEO ONLY; continues the physical books)
-- ===========================================================================
create or replace function public.mtek_reseed_serial(p_type text, p_last_used bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.mtek_my_role() <> 'ceo' then
    raise exception 'Only the CEO can reseed document serials';
  end if;
  if p_last_used is null or p_last_used < 0 then raise exception 'Invalid serial value'; end if;
  insert into public.serials (doc_type, last_used) values (p_type, p_last_used)
  on conflict (doc_type) do update set last_used = excluded.last_used;
end $$;

-- ===========================================================================
-- RLS — enable everywhere, then section policies
-- ===========================================================================
alter table public.profiles         enable row level security;
alter table public.products         enable row level security;
alter table public.stock_adjustments enable row level security;
alter table public.customers        enable row level security;
alter table public.sales            enable row level security;
alter table public.sale_items       enable row level security;
alter table public.transactions     enable row level security;
alter table public.invoices         enable row level security;
alter table public.receipts         enable row level security;
alter table public.invoice_payments enable row level security;
alter table public.serials          enable row level security;
alter table public.document_issues  enable row level security;
alter table public.settings         enable row level security;

-- profiles: read own (+ mgmt reads staff), update own non-privileged fields
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.mtek_my_role() in ('ceo','admin'));
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid() or public.mtek_my_role() = 'ceo')
  with check (id = auth.uid() or public.mtek_my_role() = 'ceo');

-- business data: all authenticated staff read; writes only through RPCs
-- (no insert/update/delete policies = writes blocked at the table, done server-side)
do $$
declare t text;
begin
  foreach t in array array['products','customers','sales','sale_items','transactions',
                           'invoices','receipts','invoice_payments','serials',
                           'document_issues','settings','stock_adjustments']
  loop
    execute format('drop policy if exists %I_select on public.%I;', t, t);
    execute format('create policy %I_select on public.%I for select to authenticated using (true);', t, t);
  end loop;
end $$;

-- inventory section: products/adjustments stay read-only to staff via RLS —
-- stock EDITS flow through mtek_adjust_stock / direct table writes below.
-- CEO/Admin may also edit products directly (bulk seed import):
drop policy if exists products_mgmt_write on public.products;
create policy products_mgmt_write on public.products for all to authenticated
  using (public.mtek_my_role() in ('ceo','admin'))
  with check (public.mtek_my_role() in ('ceo','admin'));

-- customers: staff may add (recorded sales need customers)
drop policy if exists customers_insert on public.customers;
create policy customers_insert on public.customers for insert to authenticated
  with check (true);

-- ============================================================================
-- NOTE: MongoDB databases (separate per section, same cluster — see backend/api):
--   mtek_mils      → service logs (MILS) + photos metadata
--   mtek_documents → issued-document archive (PDF metadata + payloads)
--   mtek_audit     → audit trail events
-- ============================================================================
