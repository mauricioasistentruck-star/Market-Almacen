import { db } from "../db/database";
import type {
  AppUser, Company, Product, Tool, ToolKit, ToolLoan, ProductMovement,
  ReceptionGuide, DeliveryGuide, LogbookEntry, PurchaseRequest, Incident, Worker,
  Sale, SiiConfig, CashClosing
} from "../types";

// Configuración de Supabase para Market Almacén
// Los valores se pueden definir en variables de entorno (VITE_SUPABASE_URL / VITE_SUPABASE_KEY)
// o guardar dinámicamente en localStorage.
function getStoredUrl(): string {
  if (typeof localStorage !== "undefined") {
    const custom = localStorage.getItem("marketalmacen_supabase_url");
    if (custom) return custom.trim();
  }
  return ((import.meta as any).env?.VITE_SUPABASE_URL as string) || "";
}

function getStoredKey(): string {
  if (typeof localStorage !== "undefined") {
    const custom = localStorage.getItem("marketalmacen_supabase_key");
    if (custom) return custom.trim();
  }
  return ((import.meta as any).env?.VITE_SUPABASE_KEY as string) || "";
}

let SUPABASE_URL = getStoredUrl();
let SUPABASE_KEY = getStoredKey();
const TABLE = "sync_state";
const ROW_ID = "market_almacen_sync";
const SYNC_INTERVAL_MS = 4000;

let isSyncRunning = false;

function getHeaders(): Record<string, string> {
  const key = getStoredKey();
  return {
    "apikey": key,
    "Authorization": "Bearer " + key,
    "Content-Type": "application/json",
  };
}

export function isCloudConfigured(): boolean {
  const url = getStoredUrl();
  const key = getStoredKey();
  return Boolean(url && key && url.startsWith("http"));
}

export function setCustomCloudCredentials(url: string, key: string) {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem("marketalmacen_supabase_url", url.trim());
    localStorage.setItem("marketalmacen_supabase_key", key.trim());
  }
  SUPABASE_URL = url.trim();
  SUPABASE_KEY = key.trim();
  notifyLocalMutation();
}

export function getCustomCloudCredentials() {
  return {
    url: getStoredUrl(),
    key: getStoredKey()
  };
}

export interface CloudPayload {
  users?: AppUser[];
  companies?: Company[];
  products?: Product[];
  tools?: Tool[];
  toolKits?: ToolKit[];
  toolLoans?: ToolLoan[];
  productMovements?: ProductMovement[];
  receptionGuides?: ReceptionGuide[];
  deliveryGuides?: DeliveryGuide[];
  logbookEntries?: LogbookEntry[];
  purchaseRequests?: PurchaseRequest[];
  incidents?: Incident[];
  workers?: Worker[];
  sales?: Sale[];
  siiConfigs?: SiiConfig[];
  cashClosings?: CashClosing[];
  lastSyncTimestamp?: number;
}

export interface CloudSyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  lastSync: Date | null;
  mode: "local" | "cloud";
  error?: string;
}

let syncListeners: ((status: CloudSyncStatus) => void)[] = [];
let currentStatus: CloudSyncStatus = {
  isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
  isSyncing: false,
  lastSync: null,
  mode: isCloudConfigured() ? "cloud" : "local",
  error: undefined
};

function notifyListeners() {
  syncListeners.forEach(cb => { try { cb({ ...currentStatus }); } catch (_) {} });
}

export function subscribeCloudSync(cb: (status: CloudSyncStatus) => void) {
  syncListeners.push(cb);
  cb({ ...currentStatus });
  return () => { syncListeners = syncListeners.filter(l => l !== cb); };
}

export function getCloudEndpoint(): string { return getStoredUrl(); }
export function setCloudEndpoint(url: string) { setCustomCloudCredentials(url, getStoredKey()); }

function fetchWithTimeout(url: string, options: RequestInit, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timer));
}

async function sbGet(): Promise<CloudPayload | null> {
  if (!isCloudConfigured()) return null;
  const urlBase = getStoredUrl();
  const params = new URLSearchParams({ "id": "eq." + ROW_ID, "select": "data" });
  const url = urlBase + "/rest/v1/" + TABLE + "?" + params.toString();
  const res = await fetchWithTimeout(url, { headers: getHeaders() }, 8000);
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error("Supabase GET " + res.status + ": " + txt.slice(0, 120));
  }
  const rows: { data: CloudPayload }[] = await res.json();
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return rows[0]?.data ?? null;
}

async function sbUpsert(payload: CloudPayload): Promise<void> {
  if (!isCloudConfigured()) return;
  const urlBase = getStoredUrl();
  const url = urlBase + "/rest/v1/" + TABLE;
  const body = JSON.stringify({ id: ROW_ID, data: payload, updated_at: new Date().toISOString() });
  const res = await fetchWithTimeout(url, {
    method: "POST",
    headers: { ...getHeaders(), "Prefer": "resolution=merge-duplicates" },
    body,
  }, 10000);
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error("Supabase UPSERT " + res.status + ": " + txt.slice(0, 120));
  }
}

async function collectLocalPayload(): Promise<CloudPayload> {
  const [
    users, companies, products, tools, toolKits, toolLoans, productMovements,
    receptionGuides, deliveryGuides, logbookEntries, purchaseRequests, incidents,
    workers, sales, siiConfigs, cashClosings
  ] = await Promise.all([
    db.users.toArray(), db.companies.toArray(), db.products.toArray(),
    db.tools.toArray(), db.toolKits.toArray(), db.toolLoans.toArray(), db.productMovements.toArray(),
    db.receptionGuides.toArray(), db.deliveryGuides.toArray(),
    db.logbookEntries.toArray(), db.purchaseRequests.toArray(), db.incidents.toArray(),
    db.workers.toArray(), db.sales.toArray(), db.siiConfigs.toArray(), db.cashClosings.toArray()
  ]);
  return {
    users, companies, products, tools, toolKits, toolLoans, productMovements,
    receptionGuides, deliveryGuides, logbookEntries, purchaseRequests, incidents,
    workers, sales, siiConfigs, cashClosings,
    lastSyncTimestamp: Date.now()
  };
}

export async function pushAllToCloud(isManual = false): Promise<boolean> {
  if (!isCloudConfigured()) {
    currentStatus.mode = "local";
    notifyListeners();
    return true;
  }
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    currentStatus.isOnline = false;
    currentStatus.isSyncing = false;
    notifyListeners();
    return false;
  }
  if (isSyncRunning && !isManual) return false;
  if (isManual) { currentStatus.isSyncing = true; notifyListeners(); }
  isSyncRunning = true;
  try {
    const payload = await collectLocalPayload();
    const newTimestamp = Date.now();
    payload.lastSyncTimestamp = newTimestamp;
    await sbUpsert(payload);

    lastAppliedCloudTimestamp = newTimestamp;
    hasUnpushedLocalChanges = false;

    currentStatus.isOnline = true;
    currentStatus.isSyncing = false;
    currentStatus.lastSync = new Date();
    currentStatus.mode = "cloud";
    currentStatus.error = undefined;
    notifyListeners();
    return true;
  } catch (err: any) {
    console.warn("[Supabase Push]", err?.message);
    currentStatus.isSyncing = false;
    currentStatus.error = err?.message?.slice(0, 80) || "Error al sincronizar con la nube";
    notifyListeners();
    return false;
  } finally {
    isSyncRunning = false;
  }
}

let lastLocalMutationTimestamp = 0;
let localMutationLockUntil = 0;
let hasUnpushedLocalChanges = false;
let lastAppliedCloudTimestamp = 0;

export function notifyLocalMutation() {
  lastLocalMutationTimestamp = Date.now();
  localMutationLockUntil = Date.now() + 15000;
  hasUnpushedLocalChanges = true;
  if (isCloudConfigured()) {
    pushAllToCloud(true).catch(() => {});
  }
}

export async function pullAllFromCloud(isManual = false): Promise<boolean> {
  if (!isCloudConfigured()) {
    currentStatus.mode = "local";
    return true;
  }
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    currentStatus.isOnline = false;
    currentStatus.isSyncing = false;
    notifyListeners();
    return false;
  }

  if (!isManual && (Date.now() < localMutationLockUntil || hasUnpushedLocalChanges)) {
    return false;
  }

  if (isSyncRunning && !isManual) return false;
  if (isManual) { currentStatus.isSyncing = true; notifyListeners(); }
  isSyncRunning = true;

  try {
    const data = await sbGet();

    if (!data || Object.keys(data).length === 0) {
      if (hasUnpushedLocalChanges) {
        await sbUpsert(await collectLocalPayload());
      }
      currentStatus.isOnline = true;
      currentStatus.isSyncing = false;
      currentStatus.lastSync = new Date();
      currentStatus.error = undefined;
      notifyListeners();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("marketalmacen-data-updated"));
      }
      return true;
    }

    const cloudTimestamp = data.lastSyncTimestamp || 0;

    if (!isManual && cloudTimestamp > 0 && cloudTimestamp === lastAppliedCloudTimestamp && !hasUnpushedLocalChanges) {
      currentStatus.isOnline = true;
      currentStatus.isSyncing = false;
      currentStatus.lastSync = new Date();
      notifyListeners();
      return true;
    }

    if (hasUnpushedLocalChanges && lastLocalMutationTimestamp > cloudTimestamp) {
      const localPayload = await collectLocalPayload();
      const newTimestamp = Date.now();
      localPayload.lastSyncTimestamp = newTimestamp;
      await sbUpsert(localPayload);
      lastAppliedCloudTimestamp = newTimestamp;
      hasUnpushedLocalChanges = false;
      currentStatus.isOnline = true;
      currentStatus.isSyncing = false;
      currentStatus.lastSync = new Date();
      currentStatus.error = undefined;
      notifyListeners();
      return true;
    }

    // Sincronizar desde la nube al almacenamiento local
    await db.transaction("rw", [
      db.users, db.companies, db.products, db.tools, db.toolKits, db.toolLoans,
      db.productMovements, db.receptionGuides, db.deliveryGuides,
      db.logbookEntries, db.purchaseRequests, db.incidents, db.workers,
      db.sales, db.siiConfigs, db.cashClosings
    ], async () => {

      // Usuarios
      if (Array.isArray(data.users) && data.users.length > 0) {
        const cloudUsernames = new Set(data.users.map(u => (u.username || '').trim().toLowerCase()));
        const localUsers = await db.users.toArray();
        for (const lu of localUsers) {
          if (!cloudUsernames.has((lu.username || '').toLowerCase())) {
            await db.users.delete(lu.id!);
          }
        }
        for (const u of data.users) {
          const cleanUName = (u.username || '').trim().toLowerCase();
          if (!cleanUName) continue;
          const ex = await db.users.where("username").equalsIgnoreCase(cleanUName).first();
          if (!ex) await db.users.add({ ...u, id: undefined, username: cleanUName });
          else await db.users.update(ex.id!, {
            name: u.name,
            password: u.password,
            role: u.role,
            username: cleanUName
          });
        }
      }

      // Empresas
      if (Array.isArray(data.companies) && data.companies.length > 0) {
        const cloudCompanyIds = new Set(data.companies.map(c => c.id));
        const localCompanies = await db.companies.toArray();
        for (const lc of localCompanies) {
          if (!cloudCompanyIds.has(lc.id)) {
            await db.companies.delete(lc.id);
          }
        }
        for (const c of data.companies) {
          const ex = await db.companies.get(c.id);
          if (!ex) await db.companies.add(c);
          else await db.companies.update(c.id, c);
        }
      }

      // Productos
      if (Array.isArray(data.products)) {
        const cloudProductCodes = new Set(data.products.map(p => (p.code || '').toLowerCase().trim()));
        const localProducts = await db.products.toArray();
        for (const lp of localProducts) {
          if (!cloudProductCodes.has((lp.code || '').toLowerCase().trim())) {
            await db.products.delete(lp.id!);
          }
        }
        for (const p of data.products) {
          const cleanCode = (p.code || '').trim();
          if (!cleanCode) continue;
          const ex = await db.products.where("code").equals(p.code).first();
          if (!ex) await db.products.add({ ...p, id: undefined });
          else await db.products.update(ex.id!, { ...p, id: ex.id });
        }
      }

      // Herramientas / Equipos
      if (Array.isArray(data.tools)) {
        const cloudToolCodes = new Set(data.tools.map(t => (t.code || '').toLowerCase().trim()));
        const localTools = await db.tools.toArray();
        for (const lt of localTools) {
          if (!cloudToolCodes.has((lt.code || '').toLowerCase().trim())) {
            await db.tools.delete(lt.id!);
          }
        }
        for (const t of data.tools) {
          const ex = await db.tools.where("code").equals(t.code).first();
          if (!ex) await db.tools.add({ ...t, id: undefined });
          else await db.tools.update(ex.id!, { ...t, id: ex.id });
        }
      }

      // Kits
      if (Array.isArray(data.toolKits)) {
        const cloudKitNames = new Set(data.toolKits.map(k => k.name));
        const localKits = await db.toolKits.toArray();
        for (const lk of localKits) {
          if (!cloudKitNames.has(lk.name)) {
            await db.toolKits.delete(lk.id!);
          }
        }
        for (const k of data.toolKits) {
          const ex = await db.toolKits.where("code").equals(k.code).first();
          if (!ex) await db.toolKits.add({ ...k, id: undefined });
          else await db.toolKits.update(ex.id!, { ...k, id: ex.id });
        }
      }

      // Préstamos
      if (Array.isArray(data.toolLoans)) {
        await db.toolLoans.clear();
        if (data.toolLoans.length > 0) {
          await db.toolLoans.bulkAdd(data.toolLoans.map(l => ({ ...l, id: undefined })));
        }
      }

      // Movimientos
      if (Array.isArray(data.productMovements)) {
        await db.productMovements.clear();
        if (data.productMovements.length > 0) {
          await db.productMovements.bulkAdd(data.productMovements.map(m => ({ ...m, id: undefined })));
        }
      }

      // Guías de Recepción
      if (Array.isArray(data.receptionGuides)) {
        await db.receptionGuides.clear();
        if (data.receptionGuides.length > 0) {
          await db.receptionGuides.bulkAdd(data.receptionGuides.map(g => ({ ...g, id: undefined })));
        }
      }

      // Guías de Despacho
      if (Array.isArray(data.deliveryGuides)) {
        await db.deliveryGuides.clear();
        if (data.deliveryGuides.length > 0) {
          await db.deliveryGuides.bulkAdd(data.deliveryGuides.map(g => ({ ...g, id: undefined })));
        }
      }

      // Bitácora
      if (Array.isArray(data.logbookEntries)) {
        await db.logbookEntries.clear();
        if (data.logbookEntries.length > 0) {
          await db.logbookEntries.bulkAdd(data.logbookEntries.map(e => ({ ...e, id: undefined })));
        }
      }

      // Solicitudes de Compra
      if (Array.isArray(data.purchaseRequests)) {
        await db.purchaseRequests.clear();
        if (data.purchaseRequests.length > 0) {
          await db.purchaseRequests.bulkAdd(data.purchaseRequests.map(r => ({ ...r, id: undefined })));
        }
      }

      // Incidentes
      if (Array.isArray(data.incidents)) {
        await db.incidents.clear();
        if (data.incidents.length > 0) {
          await db.incidents.bulkAdd(data.incidents.map(i => ({ ...i, id: undefined })));
        }
      }

      // Trabajadores
      if (Array.isArray(data.workers)) {
        await db.workers.clear();
        if (data.workers.length > 0) {
          await db.workers.bulkAdd(data.workers.map(w => ({ ...w, id: undefined })));
        }
      }

      // Ventas / Boletas
      if (Array.isArray(data.sales)) {
        await db.sales.clear();
        if (data.sales.length > 0) {
          await db.sales.bulkAdd(data.sales.map(s => ({ ...s, id: undefined })));
        }
      }

      // Configuración SII
      if (Array.isArray(data.siiConfigs)) {
        await db.siiConfigs.clear();
        if (data.siiConfigs.length > 0) {
          await db.siiConfigs.bulkAdd(data.siiConfigs.map(c => ({ ...c, id: undefined })));
        }
      }

      // Cierres de Caja
      if (Array.isArray(data.cashClosings)) {
        await db.cashClosings.clear();
        if (data.cashClosings.length > 0) {
          await db.cashClosings.bulkAdd(data.cashClosings.map(cc => ({ ...cc, id: undefined })));
        }
      }
    });

    lastAppliedCloudTimestamp = cloudTimestamp;
    currentStatus.isOnline = true;
    currentStatus.isSyncing = false;
    currentStatus.lastSync = new Date();
    currentStatus.error = undefined;
    notifyListeners();

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("marketalmacen-data-updated"));
    }
    return true;
  } catch (err: any) {
    console.warn("[Supabase Pull]", err?.message);
    currentStatus.isSyncing = false;
    currentStatus.error = err?.message?.slice(0, 80) || "Error al descargar desde la nube";
    notifyListeners();
    return false;
  } finally {
    isSyncRunning = false;
  }
}

let syncInterval: any = null;

export function startPeriodicSync(intervalMs = SYNC_INTERVAL_MS) {
  if (syncInterval) clearInterval(syncInterval);
  if (isCloudConfigured()) {
    pullAllFromCloud().catch(() => {});
    syncInterval = setInterval(() => {
      if (typeof navigator !== "undefined" && navigator.onLine && isCloudConfigured()) {
        pullAllFromCloud().catch(() => {});
      }
    }, intervalMs);
  }
}

export function stopPeriodicSync() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}

// Compatibilidad con llamadas existentes
export const triggerCloudSync = () => notifyLocalMutation();
export const initCloudSync = () => startPeriodicSync();
