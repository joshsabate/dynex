create table if not exists public.units (
  id text primary key,
  name text not null default '',
  abbreviation text not null default '',
  sort_order integer not null default 0,
  is_active boolean not null default true
);

create table if not exists public.trades (
  id text primary key,
  name text not null default '',
  description text not null default '',
  status text not null default 'Active',
  sort_order integer not null default 0,
  is_active boolean not null default true
);

create table if not exists public.cost_codes (
  id text primary key,
  code text not null default '',
  name text not null default '',
  stage text not null default '',
  trade text not null default '',
  description text not null default '',
  status text not null default 'Active',
  sort_order integer not null default 0,
  is_active boolean not null default true
);

create table if not exists public.item_families (
  id text primary key,
  name text not null default '',
  sort_order integer not null default 0,
  is_active boolean not null default true
);

create table if not exists public.stages (
  id text primary key,
  name text not null default '',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  color text not null default '#d7aa5a'
);

create table if not exists public.elements (
  id text primary key,
  name text not null default '',
  sort_order integer not null default 0,
  is_active boolean not null default true
);

create table if not exists public.parameters (
  id text primary key,
  key text not null default '',
  label text not null default '',
  parameter_type text not null default '',
  input_type text not null default '',
  unit text not null default '',
  default_value jsonb,
  is_required boolean not null default false,
  sort_order integer,
  category text not null default '',
  formula text not null default '',
  description text not null default '',
  status text not null default 'Active'
);

create table if not exists public.room_types (
  id text primary key,
  name text not null default '',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  parameter_definitions jsonb not null default '[]'::jsonb
);

create table if not exists public.room_templates (
  id text primary key,
  name text not null default '',
  room_type_id text not null default '',
  room_type text not null default '',
  quantity numeric not null default 0,
  is_included boolean not null default true,
  template_data jsonb not null default '{}'::jsonb
);

create table if not exists public.assemblies (
  id text primary key,
  assembly_name text not null default '',
  room_type_id text not null default '',
  room_type text not null default '',
  assembly_group text not null default '',
  assembly_element text not null default '',
  assembly_scope text not null default '',
  assembly_spec text not null default '',
  image_url text not null default '',
  notes text not null default '',
  assembly_data jsonb not null default '{}'::jsonb
);

alter table public.units add column if not exists name text not null default '';
alter table public.units add column if not exists abbreviation text not null default '';
alter table public.units add column if not exists sort_order integer not null default 0;
alter table public.units add column if not exists is_active boolean not null default true;

alter table public.trades add column if not exists name text not null default '';
alter table public.trades add column if not exists description text not null default '';
alter table public.trades add column if not exists status text not null default 'Active';
alter table public.trades add column if not exists sort_order integer not null default 0;
alter table public.trades add column if not exists is_active boolean not null default true;

alter table public.cost_codes add column if not exists code text not null default '';
alter table public.cost_codes add column if not exists name text not null default '';
alter table public.cost_codes add column if not exists stage text not null default '';
alter table public.cost_codes add column if not exists trade text not null default '';
alter table public.cost_codes add column if not exists description text not null default '';
alter table public.cost_codes add column if not exists status text not null default 'Active';
alter table public.cost_codes add column if not exists sort_order integer not null default 0;
alter table public.cost_codes add column if not exists is_active boolean not null default true;

alter table public.item_families add column if not exists name text not null default '';
alter table public.item_families add column if not exists sort_order integer not null default 0;
alter table public.item_families add column if not exists is_active boolean not null default true;

alter table public.stages add column if not exists name text not null default '';
alter table public.stages add column if not exists sort_order integer not null default 0;
alter table public.stages add column if not exists is_active boolean not null default true;
alter table public.stages add column if not exists color text not null default '#d7aa5a';

alter table public.elements add column if not exists name text not null default '';
alter table public.elements add column if not exists sort_order integer not null default 0;
alter table public.elements add column if not exists is_active boolean not null default true;

alter table public.parameters add column if not exists key text not null default '';
alter table public.parameters add column if not exists label text not null default '';
alter table public.parameters add column if not exists parameter_type text not null default '';
alter table public.parameters add column if not exists input_type text not null default '';
alter table public.parameters add column if not exists unit text not null default '';
alter table public.parameters add column if not exists default_value jsonb;
alter table public.parameters add column if not exists is_required boolean not null default false;
alter table public.parameters add column if not exists sort_order integer;
alter table public.parameters add column if not exists category text not null default '';
alter table public.parameters add column if not exists formula text not null default '';
alter table public.parameters add column if not exists description text not null default '';
alter table public.parameters add column if not exists status text not null default 'Active';

alter table public.room_types add column if not exists name text not null default '';
alter table public.room_types add column if not exists sort_order integer not null default 0;
alter table public.room_types add column if not exists is_active boolean not null default true;
alter table public.room_types add column if not exists parameter_definitions jsonb not null default '[]'::jsonb;

alter table public.room_templates add column if not exists name text not null default '';
alter table public.room_templates add column if not exists room_type_id text not null default '';
alter table public.room_templates add column if not exists room_type text not null default '';
alter table public.room_templates add column if not exists quantity numeric not null default 0;
alter table public.room_templates add column if not exists is_included boolean not null default true;
alter table public.room_templates add column if not exists template_data jsonb not null default '{}'::jsonb;

alter table public.assemblies add column if not exists assembly_name text not null default '';
alter table public.assemblies add column if not exists room_type_id text not null default '';
alter table public.assemblies add column if not exists room_type text not null default '';
alter table public.assemblies add column if not exists assembly_group text not null default '';
alter table public.assemblies add column if not exists assembly_element text not null default '';
alter table public.assemblies add column if not exists assembly_scope text not null default '';
alter table public.assemblies add column if not exists assembly_spec text not null default '';
alter table public.assemblies add column if not exists image_url text not null default '';
alter table public.assemblies add column if not exists notes text not null default '';
alter table public.assemblies add column if not exists assembly_data jsonb not null default '{}'::jsonb;
