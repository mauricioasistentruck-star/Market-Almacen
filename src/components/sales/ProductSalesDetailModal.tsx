import React, { useState, useMemo } from 'react';
import { useTheme } from '../../utils/themeContext';
import {
  X,
  Search,
  Package,
  ArrowUpDown,
  TrendingUp,
  Download,
  FileSpreadsheet
} from 'lucide-react';

export interface ProductSaleRecord {
  code: string;
  name: string;
  category: string;
  quantity: number;
  total: number;
  avgPrice: number;
  salesCount: number;
}

interface ProductSalesDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  productsList: ProductSaleRecord[];
  totalRevenue: number;
  periodLabel: string;
}

export const ProductSalesDetailModal: React.FC<ProductSalesDetailModalProps> = ({
  isOpen,
  onClose,
  productsList,
  totalRevenue,
  periodLabel
}) => {
  const { themeClasses } = useTheme();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'quantity' | 'total' | 'name'>('quantity');

  const filteredAndSorted = useMemo(() => {
    let list = [...productsList];

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      list = list.filter(
        p =>
          p.name.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q)
      );
    }

    if (sortBy === 'quantity') {
      list.sort((a, b) => b.quantity - a.quantity);
    } else if (sortBy === 'total') {
      list.sort((a, b) => b.total - a.total);
    } else if (sortBy === 'name') {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }

    return list;
  }, [productsList, searchTerm, sortBy]);

  const totalUnits = useMemo(() => {
    return productsList.reduce((acc, p) => acc + p.quantity, 0);
  }, [productsList]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-5xl max-h-[92vh] rounded-3xl border ${themeClasses.border} ${themeClasses.card} shadow-2xl flex flex-col overflow-hidden animate-scaleIn`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50 dark:bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-slate-100">
                  Ventas Detalladas por Producto
                </h3>
                <span className="text-[10.5px] font-bold px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
                  {periodLabel}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Auditoría completa de unidades vendidas y montos recaudados por cada producto
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition"
            title="Cerrar ventana"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Resumen Superior Rápido */}
        <div className="p-4 grid grid-cols-3 gap-2.5 sm:gap-4 bg-slate-100/60 dark:bg-slate-900/30 border-b border-slate-200 dark:border-slate-800 text-xs">
          <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
            <span className="block text-[10px] font-black uppercase text-slate-400">Productos Distintos</span>
            <span className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100">
              {productsList.length}
            </span>
          </div>
          <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
            <span className="block text-[10px] font-black uppercase text-slate-400">Total Unidades / Kilos</span>
            <span className="text-base sm:text-lg font-black font-mono text-blue-600 dark:text-blue-400">
              {totalUnits % 1 !== 0 ? totalUnits.toFixed(2) : totalUnits}
            </span>
          </div>
          <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
            <span className="block text-[10px] font-black uppercase text-slate-400">Recaudación Total</span>
            <span className="text-base sm:text-lg font-black font-mono text-emerald-600 dark:text-emerald-400">
              $${totalRevenue.toLocaleString('es-CL')}
            </span>
          </div>
        </div>

        {/* Barra de Filtro y Ordenamiento */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Buscador */}
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nombre, SKU o familia..."
              className={`w-full pl-9 pr-3 py-2 text-xs rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500`}
            />
          </div>

          {/* Opciones de Ordenamiento */}
          <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end text-xs">
            <span className="text-slate-400 font-bold hidden sm:inline">Ordenar:</span>
            <button
              onClick={() => setSortBy('quantity')}
              className={`px-3 py-1.5 rounded-xl font-bold transition ${
                sortBy === 'quantity'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              Mayor Cantidad
            </button>
            <button
              onClick={() => setSortBy('total')}
              className={`px-3 py-1.5 rounded-xl font-bold transition ${
                sortBy === 'total'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              Mayor Total $
            </button>
            <button
              onClick={() => setSortBy('name')}
              className={`px-3 py-1.5 rounded-xl font-bold transition ${
                sortBy === 'name'
                  ? 'bg-slate-700 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              Nombre (A-Z)
            </button>
          </div>
        </div>

        {/* Tabla / Lista Scrollable */}
        <div className="flex-1 overflow-y-auto p-2 sm:p-4">
          {filteredAndSorted.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <Package className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-sm font-bold text-slate-500">
                No se encontraron productos con el filtro aplicado.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-900/80 font-black text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800 text-[11px]">
                    <th className="py-3 px-3 text-center w-12">#</th>
                    <th className="py-3 px-3">Código / SKU</th>
                    <th className="py-3 px-3">Descripción del Producto</th>
                    <th className="py-3 px-3">Familia</th>
                    <th className="py-3 px-3 text-center">Cant. Vendida</th>
                    <th className="py-3 px-3 text-right">P. Promedio</th>
                    <th className="py-3 px-3 text-right">Total CLP</th>
                    <th className="py-3 px-3 text-center">% Ventas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {filteredAndSorted.map((p, idx) => {
                    const pct = totalRevenue > 0 ? Math.round((p.total / totalRevenue) * 100) : 0;
                    const avg = p.quantity > 0 ? Math.round(p.total / p.quantity) : 0;

                    return (
                      <tr
                        key={p.code + idx}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition"
                      >
                        <td className="py-2.5 px-3 text-center font-bold text-slate-400">
                          <span className={`w-6 h-6 rounded-full inline-flex items-center justify-center font-black text-[11px] ${
                            idx === 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border border-amber-300' :
                            idx === 1 ? 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300' :
                            idx === 2 ? 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300' :
                            'text-slate-400'
                          }`}>
                            {idx + 1}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-500">
                          {p.code}
                        </td>
                        <td className="py-2.5 px-3 font-black text-slate-900 dark:text-slate-100">
                          {p.name}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-400">
                            {p.category}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-black text-blue-600 dark:text-blue-400">
                          {p.quantity % 1 !== 0 ? `${p.quantity.toFixed(3)} Kg` : `${p.quantity} Un`}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-600 dark:text-slate-400">
                          $${avg.toLocaleString('es-CL')}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-black text-emerald-600 dark:text-emerald-400">
                          $${p.total.toLocaleString('es-CL')}
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-slate-500">
                          {pct}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/60">
          <span className="text-xs text-slate-500 font-bold">
            Mostrando {filteredAndSorted.length} de {productsList.length} productos registrados
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-black rounded-xl bg-slate-800 hover:bg-slate-700 text-white transition active:scale-95"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
