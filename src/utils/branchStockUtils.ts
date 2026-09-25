import type { Product, Branch } from '../types';

/**
 * Utilidades para manejo de stock exclusivo por sucursal (no suma global)
 */

export const DEFAULT_MAIN_BRANCH_ID = 'suc-providencia-01';
export const DEFAULT_SECOND_BRANCH_ID = 'suc-maipu-02';

/**
 * Obtiene la sucursal activa desde localStorage
 */
export function getActiveBranchId(): string {
  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem('marketalmacen_active_branch_id');
    if (saved) return saved;
  }
  return DEFAULT_MAIN_BRANCH_ID;
}

/**
 * Establece la sucursal activa y notifica a todos los componentes
 */
export function setActiveBranch(branchId: string, branchName?: string, branchCode?: string) {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('marketalmacen_active_branch_id', branchId);
    if (branchName) localStorage.setItem('marketalmacen_active_branch_name', branchName);
    if (branchCode) localStorage.setItem('marketalmacen_active_branch_code', branchCode);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('marketalmacen-branch-changed', {
        detail: { branchId, branchName, branchCode }
      })
    );
  }
}

/**
 * Calcula o retorna el stock exclusivo de una sucursal específica.
 * NUNCA retorna la suma total de todas las sucursales cuando se consulta por una sucursal.
 */
export function getProductBranchStock(
  product: Product,
  branchId?: string | null,
  allBranches?: Branch[]
): number {
  const targetBranchId = branchId || getActiveBranchId();
  const globalTotalStock = Number(product.stock || 0);

  // 1. Si el producto ya tiene un registro explícito en branchStocks para esta sucursal
  if (product.branchStocks && typeof product.branchStocks[targetBranchId] === 'number') {
    return Number(product.branchStocks[targetBranchId]);
  }

  // 2. Si no tiene branchStocks explícito, distribuimos el stock total de forma independiente
  // garantizando que cada sucursal vea SOLO su porción y NO la suma total.
  // Casa Matriz: ~55%, Sucursal 2: ~30%, Sucursal 3+: ~15%
  const isMain = targetBranchId === DEFAULT_MAIN_BRANCH_ID || targetBranchId.toLowerCase().includes('matriz') || targetBranchId.toLowerCase().includes('01');
  const isSecond = targetBranchId === DEFAULT_SECOND_BRANCH_ID || targetBranchId.toLowerCase().includes('maipu') || targetBranchId.toLowerCase().includes('02');

  if (isMain) {
    return Math.max(0, Math.ceil(globalTotalStock * 0.55));
  } else if (isSecond) {
    return Math.max(0, Math.floor(globalTotalStock * 0.30));
  } else {
    return Math.max(0, Math.floor(globalTotalStock * 0.15));
  }
}

/**
 * Actualiza el stock de una sucursal y recalcula el total global
 */
export function calculateUpdatedBranchStocks(
  product: Product,
  branchId: string,
  newBranchStock: number,
  allBranches?: Branch[]
): { branchStocks: Record<string, number>; newTotalStock: number } {
  const currentStocks: Record<string, number> = { ...(product.branchStocks || {}) };

  // Asegurar que las sucursales principales tengan valor inicial si no existían
  const bList = allBranches || [
    { id: DEFAULT_MAIN_BRANCH_ID, isMain: true } as Branch,
    { id: DEFAULT_SECOND_BRANCH_ID, isMain: false } as Branch
  ];

  bList.forEach(b => {
    if (typeof currentStocks[b.id] !== 'number') {
      currentStocks[b.id] = getProductBranchStock(product, b.id, allBranches);
    }
  });

  // Asignar el nuevo stock para la sucursal indicada
  currentStocks[branchId] = Math.max(0, Number(newBranchStock));

  // El stock total global es la suma de todas las sucursales
  const newTotalStock = Object.values(currentStocks).reduce((acc, val) => acc + (val || 0), 0);

  return {
    branchStocks: currentStocks,
    newTotalStock
  };
}

/**
 * Descuenta stock de una sucursal específica (por venta o salida)
 */
export function deductFromBranchStock(
  product: Product,
  branchId: string,
  quantityToDeduct: number,
  allBranches?: Branch[]
): { branchStocks: Record<string, number>; newTotalStock: number; deductedQty: number } {
  const currentBranchStock = getProductBranchStock(product, branchId, allBranches);
  const actualDeduct = Math.min(currentBranchStock, Math.max(0, Number(quantityToDeduct)));
  const newStock = Math.max(0, currentBranchStock - actualDeduct);

  const res = calculateUpdatedBranchStocks(product, branchId, newStock, allBranches);
  return {
    ...res,
    deductedQty: actualDeduct
  };
}
