-- ============================================================
-- FitGrowX — Tabla alumnos
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- Tipo enum para estado (n8n puede filtrar por este campo directamente)
create type estado_alumno as enum ('Activo', 'Vencido', 'Pendiente');

-- Tipo enum para plan
create type plan_alumno as enum ('Basico', 'Premium', 'Anual');

create table if not exists alumnos (
  id                uuid primary key default gen_random_uuid(),
  gym_id            uuid not null references gyms(id) on delete cascade,

  -- Datos personales
  nombre            text not null,
  email             text,
  telefono          text,               -- Formato internacional: 5491112345678 (sin + ni espacios)
                                        -- n8n lo usa para enviar WhatsApp via Twilio / WA Business API

  -- Membresía
  plan              plan_alumno not null default 'Basico',
  estado            estado_alumno not null default 'Pendiente',
                                        -- n8n filtra: estado = 'Vencido' → disparar recordatorio
  fecha_vencimiento date,

  -- Asistencia (para automatización anti-churn)
  ultima_asistencia date,               -- n8n compara: now() - ultima_asistencia > 10 días → "Te extrañamos"

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Índices útiles para los queries de n8n
create index on alumnos (gym_id);
create index on alumnos (estado);
create index on alumnos (fecha_vencimiento);
create index on alumnos (ultima_asistencia);

-- Trigger para updated_at automático
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

-- Row Level Security: cada gym solo ve sus propios alumnos
alter table alumnos enable row level security;

create policy "gym owner reads own alumnos"
  on alumnos for select
  using (
    gym_id = (
      select gym_id from profiles where id = auth.uid()
    )
  );

create policy "gym owner inserts alumnos"
  on alumnos for insert
  with check (
    gym_id = (
      select gym_id from profiles where id = auth.uid()
    )
  );

create policy "gym owner updates alumnos"
  on alumnos for update
  using (
    gym_id = (
      select gym_id from profiles where id = auth.uid()
    )
  );

create policy "gym owner deletes alumnos"
  on alumnos for delete
  using (
    gym_id = (
      select gym_id from profiles where id = auth.uid()
    )
  );

-- ============================================================
-- Vista para n8n — alumnos_para_recordatorio
-- n8n puede hacer un GET a esta vista directamente via API
-- Filtra alumnos cuya cuota vence en exactamente 3 días
-- ============================================================
create or replace view alumnos_para_recordatorio as
  select
    a.id,
    a.nombre,
    a.telefono,
    a.email,
    a.plan,
    a.fecha_vencimiento,
    g.name as gym_nombre
  from alumnos a
  join gyms g on g.id = a.gym_id
  where
    a.estado = 'Activo'
    and a.fecha_vencimiento = current_date + interval '3 days';

-- ============================================================
-- Vista para n8n — alumnos_sin_asistencia
-- Alumnos activos sin asistencia por más de 10 días
-- ============================================================
create or replace view alumnos_sin_asistencia as
  select
    a.id,
    a.nombre,
    a.telefono,
    a.email,
    a.ultima_asistencia,
    g.name as gym_nombre
  from alumnos a
  join gyms g on g.id = a.gym_id
  where
    a.estado = 'Activo'
    and (
      a.ultima_asistencia is null
      or a.ultima_asistencia < current_date - interval '10 days'
    );
