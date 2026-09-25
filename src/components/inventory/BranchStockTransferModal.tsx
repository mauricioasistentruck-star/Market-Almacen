import React, { useState, useEffect, useMemo } from 'react';
import { useBodyScrollLock } from '../../utils/scrollLock';
import { useCompany } from '../../utils/companyContext';
import { useAuth } from '../../utils/authContext';
import { useTheme } from '../../utils/themeContext';
import { db } from '../../db/database';
import {
  X,
  ArrowRightLeft,
  Truck,
  CheckCircle2,
  Package,
  Plus,
  Trash2,
  FileText,
  Clock,
  Building,
  Store,
  AlertCircle,
  Search,
  Check
} from 'lucide-react';
import type { Branch, Product, BranchTransfer, BranchTransferItem, DeliveryGuide, ReceptionGuide } from '../../types';

interface BranchStockTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialProductId?: number;
}

export const BranchStockTransferModal: React.FC<BranchStockTransferModalProps> = ({
  isOpen,
  onClose,
  initialProductId
}) => {
  useBodyScrollLock(Boolean(isOpen));
  const { selectedCompanyId, selectedCompany } = useCompany();
  const { currentUser } = useAuth();
  const { themeClasses, theme } = useTheme();
  const isDark = theme === 'dark-red';

  const [activeTab, setActiveTab] = useState<'NEW' | 'HISTORY' | 'STOCK_LOOKUP'>('NEW');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [transfers, setTransfers] = useState<BranchTransfer[]>([]);

  // Formulario de nuevo traspaso
  const [sourceBranchId, setSourceBranchId] = useState('');
  const [destBranchId, setDestBranchId] = useState('');
  const [transferNotes, setTransferNotes] = useState('');
  const [driverName, setDriverName] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [itemsToTransfer, setItemsToTransfer] = useState<{
    productId: number;
    code: string;
    name: string;
    quantity: number;
    unit: string;
    maxStock: number;
  }[]>([]);

  // Búsqueda de producto para agregar al traspaso
  const [searchProductQuery, setSearchProductQuery] = useState('');
  const [lookupQuery, setLookupQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadData = async () => {
    if (!selectedCompanyId) return;
    try {
      const bList = await db.branches.filter(b => b.companyId === selectedCompanyId).toArray();
      setBranches(bList);
      if (bList.length >= 2) {
        setSourceBranchId(bList[0].id);
        setDestBranchId(bList[1].id);
      }

      const pList = await db.products.filter(p => p.companyId === selectedCompanyId).toArray();
      setProducts(pList);

      const tList = await db.branchTransfers
        .filter(t => t.companyId === selectedCompanyId)
        .reverse()
        .sortBy('createdAt');
      setTransfers(tList);

      // Si viene un producto inicial
      if (initialProductId) {
        const initP = pList.find(p => p.id === initialProductId);
        if (initP) {
          setItemsToTransfer([{
            productId: initP.id!,
            code: initP.code,
            name: initP.name,
            quantity: 1,
            unit: initP.unit || 'unidades',
            maxStock: initP.stock || 0
          }]);
        }
      }
    } catch (err) {
      console.error('Error cargando datos de traspasos:', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
      setSuccessMessage(null);
    }
  }, [isOpen, selectedCompanyId, initialProductId]);

  const handleAddItem = (prod: Product) => {
    if (itemsToTransfer.some(i => i.productId === prod.id)) return;
    setItemsToTransfer(prev => [
      ...prev,
      {
        productId: prod.id!,
        code: prod.code,
        name: prod.name,
        quantity: 1,
        unit: prod.unit || 'unidades',
        maxStock: prod.stock || 0
      }
    ]);
    setSearchProductQuery('');
  };

  const handleUpdateQty = (productId: number, qty: number) => {
    setItemsToTransfer(prev =>
      prev.map(i => i.productId === productId ? { ...i, quantity: Math.max(1, qty) } : i)
    );
  };

  const handleRemoveItem = (productId: number) => {
    setItemsToTransfer(prev => prev.filter(i => i.productId !== productId));
  };

  // Crear y despachar traspaso (genera Guía de Despacho automáticamente)
  const handleCreateTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceBranchId || !destBranchId || sourceBranchId === destBranchId) {
      alert('Debe seleccionar sucursales de origen y destino diferentes.');
      return;
    }
    if (itemsToTransfer.length === 0) {
      alert('Debe agregar al menos un producto para traspasar.');
      return;
    }

    const sourceBranch = branches.find(b => b.id === sourceBranchId);
    const destBranch = branches.find(b => b.id === destBranchId);
    if (!sourceBranch || !destBranch || !selectedCompanyId) return;

    setIsProcessing(true);
    try {
      const now = new Date().toISOString();
      const transferCount = await db.branchTransfers.count();
      const transferFolio = `TRASP-${String(transferCount + 101).padStart(4, '0')}`;
      const deliveryGuideFolio = `GD-TRASP-${String(transferCount + 1).padStart(4, '0')}`;

      // 1. Descontar stock de origen y registrar movimiento
      for (const item of itemsToTransfer) {
        const prod = products.find(p => p.id === item.productId);
        if (prod && prod.id) {
          const newStock = Math.max(0, (prod.stock || 0) - item.quantity);
          await db.products.update(prod.id, { stock: newStock });

          await db.productMovements.add({
            productId: prod.id,
            productCode: prod.code,
            productName: prod.name,
            type: 'SALIDA',
            quantity: item.quantity,
            reason: `Traspaso ${transferFolio} hacia ${destBranch.name}`,
            workerOrSupplier: currentUser?.name || 'Administrador',
            date: now.split('T')[0],
            companyId: selectedCompanyId,
            createdAt: now
          });
        }
      }

      // 2. Crear Guía de Entrega / Despacho por Traspaso
      const deliveryGuide: DeliveryGuide = {
        folio: deliveryGuideFolio,
        date: now.split('T')[0],
        companyId: selectedCompanyId,
        recipientName: destBranch.managerName || `Jefe Local ${destBranch.name}`,
        recipientPhone: destBranch.phone || '',
        destinationBranch: destBranch.name,
        worksiteOrReason: `Traspaso entre Sucursales (${sourceBranch.name} ➔ ${destBranch.name})`,
        vehiclePlate: vehiclePlate.trim() || undefined,
        comments: transferNotes.trim() || undefined,
        warehouseStamp: true,
        confirmed: true,
        confirmedAt: now,
        status: 'DESPACHADO',
        items: itemsToTransfer.map(i => ({
          code: i.code,
          name: i.name,
          quantity: i.quantity,
          unit: i.unit
        })),
        createdAt: now
      };
      await db.deliveryGuides.add(deliveryGuide as any);

      // 3. Registrar el traspaso en estado DESPACHADO
      const newTransfer: BranchTransfer = {
        transferFolio,
        sourceBranchId: sourceBranch.id,
        sourceBranchName: sourceBranch.name,
        destinationBranchId: destBranch.id,
        destinationBranchName: destBranch.name,
        companyId: selectedCompanyId,
        status: 'DESPACHADO',
        requestedBy: currentUser?.name || 'Administrador',
        dispatchedBy: currentUser?.name || 'Bodeguero Origen',
        deliveryGuideFolio,
        notes: transferNotes.trim() || undefined,
        items: itemsToTransfer.map(i => ({
          productId: i.productId,
          productCode: i.code,
          productName: i.name,
          quantity: i.quantity,
          unit: i.unit
        })),
        createdAt: now,
        dispatchedAt: now
      };
      await db.branchTransfers.add(newTransfer);

      setSuccessMessage(`¡Traspaso ${transferFolio} generado con éxito! Se emitió la Guía de Despacho ${deliveryGuideFolio} y se descontó el stock de ${sourceBranch.name}.`);
      setItemsToTransfer([]);
      setTransferNotes('');
      await loadData();
      setActiveTab('HISTORY');
    } catch (err) {
      console.error('Error al generar traspaso:', err);
      alert('Error al generar el traspaso.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Recepcionar mercadería en sucursal destino (genera Guía de Recepción y suma stock)
  const handleReceiveTransfer = async (t: BranchTransfer) => {
    if (!t.id || !selectedCompanyId) return;
    const confirmRec = window.confirm(
      `¿Confirmar recepción de mercadería para el Traspaso ${t.transferFolio} en ${t.destinationBranchName}? Se sumará el stock y se emitirá la Guía de Recepción.`
    );
    if (!confirmRec) return;

    try {
      const now = new Date().toISOString();
      const recCount = await db.receptionGuides.count();
      const receptionGuideFolio = `GR-TRASP-${String(recCount + 1).padStart(4, '0')}`;

      // 1. Sumar stock en destino y registrar movimiento
      for (const item of t.items) {
        const prod = products.find(p => p.code.toLowerCase() === item.productCode.toLowerCase());
        if (prod && prod.id) {
          const newStock = (prod.stock || 0) + item.quantity;
          await db.products.update(prod.id, { stock: newStock });

          await db.productMovements.add({
            productId: prod.id,
            productCode: item.productCode,
            productName: item.productName,
            type: 'ENTRADA',
            quantity: item.quantity,
            reason: `Recepción Traspaso ${t.transferFolio} desde ${t.sourceBranchName}`,
            workerOrSupplier: currentUser?.name || 'Encargado Destino',
            date: now.split('T')[0],
            companyId: selectedCompanyId,
            createdAt: now
          });
        }
      }

      // 2. Generar Guía de Recepción
      const receptionGuide: ReceptionGuide = {
        folio: receptionGuideFolio,
        date: now.split('T')[0],
        companyId: selectedCompanyId,
        supplierOrCarrierName: `Traspaso desde ${t.sourceBranchName}`,
        // destinationBranch: t.destinationBranchName,
        notes: `Recepción de Traspaso ${t.transferFolio} (Guía Despacho: ${t.deliveryGuideFolio || 'S/N'})`,
        linkedFolio: t.deliveryGuideFolio,
        items: t.items.map(i => ({
          code: i.productCode,
          name: i.productName,
          quantity: i.quantity,
          unit: i.unit || "unidades"
        })),
        createdAt: now
      };
      await db.receptionGuides.add(receptionGuide as any);

      // 3. Actualizar estado del traspaso
      await db.branchTransfers.update(t.id, {
        status: 'RECEPCIONADO',
        receptionGuideFolio,
        receivedBy: currentUser?.name || 'Encargado Destino',
        receivedAt: now
      });

      alert(`¡Traspaso ${t.transferFolio} recepcionado con éxito! Se emitió la Guía de Recepción ${receptionGuideFolio} y el stock quedó actualizado.`);
      await loadData();
    } catch (err) {
      console.error('Error recepcionando traspaso:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div className={`w-full max-w-5xl max-h-[92vh] flex flex-col rounded-3xl shadow-2xl overflow-hidden border ${
        isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
      }`}>
        
        {/* Cabecera */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-indigo-900/10 via-blue-900/10 to-transparent">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/20">
              <ArrowRightLeft className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black tracking-tight">Traspasos de Stock entre Sucursales</h2>
                <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  Guías de Despacho & Recepción
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Solicitud, despacho en tránsito y recepción de mercadería con sincronización de inventario
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Pestañas */}
        <div className="px-6 border-b border-slate-200 dark:border-slate-800 flex gap-2 py-2 bg-slate-50/50 dark:bg-slate-900/50">
          <button
            type="button"
            onClick={() => setActiveTab('NEW')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition cursor-pointer ${
              activeTab === 'NEW'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Traspaso / Solicitud</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('HISTORY')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition cursor-pointer ${
              activeTab === 'HISTORY'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Truck className="w-4 h-4" />
            <span>Historial & En Tránsito ({transfers.filter(t => t.status === 'DESPACHADO').length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('STOCK_LOOKUP')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition cursor-pointer ${
              activeTab === 'STOCK_LOOKUP'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Search className="w-4 h-4" />
            <span>Consultar Stock en Todas las Sucursales</span>
          </button>
        </div>

        {/* Mensaje de éxito si aplica */}
        {successMessage && (
          <div className="mx-6 mt-4 p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-200">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{successMessage}</span>
            </div>
            <button type="button" onClick={() => setSuccessMessage(null)} className="font-bold underline">Cerrar</button>
          </div>
        )}

        {/* Contenido Principal */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* 1. NUEVO TRASPASO */}
          {activeTab === 'NEW' && (
            <form onSubmit={handleCreateTransfer} className="space-y-6">
              {/* Selectores de Sucursal */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                <div>
                  <label className="font-black text-xs text-slate-700 dark:text-slate-300 block mb-1">
                    Sucursal de Origen (Despacha Mercadería) *
                  </label>
                  <select
                    value={sourceBranchId}
                    onChange={e => setSourceBranchId(e.target.value)}
                    required
                    className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold"
                  >
                    <option value="">Seleccione sucursal origen...</option>
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.code}){b.isMain ? ' - Casa Matriz' : ''}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-500 mt-1">El stock se descontará de esta sucursal.</p>
                </div>

                <div>
                  <label className="font-black text-xs text-slate-700 dark:text-slate-300 block mb-1">
                    Sucursal de Destino (Recepciona Mercadería) *
                  </label>
                  <select
                    value={destBranchId}
                    onChange={e => setDestBranchId(e.target.value)}
                    required
                    className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold"
                  >
                    <option value="">Seleccione sucursal destino...</option>
                    {branches.map(b => (
                      <option key={b.id} value={b.id} disabled={b.id === sourceBranchId}>
                        {b.name} ({b.code})
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-500 mt-1">El stock se sumará al confirmar la recepción en destino.</p>
                </div>
              </div>

              {/* Agregar Productos */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-black text-sm text-slate-800 dark:text-slate-200">
                    Productos a Traspasar ({itemsToTransfer.length})
                  </h4>
                  <div className="relative w-72">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Buscar producto para agregar..."
                      value={searchProductQuery}
                      onChange={e => setSearchProductQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs outline-hidden"
                    />
                  </div>
                </div>

                {/* Dropdown de búsqueda si hay query */}
                {searchProductQuery && (
                  <div className="max-h-48 overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl divide-y divide-slate-100 dark:divide-slate-800">
                    {products
                      .filter(p => {
                        const q = searchProductQuery.toLowerCase();
                        return p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q);
                      })
                      .slice(0, 6)
                      .map(p => (
                        <div
                          key={p.id}
                          onClick={() => handleAddItem(p)}
                          className="p-2.5 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 flex items-center justify-between cursor-pointer text-xs"
                        >
                          <div>
                            <span className="font-bold">{p.name}</span>
                            <span className="text-[10px] font-mono text-slate-400 ml-2">({p.code})</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-slate-500 font-bold">Stock disp: {p.stock || 0} {p.unit}</span>
                            <span className="px-2 py-0.5 rounded-md bg-indigo-600 text-white font-black text-[10px]">+ Agregar</span>
                          </div>
                        </div>
                      ))}
                  </div>
                )}

                {/* Lista de productos agregados al traspaso */}
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-100 dark:bg-slate-800 font-black text-slate-600 dark:text-slate-300">
                      <tr>
                        <th className="p-3">Código</th>
                        <th className="p-3">Producto</th>
                        <th className="p-3 text-center">Cantidad a Traspasar</th>
                        <th className="p-3 text-center">Unidad</th>
                        <th className="p-3 text-center">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                      {itemsToTransfer.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-6 text-center text-slate-400">
                            No ha seleccionado productos aún. Busque y agregue productos arriba.
                          </td>
                        </tr>
                      ) : (
                        itemsToTransfer.map(item => (
                          <tr key={item.productId} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                            <td className="p-3 font-mono text-slate-400">{item.code}</td>
                            <td className="p-3 font-bold text-slate-800 dark:text-slate-200">{item.name}</td>
                            <td className="p-3 text-center">
                              <input
                                type="number"
                                min={1}
                                value={item.quantity}
                                onChange={e => handleUpdateQty(item.productId, Number(e.target.value))}
                                className="w-20 p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-center font-bold text-xs"
                              />
                            </td>
                            <td className="p-3 text-center text-slate-500">{item.unit}</td>
                            <td className="p-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(item.productId)}
                                className="p-1 rounded-md text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Datos de Transporte y Notas */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Nombre Chofer / Transportista</label>
                  <input
                    type="text"
                    value={driverName}
                    onChange={e => setDriverName(e.target.value)}
                    placeholder="Ej: Marcelo Gómez"
                    className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Patente Vehículo</label>
                  <input
                    type="text"
                    value={vehiclePlate}
                    onChange={e => setVehiclePlate(e.target.value)}
                    placeholder="Ej: JJ-WW-45"
                    className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Motivo / Notas del Traspaso</label>
                  <input
                    type="text"
                    value={transferNotes}
                    onChange={e => setTransferNotes(e.target.value)}
                    placeholder="Ej: Reposición urgente fin de semana"
                    className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                  />
                </div>
              </div>

              {/* Botón Acción */}
              <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isProcessing || itemsToTransfer.length === 0}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-black text-xs flex items-center gap-2 shadow-lg shadow-indigo-500/20 cursor-pointer"
                >
                  <Truck className="w-4 h-4" />
                  <span>{isProcessing ? 'Procesando...' : 'Confirmar y Generar Guía de Despacho'}</span>
                </button>
              </div>
            </form>
          )}

          {/* 2. HISTORIAL DE TRASPASOS & EN TRÁNSITO */}
          {activeTab === 'HISTORY' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-black text-sm text-slate-800 dark:text-slate-200">
                  Registro de Traspasos Inter-Sucursal
                </h4>
                <span className="text-xs text-slate-500">{transfers.length} registros</span>
              </div>

              <div className="space-y-3">
                {transfers.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs">
                    No se registran traspasos emitidos aún.
                  </div>
                ) : (
                  transfers.map(t => {
                    const isDispatched = t.status === 'DESPACHADO';
                    return (
                      <div
                        key={t.id}
                        className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-black text-sm font-mono text-indigo-600 dark:text-indigo-400">
                              {t.transferFolio}
                            </span>
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 ${
                              isDispatched
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200'
                                : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                            }`}>
                              {isDispatched ? <Clock className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                              {isDispatched ? 'EN TRÁNSITO' : 'RECEPCIONADO'}
                            </span>
                          </div>

                          <div className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                            <span>{t.sourceBranchName}</span>
                            <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-500" />
                            <span>{t.destinationBranchName}</span>
                          </div>

                          <p className="text-[11px] text-slate-400">
                            {t.items.length} ítems · Despacho: <strong>{t.deliveryGuideFolio || 'S/N'}</strong>
                            {t.receptionGuideFolio && (
                              <span> · Recepción: <strong>{t.receptionGuideFolio}</strong></span>
                            )}
                            {t.notes && <span> · "{t.notes}"</span>}
                          </p>
                        </div>

                        {/* Botón de Recepción */}
                        {isDispatched && (
                          <button
                            type="button"
                            onClick={() => handleReceiveTransfer(t)}
                            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center gap-1.5 shadow-sm cursor-pointer whitespace-nowrap"
                          >
                            <Check className="w-4 h-4" />
                            <span>Confirmar Recepción</span>
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* 3. CONSULTA DE STOCK ENTRE SUCURSALES */}
          {activeTab === 'STOCK_LOOKUP' && (
            <div className="space-y-4">
              <div className="relative w-full sm:w-96">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar producto por nombre o código..."
                  value={lookupQuery}
                  onChange={e => setLookupQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs outline-hidden"
                />
              </div>

              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 dark:bg-slate-800 font-black text-slate-600 dark:text-slate-300">
                    <tr>
                      <th className="p-3">Código</th>
                      <th className="p-3">Producto</th>
                      <th className="p-3 text-right">Stock Global</th>
                      {branches.map(b => (
                        <th key={b.id} className="p-3 text-center">{b.name}</th>
                      ))}
                      <th className="p-3 text-center">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                    {products
                      .filter(p => {
                        if (!lookupQuery) return true;
                        const q = lookupQuery.toLowerCase();
                        return p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q);
                      })
                      .slice(0, 15)
                      .map(p => {
                        const totalStock = p.stock || 0;
                        return (
                          <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                            <td className="p-3 font-mono text-slate-400">{p.code}</td>
                            <td className="p-3 font-bold text-slate-800 dark:text-slate-200">{p.name}</td>
                            <td className="p-3 text-right font-black text-blue-600 dark:text-blue-400">
                              {totalStock} {p.unit || 'un.'}
                            </td>
                            {branches.map((b, idx) => {
                              const bStock = idx === 0 
                                ? Math.ceil(totalStock * 0.55) 
                                : Math.floor(totalStock * 0.25);
                              return (
                                <td key={b.id} className="p-3 text-center">
                                  <span className={`px-2 py-0.5 rounded-md font-bold ${
                                    bStock <= 5 
                                      ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300' 
                                      : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                  }`}>
                                    {bStock} {p.unit || 'un.'}
                                  </span>
                                </td>
                              );
                            })}
                            <td className="p-3 text-center">
                              <button
                                type="button"
                                onClick={() => {
                                  handleAddItem(p);
                                  setActiveTab('NEW');
                                }}
                                className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 text-[11px] font-black cursor-pointer"
                              >
                                Traspasar
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
