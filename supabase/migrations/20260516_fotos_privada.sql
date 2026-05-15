alter table progreso_fotos
  add column if not exists privada boolean not null default true;

comment on column progreso_fotos.privada is
  'true = solo visible para el alumno. false = el profe también puede verla.';
