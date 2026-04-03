create table if not exists public.assembly_line_templates (
  id text primary key,
  name text not null default '',
  cost_item_id text not null default '',
  cost_item_name_snapshot text not null default '',
  default_formula text not null default '',
  default_qty_rule text not null default '',
  default_waste_factor numeric,
  default_unit text not null default '',
  default_rate_override numeric,
  trade_id text not null default '',
  cost_code_id text not null default '',
  room_type text not null default '',
  assembly_group text not null default '',
  assembly_element text not null default '',
  assembly_scope text not null default '',
  notes text not null default '',
  sort_order integer not null default 0,
  is_active boolean not null default true
);

alter table public.assembly_line_templates add column if not exists name text not null default '';
alter table public.assembly_line_templates add column if not exists cost_item_id text not null default '';
alter table public.assembly_line_templates add column if not exists cost_item_name_snapshot text not null default '';
alter table public.assembly_line_templates add column if not exists default_formula text not null default '';
alter table public.assembly_line_templates add column if not exists default_qty_rule text not null default '';
alter table public.assembly_line_templates add column if not exists default_waste_factor numeric;
alter table public.assembly_line_templates add column if not exists default_unit text not null default '';
alter table public.assembly_line_templates add column if not exists default_rate_override numeric;
alter table public.assembly_line_templates add column if not exists trade_id text not null default '';
alter table public.assembly_line_templates add column if not exists cost_code_id text not null default '';
alter table public.assembly_line_templates add column if not exists room_type text not null default '';
alter table public.assembly_line_templates add column if not exists assembly_group text not null default '';
alter table public.assembly_line_templates add column if not exists assembly_element text not null default '';
alter table public.assembly_line_templates add column if not exists assembly_scope text not null default '';
alter table public.assembly_line_templates add column if not exists notes text not null default '';
alter table public.assembly_line_templates add column if not exists sort_order integer not null default 0;
alter table public.assembly_line_templates add column if not exists is_active boolean not null default true;
