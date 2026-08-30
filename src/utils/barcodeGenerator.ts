import { db } from '../db/database';

// Generates an 8-digit random pure numerical barcode for products (no letters, no hyphens)
export function generateProductBarcode(): string {
  const num = Math.floor(10000000 + Math.random() * 90000000);
  return num.toString();
}

// Calculates the next available sequential tool code starting from HERR-001, reusing deleted holes
export async function getNextToolCode(): Promise<string> {
  const allTools = await db.tools.toArray();
  const usedNumbers = new Set<number>();

  for (const t of allTools) {
    if (!t.code) continue;
    const match = t.code.match(/^(?:HERR|HER)-?(\d+)$/i);
    if (match) {
      const n = parseInt(match[1], 10);
      if (!isNaN(n) && n > 0) {
        usedNumbers.add(n);
      }
    }
  }

  let candidate = 1;
  while (usedNumbers.has(candidate)) {
    candidate++;
  }

  const padded = String(candidate).padStart(3, '0');
  return `HERR-${padded}`;
}

// Calculates the next correlative Reception Guide folio starting from REC-00001
export async function getNextReceptionFolio(): Promise<string> {
  const guides = await db.receptionGuides.toArray();
  let maxNum = 0;

  for (const g of guides) {
    if (!g.folio) continue;
    const match = g.folio.match(/^(?:REC)-?(\d+)$/i);
    if (match) {
      const n = parseInt(match[1], 10);
      if (!isNaN(n) && n > maxNum) {
        maxNum = n;
      }
    }
  }

  const nextNum = maxNum + 1;
  return `REC-${String(nextNum).padStart(5, '0')}`;
}

// Calculates the next correlative Delivery Guide folio starting from ENT-00001
export async function getNextDeliveryFolio(): Promise<string> {
  const guides = await db.deliveryGuides.toArray();
  let maxNum = 0;

  for (const g of guides) {
    if (!g.folio) continue;
    const match = g.folio.match(/^(?:ENT)-?(\d+)$/i);
    if (match) {
      const n = parseInt(match[1], 10);
      if (!isNaN(n) && n > maxNum) {
        maxNum = n;
      }
    }
  }

  const nextNum = maxNum + 1;
  return `ENT-${String(nextNum).padStart(5, '0')}`;
}

// Calculates the next correlative Loss / Incident Act folio starting from ACT-00001
export async function getNextLossActFolio(): Promise<string> {
  const incidents = await db.incidents.toArray();
  let maxNum = 0;

  for (const inc of incidents) {
    if (!inc.lossActFolio) continue;
    const match = inc.lossActFolio.match(/^(?:ACT)-?(\d+)$/i);
    if (match) {
      const n = parseInt(match[1], 10);
      if (!isNaN(n) && n > maxNum) {
        maxNum = n;
      }
    }
  }

  const nextNum = maxNum + 1;
  return `ACT-${String(nextNum).padStart(5, '0')}`;
}

export function formatRut(rut: string): string {
  const clean = rut.replace(/[^0-9kK]/g, '').toUpperCase();
  if (clean.length <= 1) return clean;
  const dv = clean.slice(-1);
  let cuerpo = clean.slice(0, -1);
  let formatted = '';
  while (cuerpo.length > 3) {
    formatted = '.' + cuerpo.slice(-3) + formatted;
    cuerpo = cuerpo.slice(0, -3);
  }
  return cuerpo + formatted + '-' + dv;
}
