-- ============================================================
-- FitGrowX — Secure Comprobantes Migration
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- 1. Rename column (if comprobante_url exists)
ALTER TABLE pagos
  RENAME COLUMN comprobante_url TO comprobante_path;

-- 2. Alter column type to be clearer about content (path, not URL)
-- (Already TEXT, no change needed - just conceptual rename done above)

-- 3. Update RLS policies for comprobantes bucket ONLY
-- Drop old policies specific to comprobantes
DROP POLICY IF EXISTS "comprobantes public read" ON storage.objects;
DROP POLICY IF EXISTS "comprobantes owner read" ON storage.objects;
DROP POLICY IF EXISTS "comprobantes upload authenticated" ON storage.objects;

-- Create restrictive policy: deny all authenticated access (service_role bypasses RLS)
CREATE POLICY "comprobantes deny authenticated" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'comprobantes' AND auth.role() = 'authenticated' AND false);

-- Note: Service role bypasses all RLS, so endpoints can upload/generate signed URLs
-- Anonymous users denied access by default (no policies allow it)

-- 4. Note: Bucket visibility is handled in Supabase console:
--    storage -> comprobantes -> Policies -> Remove all public access
--    Only endpoint /api/pagos/comprobante/[pagoId] generates signed URLs
