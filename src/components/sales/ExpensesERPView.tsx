import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../db/database';
import { useTheme } from '../../utils/themeContext';
import { useAuth } from '../../utils/authContext';
import { formatCLP } from '../../utils/salesPdfGenerator';
import type { Expense, ExpenseCategory, Company } from '../../types';
import {
  TrendingDown,
  DollarSign,
  Plus,
  Calendar,
  CreditCard,
  Banknote,
  Building,
  Trash2,
  FileSpreadsheet,
  ArrowUpRight,
  TrendingUp,
  Percent,
  X,
  CheckCircle2,
  Receipt,
  Search,
  PieChart
} from 'lucide-react';

interface ExpensesERPViewProps {
  totalSalesRevenue: number;
  company?: Company | null;
}

const CATEGORY_META: { [key in ExpenseCategory]: { label: string; icon: string; color: string } } = {
  'ARRIENDO': { label: 'Arriendo de Local/Bodega', icon: '🏢', color: 'bg-indigo-500' },
  'SUELDOS': { label: 'Sueldos y Remuneraciones', icon: '👥', color: 'bg-blue-500' },
  'SERVICIOS_BASICOS': { label: 'Servicios Básicos (Luz, Agua, Gas)', icon: '💡', color: 'bg-amber-500' },
  'PROVEEDORES': { label: 'Mercadería y Proveedores', icon: '📦', color: 'bg-emerald-500' },
  'MANTENIMIENTO': { label: 'Reparaciones y Mantenimiento', icon: '🔧', color: 'bg-orange-500' },
  'LOGISTICA': { label: 'Fletes, Transporte y Bencina', icon: '🚚', color: 'bg-purple-500' },
  'MARKETING': { label: 'Publicidad y Marketing', icon: '📢', color: 'bg-pink-500' },
  'IMPUESTOS': { label: 'Impuestos, PPM y Patentes', icon: '⚖️', color: 'bg-red-500' },
  'OTROS': { label: 'Gastos Varios de Caja Chica', icon: '📝', color: 'bg-slate-500' }
};

export const ExpensesERPView: React.FC<ExpensesERPViewProps> = ({
  totalSalesRevenue,
  company
}) => {
  const { themeClasses } = useTheme();
  const { currentUser, isSuperAdmin, isAdmin } = useAuth();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [dateFilter, setDateFilter] = useState<'today' | '7days' | 'month' | 'all' | 'custom'>('month');
  const [customStart, setCustomStart] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [customEnd, setCustomEnd] = useState(() => new Date().toISOString().split('T')[0]);
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Modal para agregar gasto
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formDate, setFormDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [formCategory, setFormCategory] = useState<ExpenseCategory>('OTROS');
  const [formDesc, setFormDesc] = useState('');
  const [formAmount, setFormAmount] = useState<number | string>('');
  const [formPaymentMethod, setFormPaymentMethod] = useState<'EFECTIVO' | 'DEBITO' | 'CREDITO' | 'TRANSFERENCIA'>('EFECTIVO');
  const [formVoucher, setFormVoucher] = useState('');
  const [formSupplier, setFormSupplier] = useState('');

  const loadExpenses = async () => {
    try {
      let all = await db.expenses.toArray();
      if (company && company.id && company.id !== 'ALL') {
        all = all.filter(e => !e.companyId || e.companyId === company.id);
      }
      setExpenses(all);
    } catch (e) {
      console.warn('Error al cargar gastos:', e);
    }
  };

  useEffect(() => {
    loadExpenses();
  }, [company?.id]);

  // Filtrado de gastos por fecha, categoría y texto
  const filteredExpenses = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    return expenses.filter(e => {
      const expDate = e.date || e.createdAt?.split('T')[0] || todayStr;

      // Filtro de fecha
      if (dateFilter === 'today' && expDate !== todayStr) return false;
      if (dateFilter === '7days') {
        const diffMs = now.getTime() - new Date(expDate).getTime();
        if (diffMs > 7 * 86400000 || diffMs < -86400000) return false;
      }
      if (dateFilter === 'month') {
        const [curYear, curMonth] = todayStr.split('-');
        if (!expDate.startsWith(`${curYear}-${curMonth}`)) return false;
      }
      if (dateFilter === 'custom') {
        if (expDate < customStart || expDate > customEnd) return false;
      }

      // Filtro de categoría
      if (categoryFilter !== 'ALL' && e.category !== categoryFilter) return false;

      // Búsqueda por texto
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesDesc = (e.description || '').toLowerCase().includes(q);
        const matchesSupp = (e.supplierName || '').toLowerCase().includes(q);
        const matchesVouch = (e.voucherNumber || '').toLowerCase().includes(q);
        if (!matchesDesc && !matchesSupp && !matchesVouch) return false;
      }

      return true;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [expenses, dateFilter, customStart, customEnd, categoryFilter, searchTerm]);

  // Métricas financieras ERP
  const totalExpensesAmount = useMemo(() => {
    return filteredExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  }, [filteredExpenses]);

  const netOperationalMargin = totalSalesRevenue - totalExpensesAmount;
  const expenseToSalesRatio = totalSalesRevenue > 0
    ? ((totalExpensesAmount / totalSalesRevenue) * 100).toFixed(1)
    : '0';

  // Desglose por categoría
  const categoryBreakdown = useMemo(() => {
    const map: { [key: string]: { category: ExpenseCategory; label: string; icon: string; count: number; total: number; color: string } } = {};

    Object.keys(CATEGORY_META).forEach(catKey => {
      const c = catKey as ExpenseCategory;
      map[c] = {
        category: c,
        label: CATEGORY_META[c].label,
        icon: CATEGORY_META[c].icon,
        count: 0,
        total: 0,
        color: CATEGORY_META[c].color
      };
    });

    filteredExpenses.forEach(e => {
      if (map[e.category]) {
        map[e.category].count += 1;
        map[e.category].total += (Number(e.amount) || 0);
      } else {
        map['OTROS'].count += 1;
        map['OTROS'].total += (Number(e.amount) || 0);
      }
    });

    return Object.values(map)
      .filter(item => item.total > 0 || item.count > 0)
      .sort((a, b) => b.total - a.total);
  }, [filteredExpenses]);

  // Manejo de Registro de Gasto
  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(formAmount);
    if (!amt || amt <= 0) {
      alert('Por favor ingrese un monto válido de gasto.');
      return;
    }
    if (!formDesc.trim()) {
      alert('Por favor ingrese una descripción del gasto.');
      return;
    }

    try {
      const newExp: Expense = {
        date: formDate,
        category: formCategory,
        categoryLabel: CATEGORY_META[formCategory]?.label || formCategory,
        description: formDesc.trim(),
        amount: amt,
        paymentMethod: formPaymentMethod,
        voucherNumber: formVoucher.trim() || undefined,
        supplierName: formSupplier.trim() || undefined,
        companyId: company?.id || 'ALL',
        companyName: company?.name || 'General',
        registeredBy: currentUser?.name || currentUser?.username || 'Admin',
        createdAt: new Date().toISOString()
      };

      await db.expenses.add(newExp);
      await loadExpenses();

      // Limpiar formulario y cerrar
      setFormDesc('');
      setFormAmount('');
      setFormVoucher('');
      setFormSupplier('');
      setIsModalOpen(false);
    } catch (err: any) {
      alert('Error al guardar el gasto: ' + err.message);
    }
  };

  const handleDeleteExpense = async (id?: number) => {
    if (!id) return;
    if (window.confirm('¿Está seguro de eliminar este registro de gasto?')) {
      await db.expenses.delete(id);
      await loadExpenses();
    }
  };

  // Exportar listado de gastos a CSV
  const handleExportCSV = () => {
    if (filteredExpenses.length === 0) {
      alert('No hay gastos para exportar.');
      return;
    }
    const headers = ['Fecha', 'Categoría', 'Descripción', 'Proveedor / Beneficiario', 'Medio de Pago', 'Comprobante', 'Monto (CLP)'];
    const rows = filteredExpenses.map(e => [
      e.date,
      `"${e.categoryLabel || e.category}"`,
      `"${e.description.replace(/"/g, '""')}"`,
      `"${(e.supplierName || '').replace(/"/g, '""')}"`,
      e.paymentMethod,
      `"${e.voucherNumber || ''}"`,
      e.amount
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gastos_${company?.name || 'empresa'}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Barra Superior con Botón de Registro y Exportación */}
      <div className={`p-4 rounded-2xl border ${themeClasses.card} shadow-xs flex flex-wrap items-center justify-between gap-3`}>
        <div>
          <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
            <span className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600">
              <TrendingDown className="w-5 h-5" />
            </span>
            <span>Módulo ERP: Gestión y Control de Gastos</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Registro contable de egresos, costos operacionales y márgenes netos de utilidad
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-black flex items-center gap-1.5 transition cursor-pointer text-slate-700 dark:text-slate-300"
            title="Exportar planilla de gastos a Excel"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Exportar Excel</span>
          </button>

          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black flex items-center gap-1.5 shadow-md transition cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Registrar Nuevo Gasto</span>
          </button>
        </div>
      </div>

      {/* Tarjetas de KPIs Financieros ERP */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* 1. Total Gastos */}
        <div className={`p-3.5 sm:p-4 rounded-2xl border ${themeClasses.card} shadow-xs`}>
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>Total Gastos</span>
            <span className="p-1.5 rounded-lg bg-red-100 dark:bg-red-950 text-red-600">
              <TrendingDown className="w-4 h-4" />
            </span>
          </div>
          <p className="text-xl sm:text-2xl font-black font-mono text-red-600 dark:text-red-400 mt-1">
            {formatCLP(totalExpensesAmount)}
          </p>
          <p className="text-[10px] text-slate-400 font-bold mt-1">
            {filteredExpenses.length} egresos registrados
          </p>
        </div>

        {/* 2. Total Ingresos Ventas */}
        <div className={`p-3.5 sm:p-4 rounded-2xl border ${themeClasses.card} shadow-xs`}>
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>Ingresos por Ventas</span>
            <span className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-600">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <p className="text-xl sm:text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400 mt-1">
            {formatCLP(totalSalesRevenue)}
          </p>
          <p className="text-[10px] text-slate-400 font-bold mt-1">
            Monto bruto recaudado
          </p>
        </div>

        {/* 3. Margen Operativo Neto */}
        <div className={`p-3.5 sm:p-4 rounded-2xl border ${themeClasses.card} shadow-xs`}>
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>Margen Operativo Neto</span>
            <span className={`p-1.5 rounded-lg ${netOperationalMargin >= 0 ? 'bg-blue-100 dark:bg-blue-950 text-blue-600' : 'bg-red-100 dark:bg-red-950 text-red-600'}`}>
              <DollarSign className="w-4 h-4" />
            </span>
          </div>
          <p className={`text-xl sm:text-2xl font-black font-mono mt-1 ${netOperationalMargin >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-500'}`}>
            {formatCLP(netOperationalMargin)}
          </p>
          <p className="text-[10px] text-slate-400 font-bold mt-1">
            Ventas menos Gastos operacionales
          </p>
        </div>

        {/* 4. Ratio Gastos / Ventas */}
        <div className={`p-3.5 sm:p-4 rounded-2xl border ${themeClasses.card} shadow-xs`}>
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>Ratio Gastos / Ventas</span>
            <span className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-950 text-amber-600">
              <Percent className="w-4 h-4" />
            </span>
          </div>
          <p className="text-xl sm:text-2xl font-black font-mono text-amber-600 dark:text-amber-400 mt-1">
            {expenseToSalesRatio}%
          </p>
          <p className="text-[10px] text-slate-400 font-bold mt-1">
            Porcentaje de ingresos destinado a costos
          </p>
        </div>
      </div>

      {/* Filtros de Fecha y Búsqueda */}
      <div className={`p-3.5 rounded-2xl border ${themeClasses.card} shadow-xs flex flex-wrap items-center justify-between gap-2.5`}>
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className={`flex items-center p-0.5 rounded-xl border ${themeClasses.cardSubtle}`}>
            {[
              { id: 'today', label: 'Hoy' },
              { id: '7days', label: '7 Días' },
              { id: 'month', label: 'Mes' },
              { id: 'all', label: 'Todo' },
              { id: 'custom', label: 'Rango' }
            ].map(f => (
              <button
                key={f.id}
                type="button"
                onClick={() => setDateFilter(f.id as any)}
                className={`px-2.5 py-1 text-xs font-black rounded-lg transition cursor-pointer ${
                  dateFilter === f.id
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {dateFilter === 'custom' && (
            <div className="flex items-center gap-1.5 text-xs font-bold">
              <input
                type="date"
                value={customStart}
                onChange={e => setCustomStart(e.target.value)}
                className={`px-2 py-1 rounded-lg border ${themeClasses.inputBorder} ${themeClasses.inputBg} font-mono`}
              />
              <span>hasta</span>
              <input
                type="date"
                value={customEnd}
                onChange={e => setCustomEnd(e.target.value)}
                className={`px-2 py-1 rounded-lg border ${themeClasses.inputBorder} ${themeClasses.inputBg} font-mono`}
              />
            </div>
          )}

          {/* Filtro por Categoría */}
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className={`px-2.5 py-1 rounded-xl text-xs font-black border ${themeClasses.inputBorder} ${themeClasses.inputBg} cursor-pointer`}
          >
            <option value="ALL">Todas las Categorías</option>
            {Object.entries(CATEGORY_META).map(([k, v]) => (
              <option key={k} value={k}>{v.icon} {v.label}</option>
            ))}
          </select>
        </div>

        {/* Buscador de Gastos */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Buscar por descripción o proveedor..."
            className={`w-full pl-8 pr-3 py-1 rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-xs font-bold focus:outline-none`}
          />
        </div>
      </div>

      {/* Desglose Visual por Categorías */}
      {categoryBreakdown.length > 0 && (
        <div className={`p-4 rounded-2xl border ${themeClasses.card} shadow-xs space-y-3`}>
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 tracking-wider flex items-center gap-1.5">
              <PieChart className="w-4 h-4 text-emerald-500" />
              <span>Distribución de Gastos por Categoría</span>
            </h3>
            <span className="text-xs font-bold text-slate-400">
              {categoryBreakdown.length} categorías con movimiento
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {categoryBreakdown.map(cat => {
              const pct = totalExpensesAmount > 0
                ? ((cat.total / totalExpensesAmount) * 100).toFixed(1)
                : '0';

              return (
                <div key={cat.category} className={`p-3 rounded-xl border ${themeClasses.border} bg-slate-50/60 dark:bg-slate-800/40 space-y-1.5`}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-black text-slate-800 dark:text-slate-200 truncate flex items-center gap-1.5">
                      <span>{cat.icon}</span>
                      <span className="truncate">{cat.label}</span>
                    </span>
                    <span className="font-mono font-black text-slate-900 dark:text-white shrink-0">
                      {formatCLP(cat.total)}
                    </span>
                  </div>

                  {/* Barra de Progreso */}
                  <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${cat.color} rounded-full transition-all duration-500`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold">
                    <span>{cat.count} registro(s)</span>
                    <span>{pct}% del total</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tabla de Gastos Registrados */}
      <div className={`rounded-2xl border ${themeClasses.border} ${themeClasses.card} overflow-hidden shadow-xs`}>
        <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <span className="text-xs font-black uppercase text-slate-700 dark:text-slate-300">
            Libro de Egresos y Gastos ({filteredExpenses.length})
          </span>
        </div>

        {filteredExpenses.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs font-bold">
            No hay gastos registrados en este período. Presione "Registrar Nuevo Gasto" para comenzar.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className={`border-b ${themeClasses.border} ${themeClasses.cardSubtle} font-black text-slate-700 dark:text-slate-300 select-none`}>
                <tr>
                  <th className="py-2.5 px-3">FECHA</th>
                  <th className="py-2.5 px-3">CATEGORÍA</th>
                  <th className="py-2.5 px-3">DESCRIPCIÓN</th>
                  <th className="py-2.5 px-3">PROVEEDOR / BENEFICIARIO</th>
                  <th className="py-2.5 px-3">MEDIO DE PAGO</th>
                  <th className="py-2.5 px-3 text-right">MONTO</th>
                  <th className="py-2.5 px-3 text-center">ACCIÓN</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                {filteredExpenses.map(exp => (
                  <tr key={exp.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                    <td className="py-2 px-3 font-mono font-bold whitespace-nowrap text-slate-600 dark:text-slate-400">
                      {exp.date}
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-black bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                        <span>{CATEGORY_META[exp.category]?.icon || '📝'}</span>
                        <span>{CATEGORY_META[exp.category]?.label || exp.category}</span>
                      </span>
                    </td>
                    <td className="py-2 px-3 font-bold text-slate-900 dark:text-slate-100 max-w-xs truncate">
                      {exp.description}
                    </td>
                    <td className="py-2 px-3 text-slate-600 dark:text-slate-400 truncate">
                      {exp.supplierName || '—'}
                      {exp.voucherNumber && (
                        <span className="block text-[10px] text-slate-400 font-mono">N° {exp.voucherNumber}</span>
                      )}
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap font-bold text-[11px] text-slate-600 dark:text-slate-300">
                      {exp.paymentMethod}
                    </td>
                    <td className="py-2 px-3 text-right font-black font-mono text-red-600 dark:text-red-400 text-sm whitespace-nowrap">
                      -{formatCLP(exp.amount)}
                    </td>
                    <td className="py-2 px-3 text-center whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleDeleteExpense(exp.id)}
                        className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition cursor-pointer"
                        title="Eliminar este gasto"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal para Registrar Nuevo Gasto */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl border-2 border-emerald-500 shadow-2xl overflow-hidden animate-scaleIn">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
              <div className="flex items-center gap-2">
                <TrendingDown className="w-5 h-5" />
                <h3 className="text-sm font-black">Registrar Nuevo Gasto Operativo</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg hover:bg-white/20 text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveExpense} className="p-4 sm:p-5 space-y-3">
              {/* Fecha y Categoría */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1">
                    Fecha del Gasto *
                  </label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={e => setFormDate(e.target.value)}
                    className={`w-full px-3 py-1.5 rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-xs font-bold`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1">
                    Categoría *
                  </label>
                  <select
                    value={formCategory}
                    onChange={e => setFormCategory(e.target.value as ExpenseCategory)}
                    className={`w-full px-3 py-1.5 rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-xs font-black cursor-pointer`}
                  >
                    {Object.entries(CATEGORY_META).map(([k, v]) => (
                      <option key={k} value={k}>{v.icon} {v.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Descripción */}
              <div>
                <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1">
                  Descripción del Gasto *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Pago de luz local central mes de Agosto..."
                  value={formDesc}
                  onChange={e => setFormDesc(e.target.value)}
                  className={`w-full px-3 py-1.5 rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-xs font-bold`}
                />
              </div>

              {/* Monto y Medio de Pago */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1">
                    Monto en Pesos ($) *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="Ej: 45000"
                    value={formAmount}
                    onChange={e => setFormAmount(e.target.value)}
                    className={`w-full px-3 py-1.5 rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-xs font-black font-mono text-emerald-600 dark:text-emerald-400`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1">
                    Medio de Pago *
                  </label>
                  <select
                    value={formPaymentMethod}
                    onChange={e => setFormPaymentMethod(e.target.value as any)}
                    className={`w-full px-3 py-1.5 rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-xs font-black cursor-pointer`}
                  >
                    <option value="EFECTIVO">💵 Efectivo</option>
                    <option value="DEBITO">💳 Débito</option>
                    <option value="CREDITO">💳 Crédito</option>
                    <option value="TRANSFERENCIA">🏦 Transferencia</option>
                  </select>
                </div>
              </div>

              {/* Proveedor y N° Comprobante */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1">
                    Proveedor / Beneficiario
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Enel / Aguas Andinas..."
                    value={formSupplier}
                    onChange={e => setFormSupplier(e.target.value)}
                    className={`w-full px-3 py-1.5 rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-xs font-bold`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1">
                    N° Boleta / Factura / Voucher
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: FAC-84920"
                    value={formVoucher}
                    onChange={e => setFormVoucher(e.target.value)}
                    className={`w-full px-3 py-1.5 rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-xs font-bold`}
                  />
                </div>
              </div>

              {/* Botones de Acción */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black shadow-md transition cursor-pointer active:scale-95"
                >
                  Guardar Gasto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
