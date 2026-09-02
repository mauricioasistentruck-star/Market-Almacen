/**
 * Utilidades para Moneda, Ley de Redondeo y Huso Horario de Chile (America/Santiago)
 * Cumple con la Ley N° 20.956 (Ley de Redondeo) y denominaciones de billetes y monedas oficiales de Chile.
 */

export const CHILE_TIMEZONE = 'America/Santiago';

export interface RoundingResult {
  originalAmount: number;
  roundedAmount: number;
  roundingDifference: number; // e.g. -5, -4, +3, +4, 0
  applied: boolean;
}

/**
 * Aplica la Ley de Redondeo de Chile (Ley N° 20.956, Art. 12)
 * REGLA LEGAL:
 * - Solo aplica para pagos en EFECTIVO.
 * - Para medios electrónicos (Débito, Crédito, Transferencia, etc.) NO aplica y se cobra el valor exacto.
 * - Montos terminados de $1 a $5: Se bajan a la decena inferior (ejemplo: $1.225 -> $1.220, $1.221 -> $1.220).
 * - Montos terminados de $6 a $9: Se suben a la decena superior (ejemplo: $1.226 -> $1.230, $1.229 -> $1.230).
 * - Montos terminados en $0: No sufren modificación.
 */
export function applyChileanRounding(amount: number, paymentMethod: string): RoundingResult {
  const cleanAmount = Math.round(amount || 0);

  if (paymentMethod !== 'EFECTIVO') {
    return {
      originalAmount: cleanAmount,
      roundedAmount: cleanAmount,
      roundingDifference: 0,
      applied: false
    };
  }

  const lastDigit = cleanAmount % 10;
  if (lastDigit === 0) {
    return {
      originalAmount: cleanAmount,
      roundedAmount: cleanAmount,
      roundingDifference: 0,
      applied: false
    };
  }

  if (lastDigit >= 1 && lastDigit <= 5) {
    const rounded = cleanAmount - lastDigit;
    return {
      originalAmount: cleanAmount,
      roundedAmount: rounded,
      roundingDifference: -lastDigit,
      applied: true
    };
  } else {
    const diff = 10 - lastDigit;
    const rounded = cleanAmount + diff;
    return {
      originalAmount: cleanAmount,
      roundedAmount: rounded,
      roundingDifference: diff,
      applied: true
    };
  }
}

/**
 * Genera atajos de pago inteligentes basados en los billetes y monedas que existen en Chile:
 * Monedas: $10, $50, $100, $500
 * Billetes: $1.000, $2.000, $5.000, $10.000, $20.000
 *
 * Ejemplo para $23.450:
 * Atajos: Exacto ($23.450), $23.500, $24.000, $25.000, $30.000, $40.000
 */
export function getChileanCashShortcuts(amount: number): number[] {
  if (amount <= 0) return [1000, 2000, 5000, 10000, 20000];

  const shortcuts: number[] = [];

  // 1. Siguiente múltiplo de $500 (Moneda de $500)
  const next500 = Math.ceil(amount / 500) * 500;
  if (next500 > amount) shortcuts.push(next500);

  // 2. Siguiente múltiplo de $1.000 (Billete de $1.000)
  const next1000 = Math.ceil(amount / 1000) * 1000;
  if (next1000 > amount) shortcuts.push(next1000);

  // 3. Siguiente múltiplo de $2.000 (Billete de $2.000)
  const next2000 = Math.ceil(amount / 2000) * 2000;
  if (next2000 > amount) shortcuts.push(next2000);

  // 4. Siguiente múltiplo de $5.000 (Billete de $5.000)
  const next5000 = Math.ceil(amount / 5000) * 5000;
  if (next5000 > amount) shortcuts.push(next5000);

  // 5. Siguiente múltiplo de $10.000 (Billete de $10.000)
  const next10000 = Math.ceil(amount / 10000) * 10000;
  if (next10000 > amount) shortcuts.push(next10000);

  // 6. Siguiente múltiplo de $20.000 (Billetes de $20.000)
  const next20000 = Math.ceil(amount / 20000) * 20000;
  if (next20000 > amount) shortcuts.push(next20000);

  // Si faltan atajos para tener una gama completa, sugerir combinaciones lógicas de billetes
  if (shortcuts.length < 5) {
    const curMax = Math.max(...shortcuts, amount);
    const step = curMax >= 20000 ? 10000 : 5000;
    const add1 = Math.ceil((curMax + 1) / step) * step;
    if (add1 > amount && !shortcuts.includes(add1)) shortcuts.push(add1);
  }
  if (shortcuts.length < 5) {
    const curMax = Math.max(...shortcuts, amount);
    const step = curMax >= 20000 ? 10000 : 5000;
    const add2 = curMax + step;
    if (add2 > amount && !shortcuts.includes(add2)) shortcuts.push(add2);
  }

  // Filtrar duplicados, ordenar de menor a mayor y limitar a un máximo ergonómico de 5-6 botones
  const unique = Array.from(new Set(shortcuts))
    .filter(v => v > amount)
    .sort((a, b) => a - b);

  return unique.slice(0, 5);
}

/**
 * Formatea fecha en estándar de Chile DD/MM/AAAA respetando el huso America/Santiago
 * Maneja de forma automática los cambios de horario de verano e invierno (DST).
 */
export function formatChileDate(dateInput?: string | Date | number): string {
  if (!dateInput) return '';
  const d = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return String(dateInput);

  return new Intl.DateTimeFormat('es-CL', {
    timeZone: CHILE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d);
}

/**
 * Formatea hora en formato 24h HH:mm respetando el huso America/Santiago
 */
export function formatChileTime(dateInput?: string | Date | number, includeSeconds = false): string {
  if (!dateInput) return '';
  const d = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return '';

  return new Intl.DateTimeFormat('es-CL', {
    timeZone: CHILE_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: includeSeconds ? '2-digit' : undefined,
    hour12: false
  }).format(d);
}

/**
 * Formatea fecha y hora completa en estándar de Chile DD/MM/AAAA, HH:mm:ss
 */
export function formatChileDateTime(dateInput?: string | Date | number): string {
  if (!dateInput) return '';
  const d = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return String(dateInput);

  return new Intl.DateTimeFormat('es-CL', {
    timeZone: CHILE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(d);
}

/**
 * Retorna fecha local de Chile en formato YYYY-MM-DD
 */
export function getChileLocalDateString(dateInput?: string | Date | number): string {
  const d = dateInput ? (typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput) : new Date();
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: CHILE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d);
}
