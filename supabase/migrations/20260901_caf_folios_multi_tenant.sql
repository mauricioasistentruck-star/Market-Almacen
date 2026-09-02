-- ==============================================================================
-- MIGRACIÓN SUPABASE / POSTGRESQL: SISTEMA MULTI-EMPRESA DE FOLIOS CAF (SII)
-- Permite obtención, almacenamiento concurrente y consumo aislado por cada empresa
-- ==============================================================================

-- 1. Tabla multi-tenant para remesas de folios CAF
CREATE TABLE IF NOT EXISTS public.caf_folios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id VARCHAR(100) NOT NULL,            -- Identificador único de la empresa/sucursal
    rut_empresa VARCHAR(20) NOT NULL,             -- RUT emisor tributario de la empresa (Ej: '77.890.120-5')
    tipo_dte INTEGER NOT NULL,                    -- 33 = Factura, 39 = Boleta, 61 = Nota de Crédito
    folio_desde INTEGER NOT NULL,                 -- Inicio del rango autorizado por el SII
    folio_hasta INTEGER NOT NULL,                 -- Término del rango autorizado por el SII
    folio_actual INTEGER NOT NULL,                -- Puntero correlativo atómico en tiempo real
    xml_caf TEXT NOT NULL,                        -- Archivo XML / Firma criptográfica CAF del SII
    activo BOOLEAN DEFAULT true,                  -- Remesa disponible para emitir
    ambiente VARCHAR(20) DEFAULT 'certificacion', -- 'certificacion' o 'produccion'
    creado_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Índices de alta concurrencia y búsqueda rápida por empresa
CREATE INDEX IF NOT EXISTS idx_caf_company_dte_activo 
ON public.caf_folios (company_id, tipo_dte, activo) 
WHERE activo = true;

CREATE INDEX IF NOT EXISTS idx_caf_rut_dte_activo 
ON public.caf_folios (rut_empresa, tipo_dte, activo) 
WHERE activo = true;

-- 3. Habilitar Seguridad a Nivel de Filas (RLS)
ALTER TABLE public.caf_folios ENABLE ROW LEVEL SECURITY;

-- Política de aislamiento: cada tenant opera sus propios folios
CREATE POLICY "Aislamiento por empresa en folios CAF"
ON public.caf_folios
FOR ALL
USING (
    company_id = COALESCE(current_setting('app.current_company_id', true), company_id)
);

-- ==============================================================================
-- 4. FUNCIÓN ALMACENADA (RPC): obtener_siguiente_folio
-- Garantiza consumo concurrente libre de duplicados con bloqueo pesimista (FOR UPDATE)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.obtener_siguiente_folio(
    p_company_id VARCHAR,
    p_rut VARCHAR,
    p_tipo INTEGER
)
RETURNS JSON AS $$
DECLARE
    v_record RECORD;
    v_folio_asignado INTEGER;
    v_folios_restantes INTEGER;
BEGIN
    -- Bloquear exclusivamente la fila de la remesa activa de ESTA empresa específica
    SELECT id, folio_desde, folio_hasta, folio_actual, xml_caf
    INTO v_record
    FROM public.caf_folios
    WHERE company_id = p_company_id
      AND rut_empresa = p_rut
      AND tipo_dte = p_tipo
      AND activo = true
    ORDER BY folio_desde ASC
    LIMIT 1
    FOR UPDATE;

    -- Si no hay remesa activa con folios disponibles para esta empresa
    IF NOT FOUND THEN
        RAISE EXCEPTION 'No existen folios CAF autorizados y activos para la empresa %, RUT %, DTE %', p_company_id, p_rut, p_tipo;
    END IF;

    -- Validar si el puntero ya excedió el límite autorizado
    IF v_record.folio_actual > v_record.folio_hasta THEN
        -- Marcar la remesa como agotada
        UPDATE public.caf_folios
        SET activo = false
        WHERE id = v_record.id;

        -- Intentar obtener la siguiente remesa disponible
        RETURN public.obtener_siguiente_folio(p_company_id, p_rut, p_tipo);
    END IF;

    v_folio_asignado := v_record.folio_actual;
    v_folios_restantes := v_record.folio_hasta - v_folio_asignado;

    -- Avanzar el puntero atómicamente para la empresa
    IF v_folio_asignado = v_record.folio_hasta THEN
        -- Se acaba de consumir el último folio de este paquete
        UPDATE public.caf_folios
        SET folio_actual = folio_actual + 1,
            activo = false
        WHERE id = v_record.id;
    ELSE
        UPDATE public.caf_folios
        SET folio_actual = folio_actual + 1
        WHERE id = v_record.id;
    END IF;

    -- Retornar información completa para timbrado digital
    RETURN json_build_object(
        'success', true,
        'company_id', p_company_id,
        'rut_empresa', p_rut,
        'tipo_dte', p_tipo,
        'folio', v_folio_asignado,
        'caf_id', v_record.id,
        'folio_hasta', v_record.folio_hasta,
        'folios_restantes', v_folios_restantes,
        'xml_caf', v_record.xml_caf
    );
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- 5. FUNCIÓN ALMACENADA (RPC): registrar_remesa_caf
-- Registra una nueva carga de folios obtenida desde SimpleAPI/SII para la empresa
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.registrar_remesa_caf(
    p_company_id VARCHAR,
    p_rut VARCHAR,
    p_tipo INTEGER,
    p_desde INTEGER,
    p_hasta INTEGER,
    p_xml_caf TEXT,
    p_ambiente VARCHAR DEFAULT 'certificacion'
)
RETURNS JSON AS $$
DECLARE
    v_new_id UUID;
BEGIN
    INSERT INTO public.caf_folios (
        company_id,
        rut_empresa,
        tipo_dte,
        folio_desde,
        folio_hasta,
        folio_actual,
        xml_caf,
        activo,
        ambiente
    ) VALUES (
        p_company_id,
        p_rut,
        p_tipo,
        p_desde,
        p_hasta,
        p_desde, -- Comienza en el folio desde
        p_xml_caf,
        true,
        p_ambiente
    )
    RETURNING id INTO v_new_id;

    RETURN json_build_object(
        'success', true,
        'id', v_new_id,
        'company_id', p_company_id,
        'rut_empresa', p_rut,
        'tipo_dte', p_tipo,
        'folio_desde', p_desde,
        'folio_hasta', p_hasta,
        'cantidad', (p_hasta - p_desde + 1),
        'ambiente', p_ambiente
    );
END;
$$ LANGUAGE plpgsql;
