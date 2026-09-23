import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../db/database';
import { useCompany } from '../../utils/companyContext';
import { useAuth } from '../../utils/authContext';
import { useTheme } from '../../utils/themeContext';
import type { Sale, SaleItem, PaymentMethod, DTEType, SiiConfig, Customer } from '../../types';
import { formatCLP, formatRut, getDteLabel, generateSaleThermalTicketPDF } from '../../utils/salesPdfGenerator';
import { downloadPDF } from '../../utils/pdfGenerator';
import confetti from 'canvas-confetti';
import {
  CreditCard,
  Building,
  Receipt,
  FileText,
  X,
  Check,
  RefreshCw,
  QrCode,
  Printer
} from 'lucide-react';

interface SaleCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: SaleItem[];
  onSaleCompleted: (sale: Sale) => void;
  initialDteType?: DTEType;
  selectedCustomer?: Customer | null;
}

export const SaleCheckoutModal: React.FC<SaleCheckoutModalProps> = ({
  isOpen,
  onClose,
  cartItems,
  onSaleCompleted,
  initialDteType = 'BOLETA_ELECTRONICA',
  selectedCustomer: propCustomer
}) => {
  const { themeClasses } = useTheme();
  const { selectedCompanyId, selectedCompany } = useCompany();
  const { currentUser } = useAuth();

  // Método de pago activo: 'EFECTIVO' | 'DEBITO' | 'CREDITO' | 'TRANSFERENCIA' | 'MERCADO_PAGO' | 'MIXTO' | 'FIADO'
  const [activeTab, setActiveTab] = useState<PaymentMethod>('EFECTIVO');
  const [cardSubType, setCardSubType] = useState<'DEBITO' | 'CREDITO'>('DEBITO');
  const [dteType, setDteType] = useState<DTEType>(initialDteType || 'BOLETA_ELECTRONICA');
  const [paymentReference, setPaymentReference] = useState('');
  const [amountPaid, setAmountPaid] = useState<number>(0);
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [printTicket, setPrintTicket] = useState(true);

  // Pagos Mixtos (Imagen 3)
  const [mixedCash, setMixedCash] = useState<number | string>('');
  const [mixedCard, setMixedCard] = useState<number | string>('');
  const [mixedTransfer, setMixedTransfer] = useState<number | string>('');
  const [mixedMercadoPago, setMixedMercadoPago] = useState<number | string>('');

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
  const [suggestedCustomers, setSuggestedCustomers] = useState<Customer[]>([]);
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

  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [siiConfig, setSiiConfig] = useState<SiiConfig | null>(null);

  // Inicializar estado según props
  useEffect(() => {
    if (!isOpen) return;
    if (initialDteType) {
      setDteType(initialDteType);
    }
    if (propCustomer) {
      applyCustomer(propCustomer);
    }
  }, [isOpen, initialDteType, propCustomer]);

  // Cargar configuración SII
  useEffect(() => {
    if (!isOpen) return;
    const loadConfig = async () => {
      const config = await db.siiConfigs.where('companyId').equals(selectedCompanyId).first();
      if (config) {
        setSiiConfig(config);
      }
    };
    loadConfig();
  }, [isOpen, selectedCompanyId]);

  const applyCustomer = (cust: Customer) => {
    setCustomerRut(formatRut(cust.rut));
    setCustomerName(cust.businessName || cust.tradeName || '');
    setCustomerBusiness(cust.industry || '');
    setCustomerAddress(cust.address || '');
    setCustomerCity(cust.city || 'Santiago');
    setCustomerEmail(cust.email || '');
    setCustomerPhone(cust.phone || '');
    setSuggestedCustomers([]);
    setFoundCustomerNotice(`✓ Cliente: ${cust.businessName || cust.tradeName}`);
  };

  const handleCustomerRutChange = async (val: string) => {
    setCustomerRut(val);
    setFoundCustomerNotice(null);
    const clean = val.replace(/[^0-9kK]/g, '').toUpperCase();
    if (clean.length >= 3) {
      try {
        const allCust = await db.customers.toArray();
        const matches = allCust.filter(c => {
          const cClean = c.rut.replace(/[^0-9kK]/g, '').toUpperCase();
          const cName = (c.businessName || '').toLowerCase();
          return cClean.includes(clean) || cName.includes(val.toLowerCase());
        });
        setSuggestedCustomers(matches.slice(0, 5));
      } catch (e) {
        setSuggestedCustomers([]);
      }
    } else {
      setSuggestedCustomers([]);
    }
  };

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

  // Cálculos de Totales
  const rawSubtotal = useMemo(() => {
    return cartItems.reduce((acc, it) => acc + (it.subtotal || 0), 0);
  }, [cartItems]);

  const discountAmount = useMemo(() => {
    if (discountPercent <= 0) return 0;
    return Math.round((rawSubtotal * discountPercent) / 100);
  }, [rawSubtotal, discountPercent]);

  const finalTotal = Math.max(0, rawSubtotal - discountAmount);

  // Redondeo en Efectivo según Ley 20.956 (Chile)
  const rounding = useMemo(() => {
    const lastDigit = finalTotal % 10;
    let rounded = finalTotal;
    let diff = 0;
    let applied = false;

    if (lastDigit >= 1 && lastDigit <= 5) {
      diff = -lastDigit;
      rounded = finalTotal - lastDigit;
      applied = true;
    } else if (lastDigit >= 6 && lastDigit <= 9) {
      diff = 10 - lastDigit;
      rounded = finalTotal + (10 - lastDigit);
      applied = true;
    }

    return { rounded, diff, applied };
  }, [finalTotal]);

  const cashRoundedTotal = rounding.rounded;
  const roundingDifference = rounding.diff;

  // Atajos de efectivo chilenos
  const cashShortcuts = useMemo(() => {
    const base = cashRoundedTotal;
    const shortcuts: number[] = [];
    const bills = [1000, 2000, 5000, 10000, 20000, 30000, 40000, 50000];
    for (const b of bills) {
      if (b > base && shortcuts.length < 5) {
        shortcuts.push(b);
      }
    }
    return shortcuts;
  }, [cashRoundedTotal]);

  // Cálculos Mixtos
  const numMixedCash = Number(mixedCash) || 0;
  const numMixedCard = Number(mixedCard) || 0;
  const numMixedTransfer = Number(mixedTransfer) || 0;
  const numMixedMercadoPago = Number(mixedMercadoPago) || 0;
  const totalMixedEntered = numMixedCash + numMixedCard + numMixedTransfer + numMixedMercadoPago;

  // Monto Pagado y Vuelto según método activo
  const effectiveAmountPaid = useMemo(() => {
    if (activeTab === 'MIXTO') return totalMixedEntered;
    if (activeTab === 'EFECTIVO') return amountPaid || 0;
    return finalTotal;
  }, [activeTab, totalMixedEntered, amountPaid, finalTotal]);

  const effectiveChange = useMemo(() => {
    if (activeTab === 'EFECTIVO') {
      return Math.max(0, (amountPaid || 0) - cashRoundedTotal);
    }
    if (activeTab === 'MIXTO') {
      return Math.max(0, totalMixedEntered - finalTotal);
    }
    return 0;
  }, [activeTab, amountPaid, cashRoundedTotal, totalMixedEntered, finalTotal]);

  const mixedPending = Math.max(0, finalTotal - totalMixedEntered);

  // Inicializar montos al abrir o cambiar de pestaña
  useEffect(() => {
    if (!isOpen) return;
    if (activeTab === 'EFECTIVO') {
      setAmountPaid(cashRoundedTotal);
    } else if (activeTab === 'MIXTO') {
      // Dejar campos limpios o con sugerencia inicial
    } else {
      setAmountPaid(finalTotal);
    }
    setErrorMessage('');
  }, [isOpen, activeTab, cashRoundedTotal, finalTotal]);

  // Manejo de teclado (Esc para cerrar, Enter para confirmar)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Enter' && !isProcessing) {
        const target = e.target as HTMLElement;
        if (target && target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'text') {
          return;
        }
        handleProcessSale();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isProcessing, activeTab, amountPaid, totalMixedEntered, finalTotal]);

  if (!isOpen) return null;

  // Procesar Venta
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

    if (activeTab === 'EFECTIVO' && (amountPaid || 0) < cashRoundedTotal) {
      setErrorMessage(`El monto pagado en efectivo no puede ser menor a ${formatCLP(cashRoundedTotal)}.`);
      return;
    }

    if (activeTab === 'MIXTO' && totalMixedEntered < finalTotal) {
      setErrorMessage(`El monto total ingresado en pago mixto (${formatCLP(totalMixedEntered)}) es menor al total a cobrar (${formatCLP(finalTotal)}).`);
      return;
    }

    setIsProcessing(true);
    setErrorMessage('');

    try {
      // 1. Obtener correlativo DTE
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
      const dateStr = now.toISOString().split('T')[0];
      const timeStr = now.toTimeString().split(' ')[0].slice(0, 5);

      const subtotalNeto = Math.round(finalTotal / 1.19);
      const iva = finalTotal - subtotalNeto;

      // Definir método guardado en BD
      const resolvedPaymentMethod: PaymentMethod =
        activeTab === 'DEBITO' || activeTab === 'CREDITO' ? cardSubType : activeTab;

      const newSale: Sale = {
        folio: formattedFolio,
        date: dateStr,
        time: timeStr,
        companyId: selectedCompanyId || 'ALL',
        companyName: selectedCompany?.name || 'Mi Negocio',
        customerRut: customerRut.trim() || undefined,
        customerName: customerName.trim() || (dteType === 'FACTURA_ELECTRONICA' ? 'Empresa' : 'Venta General'),
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
        paymentMethod: resolvedPaymentMethod,
        paymentReference: paymentReference.trim() || undefined,
        amountPaid: effectiveAmountPaid,
        cashChange: effectiveChange,
        roundingDifference: activeTab === 'EFECTIVO' ? roundingDifference : 0,
        cashRoundedTotal: activeTab === 'EFECTIVO' ? cashRoundedTotal : finalTotal,
        mixedPayments: activeTab === 'MIXTO' ? {
          cash: numMixedCash > 0 ? numMixedCash : undefined,
          card: numMixedCard > 0 ? numMixedCard : undefined,
          transfer: numMixedTransfer > 0 ? numMixedTransfer : undefined,
          mercadoPago: numMixedMercadoPago > 0 ? numMixedMercadoPago : undefined
        } : undefined,
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

      // 2.1 Autoguardar cliente de Factura en db.customers
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

            if (item.isOffer && prod.offerPrice) {
              const currentOfferRem = prod.offerStockRemaining !== undefined 
                ? prod.offerStockRemaining 
                : (prod.offerStockLimit || prod.stock || 0);
              const newOfferRem = Math.max(0, currentOfferRem - item.quantity);
              if (newOfferRem <= 0 || newStock <= 0) {
                updateFields.offerPrice = undefined;
                updateFields.offerStockLimit = undefined;
                updateFields.offerStockRemaining = 0;
              } else {
                updateFields.offerStockRemaining = newOfferRem;
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
              workerOrSupplier: newSale.customerName || 'Venta General',
              user: currentUser?.name || 'Caja',
              date: dateStr,
              responsibleName: currentUser?.name || 'Caja',
              companyId: selectedCompanyId
            });
          }
        }
      }

      // 4. Imprimir ticket térmico si está activado
      if (printTicket) {
        try {
          const doc = generateSaleThermalTicketPDF(newSale, selectedCompany, siiConfig || undefined);
          downloadPDF(doc, `Ticket_${newSale.folio || 'venta'}.pdf`);
        } catch (printErr) {
          console.error('Error imprimiendo ticket:', printErr);
        }
      }

      // 5. Efecto de éxito
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      {/* Ventana de Cobro Moderna - Inspirada en Imagen 3 con paleta y estilo del sistema */}
      <div className="w-full max-w-xl sm:max-w-2xl lg:max-w-3xl flex flex-col rounded-3xl border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden my-auto max-h-[95vh]">
        
        {/* ========================================================================= */}
        {/* ENCABEZADO SUPERIOR TIPO IMAGEN 3 (TOTAL A COBRAR DESTACADO EN GRANDE)    */}
        {/* ========================================================================= */}
        <div className="px-5 py-3.5 bg-gradient-to-r from-[#0c1b2b] via-[#12283e] to-[#0c1b2b] text-white flex items-center justify-between border-b border-slate-700/80 shrink-0">
          <div className="flex items-center gap-3.5">
            <div>
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-300 block">
                TOTAL A COBRAR
              </span>
              <div className="flex items-baseline gap-2.5">
                <span className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-white">
                  {formatCLP(finalTotal)}
                </span>
                <span className="text-xs font-black px-2 py-0.5 rounded-full bg-orange-500 text-white shadow-xs">
                  {cartItems.length} {cartItems.length === 1 ? 'ítem' : 'ítems'}
                </span>
              </div>
            </div>
          </div>

          {/* Selector Rápido de Documento Tributario en Cabecera */}
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700">
              <button
                type="button"
                onClick={() => setDteType('BOLETA_ELECTRONICA')}
                className={`px-2.5 py-1 rounded-lg text-xs font-black transition cursor-pointer flex items-center gap-1 ${
                  dteType === 'BOLETA_ELECTRONICA'
                    ? 'bg-orange-500 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>Boleta</span>
              </button>

              <button
                type="button"
                onClick={() => setDteType('FACTURA_ELECTRONICA')}
                className={`px-2.5 py-1 rounded-lg text-xs font-black transition cursor-pointer flex items-center gap-1 ${
                  dteType === 'FACTURA_ELECTRONICA'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Building className="w-3.5 h-3.5" />
                <span>Factura</span>
              </button>

              <button
                type="button"
                onClick={() => setDteType('TICKET_INTERNO')}
                className={`px-2.5 py-1 rounded-lg text-xs font-black transition cursor-pointer flex items-center gap-1 ${
                  dteType === 'TICKET_INTERNO'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>Ticket</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition cursor-pointer border border-slate-700 ml-1"
              title="Cerrar ventana [Esc]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Pestañas de Documento en Celular */}
        <div className="sm:hidden flex items-center gap-1 px-4 py-2 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shrink-0">
          <span className="text-[10px] font-black uppercase text-slate-500 mr-1">Doc:</span>
          {(['BOLETA_ELECTRONICA', 'FACTURA_ELECTRONICA', 'TICKET_INTERNO'] as DTEType[]).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDteType(d)}
              className={`flex-1 py-1 rounded-lg text-[10px] font-black text-center ${
                dteType === d ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {d === 'BOLETA_ELECTRONICA' ? 'Boleta' : d === 'FACTURA_ELECTRONICA' ? 'Factura' : 'Ticket'}
            </button>
          ))}
        </div>

        {/* ========================================================================= */}
        {/* BARRA DE PESTAÑAS HORIZONTALES (IDÉNTICO A LA IMAGEN 3)                   */}
        {/* ========================================================================= */}
        <div className="flex items-center overflow-x-auto border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 shrink-0 custom-scrollbar px-2 sm:px-4">
          {[
            { id: 'EFECTIVO' as PaymentMethod, label: 'Efectivo', icon: '💵' },
            { id: 'DEBITO' as PaymentMethod, label: 'Tarjeta', icon: '💳' },
            { id: 'MERCADO_PAGO' as PaymentMethod, label: 'Mercado Pago', icon: '🔵' },
            { id: 'TRANSFERENCIA' as PaymentMethod, label: 'Transferencia', icon: '🏛️' },
            { id: 'MIXTO' as PaymentMethod, label: 'Mixto', icon: '🔀' },
            { id: 'FIADO' as PaymentMethod, label: 'Crédito/Fiado', icon: '📋' },
          ].map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id);
                  if (tab.id === 'DEBITO') setCardSubType('DEBITO');
                }}
                className={`flex items-center gap-1.5 px-3 sm:px-4 py-3 text-xs sm:text-sm font-black whitespace-nowrap transition border-b-2 cursor-pointer ${
                  isActive
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-900 shadow-2xs'
                    : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100/60 dark:hover:bg-slate-800/60'
                }`}
              >
                <span className="text-base leading-none">{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* ========================================================================= */}
        {/* CUERPO DINÁMICO SEGÚN PESTAÑA SELECCIONADA (CON SCROLL INTERNO SI SE REQUIERE) */}
        {/* ========================================================================= */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-5 space-y-4">
          
          {/* ---------------- PESTAÑA: MIXTO (TAL COMO IMAGEN 3) ---------------- */}
          {activeTab === 'MIXTO' && (
            <div className="space-y-3.5 animate-fadeIn">
              <div className="p-3 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded-2xl text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>Distribuya los montos ingresados entre los diferentes medios de pago:</span>
                <span className="font-mono font-black text-blue-600 dark:text-blue-400">
                  Total: {formatCLP(finalTotal)}
                </span>
              </div>

              {/* 1. Monto Efectivo */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <span>💵</span>
                  <span>Monto Efectivo</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono font-bold text-slate-400">$</span>
                  <input
                    type="number"
                    value={mixedCash}
                    onChange={(e) => setMixedCash(e.target.value)}
                    placeholder="0"
                    className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-bold text-base focus:ring-2 focus:ring-blue-500 focus:outline-none text-right"
                  />
                </div>
              </div>

              {/* 2. Monto Tarjeta */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <span>💳</span>
                  <span>Monto Tarjeta</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono font-bold text-slate-400">$</span>
                  <input
                    type="number"
                    value={mixedCard}
                    onChange={(e) => setMixedCard(e.target.value)}
                    placeholder="0"
                    className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-bold text-base focus:ring-2 focus:ring-blue-500 focus:outline-none text-right"
                  />
                </div>
              </div>

              {/* 3. Monto Transferencia */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <span>🏛️</span>
                  <span>Monto Transferencia</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono font-bold text-slate-400">$</span>
                  <input
                    type="number"
                    value={mixedTransfer}
                    onChange={(e) => setMixedTransfer(e.target.value)}
                    placeholder="0"
                    className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-bold text-base focus:ring-2 focus:ring-blue-500 focus:outline-none text-right"
                  />
                </div>
              </div>

              {/* 4. Monto Mercado Pago */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <span>🔵</span>
                  <span>Monto Mercado Pago (Opcional)</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono font-bold text-slate-400">$</span>
                  <input
                    type="number"
                    value={mixedMercadoPago}
                    onChange={(e) => setMixedMercadoPago(e.target.value)}
                    placeholder="0"
                    className="w-full pl-8 pr-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-bold text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none text-right"
                  />
                </div>
              </div>

              {/* Barra de Balance Mixto */}
              <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs font-bold">
                <div>
                  <span className="text-slate-500 dark:text-slate-400">Total Ingresado: </span>
                  <span className="font-mono text-slate-900 dark:text-white text-sm font-black">{formatCLP(totalMixedEntered)}</span>
                </div>
                {mixedPending > 0 ? (
                  <span className="text-red-600 dark:text-red-400 font-mono font-black">
                    Faltante: {formatCLP(mixedPending)}
                  </span>
                ) : (
                  <span className="text-emerald-600 dark:text-emerald-400 font-mono font-black">
                    ✓ Completo (Vuelto: {formatCLP(effectiveChange)})
                  </span>
                )}
              </div>
            </div>
          )}

          {/* ---------------- PESTAÑA: EFECTIVO ---------------- */}
          {activeTab === 'EFECTIVO' && (
            <div className="space-y-3.5 animate-fadeIn">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                  <label className="flex items-center gap-1.5 font-black">
                    <span>💵</span>
                    <span>Monto Recibido del Cliente</span>
                  </label>
                  {rounding.applied && (
                    <span className="text-[10px] font-black px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                      Redondeo Ley 20.956: {roundingDifference > 0 ? `+${roundingDifference}` : roundingDifference}
                    </span>
                  )}
                </div>

                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-2xl font-black text-emerald-600 font-mono select-none">$</span>
                  <input
                    type="number"
                    value={amountPaid === 0 ? '' : amountPaid}
                    onChange={(e) => setAmountPaid(Number(e.target.value))}
                    placeholder="0"
                    autoFocus
                    className="w-full pl-9 pr-4 py-3 rounded-2xl bg-white dark:bg-slate-800 border-2 border-emerald-500 text-slate-900 dark:text-white text-2xl font-mono font-black focus:ring-2 focus:ring-emerald-400 focus:outline-none shadow-inner text-right"
                  />
                </div>
              </div>

              {/* Botones de Atajo Rápido */}
              <div className="flex items-center gap-1.5 overflow-x-auto py-1 custom-scrollbar">
                <button
                  type="button"
                  onClick={() => setAmountPaid(cashRoundedTotal)}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-black shrink-0 cursor-pointer shadow-xs transition"
                >
                  Exacto ({formatCLP(cashRoundedTotal)})
                </button>
                {cashShortcuts.map((quickM) => (
                  <button
                    key={quickM}
                    type="button"
                    onClick={() => setAmountPaid(quickM)}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-black active:scale-95 transition shrink-0 cursor-pointer shadow-2xs"
                  >
                    ${quickM.toLocaleString('es-CL')}
                  </button>
                ))}
              </div>

              {/* Vuelto a Entregar */}
              <div className="p-3 sm:p-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white flex items-center justify-between shadow-md">
                <span className="text-xs sm:text-sm font-black uppercase tracking-wider flex items-center gap-2">
                  <span>💵</span> VUELTO A ENTREGAR:
                </span>
                <span className="text-xl sm:text-2xl font-mono font-black">{formatCLP(effectiveChange)}</span>
              </div>
            </div>
          )}

          {/* ---------------- PESTAÑA: TARJETA ---------------- */}
          {activeTab === 'DEBITO' && (
            <div className="space-y-3.5 animate-fadeIn">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCardSubType('DEBITO')}
                  className={`flex-1 py-2 px-3 rounded-xl border-2 font-black text-xs transition cursor-pointer flex items-center justify-center gap-1.5 ${
                    cardSubType === 'DEBITO'
                      ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-600 text-blue-950 dark:text-blue-100 shadow-xs'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <CreditCard className="w-4 h-4 text-blue-600" />
                  <span>Débito (Redcompra)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCardSubType('CREDITO')}
                  className={`flex-1 py-2 px-3 rounded-xl border-2 font-black text-xs transition cursor-pointer flex items-center justify-center gap-1.5 ${
                    cardSubType === 'CREDITO'
                      ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-600 text-indigo-950 dark:text-indigo-100 shadow-xs'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <CreditCard className="w-4 h-4 text-indigo-600" />
                  <span>Tarjeta Crédito</span>
                </button>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  N° de Voucher / Código de Autorización POS (Opcional):
                </label>
                <input
                  type="text"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  placeholder="Ej: AUT-89420 o N° operación"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-xs font-medium text-blue-900 dark:text-blue-200 flex items-center gap-2">
                <CreditCard className="w-4 h-4 shrink-0 text-blue-600" />
                <span>Pase o inserte la tarjeta en la máquina POS y confirme el cobro por <strong>{formatCLP(finalTotal)}</strong>.</span>
              </div>
            </div>
          )}

          {/* ---------------- PESTAÑA: MERCADO PAGO ---------------- */}
          {activeTab === 'MERCADO_PAGO' && (
            <div className="space-y-3.5 animate-fadeIn">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  N° de Operación o Referencia Mercado Pago:
                </label>
                <input
                  type="text"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  placeholder="Ej: MP-9812401 o Comprobante"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-sm focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>

              <div className="p-3 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-900 text-xs font-medium text-sky-900 dark:text-sky-200 flex items-center gap-2">
                <QrCode className="w-4 h-4 shrink-0 text-sky-600" />
                <span>Muestre el código QR al cliente o verifique la recepción del dinero por <strong>{formatCLP(finalTotal)}</strong> en Mercado Pago.</span>
              </div>
            </div>
          )}

          {/* ---------------- PESTAÑA: TRANSFERENCIA ---------------- */}
          {activeTab === 'TRANSFERENCIA' && (
            <div className="space-y-3.5 animate-fadeIn">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  N° de Transferencia / Comprobante Bancario:
                </label>
                <input
                  type="text"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  placeholder="Ej: TRANSF-89320 o RUT Titular"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900 text-xs font-medium text-purple-900 dark:text-purple-200 flex items-center gap-2">
                <Building className="w-4 h-4 shrink-0 text-purple-600" />
                <span>Verifique en su aplicación bancaria que la transferencia por <strong>{formatCLP(finalTotal)}</strong> fue recibida con éxito.</span>
              </div>
            </div>
          )}

          {/* ---------------- PESTAÑA: FIADO / CRÉDITO ---------------- */}
          {activeTab === 'FIADO' && (
            <div className="space-y-3.5 animate-fadeIn">
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-xs font-medium text-amber-900 dark:text-amber-200 flex items-center gap-2">
                <FileText className="w-4 h-4 shrink-0 text-amber-600" />
                <span>Se registrará la cuenta por cobrar (fiado) a nombre del cliente seleccionado por un valor de <strong>{formatCLP(finalTotal)}</strong>.</span>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Nombre del Cliente o Nota de Fiado:
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Nombre de la persona que fía..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* SECCIÓN FACTURA: DATOS TRIBUTARIOS DE LA EMPRESA (SI SELECCIONÓ FACTURA) */}
          {/* ========================================================================= */}
          {dteType === 'FACTURA_ELECTRONICA' && (
            <div className="p-4 rounded-2xl bg-blue-50/60 dark:bg-blue-950/30 border-2 border-blue-400 dark:border-blue-800 space-y-3 animate-fadeIn">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-blue-950 dark:text-blue-200 flex items-center gap-1.5">
                  <Building className="w-4 h-4 text-blue-600" />
                  <span>Datos de Factura Electrónica (Obligatorios)</span>
                </span>
                {foundCustomerNotice && (
                  <span className="text-xs font-black text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 rounded border border-emerald-300">
                    {foundCustomerNotice}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 text-xs">
                {/* RUT con búsqueda */}
                <div className="sm:col-span-5 relative">
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-0.5">RUT Empresa *</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={customerRut}
                      onChange={(e) => handleCustomerRutChange(e.target.value)}
                      placeholder="Ej: 76.123.456-7"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono font-bold"
                    />
                    <button
                      type="button"
                      onClick={handleSearchRut}
                      className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-black text-[11px] shrink-0 cursor-pointer"
                    >
                      Aceptar
                    </button>
                  </div>

                  {suggestedCustomers.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg shadow-xl z-30 max-h-36 overflow-y-auto">
                      {suggestedCustomers.map(c => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => applyCustomer(c)}
                          className="w-full text-left p-2 hover:bg-blue-50 dark:hover:bg-slate-700 text-xs border-b border-slate-100 dark:border-slate-700 last:border-none"
                        >
                          <span className="font-bold text-slate-900 dark:text-white block">{c.businessName || c.tradeName}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{c.rut} - {c.industry}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Razón Social */}
                <div className="sm:col-span-7">
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-0.5">Razón Social *</label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Nombre legal de la empresa..."
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold"
                  />
                </div>

                {/* Giro Comercial */}
                <div className="sm:col-span-6">
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-0.5">Giro Comercial *</label>
                  <input
                    type="text"
                    value={customerBusiness}
                    onChange={(e) => setCustomerBusiness(e.target.value)}
                    placeholder="Ej: Venta de alimentos..."
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>

                {/* Dirección */}
                <div className="sm:col-span-6">
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-0.5">Dirección y Comuna *</label>
                  <input
                    type="text"
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    placeholder="Calle, Número, Comuna..."
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Opcional para Boleta: Correo o WhatsApp */}
          {dteType === 'BOLETA_ELECTRONICA' && (
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-2">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block">
                Envío de Comprobante Digital (Opcional):
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <input
                  type="text"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="WhatsApp (Ej: +56912345678)"
                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="Correo Electrónico"
                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
            </div>
          )}

        </div>

        {/* ========================================================================= */}
        {/* RESUMEN DE COBRO Y BOTONES FINALES (TIPO IMAGEN 3)                        */}
        {/* ========================================================================= */}
        <div className="border-t border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-850 p-4 sm:p-5 space-y-3 shrink-0">
          
          {/* Fila de Totales como en la Imagen 3 */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs sm:text-sm font-bold border-b border-slate-200 dark:border-slate-700/80 pb-2.5">
            <div className="flex items-center gap-4">
              <div>
                <span className="text-slate-500 dark:text-slate-400">Total venta: </span>
                <span className="font-mono font-black text-slate-900 dark:text-white text-base">
                  {formatCLP(finalTotal)}
                </span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400">Total ingresado: </span>
                <span className="font-mono font-black text-slate-900 dark:text-white text-base">
                  {formatCLP(effectiveAmountPaid)}
                </span>
              </div>
            </div>

            {/* Checkbox Imprimir Ticket (Imagen 3) */}
            <label className="flex items-center gap-2 cursor-pointer select-none text-slate-700 dark:text-slate-300 font-bold">
              <input
                type="checkbox"
                checked={printTicket}
                onChange={(e) => setPrintTicket(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <span className="flex items-center gap-1.5">
                <Printer className="w-3.5 h-3.5 text-slate-500" />
                <span>Imprimir ticket</span>
              </span>
            </label>
          </div>

          {/* Aviso de Error si existe */}
          {errorMessage && (
            <div className="p-2 rounded-xl bg-red-500/15 border border-red-500/30 text-red-600 dark:text-red-300 text-xs font-bold text-center animate-shake">
              {errorMessage}
            </div>
          )}

          {/* Fila de Botones: Cancelar [Esc] y Confirmar cobro [Enter] (Imagen 3) */}
          <div className="flex items-center justify-between gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="px-5 py-3 rounded-2xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-black text-xs sm:text-sm transition cursor-pointer active:scale-98"
            >
              Cancelar [Esc]
            </button>

            <button
              type="button"
              onClick={handleProcessSale}
              disabled={
                isProcessing ||
                cartItems.length === 0 ||
                (activeTab === 'EFECTIVO' && (amountPaid || 0) < cashRoundedTotal) ||
                (activeTab === 'MIXTO' && totalMixedEntered < finalTotal)
              }
              className="flex-1 py-3 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-sm sm:text-base transition shadow-lg shadow-emerald-500/20 active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Procesando Cobro...</span>
                </>
              ) : (
                <>
                  <Check className="w-5 h-5 stroke-[3]" />
                  <span>Confirmar cobro [Enter]</span>
                </>
              )}
            </button>
          </div>

        </div>

      </div>

      {/* ========================================================================= */}
      {/* MODAL INSCRIPCIÓN DE CLIENTE PARA FACTURA                                 */}
      {/* ========================================================================= */}
      {isCreateCustomerModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-xl bg-white dark:bg-slate-900 border-2 border-blue-500 rounded-3xl shadow-2xl overflow-hidden animate-scaleIn">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-600 text-white shadow-xs">
                  <Building className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-900 dark:text-white leading-tight">
                    Nuevo Cliente para Factura Electrónica
                  </h4>
                  <p className="text-[11px] text-slate-500">Datos obligatorios para emisión tributaria SII</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateCustomerModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveNewCustomer} className="p-4 sm:p-5 space-y-3 text-xs">
              {createCustomerError && (
                <div className="p-2 rounded-lg bg-red-100 text-red-700 border border-red-300 font-bold">
                  {createCustomerError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-0.5">RUT Empresa *</label>
                  <input
                    type="text"
                    required
                    value={newCustRut}
                    onChange={(e) => setNewCustRut(e.target.value)}
                    placeholder="76.123.456-7"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-0.5">Razón Social *</label>
                  <input
                    type="text"
                    required
                    value={newCustBusinessName}
                    onChange={(e) => setNewCustBusinessName(e.target.value)}
                    placeholder="Empresa SpA"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-0.5">Giro Comercial *</label>
                  <input
                    type="text"
                    required
                    value={newCustIndustry}
                    onChange={(e) => setNewCustIndustry(e.target.value)}
                    placeholder="Venta de abarrotes..."
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-0.5">Dirección *</label>
                  <input
                    type="text"
                    required
                    value={newCustAddress}
                    onChange={(e) => setNewCustAddress(e.target.value)}
                    placeholder="Av. Providencia 1234"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-0.5">Ciudad / Comuna *</label>
                  <input
                    type="text"
                    required
                    value={newCustCity}
                    onChange={(e) => setNewCustCity(e.target.value)}
                    placeholder="Santiago"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-0.5">Correo Electrónico (DTE) *</label>
                  <input
                    type="email"
                    required
                    value={newCustEmail}
                    onChange={(e) => setNewCustEmail(e.target.value)}
                    placeholder="facturacion@empresa.cl"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateCustomerModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black shadow-xs cursor-pointer"
                >
                  Guardar y Usar en Factura
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
