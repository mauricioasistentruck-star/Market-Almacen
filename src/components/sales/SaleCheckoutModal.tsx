import React, { useState, useEffect } from 'react';
import { useTheme } from '../../utils/themeContext';
import { useCompany } from '../../utils/companyContext';
import { useAuth } from '../../utils/authContext';
import { db } from '../../db/database';
import type { Sale, SaleItem, PaymentMethod, DTEType, SiiConfig } from '../../types';
import { formatCLP, formatRut, getDteLabel, getPaymentMethodLabel } from '../../utils/salesPdfGenerator';
import confetti from 'canvas-confetti';
import {
  CreditCard,
  Banknote,
  Building,
  FileText,
  Receipt,
  User,
  ArrowRight,
  X,
  CheckCircle2,
  AlertTriangle,
  Calculator,
  QrCode,
  Sparkles,
  Percent
} from 'lucide-react';

interface SaleCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: SaleItem[];
  onSaleCompleted: (sale: Sale) => void;
}

export const SaleCheckoutModal: React.FC<SaleCheckoutModalProps> = ({
  isOpen,
  onClose,
  cartItems,
  onSaleCompleted
}) => {
  const { themeClasses } = useTheme();
  const { selectedCompanyId, selectedCompany } = useCompany();
  const { currentUser } = useAuth();

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('EFECTIVO');
  const [dteType, setDteType] = useState<DTEType>('BOLETA_ELECTRONICA');
  const [paymentReference, setPaymentReference] = useState('');
  const [amountPaid, setAmountPaid] = useState<number>(0);
  const [discountPercent, setDiscountPercent] = useState<number>(0);

  // Cliente info
  const [customerRut, setCustomerRut] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerBusiness, setCustomerBusiness] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerCity, setCustomerCity] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [notes, setNotes] = useState('');

  const [siiConfig, setSiiConfig] = useState<SiiConfig | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Calculate totals
  const rawTotal = cartItems.reduce((acc, item) => acc + item.subtotal, 0);
  const discountAmount = Math.round(rawTotal * (discountPercent / 100));
  const finalTotal = Math.max(0, rawTotal - discountAmount);

  // En Chile, si es con IVA incluido:
  // Neto = Total / 1.19, IVA = Total - Neto
  const subtotalNeto = Math.round(finalTotal / 1.19);
  const iva = finalTotal - subtotalNeto;

  const cashChange = paymentMethod === 'EFECTIVO' ? Math.max(0, (amountPaid || 0) - finalTotal) : 0;

  useEffect(() => {
    if (!isOpen) return;
    setAmountPaid(finalTotal);
    setPaymentReference('');
    setErrorMessage('');

    const loadConfig = async () => {
      const config = await db.siiConfigs.where('companyId').equals(selectedCompanyId).first();
      if (config) {
        setSiiConfig(config);
      }
    };
    loadConfig();
  }, [isOpen, selectedCompanyId, finalTotal]);

  if (!isOpen) return null;

  const handleQuickCash = (amount: number) => {
    setAmountPaid(amount);
  };

  const handleProcessSale = async () => {
    if (cartItems.length === 0) {
      setErrorMessage('El carrito de compras está vacío.');
      return;
    }

    if (dteType === 'FACTURA_ELECTRONICA') {
      if (!customerRut.trim() || !customerName.trim() || !customerBusiness.trim()) {
        setErrorMessage('Para emitir Factura Electrónica es obligatorio ingresar RUT, Razón Social y Giro.');
        return;
      }
    }

    if (paymentMethod === 'EFECTIVO' && amountPaid < finalTotal) {
      setErrorMessage('El monto pagado en efectivo no puede ser menor al total.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage('');

    try {
      // 1. Obtener siguiente folio correlativo
      let dteFolioNumber = 1;
      let nextField: 'nextBoletaFolio' | 'nextFacturaFolio' | 'nextExentaFolio' = 'nextBoletaFolio';

      if (dteType === 'FACTURA_ELECTRONICA') nextField = 'nextFacturaFolio';
      else if (dteType === 'BOLETA_EXENTA' || dteType === 'FACTURA_EXENTA') nextField = 'nextExentaFolio';

      // Comprobar si hay una venta previa anulada para reutilizar su correlativo de inmediato
      const allSalesForComp = await db.sales
        .where('companyId').equals(selectedCompanyId || 'ALL')
        .toArray();

      // Buscar si la última venta fue anulada con el mismo tipo de DTE para reutilizar su número
      const lastAnnullSale = allSalesForComp
        .filter(s => s.status === 'ANULADA' && s.dteType === dteType)
        .sort((a, b) => (b.id || 0) - (a.id || 0))[0];

      if (lastAnnullSale && lastAnnullSale.dteFolio) {
        dteFolioNumber = parseInt(lastAnnullSale.dteFolio) || 1;
        // Eliminar el registro nulo anterior para que el correlativo quede limpio y reutilizado en la nueva boleta
        await db.sales.delete(lastAnnullSale.id!);
      } else if (siiConfig) {
        dteFolioNumber = siiConfig[nextField] || 1;
        // Actualizar correlativo en BD
        await db.siiConfigs.update(siiConfig.id!, {
          [nextField]: dteFolioNumber + 1,
          updatedAt: new Date().toISOString()
        });
      } else {
        const activeSalesCount = allSalesForComp.filter(s => s.status !== 'ANULADA').length;
        dteFolioNumber = activeSalesCount + 1;
      }

      const folioPrefix = dteType === 'FACTURA_ELECTRONICA' ? 'FAC' : dteType === 'BOLETA_ELECTRONICA' ? 'BOL' : 'TKT';
      const formattedFolio = `${folioPrefix}-${String(dteFolioNumber).padStart(6, '0')}`;

      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10);
      const timeStr = now.toTimeString().slice(0, 8);

      const newSale: Sale = {
        folio: formattedFolio,
        date: dateStr,
        time: timeStr,
        companyId: selectedCompanyId || 'ALL',
        companyName: selectedCompany?.name || 'General',
        customerRut: customerRut.trim() || undefined,
        customerName: customerName.trim() || (dteType === 'FACTURA_ELECTRONICA' ? 'Empresa' : 'Consumidor Final'),
        customerBusiness: customerBusiness.trim() || undefined,
        customerAddress: customerAddress.trim() || undefined,
        customerCity: customerCity.trim() || undefined,
        customerEmail: customerEmail.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        items: cartItems,
        subtotalNeto,
        iva,
        total: finalTotal,
        discountTotal: discountAmount,
        paymentMethod,
        paymentReference: paymentReference.trim() || undefined,
        amountPaid: paymentMethod === 'EFECTIVO' ? amountPaid : finalTotal,
        cashChange: paymentMethod === 'EFECTIVO' ? cashChange : 0,
        dteType,
        dteFolio: String(dteFolioNumber),
        siiStatus: siiConfig?.environment === 'PRODUCCION' ? 'EMITIDO' : 'SIMULADO',
        siiResolution: `Res. Ex. SII N° ${siiConfig?.resolucionNumero || '80'} de ${siiConfig?.resolucionFecha?.slice(0, 4) || '2014'}`,
        sellerName: currentUser?.name || 'Cajero Principal',
        sellerUser: currentUser?.username || 'admin',
        status: 'COMPLETADA',
        notes: notes.trim() || undefined,
        createdAt: now.toISOString()
      };

      // 2. Guardar en Base de Datos de Ventas
      const saleId = await db.sales.add(newSale);
      newSale.id = saleId;

      // 3. Descontar Stock de Productos en Bodega y Registrar Movimiento
      for (const item of cartItems) {
        if (item.productId) {
          const prod = await db.products.get(item.productId);
          if (prod) {
            const newStock = Math.max(0, (prod.stock || 0) - item.quantity);
            await db.products.update(prod.id!, {
              stock: newStock,
              updatedAt: now.toISOString()
            });

            // Registrar movimiento de salida por venta
            await db.productMovements.add({
              productId: prod.id!,
              productCode: prod.code,
              productName: prod.name,
              type: 'SALIDA',
              quantity: item.quantity,
              previousStock: prod.stock || 0,
              newStock: newStock,
              reason: `Venta POS - ${formattedFolio} (${getDteLabel(dteType)})`,
              referenceDoc: formattedFolio,
              workerOrSupplier: newSale.customerName || 'Cliente Final',
              user: currentUser?.name || 'Caja',
              date: dateStr,
              responsibleName: currentUser?.name || 'Caja',
              companyId: selectedCompanyId
            });
          }
        }
      }

      // 4. Efecto de éxito
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });
      } catch (e) {}

      setIsProcessing(false);
      onSaleCompleted(newSale);
      onClose();
    } catch (err: any) {
      console.error('Error al procesar la venta:', err);
      setErrorMessage(err.message || 'Error al procesar la transacción');
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className={`w-full max-w-4xl max-h-[95vh] flex flex-col rounded-3xl border ${themeClasses.border} ${themeClasses.card} shadow-2xl overflow-hidden`}>
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-700/60 flex items-center justify-between bg-slate-900/70">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center text-white shadow-lg shadow-orange-500/30 font-black">
              <Calculator className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-100 flex items-center gap-2">
                <span>Finalizar Cobro y Emisión</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-orange-500/20 text-orange-400 border border-orange-500/30">
                  {cartItems.length} {cartItems.length === 1 ? 'ítem' : 'ítems'}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Selecciona el medio de pago y el tipo de documento tributario
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto max-h-[calc(95vh-140px)] grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Columna Izquierda: Opciones de Pago y Documento */}
          <div className="lg:col-span-7 space-y-5">
            
            {/* 1. Selección de Documento Tributario */}
            <div className="space-y-2">
              <label className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-orange-400" />
                <span>1. Tipo de Documento Tributario (SII)</span>
              </label>

              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={() => setDteType('BOLETA_ELECTRONICA')}
                  className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between ${
                    dteType === 'BOLETA_ELECTRONICA'
                      ? 'bg-orange-500/15 border-orange-500 text-orange-300 shadow-md ring-1 ring-orange-500'
                      : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Receipt className="w-5 h-5 mb-1 text-orange-400" />
                  <span className="text-xs font-black">Boleta Electrónica</span>
                  <span className="text-[10px] text-slate-400">Consumidor final</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDteType('FACTURA_ELECTRONICA')}
                  className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between ${
                    dteType === 'FACTURA_ELECTRONICA'
                      ? 'bg-blue-500/15 border-blue-500 text-blue-300 shadow-md ring-1 ring-blue-500'
                      : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Building className="w-5 h-5 mb-1 text-blue-400" />
                  <span className="text-xs font-black">Factura Electrónica</span>
                  <span className="text-[10px] text-slate-400">Crédito Fiscal IVA</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDteType('TICKET_INTERNO')}
                  className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between ${
                    dteType === 'TICKET_INTERNO'
                      ? 'bg-purple-500/15 border-purple-500 text-purple-300 shadow-md ring-1 ring-purple-500'
                      : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <QrCode className="w-5 h-5 mb-1 text-purple-400" />
                  <span className="text-xs font-black">Ticket Interno</span>
                  <span className="text-[10px] text-slate-400">Comprobante</span>
                </button>
              </div>
            </div>

            {/* 2. Medios de Pago */}
            <div className="space-y-2">
              <label className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                <Banknote className="w-4 h-4 text-emerald-400" />
                <span>2. Medio de Pago</span>
              </label>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('EFECTIVO')}
                  className={`p-3 rounded-2xl border text-center transition flex flex-col items-center gap-1 ${
                    paymentMethod === 'EFECTIVO'
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-md ring-1 ring-emerald-500'
                      : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Banknote className="w-5 h-5 text-emerald-400" />
                  <span className="text-xs font-black">Efectivo</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('DEBITO')}
                  className={`p-3 rounded-2xl border text-center transition flex flex-col items-center gap-1 ${
                    paymentMethod === 'DEBITO'
                      ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 shadow-md ring-1 ring-cyan-500'
                      : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <CreditCard className="w-5 h-5 text-cyan-400" />
                  <span className="text-xs font-black">Débito (POS)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('CREDITO')}
                  className={`p-3 rounded-2xl border text-center transition flex flex-col items-center gap-1 ${
                    paymentMethod === 'CREDITO'
                      ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300 shadow-md ring-1 ring-indigo-500'
                      : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <CreditCard className="w-5 h-5 text-indigo-400" />
                  <span className="text-xs font-black">Crédito</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('TRANSFERENCIA')}
                  className={`p-3 rounded-2xl border text-center transition flex flex-col items-center gap-1 ${
                    paymentMethod === 'TRANSFERENCIA'
                      ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-md ring-1 ring-amber-500'
                      : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Building className="w-5 h-5 text-amber-400" />
                  <span className="text-xs font-black">Transferencia</span>
                </button>
              </div>

              {/* Panel Específico de Efectivo / Vuelto */}
              {paymentMethod === 'EFECTIVO' && (
                <div className="p-3.5 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-emerald-300">Monto Entregado por Cliente:</label>
                    <span className="text-xs font-mono font-bold text-slate-400">Total: {formatCLP(finalTotal)}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-lg font-black text-emerald-400">$</span>
                    <input
                      type="number"
                      min={finalTotal}
                      value={amountPaid || ''}
                      onChange={(e) => setAmountPaid(parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-emerald-500/40 text-emerald-300 font-mono font-black text-lg focus:outline-none focus:border-emerald-400"
                      placeholder="Ingrese monto recibido"
                    />
                  </div>

                  {/* Botones de montos rápidos */}
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleQuickCash(finalTotal)}
                      className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-bold border border-emerald-500/40 transition"
                    >
                      Exacto ({formatCLP(finalTotal)})
                    </button>
                    {[10000, 20000, 50000, 100000].filter(m => m >= finalTotal).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => handleQuickCash(m)}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition"
                      >
                        {formatCLP(m)}
                      </button>
                    ))}
                  </div>

                  {/* Vuelto a Entregar */}
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-300">VUELTO A ENTREGAR:</span>
                    <span className="text-base font-black text-emerald-400 font-mono">
                      {formatCLP(cashChange)}
                    </span>
                  </div>
                </div>
              )}

              {/* Referencia o N° de Voucher para Tarjetas / Transferencia */}
              {paymentMethod !== 'EFECTIVO' && (
                <div className="p-3 rounded-2xl bg-slate-800/40 border border-slate-700/60">
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    {paymentMethod === 'TRANSFERENCIA' ? 'N° Comprobante / Transf. Bancaria' : 'N° Voucher / Cód. Autorización POS'}
                  </label>
                  <input
                    type="text"
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                    placeholder="Ej: AUT-984210"
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs font-mono focus:border-orange-500 focus:outline-none"
                  />
                </div>
              )}
            </div>

            {/* 3. Datos del Cliente / Empresa Receptor */}
            <div className="space-y-2">
              <label className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                <User className="w-4 h-4 text-blue-400" />
                <span>3. Datos del Cliente {dteType === 'FACTURA_ELECTRONICA' && <span className="text-red-400">* Requerido para Factura</span>}</span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10px] font-bold text-slate-300 mb-1">RUT {dteType === 'FACTURA_ELECTRONICA' && '*'}</label>
                  <input
                    type="text"
                    value={customerRut}
                    onChange={(e) => setCustomerRut(e.target.value)}
                    placeholder="Ej: 76.890.123-4"
                    className="w-full px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 text-xs font-mono focus:border-orange-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-300 mb-1">Nombre / Razón Social {dteType === 'FACTURA_ELECTRONICA' && '*'}</label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Nombre del cliente o empresa"
                    className="w-full px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 text-xs focus:border-orange-500 focus:outline-none"
                  />
                </div>
              </div>

              {dteType === 'FACTURA_ELECTRONICA' && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-300 mb-1">Giro Comercial *</label>
                    <input
                      type="text"
                      value={customerBusiness}
                      onChange={(e) => setCustomerBusiness(e.target.value)}
                      placeholder="Transporte / Servicios"
                      className="w-full px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 text-xs focus:border-orange-500 focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-300 mb-1">Dirección</label>
                    <input
                      type="text"
                      value={customerAddress}
                      onChange={(e) => setCustomerAddress(e.target.value)}
                      placeholder="Av. Providencia 400"
                      className="w-full px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 text-xs focus:border-orange-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-300 mb-1">Comuna / Ciudad</label>
                    <input
                      type="text"
                      value={customerCity}
                      onChange={(e) => setCustomerCity(e.target.value)}
                      placeholder="Santiago"
                      className="w-full px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 text-xs focus:border-orange-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* Columna Derecha: Resumen de Carrito y Totales */}
          <div className="lg:col-span-5 flex flex-col justify-between p-4 rounded-3xl bg-slate-950/60 border border-slate-800 space-y-4">
            
            <div className="space-y-3">
              <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center justify-between">
                <span>Resumen de Venta</span>
                <span className="text-[11px] font-mono text-orange-400">{cartItems.length} ítems</span>
              </h3>

              {/* Lista scrollable de ítems */}
              <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                {cartItems.map((item, idx) => (
                  <div key={idx} className="p-2 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
                    <div className="min-w-0 flex-1 pr-2">
                      <p className="font-bold text-slate-200 truncate">{item.productName}</p>
                      <p className="text-[10px] text-slate-400 font-mono">{item.quantity} x {formatCLP(item.unitPrice)}</p>
                    </div>
                    <span className="font-black text-slate-100 font-mono">{formatCLP(item.subtotal)}</span>
                  </div>
                ))}
              </div>

              {/* Descuento Global */}
              <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 flex items-center gap-1">
                  <Percent className="w-3.5 h-3.5 text-amber-400" />
                  <span>Descuento Promocional:</span>
                </span>
                <div className="flex items-center gap-1">
                  {[0, 5, 10, 15].map(pct => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setDiscountPercent(pct)}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-black transition ${
                        discountPercent === pct
                          ? 'bg-amber-500 text-slate-950 shadow-sm'
                          : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Desglose Tributario */}
              <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Monto Neto:</span>
                  <span className="font-mono font-bold text-slate-300">{formatCLP(subtotalNeto)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>I.V.A. (19%):</span>
                  <span className="font-mono font-bold text-slate-300">{formatCLP(iva)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-400">
                    <span>Descuento ({discountPercent}%):</span>
                    <span className="font-mono font-bold">-{formatCLP(discountAmount)}</span>
                  </div>
                )}
                <div className="pt-2 border-t border-slate-800 flex justify-between items-baseline">
                  <span className="text-sm font-black text-slate-100">TOTAL A COBRAR:</span>
                  <span className="text-xl font-black text-orange-400 font-mono">{formatCLP(finalTotal)}</span>
                </div>
              </div>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Acciones de Cobro */}
            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={handleProcessSale}
                disabled={isProcessing || cartItems.length === 0}
                className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-black text-sm shadow-xl shadow-emerald-500/25 flex items-center justify-center gap-2 transition active:scale-95 disabled:opacity-50"
              >
                {isProcessing ? (
                  <span>Emitiendo DTE y Procesando...</span>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    <span>Confirmar Venta y Emitir DTE</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={onClose}
                className="w-full py-2 text-xs font-bold text-slate-400 hover:text-slate-200 transition text-center"
              >
                Volver al Carrito
              </button>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
};
