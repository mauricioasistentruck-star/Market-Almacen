import React, { useState, useEffect, useMemo } from 'react';
import { applyChileanRounding, getChileanCashShortcuts, getChileLocalDateString, formatChileTime } from '../../utils/chileanCurrencyAndDates';
import { useTheme } from '../../utils/themeContext';
import { useCompany } from '../../utils/companyContext';
import { useAuth } from '../../utils/authContext';
import { db } from '../../db/database';
import type { Sale, SaleItem, PaymentMethod, DTEType, SiiConfig, Customer } from '../../types';
import { formatCLP, formatRut, getDteLabel, getPaymentMethodLabel } from '../../utils/salesPdfGenerator';
import confetti from 'canvas-confetti';
import {
  CreditCard,
  Banknote,
  Building,
  FileText,
  Receipt,
  User,
  Plus,
  Search,
  ArrowRight,
  X,
  CheckCircle2,
  AlertTriangle,
  Calculator,
  RefreshCw,
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

  // Autocompletado de Clientes con Factura
  const [foundCustomerNotice, setFoundCustomerNotice] = useState<string | null>(null);
  // Modal de Creación de Cliente para Factura
  const [isCreateCustomerModalOpen, setIsCreateCustomerModalOpen] = useState(false);
  const [newCustRut, setNewCustRut] = useState('');
  const [newCustBusinessName, setNewCustBusinessName] = useState('');
  const [newCustTradeName, setNewCustTradeName] = useState('');
  const [newCustIndustry, setNewCustIndustry] = useState('');
  const [newCustAddress, setNewCustAddress] = useState('');
  const [newCustCity, setNewCustCity] = useState('');
  const [newCustEmail, setNewCustEmail] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [createCustomerError, setCreateCustomerError] = useState('');

  const handleSearchRut = async () => {
    const clean = customerRut.replace(/[^0-9kK]/g, '').toUpperCase();
    if (!clean) {
      alert('Por favor ingrese un RUT para buscar.');
      return;
    }
    try {
      const allCust = await db.customers.toArray();
      const match = allCust.find(c => c.rut.replace(/[^0-9kK]/g, '').toUpperCase() === clean);
      if (match) {
        applyCustomer(match);
      } else {
        // Si no se encuentra, abrir ventana de crear cliente con el RUT prellenado
        setNewCustRut(customerRut);
        setNewCustBusinessName('');
        setNewCustTradeName('');
        setNewCustIndustry('');
        setNewCustAddress('');
        setNewCustCity('');
        setNewCustEmail('');
        setNewCustPhone('');
        setCreateCustomerError('');
        setIsCreateCustomerModalOpen(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveNewCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustRut.trim() || !newCustBusinessName.trim() || !newCustIndustry.trim() || !newCustAddress.trim() || !newCustCity.trim() || !newCustEmail.trim()) {
      setCreateCustomerError('Por favor complete todos los campos obligatorios (*) exigidos para Factura Electrónica.');
      return;
    }

    try {
      const newCustomer: Customer = {
        rut: newCustRut.trim(),
        businessName: newCustBusinessName.trim(),
        tradeName: newCustTradeName.trim() || undefined,
        industry: newCustIndustry.trim(),
        address: newCustAddress.trim(),
        city: newCustCity.trim(),
        email: newCustEmail.trim(),
        phone: newCustPhone.trim() || undefined,
        companyId: selectedCompanyId !== 'ALL' ? selectedCompanyId : undefined,
        createdAt: new Date().toISOString()
      };

      const newId = await db.customers.add(newCustomer);
      newCustomer.id = newId;

      applyCustomer(newCustomer);
      setIsCreateCustomerModalOpen(false);
      setFoundCustomerNotice(`✓ Cliente registrado y seleccionado: ${newCustomer.businessName}`);
    } catch (err) {
      console.error('Error al registrar cliente:', err);
      setCreateCustomerError('Ocurrió un error al guardar el cliente en la base de datos.');
    }
  };

  const [suggestedCustomers, setSuggestedCustomers] = useState<Customer[]>([]);

  const applyCustomer = (cust: Customer) => {
    setCustomerRut(cust.rut);
    setCustomerName(cust.businessName);
    if (cust.industry) setCustomerBusiness(cust.industry);
    if (cust.address) setCustomerAddress(cust.address);
    if (cust.city) setCustomerCity(cust.city);
    if (cust.email) setCustomerEmail(cust.email);
    if (cust.phone) setCustomerPhone(cust.phone);
    setFoundCustomerNotice(`✓ Cliente encontrado: ${cust.businessName}`);
    setSuggestedCustomers([]);
  };

  const handleCustomerRutChange = async (val: string) => {
    setCustomerRut(val);
    const clean = val.replace(/[^0-9kK]/g, '').toUpperCase();
    if (clean.length >= 3) {
      try {
        const allCust = await db.customers.toArray();
        const matches = allCust.filter(c => {
          const cClean = c.rut.replace(/[^0-9kK]/g, '').toUpperCase();
          return cClean.includes(clean) || c.businessName.toLowerCase().includes(val.toLowerCase());
        });
        setSuggestedCustomers(matches.slice(0, 5));

        const exact = matches.find(c => c.rut.replace(/[^0-9kK]/g, '').toUpperCase() === clean);
        if (exact) {
          applyCustomer(exact);
        } else {
          setFoundCustomerNotice(null);
        }
      } catch (err) {
        console.error(err);
      }
    } else {
      setSuggestedCustomers([]);
      setFoundCustomerNotice(null);
    }
  };


  const [siiConfig, setSiiConfig] = useState<SiiConfig | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Calculate totals
  const rawTotal = cartItems.reduce((acc, item) => acc + item.subtotal, 0);
  const discountAmount = Math.round(rawTotal * (discountPercent / 100));
  const finalTotal = Math.max(0, rawTotal - discountAmount);

  // Ley de Redondeo de Chile (Ley N° 20.956, Art. 12) exclusiva para Efectivo
  const rounding = useMemo(() => {
    return applyChileanRounding(finalTotal, paymentMethod);
  }, [finalTotal, paymentMethod]);

  const cashRoundedTotal = rounding.roundedAmount;
  const roundingDifference = rounding.roundingDifference;
  const effectiveTotal = paymentMethod === 'EFECTIVO' ? cashRoundedTotal : finalTotal;

  // Atajos de billetes chilenos dinámicos
  const cashShortcuts = useMemo(() => {
    return getChileanCashShortcuts(cashRoundedTotal);
  }, [cashRoundedTotal]);

  // En Chile, si es con IVA incluido:
  // Neto = Total / 1.19, IVA = Total - Neto
  const subtotalNeto = Math.round(finalTotal / 1.19);
  const iva = finalTotal - subtotalNeto;

  const cashChange = paymentMethod === 'EFECTIVO' ? Math.max(0, (amountPaid || 0) - cashRoundedTotal) : 0;

  useEffect(() => {
    if (!isOpen) return;
    setAmountPaid(paymentMethod === 'EFECTIVO' ? cashRoundedTotal : finalTotal);
    setPaymentReference('');
    setErrorMessage('');

    const loadConfig = async () => {
      const config = await db.siiConfigs.where('companyId').equals(selectedCompanyId).first();
      if (config) {
        setSiiConfig(config);
      }
    };
    loadConfig();
  }, [isOpen, selectedCompanyId, finalTotal, paymentMethod, cashRoundedTotal]);

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

    if (paymentMethod === 'EFECTIVO' && amountPaid < cashRoundedTotal) {
      setErrorMessage(`El monto pagado en efectivo no puede ser menor a ${formatCLP(cashRoundedTotal)}.`);
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
        roundingDifference: paymentMethod === 'EFECTIVO' ? roundingDifference : 0,
        cashRoundedTotal: paymentMethod === 'EFECTIVO' ? cashRoundedTotal : finalTotal,
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

      // 2.1 Autoguardar cliente de Factura en db.customers para futuras compras
      if (dteType === 'FACTURA_ELECTRONICA' && customerRut.trim() && customerName.trim()) {
        try {
          const clean = customerRut.replace(/[^0-9kK]/g, '').toUpperCase();
          const allC = await db.customers.toArray();
          const existing = allC.find(c => c.rut.replace(/[^0-9kK]/g, '').toUpperCase() === clean);
          if (existing && existing.id) {
            await db.customers.update(existing.id, {
              businessName: customerName.trim().toUpperCase(),
              industry: customerBusiness.trim(),
              address: customerAddress.trim(),
              city: customerCity.trim() || undefined,
              email: customerEmail.trim().toLowerCase() || undefined,
              phone: customerPhone.trim() || undefined,
              updatedAt: now.toISOString()
            });
          } else {
            await db.customers.add({
              rut: formatRut(customerRut.trim()),
              businessName: customerName.trim().toUpperCase(),
              industry: customerBusiness.trim(),
              address: customerAddress.trim(),
              city: customerCity.trim() || undefined,
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
      for (const item of cartItems) {
        if (item.productId) {
          const prod = await db.products.get(item.productId);
          if (prod) {
            const newStock = Math.max(0, (prod.stock || 0) - item.quantity);
            
            const updateFields: any = {
              stock: newStock,
              updatedAt: now.toISOString()
            };

            // Si el ítem fue vendido a precio de oferta / liquidación
            if (item.isOffer && prod.offerPrice) {
              const currentOfferRem = prod.offerStockRemaining !== undefined 
                ? prod.offerStockRemaining 
                : (prod.offerStockLimit || prod.stock || 0);
              const newOfferRem = Math.max(0, currentOfferRem - item.quantity);

              // Al acabarse los productos en liquidación, debe volver a quedar habilitado el precio normal automáticamente
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
              // Si se vendió a precio normal pero el stock físico restante es menor que las unidades asignadas a oferta
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-4xl max-h-[96vh] flex flex-col rounded-3xl border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden">
        
        {/* Header con Alto Contraste */}
        <div className="px-5 py-3 sm:py-3.5 border-b-2 border-slate-200 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white">
          <div className="flex items-center gap-3.5">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center text-white shadow-lg shadow-orange-500/40 font-black shrink-0">
              <Calculator className="w-6 h-6" />
            </div>
            <div>
              <div style={{ color: '#ffffff' }} className="text-lg sm:text-xl font-black flex items-center gap-2.5">
                <span style={{ color: '#ffffff' }}>Finalizar Cobro y Emisión</span>
                <span style={{ color: '#ffffff', backgroundColor: '#ea580c' }} className="px-2.5 py-0.5 rounded-full text-xs font-black shadow-sm">
                  {cartItems.length} {cartItems.length === 1 ? 'ítem' : 'ítems'}
                </span>
              </div>
              <p style={{ color: '#cbd5e1' }} className="text-xs font-medium mt-0.5">
                Selecciona el medio de pago y el tipo de documento tributario
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/15 transition cursor-pointer"
            title="Cerrar modal"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 p-3.5 sm:p-4 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-3.5 lg:gap-4 custom-scrollbar">
          
          {/* Columna Izquierda: Opciones de Pago y Documento */}
          <div className="lg:col-span-7 flex flex-col justify-between space-y-2.5 select-none">
            
            {/* 1. Selección de Documento Tributario (altura ~54px) */}
            <div className="space-y-1 shrink-0">
              <label className="text-[11px] font-black uppercase text-slate-800 dark:text-slate-200 tracking-wider flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-orange-500" />
                <span>1. Tipo de Documento Tributario (SII)</span>
              </label>

              <div className="grid grid-cols-3 gap-2">
                {/* Boleta Electrónica */}
                <button
                  type="button"
                  onClick={() => setDteType('BOLETA_ELECTRONICA')}
                  className={`h-[46px] px-2.5 rounded-xl border-2 text-left transition flex items-center gap-2 cursor-pointer ${
                    dteType === 'BOLETA_ELECTRONICA'
                      ? 'bg-orange-50 dark:bg-orange-950/40 border-orange-500 text-orange-950 dark:text-orange-100 shadow-sm ring-2 ring-orange-400/30'
                      : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/80'
                  }`}
                >
                  <Receipt className={`w-5 h-5 shrink-0 ${dteType === 'BOLETA_ELECTRONICA' ? 'text-orange-600 dark:text-orange-400' : 'text-slate-500'}`} />
                  <div className="truncate">
                    <span className="text-xs font-black block truncate">Boleta Electrónica</span>
                    <span className="text-[10px] font-bold text-orange-700 dark:text-orange-300 block truncate">Consumidor final</span>
                  </div>
                </button>

                {/* Factura Electrónica */}
                <button
                  type="button"
                  onClick={async () => {
              setDteType('FACTURA_ELECTRONICA');
              try {
                const totalCust = await db.customers.count();
                if (totalCust === 0 && !customerRut.trim()) {
                  setNewCustRut('');
                  setNewCustBusinessName('');
                  setNewCustTradeName('');
                  setNewCustIndustry('');
                  setNewCustAddress('');
                  setNewCustCity('');
                  setNewCustEmail('');
                  setNewCustPhone('');
                  setCreateCustomerError('');
                  setIsCreateCustomerModalOpen(true);
                }
              } catch (e) {}
            }}
                  className={`h-[46px] px-2.5 rounded-xl border-2 text-left transition flex items-center gap-2 cursor-pointer ${
                    dteType === 'FACTURA_ELECTRONICA'
                      ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-500 text-blue-950 dark:text-blue-100 shadow-sm ring-2 ring-blue-400/30'
                      : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/80'
                  }`}
                >
                  <Building className={`w-5 h-5 shrink-0 ${dteType === 'FACTURA_ELECTRONICA' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500'}`} />
                  <div className="truncate">
                    <span className="text-xs font-black block truncate">Factura Electrónica</span>
                    <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300 block truncate">Crédito Fiscal IVA</span>
                  </div>
                </button>

                {/* Ticket Interno */}
                <button
                  type="button"
                  onClick={() => setDteType('TICKET_INTERNO')}
                  className={`h-[46px] px-2.5 rounded-xl border-2 text-left transition flex items-center gap-2 cursor-pointer ${
                    dteType === 'TICKET_INTERNO'
                      ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-500 text-purple-950 dark:text-purple-100 shadow-sm ring-2 ring-purple-400/30'
                      : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/80'
                  }`}
                >
                  <QrCode className={`w-5 h-5 shrink-0 ${dteType === 'TICKET_INTERNO' ? 'text-purple-600 dark:text-purple-400' : 'text-slate-500'}`} />
                  <div className="truncate">
                    <span className="text-xs font-black block truncate">Ticket Interno</span>
                    <span className="text-[10px] font-bold text-purple-700 dark:text-purple-300 block truncate">Comprobante</span>
                  </div>
                </button>
              </div>
            </div>

            {/* 2. Medios de Pago (altura ~44px) */}
            <div className="space-y-1 shrink-0">
              <label className="text-[11px] font-black uppercase text-slate-800 dark:text-slate-200 tracking-wider flex items-center gap-1.5">
                <Banknote className="w-3.5 h-3.5 text-emerald-600" />
                <span>2. Medio de Pago</span>
              </label>

              <div className="grid grid-cols-4 gap-2">
                {/* Efectivo */}
                <button
                  type="button"
                  onClick={() => setPaymentMethod('EFECTIVO')}
                  className={`h-[38px] px-2 rounded-xl border-2 text-center transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    paymentMethod === 'EFECTIVO'
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-950 dark:text-emerald-100 shadow-sm ring-2 ring-emerald-400/30'
                      : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/80'
                  }`}
                >
                  <Banknote className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="text-xs font-black truncate">Efectivo</span>
                </button>

                {/* Débito */}
                <button
                  type="button"
                  onClick={() => setPaymentMethod('DEBITO')}
                  className={`h-[38px] px-2 rounded-xl border-2 text-center transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    paymentMethod === 'DEBITO'
                      ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-500 text-blue-950 dark:text-blue-100 shadow-sm ring-2 ring-blue-400/30'
                      : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/80'
                  }`}
                >
                  <CreditCard className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span className="text-xs font-black truncate">Débito (POS)</span>
                </button>

                {/* Crédito */}
                <button
                  type="button"
                  onClick={() => setPaymentMethod('CREDITO')}
                  className={`h-[38px] px-2 rounded-xl border-2 text-center transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    paymentMethod === 'CREDITO'
                      ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-500 text-indigo-950 dark:text-indigo-100 shadow-sm ring-2 ring-indigo-400/30'
                      : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/80'
                  }`}
                >
                  <CreditCard className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <span className="text-xs font-black truncate">Crédito</span>
                </button>

                {/* Transferencia */}
                <button
                  type="button"
                  onClick={() => setPaymentMethod('TRANSFERENCIA')}
                  className={`h-[38px] px-2 rounded-xl border-2 text-center transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    paymentMethod === 'TRANSFERENCIA'
                      ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-500 text-purple-950 dark:text-purple-100 shadow-sm ring-2 ring-purple-400/30'
                      : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/80'
                  }`}
                >
                  <Building className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                  <span className="text-xs font-black truncate">Transf.</span>
                </button>
              </div>
            </div>

            {/* Panel Dinámico de Pago: Altura fija EXACTA de 172px para todos los medios */}
            <div className="h-[172px] shrink-0">
              {paymentMethod === 'EFECTIVO' ? (
                <div className="h-full p-2.5 rounded-2xl bg-emerald-500/10 border-2 border-emerald-500/30 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-black text-emerald-950 dark:text-emerald-200">MONTO ENTREGADO POR CLIENTE:</span>
                    <div className="flex items-center gap-1.5">
                      {rounding.applied && (
                        <span className="text-[10px] font-black px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30">
                          Redondeo: {roundingDifference > 0 ? `+${roundingDifference}` : `-${Math.abs(roundingDifference)}`}
                        </span>
                      )}
                      <span className="font-bold text-emerald-700 dark:text-emerald-300 font-mono text-[11px]">
                        Total: {formatCLP(cashRoundedTotal)}
                      </span>
                    </div>
                  </div>

                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xl font-black text-emerald-600 font-mono select-none">$</span>
                    <input
                      type="number"
                      value={amountPaid === 0 ? '' : amountPaid}
                      onChange={(e) => setAmountPaid(Number(e.target.value))}
                      placeholder="0"
                      className="w-full pl-8 pr-3 py-1 rounded-xl bg-white dark:bg-slate-900 border-2 border-emerald-400 text-slate-900 dark:text-slate-100 text-lg font-mono font-black focus:ring-2 focus:ring-emerald-400/30 focus:outline-none shadow-inner text-left"
                    />
                  </div>

                  {/* Atajos de pago dinámicos con billetes chilenos */}
                  <div className="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none]">
                    <button
                      type="button"
                      onClick={() => setAmountPaid(cashRoundedTotal)}
                      className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-black hover:bg-emerald-700 transition shrink-0 cursor-pointer shadow-xs"
                    >
                      Exacto ({formatCLP(cashRoundedTotal)})
                    </button>
                    {cashShortcuts.map((quickM) => (
                      <button
                        key={quickM}
                        type="button"
                        onClick={() => setAmountPaid(quickM)}
                        className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-emerald-300 dark:border-emerald-700 text-slate-800 dark:text-slate-200 text-[11px] font-black hover:bg-emerald-50 dark:hover:bg-emerald-950/50 transition shrink-0 cursor-pointer shadow-xs"
                      >
                        ${quickM.toLocaleString('es-CL')}
                      </button>
                    ))}
                  </div>

                  <div className="p-1.5 px-3 rounded-xl bg-emerald-600 text-white flex items-center justify-between shadow-xs">
                    <span className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                      <span>💵</span> VUELTO A ENTREGAR:
                    </span>
                    <span className="text-lg font-mono font-black">{formatCLP(cashChange)}</span>
                  </div>
                </div>
              ) : (
                <div className="h-full p-2.5 rounded-2xl bg-blue-500/10 border-2 border-blue-500/30 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-black text-blue-950 dark:text-blue-200">
                      {paymentMethod === 'TRANSFERENCIA' ? 'N° DE TRANSFERENCIA / COMPROBANTE:' : 'N° DE VOUCHER / CÓDIGO POS:'}
                    </span>
                    <span className="text-[10px] font-mono font-black px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-200">
                      Total: {formatCLP(finalTotal)}
                    </span>
                  </div>

                  <input
                    type="text"
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                    placeholder={paymentMethod === 'TRANSFERENCIA' ? 'Ej: TRANSF-89320 o RUT Titular' : 'Ej: AUT-984210 o Voucher'}
                    className="w-full px-3 py-1 rounded-xl bg-white dark:bg-slate-900 border-2 border-blue-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 text-xs font-mono font-bold focus:border-blue-500 focus:outline-none shadow-inner"
                  />

                  <div className="p-1.5 px-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-[11px] font-bold text-blue-950 dark:text-blue-200 flex items-center gap-2">
                    <span className="text-sm">{paymentMethod === 'TRANSFERENCIA' ? '🏦' : '💳'}</span>
                    <span className="truncate">
                      {paymentMethod === 'DEBITO' && 'Pase o inserte la tarjeta en el POS y solicite la clave PIN al cliente.'}
                      {paymentMethod === 'CREDITO' && 'Inserte la tarjeta en el POS y seleccione cuotas si el cliente lo solicita.'}
                      {paymentMethod === 'TRANSFERENCIA' && 'Verifique la recepción conforme de la transferencia antes de emitir.'}
                    </span>
                  </div>

                  <div className="p-1.5 px-3 rounded-xl bg-slate-900 text-white flex items-center justify-between shadow-xs">
                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-300">TOTAL AUTORIZADO EN POS:</span>
                    <span className="text-lg font-black font-mono text-emerald-400">{formatCLP(finalTotal)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* 3. Datos del Cliente: Altura fija EXACTA de 122px tanto en Boleta como en Factura */}
            <div className="h-[122px] shrink-0 flex flex-col justify-between">
              <label className="text-[11px] font-black uppercase text-slate-800 dark:text-slate-200 tracking-wider flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-blue-600" />
                  <span>3. Datos del Cliente</span>
                </span>
                {dteType === 'FACTURA_ELECTRONICA' ? (
                  <div className="flex items-center gap-2">
                  {foundCustomerNotice && (
                    <span className="text-emerald-600 dark:text-emerald-400 font-black text-[10px] bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-300 animate-fadeIn">
                      {foundCustomerNotice}
                    </span>
                  )}
                  <span className="text-red-500 font-black text-[10px] bg-red-50 dark:bg-red-950/50 px-2 py-0.5 rounded border border-red-200">* Obligatorio para Factura</span>
                </div>
                ) : (
                  <span className="text-slate-500 font-bold text-[10px]">Opcional para Boleta</span>
                )}
              </label>

              {dteType === 'FACTURA_ELECTRONICA' ? (
                <div className="space-y-1.5">
                  <div className="grid grid-cols-12 gap-2">
                    <div className="col-span-4">
                      <div className="relative flex items-center gap-1.5">
                        <input
                          type="text"
                          value={customerRut}
                          onChange={(e) => handleCustomerRutChange(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSearchRut();
                            }
                          }}
                          placeholder="RUT (Ej: 76.890.123-4)*"
                          className="flex-1 px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border-2 border-blue-400 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-bold font-mono focus:outline-none"
                          required
                        />
                        <button
                          type="button"
                          onClick={handleSearchRut}
                          className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs shadow-xs cursor-pointer shrink-0 transition active:scale-95"
                          title="Aceptar RUT para autocompletar datos del cliente"
                        >
                          Aceptar
                        </button>
                        {suggestedCustomers.length > 0 && (
                          <div className="absolute left-0 top-full mt-1 w-72 bg-white dark:bg-slate-900 border-2 border-blue-500 rounded-xl shadow-2xl z-50 p-1.5 space-y-1">
                            <span className="text-[10px] font-black text-slate-400 block px-1">Coincidencias en Clientes Guardados:</span>
                            {suggestedCustomers.map(sc => (
                              <button
                                key={sc.id}
                                type="button"
                                onClick={() => applyCustomer(sc)}
                                className="w-full text-left p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/50 text-xs transition cursor-pointer"
                              >
                                <p className="font-black text-blue-600 dark:text-blue-400 leading-tight">{sc.rut}</p>
                                <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200 truncate">{sc.businessName}</p>
                                {sc.industry && <p className="text-[10px] text-slate-400 truncate">{sc.industry}</p>}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="col-span-8">
                      <input
                        type="text"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="Razón Social de la Empresa *"
                        className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border-2 border-blue-400 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-bold focus:outline-none"
                        required
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-12 gap-2">
                    <div className="col-span-6">
                      <input
                        type="text"
                        value={customerBusiness}
                        onChange={(e) => setCustomerBusiness(e.target.value)}
                        placeholder="Giro Comercial *"
                        className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border-2 border-blue-400 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-bold focus:outline-none"
                        required
                      />
                    </div>
                    <div className="col-span-6">
                      <input
                        type="text"
                        value={customerAddress}
                        onChange={(e) => setCustomerAddress(e.target.value)}
                        placeholder="Dirección y Comuna"
                        className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-bold focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-12 gap-2">
                    <div className="col-span-12 sm:col-span-6">
                      <input
                        type="text"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="Nombre del Cliente"
                        className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-bold focus:outline-none"
                      />
                    </div>
                    <div className="col-span-12 sm:col-span-6">
                      <input
                        type="tel"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder="Celular / WhatsApp (Ej: +56912345678)"
                        className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border-2 border-emerald-400 dark:border-emerald-600 text-slate-900 dark:text-white text-xs font-bold font-mono focus:outline-none placeholder:text-slate-400 shadow-2xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-12 gap-2">
                    <div className="col-span-12 sm:col-span-6">
                      <input
                        type="email"
                        value={customerEmail}
                        onChange={(e) => setCustomerEmail(e.target.value)}
                        placeholder="Correo electrónico (opcional)"
                        className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-bold focus:outline-none"
                      />
                    </div>
                    <div className="col-span-12 sm:col-span-6">
                      <input
                        type="text"
                        value={customerRut}
                        onChange={(e) => setCustomerRut(e.target.value)}
                        placeholder="RUT (Opcional)"
                        className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-bold font-mono focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="h-[28px] px-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-between text-xs">
                    <span className="text-emerald-800 dark:text-emerald-300 text-[11px] font-black truncate">💬 Datos para enviar boleta digital a su WhatsApp o Correo</span>
                    <span className="px-2 py-0.5 rounded bg-emerald-200 dark:bg-emerald-900 text-emerald-950 dark:text-emerald-200 font-black text-[9px] shrink-0 ml-1">Envío Digital</span>
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* Columna Derecha: Resumen de Carrito y Totales */}
          <div className="lg:col-span-5 flex flex-col justify-between p-3.5 sm:p-4 rounded-3xl bg-slate-900 border-2 border-slate-800 shadow-2xl h-full overflow-hidden checkout-dark-panel select-none" style={{ color: "#ffffff", backgroundColor: "#0f172a" }}>
            
            <div className="space-y-2.5 overflow-hidden">
              <div style={{ color: "#fbbf24" }} className="text-xs font-black uppercase tracking-wider flex items-center justify-between pb-1 border-b border-slate-800">
                <span style={{ color: "#fbbf24" }}>Resumen de Venta</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-400/20 text-amber-300 border border-amber-400/30">
                  {cartItems.reduce((acc, it) => acc + it.quantity, 0)} ítems
                </span>
              </div>

              {/* Lista de productos con scroll interno imperceptible si excede */}
              <div className="h-[135px] overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden space-y-1.5 pr-1">
                {cartItems.map((item, idx) => (
                  <div
                    key={item.productId || idx}
                    className="p-2 rounded-xl bg-slate-800/80 border border-slate-700/80 flex items-center justify-between text-xs"
                    style={{ color: "#ffffff" }}
                  >
                    <div className="truncate pr-2">
                      <span className="font-bold text-white block truncate">{item.productName}</span>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {item.quantity} x {formatCLP(item.unitPrice)}
                      </span>
                    </div>
                    <span className="font-mono font-black text-emerald-400 shrink-0">
                      {formatCLP(item.subtotal)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Selector de Descuento Promocional */}
              <div className="pt-1 border-t border-slate-800 flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1">
                  <Percent className="w-3.5 h-3.5 text-amber-400" />
                  <span>Descuento Promocional:</span>
                </span>
                <div className="flex items-center gap-1">
                  {[0, 5, 10, 15].map((disc) => (
                    <button
                      key={disc}
                      type="button"
                      onClick={() => setDiscountPercent(disc)}
                      className={`px-2 py-0.5 rounded-lg text-xs font-black font-mono transition cursor-pointer ${
                        discountPercent === disc
                          ? 'bg-amber-400 text-slate-950 font-black shadow-xs'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {disc}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Desglose Contable */}
              <div className="space-y-1 text-xs pt-1 border-t border-slate-800 text-slate-300">
                <div className="flex justify-between">
                  <span>Monto Neto:</span>
                  <span className="font-mono font-bold">{formatCLP(Math.round(finalTotal / 1.19))}</span>
                </div>
                <div className="flex justify-between">
                  <span>I.V.A. (19%):</span>
                  <span className="font-mono font-bold">{formatCLP(finalTotal - Math.round(finalTotal / 1.19))}</span>
                </div>
                {discountPercent > 0 && (
                  <div className="flex justify-between text-amber-400 font-bold">
                    <span>Descuento Aplicado ({discountPercent}%):</span>
                    <span className="font-mono">-{formatCLP(discountAmount)}</span>
                  </div>
                )}
              </div>

              {/* TOTAL A COBRAR DESTACADO */}
              <div className="p-2.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-slate-200">TOTAL A COBRAR:</span>
                <span className="text-2xl font-black font-mono text-amber-400">{formatCLP(finalTotal)}</span>
              </div>
            </div>

            {/* Acciones Finales: Botón de Cobro y Volver */}
            <div className="space-y-2 pt-2">
              {errorMessage && (
                <div className="p-2 rounded-xl bg-red-500/20 border border-red-500/40 text-red-300 text-xs font-bold text-center">
                  {errorMessage}
                </div>
              )}

              <button
                type="button"
                onClick={handleProcessSale}
                disabled={isProcessing || cartItems.length === 0}
                className="w-full h-[46px] rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-sm transition shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>Emitiendo DTE...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    <span>CONFIRMAR VENTA Y EMITIR DTE</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={onClose}
                disabled={isProcessing}
                className="w-full text-center text-xs font-bold text-slate-400 hover:text-white transition py-0.5"
              >
                Volver al Carrito
              </button>
            </div>

          </div>
        </div>
      </div>
    
      {/* MODAL INSCRIPCIÓN DE CLIENTE PARA FACTURA */}
      {isCreateCustomerModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border-2 border-blue-500 rounded-3xl shadow-2xl overflow-hidden animate-scaleIn">
            
            {/* Header del Modal */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-blue-600 text-white shadow-md">
                  <Building className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    Inscripción de Cliente para Factura
                  </h3>
                  <p className="text-xs text-slate-500 font-bold">
                    Registre los datos tributarios del cliente para emitir Factura Electrónica
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsCreateCustomerModalOpen(false)}
                className="text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white cursor-pointer"
              >
                Cancelar
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={handleSaveNewCustomer} className="p-6 space-y-4">
              {createCustomerError && (
                <div className="p-3 rounded-xl bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 text-xs font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{createCustomerError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1">
                    RUT del Cliente / Empresa *
                  </label>
                  <input
                    type="text"
                    required
                    value={newCustRut}
                    onChange={(e) => setNewCustRut(e.target.value)}
                    placeholder="Ej: 76.987.654-3"
                    className="w-full px-3.5 py-2 text-xs font-bold font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1">
                    Razón Social *
                  </label>
                  <input
                    type="text"
                    required
                    value={newCustBusinessName}
                    onChange={(e) => setNewCustBusinessName(e.target.value)}
                    placeholder="EJ: CONSTRUCTORA DEL SUR SPA"
                    className="w-full px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1">
                    Nombre de Fantasía (Opcional)
                  </label>
                  <input
                    type="text"
                    value={newCustTradeName}
                    onChange={(e) => setNewCustTradeName(e.target.value)}
                    placeholder="Ej: Constructora Sur"
                    className="w-full px-3.5 py-2 text-xs font-medium rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1">
                    Giro Comercial (Exigido por SII) *
                  </label>
                  <input
                    type="text"
                    required
                    value={newCustIndustry}
                    onChange={(e) => setNewCustIndustry(e.target.value)}
                    placeholder="Ej: Obras Menores en Construcción"
                    className="w-full px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1">
                    Dirección Casa Matriz / Sucursal *
                  </label>
                  <input
                    type="text"
                    required
                    value={newCustAddress}
                    onChange={(e) => setNewCustAddress(e.target.value)}
                    placeholder="Ej: Av. Los Conquistadores 1234"
                    className="w-full px-3.5 py-2 text-xs font-medium rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1">
                    Comuna / Ciudad *
                  </label>
                  <input
                    type="text"
                    required
                    value={newCustCity}
                    onChange={(e) => setNewCustCity(e.target.value)}
                    placeholder="Ej: Providencia, Santiago"
                    className="w-full px-3.5 py-2 text-xs font-medium rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1">
                    Correo Electrónico para Factura Electrónica (DTE) *
                  </label>
                  <input
                    type="email"
                    required
                    value={newCustEmail}
                    onChange={(e) => setNewCustEmail(e.target.value)}
                    placeholder="facturas@constructorasur.cl"
                    className="w-full px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1">
                    Teléfono de Contacto
                  </label>
                  <input
                    type="tel"
                    value={newCustPhone}
                    onChange={(e) => setNewCustPhone(e.target.value)}
                    placeholder="+56 9 7654 3210"
                    className="w-full px-3.5 py-2 text-xs font-medium rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateCustomerModalOpen(false)}
                  className="px-5 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 text-xs font-black rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-md transition cursor-pointer flex items-center gap-2 active:scale-95"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Registrar Cliente</span>
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
};