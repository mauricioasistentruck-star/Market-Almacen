import { useBodyScrollLock } from '../../utils/scrollLock';
import React, { useState, useEffect, useMemo } from 'react';
import { useTheme } from '../../utils/themeContext';
import { useCompany } from '../../utils/companyContext';
import { useAuth } from '../../utils/authContext';
import { db } from '../../db/database';
import { formatCLP, formatRut } from '../../utils/salesPdfGenerator';
import { printCreditPaymentTicket80mm } from '../../utils/thermalPrinter';
import type { Customer, Sale, CreditPayment } from '../../types';
import {
  X,
  BookOpen,
  Search,
  Plus,
  DollarSign,
  Calendar,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  History,
  Settings,
  Phone,
  MessageCircle,
  Printer,
  ChevronRight,
  ShieldCheck,
  UserCheck,
  Ban,
  FileSpreadsheet,
  Receipt,
  FileText,
  User
} from 'lucide-react';

interface CreditAccountsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenCustomerManager?: () => void;
}

export const CreditAccountsModal: React.FC<CreditAccountsModalProps> = ({
  isOpen,
  onClose,
  onOpenCustomerManager
}) => {
  useBodyScrollLock(Boolean(isOpen));
  const { themeClasses } = useTheme();
  const { selectedCompanyId, selectedCompany } = useCompany();
  const { currentUser, isAdmin, isSuperAdmin } = useAuth();

  // El dueño del local (SuperAdmin o Admin)
  const isOwner = Boolean(isSuperAdmin || isAdmin);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [payments, setPayments] = useState<CreditPayment[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'CON_DEUDA' | 'AL_DIA' | 'BLOQUEADO'>('ALL');

  // Modales secundarios
  const [selectedCustomerForPayment, setSelectedCustomerForPayment] = useState<Customer | null>(null);
  const [selectedCustomerForHistory, setSelectedCustomerForHistory] = useState<Customer | null>(null);
  const [selectedCustomerForConfig, setSelectedCustomerForConfig] = useState<Customer | null>(null);
  const [isNewCreditCustomerOpen, setIsNewCreditCustomerOpen] = useState(false);

  // Estados del modal de pago / abono
  const [paymentType, setPaymentType] = useState<'TOTAL' | 'PARCIAL'>('TOTAL');
  const [amountToPayInput, setAmountToPayInput] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'EFECTIVO' | 'DEBITO' | 'TRANSFERENCIA'>('EFECTIVO');
  const [amountReceivedInput, setAmountReceivedInput] = useState<string>('');
  const [paymentNotes, setPaymentNotes] = useState<string>('');
  const [autoPrintTicket, setAutoPrintTicket] = useState<boolean>(true);
  const [isProcessingPayment, setIsProcessingPayment] = useState<boolean>(false);

  // Estados del modal de configuración del dueño
  const [configHasCredit, setConfigHasCredit] = useState<boolean>(true);
  const [configLimit, setConfigLimit] = useState<string>('50000');
  const [configDueDay, setConfigDueDay] = useState<string>('5');
  const [configDueDate, setConfigDueDate] = useState<string>('');
  const [configStatus, setConfigStatus] = useState<'AL_DIA' | 'CON_DEUDA' | 'BLOQUEADO'>('AL_DIA');
  const [configNotes, setConfigNotes] = useState<string>('');

  // Estados para nuevo cliente a crédito
  const [newCustMode, setNewCustMode] = useState<'EXISTING' | 'NEW'>('EXISTING');
  const [selectedExistingCustId, setSelectedExistingCustId] = useState<string>('');
  const [newCustName, setNewCustName] = useState<string>('');
  const [newCustRut, setNewCustRut] = useState<string>('');
  const [newCustPhone, setNewCustPhone] = useState<string>('');
  const [newCustAddress, setNewCustAddress] = useState<string>('');
  const [newCustLimit, setNewCustLimit] = useState<string>('50000');
  const [newCustDueDay, setNewCustDueDay] = useState<string>('5');
  const [newCustNotes, setNewCustNotes] = useState<string>('');

  const loadData = async () => {
    try {
      // 1. Cargar clientes
      let allCust = await db.customers.toArray();
      if (selectedCompanyId && selectedCompanyId !== 'ALL') {
        allCust = allCust.filter(c => !c.companyId || c.companyId === selectedCompanyId);
      }
      setCustomers(allCust);

      // 2. Cargar ventas a fiado
      let allSales = await db.sales.toArray();
      if (selectedCompanyId && selectedCompanyId !== 'ALL') {
        allSales = allSales.filter(s => s.companyId === selectedCompanyId);
      }
      const fiadoSales = allSales.filter(s => s.paymentMethod === 'FIADO' && s.status !== 'ANULADA');
      setSales(fiadoSales);

      // 3. Cargar pagos de fiado
      let allPayments = await db.creditPayments.toArray();
      if (selectedCompanyId && selectedCompanyId !== 'ALL') {
        allPayments = allPayments.filter(p => !p.companyId || p.companyId === selectedCompanyId);
      }
      setPayments(allPayments);
    } catch (e) {
      console.warn('Error cargando cuentas corrientes:', e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, selectedCompanyId]);

  // Lista de clientes con cuenta de crédito autorizada
  const creditCustomers = useMemo(() => {
    return customers.filter(c => c.hasCredit === true || (c.currentDebt || 0) > 0);
  }, [customers]);

  // Métricas Generales
  const metrics = useMemo(() => {
    const totalPendingDebt = creditCustomers.reduce((acc, c) => acc + (c.currentDebt || 0), 0);
    const withDebtCount = creditCustomers.filter(c => (c.currentDebt || 0) > 0).length;
    const upToDateCount = creditCustomers.filter(c => (c.currentDebt || 0) <= 0 && c.creditStatus !== 'BLOQUEADO').length;
    const blockedCount = creditCustomers.filter(c => c.creditStatus === 'BLOQUEADO').length;

    return {
      totalPendingDebt,
      totalCustomers: creditCustomers.length,
      withDebtCount,
      upToDateCount,
      blockedCount
    };
  }, [creditCustomers]);

  // Filtrado de clientes según pestaña y buscador
  const filteredCustomers = useMemo(() => {
    let list = creditCustomers;

    if (activeFilter === 'CON_DEUDA') {
      list = list.filter(c => (c.currentDebt || 0) > 0);
    } else if (activeFilter === 'AL_DIA') {
      list = list.filter(c => (c.currentDebt || 0) <= 0 && c.creditStatus !== 'BLOQUEADO');
    } else if (activeFilter === 'BLOQUEADO') {
      list = list.filter(c => c.creditStatus === 'BLOQUEADO');
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      list = list.filter(c =>
        c.businessName.toLowerCase().includes(q) ||
        (c.rut && c.rut.toLowerCase().includes(q)) ||
        (c.phone && c.phone.toLowerCase().includes(q)) ||
        (c.contactName && c.contactName.toLowerCase().includes(q))
      );
    }

    // Ordenar: primero los que tienen mayor deuda
    return list.sort((a, b) => (b.currentDebt || 0) - (a.currentDebt || 0));
  }, [creditCustomers, activeFilter, searchTerm]);

  // Abrir modal de pago para un cliente
  const handleOpenPayment = (customer: Customer) => {
    setSelectedCustomerForPayment(customer);
    setPaymentType('TOTAL');
    setAmountToPayInput(String(customer.currentDebt || 0));
    setAmountReceivedInput('');
    setPaymentMethod('EFECTIVO');
    setPaymentNotes('');
    setAutoPrintTicket(true);
  };

  // Abrir modal de configuración de crédito del dueño
  const handleOpenConfig = (customer: Customer) => {
    setSelectedCustomerForConfig(customer);
    setConfigHasCredit(customer.hasCredit ?? true);
    setConfigLimit(String(customer.creditLimit || 50000));
    setConfigDueDay(String(customer.paymentDueDay || 5));
    setConfigDueDate(customer.paymentDueDate || '');
    setConfigStatus(customer.creditStatus || ((customer.currentDebt || 0) > 0 ? 'CON_DEUDA' : 'AL_DIA'));
    setConfigNotes(customer.creditNotes || '');
  };

  // Guardar configuración del dueño
  const handleSaveConfig = async () => {
    if (!selectedCustomerForConfig || !selectedCustomerForConfig.id) return;
    if (!isOwner) {
      alert('Solo el dueño o administrador del local puede modificar la autorización de crédito.');
      return;
    }

    const limitNum = Number(configLimit) || 0;
    const dueDayNum = Number(configDueDay) || undefined;

    await db.customers.update(selectedCustomerForConfig.id, {
      hasCredit: configHasCredit,
      creditLimit: limitNum,
      paymentDueDay: dueDayNum,
      paymentDueDate: configDueDate.trim() || undefined,
      creditStatus: configStatus,
      creditNotes: configNotes.trim() || undefined,
      authorizedBy: currentUser?.name || 'Dueño del Local',
      authorizedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    await loadData();
    setSelectedCustomerForConfig(null);
    alert('✅ Condiciones de crédito actualizadas exitosamente por el dueño.');
  };

  // Procesar abono / pago de cuenta
  const handleConfirmPayment = async () => {
    if (!selectedCustomerForPayment || !selectedCustomerForPayment.id) return;

    const currentDebt = selectedCustomerForPayment.currentDebt || 0;
    const amountToPay = paymentType === 'TOTAL' ? currentDebt : Number(amountToPayInput);

    if (isNaN(amountToPay) || amountToPay <= 0) {
      alert('Por favor ingrese un monto de abono válido.');
      return;
    }

    if (amountToPay > currentDebt) {
      alert(`El monto ingresado ($${amountToPay.toLocaleString('es-CL')}) es mayor que la deuda pendiente actual ($${currentDebt.toLocaleString('es-CL')}).`);
      return;
    }

    setIsProcessingPayment(true);

    try {
      const now = new Date();
      const remainingDebt = Math.max(0, currentDebt - amountToPay);
      const newStatus = remainingDebt <= 0 ? 'AL_DIA' : 'CON_DEUDA';
      const receiptFolio = `AB-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 9000) + 1000)}`;

      const newPayment: CreditPayment = {
        customerId: selectedCustomerForPayment.id,
        customerRut: selectedCustomerForPayment.rut,
        customerName: selectedCustomerForPayment.businessName,
        date: now.toISOString(),
        amount: amountToPay,
        previousDebt: currentDebt,
        remainingDebt,
        paymentType,
        paymentMethod,
        notes: paymentNotes.trim() || (paymentType === 'TOTAL' ? 'Pago total de la cuenta' : 'Abono parcial a cuenta'),
        registeredBy: currentUser?.name || 'Cajero',
        companyId: selectedCompanyId || 'market-almacen',
        receiptFolio,
        createdAt: now.toISOString()
      };

      // 1. Guardar pago en base de datos
      const paymentId = await db.creditPayments.add(newPayment);
      newPayment.id = paymentId;

      // 2. Actualizar cliente
      await db.customers.update(selectedCustomerForPayment.id, {
        currentDebt: remainingDebt,
        creditStatus: newStatus,
        lastPaymentDate: now.toISOString(),
        updatedAt: now.toISOString()
      });

      // 3. Imprimir comprobante en ticket térmico si está activado
      if (autoPrintTicket) {
        printCreditPaymentTicket80mm(newPayment, selectedCustomerForPayment, selectedCompany);
      }

      await loadData();
      setSelectedCustomerForPayment(null);

      alert(
        remainingDebt <= 0
          ? `🎉 ¡Cuenta pagada en su totalidad! El cliente ${selectedCustomerForPayment.businessName} ha quedado AL DÍA (Saldo $0).`
          : `✅ Abono de $${amountToPay.toLocaleString('es-CL')} registrado con éxito. Nuevo saldo pendiente: $${remainingDebt.toLocaleString('es-CL')}.`
      );
    } catch (e: any) {
      alert('Error registrando el pago: ' + (e?.message || e));
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // Crear o autorizar nuevo cliente a crédito
  const handleCreateNewCreditCustomer = async () => {
    if (!isOwner) {
      alert('Solo el dueño o administrador del local puede autorizar nuevos créditos a clientes.');
      return;
    }

    const limitNum = Number(newCustLimit) || 50000;
    const dueDayNum = Number(newCustDueDay) || 5;
    const now = new Date();

    if (newCustMode === 'EXISTING') {
      if (!selectedExistingCustId) {
        alert('Seleccione un cliente registrado.');
        return;
      }
      const custId = Number(selectedExistingCustId);
      await db.customers.update(custId, {
        hasCredit: true,
        creditLimit: limitNum,
        paymentDueDay: dueDayNum,
        creditStatus: 'AL_DIA',
        creditNotes: newCustNotes.trim() || undefined,
        authorizedBy: currentUser?.name || 'Dueño del Local',
        authorizedAt: now.toISOString(),
        updatedAt: now.toISOString()
      });
    } else {
      if (!newCustName.trim()) {
        alert('Ingrese el nombre completo del cliente.');
        return;
      }
      await db.customers.add({
        rut: newCustRut.trim() ? formatRut(newCustRut.trim()) : 'S/R',
        businessName: newCustName.trim().toUpperCase(),
        phone: newCustPhone.trim() || undefined,
        address: newCustAddress.trim() || undefined,
        hasCredit: true,
        creditLimit: limitNum,
        currentDebt: 0,
        paymentDueDay: dueDayNum,
        creditStatus: 'AL_DIA',
        creditNotes: newCustNotes.trim() || undefined,
        authorizedBy: currentUser?.name || 'Dueño del Local',
        authorizedAt: now.toISOString(),
        companyId: selectedCompanyId || 'market-almacen',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
      });
    }

    await loadData();
    setIsNewCreditCustomerOpen(false);
    alert('✅ Crédito / Fiado autorizado exitosamente por el dueño.');
  };

  // Clientes existentes que aún no tienen crédito habilitado
  const existingCustomersWithoutCredit = useMemo(() => {
    return customers.filter(c => !c.hasCredit);
  }, [customers]);

  // Historial detallado para el cliente seleccionado en Kardex
  const customerHistoryMovements = useMemo(() => {
    if (!selectedCustomerForHistory || !selectedCustomerForHistory.id) return [];

    const custId = selectedCustomerForHistory.id;
    const custRut = (selectedCustomerForHistory.rut || '').replace(/[^0-9kK]/g, '').toUpperCase();
    const custName = selectedCustomerForHistory.businessName.toLowerCase();

    // 1. Compras a fiado
    const custSales = sales.filter(s =>
      s.customerId === custId ||
      (s.customerRut && s.customerRut.replace(/[^0-9kK]/g, '').toUpperCase() === custRut && custRut !== 'SR') ||
      (s.customerName && s.customerName.toLowerCase() === custName)
    );

    // 2. Pagos / Abonos
    const custPayments = payments.filter(p => p.customerId === custId);

    // 3. Unificar movimientos
    const movements: Array<{
      id: string;
      date: string;
      type: 'COMPRA' | 'ABONO';
      description: string;
      amount: number;
      method?: string;
      reference?: string;
      itemsCount?: number;
    }> = [];

    custSales.forEach(s => {
      const itemsList = s.items.map(it => `${it.quantity}x ${it.productName}`).join(', ');
      movements.push({
        id: `sale-${s.id}`,
        date: s.createdAt || s.date,
        type: 'COMPRA',
        description: itemsList || 'Compra de mercadería a fiado',
        amount: s.total,
        reference: `Boleta/Ticket #${s.folio || s.id}`,
        itemsCount: s.items.length
      });
    });

    custPayments.forEach(p => {
      movements.push({
        id: `pay-${p.id}`,
        date: p.date,
        type: 'ABONO',
        description: p.notes || (p.paymentType === 'TOTAL' ? 'Pago Total de Cuenta' : 'Abono Parcial a Cuenta'),
        amount: p.amount,
        method: p.paymentMethod,
        reference: p.receiptFolio || `Recibo #${p.id}`
      });
    });

    // Ordenar cronológicamente ascendente para calcular saldos
    movements.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let runningBalance = 0;
    return movements.map(m => {
      if (m.type === 'COMPRA') {
        runningBalance += m.amount;
      } else {
        runningBalance = Math.max(0, runningBalance - m.amount);
      }
      return {
        ...m,
        balance: runningBalance
      };
    }).reverse(); // Mostramos los más recientes primero
  }, [selectedCustomerForHistory, sales, payments]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className={`w-full max-w-5xl max-h-[94vh] rounded-3xl border-2 ${themeClasses.border} ${themeClasses.card} shadow-2xl flex flex-col overflow-hidden animate-scaleIn`}>
        
        {/* ========================================================================= */}
        {/* HEADER                                                                    */}
        {/* ========================================================================= */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20 shrink-0">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                  Libreta de Fiados & Cuentas Corrientes
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                  {selectedCompany?.name || 'Mi Negocio'}
                </span>
              </div>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                Control de clientes con crédito autorizado, fechas de pago y montos pendientes
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isOwner && (
              <button
                type="button"
                onClick={() => {
                  setNewCustMode('EXISTING');
                  setSelectedExistingCustId('');
                  setNewCustName('');
                  setNewCustRut('');
                  setNewCustPhone('');
                  setNewCustLimit('50000');
                  setNewCustDueDay('5');
                  setIsNewCreditCustomerOpen(true);
                }}
                className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-black shadow-md transition active:scale-95 cursor-pointer flex items-center gap-1.5"
                title="Autorizar crédito a un cliente (Exclusivo Dueño)"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span className="hidden sm:inline">+ Autorizar Crédito</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* TARJETAS DE MÉTRICAS KPI                                                  */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-4 sm:px-6 bg-slate-100/70 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-800 shrink-0">
          {/* 1. Total por Cobrar */}
          <div className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs">
            <span className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-400 flex items-center gap-1">
              <DollarSign className="w-3.5 h-3.5" />
              <span>Deuda Total por Cobrar</span>
            </span>
            <p className="text-lg sm:text-xl font-mono font-black text-slate-900 dark:text-white mt-1">
              {formatCLP(metrics.totalPendingDebt)}
            </p>
            <span className="text-[10px] text-slate-500 font-bold">
              En {metrics.withDebtCount} {metrics.withDebtCount === 1 ? 'cliente con deuda' : 'clientes con deuda'}
            </span>
          </div>

          {/* 2. Total Clientes a Crédito */}
          <div className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs">
            <span className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Clientes Autorizados</span>
            </span>
            <p className="text-lg sm:text-xl font-mono font-black text-slate-900 dark:text-white mt-1">
              {metrics.totalCustomers}
            </p>
            <span className="text-[10px] text-slate-500 font-bold">
              Autorizados por el dueño
            </span>
          </div>

          {/* 3. Clientes al Día */}
          <div className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs">
            <span className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Clientes al Día</span>
            </span>
            <p className="text-lg sm:text-xl font-mono font-black text-emerald-600 dark:text-emerald-400 mt-1">
              {metrics.upToDateCount}
            </p>
            <span className="text-[10px] text-emerald-700 dark:text-emerald-500 font-bold">
              Saldo $0 (Sin deuda)
            </span>
          </div>

          {/* 4. Con Saldo Pendiente */}
          <div className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs">
            <span className="text-[10px] font-black uppercase text-rose-600 dark:text-rose-400 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Con Deuda Pendiente</span>
            </span>
            <p className="text-lg sm:text-xl font-mono font-black text-rose-600 dark:text-rose-400 mt-1">
              {metrics.withDebtCount}
            </p>
            <span className="text-[10px] text-rose-700 dark:text-rose-500 font-bold">
              Cobro pendiente de pago
            </span>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* BARRA DE BÚSQUEDA Y FILTROS RÁPIDOS                                       */}
        {/* ========================================================================= */}
        <div className="p-3 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2.5 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nombre, RUT o teléfono..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto custom-scrollbar pb-1 sm:pb-0">
            {[
              { id: 'ALL', label: 'Todos los Clientes' },
              { id: 'CON_DEUDA', label: '🔴 Con Deuda' },
              { id: 'AL_DIA', label: '🟢 Al Día ($0)' },
              { id: 'BLOQUEADO', label: '⛔ Suspendidos' },
            ].map(f => (
              <button
                key={f.id}
                type="button"
                onClick={() => setActiveFilter(f.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer whitespace-nowrap shadow-2xs ${
                  activeFilter === f.id
                    ? 'bg-amber-500 text-white shadow-sm'
                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* LISTADO DE CLIENTES CON CUENTA CORRIENTE                                   */}
        {/* ========================================================================= */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 sm:p-6 space-y-3">
          {filteredCustomers.length === 0 ? (
            <div className="py-16 text-center text-slate-500">
              <BookOpen className="w-12 h-12 mx-auto text-slate-400 mb-2 opacity-40" />
              <p className="font-black text-base text-slate-700 dark:text-slate-300">
                No se encontraron cuentas de clientes
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {searchTerm
                  ? 'Intente con otro criterio de búsqueda.'
                  : isOwner
                  ? 'Presione "+ Autorizar Crédito" para habilitar la libreta de fiados a un vecino o cliente.'
                  : 'Aún no hay clientes con crédito autorizado en esta empresa.'}
              </p>
            </div>
          ) : (
            filteredCustomers.map(customer => {
              const currentDebt = customer.currentDebt || 0;
              const creditLimit = customer.creditLimit || 50000;
              const availableCredit = Math.max(0, creditLimit - currentDebt);
              const isOverLimit = currentDebt > creditLimit;
              const isUpToDate = currentDebt <= 0;
              const isBlocked = customer.creditStatus === 'BLOQUEADO';
              const percentUsed = Math.min(100, Math.round((currentDebt / Math.max(1, creditLimit)) * 100));

              return (
                <div
                  key={customer.id}
                  className={`p-4 rounded-2xl border-2 transition ${
                    isBlocked
                      ? 'bg-slate-100 dark:bg-slate-900 border-slate-300 dark:border-slate-800 opacity-75'
                      : isOverLimit
                      ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-300 dark:border-rose-800 shadow-sm'
                      : !isUpToDate
                      ? 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800 shadow-sm'
                      : 'bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700 shadow-xs'
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3.5">
                    
                    {/* Columna Izquierda: Datos del Cliente */}
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-sm sm:text-base text-slate-900 dark:text-white">
                          {customer.businessName}
                        </span>

                        {/* Badges de Estado */}
                        {isBlocked ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-300 flex items-center gap-1">
                            <Ban className="w-3 h-3" />
                            CRÉDITO SUSPENDIDO
                          </span>
                        ) : isUpToDate ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            CLIENTE AL DÍA
                          </span>
                        ) : (
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black flex items-center gap-1 ${
                            isOverLimit
                              ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300'
                          }`}>
                            <AlertTriangle className="w-3 h-3" />
                            DEUDA PENDIENTE
                          </span>
                        )}

                        {customer.rut && customer.rut !== 'S/R' && (
                          <span className="font-mono text-xs text-slate-500 font-bold bg-slate-100 dark:bg-slate-700/60 px-2 py-0.5 rounded">
                            {formatRut(customer.rut)}
                          </span>
                        )}
                      </div>

                      {/* Información de Contacto y Fechas de Pago */}
                      <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400 flex-wrap">
                        {customer.phone && (
                          <span className="flex items-center gap-1 font-bold">
                            <Phone className="w-3.5 h-3.5 text-blue-500" />
                            <span>{customer.phone}</span>
                            <a
                              href={`https://wa.me/${customer.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hola ${customer.businessName}, te saludamos de ${selectedCompany?.name || 'nuestro local'}. Te informamos que tu saldo actual de fiado es de ${formatCLP(currentDebt)}.`)}`}
                              target="_blank"
                              rel="noreferrer"
                              className="ml-1 text-emerald-600 hover:text-emerald-700"
                              title="Enviar recordatorio de pago por WhatsApp"
                            >
                              <MessageCircle className="w-3.5 h-3.5 inline" />
                            </a>
                          </span>
                        )}

                        <span className="flex items-center gap-1 font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-800/60">
                          <Calendar className="w-3 h-3 text-amber-600" />
                          <span>
                            {customer.paymentDueDay
                              ? `Paga los días ${customer.paymentDueDay} de cada mes`
                              : customer.paymentDueDate
                              ? `Vence: ${customer.paymentDueDate}`
                              : 'Pago a convenir'}
                          </span>
                        </span>

                        {customer.authorizedBy && (
                          <span className="text-[11px] text-slate-500">
                            Autorizado por: <strong>{customer.authorizedBy}</strong>
                          </span>
                        )}
                      </div>

                      {customer.creditNotes && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 italic bg-white/60 dark:bg-slate-800/60 p-1.5 rounded-lg border border-slate-200 dark:border-slate-700/60 inline-block">
                          "{customer.creditNotes}"
                        </p>
                      )}
                    </div>

                    {/* Columna Central: Saldo, Barra de Cupo y Límites */}
                    <div className="w-full md:w-64 space-y-1.5 shrink-0 bg-white dark:bg-slate-900/60 p-3 rounded-2xl border border-slate-200 dark:border-slate-700">
                      <div className="flex justify-between items-baseline">
                        <span className="text-[10px] font-black uppercase text-slate-500">Saldo Pendiente</span>
                        <span className={`text-base sm:text-lg font-mono font-black ${
                          isUpToDate ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                        }`}>
                          {formatCLP(currentDebt)}
                        </span>
                      </div>

                      {/* Barra de progreso de crédito */}
                      <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 ${
                            isOverLimit
                              ? 'bg-rose-600'
                              : percentUsed > 75
                              ? 'bg-amber-500'
                              : 'bg-blue-600'
                          }`}
                          style={{ width: `${percentUsed}%` }}
                        />
                      </div>

                      <div className="flex justify-between text-[10px] text-slate-500 font-bold font-mono">
                        <span>Límite: {formatCLP(creditLimit)}</span>
                        <span>Disponible: {formatCLP(availableCredit)}</span>
                      </div>
                    </div>

                    {/* Columna Derecha: Botones de Acción */}
                    <div className="flex items-center gap-2 flex-wrap md:flex-col justify-end shrink-0">
                      {/* Botón Abonar / Pagar */}
                      <button
                        type="button"
                        onClick={() => handleOpenPayment(customer)}
                        disabled={currentDebt <= 0}
                        className="flex-1 md:w-36 py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-black shadow-md transition active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <DollarSign className="w-3.5 h-3.5" />
                        <span>Abonar / Pagar</span>
                      </button>

                      {/* Botón Ver Kardex / Historial */}
                      <button
                        type="button"
                        onClick={() => setSelectedCustomerForHistory(customer)}
                        className="flex-1 md:w-36 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 text-xs font-black transition active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 border border-slate-300 dark:border-slate-600"
                      >
                        <History className="w-3.5 h-3.5 text-blue-500" />
                        <span>Ver Cuenta</span>
                      </button>

                      {/* Botón Configurar Crédito (Solo Dueño) */}
                      {isOwner && (
                        <button
                          type="button"
                          onClick={() => handleOpenConfig(customer)}
                          className="py-1.5 px-3 rounded-xl text-[11px] font-bold text-slate-600 dark:text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition cursor-pointer flex items-center justify-center gap-1"
                          title="Modificar límite de crédito y día de pago"
                        >
                          <Settings className="w-3 h-3 text-slate-400" />
                          <span>Ajustar Límite</span>
                        </button>
                      )}
                    </div>

                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ========================================================================= */}
        {/* FOOTER                                                                    */}
        {/* ========================================================================= */}
        <div className="px-5 sm:px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/90 flex flex-col sm:flex-row items-center justify-between gap-2 shrink-0">
          <span className="text-xs text-slate-500 font-bold">
            💡 Consejo: Los tickets de fiado se imprimen con folio y fecha para respaldo mutuo con el cliente.
          </span>

          <div className="flex items-center gap-2">
            {onOpenCustomerManager && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenCustomerManager();
                }}
                className="px-4 py-2 rounded-xl text-xs font-black border border-slate-300 dark:border-slate-700 hover:bg-slate-200/50 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                🏢 Clientes Factura
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 text-xs font-black rounded-xl bg-slate-800 hover:bg-slate-700 text-white transition cursor-pointer shadow-sm"
            >
              Cerrar Libreta
            </button>
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: REGISTRAR ABONO / PAGO DE CUENTA (PAGO TOTAL U OTRO MONTO)       */}
      {/* ========================================================================= */}
      {selectedCustomerForPayment && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg rounded-3xl border-2 border-emerald-500 bg-white dark:bg-slate-900 shadow-2xl p-5 space-y-4 animate-scaleIn">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-600 flex items-center justify-center font-black shrink-0">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base text-slate-900 dark:text-white">
                    Registrar Pago / Abono de Fiado
                  </h3>
                  <p className="text-xs font-bold text-slate-500">
                    Cliente: <strong>{selectedCustomerForPayment.businessName}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCustomerForPayment(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cuadro de Deuda Actual */}
            <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase text-amber-800 dark:text-amber-300 block">Deuda Pendiente Actual</span>
                <span className="text-xl font-mono font-black text-amber-950 dark:text-amber-100">
                  {formatCLP(selectedCustomerForPayment.currentDebt || 0)}
                </span>
              </div>
              {selectedCustomerForPayment.paymentDueDay && (
                <div className="text-right text-[11px] font-bold text-amber-800 dark:text-amber-300">
                  <span>Día de pago: Días {selectedCustomerForPayment.paymentDueDay}</span>
                </div>
              )}
            </div>

            {/* Selección de Tipo de Pago: Pago Total vs Otro Monto */}
            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-700 dark:text-slate-300 block">
                Seleccione Modalidad de Pago:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPaymentType('TOTAL');
                    setAmountToPayInput(String(selectedCustomerForPayment.currentDebt || 0));
                  }}
                  className={`py-3 px-3 rounded-2xl font-black text-xs transition cursor-pointer flex flex-col items-center justify-center gap-1 border-2 ${
                    paymentType === 'TOTAL'
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-600 text-emerald-900 dark:text-emerald-100 shadow-sm'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <span className="text-sm">💰 Pago Total</span>
                  <span className="text-[11px] font-mono font-bold text-emerald-600">
                    Liquidar {formatCLP(selectedCustomerForPayment.currentDebt || 0)}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPaymentType('PARCIAL');
                    setAmountToPayInput('');
                  }}
                  className={`py-3 px-3 rounded-2xl font-black text-xs transition cursor-pointer flex flex-col items-center justify-center gap-1 border-2 ${
                    paymentType === 'PARCIAL'
                      ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-600 text-blue-950 dark:text-blue-100 shadow-sm'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <span className="text-sm">💵 Otro Monto</span>
                  <span className="text-[11px] font-bold text-slate-500">
                    Abono parcial libre
                  </span>
                </button>
              </div>
            </div>

            {/* Input de Monto si eligió Otro Monto */}
            {paymentType === 'PARCIAL' && (
              <div className="space-y-1 animate-fadeIn">
                <label className="text-xs font-black text-slate-700 dark:text-slate-300 block">
                  Ingrese el Monto a Abonar ($):
                </label>
                <input
                  type="number"
                  min="1"
                  max={selectedCustomerForPayment.currentDebt || 0}
                  value={amountToPayInput}
                  onChange={(e) => setAmountToPayInput(e.target.value)}
                  placeholder="Ej: 10000"
                  className="w-full px-3.5 py-2.5 rounded-xl border-2 border-blue-400 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-black text-lg focus:outline-none"
                  autoFocus
                />
              </div>
            )}

            {/* Previsualización del Saldo que quedará */}
            {Boolean(amountToPayInput) && (
              <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex justify-between items-center text-xs">
                <span className="font-bold text-slate-600 dark:text-slate-400">Saldo que quedará debiendo:</span>
                <span className="font-mono font-black text-sm text-slate-900 dark:text-white">
                  {formatCLP(Math.max(0, (selectedCustomerForPayment.currentDebt || 0) - Number(amountToPayInput)))}
                </span>
              </div>
            )}

            {/* Método de Pago del Abono */}
            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-700 dark:text-slate-300 block">
                Forma de Pago del Cliente:
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'EFECTIVO', label: 'Efectivo', icon: '💵' },
                  { id: 'DEBITO', label: 'Tarjeta', icon: '💳' },
                  { id: 'TRANSFERENCIA', label: 'Transf.', icon: '🏦' }
                ].map(m => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPaymentMethod(m.id as any)}
                    className={`py-2 px-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center justify-center gap-1.5 border ${
                      paymentMethod === m.id
                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                    }`}
                  >
                    <span>{m.icon}</span>
                    <span>{m.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Notas opcionales */}
            <div>
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                Nota u Observación (Opcional):
              </label>
              <input
                type="text"
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                placeholder="Ej: Dejó pagado en caja..."
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
              />
            </div>

            {/* Checkbox Impresión Térmica */}
            <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={autoPrintTicket}
                onChange={(e) => setAutoPrintTicket(e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded"
              />
              <Printer className="w-4 h-4 text-slate-500" />
              <span>Imprimir comprobante en ticket térmico de 80mm para el cliente</span>
            </label>

            {/* Botones de Acción */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedCustomerForPayment(null)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold border border-slate-300 dark:border-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isProcessingPayment}
                onClick={handleConfirmPayment}
                className="px-5 py-2.5 rounded-xl text-xs font-black bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-md transition cursor-pointer active:scale-95 flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirmar Pago de {formatCLP(paymentType === 'TOTAL' ? (selectedCustomerForPayment.currentDebt || 0) : Number(amountToPayInput))}</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: HISTORIAL DETALLADO DE CUENTA (KARDEX DE FIADOS)                 */}
      {/* ========================================================================= */}
      {selectedCustomerForHistory && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-3xl max-h-[92vh] flex flex-col rounded-3xl border-2 border-blue-500 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden animate-scaleIn">
            
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-500/20 text-blue-600 flex items-center justify-center shrink-0">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base text-slate-900 dark:text-white">
                    Historial de Cuenta & Movimientos de Fiado
                  </h3>
                  <p className="text-xs font-bold text-slate-500">
                    Cliente: <strong>{selectedCustomerForHistory.businessName}</strong> ({formatRut(selectedCustomerForHistory.rut)})
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedCustomerForHistory(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Resumen Superior del Cliente */}
            <div className="p-4 bg-slate-100/70 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center shrink-0">
              <div>
                <span className="text-[10px] font-black uppercase text-slate-500 block">Deuda Pendiente Actual</span>
                <span className="text-xl font-mono font-black text-rose-600 dark:text-rose-400">
                  {formatCLP(selectedCustomerForHistory.currentDebt || 0)}
                </span>
              </div>
              <div className="text-right text-xs font-bold text-slate-600 dark:text-slate-400">
                <p>Límite Autorizado: {formatCLP(selectedCustomerForHistory.creditLimit || 50000)}</p>
                <p className="text-[11px] text-amber-700 dark:text-amber-400">
                  {selectedCustomerForHistory.paymentDueDay ? `Fecha de pago: Días ${selectedCustomerForHistory.paymentDueDay}` : 'Pago a convenir'}
                </p>
              </div>
            </div>

            {/* Tabla de Movimientos */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2 text-xs">
              {customerHistoryMovements.length === 0 ? (
                <div className="py-12 text-center text-slate-500">
                  <p className="font-bold">No hay compras ni abonos registrados para este cliente.</p>
                </div>
              ) : (
                customerHistoryMovements.map(m => (
                  <div
                    key={m.id}
                    className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                      m.type === 'COMPRA'
                        ? 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50'
                        : 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50'
                    }`}
                  >
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                          m.type === 'COMPRA'
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        }`}>
                          {m.type === 'COMPRA' ? '🛒 COMPRA A FIADO' : '💵 ABONO / PAGO'}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {new Date(m.date).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="text-[11px] font-bold text-slate-500">
                          {m.reference}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                        {m.description}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className={`text-sm font-mono font-black ${
                        m.type === 'COMPRA' ? 'text-rose-600' : 'text-emerald-600'
                      }`}>
                        {m.type === 'COMPRA' ? `+${formatCLP(m.amount)}` : `-${formatCLP(m.amount)}`}
                      </span>
                      <span className="block text-[10px] text-slate-500 font-mono">
                        Saldo: {formatCLP(m.balance)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setSelectedCustomerForHistory(null)}
                className="px-5 py-2 rounded-xl text-xs font-black bg-slate-800 text-white hover:bg-slate-700 cursor-pointer"
              >
                Cerrar
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: CONFIGURACIÓN DE CRÉDITO (EXCLUSIVO DEL DUEÑO DEL LOCAL)          */}
      {/* ========================================================================= */}
      {selectedCustomerForConfig && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md rounded-3xl border-2 border-amber-500 bg-white dark:bg-slate-900 shadow-2xl p-5 space-y-4 animate-scaleIn">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-600 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-sm sm:text-base text-slate-900 dark:text-white">
                    Condiciones de Crédito
                  </h3>
                  <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400">
                    Exclusivo Dueño / Administrador del Local
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCustomerForConfig(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300">
              Cliente: <strong>{selectedCustomerForConfig.businessName}</strong>
            </div>

            <div className="space-y-3 text-xs">
              {/* Activar / Suspender Crédito */}
              <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                <div>
                  <label className="font-black text-slate-800 dark:text-slate-200 block">
                    Crédito / Fiado Habilitado
                  </label>
                  <span className="text-[10px] text-slate-500">
                    Solo el dueño decide si este cliente puede fiar en caja
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={configHasCredit}
                  onChange={(e) => setConfigHasCredit(e.target.checked)}
                  className="w-5 h-5 text-amber-600 rounded cursor-pointer"
                />
              </div>

              {/* Límite de Crédito */}
              <div>
                <label className="font-black text-slate-800 dark:text-slate-200 block mb-1">
                  Límite Máximo de Crédito ($ CLP):
                </label>
                <input
                  type="number"
                  min="0"
                  step="5000"
                  value={configLimit}
                  onChange={(e) => setConfigLimit(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 font-mono font-bold"
                />
              </div>

              {/* Día de Pago del Mes */}
              <div>
                <label className="font-black text-slate-800 dark:text-slate-200 block mb-1">
                  Día Pactado de Pago (Día del mes):
                </label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={configDueDay}
                  onChange={(e) => setConfigDueDay(e.target.value)}
                  placeholder="Ej: 5 (para pagar los días 5 de cada mes)"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 font-bold"
                />
              </div>

              {/* Estado del Crédito */}
              <div>
                <label className="font-black text-slate-800 dark:text-slate-200 block mb-1">
                  Estado del Crédito:
                </label>
                <select
                  value={configStatus}
                  onChange={(e) => setConfigStatus(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 font-bold bg-white dark:bg-slate-800"
                >
                  <option value="AL_DIA">🟢 Al Día / Normal</option>
                  <option value="CON_DEUDA">🔴 Con Deuda Pendiente</option>
                  <option value="BLOQUEADO">⛔ Suspendido / Bloqueado por el Dueño</option>
                </select>
              </div>

              {/* Notas del Dueño */}
              <div>
                <label className="font-black text-slate-800 dark:text-slate-200 block mb-1">
                  Observaciones y Acuerdos del Dueño:
                </label>
                <textarea
                  rows={2}
                  value={configNotes}
                  onChange={(e) => setConfigNotes(e.target.value)}
                  placeholder="Ej: Vecino de confianza, cancelar sueldo de fin de mes..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedCustomerForConfig(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-300 dark:border-slate-700 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveConfig}
                className="px-5 py-2 rounded-xl text-xs font-black bg-amber-500 hover:bg-amber-600 text-white shadow-md cursor-pointer active:scale-95"
              >
                Guardar Ajustes
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: AUTORIZAR NUEVO CLIENTE A CRÉDITO (EXCLUSIVO DEL DUEÑO)          */}
      {/* ========================================================================= */}
      {isNewCreditCustomerOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md rounded-3xl border-2 border-amber-500 bg-white dark:bg-slate-900 shadow-2xl p-5 space-y-4 animate-scaleIn">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center font-black shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-sm sm:text-base text-slate-900 dark:text-white">
                    Autorizar Crédito / Fiado
                  </h3>
                  <p className="text-[11px] font-bold text-amber-600">
                    Solo el dueño decide a quién otorgar fiado
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsNewCreditCustomerOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Selector de Modo: Cliente Registrado vs Nuevo Cliente */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setNewCustMode('EXISTING')}
                className={`py-2 px-2 rounded-xl text-xs font-black transition cursor-pointer border ${
                  newCustMode === 'EXISTING'
                    ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                Cliente Existente
              </button>
              <button
                type="button"
                onClick={() => setNewCustMode('NEW')}
                className={`py-2 px-2 rounded-xl text-xs font-black transition cursor-pointer border ${
                  newCustMode === 'NEW'
                    ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                + Crear Nuevo Cliente
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {newCustMode === 'EXISTING' ? (
                <div>
                  <label className="font-black text-slate-800 dark:text-slate-200 block mb-1">
                    Seleccione Cliente:
                  </label>
                  {existingCustomersWithoutCredit.length === 0 ? (
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl text-amber-800 dark:text-amber-200 text-xs">
                      No hay clientes sin crédito disponibles. Elija "+ Crear Nuevo Cliente".
                    </div>
                  ) : (
                    <select
                      value={selectedExistingCustId}
                      onChange={(e) => setSelectedExistingCustId(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 font-bold bg-white dark:bg-slate-800"
                    >
                      <option value="">-- Seleccione un cliente --</option>
                      {existingCustomersWithoutCredit.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.businessName} {c.phone ? `(${c.phone})` : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              ) : (
                <>
                  <div>
                    <label className="font-black text-slate-800 dark:text-slate-200 block mb-1">
                      Nombre Completo del Cliente *:
                    </label>
                    <input
                      type="text"
                      required
                      value={newCustName}
                      onChange={(e) => setNewCustName(e.target.value)}
                      placeholder="Ej: Don Juan Pérez"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 font-bold"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                        Teléfono / WhatsApp:
                      </label>
                      <input
                        type="text"
                        value={newCustPhone}
                        onChange={(e) => setNewCustPhone(e.target.value)}
                        placeholder="+56 9 1234 5678"
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                        RUT (Opcional):
                      </label>
                      <input
                        type="text"
                        value={newCustRut}
                        onChange={(e) => setNewCustRut(e.target.value)}
                        placeholder="12.345.678-9"
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Límite y Día de Pago */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-black text-slate-800 dark:text-slate-200 block mb-1">
                    Límite Inicial ($):
                  </label>
                  <input
                    type="number"
                    min="1000"
                    step="5000"
                    value={newCustLimit}
                    onChange={(e) => setNewCustLimit(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="font-black text-slate-800 dark:text-slate-200 block mb-1">
                    Día de Pago (Mes):
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={newCustDueDay}
                    onChange={(e) => setNewCustDueDay(e.target.value)}
                    placeholder="Ej: 5"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Notas / Observaciones del Dueño:
                </label>
                <input
                  type="text"
                  value={newCustNotes}
                  onChange={(e) => setNewCustNotes(e.target.value)}
                  placeholder="Ej: Vecino confiable, paga primera semana..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsNewCreditCustomerOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-300 dark:border-slate-700 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCreateNewCreditCustomer}
                className="px-5 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-md cursor-pointer active:scale-95"
              >
                Autorizar Crédito
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
