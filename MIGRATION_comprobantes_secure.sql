-- ============================================================
-- FitGrowX — Secure Comprobantes Migration
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- 1. Rename column (if comprobante_url exists)
ALTER TABLE pagos
  RENAME COLUMN comprobante_url TO comprobante_path;

-- 2. Alter column type to be clearer about content (path, not URL)
-- (Already TEXT, no change needed - just conceptual rename done above)

-- 3. Update RLS policies for storage.objects
-- Drop old public read policy
DROP POLICY IF EXISTS "comprobantes public read" ON storage.objects;
DROP POLICY IF EXISTS "comprobantes owner read" ON storage.objects;
DROP POLICY IF EXISTS "comprobantes upload authenticated" ON storage.objects;

-- Deny all access by default (use signed URLs instead)
ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;

-- Re-enable and add restrictive policies (service_role only via endpoints)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS, so no need for explicit policy
-- Anonymous and authenticated users are denied access

-- 4. Note: Bucket visibility is handled in Supabase console:
--    storage -> comprobantes -> Policies -> Remove all public access
--    Only endpoint /api/pagos/comprobante/[pagoId] generates signed URLs
