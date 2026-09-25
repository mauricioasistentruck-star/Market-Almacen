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
  Check,
  AlertTriangle,
  Info
} from 'lucide-react';
import type { Branch, Product, BranchTransfer, BranchTransferItem, DeliveryGuide, ReceptionGuide } from '../../types';
import { getProductBranchStock, getActiveBranchId, deductFromBranchStock, calculateUpdatedBranchStocks } from '../../utils/branchStockUtils';

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

  // Formulario de nuevo traspaso: Origen (quien entrega) y Destino (en la que me encuentro / quien recibe)
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
    sourceStock: number;
    destStock: number;
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

      const activeLocal = getActiveBranchId();
      // Destino por defecto: la sucursal en la que me encuentro
      if (bList.some(b => b.id === activeLocal)) {
        setDestBranchId(activeLocal);
        const otherBranch = bList.find(b => b.id !== activeLocal);
        if (otherBranch) {
          setSourceBranchId(otherBranch.id);
        }
      } else if (bList.length >= 2) {
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
          const sId = bList[0]?.id || '';
          const dId = bList[1]?.id || '';
          const sStock = getProductBranchStock(initP, sId, bList);
          const dStock = getProductBranchStock(initP, dId, bList);
          setItemsToTransfer([{
            productId: initP.id!,
            code: initP.code,
            name: initP.name,
            quantity: Math.min(1, sStock),
            unit: initP.unit || 'unidades',
            sourceStock: sStock,
            destStock: dStock,
            maxStock: sStock
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

  const sourceBranch = useMemo(() => branches.find(b => b.id === sourceBranchId), [branches, sourceBranchId]);
  const destBranch = useMemo(() => branches.find(b => b.id === destBranchId), [branches, destBranchId]);

  // Actualizar stocks en lista si cambian las sucursales
  useEffect(() => {
    if (!sourceBranchId || !destBranchId) return;
    setItemsToTransfer(prev =>
      prev.map(item => {
        const prod = products.find(p => p.id === item.productId);
        if (!prod) return item;
        const sStock = getProductBranchStock(prod, sourceBranchId, branches);
        const dStock = getProductBranchStock(prod, destBranchId, branches);
        return {
          ...item,
          sourceStock: sStock,
          destStock: dStock,
          maxStock: sStock,
          quantity: Math.min(item.quantity, Math.max(1, sStock))
        };
      })
    );
  }, [sourceBranchId, destBranchId]);

  const handleAddItem = (prod: Product) => {
    if (itemsToTransfer.some(i => i.productId === prod.id)) return;

    const sStock = getProductBranchStock(prod, sourceBranchId, branches);
    const dStock = getProductBranchStock(prod, destBranchId, branches);

    if (sStock <= 0) {
      alert(`No es posible solicitar este producto porque la sucursal de origen "${sourceBranch?.name || 'seleccionada'}" no posee stock registrado en sistema (0 ${prod.unit || 'un.'}).`);
      return;
    }

    setItemsToTransfer(prev => [
      ...prev,
      {
        productId: prod.id!,
        code: prod.code,
        name: prod.name,
        quantity: 1,
        unit: prod.unit || 'unidades',
        sourceStock: sStock,
        destStock: dStock,
        maxStock: sStock
      }
    ]);
    setSearchProductQuery('');
  };

  const handleUpdateQty = (productId: number, qty: number) => {
    setItemsToTransfer(prev =>
      prev.map(i => {
        if (i.productId !== productId) return i;
        const maxAllowed = i.sourceStock || 0;
        if (qty > maxAllowed) {
          alert(`No se puede solicitar una cantidad superior al stock registrado en sistema de esa sucursal. El stock disponible en "${sourceBranch?.name || 'Origen'}" es de ${maxAllowed} ${i.unit}.`);
        }
        const safeQty = Math.max(1, Math.min(maxAllowed, qty));
        return { ...i, quantity: safeQty };
      })
    );
  };

  const handleRemoveItem = (productId: number) => {
    setItemsToTransfer(prev => prev.filter(i => i.productId !== productId));
  };

  // Crear y despachar traspaso (genera Guía de Despacho automáticamente y descuenta stock exclusivo de origen)
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

    if (!sourceBranch || !destBranch || !selectedCompanyId) return;

    // Validación estricta: ninguna cantidad puede superar el stock de origen
    for (const item of itemsToTransfer) {
      const prod = products.find(p => p.id === item.productId);
      if (!prod) continue;
      const currentSourceStock = getProductBranchStock(prod, sourceBranchId, branches);
      if (item.quantity > currentSourceStock) {
        alert(`Error de stock: No es posible solicitar ${item.quantity} ${item.unit} de "${item.name}". La sucursal "${sourceBranch.name}" solo tiene ${currentSourceStock} ${item.unit} en sistema.`);
        return;
      }
    }

    setIsProcessing(true);
    try {
      const now = new Date().toISOString();
      const transferCount = await db.branchTransfers.count();
      const transferFolio = `TRASP-${String(transferCount + 101).padStart(4, '0')}`;
      const deliveryGuideFolio = `GD-TRASP-${String(transferCount + 1).padStart(4, '0')}`;

      // 1. Descontar stock exclusivo de la sucursal de origen y registrar movimiento
      for (const item of itemsToTransfer) {
        const prod = products.find(p => p.id === item.productId);
        if (prod && prod.id) {
          const deductRes = deductFromBranchStock(prod, sourceBranchId, item.quantity, branches);
          await db.products.update(prod.id, {
            stock: deductRes.newTotalStock,
            branchStocks: deductRes.branchStocks,
            updatedAt: now
          });

          await db.productMovements.add({
            productId: prod.id,
            productCode: prod.code,
            productName: prod.name,
            type: 'SALIDA',
            quantity: item.quantity,
            reason: `Traspaso ${transferFolio} hacia ${destBranch.name} (Salida de ${sourceBranch.name})`,
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

      setSuccessMessage(`¡Traspaso ${transferFolio} despachado exitosamente! Se descontó el stock de "${sourceBranch.name}" y se emitió la Guía de Despacho ${deliveryGuideFolio}. Estado: EN TRÁNSITO.`);
      setItemsToTransfer([]);
      setTransferNotes('');
      setVehiclePlate('');
      setDriverName('');
      await loadData();
      setActiveTab('HISTORY');
    } catch (err) {
      console.error('Error creando traspaso:', err);
      alert('Ocurrió un error al procesar el traspaso.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Confirmar recepción en sucursal destino
  const handleReceiveTransfer = async (t: BranchTransfer) => {
    if (t.status === 'RECEPCIONADO') return;
    if (!window.confirm(`¿Confirmar la recepción física de la mercadería del Traspaso ${t.transferFolio} en ${t.destinationBranchName}?`)) {
      return;
    }

    try {
      const now = new Date().toISOString();
      const recCount = await db.receptionGuides.count();
      const receptionGuideFolio = `GR-TRASP-${String(recCount + 1).padStart(4, '0')}`;

      // 1. Sumar stock exclusivo a la sucursal de destino y registrar movimiento
      for (const item of t.items) {
        const prod = products.find(p => p.code.toLowerCase() === item.productCode.toLowerCase());
        if (prod && prod.id) {
          const currentDestStock = getProductBranchStock(prod, t.destinationBranchId, branches);
          const addRes = calculateUpdatedBranchStocks(prod, t.destinationBranchId, currentDestStock + item.quantity, branches);

          await db.products.update(prod.id, {
            stock: addRes.newTotalStock,
            branchStocks: addRes.branchStocks,
            updatedAt: now
          });

          await db.productMovements.add({
            productId: prod.id,
            productCode: item.productCode,
            productName: item.productName,
            type: 'ENTRADA',
            quantity: item.quantity,
            reason: `Recepción Traspaso ${t.transferFolio} desde ${t.sourceBranchName} (Entrada en ${t.destinationBranchName})`,
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
        notes: `Recepción de Traspaso ${t.transferFolio} (Guía Despacho: ${t.deliveryGuideFolio || 'S/N'})`,
        linkedFolio: t.deliveryGuideFolio,
        items: t.items.map(i => ({
          code: i.productCode,
          name: i.productName,
          quantity: i.quantity,
          unit: i.unit || 'unidades'
        })),
        createdAt: now
      };
      await db.receptionGuides.add(receptionGuide as any);

      // 3. Actualizar estado del traspaso
      await db.branchTransfers.update(t.id!, {
        status: 'RECEPCIONADO',
        receptionGuideFolio,
        receivedBy: currentUser?.name || 'Encargado Destino',
        receivedAt: now
      });

      alert(`¡Traspaso ${t.transferFolio} recepcionado con éxito! Se emitió la Guía de Recepción ${receptionGuideFolio} y el stock de ${t.destinationBranchName} quedó actualizado.`);
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
                  Control de Stock Cruzado y Guías Oficiales
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Compare las existencias entre locales y solicite mercadería sin superar el stock registrado en sistema
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

        {/* Mensaje de Éxito si aplica */}
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
              
              {/* Notificación informativa del flujo */}
              <div className="p-3.5 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 flex items-start gap-2.5 text-xs text-blue-900 dark:text-blue-200">
                <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Reglas de Traspaso Seguro:</p>
                  <p className="text-[11px] text-blue-800 dark:text-blue-300 mt-0.5">
                    El sistema compara en tiempo real el stock de la <strong>Sucursal Solicitada (Origen)</strong> y de <strong>Mi Sucursal (Destino)</strong>. No es posible pedir una cantidad superior al stock registrado en la sucursal que entrega.
                  </p>
                </div>
              </div>

              {/* Selectores de Sucursal */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                <div>
                  <label className="font-black text-xs text-slate-700 dark:text-slate-300 block mb-1">
                    Sucursal Solicitada (Entrega / Despacha) *
                  </label>
                  <select
                    value={sourceBranchId}
                    onChange={e => setSourceBranchId(e.target.value)}
                    required
                    className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold"
                  >
                    <option value="">Seleccione sucursal a la que solicita mercadería...</option>
                    {branches.map(b => (
                      <option key={b.id} value={b.id} disabled={b.id === destBranchId}>
                        {b.name} ({b.code}){b.isMain ? ' - Casa Matriz' : ''}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-500 mt-1">El stock disponible de esta sucursal limitará la cantidad máxima a solicitar.</p>
                </div>

                <div>
                  <label className="font-black text-xs text-slate-700 dark:text-slate-300 block mb-1">
                    Mi Sucursal / Destino (En la que me encuentro y que Recibe) *
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
                        {b.name} ({b.code}){b.isMain ? ' - Casa Matriz' : ''}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-500 mt-1">El stock ingresará formalmente al confirmar la recepción en destino.</p>
                </div>
              </div>

              {/* Agregar Productos */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="font-black text-sm text-slate-800 dark:text-slate-200">
                      Productos a Traspasar ({itemsToTransfer.length})
                    </h4>
                    <span className="text-[11px] text-slate-500">
                      Viendo stock comparativo entre <strong>{sourceBranch?.name || 'Origen'}</strong> y <strong>{destBranch?.name || 'Mi Local'}</strong>
                    </span>
                  </div>

                  <div className="relative w-full sm:w-80">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Buscar producto por nombre o código..."
                      value={searchProductQuery}
                      onChange={e => setSearchProductQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs outline-none"
                    />
                  </div>
                </div>

                {/* Dropdown de búsqueda con ambos stocks claramente señalados */}
                {searchProductQuery && (
                  <div className="max-h-56 overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl divide-y divide-slate-100 dark:divide-slate-800 animate-in fade-in duration-100">
                    {products
                      .filter(p => {
                        const q = searchProductQuery.toLowerCase();
                        return p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q);
                      })
                      .slice(0, 8)
                      .map(p => {
                        const sStock = getProductBranchStock(p, sourceBranchId, branches);
                        const dStock = getProductBranchStock(p, destBranchId, branches);
                        const hasSourceStock = sStock > 0;

                        return (
                          <div
                            key={p.id}
                            className={`p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs transition ${
                              hasSourceStock 
                                ? 'hover:bg-indigo-50 dark:hover:bg-indigo-950/40 cursor-pointer' 
                                : 'bg-slate-50/60 dark:bg-slate-800/30 opacity-75'
                            }`}
                            onClick={() => {
                              if (hasSourceStock) handleAddItem(p);
                            }}
                          >
                            <div className="min-w-0">
                              <span className="font-bold text-slate-900 dark:text-slate-100">{p.name}</span>
                              <span className="text-[10px] font-mono text-slate-400 ml-2">({p.code})</span>
                            </div>

                            {/* Indicadores claros de ambos stocks */}
                            <div className="flex items-center gap-2 flex-wrap shrink-0">
                              {/* Stock en sucursal que entrega */}
                              <div className={`px-2.5 py-1 rounded-lg border font-bold text-[11px] flex items-center gap-1 ${
                                hasSourceStock
                                  ? 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800'
                                  : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800'
                              }`}>
                                <span className="text-[10px] text-slate-500 dark:text-slate-400">En {sourceBranch?.name ? sourceBranch.name.split(' ')[0] : 'Origen'}:</span>
                                <span className="font-black">{sStock} {p.unit || 'un.'}</span>
                              </div>

                              {/* Stock en mi local */}
                              <div className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-bold flex items-center gap-1">
                                <span className="text-[10px] text-slate-400">En Mi Local:</span>
                                <span className="font-black">{dStock} {p.unit || 'un.'}</span>
                              </div>

                              {hasSourceStock ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAddItem(p);
                                  }}
                                  className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[11px] shadow-2xs transition active:scale-95 cursor-pointer"
                                >
                                  + Solicitar
                                </button>
                              ) : (
                                <span className="px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-400 font-bold text-[10px] select-none">
                                  Sin Stock en Origen
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}

                {/* Lista de productos agregados al traspaso con comparación de ambos stocks */}
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-100 dark:bg-slate-800 font-black text-slate-700 dark:text-slate-200">
                      <tr>
                        <th className="p-3">Código</th>
                        <th className="p-3">Producto</th>
                        <th className="p-3 text-center">Stock en {sourceBranch?.name || 'Origen'} (Entrega)</th>
                        <th className="p-3 text-center">Stock en Mi Local ({destBranch?.name || 'Destino'})</th>
                        <th className="p-3 text-center">Cantidad a Solicitar</th>
                        <th className="p-3 text-center">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                      {itemsToTransfer.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-6 text-center text-slate-400">
                            No ha seleccionado productos aún. Busque y agregue productos arriba para comparar stocks.
                          </td>
                        </tr>
                      ) : (
                        itemsToTransfer.map(item => {
                          const remainingInSource = Math.max(0, item.sourceStock - item.quantity);
                          const willLeaveEmpty = remainingInSource === 0;

                          return (
                            <tr key={item.productId} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                              <td className="p-3 font-mono text-slate-400 font-bold">{item.code}</td>
                              <td className="p-3 font-black text-slate-800 dark:text-slate-200">{item.name}</td>

                              {/* Stock en sucursal que entrega */}
                              <td className="p-3 text-center">
                                <span className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 font-black text-blue-700 dark:text-blue-300">
                                  {item.sourceStock} {item.unit}
                                </span>
                              </td>

                              {/* Stock actual en mi local */}
                              <td className="p-3 text-center">
                                <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-slate-700 dark:text-slate-300">
                                  {item.destStock} {item.unit}
                                </span>
                              </td>

                              {/* Cantidad con control y alerta para no dejar sin stock al origen */}
                              <td className="p-3 text-center">
                                <div className="inline-flex flex-col items-center gap-1">
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="number"
                                      min={1}
                                      max={item.sourceStock}
                                      value={item.quantity}
                                      onChange={e => handleUpdateQty(item.productId, Number(e.target.value))}
                                      className="w-20 p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-center font-black text-xs"
                                    />
                                    <span className="text-[11px] text-slate-500 font-bold">{item.unit}</span>
                                  </div>

                                  {/* Aviso si deja sin stock o stock restante */}
                                  {willLeaveEmpty ? (
                                    <span className="text-[10px] font-black text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-1.5 py-0.5 rounded border border-rose-200 dark:border-rose-900">
                                      ⚠️ Dejará en 0 el origen
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                      Le quedarán: {remainingInSource} {item.unit}
                                    </span>
                                  )}
                                </div>
                              </td>

                              <td className="p-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveItem(item.productId)}
                                  className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer transition"
                                  title="Quitar producto"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })
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
                  <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Patente Vehículo de Carga</label>
                  <input
                    type="text"
                    value={vehiclePlate}
                    onChange={e => setVehiclePlate(e.target.value.toUpperCase())}
                    placeholder="Ej: BB-CL-42"
                    className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Observaciones / Motivo</label>
                  <input
                    type="text"
                    value={transferNotes}
                    onChange={e => setTransferNotes(e.target.value)}
                    placeholder="Ej: Reposición fin de semana"
                    className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isProcessing || itemsToTransfer.length === 0}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-black text-xs flex items-center gap-2 shadow-md cursor-pointer transition active:scale-95"
                >
                  <Truck className="w-4 h-4" />
                  <span>{isProcessing ? 'Procesando Despacho...' : 'Despachar y Emitir Guía de Despacho'}</span>
                </button>
              </div>
            </form>
          )}

          {/* 2. HISTORIAL & RECEPCIÓN */}
          {activeTab === 'HISTORY' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-black text-sm text-slate-800 dark:text-slate-200">
                  Historial de Traspasos ({transfers.length})
                </h4>
                <span className="text-xs text-slate-500">
                  Confirme la recepción para ingresar el stock físico a la sucursal de destino
                </span>
              </div>

              {transfers.length === 0 ? (
                <div className="p-8 text-center text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                  No se han registrado traspasos inter-sucursal aún.
                </div>
              ) : (
                <div className="space-y-3">
                  {transfers.map(t => {
                    const isDispatched = t.status === 'DESPACHADO';
                    return (
                      <div
                        key={t.id || t.transferFolio}
                        className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="font-black text-sm">{t.transferFolio}</span>
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 ${
                              isDispatched
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
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
                            {t.items.length} ítems • Despacho: <strong>{t.deliveryGuideFolio || 'S/N'}</strong>
                            {t.receptionGuideFolio && (
                              <span> • Recepción: <strong>{t.receptionGuideFolio}</strong></span>
                            )}
                            {t.notes && <span> • "{t.notes}"</span>}
                          </p>
                        </div>

                        {/* Botón de Recepción */}
                        {isDispatched && (
                          <button
                            type="button"
                            onClick={() => handleReceiveTransfer(t)}
                            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center gap-1.5 shadow-xs cursor-pointer whitespace-nowrap"
                          >
                            <Check className="w-4 h-4" />
                            <span>Confirmar Recepción de Stock</span>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 3. CONSULTA DE STOCK CRUZADO */}
          {activeTab === 'STOCK_LOOKUP' && (
            <div className="space-y-4">
              <div className="relative w-full sm:w-96">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar producto por nombre o código..."
                  value={lookupQuery}
                  onChange={e => setLookupQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs"
                />
              </div>

              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 dark:bg-slate-800 font-black text-slate-600 dark:text-slate-300">
                    <tr>
                      <th className="p-3">Código</th>
                      <th className="p-3">Producto</th>
                      {branches.map(b => (
                        <th key={b.id} className="p-3 text-center">{b.name}</th>
                      ))}
                      <th className="p-3 text-right">Total Cadena</th>
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
                      .map(p => (
                        <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="p-3 font-mono text-slate-400 font-bold">{p.code}</td>
                          <td className="p-3 font-black text-slate-800 dark:text-slate-200">{p.name}</td>
                          {branches.map(b => {
                            const bStock = getProductBranchStock(p, b.id, branches);
                            return (
                              <td key={b.id} className="p-3 text-center">
                                <span className={`px-2 py-0.5 rounded-md font-black ${
                                  bStock <= 5 
                                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300' 
                                    : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                }`}>
                                  {bStock} {p.unit || 'un.'}
                                </span>
                              </td>
                            );
                          })}
                          <td className="p-3 text-right font-black text-indigo-600 dark:text-indigo-400">
                            {p.stock || 0} {p.unit || 'un.'}
                          </td>
                        </tr>
                      ))}
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
