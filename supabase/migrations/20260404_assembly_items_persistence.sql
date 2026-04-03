create table if not exists public.assembly_items (
  id text primary key,
  assembly_id text not null references public.assemblies(id) on delete cascade,
  line_name text not null default '',
  cost_item_id text not null default '',
  cost_item_name text not null default '',
  quantity_formula text not null default '',
  qty_rule text not null default '',
  waste_factor numeric,
  unit_override text not null default '',
  rate_override numeric,
  trade_source text not null default 'inherit',
  trade_id text not null default '',
  cost_code_source text not null default 'inherit',
  cost_code_id text not null default '',
  unit_source text not null default 'inherit',
  notes text not null default '',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  item_data jsonb not null default '{}'::jsonb
);

create index if not exists assembly_items_assembly_id_idx
  on public.assembly_items (assembly_id, sort_order, line_name);

alter table public.assemblies add column if not exists sort_order integer not null default 0;
alter table public.assemblies add column if not exists is_active boolean not null default true;
