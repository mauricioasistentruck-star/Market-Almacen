const SUPABASE_URL = "https://odmnsxmvjjkmswfnasii.supabase.co";
const SUPABASE_KEY = "sb_publishable_pQJ14rc91sRcuW8N4ykBMg_JzljkqQh";
const TABLE = "sync_state";
const ROW_ID = "main";

const SB_HEADERS = {
  "apikey": SUPABASE_KEY,
  "Authorization": "Bearer " + SUPABASE_KEY,
  "Content-Type": "application/json",
};

async function main() {
  console.log("Obteniendo estado actual de la nube...");
  const params = new URLSearchParams({ "id": "eq." + ROW_ID, "select": "data" });
  const url = SUPABASE_URL + "/rest/v1/" + TABLE + "?" + params.toString();
  const res = await fetch(url, { headers: SB_HEADERS });
  const rows = await res.json();
  const currentData = (rows && rows[0]?.data) || {};

  console.log("Bitácoras conservadas:", currentData.logbookEntries?.length || 0);

  const cleanCompanies = [
    {
      id: 'market-almacen',
      rut: '77.542.190-8',
      name: 'MARKET ALMACÉN SpA',
      tradeName: 'Market Almacén',
      industry: 'Transporte de Carga y Mantenimiento de Flota',
      phone: '+56 9 8452 1190',
      address: 'Av. Industrial 4500, Bodega Central',
      isNaturalPerson: false,
      createdAt: new Date().toISOString()
    },
    {
      id: 'market-almacen',
      rut: '76.890.340-K',
      name: 'MARKET ALMACÉN SpA',
      tradeName: 'Market Almacén',
      industry: 'Servicios Mecánicos y Asistencia en Ruta',
      phone: '+56 9 9234 5678',
      address: 'Camino La Negra Km 12',
      isNaturalPerson: false,
      createdAt: new Date().toISOString()
    }
  ];

  const cleanedPayload = {
    ...currentData,
    products: [],
    tools: [],
    toolKits: [],
    toolLoans: [],
    productMovements: [],
    deliveryGuides: [],
    receptionGuides: [],
    purchaseRequests: [],
    incidents: [],
    companies: cleanCompanies,
    // Conservar bitácora y usuarios intactos
    logbookEntries: currentData.logbookEntries || [],
    users: currentData.users || [],
    workers: currentData.workers || [],
    lastSyncTimestamp: Date.now()
  };

  console.log("Subiendo base de datos limpia a Supabase...");
  const upsertUrl = SUPABASE_URL + "/rest/v1/" + TABLE;
  const upsertRes = await fetch(upsertUrl, {
    method: "POST",
    headers: { ...SB_HEADERS, "Prefer": "resolution=merge-duplicates" },
    body: JSON.stringify({ id: ROW_ID, data: cleanedPayload, updated_at: new Date().toISOString() }),
  });

  if (!upsertRes.ok) {
    const txt = await upsertRes.text();
    console.error("Error al actualizar Supabase:", txt);
  } else {
    console.log("¡Base de datos limpiada con éxito en la nube!");
  }
}

main();
