import { Capacitor } from '@capacitor/core';
import { db } from '../db/database';

const PROD_URL = 'https://marketalmacen.up.railway.app';
let syncIntervalTimer: any = null;
let isSyncing = false;

export function getSyncApiUrl(): string {
  if (Capacitor.isNativePlatform()) {
    return `${PROD_URL}/api/sync`;
  }
  if (typeof window !== 'undefined') {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return '/api/sync';
    }
    return `${window.location.origin}/api/sync`;
  }
  return `${PROD_URL}/api/sync`;
}

/**
 * Ejecuta una pasada de sincronización bidireccional inmediata
 */
export async function syncNow(): Promise<boolean> {
  if (isSyncing) return false;
  isSyncing = true;

  try {
    const url = getSyncApiUrl();

    // 1. Recolectar datos locales clave
    const [sales, products, expenses, companies, users, workers] = await Promise.all([
      db.sales.toArray(),
      db.products.toArray(),
      db.expenses.toArray(),
      db.companies.toArray(),
      db.users.toArray(),
      db.workers.toArray()
    ]);

    // Filtrar a Mauricio de los usuarios para no enviarlo nunca
    const safeUsers = users.filter(u => u.username?.toLowerCase() !== 'mauricio' && u.role !== 'SUPERADMIN');

    const updates = {
      sales,
      products,
      expenses,
      companies,
      users: safeUsers,
      workers
    };

    // 2. Enviar y recibir desde el servidor
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        updates,
        clientTimestamp: Date.now()
      }),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      if (data && data.tables) {
        // 3. Mergear tablas del servidor en la base de datos local
        await mergeServerTables(data.tables);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('market_almacen_synced', { detail: data.serverTime }));
        }
        return true;
      }
    }
  } catch (err: any) {
    // Falla silenciosa (e.g. sin conexión o timeout) para no molestar la operativa de caja
  } finally {
    isSyncing = false;
  }
  return false;
}

/**
 * Aplica registros del servidor que falten localmente
 */
async function mergeServerTables(serverTables: { [table: string]: any[] }) {
  try {
    // 1. Ventas
    if (Array.isArray(serverTables.sales) && serverTables.sales.length > 0) {
      const localSales = await db.sales.toArray();
      const localFolios = new Set(localSales.map(s => s.folio));
      for (const s of serverTables.sales) {
        if (s.folio && !localFolios.has(s.folio)) {
          const { id, ...saleWithoutId } = s;
          await db.sales.add(saleWithoutId);
        }
      }
    }

    // 2. Gastos
    if (Array.isArray(serverTables.expenses) && serverTables.expenses.length > 0) {
      const localExpenses = await db.expenses.toArray();
      const localKeys = new Set(localExpenses.map(e => `${e.date}_${e.description}_${e.amount}`));
      for (const exp of serverTables.expenses) {
        const key = `${exp.date}_${exp.description}_${exp.amount}`;
        if (!localKeys.has(key)) {
          const { id, ...expWithoutId } = exp;
          await db.expenses.add(expWithoutId);
        }
      }
    }

    // 3. Productos (actualizar o agregar)
    if (Array.isArray(serverTables.products) && serverTables.products.length > 0) {
      for (const prod of serverTables.products) {
        if (prod.code) {
          const existing = await db.products.where('code').equals(prod.code).first();
          if (!existing) {
            const { id, ...prodWithoutId } = prod;
            await db.products.add(prodWithoutId);
          }
        }
      }
    }

    // 4. Empresas
    if (Array.isArray(serverTables.companies) && serverTables.companies.length > 0) {
      for (const comp of serverTables.companies) {
        if (comp.id) {
          const existing = await db.companies.get(comp.id);
          if (!existing) {
            await db.companies.add(comp);
          } else if (comp.logoUrl && comp.logoUrl !== existing.logoUrl) {
            await db.companies.update(comp.id, { logoUrl: comp.logoUrl, appIconPreset: comp.appIconPreset });
          }
        }
      }
    }

    // 5. Usuarios (Sincronización Aditiva y Segura - NUNCA BORRA)
    if (Array.isArray(serverTables.users) && serverTables.users.length > 0) {
      for (const u of serverTables.users) {
        const uClean = (u.username || '').trim().toLowerCase();
        if (!uClean || uClean === 'mauricio') continue;
        const existing = await db.users.where('username').equalsIgnoreCase(uClean).first();
        if (!existing) {
          const { id, ...userWithoutId } = u;
          await db.users.add(userWithoutId);
        } else if (u.password && u.password !== existing.password) {
          await db.users.update(existing.id!, {
            password: u.password,
            role: u.role,
            name: u.name,
            companyId: u.companyId
          });
        }
      }
    }

    // 6. Trabajadores
    if (Array.isArray(serverTables.workers) && serverTables.workers.length > 0) {
      for (const w of serverTables.workers) {
        if (w.rut) {
          const existing = await db.workers.where('rut').equals(w.rut).first();
          if (!existing) {
            const { id, ...workerWithoutId } = w;
            await db.workers.add(workerWithoutId);
          }
        }
      }
    }
  } catch (e) {
    console.warn('[Merge Error]:', e);
  }
}

/**
 * Inicia el temporizador continuo de sincronización cada 3 segundos
 */
export function startRealtimeSync() {
  if (syncIntervalTimer) return;
  // Primera sincronización inmediata
  syncNow();
  // Repetir exactamente cada 3 segundos como solicita el requerimiento
  syncIntervalTimer = setInterval(() => {
    syncNow();
  }, 3000);
}

export function stopRealtimeSync() {
  if (syncIntervalTimer) {
    clearInterval(syncIntervalTimer);
    syncIntervalTimer = null;
  }
}
