import React, { useState, useMemo, useEffect } from 'react';
import type { Product, Worker } from '../../types';
import { useTheme } from '../../utils/themeContext';
import { useCompany } from '../../utils/companyContext';
import { useAuth } from '../../utils/authContext';
import { db } from '../../db/database';
import { notifyLocalMutation } from '../../utils/cloudSync';
import { ImageViewerModal } from '../ImageViewerModal';
import { naturalLocationSort } from '../../utils/sortingUtils';
import { exportProductsInventoryExcel } from '../../utils/excelExporter';
import { BarcodePrintModal } from './BarcodePrintModal';
import { ProductDetailModal } from './ProductDetailModal';
import { ProductMovementsHistoryModal } from './ProductMovementsHistoryModal';
import {
  Boxes,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  Sliders,
  FileSpreadsheet,
  Search,
  ScanLine,
  ChevronDown,
  ChevronRight,
  MapPin,
  Tag,
  Barcode,
  History
} from 'lucide-react';

interface ProductListViewProps {
  onOpenNewProduct: () => void;
  onEditProduct: (product: Product) => void;
  onOpenMovement: (product?: Product, defaultType?: 'ENTRADA' | 'SALIDA' | 'AJUSTE') => void;
  onPrintBarcode?: (product: Product) => void;
  onOpenScanner?: () => void;
  refreshTrigger?: number;
}

export const ProductListView: React.FC<ProductListViewProps> = ({
  onOpenNewProduct,
  onEditProduct,
  onOpenMovement,
  onPrintBarcode,
  onOpenScanner,
  refreshTrigger
}) => {
  const { themeClasses } = useTheme();
  const { selectedCompanyId, selectedCompany } = useCompany();
  const { isReadOnly, canDeleteProducts, canExportImport } = useAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedLocationGroup, setSelectedLocationGroup] = useState('ALL');
  const [selectedCondition, setSelectedCondition] = useState('ALL');
  const [onlyCriticalStock, setOnlyCriticalStock] = useState(false);
  const [onlyFilters, setOnlyFilters] = useState(false);

  // Pagination for performance
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  // Modals state
  const [selectedProductForPhoto, setSelectedProductForPhoto] = useState<Product | null>(null);
  const [isBarcodePrintOpen, setIsBarcodePrintOpen] = useState(false);
  const [isMovementsHistoryOpen, setIsMovementsHistoryOpen] = useState(false);
  const [selectedProductForHistory, setSelectedProductForHistory] = useState<Product | null>(null);
  const [selectedProductForBarcode, setSelectedProductForBarcode] = useState<Product | null>(null);
  const [selectedProductForDetail, setSelectedProductForDetail] = useState<Product | null>(null);

  useEffect(() => {
    loadProducts();
  }, [refreshTrigger, selectedCompanyId]);

  const loadProducts = async () => {
    const all = await db.products.toArray();
    if (selectedCompanyId !== 'ALL') {
      const targetId = (selectedCompanyId || '').toLowerCase().trim();
      const filtered = all.filter(p => (p.companyId || '').toLowerCase().trim() === targetId);
      setProducts(filtered.reverse());
    } else {
      setProducts(all.reverse());
    }
  };

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [products]);

  const locationGroups = useMemo(() => {
    interface LocGroup {
      id: string;
      label: string;
      count: number;
      matcher: (loc: string) => boolean;
    }
    const groupsMap = new Map<string, LocGroup>();

    for (const p of products) {
      const loc = (p.location || 'Sin Ubicación').trim();
      if (!loc) continue;

      const moduloMatch = loc.match(/^(Módulo\s+[A-Za-z0-9]+|Modulo\s+[A-Za-z0-9]+|Bodega\s+[A-Za-z0-9]+|Pasillo\s+[A-Za-z0-9]+|Estante\s+[A-Za-z0-9]+|Sección\s+[A-Za-z0-9]+|Sector\s+[A-Za-z0-9]+|Nivel\s+[A-Za-z0-9]+)/i);
      const letterNumMatch = loc.match(/^([A-Za-z]+)[-_\s]*[0-9]+/);

      let groupKey = '';
      let groupLabel = '';

      if (moduloMatch) {
        groupKey = moduloMatch[1].toUpperCase();
        groupLabel = moduloMatch[1];
      } else if (letterNumMatch) {
        const prefix = letterNumMatch[1].toUpperCase();
        groupKey = `MÓDULO ${prefix}`;
        groupLabel = `Módulo ${prefix}`;
      } else {
        groupKey = loc.toUpperCase();
        groupLabel = loc;
      }

      if (!groupsMap.has(groupKey)) {
        groupsMap.set(groupKey, {
          id: groupKey,
          label: groupLabel,
          count: 0,
          matcher: (l: string) => {
            const cleanL = (l || 'Sin Ubicación').trim().toUpperCase();
            if (moduloMatch) return cleanL.startsWith(moduloMatch[1].toUpperCase());
            if (letterNumMatch) {
              const pfx = letterNumMatch[1].toUpperCase();
              return cleanL.startsWith(pfx) || cleanL.startsWith(`MÓDULO ${pfx}`) || cleanL.startsWith(`MODULO ${pfx}`);
            }
            return cleanL === groupKey;
          }
        });
      }
      groupsMap.get(groupKey)!.count++;
    }

    return Array.from(groupsMap.values()).sort((a, b) => a.label.localeCompare(b.label, 'es', { numeric: true }));
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    const result = products.filter((p) => {
      if (selectedCategory !== 'ALL' && p.category !== selectedCategory) return false;

      if (selectedLocationGroup !== 'ALL') {
        const group = locationGroups.find(g => g.id === selectedLocationGroup);
        if (group && !group.matcher(p.location || '')) return false;
      }

      if (onlyCriticalStock && (p.stock > p.minStock)) return false;

      if (onlyFilters) {
        const isFilter = (p.category && p.category.toLowerCase().includes('filtro')) ||
                         (p.mannFilterCode && p.mannFilterCode.trim().length > 0) ||
                         (p.name && p.name.toLowerCase().includes('filtro'));
        if (!isFilter) return false;
      }

      if (selectedCondition !== 'ALL' && p.condition !== selectedCondition) return false;

      if (!q) return true;
      return (
        p.code.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        (p.brand && p.brand.toLowerCase().includes(q)) ||
        (p.mannFilterCode && p.mannFilterCode.toLowerCase().includes(q)) ||
        (p.location && p.location.toLowerCase().includes(q)) ||
        (p.conditionNotes && p.conditionNotes.toLowerCase().includes(q))
      );
    });

    if (selectedLocationGroup !== 'ALL') {
      return naturalLocationSort(result);
    }
    return result;
  }, [products, searchTerm, selectedCategory, selectedLocationGroup, selectedCondition, onlyCriticalStock, onlyFilters, locationGroups]);

  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredProducts.slice(start, start + pageSize);
  }, [filteredProducts, currentPage]);

  const totalPages = Math.ceil(filteredProducts.length / pageSize) || 1;

  const handleDelete = async (id?: number) => {
    if (!id) return;
    const prod = await db.products.get(id);
    if (!prod) return;
    if (confirm(`¿Está seguro de eliminar el producto "${prod.name}" (${prod.code}) del inventario?`)) {
      if (prod.stock > 0) {
        await db.productMovements.add({
          productId: prod.id!,
          productCode: prod.code,
          productName: prod.name,
          type: 'SALIDA',
          quantity: prod.stock,
          previousStock: prod.stock,
          newStock: 0,
          reason: 'Baja / Eliminación de Producto del Inventario',
          workerOrSupplier: 'Encargado de Bodega',
          date: new Date().toISOString(),
          companyId: prod.companyId || 'market-almacen',
          user: 'Mauricio Chamorro'
        });
      }
      await db.products.delete(id);
      notifyLocalMutation();
      loadProducts();
    }
  };

  const handleExportExcel = () => {
    const compName = selectedCompanyId === 'ALL' ? 'Todas_las_Empresas' : selectedCompany?.name || 'Bodega';
    exportProductsInventoryExcel(filteredProducts, compName);
  };

  return (
    <div className="space-y-4">
      {/* Header and Quick Stats */}
      <div className={`p-4 sm:p-5 rounded-3xl border ${themeClasses.border} ${themeClasses.card} flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 shadow-sm`}>
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-slate-100">
              1. Inventario de Productos
            </h2>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-mono font-black bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 whitespace-nowrap shadow-sm">
              {filteredProducts.length.toLocaleString('es-CL')} ítems
            </span>
          </div>
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <span>Empresa:</span>
            <span className="text-slate-800 dark:text-slate-200 font-extrabold">{selectedCompany?.name || 'MARKET ALMACÉN SpA'}</span>
          </p>
        </div>

        {/* Action Buttons Toolbar */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-start lg:justify-end">
          
          {/* Nuevo Producto */}
          {!isReadOnly && (
            <button
              type="button"
              onClick={onOpenNewProduct}
              className="flex items-center gap-2 px-4 py-2 text-xs font-black rounded-xl bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/25 transition active:scale-95 whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Nuevo Producto</span>
            </button>
          )}

          {/* Movimientos de Stock / Kardex (Exclusivo Administrador) */}
          {!isReadOnly && (
            <button
              type="button"
              onClick={() => {
                setSelectedProductForHistory(null);
                setIsMovementsHistoryOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-black rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 transition active:scale-95 whitespace-nowrap cursor-pointer shadow-xs"
              title="[Exclusivo Administrador] Consultar movimientos históricos de stock y Kardex de todos los productos"
            >
              <History className="w-4 h-4 text-indigo-600 stroke-[2.5]" />
              <span>Movimientos / Kardex</span>
            </button>
          )}

          {/* Códigos de Barra */}
          <button
            type="button"
            onClick={() => {
              setSelectedProductForBarcode(null);
              setIsBarcodePrintOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-black rounded-xl bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/50 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-700 transition shadow-sm active:scale-95 whitespace-nowrap cursor-pointer"
            title="Crear e Imprimir Códigos de Barra para Impresoras SATO, Térmicas y Hoja Carta"
          >
            <Barcode className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <span>Códigos de Barra</span>
          </button>

          {/* Entrada Stock */}
          <button
            type="button"
            onClick={() => onOpenMovement(undefined, 'ENTRADA')}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-black rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 transition shadow-sm active:scale-95 whitespace-nowrap cursor-pointer"
          >
            <ArrowDownLeft className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Entrada</span>
          </button>

          {/* Salida Stock */}
          <button
            type="button"
            onClick={() => onOpenMovement(undefined, 'SALIDA')}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-black rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/50 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 transition shadow-sm active:scale-95 whitespace-nowrap cursor-pointer"
          >
            <ArrowUpRight className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span>Salida</span>
          </button>

          {/* Ajuste Stock */}
          <button
            type="button"
            onClick={() => onOpenMovement(undefined, 'AJUSTE')}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-black rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 transition shadow-sm active:scale-95 whitespace-nowrap cursor-pointer"
            title="Ajuste y cuadratura de stock físico"
          >
            <Sliders className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>Ajuste</span>
          </button>

          {/* Exportar Excel */}
          {canExportImport && (
            <button
              type="button"
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition shadow-sm active:scale-95 whitespace-nowrap cursor-pointer"
              title="Exportar listado a Excel"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Excel</span>
            </button>
          )}

        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className={`p-3.5 rounded-3xl border ${themeClasses.border} ${themeClasses.card} space-y-3 shadow-sm`}>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-center">
          
          <div className="md:col-span-8 relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nombre, código de barras, categoría, marca..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className={`w-full pl-10 pr-10 py-2.5 text-xs font-medium rounded-2xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} focus:outline-none focus:border-blue-500`}
            />
            {onOpenScanner && (
              <button
                type="button"
                onClick={onOpenScanner}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-200"
                title="Escanear con cámara"
              >
                <ScanLine className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="md:col-span-4">
            <select
              value={selectedCondition}
              onChange={(e) => {
                setSelectedCondition(e.target.value);
                setCurrentPage(1);
              }}
              className={`w-full px-3 py-2.5 text-xs font-bold rounded-2xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} focus:outline-none`}
            >
              <option value="ALL">✨ Todos los Estados</option>
              <option value="DISPONIBLE">🟢 Disponible</option>
              <option value="NUEVO">✨ Nuevo</option>
              <option value="OFERTA">🏷️ En Oferta</option>
              <option value="EXCELENTE">⭐ Excelente</option>
              <option value="BUENO">👍 Bueno</option>
              <option value="REGULAR">🔹 Regular</option>
              <option value="LIQUIDACION">⚡ En Liquidación</option>
              <option value="POR_VENCER">⏳ Próximo a Vencer</option>
              <option value="AGOTADO">📦 Agotado / Sin Stock</option>
              <option value="DANADO">⚠️ Dañado / Merma</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table of Products (Simplified Clean 6 Columns - Click row to open full details) */}
      <div className={`rounded-3xl border-2 ${themeClasses.border} ${themeClasses.card} overflow-hidden shadow-sm`}>
        
        {/* Mobile View: Clean Card List (< lg) */}
        <div className="lg:hidden divide-y divide-slate-200 dark:divide-slate-800">
          {paginatedProducts.length === 0 ? (
            <div className="p-8 text-center text-slate-500 font-bold text-xs">
              No se encontraron productos en el inventario.
            </div>
          ) : (
            paginatedProducts.map((p) => {
              const isCritical = (p.stock || 0) <= (p.minStock || 0);
              return (
                <div
                  key={p.id}
                  onClick={() => setSelectedProductForDetail(p)}
                  className="p-3.5 flex items-center justify-between gap-3 cursor-pointer hover:bg-blue-50/50 dark:hover:bg-slate-800/50 transition active:scale-[0.99]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0 overflow-hidden">
                      {p.imageUrl ? (
                        <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                      ) : (
                        <Boxes className="w-5 h-5 text-slate-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <span className="font-mono text-[11px] font-black text-orange-600 dark:text-orange-400 block">
                        {p.code}
                      </span>
                      <h4 className="text-xs font-black text-slate-900 dark:text-slate-100 truncate">
                        {p.name}
                      </h4>
                      <p className="text-[11px] font-bold text-slate-500 font-mono">
                        {p.location || 'Sin Ubicación'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs font-black font-mono text-emerald-700 dark:text-emerald-400 block">
                      ${Math.round(p.price || 0).toLocaleString('es-CL')}
                    </span>
                    <span className={`text-[11px] font-black px-2 py-0.5 rounded-lg border font-mono ${
                      isCritical ? 'bg-red-100 text-red-700 border-red-300' : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    }`}>
                      {p.stock} {p.unit || 'UN'}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop View: Table (>= lg) */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full table-fixed text-left text-xs border-collapse">
            <thead className="bg-slate-100 dark:bg-slate-900 font-black text-slate-900 dark:text-slate-100 border-b-2 border-slate-300 dark:border-slate-700 select-none">
              <tr>
                <th className="py-3.5 px-2 w-[6%] text-center">FOTO</th>
                <th className="py-3.5 px-2 w-[16%] text-left whitespace-nowrap">CÓDIGO / SKU</th>
                <th className="py-3.5 px-3 w-[42%] text-left">PRODUCTO / DESCRIPCIÓN</th>
                <th className="py-3.5 px-2 w-[12%] text-right whitespace-nowrap">PRECIO ($)</th>
                <th className="py-3.5 px-2 w-[12%] text-center whitespace-nowrap">STOCK ACTUAL</th>
                <th className="py-3.5 px-2 w-[12%] text-center whitespace-nowrap">UBICACIÓN</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {paginatedProducts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    <Boxes className="w-12 h-12 mx-auto text-slate-400 mb-2 opacity-50" />
                    <p className="font-black text-base text-slate-700 dark:text-slate-300">No se encontraron productos</p>
                    <p className="text-xs text-slate-500 font-bold mt-0.5">Presione "+ Nuevo Producto" para registrar ítems en el catálogo.</p>
                  </td>
                </tr>
              ) : (
                paginatedProducts.map((p) => {
                  const isCritical = (p.stock || 0) <= (p.minStock || 0);
                  return (
                    <tr
                      key={p.id}
                      onClick={() => setSelectedProductForDetail(p)}
                      className="hover:bg-blue-50/80 dark:hover:bg-slate-800/80 transition cursor-pointer group select-none"
                      title="Haga clic para ver la ficha completa del producto y sus acciones"
                    >
                      {/* 1. Foto */}
                      <td className="py-2.5 px-2 text-center align-middle">
                        <div
                          onClick={(e) => {
                            if (p.imageUrl) {
                              e.stopPropagation();
                              setSelectedProductForPhoto(p);
                            }
                          }}
                          className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden mx-auto shadow-xs"
                        >
                          {p.imageUrl ? (
                            <img
                              src={p.imageUrl}
                              alt={p.name}
                              className="w-full h-full object-cover group-hover:scale-110 transition"
                              loading="lazy"
                            />
                          ) : (
                            <Boxes className="w-5 h-5 text-slate-400 group-hover:text-blue-500 transition" />
                          )}
                        </div>
                      </td>

                      {/* 2. Código / SKU */}
                      <td className="py-2.5 px-2 text-left whitespace-nowrap align-middle">
                        <span className="font-mono font-black text-orange-600 dark:text-orange-400 text-xs sm:text-sm tracking-wide block">
                          {p.code}
                        </span>
                      </td>

                      {/* 3. Nombre del Producto & Detalle */}
                      <td className="py-2.5 px-3 text-left align-middle">
                        <div className="font-black text-slate-900 dark:text-slate-100 text-xs sm:text-sm leading-snug group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">
                          {p.name}
                        </div>
                      </td>

                      {/* 4. Precio Venta */}
                      <td className="py-2.5 px-2 text-right whitespace-nowrap align-middle">
                        <span className="font-mono font-black text-emerald-700 dark:text-emerald-400 text-xs sm:text-sm">
                          {p.price ? `$${Math.round(p.price).toLocaleString('es-CL')}` : '$0'}
                        </span>
                      </td>

                      {/* 5. Stock Actual */}
                      <td className="py-2.5 px-2 text-center whitespace-nowrap align-middle">
                        <div className="inline-flex items-center gap-1.5">
                          <span
                            className={`font-mono text-xs sm:text-sm font-black px-2.5 py-1 rounded-xl border shadow-xs ${
                              isCritical
                                ? 'bg-red-100 text-red-700 border-red-300 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800 animate-pulse'
                                : 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                            }`}
                          >
                            {p.stock} {p.unit || 'Unid'}
                          </span>
                        </div>
                      </td>

                      {/* 6. Ubicación */}
                      <td className="py-2.5 px-2 text-center whitespace-nowrap align-middle">
                        <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-mono font-bold text-xs">
                          {p.location || 'Sin Ubicación'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="p-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs bg-slate-50 dark:bg-slate-900/60">
            <span className="text-slate-500 font-bold">
              Mostrando {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, filteredProducts.length)} de {filteredProducts.length} productos
            </span>
            <div className="flex items-center gap-1">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 disabled:opacity-40 hover:bg-slate-300 text-slate-800 dark:text-slate-200 font-bold transition cursor-pointer"
              >
                Anterior
              </button>
              <span className="px-2.5 font-mono font-black text-slate-800 dark:text-slate-200">
                {currentPage} / {totalPages}
              </span>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 disabled:opacity-40 hover:bg-slate-300 text-slate-800 dark:text-slate-200 font-bold transition cursor-pointer"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Fullscreen Photo Viewer Modal */}
      {selectedProductForPhoto && selectedProductForPhoto.imageUrl && (
        <ImageViewerModal
          isOpen={Boolean(selectedProductForPhoto)}
          onClose={() => setSelectedProductForPhoto(null)}
          imageUrl={selectedProductForPhoto.imageUrl}
          title={selectedProductForPhoto.name}
          subtitle={`Código: ${selectedProductForPhoto.code} • Categoría: ${selectedProductForPhoto.category}`}
        />
      )}

      {/* Modal de Impresión de Códigos de Barra SATO / Térmica / Hoja Carta */}
      <BarcodePrintModal
        isOpen={isBarcodePrintOpen}
        onClose={() => setIsBarcodePrintOpen(false)}
        initialSelectedProduct={selectedProductForBarcode}
      />

      {/* Modal Ficha Completa del Producto al presionar la fila */}
      <ProductDetailModal
        product={selectedProductForDetail}
        isOpen={Boolean(selectedProductForDetail)}
        onClose={() => setSelectedProductForDetail(null)}
        onEdit={(prod) => {
          setSelectedProductForDetail(null);
          onEditProduct(prod);
        }}
        onDelete={(id) => {
          setSelectedProductForDetail(null);
          handleDelete(id);
        }}
        onOpenMovement={(prod, movType) => {
          setSelectedProductForDetail(null);
          onOpenMovement(prod, movType);
        }}
        onOpenBarcode={(prod) => {
          setSelectedProductForDetail(null);
          setSelectedProductForBarcode(prod);
          setIsBarcodePrintOpen(true);
        }}
        onOpenPhotoViewer={(prod) => {
          setSelectedProductForDetail(null);
          setSelectedProductForPhoto(prod);
        }}
        onOpenMovementsHistory={(prod) => {
          setSelectedProductForDetail(null);
          setSelectedProductForHistory(prod);
          setIsMovementsHistoryOpen(true);
        }}
      />

      {/* Modal de Historial de Movimientos / Kardex (Exclusivo Administrador) */}
      {isMovementsHistoryOpen && (
        <ProductMovementsHistoryModal
          isOpen={isMovementsHistoryOpen}
          onClose={() => {
            setIsMovementsHistoryOpen(false);
            setSelectedProductForHistory(null);
          }}
          initialProduct={selectedProductForHistory}
          products={products}
        />
      )}
    </div>
  );
};
