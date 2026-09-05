import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware para procesar JSON y CORS
app.use(express.json());

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, apikey');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Endpoint de estado del servidor
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Market Almacén API Server',
    version: '10.0',
    time: new Date().toISOString()
  });
});

// ============================================================================
// ENDPOINT: SOLICITAR FOLIOS AL SII (VÍA SIMPLEAPI O SIMULACIÓN LOCAL)
// ============================================================================
app.post('/api/folios/solicitar', async (req, res) => {
  try {
    const { apiKey, rutEmpresa, tipoDte, cantidad, ambiente, companyId } = req.body;
    const keyToUse = apiKey || process.env.SIMPLE_API_KEY;

    if (!rutEmpresa) {
      return res.status(400).json({
        status: 'error',
        message: 'El RUT de la empresa es obligatorio para solicitar folios.'
      });
    }

    if (!tipoDte) {
      return res.status(400).json({
        status: 'error',
        message: 'El tipo de documento DTE (39 = Boleta, 33 = Factura, 61 = Nota de Crédito) es obligatorio.'
      });
    }

    const cantNum = Math.max(1, Number(cantidad || 100));
    const rutLimpio = String(rutEmpresa).replace(/\./g, '').trim();

    // 1. Si se proporciona API Key de SimpleAPI, realizar la petición real al SII
    if (keyToUse && keyToUse.trim().length > 0) {
      try {
        console.log(`[SimpleAPI] Solicitando ${cantNum} folios para ${rutLimpio} (DTE ${tipoDte}) en ambiente ${ambiente || 'CERTIFICACION'}...`);
        
        // SimpleAPI endpoint oficial de solicitud de folios
        const simpleApiUrl = 'https://api.simpleapi.cl/api/v1/folios/solicitar';

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 25000); // 25s timeout

        const simpleRes = await fetch(simpleApiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${keyToUse.trim()}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            rutEmpresa: rutLimpio,
            tipoDte: Number(tipoDte),
            cantidad: cantNum,
            ambiente: ambiente || 'CERTIFICACION'
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);
        const data = await simpleRes.json().catch(() => null);

        if (simpleRes.ok && data && (data.status === 'success' || data.folioDesde || data.cafXml || data.caf)) {
          return res.json({
            status: 'success',
            folioDesde: Number(data.folioDesde),
            folioHasta: Number(data.folioHasta),
            cantidad: Number(data.cantidad || cantNum),
            tipoDte: Number(tipoDte),
            cafXml: data.cafXml || data.caf || null,
            fuente: 'SIMPLEAPI_SII',
            message: 'Folios CAF autorizados exitosamente por el SII a través de SimpleAPI.'
          });
        } else {
          const errorMsg = data?.message || data?.error || `El servidor de SimpleAPI respondió con error ${simpleRes.status}`;
          console.warn(`[SimpleAPI Warn]: ${errorMsg}`);
          return res.status(400).json({
            status: 'error',
            message: `SimpleAPI: ${errorMsg}`,
            details: data
          });
        }
      } catch (fetchErr) {
        console.error('[SimpleAPI Fetch Error]:', fetchErr);
        if (fetchErr.name === 'AbortError') {
          return res.status(504).json({
            status: 'error',
            message: 'Tiempo de espera agotado al conectar con SimpleAPI / SII (Timeout).'
          });
        }
        return res.status(502).json({
          status: 'error',
          message: `Fallo de conexión con SimpleAPI: ${fetchErr.message}`
        });
      }
    }

    // 2. Si no hay API Key de SimpleAPI ingresada aún (Modo Simulación / Pruebas Locales)
    const baseFolio = tipoDte === 39 ? 1000 : tipoDte === 33 ? 500 : 100;
    const nuevoDesde = baseFolio + 1;
    const nuevoHasta = baseFolio + cantNum;

    return res.json({
      status: 'success',
      folioDesde: nuevoDesde,
      folioHasta: nuevoHasta,
      cantidad: cantNum,
      tipoDte: Number(tipoDte),
      fuente: 'LOCAL_SIMULACION',
      message: 'Folios locales generados correctamente para pruebas (Modo sin API Key SimpleAPI).'
    });

  } catch (error) {
    console.error('[Error general en /api/folios/solicitar]:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Error interno del servidor al procesar la solicitud de folios.'
    });
  }
});

// Servir archivos estáticos generados del frontend
app.use(express.static(path.join(__dirname, 'dist')));

// Redireccionar todas las demás rutas a index.html (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Market Almacén Server] escuchando en puerto ${PORT}`);
});
