create table if not exists public.estimate_share_links (
  id uuid primary key default gen_random_uuid(),
  estimate_id text not null default '',
  share_id text not null unique,
  version integer not null default 1,
  status text not null default 'active',
  project_snapshot jsonb not null default '{}'::jsonb,
  rows_snapshot jsonb not null default '[]'::jsonb,
  sections_snapshot jsonb not null default '[]'::jsonb,
  project_rooms_snapshot jsonb not null default '[]'::jsonb,
  generated_row_section_assignments jsonb not null default '{}'::jsonb,
  presentation_settings jsonb not null default '{}'::jsonb,
  expires_at timestamptz,
  password_hash text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists estimate_share_links_estimate_id_idx
  on public.estimate_share_links (estimate_id, updated_at desc);

create index if not exists estimate_share_links_status_idx
  on public.estimate_share_links (status, updated_at desc);
