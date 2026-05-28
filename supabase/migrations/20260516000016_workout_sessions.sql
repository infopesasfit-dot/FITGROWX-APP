create table if not exists workout_sessions (
  id            uuid        primary key default gen_random_uuid(),
  alumno_id     uuid        not null references alumnos(id) on delete cascade,
  gym_id        uuid        not null,
  fecha         date        not null default current_date,
  rutina_nombre text,
  series_log    jsonb       not null default '{}',
  completada    boolean     not null default false,
  offline       boolean     not null default false,
  created_at    timestamptz not null default now(),
  unique (alumno_id, fecha)
);

alter table workout_sessions enable row level security;

-- Staff/admin read their gym's sessions
create policy "staff_read_workout_sessions" on workout_sessions
  for select using (
    gym_id in (
      select gym_id from profiles where id = auth.uid() and role in ('admin', 'staff')
    )
  );
