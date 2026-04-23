-- ============================================================
-- FitGrowX — Tabla pagos
-- Ejecutar en Supabase SQL Editor
-- ============================================================

create table if not exists pagos (
  id         uuid          primary key default gen_random_uuid(),
  gym_id     uuid          not null references gyms(id)    on delete cascade,
  alumno_id  uuid          not null references alumnos(id) on delete cascade,
  amount     numeric(12,2) not null,
  date       date          not null default current_date,
  created_at timestamptz   not null default now()
);

create index on pagos (gym_id);
create index on pagos (alumno_id);
create index on pagos (date);

alter table pagos enable row level security;

create policy "gym owner reads own pagos"
  on pagos for select
  using (gym_id = (select gym_id from profiles where id = auth.uid()));

create policy "gym owner inserts pagos"
  on pagos for insert
  with check (gym_id = (select gym_id from profiles where id = auth.uid()));

create policy "gym owner deletes pagos"
  on pagos for delete
  using (gym_id = (select gym_id from profiles where id = auth.uid()));
