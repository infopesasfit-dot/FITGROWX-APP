-- Storage bucket for progress photos (private, 10 MB max, images only)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('progreso-fotos', 'progreso-fotos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do nothing;

-- Table to store photo metadata
create table if not exists progreso_fotos (
  id         uuid        primary key default gen_random_uuid(),
  alumno_id  uuid        not null references alumnos(id) on delete cascade,
  gym_id     uuid        not null,
  storage_path text      not null,
  fecha      date        not null default current_date,
  notas      text,
  created_at timestamptz not null default now()
);

alter table progreso_fotos enable row level security;

-- Staff/admin of the same gym can read
create policy "staff_read_progreso_fotos" on progreso_fotos
  for select using (
    gym_id in (
      select gym_id from profiles where id = auth.uid() and role in ('admin', 'staff')
    )
  );
