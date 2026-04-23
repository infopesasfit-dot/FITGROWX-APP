-- Allow 'pausado' as a valid status value
-- Run in Supabase SQL Editor after 20260413_alumnos_v2.sql

alter table alumnos
  drop constraint if exists alumnos_status_check;

alter table alumnos
  add constraint alumnos_status_check
  check (status in ('activo', 'vencido', 'pendiente', 'pausado'));
