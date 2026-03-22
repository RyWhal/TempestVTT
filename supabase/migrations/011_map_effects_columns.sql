alter table public.maps
  add column if not exists effects_enabled boolean not null default false,
  add column if not exists effect_data jsonb not null default '[]'::jsonb;
