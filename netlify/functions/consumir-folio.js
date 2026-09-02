/**
 * NETLIFY FUNCTION: consumir-folio.js
 * Consumo concurrente y aislado de folios CAF por empresa
 * Llama a la función almacenada de Postgres (RPC) 'obtener_siguiente_folio' con bloqueo 'FOR UPDATE'
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://tu-proyecto.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export async function handler(event, context) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Company-Id',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json; charset=utf-8'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Método no permitido. Utilice POST.' })
    };
  }

  try {
    const { companyId, rutEmpresa, tipoDte } = JSON.parse(event.body || '{}');

    if (!companyId || !rutEmpresa || !tipoDte) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'companyId, rutEmpresa y tipoDte son requeridos.' })
      };
    }

    // Invocación a la función RPC de Supabase con aislamiento por empresa
    const { data, error } = await supabase.rpc('obtener_siguiente_folio', {
      p_company_id: companyId,
      p_rut: rutEmpresa,
      p_tipo: Number(tipoDte)
    });

    if (error) {
      return {
        statusCode: 409, // Conflict / Sin folios disponibles
        headers,
        body: JSON.stringify({
          success: false,
          error: `Error al consumir folio: ${error.message}`
        })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        folio: data.folio,
        companyId: data.company_id,
        rutEmpresa: data.rut_empresa,
        tipoDte: data.tipo_dte,
        folioHasta: data.folio_hasta,
        foliosRestantes: data.folios_restantes,
        xmlCaf: data.xml_caf
      })
    };

  } catch (error) {
    console.error('Error en consumir-folio handler:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Error interno al consumir folio.'
      })
    };
  }
}
