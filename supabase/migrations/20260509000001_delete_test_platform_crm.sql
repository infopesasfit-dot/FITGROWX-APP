-- Limpiar platform_accounts y platform_leads de prueba
-- Conservar solo cuentas reales (nirmar526 y elianafrancoanahi)
-- Estos IDs corresponden a los gyms que dejamos en la limpieza anterior

DELETE FROM public.platform_accounts
  WHERE company_name = 'Mi Gimnasio'
     OR company_name IS NULL;

DELETE FROM public.platform_leads
  WHERE business_name = 'Mi Gimnasio'
     OR (full_name IS NULL AND business_name IS NULL);
