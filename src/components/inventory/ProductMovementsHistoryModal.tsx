import { useBodyScrollLock } from '../../utils/scrollLock';
import React, { useState, useEffect, useMemo } from 'react';
import { useTheme } from '../../utils/themeContext';
import { useCompany } from '../../utils/companyContext';
import { useAuth } from '../../utils/authContext';
import { db } from '../../db/database';
import type { Product, ProductMovement } from '../../types';
import { exportProductMovementsExcel } from '../../utils/excelExporter';
import { formatChileDateTime } from '../../utils/chileanCurrencyAndDates';
import {
  X,
  History,
  ArrowDownLeft,
  ArrowUpRight,
  Sliders,
  FileSpreadsheet,
  Search,
  Calendar,
  Filter,
  ShieldCheck,
  Package,
  Layers,
  ArrowRight
} from 'lucide-react';

interface ProductMovementsHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialProduct?: Product | null;
  products: Product[];
}

export const ProductMovementsHistoryModal: React.FC<ProductMovementsHistoryModalProps> = ({
  isOpen,
  onClose,
  initialProduct,
  products
}) => {
  useBodyScrollLock(Boolean(isOpen));
  const { themeClasses } = useTheme();
  const { selectedCompanyId, selectedCompany } = useCompany();
  const { isAdmin, currentUser } = useAuth();

  const [allMovements, setAllMovements] = useState<ProductMovement[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<number | 'ALL'>('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'ENTRADA' | 'SALIDA' | 'AJUSTE'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState<'ALL' | 'TODAY' | '7DAYS' | 'MONTH'>('ALL');

  useEffect(() => {
    if (initialProduct?.id) {
      setSelectedProductId(initialProduct.id);
    } else {
      setSelectedProductId('ALL');
    }
  }, [initialProduct, isOpen]);

  // Cargar movimientos desde IndexedDB
  const loadMovements = async () => {
    try {
      const records = await db.productMovements.toArray();
      // Ordenar por fecha descendente
      records.sort((a, b) => {
        const timeA = new Date(a.date || a.createdAt || 0).getTime();
        const timeB = new Date(b.date || b.createdAt || 0).getTime();
        return timeB - timeA;
      });
      setAllMovements(records);
    } catch (err) {
      console.error('Error al cargar movimientos de stock:', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadMovements();
    }
  }, [isOpen, selectedCompanyId]);

  // Movimientos filtrados
  const filteredMovements = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const currentMonth = todayStr.slice(0, 7);

    return allMovements.filter((m) => {
      // Filtro por empresa
      if (selectedCompanyId && selectedCompanyId !== 'ALL' && m.companyId && m.companyId !== selectedCompanyId) {
        return false;
      }

      // Filtro por producto
      if (selectedProductId !== 'ALL' && m.productId !== selectedProductId) {
        return false;
      }

      // Filtro por tipo
      if (typeFilter !== 'ALL' && m.type !== typeFilter) {
        return false;
      }

      // Filtro por fecha
      if (dateFilter !== 'ALL') {
        const mTime = new Date(m.date || m.createdAt || 0).getTime();
        const mDateStr = (m.date || m.createdAt || '').slice(0, 10);
        if (dateFilter === 'TODAY' && mDateStr !== todayStr) return false;
        if (dateFilter === '7DAYS' && (!mTime || mTime < sevenDaysAgo)) return false;
        if (dateFilter === 'MONTH' && !mDateStr.startsWith(currentMonth)) return false;
      }

      // Filtro por búsqueda
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const match =
          (m.productCode && m.productCode.toLowerCase().includes(q)) ||
          (m.productName && m.productName.toLowerCase().includes(q)) ||
          (m.reason && m.reason.toLowerCase().includes(q)) ||
          (m.referenceDoc && m.referenceDoc.toLowerCase().includes(q)) ||
          (m.user && m.user.toLowerCase().includes(q)) ||
          (m.responsibleName && m.responsibleName.toLowerCase().includes(q)) ||
          (m.workerOrSupplier && m.workerOrSupplier.toLowerCase().includes(q));
        if (!match) return false;
      }

      return true;
    });
  }, [allMovements, selectedCompanyId, selectedProductId, typeFilter, dateFilter, searchTerm]);

  // Totales para KPIs
  const stats = useMemo(() => {
    let entradasQty = 0;
    let salidasQty = 0;
    let ajustesQty = 0;

    filteredMovements.forEach((m) => {
      if (m.type === 'ENTRADA') entradasQty += m.quantity;
      else if (m.type === 'SALIDA') salidasQty += m.quantity;
      else if (m.type === 'AJUSTE') ajustesQty += m.quantity;
    });

    return {
      totalCount: filteredMovements.length,
      entradasQty,
      salidasQty,
      ajustesQty
    };
  }, [filteredMovements]);

  // Exportar a Excel
  const handleExportExcel = () => {
    if (filteredMovements.length === 0) {
      alert('No hay movimientos en la vista actual para exportar.');
      return;
    }
    const companyName = selectedCompany?.name || 'Market Almacén';
    const prodName = selectedProductId !== 'ALL'
      ? products.find(p => p.id === selectedProductId)?.name || 'Producto'
      : undefined;
    
    exportProductMovementsExcel(
      filteredMovements,
      prodName ? `${companyName}_${prodName}` : companyName
    );
  };

  if (!isOpen) return null;

  // Verificación de seguridad: Solo Administrador
  if (!isAdmin && currentUser?.role !== 'ADMIN') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
        <div className={`p-6 rounded-3xl border-2 ${themeClasses.card} shadow-2xl max-w-md w-full text-center space-y-4`}>
          <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400 mx-auto flex items-center justify-center">
            <X className="w-6 h-6" />
          </div>
          <h3 className="text-base font-black text-slate-900 dark:text-white">Acceso Restringido</h3>
          <p className="text-xs text-slate-500 font-bold">
            El módulo de Historial de Movimientos y Kardex es exclusivo para el usuario con perfil de Administrador.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-black text-xs cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    );
  }

  const selectedProductObj = selectedProductId !== 'ALL' ? products.find(p => p.id === selectedProductId) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div className={`w-full max-w-5xl rounded-3xl border-2 ${themeClasses.border} ${themeClasses.card} shadow-2xl flex flex-col overflow-hidden max-h-[92vh] animate-in zoom-in-95 duration-150`}>
        
        {/* Cabecera del Modal */}
        <div className="px-5 py-3.5 border-b-2 border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/90 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shrink-0">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                  Historial de Movimientos de Stock & Kardex
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  <span>Exclusivo Administrador</span>
                </span>
              </div>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                Auditoría completa de entradas, salidas, ventas, compras, mermas y ajustes de inventario
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cuerpo del Modal */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto">
          
          {/* Tarjetas de KPIs del Historial */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Total Movimientos</span>
              <p className="text-lg sm:text-xl font-black font-mono text-slate-900 dark:text-white mt-0.5">
                {stats.totalCount}
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
              <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block flex items-center gap-1">
                <ArrowDownLeft className="w-3 h-3 stroke-[3]" />
                Entradas (Stock +)
              </span>
              <p className="text-lg sm:text-xl font-black font-mono text-emerald-700 dark:text-emerald-300 mt-0.5">
                +{stats.entradasQty} <span className="text-xs font-normal">un</span>
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800">
              <span className="text-[10px] font-black text-blue-700 dark:text-blue-400 uppercase tracking-wider block flex items-center gap-1">
                <ArrowUpRight className="w-3 h-3 stroke-[3]" />
                Salidas / Ventas
              </span>
              <p className="text-lg sm:text-xl font-black font-mono text-blue-700 dark:text-blue-300 mt-0.5">
                -{stats.salidasQty} <span className="text-xs font-normal">un</span>
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
              <span className="text-[10px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-wider block flex items-center gap-1">
                <Sliders className="w-3 h-3" />
                Ajustes / Mermas
              </span>
              <p className="text-lg sm:text-xl font-black font-mono text-amber-700 dark:text-amber-300 mt-0.5">
                {stats.ajustesQty} <span className="text-xs font-normal">un</span>
              </p>
            </div>
          </div>

          {/* Barra de Filtros y Selector de Producto */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {/* Selector de Producto o Todos */}
              <div>
                <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                  <Package className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Producto Seleccionado:</span>
                </label>
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs font-black text-slate-900 dark:text-white focus:outline-none"
                >
                  <option value="ALL">📦 Todos los Productos (Historial Global)</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.code}) — Stock: {p.stock} {p.unit || 'UN'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Filtro por Tipo de Movimiento */}
              <div>
                <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                  <Filter className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Tipo de Movimiento:</span>
                </label>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value as any)}
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs font-black text-slate-900 dark:text-white focus:outline-none"
                >
                  <option value="ALL">Todos los Tipos de Movimiento</option>
                  <option value="ENTRADA">🟢 Entradas (Compras, Devoluciones, Recepción)</option>
                  <option value="SALIDA">🔵 Salidas (Ventas POS, Consumo)</option>
                  <option value="AJUSTE">🟠 Ajustes de Inventario y Mermas</option>
                </select>
              </div>

              {/* Buscador de Texto */}
              <div className="sm:col-span-2 lg:col-span-1">
                <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                  <Search className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Buscar por motivo, folio o responsable:</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Ej. Venta #1001, Coca-Cola, Merma..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-white focus:outline-none"
                  />
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>
              </div>
            </div>

            {/* Fila Inferior: Filtros de Fecha y Botón de Excel */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-1 text-xs">
                <span className="text-[11px] font-bold text-slate-500 mr-1">Periodo:</span>
                {[
                  { id: 'ALL', label: 'Todo el Historial' },
                  { id: 'TODAY', label: 'Hoy' },
                  { id: '7DAYS', label: '7 Días' },
                  { id: 'MONTH', label: 'Mes' }
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setDateFilter(f.id as any)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-black transition cursor-pointer ${
                      dateFilter === f.id
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Botón de Exportar a Excel Exclusivo Admin */}
              <button
                type="button"
                onClick={handleExportExcel}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md transition active:scale-95 cursor-pointer ml-auto"
                title="Descargar historial de movimientos filtrado en formato Excel XLSX"
              >
                <FileSpreadsheet className="w-4 h-4 stroke-[2.5]" />
                <span>Exportar Kardex a Excel (XLSX)</span>
              </button>
            </div>
          </div>

          {/* Información del Producto si está seleccionado uno individual */}
          {selectedProductObj && (
            <div className="p-3 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div>
                <p className="font-black text-indigo-950 dark:text-indigo-200 text-sm">
                  {selectedProductObj.name}
                </p>
                <p className="text-[11px] text-slate-500 font-bold">
                  Código: <strong className="font-mono text-slate-700 dark:text-slate-300">{selectedProductObj.code}</strong> • Categoría: {selectedProductObj.category} • Ubicación: {selectedProductObj.location || 'Almacén'}
                </p>
              </div>
              <div className="flex items-center gap-3 font-mono font-black text-xs">
                <span className="px-2.5 py-1 rounded-xl bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300">
                  Stock Actual: {selectedProductObj.stock} {selectedProductObj.unit || 'UN'}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedProductId('ALL')}
                  className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                >
                  (Ver todos los productos)
                </button>
              </div>
            </div>
          )}

          {/* Tabla de Movimientos */}
          <div className="rounded-2xl border-2 border-slate-200 dark:border-slate-700 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800/90 border-b-2 border-slate-200 dark:border-slate-700 font-black text-slate-700 dark:text-slate-300">
                    <th className="py-2.5 px-3">Fecha y Hora</th>
                    <th className="py-2.5 px-3 text-center">Tipo</th>
                    <th className="py-2.5 px-3">Producto</th>
                    <th className="py-2.5 px-3 text-center">Stock Ant.</th>
                    <th className="py-2.5 px-3 text-center">Cantidad</th>
                    <th className="py-2.5 px-3 text-center">Stock Nuevo</th>
                    <th className="py-2.5 px-3">Motivo / Justificación</th>
                    <th className="py-2.5 px-3">Responsable</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-bold">
                  {filteredMovements.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        No se encontraron movimientos registrados con los filtros seleccionados
                      </td>
                    </tr>
                  ) : (
                    filteredMovements.map((m) => (
                      <tr key={m.id || `${m.date}-${m.productId}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {formatChileDateTime(m.date || m.createdAt)}
                        </td>
                        
                        {/* Tipo de Movimiento con Badge */}
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black ${
                            m.type === 'ENTRADA'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : m.type === 'SALIDA'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          }`}>
                            {m.type === 'ENTRADA' && <ArrowDownLeft className="w-3 h-3 stroke-[3]" />}
                            {m.type === 'SALIDA' && <ArrowUpRight className="w-3 h-3 stroke-[3]" />}
                            {m.type === 'AJUSTE' && <Sliders className="w-3 h-3" />}
                            <span>{m.type}</span>
                          </span>
                        </td>

                        {/* Producto */}
                        <td className="py-2.5 px-3">
                          <p className="font-black text-slate-900 dark:text-slate-100 truncate max-w-[180px]">
                            {m.productName || 'Producto General'}
                          </p>
                          <p className="text-[10px] font-mono text-slate-400 font-bold">{m.productCode}</p>
                        </td>

                        {/* Stock Anterior */}
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-500">
                          {m.previousStock !== undefined ? m.previousStock : '---'}
                        </td>

                        {/* Cantidad */}
                        <td className="py-2.5 px-3 text-center font-mono font-black whitespace-nowrap">
                          <span className={
                            m.type === 'ENTRADA'
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : m.type === 'SALIDA'
                              ? 'text-blue-600 dark:text-blue-400'
                              : 'text-amber-600 dark:text-amber-400'
                          }>
                            {m.type === 'ENTRADA' ? `+${m.quantity}` : m.type === 'SALIDA' ? `-${m.quantity}` : m.quantity}
                          </span>
                        </td>

                        {/* Stock Resultante */}
                        <td className="py-2.5 px-3 text-center font-mono font-black text-slate-900 dark:text-slate-100">
                          {m.newStock !== undefined ? m.newStock : '---'}
                        </td>

                        {/* Motivo */}
                        <td className="py-2.5 px-3">
                          <p className="text-slate-800 dark:text-slate-200 truncate max-w-[220px]" title={m.reason}>
                            {m.reason}
                          </p>
                          {m.referenceDoc && (
                            <span className="text-[10px] font-mono font-black text-indigo-600 dark:text-indigo-400">
                              Ref: {m.referenceDoc}
                            </span>
                          )}
                        </td>

                        {/* Responsable */}
                        <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          {m.responsibleName || m.user || m.workerOrSupplier || 'Caja / Admin'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* Pie del Modal */}
        <div className="px-5 py-3 border-t-2 border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/90 flex items-center justify-between shrink-0">
          <p className="text-[11px] text-slate-500 font-bold">
            Mostrando <strong className="text-slate-800 dark:text-slate-200">{filteredMovements.length}</strong> movimientos registrados
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-black bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition cursor-pointer active:scale-95"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
};
