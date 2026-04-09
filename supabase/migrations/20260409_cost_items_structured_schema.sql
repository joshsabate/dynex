create table if not exists public.cost_items (
  id text primary key,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  internal_id text,
  item_name text not null default '',
  core_name text not null default '',
  item_type text not null default '',
  work_type text not null default '',
  delivery_type text not null default '',
  item_family text not null default '',
  trade_id text,
  trade text not null default '',
  cost_code_id text,
  cost_code text not null default '',
  specification text not null default '',
  grade_or_quality text not null default '',
  finish_or_variant text not null default '',
  brand text not null default '',
  unit_id text,
  unit text not null default '',
  unit_cost numeric not null default 0,
  image_url text not null default '',
  status text not null default 'Active',
  is_active boolean not null default true,
  internal_note text not null default '',
  source_link text not null default '',
  labour_hours_per_unit numeric,
  is_taxable boolean not null default true,
  is_optional boolean not null default false,
  sort_order integer not null default 0,
  description text not null default '',
  cost_data jsonb not null default '{}'::jsonb
);

alter table public.cost_items add column if not exists created_at timestamptz not null default timezone('utc', now());
alter table public.cost_items add column if not exists updated_at timestamptz not null default timezone('utc', now());
alter table public.cost_items add column if not exists internal_id text;
alter table public.cost_items add column if not exists item_name text not null default '';
alter table public.cost_items add column if not exists core_name text not null default '';
alter table public.cost_items add column if not exists item_type text not null default '';
alter table public.cost_items add column if not exists work_type text not null default '';
alter table public.cost_items add column if not exists delivery_type text not null default '';
alter table public.cost_items add column if not exists item_family text not null default '';
alter table public.cost_items add column if not exists trade_id text;
alter table public.cost_items add column if not exists trade text not null default '';
alter table public.cost_items add column if not exists cost_code_id text;
alter table public.cost_items add column if not exists cost_code text not null default '';
alter table public.cost_items add column if not exists specification text not null default '';
alter table public.cost_items add column if not exists grade_or_quality text not null default '';
alter table public.cost_items add column if not exists finish_or_variant text not null default '';
alter table public.cost_items add column if not exists brand text not null default '';
alter table public.cost_items add column if not exists unit_id text;
alter table public.cost_items add column if not exists unit text not null default '';
alter table public.cost_items add column if not exists unit_cost numeric not null default 0;
alter table public.cost_items add column if not exists image_url text not null default '';
alter table public.cost_items add column if not exists status text not null default 'Active';
alter table public.cost_items add column if not exists is_active boolean not null default true;
alter table public.cost_items add column if not exists internal_note text not null default '';
alter table public.cost_items add column if not exists source_link text not null default '';
alter table public.cost_items add column if not exists labour_hours_per_unit numeric;
alter table public.cost_items add column if not exists is_taxable boolean not null default true;
alter table public.cost_items add column if not exists is_optional boolean not null default false;
alter table public.cost_items add column if not exists sort_order integer not null default 0;
alter table public.cost_items add column if not exists description text not null default '';
alter table public.cost_items add column if not exists cost_data jsonb not null default '{}'::jsonb;

alter table public.cost_items
  alter column internal_id type text using internal_id::text;

update public.cost_items
set
  internal_id = coalesce(nullif(btrim(internal_id), ''), id::text),
  core_name = coalesce(nullif(core_name, ''), nullif(item_name, '')),
  delivery_type = coalesce(nullif(delivery_type, ''), nullif(work_type, '')),
  work_type = coalesce(nullif(work_type, ''), nullif(delivery_type, '')),
  status = case
    when nullif(status, '') is not null then status
    when is_active = false then 'Inactive'
    else 'Active'
  end,
  is_active = case
    when status = 'Inactive' then false
    else coalesce(is_active, true)
  end,
  internal_note = coalesce(nullif(internal_note, ''), nullif(description, ''), ''),
  description = coalesce(nullif(description, ''), nullif(internal_note, ''), ''),
  item_family = coalesce(item_family, ''),
  trade = coalesce(trade, ''),
  cost_code = coalesce(cost_code, ''),
  specification = coalesce(specification, ''),
  grade_or_quality = coalesce(grade_or_quality, ''),
  finish_or_variant = coalesce(finish_or_variant, ''),
  brand = coalesce(brand, ''),
  unit = coalesce(unit, ''),
  image_url = coalesce(image_url, ''),
  source_link = coalesce(source_link, ''),
  sort_order = coalesce(sort_order, 0),
  cost_data = case
    when cost_data = '{}'::jsonb then jsonb_build_object(
      'id', id::text,
      'internalId', coalesce(nullif(btrim(internal_id), ''), id::text, ''),
      'coreName', coalesce(nullif(core_name, ''), nullif(item_name, ''), ''),
      'itemName', coalesce(item_name, ''),
      'costType', coalesce(item_type, ''),
      'deliveryType', coalesce(nullif(delivery_type, ''), nullif(work_type, ''), ''),
      'workType', coalesce(nullif(work_type, ''), nullif(delivery_type, ''), ''),
      'itemFamily', coalesce(item_family, ''),
      'family', coalesce(item_family, ''),
      'tradeId', coalesce(trade_id::text, ''),
      'trade', coalesce(trade, ''),
      'costCodeId', coalesce(cost_code_id::text, ''),
      'costCode', coalesce(cost_code, ''),
      'specification', coalesce(specification, ''),
      'spec', coalesce(specification, ''),
      'gradeOrQuality', coalesce(grade_or_quality, ''),
      'grade', coalesce(grade_or_quality, ''),
      'finishOrVariant', coalesce(finish_or_variant, ''),
      'finish', coalesce(finish_or_variant, ''),
      'brand', coalesce(brand, ''),
      'unitId', coalesce(unit_id::text, ''),
      'unit', coalesce(unit, ''),
      'rate', coalesce(unit_cost, 0),
      'imageUrl', coalesce(image_url, ''),
      'status', case when coalesce(is_active, true) = false then 'Inactive' else 'Active' end,
      'isActive', coalesce(is_active, true),
      'notes', coalesce(nullif(internal_note, ''), nullif(description, ''), ''),
      'sourceLink', coalesce(source_link, ''),
      'labourHoursPerUnit', labour_hours_per_unit,
      'isTaxable', coalesce(is_taxable, true),
      'isOptional', coalesce(is_optional, false),
      'sortOrder', coalesce(sort_order, 0)
    )
    else cost_data
  end;

create index if not exists cost_items_sort_order_item_name_idx
  on public.cost_items (sort_order, item_name);

drop index if exists public.cost_items_internal_id_idx;

create unique index if not exists cost_items_internal_id_idx
  on public.cost_items (internal_id);

create index if not exists cost_items_trade_id_idx
  on public.cost_items (trade_id);

create index if not exists cost_items_cost_code_id_idx
  on public.cost_items (cost_code_id);

create or replace function public.set_cost_items_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists cost_items_set_updated_at on public.cost_items;

create trigger cost_items_set_updated_at
before update on public.cost_items
for each row
execute function public.set_cost_items_updated_at();
