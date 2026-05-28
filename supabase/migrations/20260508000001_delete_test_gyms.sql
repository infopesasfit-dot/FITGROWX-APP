-- Borrar gyms de prueba en cascada
-- Se conservan:
--   64fe6df8-174d-4208-8fc9-8cb6561bcbeb  (nirmar526@gmail.com)
--   e4de35e5-2724-418a-a949-77f11e66e3a6  (elianafrancoanahi@gmail.com)

-- whatsapp_sessions.gym_id es TEXT
DELETE FROM public.whatsapp_sessions
  WHERE gym_id NOT IN (
    '64fe6df8-174d-4208-8fc9-8cb6561bcbeb',
    'e4de35e5-2724-418a-a949-77f11e66e3a6'
  );

-- class_reservations no tiene gym_id — se borra via class_id
DELETE FROM public.class_reservations
  WHERE class_id IN (
    SELECT id FROM public.gym_classes
    WHERE gym_id NOT IN (
      '64fe6df8-174d-4208-8fc9-8cb6561bcbeb'::uuid,
      'e4de35e5-2724-418a-a949-77f11e66e3a6'::uuid
    )
  );

-- Resto de tablas con gym_id::uuid
DELETE FROM public.gym_classes
  WHERE gym_id NOT IN ('64fe6df8-174d-4208-8fc9-8cb6561bcbeb'::uuid, 'e4de35e5-2724-418a-a949-77f11e66e3a6'::uuid);

DELETE FROM public.asistencias
  WHERE gym_id NOT IN ('64fe6df8-174d-4208-8fc9-8cb6561bcbeb'::uuid, 'e4de35e5-2724-418a-a949-77f11e66e3a6'::uuid);

DELETE FROM public.progreso_pesos
  WHERE gym_id NOT IN ('64fe6df8-174d-4208-8fc9-8cb6561bcbeb'::uuid, 'e4de35e5-2724-418a-a949-77f11e66e3a6'::uuid);

DELETE FROM public.monthly_dashboard_reports
  WHERE gym_id NOT IN ('64fe6df8-174d-4208-8fc9-8cb6561bcbeb'::uuid, 'e4de35e5-2724-418a-a949-77f11e66e3a6'::uuid);

DELETE FROM public.notifications
  WHERE gym_id NOT IN ('64fe6df8-174d-4208-8fc9-8cb6561bcbeb'::uuid, 'e4de35e5-2724-418a-a949-77f11e66e3a6'::uuid);

DELETE FROM public.pagos
  WHERE gym_id NOT IN ('64fe6df8-174d-4208-8fc9-8cb6561bcbeb'::uuid, 'e4de35e5-2724-418a-a949-77f11e66e3a6'::uuid);

DELETE FROM public.egresos
  WHERE gym_id NOT IN ('64fe6df8-174d-4208-8fc9-8cb6561bcbeb'::uuid, 'e4de35e5-2724-418a-a949-77f11e66e3a6'::uuid);

DELETE FROM public.gym_promotions
  WHERE gym_id NOT IN ('64fe6df8-174d-4208-8fc9-8cb6561bcbeb'::uuid, 'e4de35e5-2724-418a-a949-77f11e66e3a6'::uuid);

DELETE FROM public.gym_cuentas
  WHERE gym_id NOT IN ('64fe6df8-174d-4208-8fc9-8cb6561bcbeb'::uuid, 'e4de35e5-2724-418a-a949-77f11e66e3a6'::uuid);

-- alumnos cascadea a alumno_tokens, reservas, rutinas, progreso_pesos
DELETE FROM public.alumnos
  WHERE gym_id NOT IN ('64fe6df8-174d-4208-8fc9-8cb6561bcbeb'::uuid, 'e4de35e5-2724-418a-a949-77f11e66e3a6'::uuid);

DELETE FROM public.leads
  WHERE gym_id NOT IN ('64fe6df8-174d-4208-8fc9-8cb6561bcbeb'::uuid, 'e4de35e5-2724-418a-a949-77f11e66e3a6'::uuid);

DELETE FROM public.planes
  WHERE gym_id NOT IN ('64fe6df8-174d-4208-8fc9-8cb6561bcbeb'::uuid, 'e4de35e5-2724-418a-a949-77f11e66e3a6'::uuid);

DELETE FROM public.membresias
  WHERE gym_id NOT IN ('64fe6df8-174d-4208-8fc9-8cb6561bcbeb'::uuid, 'e4de35e5-2724-418a-a949-77f11e66e3a6'::uuid);

DELETE FROM public.gym_settings
  WHERE gym_id NOT IN ('64fe6df8-174d-4208-8fc9-8cb6561bcbeb'::uuid, 'e4de35e5-2724-418a-a949-77f11e66e3a6'::uuid);

DELETE FROM public.profiles
  WHERE gym_id IS NOT NULL
    AND gym_id NOT IN ('64fe6df8-174d-4208-8fc9-8cb6561bcbeb'::uuid, 'e4de35e5-2724-418a-a949-77f11e66e3a6'::uuid);

DELETE FROM public.gyms
  WHERE id NOT IN ('64fe6df8-174d-4208-8fc9-8cb6561bcbeb'::uuid, 'e4de35e5-2724-418a-a949-77f11e66e3a6'::uuid);
