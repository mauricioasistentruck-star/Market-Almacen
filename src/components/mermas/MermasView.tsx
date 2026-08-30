import React, { useState, useEffect } from 'react';
import type { Incident, Product } from '../../types';
import { useTheme } from '../../utils/themeContext';
import { useCompany } from '../../utils/companyContext';
import { useAuth } from '../../utils/authContext';
import { db } from '../../db/database';
import { notifyLocalMutation } from '../../utils/cloudSync';
import {
  AlertTriangle,
  AlertCircle,
  Plus,
  Trash2,
  Calendar,
  Clock,
  CheckCircle2,
  Boxes,
  ArrowDownRight,
  TrendingDown,
  X,
  Sparkles
} from 'lucide-react';

interface MermasViewProps {
  refreshTrigger?: number;
}

export const MermasView: React.FC<MermasViewProps> = ({ refreshTrigger }) => {
  const { themeClasses } = useTheme();
  const { selectedCompanyId } = useCompany();
  const { currentUser, isReadOnly } = useAuth();

  const [activeSubTab, setActiveSubTab] = useState<'REGISTRO' | 'VENCIDOS' | 'POR_VENCER'>('REGISTRO');
  const [mermas, setMermas] = useState<Incident[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form states
  const [selectedProductId, setSelectedProductId] = useState<number | ''>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [mermaReason, setMermaReason] = useState<'VENCIMIENTO' | 'DANO_ROTURA' | 'DEFECTO_FABRICA' | 'MERMA_OPERACIONAL' | 'OTRO'>('VENCIMIENTO');
  const [responsibleName, setResponsibleName] = useState(currentUser?.name || '');
  const [description, setDescription] = useState('');

  const loadData = async () => {
    let incList = await db.incidents.reverse().toArray();
    let prodList = await db.products.toArray();

    if (selectedCompanyId && selectedCompanyId !== 'ALL') {
      incList = incList.filter(i => i.companyId === selectedCompanyId);
      prodList = prodList.filter(p => p.companyId === selectedCompanyId);
    }

    setMermas(incList);
    setProducts(prodList);
  };

  useEffect(() => {
    loadData();
  }, [selectedCompanyId, refreshTrigger]);

  // Calculate expired products (expiryDate < today && stock > 0)
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const expiredProducts = products.filter(p => {
    if (!p.expiryDate || p.stock <= 0) return false;
    const exp = new Date(p.expiryDate + 'T00:00:00');
    return exp.getTime() < now.getTime();
  });

  // Calculate near-expiry products (diffDays between 0 and 30 && stock > 0)
  const nearExpiryProducts = products.filter(p => {
    if (!p.expiryDate || p.stock <= 0) return false;
    const exp = new Date(p.expiryDate + 'T00:00:00');
    const diffDays = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 30;
  });

  // Mermar producto directamente desde la lista de vencidos
  const handleMermaExpiredProduct = async (product: Product) => {
    if (confirm(`¿Dar de baja y mermar ${product.stock} ${product.unit} de "${product.name}" por vencimiento?`)) {
      const todayStr = new Date().toISOString().split('T')[0];
      const lossCost = (product.price || 0) * product.stock;

      // 1. Registrar merma
      await db.incidents.add({
        date: todayStr,
        type: 'MERMA_BODEGA',
        itemType: 'PRODUCTO',
        itemId: product.id,
        itemCode: product.code,
        itemName: product.name,
        quantity: product.stock,
        costEstimated: lossCost,
        mermaReason: 'VENCIMIENTO',
        location: product.location,
        responsibleName: currentUser?.name || 'Encargado de Bodega',
        responsibleRut: '11.111.111-1',
        description: `Baja de stock automática por producto vencido (Fecha vencimiento: ${product.expiryDate})`,
        companyId: product.companyId,
        resolutionStatus: 'RESUELTO',
        createdAt: new Date().toISOString()
      });

      // 2. Registrar movimiento de salida
      await db.productMovements.add({
        productId: product.id!,
        productCode: product.code,
        type: 'SALIDA',
        quantity: product.stock,
        reason: 'MERMA / PRODUCTO VENCIDO',
        workerOrSupplier: currentUser?.name || 'Encargado',
        date: todayStr,
        companyId: product.companyId || 'market-almacen',
        notes: `Merma por vencimiento fecha ${product.expiryDate}`,
        createdAt: new Date().toISOString()
      });

      // 3. Descontar stock a 0
      await db.products.update(product.id!, {
        stock: 0,
        updatedAt: new Date().toISOString()
      });

      await loadData();
      notifyLocalMutation();
    }
  };

  const handleCreateMerma = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId) {
      alert('Seleccione un producto a mermar.');
      return;
    }

    const prod = products.find(p => p.id === Number(selectedProductId));
    if (!prod) return;

    if (quantity <= 0 || quantity > prod.stock) {
      alert(`La cantidad debe ser entre 1 y el stock disponible (${prod.stock}).`);
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const lossCost = (prod.price || 0) * quantity;

    // 1. Agregar a incidents (mermas)
    await db.incidents.add({
      date: todayStr,
      type: 'MERMA_BODEGA',
      itemType: 'PRODUCTO',
      itemId: prod.id,
      itemCode: prod.code,
      itemName: prod.name,
      quantity,
      costEstimated: lossCost,
      mermaReason,
      location: prod.location,
      responsibleName: responsibleName.trim() || 'Encargado',
      responsibleRut: '11.111.111-1',
      description: description.trim() || `Merma registrada por ${mermaReason}`,
      companyId: prod.companyId,
      resolutionStatus: 'RESUELTO',
      createdAt: new Date().toISOString()
    });

    // 2. Registrar salida en movimientos
    await db.productMovements.add({
      productId: prod.id!,
      productCode: prod.code,
      type: 'SALIDA',
      quantity,
      reason: `MERMA: ${mermaReason}`,
      workerOrSupplier: responsibleName.trim(),
      date: todayStr,
      companyId: prod.companyId || 'market-almacen',
      notes: description.trim(),
      createdAt: new Date().toISOString()
    });

    // 3. Actualizar stock del producto
    await db.products.update(prod.id!, {
      stock: Math.max(0, prod.stock - quantity),
      updatedAt: new Date().toISOString()
    });

    setIsModalOpen(false);
    setSelectedProductId('');
    setQuantity(1);
    setDescription('');
    await loadData();
    notifyLocalMutation();
  };

  const handleDeleteMerma = async (id: number) => {
    if (confirm('¿Eliminar este registro de merma?')) {
      await db.incidents.delete(id);
      await loadData();
      notifyLocalMutation();
    }
  };

  const totalLoss = mermas.reduce((acc, m) => acc + (m.costEstimated || 0), 0);

  return (
    <div className="max-w-7xl mx-auto px-2.5 sm:px-6 py-4 space-y-4 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-red-500" />
            <span>Control de Mermas y Vencimientos</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Registro de pérdidas, bajas de inventario y alertas preventivas de caducidad
          </p>
        </div>

        {!isReadOnly && (
          <button
            onClick={() => setIsModalOpen(true)}
            className={`px-4 py-2 text-xs sm:text-sm font-black rounded-xl bg-red-600 hover:bg-red-700 text-white shadow-md flex items-center gap-2`}
          >
            <Plus className="w-4 h-4" />
            <span>Registrar Merma</span>
          </button>
        )}
      </div>

      {/* Subtabs Selector */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          onClick={() => setActiveSubTab('REGISTRO')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeSubTab === 'REGISTRO'
              ? 'bg-red-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <TrendingDown className="w-4 h-4" />
          <span>Historial de Mermas ({mermas.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('VENCIDOS')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeSubTab === 'VENCIDOS'
              ? 'bg-red-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <AlertCircle className="w-4 h-4 text-red-500" />
          <span>🚨 Productos Vencidos ({expiredProducts.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('POR_VENCER')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeSubTab === 'POR_VENCER'
              ? 'bg-amber-500 text-slate-950 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Clock className="w-4 h-4 text-amber-500" />
          <span>⚠️ Por Vencer (30d) ({nearExpiryProducts.length})</span>
        </button>
      </div>

      {/* SUBTAB 1: HISTORIAL DE MERMAS */}
      {activeSubTab === 'REGISTRO' && (
        <div className={`rounded-2xl border ${themeClasses.border} ${themeClasses.card} overflow-hidden shadow-sm space-y-4 p-4`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">
              Pérdida Total Valorizada en Mermas: <strong className="text-red-500 font-mono text-sm">${totalLoss.toLocaleString('es-CL')}</strong>
            </span>
          </div>

          {mermas.length === 0 ? (
            <div className="p-12 text-center text-slate-500 space-y-2">
              <Boxes className="w-10 h-10 mx-auto opacity-30" />
              <p className="text-sm font-bold">No hay mermas registradas</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold">
                  <tr>
                    <th className="py-2.5 px-3">FECHA</th>
                    <th className="py-2.5 px-3">CÓDIGO</th>
                    <th className="py-2.5 px-3">PRODUCTO</th>
                    <th className="py-2.5 px-3">CANTIDAD</th>
                    <th className="py-2.5 px-3">MOTIVO</th>
                    <th className="py-2.5 px-3 text-right">COSTO PÉRDIDA</th>
                    <th className="py-2.5 px-3">RESPONSABLE</th>
                    <th className="py-2.5 px-3 text-right">ACCIONES</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {mermas.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-3 font-mono text-slate-500">{m.date}</td>
                      <td className="py-2.5 px-3 font-mono font-bold text-blue-600">{m.itemCode}</td>
                      <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-slate-100">{m.itemName}</td>
                      <td className="py-2.5 px-3 font-black text-red-500">-{m.quantity || 1}</td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-red-500/20 text-red-400 border border-red-500/30">
                          {m.mermaReason || m.type}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-red-500">
                        ${(m.costEstimated || 0).toLocaleString('es-CL')}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">{m.responsibleName}</td>
                      <td className="py-2.5 px-3 text-right">
                        {!isReadOnly && m.id && (
                          <button
                            onClick={() => handleDeleteMerma(m.id!)}
                            className="p-1 text-slate-400 hover:text-red-500"
                            title="Eliminar registro"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 2: PRODUCTOS VENCIDOS */}
      {activeSubTab === 'VENCIDOS' && (
        <div className={`rounded-2xl border ${themeClasses.border} ${themeClasses.card} overflow-hidden shadow-sm p-4 space-y-4`}>
          <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-700 dark:text-red-300 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
              <span>
                Estos productos tienen <strong>fecha de caducidad vencida</strong> y mantienen stock en bodega.
                Presione "Dar de Baja" para rebajar el stock a 0 y registrar la merma contable automáticamente.
              </span>
            </div>
          </div>

          {expiredProducts.length === 0 ? (
            <div className="p-12 text-center text-emerald-600 dark:text-emerald-400 space-y-2">
              <CheckCircle2 className="w-12 h-12 mx-auto" />
              <p className="text-sm font-bold">¡Excelente! No hay productos con fecha de vencimiento expirada en bodega.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold">
                  <tr>
                    <th className="py-2.5 px-3">CÓDIGO</th>
                    <th className="py-2.5 px-3">PRODUCTO</th>
                    <th className="py-2.5 px-3">CATEGORÍA</th>
                    <th className="py-2.5 px-3">FECHA VENCIMIENTO</th>
                    <th className="py-2.5 px-3">STOCK A MERMAR</th>
                    <th className="py-2.5 px-3 text-right">VALORIZACIÓN</th>
                    <th className="py-2.5 px-3 text-right">ACCIÓN</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {expiredProducts.map((p) => {
                    const lossVal = (p.price || 0) * p.stock;
                    return (
                      <tr key={p.id} className="hover:bg-red-500/5">
                        <td className="py-2.5 px-3 font-mono font-bold text-blue-600">{p.code}</td>
                        <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-slate-100">{p.name}</td>
                        <td className="py-2.5 px-3 text-slate-500">{p.category}</td>
                        <td className="py-2.5 px-3 font-bold text-red-500 font-mono">
                          🚨 {p.expiryDate}
                        </td>
                        <td className="py-2.5 px-3 font-black text-red-500">
                          {p.stock} {p.unit}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                          ${lossVal.toLocaleString('es-CL')}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {!isReadOnly && (
                            <button
                              onClick={() => handleMermaExpiredProduct(p)}
                              className="px-3 py-1 text-xs font-bold rounded-lg bg-red-600 hover:bg-red-700 text-white shadow"
                            >
                              Dar de Baja
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 3: PRODUCTOS POR VENCER */}
      {activeSubTab === 'POR_VENCER' && (
        <div className={`rounded-2xl border ${themeClasses.border} ${themeClasses.card} overflow-hidden shadow-sm p-4 space-y-4`}>
          <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-500 shrink-0" />
            <span>
              Productos con fecha de caducidad en los <strong>próximos 30 días</strong>. Se recomienda priorizar su rotación o venta en oferta/descuento.
            </span>
          </div>

          {nearExpiryProducts.length === 0 ? (
            <div className="p-12 text-center text-slate-500 space-y-2">
              <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500" />
              <p className="text-sm font-bold">No hay productos próximos a vencer en los siguientes 30 días.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold">
                  <tr>
                    <th className="py-2.5 px-3">CÓDIGO</th>
                    <th className="py-2.5 px-3">PRODUCTO</th>
                    <th className="py-2.5 px-3">FECHA VENCIMIENTO</th>
                    <th className="py-2.5 px-3">DÍAS RESTANTES</th>
                    <th className="py-2.5 px-3">STOCK DISPONIBLE</th>
                    <th className="py-2.5 px-3 text-right">PRECIO VENTA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {nearExpiryProducts.map((p) => {
                    const exp = new Date(p.expiryDate + 'T00:00:00');
                    const diffDays = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                    return (
                      <tr key={p.id} className="hover:bg-amber-500/5">
                        <td className="py-2.5 px-3 font-mono font-bold text-blue-600">{p.code}</td>
                        <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-slate-100">{p.name}</td>
                        <td className="py-2.5 px-3 font-bold text-amber-500 font-mono">{p.expiryDate}</td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-500 border border-amber-500/30">
                            ⏳ Vence en ${diffDays} días
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-800 dark:text-slate-200">
                          {p.stock} {p.unit}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                          ${(p.price || 0).toLocaleString('es-CL')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal Registrar Merma Manual */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className={`w-full max-w-lg rounded-2xl border ${themeClasses.border} ${themeClasses.card} p-5 sm:p-6 shadow-2xl flex flex-col max-h-[90vh]`}>
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="font-bold text-base sm:text-lg flex items-center gap-2 text-red-500">
                <AlertTriangle className="w-5 h-5" />
                <span>Registrar Nueva Merma</span>
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 rounded-lg text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateMerma} className="space-y-4 my-4 overflow-y-auto flex-1 pr-1">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Seleccionar Producto del Inventario *
                </label>
                <select
                  required
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(Number(e.target.value))}
                  className={`w-full px-3 py-2 text-xs font-bold rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg}`}
                >
                  <option value="">-- Seleccionar producto con stock --</option>
                  {products.filter(p => p.stock > 0).map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} (Stock: {p.stock} {p.unit} - {p.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Cantidad a Mermar *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    className={`w-full px-3 py-2 text-xs font-bold rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg}`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Motivo de la Merma *
                  </label>
                  <select
                    value={mermaReason}
                    onChange={(e) => setMermaReason(e.target.value as any)}
                    className={`w-full px-3 py-2 text-xs font-bold rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg}`}
                  >
                    <option value="VENCIMIENTO">🚨 Producto Vencido</option>
                    <option value="DANO_ROTURA">💥 Daño / Rotura</option>
                    <option value="DEFECTO_FABRICA">⚠️ Defecto de Fábrica</option>
                    <option value="MERMA_OPERACIONAL">📦 Merma Operacional</option>
                    <option value="OTRO">❓ Otro</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Responsable del Registro *
                </label>
                <input
                  type="text"
                  required
                  value={responsibleName}
                  onChange={(e) => setResponsibleName(e.target.value)}
                  className={`w-full px-3 py-2 text-xs rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg}`}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Detalles / Justificación
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Explique el motivo del descarte..."
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
                  className="px-5 py-2 text-xs font-black rounded-xl bg-red-600 hover:bg-red-700 text-white shadow-md"
                >
                  Confirmar Merma
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
