import React, { useState, useEffect, useMemo } from 'react';
import { useTheme } from '../../utils/themeContext';
import { useCompany } from '../../utils/companyContext';
import { useAuth } from '../../utils/authContext';
import { db } from '../../db/database';
import type { Sale, SaleItem, PaymentMethod, DTEType, SiiConfig } from '../../types';
import {
  applyChileanRounding,
  getChileanCashShortcuts,
  getChileLocalDateString,
  formatChileTime
} from '../../utils/chileanCurrencyAndDates';
import { formatCLP, formatRut, getDteLabel } from '../../utils/salesPdfGenerator';
import confetti from 'canvas-confetti';
import {
  Calculator,
  Receipt,
  Building,
  QrCode,
  Banknote,
  CreditCard,
  Building2,
  CheckCircle2,
  Trash2,
  MessageSquare,
  AlertCircle,
  Loader2,
  Percent
} from 'lucide-react';

interface WebCheckoutBoardProps {
  cart: SaleItem[];
  onSaleCompleted: (sale: Sale) => void;
  onClearCart: () => void;
  isReadOnly?: boolean;
}

export const WebCheckoutBoard: React.FC<WebCheckoutBoardProps> = ({
  cart,
  onSaleCompleted,
  onClearCart,
  isReadOnly = false
}) => {
  const { theme } = useTheme();
  const { selectedCompanyId, selectedCompany } = useCompany();
  const { currentUser } = useAuth();

  // Estados de cobro
  const [dteType, setDteType] = useState<DTEType>('BOLETA_ELECTRONICA');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('EFECTIVO');
  const [amountPaid, setAmountPaid] = useState<number>(0);
  const [discountPercent, setDiscountPercent] = useState<number>(0);

  // Datos del cliente
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerRut, setCustomerRut] = useState('');
  const [customerBusiness, setCustomerBusiness] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');

  // Proceso
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [siiConfig, setSiiConfig] = useState<SiiConfig | null>(null);

  // Cargar configuración SII de la empresa activa
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const config = await db.siiConfigs.where('companyId').equals(selectedCompanyId).first();
        if (config) {
          setSiiConfig(config);
        }
      } catch (e) {
        console.error('Error cargando config SII:', e);
      }
    };
    loadConfig();
  }, [selectedCompanyId]);

  // Cálculos del Carrito
  const rawSubtotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.subtotal, 0);
  }, [cart]);

  // Descuento Promocional
  const discountAmount = useMemo(() => {
    if (discountPercent <= 0) return 0;
    return Math.round((rawSubtotal * discountPercent) / 100);
  }, [rawSubtotal, discountPercent]);

  const finalTotal = Math.max(0, rawSubtotal - discountAmount);

  // Ley de Redondeo en Efectivo (Chile)
  const rounding = useMemo(() => {
    return applyChileanRounding(finalTotal, paymentMethod);
  }, [finalTotal, paymentMethod]);

  const cashRoundedTotal = rounding.roundedAmount;
  const roundingDifference = rounding.roundingDifference;

  // Monto Neto e IVA (19% en Chile)
  const subtotalNeto = Math.round(finalTotal / 1.19);
  const iva = finalTotal - subtotalNeto;

  // Vuelto a entregar
  const cashChange = useMemo(() => {
    if (paymentMethod !== 'EFECTIVO') return 0;
    return Math.max(0, (amountPaid || 0) - cashRoundedTotal);
  }, [paymentMethod, amountPaid, cashRoundedTotal]);

  // Accesos directos de billetes en efectivo
  const cashShortcuts = useMemo(() => {
    if (cashRoundedTotal <= 0) return [];
    return getChileanCashShortcuts(cashRoundedTotal);
  }, [cashRoundedTotal]);

  // Resetear o actualizar monto pagado cuando cambia el total o medio de pago
  useEffect(() => {
    if (paymentMethod === 'EFECTIVO') {
      setAmountPaid(cashRoundedTotal);
    } else {
      setAmountPaid(finalTotal);
    }
    setErrorMessage('');
  }, [finalTotal, cashRoundedTotal, paymentMethod]);

  // Autocompletar cliente al tipear o buscar RUT
  const handleRutBlur = async () => {
    const clean = customerRut.replace(/[^0-9kK]/g, '').toUpperCase();
    if (clean.length >= 7) {
      try {
        const allCust = await db.customers.toArray();
        const match = allCust.find(c => c.rut.replace(/[^0-9kK]/g, '').toUpperCase() === clean);
        if (match) {
          setCustomerName(match.businessName || match.tradeName || '');
          if (match.phone) setCustomerPhone(match.phone);
          if (match.email) setCustomerEmail(match.email);
          if (match.industry) setCustomerBusiness(match.industry);
          if (match.address) setCustomerAddress(match.address);
        }
      } catch (err) {
        console.error('Error buscando cliente por RUT:', err);
      }
    }
  };

  // Confirmar Venta y Emitir DTE
  const handleConfirmSale = async () => {
    if (cart.length === 0) {
      setErrorMessage('El listado de compra está vacío. Agregue productos antes de cobrar.');
      return;
    }

    if (dteType === 'FACTURA_ELECTRONICA') {
      if (!customerRut.trim() || !customerName.trim()) {
        setErrorMessage('Para emitir Factura Electrónica es obligatorio ingresar el RUT y la Razón Social.');
        return;
      }
    }

    if (paymentMethod === 'EFECTIVO' && amountPaid < cashRoundedTotal) {
      setErrorMessage(`El monto recibido en efectivo no puede ser menor al total (${formatCLP(cashRoundedTotal)}).`);
      return;
    }

    setIsProcessing(true);
    setErrorMessage('');

    try {
      // 1. Obtener correlativo
      let dteFolioNumber = 1;
      let nextField: 'nextBoletaFolio' | 'nextFacturaFolio' | 'nextExentaFolio' = 'nextBoletaFolio';

      if (dteType === 'FACTURA_ELECTRONICA') nextField = 'nextFacturaFolio';
      else if (dteType === 'BOLETA_EXENTA' || dteType === 'FACTURA_EXENTA') nextField = 'nextExentaFolio';

      const allSalesForComp = await db.sales
        .where('companyId').equals(selectedCompanyId || 'ALL')
        .toArray();

      const lastAnnullSale = allSalesForComp
        .filter(s => s.status === 'ANULADA' && s.dteType === dteType)
        .sort((a, b) => (b.id || 0) - (a.id || 0))[0];

      if (lastAnnullSale && lastAnnullSale.dteFolio) {
        dteFolioNumber = parseInt(lastAnnullSale.dteFolio) || 1;
        await db.sales.delete(lastAnnullSale.id!);
      } else if (siiConfig) {
        dteFolioNumber = siiConfig[nextField] || 1;
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
      const dateStr = getChileLocalDateString(now);
      const timeStr = formatChileTime(now, true);

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
        customerEmail: customerEmail.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        items: cart,
        subtotalNeto,
        iva,
        total: finalTotal,
        discountTotal: discountAmount,
        paymentMethod,
        amountPaid: paymentMethod === 'EFECTIVO' ? amountPaid : finalTotal,
        cashChange: paymentMethod === 'EFECTIVO' ? cashChange : 0,
        roundingDifference: paymentMethod === 'EFECTIVO' ? roundingDifference : 0,
        cashRoundedTotal: paymentMethod === 'EFECTIVO' ? cashRoundedTotal : finalTotal,
        dteType,
        dteFolio: String(dteFolioNumber),
        siiStatus: siiConfig?.environment === 'PRODUCCION' ? 'EMITIDO' : 'SIMULADO',
        siiResolution: `Res. Ex. SII N° ${siiConfig?.resolucionNumero || '80'} de ${siiConfig?.resolucionFecha?.slice(0, 4) || '2014'}`,
        sellerName: currentUser?.name || 'Cajero Principal',
        sellerUser: currentUser?.username || 'admin',
        status: 'COMPLETADA',
        createdAt: now.toISOString()
      };

      // 2. Guardar en Base de Datos de Ventas
      const saleId = await db.sales.add(newSale);
      newSale.id = saleId;

      // 2.1 Autoguardar cliente de Factura en db.customers
      if (dteType === 'FACTURA_ELECTRONICA' && customerRut.trim() && customerName.trim()) {
        try {
          const clean = customerRut.replace(/[^0-9kK]/g, '').toUpperCase();
          const allC = await db.customers.toArray();
          const existing = allC.find(c => c.rut.replace(/[^0-9kK]/g, '').toUpperCase() === clean);
          if (existing && existing.id) {
            await db.customers.update(existing.id, {
              businessName: customerName.trim().toUpperCase(),
              industry: customerBusiness.trim() || undefined,
              address: customerAddress.trim() || undefined,
              email: customerEmail.trim().toLowerCase() || undefined,
              phone: customerPhone.trim() || undefined,
              updatedAt: now.toISOString()
            });
          } else {
            await db.customers.add({
              rut: formatRut(customerRut.trim()),
              businessName: customerName.trim().toUpperCase(),
              industry: customerBusiness.trim() || 'Comercial',
              address: customerAddress.trim() || 'S/D',
              email: customerEmail.trim().toLowerCase() || undefined,
              phone: customerPhone.trim() || undefined,
              companyId: selectedCompanyId !== 'ALL' ? selectedCompanyId : undefined,
              createdAt: now.toISOString()
            });
          }
        } catch (cErr) {
          console.error('Error autoguardando cliente de factura:', cErr);
        }
      }

      // 3. Descontar Stock de Productos en Bodega y Registrar Movimiento
      for (const item of cart) {
        if (item.productId) {
          const prod = await db.products.get(item.productId);
          if (prod) {
            const newStock = Math.max(0, (prod.stock || 0) - item.quantity);
            const updateFields: any = {
              stock: newStock,
              updatedAt: now.toISOString()
            };

            if (item.isOffer && prod.offerPrice) {
              const currentOfferRem = prod.offerStockRemaining !== undefined 
                ? prod.offerStockRemaining 
                : (prod.offerStockLimit || prod.stock || 0);
              const newOfferRem = Math.max(0, currentOfferRem - item.quantity);

              if (newOfferRem <= 0 || newStock <= 0) {
                updateFields.offerPrice = undefined;
                updateFields.offerStockLimit = undefined;
                updateFields.offerStockRemaining = 0;
                updateFields.offerLabel = undefined;
                if (prod.condition === 'LIQUIDACION' || prod.condition === 'OFERTA') {
                  updateFields.condition = 'DISPONIBLE';
                }
              } else {
                updateFields.offerStockRemaining = newOfferRem;
              }
            } else if (newStock < (prod.offerStockRemaining || 0)) {
              updateFields.offerStockRemaining = newStock;
              if (newStock <= 0) {
                updateFields.offerPrice = undefined;
                updateFields.offerStockLimit = undefined;
                updateFields.offerStockRemaining = 0;
                updateFields.offerLabel = undefined;
                if (prod.condition === 'LIQUIDACION' || prod.condition === 'OFERTA') {
                  updateFields.condition = 'DISPONIBLE';
                }
              }
            }

            await db.products.update(prod.id!, updateFields);

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

      // 4. Confetti festivo
      try {
        confetti({
          particleCount: 75,
          spread: 60,
          origin: { y: 0.6 }
        });
      } catch (e) {}

      setIsProcessing(false);
      onSaleCompleted(newSale);
    } catch (err: any) {
      console.error('Error al procesar la venta en web:', err);
      setErrorMessage(err.message || 'Error al procesar la venta');
      setIsProcessing(false);
    }
  };

  const isWhite = theme === 'white';
  const isDarkRed = theme === 'dark-red';
  const isBlueGreen = theme === 'blue-green';

  const containerBg = isWhite
    ? 'bg-white border-slate-300 shadow-xl text-slate-900'
    : isDarkRed
    ? 'bg-[#12141c] border-zinc-800 shadow-2xl text-slate-100'
    : 'bg-[#0d1b3d] border-[#1c3366] shadow-2xl text-slate-100';

  const summaryCardBg = isWhite
    ? 'bg-[#0f172a] text-white border-slate-800'
    : isDarkRed
    ? 'bg-[#090a0f] text-white border-zinc-800'
    : 'bg-[#081026] text-white border-[#1c3366]';

  const inputClass = isWhite
    ? 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white'
    : isDarkRed
    ? 'bg-[#0c0e14] border-zinc-700 text-slate-100 placeholder:text-slate-500 focus:border-red-500 focus:bg-[#141722]'
    : 'bg-[#09142f] border-[#1c3366] text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:bg-[#0d1e46]';

  const totalColor = isDarkRed ? 'text-red-400' : 'text-amber-400';

  return (
    <div className={`rounded-3xl border-2 ${containerBg} flex flex-col h-full overflow-hidden select-none transition-all`}>
      {/* 1. Header idéntico a Imagen 1 */}
      <div className="px-4 py-3 border-b border-slate-200/80 dark:border-slate-800/80 bg-slate-900 text-white flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500 flex items-center justify-center text-white shadow-xs font-black">
            <Calculator className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black tracking-tight text-white">
                Finalizar Cobro y Emisión
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/90 text-white font-black text-[10.5px]">
                {cart.reduce((a, b) => a + b.quantity, 0)} items
              </span>
            </div>
            <p className="text-[11px] text-slate-300">
              Seleccione el medio de pago y el documento tributario
            </p>
          </div>
        </div>

        {cart.length > 0 && (
          <button
            type="button"
            onClick={onClearCart}
            className="text-xs font-bold text-slate-400 hover:text-red-400 flex items-center gap-1 cursor-pointer transition active:scale-95"
            title="Vaciar Carrito"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Limpiar</span>
          </button>
        )}
      </div>

      {/* 2. Cuerpo del Cuadro de Cobro: 2 Subcolumnas idénticas a Imagen 1 */}
      <div className="p-3 sm:p-3.5 flex-1 min-h-0 overflow-y-auto grid grid-cols-1 xl:grid-cols-12 gap-3 custom-scrollbar">
        
        {/* Subcolumna Izquierda: Documento, Pago, Monto Recibido y Datos Cliente */}
        <div className="xl:col-span-7 flex flex-col gap-3 min-h-0">
          
          {/* Mensaje de Error si ocurre */}
          {errorMessage && (
            <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs font-bold flex items-center gap-2 animate-fadeIn shrink-0">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* 1. TIPO DE DOCUMENTO TRIBUTARIO (SII) */}
          <div className="shrink-0">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-black tracking-wide text-slate-700 dark:text-slate-300 uppercase flex items-center gap-1.5">
                <Receipt className="w-3.5 h-3.5 text-amber-500" />
                1. TIPO DE DOCUMENTO TRIBUTARIO (SII)
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {/* Boleta */}
              <button
                type="button"
                onClick={() => setDteType('BOLETA_ELECTRONICA')}
                className={`p-2 sm:p-2.5 rounded-2xl border-2 text-left transition cursor-pointer active:scale-98 flex items-center gap-2 ${
                  dteType === 'BOLETA_ELECTRONICA'
                    ? isDarkRed
                      ? 'border-red-500 bg-red-950/40 text-red-300 shadow-xs'
                      : isBlueGreen
                      ? 'border-emerald-500 bg-emerald-950/40 text-emerald-300 shadow-xs'
                      : 'border-amber-500 bg-amber-50/80 text-amber-950 shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                }`}
              >
                <Receipt className={`w-4 h-4 sm:w-5 sm:h-5 shrink-0 ${dteType === 'BOLETA_ELECTRONICA' ? 'text-amber-500' : 'text-slate-400'}`} />
                <div className="min-w-0">
                  <p className="text-xs font-black leading-tight truncate">Boleta</p>
                  <p className="text-[9.5px] font-bold opacity-75 truncate">Consumidor</p>
                </div>
              </button>

              {/* Factura */}
              <button
                type="button"
                onClick={() => setDteType('FACTURA_ELECTRONICA')}
                className={`p-2 sm:p-2.5 rounded-2xl border-2 text-left transition cursor-pointer active:scale-98 flex items-center gap-2 ${
                  dteType === 'FACTURA_ELECTRONICA'
                    ? isDarkRed
                      ? 'border-red-500 bg-red-950/40 text-red-300 shadow-xs'
                      : isBlueGreen
                      ? 'border-emerald-500 bg-emerald-950/40 text-emerald-300 shadow-xs'
                      : 'border-blue-600 bg-blue-50/80 text-blue-950 shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                }`}
              >
                <Building className={`w-4 h-4 sm:w-5 sm:h-5 shrink-0 ${dteType === 'FACTURA_ELECTRONICA' ? 'text-blue-600' : 'text-slate-400'}`} />
                <div className="min-w-0">
                  <p className="text-xs font-black leading-tight truncate">Factura</p>
                  <p className="text-[9.5px] font-bold opacity-75 truncate">IVA Crédito</p>
                </div>
              </button>

              {/* Ticket */}
              <button
                type="button"
                onClick={() => setDteType('TICKET_INTERNO')}
                className={`p-2 sm:p-2.5 rounded-2xl border-2 text-left transition cursor-pointer active:scale-98 flex items-center gap-2 ${
                  dteType === 'TICKET_INTERNO'
                    ? isDarkRed
                      ? 'border-red-500 bg-red-950/40 text-red-300 shadow-xs'
                      : isBlueGreen
                      ? 'border-emerald-500 bg-emerald-950/40 text-emerald-300 shadow-xs'
                      : 'border-purple-500 bg-purple-50/80 text-purple-950 shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                }`}
              >
                <QrCode className={`w-4 h-4 sm:w-5 sm:h-5 shrink-0 ${dteType === 'TICKET_INTERNO' ? 'text-purple-600' : 'text-slate-400'}`} />
                <div className="min-w-0">
                  <p className="text-xs font-black leading-tight truncate">Ticket</p>
                  <p className="text-[9.5px] font-bold opacity-75 truncate">Interno</p>
                </div>
              </button>
            </div>
          </div>

          {/* 2. MEDIO DE PAGO */}
          <div className="shrink-0">
            <span className="text-[11px] font-black tracking-wide text-slate-700 dark:text-slate-300 uppercase flex items-center gap-1.5 mb-1.5">
              <Banknote className="w-3.5 h-3.5 text-emerald-500" />
              2. MEDIO DE PAGO
            </span>

            <div className="grid grid-cols-4 gap-1.5">
              {[
                { id: 'EFECTIVO' as PaymentMethod, label: 'Efectivo', icon: Banknote },
                { id: 'DEBITO' as PaymentMethod, label: 'Débito', icon: CreditCard },
                { id: 'CREDITO' as PaymentMethod, label: 'Crédito', icon: CreditCard },
                { id: 'TRANSFERENCIA' as PaymentMethod, label: 'Transf.', icon: Building2 }
              ].map((m) => {
                const isSelected = paymentMethod === m.id;
                const Icon = m.icon;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPaymentMethod(m.id)}
                    className={`py-2 px-1.5 rounded-xl border-2 text-center transition cursor-pointer active:scale-98 flex items-center justify-center gap-1.5 ${
                      isSelected
                        ? isDarkRed
                          ? 'border-red-500 bg-red-950/40 text-red-300 font-black shadow-xs'
                          : isBlueGreen
                          ? 'border-emerald-500 bg-emerald-950/40 text-emerald-300 font-black shadow-xs'
                          : 'border-emerald-600 bg-emerald-50 text-emerald-900 font-black shadow-xs'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-emerald-500' : 'text-slate-400'}`} />
                    <span className="text-xs font-black leading-none">{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* MONTO RECIBIDO DEL CLIENTE Y VUELTO (Solo visible para Efectivo o para cuadrar) */}
          <div className="p-3 rounded-2xl border border-emerald-500/30 bg-emerald-50/40 dark:bg-emerald-950/20 space-y-2 shrink-0">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-black text-emerald-900 dark:text-emerald-300 uppercase tracking-wide">
                MONTO RECIBIDO DEL CLIENTE:
              </label>
              <span className="text-xs font-black font-mono text-emerald-800 dark:text-emerald-300">
                Total: ${cashRoundedTotal.toLocaleString('es-CL')}
              </span>
            </div>

            {/* Input de Monto */}
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-lg font-black text-emerald-700 dark:text-emerald-400 font-mono">
                $
              </span>
              <input
                type="number"
                disabled={paymentMethod !== 'EFECTIVO' || isReadOnly}
                value={amountPaid === 0 ? '' : amountPaid}
                onChange={(e) => setAmountPaid(Number(e.target.value) || 0)}
                placeholder={cashRoundedTotal.toString()}
                className={`w-full pl-8 pr-3 py-2 rounded-xl text-lg sm:text-xl font-mono font-black border-2 border-emerald-500/60 outline-none transition ${
                  isWhite ? 'bg-white text-slate-900' : 'bg-slate-900 text-white'
                }`}
              />
            </div>

            {/* Botones de Efectivo Rápido idénticos a Imagen 1 */}
            {paymentMethod === 'EFECTIVO' && cashShortcuts.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                <button
                  type="button"
                  onClick={() => setAmountPaid(cashRoundedTotal)}
                  className="px-2.5 py-1 rounded-lg border border-emerald-600 bg-emerald-600 text-white text-[11px] font-mono font-black shadow-2xs hover:bg-emerald-700 cursor-pointer active:scale-95 transition"
                >
                  Exacto (${cashRoundedTotal.toLocaleString('es-CL')})
                </button>
                {cashShortcuts.map((sc, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setAmountPaid(sc)}
                    className="px-2.5 py-1 rounded-lg border border-emerald-500/40 bg-white dark:bg-slate-800 text-emerald-800 dark:text-emerald-200 text-[11px] font-mono font-black shadow-2xs hover:bg-emerald-50 dark:hover:bg-slate-700 cursor-pointer active:scale-95 transition"
                  >
                    ${sc.toLocaleString('es-CL')}
                  </button>
                ))}
              </div>
            )}

            {/* Vuelto a Entregar en Barra Verde idéntica a Imagen 1 */}
            <div className="p-2.5 rounded-xl bg-emerald-600 text-white flex items-center justify-between shadow-xs">
              <span className="text-xs font-black tracking-wide flex items-center gap-1.5 uppercase">
                <Banknote className="w-4 h-4" />
                VUELTO A ENTREGAR:
              </span>
              <span className="text-base sm:text-lg font-mono font-black tracking-tight">
                ${cashChange.toLocaleString('es-CL')}
              </span>
            </div>
          </div>

          {/* 3. DATOS DEL CLIENTE */}
          <div className="space-y-1.5 shrink-0">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black tracking-wide text-slate-700 dark:text-slate-300 uppercase">
                3. DATOS DEL CLIENTE
              </span>
              <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase">
                {dteType === 'FACTURA_ELECTRONICA' ? 'OBLIGATORIO PARA FACTURA' : 'OPCIONAL PARA BOLETA'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                disabled={isReadOnly}
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder={dteType === 'FACTURA_ELECTRONICA' ? 'Razón Social (*)' : 'Nombre del Cliente'}
                className={`w-full px-3 py-2 rounded-xl text-xs font-bold border ${inputClass} outline-none transition`}
              />
              <input
                type="text"
                disabled={isReadOnly}
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="WhatsApp (Ej: +56912345678)"
                className={`w-full px-3 py-2 rounded-xl text-xs font-mono font-bold border ${inputClass} outline-none transition`}
              />
              <input
                type="email"
                disabled={isReadOnly}
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="Correo electrónico (opcional)"
                className={`w-full px-3 py-2 rounded-xl text-xs font-bold border ${inputClass} outline-none transition`}
              />
              <input
                type="text"
                disabled={isReadOnly}
                value={customerRut}
                onChange={(e) => setCustomerRut(e.target.value)}
                onBlur={handleRutBlur}
                placeholder={dteType === 'FACTURA_ELECTRONICA' ? 'RUT Empresa (*)' : 'RUT (Opcional)'}
                className={`w-full px-3 py-2 rounded-xl text-xs font-mono font-bold border ${inputClass} outline-none transition`}
              />
            </div>

            {/* Banner de Envío Digital idéntico a Imagen 1 */}
            <div className="px-3 py-2 rounded-xl border border-emerald-500/30 bg-emerald-50/30 dark:bg-emerald-950/20 flex items-center justify-between">
              <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5 truncate">
                <MessageSquare className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                Envío de boleta digital a WhatsApp o Correo
              </span>
              <span className="px-2 py-0.5 rounded-lg bg-emerald-600 text-white font-black text-[9.5px] uppercase shrink-0">
                Envío Digital
              </span>
            </div>
          </div>

        </div>

        {/* Subcolumna Derecha: Resumen de Venta, Totales y Botón de Emisión (Imagen 1) */}
        <div className={`xl:col-span-5 rounded-2xl border p-3 sm:p-3.5 flex flex-col justify-between ${summaryCardBg} shadow-md`}>
          
          <div>
            {/* Header del Resumen */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-700/80 mb-2.5">
              <span className="text-xs font-black tracking-wider uppercase text-amber-400">
                RESUMEN DE VENTA
              </span>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300">
                {cart.length} ÍTEMS
              </span>
            </div>

            {/* Lista compacta de productos que está llevando el cliente */}
            <div className="space-y-2 overflow-y-auto max-h-[160px] xl:max-h-[220px] pr-1 scrollbar-thin mb-3">
              {cart.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6 font-bold">
                  No hay productos en el carrito
                </p>
              ) : (
                cart.map((item, idx) => (
                  <div key={idx} className="flex items-start justify-between gap-2 text-xs border-b border-slate-800/60 pb-1.5">
                    <div className="min-w-0 flex-1">
                      <p className="font-black text-slate-100 truncate leading-tight">
                        {item.productName}
                      </p>
                      <p className="text-[10.5px] font-mono text-slate-400 mt-0.5">
                        {item.quantity} x ${item.unitPrice.toLocaleString('es-CL')}
                        {item.unit ? ` (${item.unit})` : ''}
                      </p>
                    </div>
                    <span className="font-mono font-black text-emerald-400 shrink-0">
                      ${item.subtotal.toLocaleString('es-CL')}
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* % Descuento Promocional */}
            <div className="pt-2 border-t border-slate-800/80 space-y-1.5 mb-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1">
                  <Percent className="w-3 h-3 text-amber-400" />
                  % Descuento Promocional:
                </span>
                <div className="flex items-center gap-1">
                  {[0, 5, 10, 15].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setDiscountPercent(pct)}
                      className={`px-2 py-0.5 rounded-lg text-[10.5px] font-mono font-black transition cursor-pointer active:scale-95 ${
                        discountPercent === pct
                          ? 'bg-amber-500 text-slate-950 shadow-xs'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Desglose Neto e IVA */}
            <div className="space-y-1 text-xs text-slate-300 font-bold mb-3">
              <div className="flex justify-between">
                <span>Monto Neto:</span>
                <span className="font-mono">${subtotalNeto.toLocaleString('es-CL')}</span>
              </div>
              <div className="flex justify-between">
                <span>I.V.A. (19%):</span>
                <span className="font-mono">${iva.toLocaleString('es-CL')}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-amber-400">
                  <span>Descuento ({discountPercent}%):</span>
                  <span className="font-mono">-${discountAmount.toLocaleString('es-CL')}</span>
                </div>
              )}
            </div>
          </div>

          {/* TOTAL A COBRAR Y BOTÓN DE CONFIRMACIÓN */}
          <div className="pt-2.5 border-t border-slate-800 space-y-3 shrink-0">
            <div className="flex items-baseline justify-between">
              <span className="text-xs sm:text-sm font-black tracking-wider uppercase text-slate-300">
                TOTAL A COBRAR:
              </span>
              <span className={`text-2xl sm:text-3xl font-mono font-black tracking-tight ${totalColor}`}>
                ${finalTotal.toLocaleString('es-CL')}
              </span>
            </div>

            {/* Botón Principal: CONFIRMAR VENTA Y EMITIR DTE (Verde Esmeralda de Imagen 1) */}
            <button
              type="button"
              disabled={cart.length === 0 || isProcessing || isReadOnly}
              onClick={handleConfirmSale}
              className="w-full py-3.5 px-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-98 text-slate-950 font-black text-xs sm:text-sm tracking-wide flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                  <span>EMITIENDO DTE...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5 text-slate-950" />
                  <span>CONFIRMAR VENTA Y EMITIR DTE</span>
                </>
              )}
            </button>

            {/* Enlace secundario */}
            <div className="text-center pt-1">
              <button
                type="button"
                onClick={onClearCart}
                className="text-[11px] font-bold text-slate-400 hover:text-slate-200 transition cursor-pointer"
              >
                Volver al Carrito / Limpiar
              </button>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
