-- ============================================================
-- FitGrowX — Tabla planes
-- Ejecutar en Supabase SQL Editor DESPUÉS de 20260411_alumnos.sql
-- ============================================================

create table if not exists planes (
  id           uuid primary key default gen_random_uuid(),
  gym_id       uuid not null references gyms(id) on delete cascade,
  nombre       text not null,
  precio       numeric(10,2) not null default 0,
  periodo      text not null default 'mes',        -- 'mes' | 'año'
  features     text[] not null default '{}',
  destacado    boolean not null default false,
  accent_color text,                                -- color hex para UI, ej: '#F97316'
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index on planes (gym_id);

-- Reutiliza set_updated_at (ya creada en alumnos migration)
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger planes_updated_at
  before update on planes
  for each row execute function set_updated_at();

-- Row Level Security
alter table planes enable row level security;

create policy "gym owner reads own planes"
  on planes for select
  using (gym_id = (select gym_id from profiles where id = auth.uid()));

create policy "gym owner inserts planes"
  on planes for insert
  with check (gym_id = (select gym_id from profiles where id = auth.uid()));

create policy "gym owner updates planes"
  on planes for update
  using (gym_id = (select gym_id from profiles where id = auth.uid()));

create policy "gym owner deletes planes"
  on planes for delete
  using (gym_id = (select gym_id from profiles where id = auth.uid()));

-- ============================================================
-- Agregar plan_id a alumnos para integridad referencial
-- ============================================================
alter table alumnos add column if not exists plan_id uuid references planes(id) on delete set null;
create index if not exists alumnos_plan_id_idx on alumnos (plan_id);
