create table if not exists public.alumno_activity_log (
  id          uuid primary key default gen_random_uuid(),
  gym_id      uuid not null,
  alumno_id   uuid not null,
  type        text not null,
  description text not null,
  actor       text,
  metadata    jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists alumno_activity_log_alumno_idx
  on public.alumno_activity_log (alumno_id, created_at desc);

alter table public.alumno_activity_log enable row level security;

drop policy if exists "gym_activity_log_select" on public.alumno_activity_log;
drop policy if exists "gym_activity_log_insert" on public.alumno_activity_log;

create policy "gym_activity_log_select"
  on public.alumno_activity_log for select
  using (gym_id = auth.uid());

create policy "gym_activity_log_insert"
  on public.alumno_activity_log for insert
  with check (gym_id = auth.uid());
