import React, { useState, useMemo } from 'react';
import jsPDF from 'jspdf';
import { useTheme } from '../../utils/themeContext';
import type { Sale, Company } from '../../types';
import { formatCLP, generateSalesReportPDF } from '../../utils/salesPdfGenerator';
import { exportSalesLedgerExcel } from '../../utils/salesExcelExporter';
import {
  BarChart3,
  Calendar,
  Download,
  FileSpreadsheet,
  FileText,
  DollarSign,
  Receipt,
  Tag,
  Building,
  TrendingUp,
  Award,
  CreditCard,
  Banknote,
  ArrowUpRight,
  Sparkles,
  CheckCircle2,
  CalendarDays,
  ShoppingBag,
  Package,
  Layers,
  Scale
} from 'lucide-react';

interface SalesReportsSubViewProps {
  sales: Sale[];
  company?: Company | null;
  onOpenPdf: (doc: jsPDF, filename: string, title: string) => void;
}

export const SalesReportsSubView: React.FC<SalesReportsSubViewProps> = ({
  sales,
  company,
  onOpenPdf
}) => {
  const { themeClasses } = useTheme();

  // Filtro de período
  const [dateFilter, setDateFilter] = useState<'today' | '7days' | 'month' | 'all' | 'custom'>('7days');
  const [customStart, setCustomStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [customEnd, setCustomEnd] = useState(() => new Date().toISOString().split('T')[0]);

  // Etiqueta legible del período
  const periodLabel = useMemo(() => {
    switch (dateFilter) {
      case 'today': return 'Ventas de Hoy';
      case '7days': return 'Últimos 7 Días (Esta Semana)';
      case 'month': return 'Mes en Curso';
      case 'all': return 'Todo el Histórico';
      case 'custom': return `Desde ${customStart} hasta ${customEnd}`;
    }
  }, [dateFilter, customStart, customEnd]);

  // Filtrado de ventas
  const filteredSales = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    return sales.filter(s => {
      if (!s.createdAt) return false;
      const saleDateStr = s.createdAt.split('T')[0];

      if (dateFilter === 'today') {
        return saleDateStr === todayStr;
      }
      if (dateFilter === '7days') {
        const diffMs = now.getTime() - new Date(s.createdAt).getTime();
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        return diffDays <= 7;
      }
      if (dateFilter === 'month') {
        const d = new Date(s.createdAt);
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      }
      if (dateFilter === 'custom') {
        return saleDateStr >= customStart && saleDateStr <= customEnd;
      }
      return true; // 'all'
    });
  }, [sales, dateFilter, customStart, customEnd]);

  // Ventas activas y anuladas
  const activeSales = useMemo(() => filteredSales.filter(s => s.status !== 'ANULADA'), [filteredSales]);
  const canceledSales = useMemo(() => filteredSales.filter(s => s.status === 'ANULADA'), [filteredSales]);

  // Totales financieros
  const totalRevenue = useMemo(() => activeSales.reduce((sum, s) => sum + (s.total || 0), 0), [activeSales]);
  const totalNeto = useMemo(() => activeSales.reduce((sum, s) => sum + (s.subtotalNeto || 0), 0), [activeSales]);
  const totalIva = useMemo(() => activeSales.reduce((sum, s) => sum + (s.iva || 0), 0), [activeSales]);
  const totalSalesCount = activeSales.length;
  const avgTicket = totalSalesCount > 0 ? Math.round(totalRevenue / totalSalesCount) : 0;

  // Desglose de Comprobantes Emitidos (Boletas, Facturas y Ventas Internas)
  const dteBreakdown = useMemo(() => {
    const boletas = filteredSales.filter(s => s.status !== 'ANULADA' && s.dteType && s.dteType.toUpperCase().includes('BOLETA'));
    const facturas = filteredSales.filter(s => s.status !== 'ANULADA' && s.dteType && s.dteType.toUpperCase().includes('FACTURA'));
    const internas = filteredSales.filter(s => s.status !== 'ANULADA' && (!s.dteType || (!s.dteType.toUpperCase().includes('BOLETA') && !s.dteType.toUpperCase().includes('FACTURA'))));

    return {
      boletas: {
        count: boletas.length,
        total: boletas.reduce((acc, s) => acc + (s.total || 0), 0),
        neto: boletas.reduce((acc, s) => acc + (s.subtotalNeto || 0), 0),
        iva: boletas.reduce((acc, s) => acc + (s.iva || 0), 0)
      },
      facturas: {
        count: facturas.length,
        total: facturas.reduce((acc, s) => acc + (s.total || 0), 0),
        neto: facturas.reduce((acc, s) => acc + (s.subtotalNeto || 0), 0),
        iva: facturas.reduce((acc, s) => acc + (s.iva || 0), 0)
      },
      internas: {
        count: internas.length,
        total: internas.reduce((acc, s) => acc + (s.total || 0), 0),
        neto: internas.reduce((acc, s) => acc + (s.subtotalNeto || 0), 0),
        iva: internas.reduce((acc, s) => acc + (s.iva || 0), 0)
      }
    };
  }, [filteredSales]);

  // Desglose por método de pago
  const paymentBreakdown = useMemo(() => {
    const stats: { [key: string]: { name: string; icon: any; count: number; total: number; color: string } } = {
      'EFECTIVO': { name: 'Efectivo', icon: Banknote, count: 0, total: 0, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200' },
      'DEBITO': { name: 'Tarjeta Débito (Redcompra)', icon: CreditCard, count: 0, total: 0, color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/40 border-blue-200' },
      'CREDITO': { name: 'Tarjeta Crédito', icon: CreditCard, count: 0, total: 0, color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200' },
      'TRANSFERENCIA': { name: 'Transferencia Bancaria', icon: ArrowUpRight, count: 0, total: 0, color: 'text-purple-600 bg-purple-50 dark:bg-purple-950/40 border-purple-200' },
      'OTRO': { name: 'Otros Medios', icon: DollarSign, count: 0, total: 0, color: 'text-slate-600 bg-slate-50 dark:bg-slate-900 border-slate-200' }
    };

    activeSales.forEach(s => {
      const m = s.paymentMethod || 'OTRO';
      if (stats[m]) {
        stats[m].count += 1;
        stats[m].total += (s.total || 0);
      } else {
        stats['OTRO'].count += 1;
        stats['OTRO'].total += (s.total || 0);
      }
    });

    return Object.values(stats);
  }, [activeSales]);

  // Evolución Diaria y Top Semanal
  const dailyStats = useMemo(() => {
    const map: { [dateStr: string]: { dateStr: string; dayName: string; count: number; total: number } } = {};
    const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

    activeSales.forEach(s => {
      try {
        const d = new Date(s.createdAt);
        const dateKey = d.toISOString().split('T')[0];
        const dayName = dayNames[d.getDay()] || 'N/A';
        if (!map[dateKey]) {
          map[dateKey] = { dateStr: dateKey, dayName, count: 0, total: 0 };
        }
        map[dateKey].count += 1;
        map[dateKey].total += (s.total || 0);
      } catch {
        // Ignorar
      }
    });

    const list = Object.values(map).sort((a, b) => a.dateStr.localeCompare(b.dateStr));
    let maxTotal = 0;
    list.forEach(d => {
      if (d.total > maxTotal) maxTotal = d.total;
    });

    return { list, maxTotal };
  }, [activeSales]);

  // Top Productos Más Vendidos
  const topProducts = useMemo(() => {
    const map: { [key: string]: { code: string; name: string; category: string; quantity: number; total: number } } = {};

    activeSales.forEach(s => {
      if (s.items && Array.isArray(s.items)) {
        s.items.forEach(item => {
          const key = item.productId ? String(item.productId) : item.productName;
          if (!map[key]) {
            map[key] = {
              code: item.productCode || 'S/C',
              name: item.productName || 'Sin Nombre',
              category: (item as any).category || 'General',
              quantity: 0,
              total: 0
            };
          }
          map[key].quantity += (item.quantity || 0);
          map[key].total += (item.subtotal || 0);
        });
      }
    });

    const list = Object.values(map).sort((a, b) => b.quantity - a.quantity);
    let maxQty = 0;
    list.forEach(p => {
      if (p.quantity > maxQty) maxQty = p.quantity;
    });

    return { list: list.slice(0, 10), maxQty };
  }, [activeSales]);

  // Descargar PDF Cuadrado y Prolijo
  const handleDownloadPDF = () => {
    const doc = generateSalesReportPDF({
      sales: filteredSales,
      company,
      periodLabel
    });

    const filename = `informe_ventas_${dateFilter}_${new Date().toISOString().slice(0, 10)}.pdf`;
    onOpenPdf(doc, filename, 'Informe Ejecutivo de Ventas');
  };

  // Exportar Excel
  const handleExportExcel = () => {
    exportSalesLedgerExcel(filteredSales, company?.name || 'Market Almacén');
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">

      {/* Barra de Control de Informes */}
      <div className={`p-4 rounded-2xl border ${themeClasses.card} shadow-xs flex flex-wrap items-center justify-between gap-3`}>
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 flex items-center justify-center font-black">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <span>Menú de Informes y Estadísticas de Ventas</span>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                {periodLabel}
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Auditoría financiera, productos más demandados y evolución temporal
            </p>
          </div>
        </div>

        {/* Filtros de Tiempo y Botón Descarga */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className={`flex items-center p-0.5 rounded-xl border ${themeClasses.cardSubtle}`}>
            {[
              { id: 'today', label: 'Hoy' },
              { id: '7days', label: 'Esta Semana' },
              { id: 'month', label: 'Mes' },
              { id: 'all', label: 'Todo' },
              { id: 'custom', label: 'Personalizado' }
            ].map(f => (
              <button
                key={f.id}
                type="button"
                onClick={() => setDateFilter(f.id as any)}
                className={`px-3 py-1.5 text-xs font-black rounded-lg transition cursor-pointer ${
                  dateFilter === f.id
                    ? `${themeClasses.accentBg} text-white shadow-xs`
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {dateFilter === 'custom' && (
            <div className="flex items-center gap-1.5 text-xs">
              <input
                type="date"
                value={customStart}
                onChange={e => setCustomStart(e.target.value)}
                className={`px-2 py-1 rounded-lg border ${themeClasses.inputBorder} ${themeClasses.inputBg} font-mono`}
              />
              <span className="text-slate-400">a</span>
              <input
                type="date"
                value={customEnd}
                onChange={e => setCustomEnd(e.target.value)}
                className={`px-2 py-1 rounded-lg border ${themeClasses.inputBorder} ${themeClasses.inputBg} font-mono`}
              />
            </div>
          )}

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleExportExcel}
              className={`px-3 py-1.5 rounded-xl border ${themeClasses.border} text-xs font-black flex items-center gap-1.5 cursor-pointer hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 dark:hover:bg-emerald-950/40 transition`}
              title="Exportar a Libro Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Excel</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadPDF}
              className="px-4 py-1.5 rounded-xl text-xs font-black bg-blue-600 hover:bg-blue-700 active:scale-95 text-white shadow-md flex items-center gap-1.5 cursor-pointer transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Descargar PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* Fila de Tarjetas Resumen (KPIs) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className={`p-4 rounded-2xl border ${themeClasses.card} shadow-xs space-y-1`}>
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold">Total Recaudado (Bruto)</span>
            <div className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-600">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
            ${totalRevenue.toLocaleString('es-CL')}
          </p>
          <p className="text-[11px] text-slate-500">
            {totalSalesCount} transacciones completadas
          </p>
        </div>

        <div className={`p-4 rounded-2xl border ${themeClasses.card} shadow-xs space-y-1`}>
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold">Venta Neta (Sin IVA)</span>
            <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-600">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black font-mono text-blue-600 dark:text-blue-400">
            ${totalNeto.toLocaleString('es-CL')}
          </p>
          <p className="text-[11px] text-slate-500">
            Subtotal base imponible
          </p>
        </div>

        <div className={`p-4 rounded-2xl border ${themeClasses.card} shadow-xs space-y-1`}>
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold">IVA 19% Recaudado</span>
            <div className="p-1.5 rounded-lg bg-purple-100 dark:bg-purple-950 text-purple-600">
              <Building className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black font-mono text-purple-600 dark:text-purple-400">
            ${totalIva.toLocaleString('es-CL')}
          </p>
          <p className="text-[11px] text-slate-500">
            Débito fiscal para declaración mensual
          </p>
        </div>

        <div className={`p-4 rounded-2xl border ${themeClasses.card} shadow-xs space-y-1`}>
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold">Ticket Promedio</span>
            <div className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-950 text-amber-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black font-mono text-amber-600 dark:text-amber-400">
            ${avgTicket.toLocaleString('es-CL')}
          </p>
          <p className="text-[11px] text-slate-500">
            Gasto promedio por cliente
          </p>
        </div>
      </div>

      {/* Desglose por Tipo de Comprobante / DTE Emitidos */}
      <div className={`p-4 rounded-2xl border ${themeClasses.card} shadow-xs space-y-3`}>
        <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h3 className="text-xs font-black uppercase text-slate-800 dark:text-slate-200 tracking-wider">
              Desglose Tributario de Comprobantes Emitidos
            </h3>
          </div>
          <span className="text-[11px] font-bold text-slate-400">
            {totalSalesCount} documentos en el período
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Boletas */}
          <div className={`p-3.5 rounded-xl border ${themeClasses.border} ${themeClasses.cardSubtle} space-y-1.5`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                <Receipt className="w-4 h-4" />
                <span>Boletas Emitidas (39)</span>
              </span>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                {dteBreakdown.boletas.count} cant.
              </span>
            </div>
            <p className="text-lg font-black font-mono text-slate-900 dark:text-white">
              ${dteBreakdown.boletas.total.toLocaleString('es-CL')}
            </p>
            <div className="text-[10px] text-slate-500 font-bold flex justify-between">
              <span>Neto: ${dteBreakdown.boletas.neto.toLocaleString('es-CL')}</span>
              <span>IVA (19%): ${dteBreakdown.boletas.iva.toLocaleString('es-CL')}</span>
            </div>
          </div>

          {/* Facturas */}
          <div className={`p-3.5 rounded-xl border ${themeClasses.border} ${themeClasses.cardSubtle} space-y-1.5`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                <Building className="w-4 h-4" />
                <span>Facturas Emitidas (33)</span>
              </span>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200">
                {dteBreakdown.facturas.count} cant.
              </span>
            </div>
            <p className="text-lg font-black font-mono text-slate-900 dark:text-white">
              ${dteBreakdown.facturas.total.toLocaleString('es-CL')}
            </p>
            <div className="text-[10px] text-slate-500 font-bold flex justify-between">
              <span>Neto: ${dteBreakdown.facturas.neto.toLocaleString('es-CL')}</span>
              <span>IVA (19%): ${dteBreakdown.facturas.iva.toLocaleString('es-CL')}</span>
            </div>
          </div>

          {/* Comprobantes Internos */}
          <div className={`p-3.5 rounded-xl border ${themeClasses.border} ${themeClasses.cardSubtle} space-y-1.5`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                <Tag className="w-4 h-4" />
                <span>Comprobantes Internos</span>
              </span>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200">
                {dteBreakdown.internas.count} cant.
              </span>
            </div>
            <p className="text-lg font-black font-mono text-slate-900 dark:text-white">
              ${dteBreakdown.internas.total.toLocaleString('es-CL')}
            </p>
            <div className="text-[10px] text-slate-500 font-bold flex justify-between">
              <span>Neto: ${dteBreakdown.internas.neto.toLocaleString('es-CL')}</span>
              <span>IVA (19%): ${dteBreakdown.internas.iva.toLocaleString('es-CL')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Grilla Central: Desglose por Medio de Pago + Evolución Semanal */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

        {/* Medios de Pago (5 columnas) */}
        <div className={`lg:col-span-5 p-4 rounded-2xl border ${themeClasses.card} shadow-xs space-y-4`}>
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5">
            <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-blue-600" />
              <span>Desglose por Medio de Pago</span>
            </h3>
            <span className="text-[11px] font-mono font-bold text-slate-400">
              {totalSalesCount} operaciones
            </span>
          </div>

          <div className="space-y-3">
            {paymentBreakdown.map(p => {
              const Icon = p.icon;
              const pct = totalRevenue > 0 ? Math.round((p.total / totalRevenue) * 100) : 0;

              return (
                <div key={p.name} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <div className="flex items-center gap-2">
                      <div className={`p-1 rounded-md border ${p.color}`}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-slate-700 dark:text-slate-200">{p.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-mono text-slate-900 dark:text-white">${p.total.toLocaleString('es-CL')}</span>
                      <span className="text-[11px] text-slate-400 ml-1.5 font-normal">({pct}%)</span>
                    </div>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-blue-600 transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {canceledSales.length > 0 && (
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-rose-600 dark:text-rose-400 font-bold">
              <span>Ventas Anuladas en Período:</span>
              <span className="font-mono">{canceledSales.length} comprobantes</span>
            </div>
          )}
        </div>

        {/* Top de Ventas Semanal / Distribución Temporal (7 columnas) */}
        <div className={`lg:col-span-7 p-4 rounded-2xl border ${themeClasses.card} shadow-xs space-y-4`}>
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5">
            <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-indigo-600" />
              <span>Top de Ventas Semanal y Evolución Diaria</span>
            </h3>
            <span className="text-[11px] font-bold text-slate-400">
              Distribución de ingresos
            </span>
          </div>

          {dailyStats.list.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs font-bold">
              No hay ventas registradas en el período seleccionado.
            </div>
          ) : (
            <div className="space-y-2.5">
              {dailyStats.list.map(d => {
                const pct = dailyStats.maxTotal > 0 ? Math.round((d.total / dailyStats.maxTotal) * 100) : 0;
                const isPeak = d.total === dailyStats.maxTotal && dailyStats.maxTotal > 0;

                return (
                  <div
                    key={d.dateStr}
                    className={`p-2.5 rounded-xl border transition flex items-center gap-3 ${
                      isPeak
                        ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20'
                        : `${themeClasses.cardSubtle} border-slate-200 dark:border-slate-800`
                    }`}
                  >
                    <div className="w-24 shrink-0">
                      <p className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1">
                        {isPeak && <Sparkles className="w-3 h-3 text-amber-500 shrink-0" />}
                        <span>{d.dayName}</span>
                      </p>
                      <p className="text-[10px] font-mono text-slate-400">{d.dateStr}</p>
                    </div>

                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between text-[11px] font-bold">
                        <span className="text-slate-500">{d.count} {d.count === 1 ? 'venta' : 'ventas'}</span>
                        <span className="font-mono text-slate-900 dark:text-white font-black">
                          ${d.total.toLocaleString('es-CL')}
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isPeak ? 'bg-emerald-500' : 'bg-indigo-500'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>

                    {isPeak && (
                      <span className="shrink-0 text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300">
                        ★ Día Pico
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {/* Top 10 Productos Más Vendidos */}
      <div className={`p-4 rounded-2xl border ${themeClasses.card} shadow-xs space-y-4`}>
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5">
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-500" />
            <h3 className="text-xs font-black text-slate-800 dark:text-slate-100">
              Top 10 Productos Más Vendidos (Ranking de Demanda)
            </h3>
          </div>
          <span className="text-[11px] font-bold text-slate-400">
            Ordenado por volumen de unidades y kilos
          </span>
        </div>

        {topProducts.list.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-xs font-bold">
            No se registran productos vendidos en este período.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className={`border-b ${themeClasses.border} ${themeClasses.cardSubtle} font-black text-slate-700 dark:text-slate-300`}>
                  <th className="py-2.5 px-3 text-center w-12">#</th>
                  <th className="py-2.5 px-3">Código / SKU</th>
                  <th className="py-2.5 px-3">Descripción del Producto</th>
                  <th className="py-2.5 px-3">Familia</th>
                  <th className="py-2.5 px-3 text-center">Cantidad / Peso</th>
                  <th className="py-2.5 px-3 text-right">Total CLP</th>
                  <th className="py-2.5 px-3 text-center">% Ventas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {topProducts.list.map((p, idx) => {
                  const pct = totalRevenue > 0 ? Math.round((p.total / totalRevenue) * 100) : 0;

                  return (
                    <tr key={p.code + idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                      <td className="py-2.5 px-3 text-center">
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
                      <td className="py-2.5 px-3 font-black text-slate-800 dark:text-slate-200">
                        {p.name}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-bold">
                          {p.category}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center font-black font-mono text-blue-600 dark:text-blue-400">
                        {p.quantity % 1 !== 0 ? `${p.quantity.toFixed(3)} Kg` : `${p.quantity} Un`}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-black text-emerald-600 dark:text-emerald-400">
                        ${p.total.toLocaleString('es-CL')}
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

    </div>
  );
};
