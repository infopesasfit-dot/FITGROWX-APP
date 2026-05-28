alter table alumnos
  add column if not exists deuda_pendiente numeric(12,2) not null default 0;

comment on column alumnos.deuda_pendiente is
  'Deuda acumulada del alumno en ARS. Se carga manualmente al registrar un egreso o al reactivar un alumno que se fue debiendo.';
