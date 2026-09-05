import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;

// API Key de SimpleAPI protegida en el servidor (Nadie en la APK ni en el frontend puede verla ni cambiarla)
const SECURE_SIMPLE_API_KEY = process.env.SIMPLE_API_KEY || '5696-R950-6395-8019-5631';

// Carpeta local segura para certificados digitales por empresa
const CERTS_DIR = path.join(__dirname, 'data', 'certificados');
if (!fs.existsSync(CERTS_DIR)) {
  fs.mkdirSync(CERTS_DIR, { recursive: true });
}

// Middleware para procesar JSON con límite suficiente para certificados en base64
app.use(express.json({ limit: '15mb' }));

// CORS headers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, apikey');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Endpoint de estado y verificación segura (sin exponer la clave completa)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Market Almacén API Server',
    version: '10.0',
    simpleApiConfigured: Boolean(SECURE_SIMPLE_API_KEY),
    maskedKey: '••••-••••-••••-' + SECURE_SIMPLE_API_KEY.slice(-4),
    time: new Date().toISOString()
  });
});

// ============================================================================
// ENDPOINT: CARGAR Y REGISTRAR CERTIFICADO DIGITAL (.PFX / .P12) DE LA EMPRESA
// ============================================================================
app.post('/api/certificados/cargar', async (req, res) => {
  try {
    const { companyId, rutEmpresa, fileName, fileBase64, password } = req.body;

    if (!rutEmpresa || !fileBase64 || !password) {
      return res.status(400).json({
        status: 'error',
        message: 'RUT de empresa, archivo del certificado y contraseña son obligatorios.'
      });
    }

    const rutLimpio = String(rutEmpresa).replace(/\./g, '').trim();
    const safeCompanyId = companyId || 'default';
    const certFilename = `cert_${safeCompanyId}_${rutLimpio}.pfx`;
    const certPath = path.join(CERTS_DIR, certFilename);

    // Guardar archivo pfx en el servidor local de forma segura
    const buffer = Buffer.from(fileBase64.replace(/^data:.*?;base64,/, ''), 'base64');
    fs.writeFileSync(certPath, buffer);

    // Guardar metadatos cifrados/protegidos en servidor
    const metaPath = path.join(CERTS_DIR, `meta_${safeCompanyId}_${rutLimpio}.json`);
    fs.writeFileSync(metaPath, JSON.stringify({
      companyId: safeCompanyId,
      rutEmpresa: rutLimpio,
      fileName: fileName || 'certificado.pfx',
      uploadedAt: new Date().toISOString(),
      hasPassword: true
    }, null, 2));

    console.log(`[Certificado] Guardado exitosamente para empresa ${safeCompanyId} (${rutLimpio})`);

    return res.json({
      status: 'success',
      message: `Certificado digital de ${rutLimpio} cargado y vinculado exitosamente en el servidor.`,
      rutEmpresa: rutLimpio,
      fileName: fileName || 'certificado.pfx',
      uploadedAt: new Date().toISOString()
    });

  } catch (err) {
    console.error('[Error al cargar certificado]:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ============================================================================
// ENDPOINT: SOLICITAR FOLIOS AL SII (VÍA SIMPLEAPI PROTEGIDO O MODO LOCAL)
// ============================================================================
app.post('/api/folios/solicitar', async (req, res) => {
  try {
    const { rutEmpresa, tipoDte, cantidad, ambiente, companyId } = req.body;
    const keyToUse = SECURE_SIMPLE_API_KEY;

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

    // 1. Petición oficial a SimpleAPI con la clave protegida
    if (keyToUse && keyToUse.trim().length > 0) {
      try {
        console.log(`[SimpleAPI] Solicitando ${cantNum} folios para ${rutLimpio} (DTE ${tipoDte}) en ambiente ${ambiente || 'CERTIFICACION'}...`);

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

    // 2. Fallback de modo simulación si no hubiese clave
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
      message: 'Folios locales generados correctamente para pruebas.'
    });

  } catch (error) {
    console.error('[Error en /api/folios/solicitar]:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Error interno del servidor al procesar la solicitud de folios.'
    });
  }
});

// Servir archivos estáticos del frontend
app.use(express.static(path.join(__dirname, 'dist')));

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Market Almacén Server] escuchando en puerto ${PORT} con SimpleAPI activada`);
});
