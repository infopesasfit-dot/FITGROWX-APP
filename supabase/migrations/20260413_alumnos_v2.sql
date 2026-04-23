-- ============================================================
-- FitGrowX — Tabla alumnos (v2)
-- Reemplaza el esquema anterior. Ejecutar en Supabase SQL Editor.
-- ============================================================

-- 1. Limpiar objetos anteriores si existen
-- ============================================================
drop view  if exists alumnos_para_recordatorio;
drop view  if exists alumnos_sin_asistencia;
drop table if exists alumnos cascade;
drop type  if exists estado_alumno;
drop type  if exists plan_alumno;

-- 2. Tabla principal
-- ============================================================
create table alumnos (
  -- Identidad
  id                   uuid        primary key default gen_random_uuid(),

  -- Datos del gym al que pertenece
  gym_id               uuid        not null references gyms(id)  on delete cascade,

  -- Datos del alumno
  full_name            text        not null,
  phone                text,                       -- Formato E.164: 5491112345678
                                                   -- Fundamental para automatizaciones de WhatsApp

  -- Membresía
  plan_id              uuid        references planes(id) on delete set null,
  status               text        not null default 'pendiente'
                                   check (status in ('activo', 'vencido', 'pendiente')),

  -- Fechas de pago
  last_payment_date    date,
  next_expiration_date date,

  -- Auditoría
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- 3. Índices
-- ============================================================
create index on alumnos (gym_id);
create index on alumnos (status);
create index on alumnos (next_expiration_date);
create index on alumnos (plan_id);
create index on alumnos (phone);                   -- Lookups por teléfono para automatizaciones

-- 4. Trigger updated_at
-- ============================================================
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger alumnos_updated_at
  before update on alumnos
  for each row execute function set_updated_at();

-- 5. Row Level Security — cada gym solo ve sus propios alumnos
-- ============================================================
alter table alumnos enable row level security;

create policy "gym owner reads own alumnos"
  on alumnos for select
  using (
    gym_id = (select gym_id from profiles where id = auth.uid())
  );

create policy "gym owner inserts alumnos"
  on alumnos for insert
  with check (
    gym_id = (select gym_id from profiles where id = auth.uid())
  );

create policy "gym owner updates alumnos"
  on alumnos for update
  using (
    gym_id = (select gym_id from profiles where id = auth.uid())
  );

create policy "gym owner deletes alumnos"
  on alumnos for delete
  using (
    gym_id = (select gym_id from profiles where id = auth.uid())
  );

-- 6. Vistas para automatización
-- ============================================================

-- Alumnos cuya membresía vence en exactamente 3 días → envío de recordatorio
create or replace view alumnos_para_recordatorio as
  select
    a.id,
    a.full_name,
    a.phone,
    a.status,
    a.next_expiration_date,
    p.nombre  as plan_nombre,
    g.name    as gym_nombre
  from alumnos a
  left join planes p on p.id = a.plan_id
  join  gyms   g on g.id = a.gym_id
  where
    a.status = 'activo'
    and a.next_expiration_date = current_date + interval '3 days';

-- Alumnos con pago vencido → envío de mensaje de reactivación
create or replace view alumnos_vencidos as
  select
    a.id,
    a.full_name,
    a.phone,
    a.next_expiration_date,
    p.nombre  as plan_nombre,
    g.name    as gym_nombre
  from alumnos a
  left join planes p on p.id = a.plan_id
  join  gyms   g on g.id = a.gym_id
  where
    a.status = 'vencido';

-- Alumnos sin pago registrado en más de 35 días → detección temprana de churn
create or replace view alumnos_sin_pago_reciente as
  select
    a.id,
    a.full_name,
    a.phone,
    a.last_payment_date,
    a.next_expiration_date,
    g.name as gym_nombre
  from alumnos a
  join gyms g on g.id = a.gym_id
  where
    a.status = 'activo'
    and (
      a.last_payment_date is null
      or a.last_payment_date < current_date - interval '35 days'
    );
