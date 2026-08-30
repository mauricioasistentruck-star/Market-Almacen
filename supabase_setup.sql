-- ==============================================================================
-- MARKET ALMACÉN - CONFIGURACIÓN DE BASE DE DATOS SUPABASE
-- ==============================================================================
-- Este script crea la tabla de sincronización en tiempo real para conectar
-- la aplicación Web (Netlify) y la APK Android de Market Almacén sin mezclar
-- datos con ningún proyecto anterior.
--
-- INSTRUCCIONES:
-- 1. Inicia sesión en https://supabase.com/
-- 2. Crea un nuevo proyecto (Ejemplo: "market-almacen").
-- 3. Dirígete a la pestaña "SQL Editor" en el panel izquierdo.
-- 4. Haz clic en "New query", pega TODO este contenido y presiona "Run".
-- ==============================================================================

-- 1. Crear tabla de sincronización de estado
CREATE TABLE IF NOT EXISTS public.sync_state (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Habilitar Row Level Security (RLS)
ALTER TABLE public.sync_state ENABLE ROW LEVEL SECURITY;

-- 3. Crear políticas para lectura y escritura segura (anónima y autenticada)
DROP POLICY IF EXISTS "Permitir lectura publica sync_state" ON public.sync_state;
CREATE POLICY "Permitir lectura publica sync_state" 
ON public.sync_state 
FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Permitir insercion publica sync_state" ON public.sync_state;
CREATE POLICY "Permitir insercion publica sync_state" 
ON public.sync_state 
FOR INSERT 
WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir actualizacion publica sync_state" ON public.sync_state;
CREATE POLICY "Permitir actualizacion publica sync_state" 
ON public.sync_state 
FOR UPDATE 
USING (true) 
WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir eliminacion publica sync_state" ON public.sync_state;
CREATE POLICY "Permitir eliminacion publica sync_state" 
ON public.sync_state 
FOR DELETE 
USING (true);

-- 4. Activar publicación en tiempo real (Supabase Realtime)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'sync_state'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sync_state;
  END IF;
END
$$;

-- 5. Crear índice para optimización de consultas
CREATE INDEX IF NOT EXISTS idx_sync_state_updated_at ON public.sync_state(updated_at DESC);

-- ==============================================================================
-- ¡LISTO! Tu base de datos en Supabase está preparada para Market Almacén.
-- Ahora ve a Project Settings -> API y copia la "Project URL" y la "anon / public key".
-- ==============================================================================
