import React, { useState, useEffect } from 'react';
import type { PurchaseRequest, PriorityLevel, PurchaseStatus } from '../../types';
import { useTheme } from '../../utils/themeContext';
import { useCompany } from '../../utils/companyContext';
import { useAuth } from '../../utils/authContext';
import { db } from '../../db/database';
import { triggerCloudSync, notifyLocalMutation } from '../../utils/cloudSync';
import {
  ClipboardList,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  Trash2,
  FileText,
  DollarSign,
  Package,
  Calendar,
  User,
  X
} from 'lucide-react';

interface PurchasesViewProps {
  refreshTrigger?: number;
}

export const PurchasesView: React.FC<PurchasesViewProps> = ({ refreshTrigger }) => {
  const { themeClasses } = useTheme();
  const { selectedCompanyId, selectedCompany } = useCompany();
  const { currentUser, isReadOnly } = useAuth();

  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form states for new purchase request
  const [requesterName, setRequesterName] = useState(currentUser?.name || '');
  const [priority, setPriority] = useState<PriorityLevel>('MEDIA');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<{ name: string; quantity: number; estimatedPrice: number; unit: string }[]>([
    { name: '', quantity: 1, estimatedPrice: 0, unit: 'Unidades' }
  ]);

  const loadRequests = async () => {
    let list = await db.purchaseRequests.reverse().toArray();
    if (selectedCompanyId && selectedCompanyId !== 'ALL') {
      list = list.filter(r => r.companyId === selectedCompanyId);
    }
    setRequests(list);
  };

  useEffect(() => {
    loadRequests();
  }, [selectedCompanyId, refreshTrigger]);

  const handleAddItem = () => {
    setItems([...items, { name: '', quantity: 1, estimatedPrice: 0, unit: 'Unidades' }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const next = [...items];
    (next[index] as any)[field] = value;
    setItems(next);
  };

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    const validItems = items.filter(it => it.name.trim().length > 0);
    if (validItems.length === 0) {
      alert('Debe ingresar al menos un producto a solicitar.');
      return;
    }

    const totalEst = validItems.reduce((acc, it) => acc + (it.quantity * it.estimatedPrice), 0);
    const now = new Date().toISOString();

    const newReq: PurchaseRequest = {
      date: now.split('T')[0],
      requesterName: requesterName.trim() || 'Encargado de Compras',
      priority,
      status: 'PENDIENTE',
      companyId: selectedCompanyId === 'ALL' ? 'market-almacen' : selectedCompanyId,
      notes: notes.trim(),
      totalEstimatedCost: totalEst,
      items: validItems.map(it => ({
        name: it.name.trim(),
        productName: it.name.trim(),
        quantity: Number(it.quantity) || 1,
        estimatedUnitPrice: Number(it.estimatedPrice) || 0,
        estimatedCost: (Number(it.quantity) || 1) * (Number(it.estimatedPrice) || 0),
        urgencyReason: '',
        unit: it.unit || 'Unidades'
      })),
      estimatedCost: totalEst,
      createdAt: now
    };

    await db.purchaseRequests.add(newReq);
    setIsModalOpen(false);
    setNotes('');
    setItems([{ name: '', quantity: 1, estimatedPrice: 0, unit: 'Unidades' }]);
    await loadRequests();
    notifyLocalMutation();
  };

  const handleUpdateStatus = async (id: number, newStatus: PurchaseStatus) => {
    await db.purchaseRequests.update(id, { status: newStatus });
    await loadRequests();
    notifyLocalMutation();
  };

  const handleDeleteRequest = async (id: number) => {
    if (confirm('¿Eliminar esta solicitud de compra?')) {
      await db.purchaseRequests.delete(id);
      await loadRequests();
      notifyLocalMutation();
    }
  };

  const filtered = requests.filter(r => {
    if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
    if (priorityFilter !== 'ALL' && r.priority !== priorityFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchReq = r.requesterName.toLowerCase().includes(q);
      const matchItems = r.items.some(it => (it.productName || it.name).toLowerCase().includes(q));
      if (!matchReq && !matchItems) return false;
    }
    return true;
  });

  const getPriorityBadge = (p: PriorityLevel) => {
    switch (p) {
      case 'URGENTE':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-red-500/20 text-red-400 border border-red-500/40">🔴 URGENTE</span>;
      case 'ALTA':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-400 border border-amber-500/40">🟡 ALTA</span>;
      case 'MEDIA':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/40">🔵 MEDIA</span>;
      case 'BAJA':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-500/20 text-slate-400 border border-slate-500/40">⚪ BAJA</span>;
    }
  };

  const getStatusBadge = (s: PurchaseStatus) => {
    switch (s) {
      case 'PENDIENTE':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-400 border border-amber-500/40">⏳ PENDIENTE</span>;
      case 'COTIZADO':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-blue-500/20 text-blue-400 border border-blue-500/40">📑 COTIZADO</span>;
      case 'APROBADO':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">✅ APROBADO</span>;
      case 'COMPRADO':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-purple-500/20 text-purple-400 border border-purple-500/40">📦 COMPRADO</span>;
      case 'RECHAZADO':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-red-500/20 text-red-400 border border-red-500/40">❌ RECHAZADO</span>;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-2.5 sm:px-6 py-4 space-y-4 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <span>Solicitudes de Compra y Abastecimiento</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Gestione las órdenes y pedidos de reposición de mercadería e insumos
          </p>
        </div>

        {!isReadOnly && (
          <button
            onClick={() => setIsModalOpen(true)}
            className={`px-4 py-2 text-xs sm:text-sm font-black rounded-xl ${themeClasses.accentBg} ${themeClasses.accentHover} shadow-md flex items-center gap-2 text-white`}
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Solicitud</span>
          </button>
        )}
      </div>

      {/* Toolbar & Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por solicitante o producto..."
            className={`w-full pl-9 pr-3 py-2 text-xs rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg}`}
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className={`px-3 py-2 text-xs font-bold rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg}`}
        >
          <option value="ALL">Estado: Todos</option>
          <option value="PENDIENTE">⏳ Pendientes</option>
          <option value="COTIZADO">📑 Cotizados</option>
          <option value="APROBADO">✅ Aprobados</option>
          <option value="COMPRADO">📦 Comprados</option>
          <option value="RECHAZADO">❌ Rechazados</option>
        </select>

        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className={`px-3 py-2 text-xs font-bold rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg}`}
        >
          <option value="ALL">Prioridad: Todas</option>
          <option value="URGENTE">🔴 Urgente</option>
          <option value="ALTA">🟡 Alta</option>
          <option value="MEDIA">🔵 Media</option>
          <option value="BAJA">⚪ Baja</option>
        </select>
      </div>

      {/* Requests Table */}
      <div className={`rounded-2xl border ${themeClasses.border} ${themeClasses.card} overflow-hidden shadow-sm`}>
        {filtered.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <ClipboardList className="w-12 h-12 text-slate-400 mx-auto opacity-40" />
            <p className="text-sm font-bold text-slate-500">No hay solicitudes de compra registradas</p>
            {!isReadOnly && (
              <button
                onClick={() => setIsModalOpen(true)}
                className="px-4 py-1.5 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white"
              >
                Crear Primera Solicitud
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold">
                <tr>
                  <th className="py-3 px-3">FECHA</th>
                  <th className="py-3 px-3">SOLICITANTE</th>
                  <th className="py-3 px-3">PRIORIDAD</th>
                  <th className="py-3 px-3">PRODUCTOS / ÍTEMS</th>
                  <th className="py-3 px-3 text-right">TOTAL ESTIMADO</th>
                  <th className="py-3 px-3 text-center">ESTADO</th>
                  <th className="py-3 px-3 text-right">ACCIONES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-3 font-mono font-medium text-slate-600 dark:text-slate-300">
                      {r.date}
                    </td>
                    <td className="py-3 px-3 font-bold text-slate-900 dark:text-slate-100">
                      {r.requesterName}
                    </td>
                    <td className="py-3 px-3">{getPriorityBadge(r.priority)}</td>
                    <td className="py-3 px-3">
                      <div className="space-y-0.5">
                        {r.items.map((it, idx) => (
                          <div key={idx} className="text-[11px] font-medium text-slate-800 dark:text-slate-200">
                            • <strong>{it.quantity} {it.unit}</strong> {(it.productName || it.name)}
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-black text-slate-900 dark:text-slate-100">
                      ${(r.totalEstimatedCost || r.estimatedCost || 0).toLocaleString('es-CL')}
                    </td>
                    <td className="py-3 px-3 text-center">{getStatusBadge(r.status)}</td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {!isReadOnly && (
                          <select
                            value={r.status}
                            onChange={(e) => handleUpdateStatus(r.id!, e.target.value as PurchaseStatus)}
                            className="text-[10px] font-bold py-1 px-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                          >
                            <option value="PENDIENTE">Pendiente</option>
                            <option value="COTIZADO">Cotizado</option>
                            <option value="APROBADO">Aprobado</option>
                            <option value="COMPRADO">Comprado</option>
                            <option value="RECHAZADO">Rechazado</option>
                          </select>
                        )}
                        {!isReadOnly && r.id && (
                          <button
                            onClick={() => handleDeleteRequest(r.id!)}
                            className="p-1 text-slate-400 hover:text-red-500 transition"
                            title="Eliminar solicitud"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Nueva Solicitud */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className={`w-full max-w-2xl rounded-2xl border ${themeClasses.border} ${themeClasses.card} p-5 sm:p-6 shadow-2xl flex flex-col max-h-[90vh]`}>
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="font-bold text-base sm:text-lg flex items-center gap-2">
                <Plus className="w-5 h-5 text-blue-600" />
                <span>Nueva Solicitud de Compra</span>
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 rounded-lg text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRequest} className="space-y-4 my-4 overflow-y-auto flex-1 pr-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Solicitante / Encargado *
                  </label>
                  <input
                    type="text"
                    required
                    value={requesterName}
                    onChange={(e) => setRequesterName(e.target.value)}
                    className={`w-full px-3 py-2 text-xs rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg}`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Prioridad *
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as PriorityLevel)}
                    className={`w-full px-3 py-2 text-xs font-bold rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg}`}
                  >
                    <option value="MEDIA">🔵 Media (Normal)</option>
                    <option value="ALTA">🟡 Alta</option>
                    <option value="URGENTE">🔴 Urgente (Quiebre de Stock)</option>
                    <option value="BAJA">⚪ Baja</option>
                  </select>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Productos Solicitados *
                  </label>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="text-[11px] font-bold text-blue-600 hover:text-blue-500 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Agregar Ítem
                  </button>
                </div>

                <div className="space-y-2">
                  {items.map((it, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                      <input
                        type="text"
                        required
                        placeholder="Nombre producto..."
                        value={it.name}
                        onChange={(e) => handleItemChange(idx, 'name', e.target.value)}
                        className={`flex-1 px-2.5 py-1.5 text-xs rounded-lg border ${themeClasses.inputBorder} ${themeClasses.inputBg}`}
                      />
                      <input
                        type="number"
                        min="1"
                        placeholder="Cant."
                        value={it.quantity}
                        onChange={(e) => handleItemChange(idx, 'quantity', Number(e.target.value))}
                        className={`w-16 px-2 py-1.5 text-xs font-bold rounded-lg border ${themeClasses.inputBorder} ${themeClasses.inputBg}`}
                      />
                      <input
                        type="number"
                        min="0"
                        placeholder="Precio Unit."
                        value={it.estimatedPrice || ''}
                        onChange={(e) => handleItemChange(idx, 'estimatedPrice', Number(e.target.value))}
                        className={`w-24 px-2 py-1.5 text-xs font-mono rounded-lg border ${themeClasses.inputBorder} ${themeClasses.inputBg}`}
                      />
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="p-1 text-slate-400 hover:text-red-500"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Observaciones / Justificación
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Detalle o proveedor recomendado..."
                  className={`w-full px-3 py-2 text-xs rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg}`}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-black rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-md"
                >
                  Guardar Solicitud
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
