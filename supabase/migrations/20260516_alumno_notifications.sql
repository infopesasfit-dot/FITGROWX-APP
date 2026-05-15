create table if not exists alumno_notifications (
  id          uuid primary key default gen_random_uuid(),
  alumno_id   uuid not null references alumnos(id) on delete cascade,
  gym_id      uuid not null references gyms(id)    on delete cascade,
  type        text not null,          -- 'cuota_vencimiento' | 'rutina_asignada' | 'clase_cancelada' | 'general'
  title       text not null,
  body        text,
  link        text,
  leida       boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists alumno_notifications_alumno_id_idx on alumno_notifications(alumno_id, created_at desc);

-- Staff can insert; alumno token auth reads via API (no RLS needed for service-role client)
alter table alumno_notifications enable row level security;

-- Allow service role full access (API routes use admin client which bypasses RLS)
create policy "service_role_all" on alumno_notifications
  using (true)
  with check (true);
