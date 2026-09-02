-- ==============================================================================
-- MARKET ALMACEN - CONFIGURACION DE BASE DE DATOS SUPABASE
-- ==============================================================================
-- Este script crea la infraestructura necesaria para la sincronizacion en tiempo
-- real de Market Almacen en una nueva cuenta independiente de Supabase.
--
-- INSTRUCCIONES DE EJECUCION:
-- 1. Inicia sesion en tu nueva cuenta en https://supabase.com/
-- 2. Entra a tu proyecto nuevo (o crea uno nuevo, ej: "market-almacen").
-- 3. En el menu lateral izquierdo, haz clic en "SQL Editor" (icono >_).
-- 4. Haz clic en "New query", pega TODO este script y presiona el boton verde "Run".
-- 5. Debe indicar: "Success. No rows returned".
-- ==============================================================================

-- 1. Crear tabla central de sincronizacion de estado
CREATE TABLE IF NOT EXISTS public.sync_state (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Habilitar Seguridad a Nivel de Fila (Row Level Security - RLS)
ALTER TABLE public.sync_state ENABLE ROW LEVEL SECURITY;

-- 3. Politicas de acceso seguras para operacion de clientes (anon / public)
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

-- 4. Activar difusion en tiempo real (Supabase Realtime)
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

-- 5. Indice optimizado para consultas por fecha de actualizacion
CREATE INDEX IF NOT EXISTS idx_sync_state_updated_at ON public.sync_state(updated_at DESC);

-- ==============================================================================
-- LISTO: La base de datos esta preparada.
-- Ahora ve a Project Settings -> API y copia la "Project URL" y la "anon / public key".
-- ==============================================================================
