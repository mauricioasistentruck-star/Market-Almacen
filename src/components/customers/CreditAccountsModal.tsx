import { useBodyScrollLock } from '../../utils/scrollLock';
import React, { useState, useEffect, useMemo } from 'react';
import { useTheme } from '../../utils/themeContext';
import { useCompany } from '../../utils/companyContext';
import { useAuth } from '../../utils/authContext';
import { db } from '../../db/database';
import { formatCLP, formatRut } from '../../utils/salesPdfGenerator';
import { printCreditPaymentTicket80mm } from '../../utils/thermalPrinter';
import type { CreditCustomer, Sale, CreditPayment } from '../../types';
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
  Sliders,
  Wallet,
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
  User,
  Home
} from 'lucide-react';

interface CreditAccountsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreditAccountsModal: React.FC<CreditAccountsModalProps> = ({
  isOpen,
  onClose
}) => {
  useBodyScrollLock(isOpen);
  const { theme, themeClasses } = useTheme();
  const { selectedCompanyId, selectedCompany } = useCompany();
  const { currentUser, isSuperAdmin, isAdmin } = useAuth();

  // El dueño del local (SuperAdmin o Admin)
  const isOwner = Boolean(isSuperAdmin || isAdmin);

  const [customers, setCustomers] = useState<CreditCustomer[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [payments, setPayments] = useState<CreditPayment[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'WITH_DEBT' | 'UP_TO_DATE' | 'BLOCKED'>('ALL');

  // Modales secundarios
  const [selectedCustomerForPayment, setSelectedCustomerForPayment] = useState<CreditCustomer | null>(null);
  const [selectedCustomerForHistory, setSelectedCustomerForHistory] = useState<CreditCustomer | null>(null);
  const [historyCupoInput, setHistoryCupoInput] = useState('');
  const [historyDueDayInput, setHistoryDueDayInput] = useState('5');
  const [cupoSaveSuccess, setCupoSaveSuccess] = useState(false);

  const handleOpenHistory = (customer: CreditCustomer) => {
    setSelectedCustomerForHistory(customer);
    setHistoryCupoInput(String(customer.creditLimit || 50000));
    setHistoryDueDayInput(String(customer.paymentDueDay || 5));
    setCupoSaveSuccess(false);
  };

  const handleQuickCupoAdjust = (delta: number) => {
    const curr = parseInt(historyCupoInput) || 0;
    const next = Math.max(0, curr + delta);
    setHistoryCupoInput(String(next));
  };

  const handleSaveHistoryCupo = async () => {
    if (!selectedCustomerForHistory?.id) return;
    const newLimit = Math.max(0, parseInt(historyCupoInput) || 0);
    const newDueDay = Math.min(31, Math.max(1, parseInt(historyDueDayInput) || 5));

    try {
      await db.creditCustomers.update(selectedCustomerForHistory.id, {
        creditLimit: newLimit,
        paymentDueDay: newDueDay,
        updatedAt: new Date().toISOString()
      });

      const updated = {
        ...selectedCustomerForHistory,
        creditLimit: newLimit,
        paymentDueDay: newDueDay
      };
      setSelectedCustomerForHistory(updated);
      setCustomers(prev => prev.map(c => c.id === updated.id ? updated : c));
      setCupoSaveSuccess(true);
      setTimeout(() => setCupoSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Error al guardar nuevo cupo:', err);
    }
  };
  const [selectedCustomerForConfig, setSelectedCustomerForConfig] = useState<CreditCustomer | null>(null);
  const [isNewCreditCustomerOpen, setIsNewCreditCustomerOpen] = useState(false);

  // Estados para Registro de Pago / Abono
  const [paymentType, setPaymentType] = useState<'TOTAL' | 'PARCIAL'>('TOTAL');
  const [amountToPayInput, setAmountToPayInput] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'EFECTIVO' | 'DEBITO' | 'TRANSFERENCIA'>('EFECTIVO');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [shouldPrintTicket, setShouldPrintTicket] = useState(true);

  // Estados para Autorizar Nuevo Crédito (Persona Normal / Vecino)
  const [newCustName, setNewCustName] = useState('');
  const [newCustAlias, setNewCustAlias] = useState('');
  const [newCustRut, setNewCustRut] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustAddress, setNewCustAddress] = useState('');
  const [newCustLimit, setNewCustLimit] = useState<string>('50000');
  const [newCustDueDay, setNewCustDueDay] = useState<string>('5');
  const [newCustNotes, setNewCustNotes] = useState('');

  // Estados para Modificar Configuración de Crédito existente (Solo Dueño)
  const [editLimit, setEditLimit] = useState<string>('');
  const [editDueDay, setEditDueDay] = useState<string>('');
  const [editNotes, setEditNotes] = useState('');
  const [editStatus, setEditStatus] = useState<'AL_DIA' | 'CON_DEUDA' | 'BLOQUEADO'>('AL_DIA');

  // Cargar datos
  const loadCreditData = async () => {
    try {
      const allCreditCusts = await db.creditCustomers.toArray();
      const compCusts = allCreditCusts.filter(
        c => !c.companyId || c.companyId === (selectedCompanyId || 'market-almacen')
      );
      setCustomers(compCusts);

      const allSales = await db.sales.toArray();
      const compSales = allSales.filter(
        s => !s.companyId || s.companyId === (selectedCompanyId || 'market-almacen')
      );
      setSales(compSales);

      const allPayments = await db.creditPayments.toArray();
      const compPayments = allPayments.filter(
        p => !p.companyId || p.companyId === (selectedCompanyId || 'market-almacen')
      );
      setPayments(compPayments);
    } catch (err) {
      console.error('Error loading credit data:', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadCreditData();
    }
  }, [isOpen, selectedCompanyId]);

  // Métricas Consolidadas (KPIs)
  const metrics = useMemo(() => {
    let totalDebt = 0;
    let upToDateCount = 0;
    let withDebtCount = 0;
    let blockedCount = 0;

    customers.forEach(c => {
      const debt = c.currentDebt || 0;
      if (c.creditStatus === 'BLOQUEADO') {
        blockedCount++;
      }
      if (debt > 0) {
        totalDebt += debt;
        withDebtCount++;
      } else {
        upToDateCount++;
      }
    });

    return {
      totalDebt,
      totalCustomers: customers.length,
      upToDateCount,
      withDebtCount,
      blockedCount
    };
  }, [customers]);

  // Filtrado de Clientes en Tiempo Real
  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = (c.name || '').toLowerCase().includes(q);
        const matchAlias = (c.alias || '').toLowerCase().includes(q);
        const matchRut = (c.rut || '').toLowerCase().includes(q);
        const matchPhone = (c.phone || '').toLowerCase().includes(q);
        const matchAddress = (c.address || '').toLowerCase().includes(q);
        if (!matchName && !matchAlias && !matchRut && !matchPhone && !matchAddress) {
          return false;
        }
      }

      const debt = c.currentDebt || 0;
      if (filterStatus === 'WITH_DEBT') return debt > 0;
      if (filterStatus === 'UP_TO_DATE') return debt <= 0;
      if (filterStatus === 'BLOCKED') return c.creditStatus === 'BLOQUEADO';

      return true;
    });
  }, [customers, searchQuery, filterStatus]);

  // Abrir Modal de Pago / Abono
  const handleOpenPayment = (customer: CreditCustomer) => {
    setSelectedCustomerForPayment(customer);
    setPaymentType('TOTAL');
    setAmountToPayInput(String(customer.currentDebt || 0));
    setPaymentNotes('');
    setPaymentMethod('EFECTIVO');
  };

  // Abrir Modal de Configuración (Solo Dueño)
  const handleOpenConfig = (customer: CreditCustomer) => {
    if (!isOwner) {
      alert('Solo el dueño o administrador del local puede modificar las condiciones de crédito.');
      return;
    }
    setSelectedCustomerForConfig(customer);
    setEditLimit(String(customer.creditLimit || 50000));
    setEditDueDay(String(customer.paymentDueDay || 5));
    setEditNotes(customer.creditNotes || '');
    setEditStatus(customer.creditStatus || ((customer.currentDebt || 0) > 0 ? 'CON_DEUDA' : 'AL_DIA'));
  };

  // Guardar Cambios de Configuración de Crédito (Solo Dueño)
  const handleSaveConfig = async () => {
    if (!selectedCustomerForConfig || !selectedCustomerForConfig.id) return;
    if (!isOwner) {
      alert('Solo el dueño o administrador del local puede modificar la autorización de crédito.');
      return;
    }

    const numLimit = Number(editLimit);
    if (isNaN(numLimit) || numLimit < 0) {
      alert('Ingrese un límite de crédito válido en pesos.');
      return;
    }

    try {
      await db.creditCustomers.update(selectedCustomerForConfig.id, {
        creditLimit: numLimit,
        paymentDueDay: Number(editDueDay) || 5,
        creditNotes: editNotes.trim(),
        creditStatus: editStatus,
        updatedAt: new Date().toISOString()
      });

      await loadCreditData();
      setSelectedCustomerForConfig(null);
      alert('Configuración de crédito actualizada correctamente.');
    } catch (err: any) {
      alert('Error al guardar configuración: ' + err.message);
    }
  };

  // Confirmar Pago / Abono de Deuda
  const handleConfirmPayment = async () => {
    if (!selectedCustomerForPayment || !selectedCustomerForPayment.id) return;

    const previousDebt = selectedCustomerForPayment.currentDebt || 0;
    const amountToPay = paymentType === 'TOTAL' ? previousDebt : Number(amountToPayInput);

    if (isNaN(amountToPay) || amountToPay <= 0) {
      alert('Por favor ingrese un monto de abono válido mayor a $0.');
      return;
    }

    if (amountToPay > previousDebt) {
      alert(`El monto del abono ($${amountToPay.toLocaleString('es-CL')}) no puede ser mayor a la deuda pendiente actual ($${previousDebt.toLocaleString('es-CL')}).`);
      return;
    }

    const remainingDebt = Math.max(0, previousDebt - amountToPay);
    const now = new Date();
    const receiptFolio = `ABN-${Date.now().toString().slice(-6)}`;

    try {
      const newPayment: CreditPayment = {
        customerId: selectedCustomerForPayment.id,
        customerRut: selectedCustomerForPayment.rut,
        customerName: selectedCustomerForPayment.name,
        date: now.toISOString(),
        amount: amountToPay,
        previousDebt,
        remainingDebt,
        paymentType,
        paymentMethod,
        notes: paymentNotes.trim() || undefined,
        registeredBy: currentUser?.name || 'Cajero',
        companyId: selectedCompanyId || 'market-almacen',
        receiptFolio,
        createdAt: now.toISOString()
      };

      await db.creditPayments.add(newPayment);

      await db.creditCustomers.update(selectedCustomerForPayment.id, {
        currentDebt: remainingDebt,
        creditStatus: remainingDebt === 0 ? 'AL_DIA' : 'CON_DEUDA',
        lastPaymentDate: now.toISOString(),
        updatedAt: now.toISOString()
      });

      if (shouldPrintTicket) {
        printCreditPaymentTicket80mm(newPayment, selectedCustomerForPayment, selectedCompany);
      }

      await loadCreditData();
      setSelectedCustomerForPayment(null);
      alert(`Pago de ${formatCLP(amountToPay)} registrado exitosamente.\nNuevo saldo pendiente: ${formatCLP(remainingDebt)}.`);
    } catch (err: any) {
      alert('Error al registrar el pago: ' + err.message);
    }
  };

  // Crear y Autorizar Nuevo Crédito a Vecino / Persona Normal (Solo Dueño)
  const handleCreateNewCreditCustomer = async () => {
    if (!isOwner) {
      alert('Solo el dueño o administrador del local puede autorizar nuevos créditos a clientes.');
      return;
    }

    if (!newCustName.trim()) {
      alert('Por favor ingrese el nombre del vecino o cliente.');
      return;
    }

    const numLimit = Number(newCustLimit);
    if (isNaN(numLimit) || numLimit <= 0) {
      alert('Por favor ingrese un cupo máximo de crédito válido.');
      return;
    }

    try {
      const now = new Date();
      const newCreditCustomer: CreditCustomer = {
        name: newCustName.trim(),
        alias: newCustAlias.trim() || undefined,
        rut: newCustRut.trim() ? formatRut(newCustRut.trim()) : undefined,
        phone: newCustPhone.trim() || undefined,
        address: newCustAddress.trim() || undefined,
        companyId: selectedCompanyId || 'market-almacen',
        creditLimit: numLimit,
        currentDebt: 0,
        creditStatus: 'AL_DIA',
        paymentDueDay: Number(newCustDueDay) || 5,
        creditNotes: newCustNotes.trim() || 'Vecino de confianza',
        authorizedBy: currentUser?.name || 'Dueño del Local',
        authorizedAt: now.toISOString(),
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
      };

      await db.creditCustomers.add(newCreditCustomer);

      setNewCustName('');
      setNewCustAlias('');
      setNewCustRut('');
      setNewCustPhone('');
      setNewCustAddress('');
      setNewCustLimit('50000');
      setNewCustDueDay('5');
      setNewCustNotes('');
      setIsNewCreditCustomerOpen(false);

      await loadCreditData();
      alert(`¡Crédito autorizado con éxito para ${newCreditCustomer.name}! Cupo: ${formatCLP(numLimit)}.`);
    } catch (err: any) {
      alert('Error al autorizar crédito: ' + err.message);
    }
  };

  // Movimientos Consolidados de Historial (Kardex del Cliente)
  const customerHistoryMovements = useMemo(() => {
    if (!selectedCustomerForHistory || !selectedCustomerForHistory.id) return [];

    const custId = selectedCustomerForHistory.id;
    const custName = (selectedCustomerForHistory.name || '').toLowerCase();
    const custRut = (selectedCustomerForHistory.rut || '').replace(/[^0-9kK]/g, '').toLowerCase();

    // 1. Compras a fiado
    const creditSales = sales.filter(s => {
      if (s.status === 'ANULADA') return false;
      const isFiado = s.paymentMethod === 'FIADO';
      const matchId = (s as any).creditCustomerId === custId || (s as any).customerId === custId;
      const matchName = (s.customerName || '').toLowerCase().includes(custName);
      const matchRut = custRut && (s.customerRut || '').replace(/[^0-9kK]/g, '').toLowerCase() === custRut;
      return isFiado && (matchId || matchName || matchRut);
    }).map(s => ({
      id: `sale-${s.id}`,
      type: 'COMPRA' as const,
      date: s.date + (s.time ? ` ${s.time}` : ''),
      folio: s.folio,
      docType: s.dteType || 'BOLETA',
      amount: s.total,
      description: `Compra con Boleta a Fiado (${s.items.length} productos)`,
      registeredBy: s.sellerName || 'Cajero'
    }));

    // 2. Abonos y Pagos
    const custPayments = payments.filter(p => p.customerId === custId).map(p => ({
      id: `pay-${p.id}`,
      type: 'ABONO' as const,
      date: p.date,
      folio: p.receiptFolio || `ABN-${p.id}`,
      docType: 'COMPROBANTE_PAGO',
      amount: p.amount,
      description: `Abono de Deuda (${p.paymentType === 'TOTAL' ? 'Pago Total' : 'Abono Parcial'}) vía ${p.paymentMethod}`,
      registeredBy: p.registeredBy || 'Cajero'
    }));

    return [...creditSales, ...custPayments].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [selectedCustomerForHistory, sales, payments]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-xs animate-fadeIn select-none">
      <div className="w-full max-w-5xl max-h-[95vh] flex flex-col rounded-3xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 shadow-2xl overflow-hidden animate-scaleIn">
        
        {/* HEADER: LIBRETA DE FIADOS & CUENTAS DE VECINOS */}
        <div className="px-4 sm:px-6 py-3.5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                  Libreta de Fiados & Cuentas de Vecinos
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 font-bold uppercase border border-amber-300 dark:border-amber-800">
                  Compras con Boleta
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Control de vecinos y personas normales autorizadas por el dueño para llevar mercadería a crédito.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isOwner && (
              <button
                type="button"
                onClick={() => setIsNewCreditCustomerOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-black text-xs shadow-md transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                title="Solo el dueño puede autorizar crédito a un vecino"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">+ Autorizar Crédito</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* TARJETAS KPI RESUMEN DE LA LIBRETA */}
        <div className="p-3 sm:p-5 grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3.5 shrink-0 bg-slate-100/70 dark:bg-slate-950/40 border-b border-slate-200 dark:border-slate-800">
          
          <div className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs">
            <span className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-400 flex items-center gap-1">
              <DollarSign className="w-3.5 h-3.5" />
              Deuda Total por Cobrar
            </span>
            <p className="text-lg sm:text-xl font-mono font-black text-amber-700 dark:text-amber-300 mt-1">
              {formatCLP(metrics.totalDebt)}
            </p>
            <span className="text-[10px] text-slate-500 font-bold">
              En {metrics.withDebtCount} vecinos con deuda
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs">
            <span className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400 flex items-center gap-1">
              <UserCheck className="w-3.5 h-3.5" />
              Vecinos Autorizados
            </span>
            <p className="text-lg sm:text-xl font-mono font-black text-slate-900 dark:text-white mt-1">
              {metrics.totalCustomers}
            </p>
            <span className="text-[10px] text-slate-500 font-bold">
              Autorizados por el dueño
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs">
            <span className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Clientes al Día
            </span>
            <p className="text-lg sm:text-xl font-mono font-black text-emerald-600 dark:text-emerald-400 mt-1">
              {metrics.upToDateCount}
            </p>
            <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold">
              Saldo $0 (Sin deuda)
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs">
            <span className="text-[10px] font-black uppercase text-rose-600 dark:text-rose-400 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              Con Deuda Pendiente
            </span>
            <p className="text-lg sm:text-xl font-mono font-black text-rose-600 dark:text-rose-400 mt-1">
              {metrics.withDebtCount}
            </p>
            <span className="text-[10px] text-rose-700 dark:text-rose-400 font-bold">
              Cobro pendiente de pago
            </span>
          </div>

        </div>

        {/* BUSCADOR Y FILTROS RÁPIDOS */}
        <div className="p-3 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
          
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Buscar vecino por nombre, apodo, casa o teléfono..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-bold"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar text-xs font-bold">
            <button
              type="button"
              onClick={() => setFilterStatus('ALL')}
              className={`px-3 py-1.5 rounded-xl transition cursor-pointer whitespace-nowrap ${
                filterStatus === 'ALL'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              Todos los Vecinos
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('WITH_DEBT')}
              className={`px-3 py-1.5 rounded-xl transition cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                filterStatus === 'WITH_DEBT'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <span>Con Deuda</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('UP_TO_DATE')}
              className={`px-3 py-1.5 rounded-xl transition cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                filterStatus === 'UP_TO_DATE'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Al Día ($0)</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('BLOCKED')}
              className={`px-3 py-1.5 rounded-xl transition cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                filterStatus === 'BLOCKED'
                  ? 'bg-slate-700 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              <Ban className="w-3.5 h-3.5" />
              <span>Suspendidos</span>
            </button>
          </div>

        </div>

        {/* LISTADO DE CLIENTES DE LA LIBRETA */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-3 custom-scrollbar">
          {filteredCustomers.length === 0 ? (
            <div className="py-16 text-center text-slate-400 dark:text-slate-500 space-y-2">
              <BookOpen className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600" />
              <p className="font-bold text-sm">No se encontraron vecinos registrados con crédito.</p>
              <p className="text-xs">
                {searchQuery
                  ? 'Intente con otro criterio de búsqueda.'
                  : isOwner
                  ? 'Presione "+ Autorizar Crédito" para registrar a un vecino o persona de confianza en la libreta.'
                  : 'Aún no hay vecinos autorizados a fiado por el dueño.'}
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
                    
                    {/* Columna Izquierda: Datos del Vecino / Persona Normal */}
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-sm sm:text-base text-slate-900 dark:text-white">
                          {customer.name}
                        </span>

                        {customer.alias && (
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-800">
                            {customer.alias}
                          </span>
                        )}

                        {/* Badges de Estado */}
                        {isBlocked ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-300 flex items-center gap-1">
                            <Ban className="w-3 h-3" />
                            CRÉDITO SUSPENDIDO
                          </span>
                        ) : isUpToDate ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 flex items-center gap-1 border border-emerald-300 dark:border-emerald-800">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            CLIENTE AL DÍA
                          </span>
                        ) : isOverLimit ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300 flex items-center gap-1 border border-rose-300 dark:border-rose-800">
                            <AlertTriangle className="w-3 h-3 text-rose-600" />
                            CUPO EXCEDIDO
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 flex items-center gap-1 border border-amber-300 dark:border-amber-800">
                            <AlertTriangle className="w-3 h-3 text-amber-600" />
                            DEUDA PENDIENTE
                          </span>
                        )}

                        {customer.rut && (
                          <span className="text-[11px] text-slate-400 font-mono">
                            {formatRut(customer.rut)}
                          </span>
                        )}
                      </div>

                      {/* Contacto, Casa y Día de Pago */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-400 font-semibold">
                        {customer.phone && (
                          <a
                            href={`https://wa.me/${customer.phone.replace(/[^0-9]/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 hover:underline"
                            title="Contactar por WhatsApp"
                          >
                            <Phone className="w-3.5 h-3.5" />
                            <span>{customer.phone}</span>
                            <MessageCircle className="w-3 h-3 text-emerald-500" />
                          </a>
                        )}

                        {customer.address && (
                          <span className="flex items-center gap-1 text-slate-500">
                            <Home className="w-3.5 h-3.5 text-slate-400" />
                            <span>{customer.address}</span>
                          </span>
                        )}

                        <span className="flex items-center gap-1 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-800/60 font-bold">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>Paga los días {customer.paymentDueDay || 5} de cada mes</span>
                        </span>

                        {customer.authorizedBy && (
                          <span className="text-[11px] text-slate-500">
                            Autorizado por: <strong className="text-slate-700 dark:text-slate-300">{customer.authorizedBy}</strong>
                          </span>
                        )}
                      </div>

                      {/* Nota del dueño */}
                      {customer.creditNotes && (
                        <p className="text-[11px] text-slate-500 italic bg-white/60 dark:bg-slate-900/60 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800">
                          "{customer.creditNotes}"
                        </p>
                      )}
                    </div>

                    {/* Columna Centro: Barra de Progreso y Deuda */}
                    <div className="w-full md:w-64 space-y-1 bg-white/70 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shrink-0">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[10px] font-black uppercase text-slate-500">Saldo Pendiente</span>
                        <span className={`text-base font-mono font-black ${isUpToDate ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {formatCLP(currentDebt)}
                        </span>
                      </div>

                      {/* Barra de Progreso */}
                      <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${
                            isOverLimit ? 'bg-rose-500' : percentUsed > 75 ? 'bg-amber-500' : 'bg-blue-600'
                          }`}
                          style={{ width: `${percentUsed}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono font-bold pt-0.5">
                        <span>Límite: {formatCLP(creditLimit)}</span>
                        <span>Disponible: {formatCLP(availableCredit)}</span>
                      </div>
                    </div>

                    {/* Columna Derecha: Botones de Acción */}
                    <div className="flex md:flex-col items-center justify-end gap-1.5 shrink-0">
                      
                      {/* Botón Abonar / Pagar Deuda */}
                      <button
                        type="button"
                        onClick={() => handleOpenPayment(customer)}
                        disabled={isUpToDate}
                        className={`w-full py-2 px-3.5 rounded-xl font-black text-xs transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer ${
                          isUpToDate
                            ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed opacity-60'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white active:scale-95'
                        }`}
                      >
                        <DollarSign className="w-3.5 h-3.5" />
                        <span>Abonar / Pagar</span>
                      </button>

                      {/* Botón Historial de Cuenta (Kardex) */}
                      <button
                        type="button"
                        onClick={() => handleOpenHistory(customer)}
                        className="w-full py-1.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <History className="w-3.5 h-3.5 text-blue-500" />
                        <span>Ver Cuenta</span>
                      </button>

                      {/* Botón Configurar Crédito (Solo Dueño) */}
                      {isOwner && (
                        <button
                          type="button"
                          onClick={() => handleOpenConfig(customer)}
                          className="w-full py-1 px-2.5 rounded-lg text-[11px] text-slate-500 hover:text-amber-700 dark:hover:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <Settings className="w-3 h-3" />
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

        {/* FOOTER: NOTA Y BOTÓN DE CIERRE */}
        <div className="px-4 sm:px-6 py-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs shrink-0">
          <span className="text-slate-500 flex items-center gap-1.5">
            <span>💡</span>
            <span>Las compras a fiado se emiten con boleta y los abonos se respaldan con ticket térmico de 80mm.</span>
          </span>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-black transition cursor-pointer"
          >
            Cerrar Libreta
          </button>
        </div>

      </div>

      {/* MODAL 1: REGISTRAR ABONO / PAGO DE CUENTA (PAGO TOTAL U OTRO MONTO) */}
      {selectedCustomerForPayment && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md rounded-3xl border-2 border-emerald-500 bg-white dark:bg-slate-900 shadow-2xl p-5 space-y-4 animate-scaleIn">
            
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center font-black">
                  $
                </div>
                <div>
                  <h3 className="font-black text-base text-slate-900 dark:text-white">
                    Registrar Pago / Abono de Fiado
                  </h3>
                  <p className="text-xs font-bold text-slate-500">
                    Vecino: <strong>{selectedCustomerForPayment.name}</strong> {selectedCustomerForPayment.alias ? `(${selectedCustomerForPayment.alias})` : ''}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCustomerForPayment(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Resumen Deuda Actual */}
            <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase text-amber-700 dark:text-amber-300 block">Deuda Pendiente Actual</span>
                <span className="text-xl font-mono font-black text-amber-800 dark:text-amber-200">
                  {formatCLP(selectedCustomerForPayment.currentDebt || 0)}
                </span>
              </div>
              <div className="text-right text-xs font-bold text-amber-700 dark:text-amber-400">
                <span>Día de pago: Días {selectedCustomerForPayment.paymentDueDay || 5}</span>
              </div>
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
                  onChange={e => setAmountToPayInput(e.target.value)}
                  placeholder="Ej: 10000"
                  className="w-full text-lg font-mono font-black p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                  autoFocus
                />
              </div>
            )}

            {/* Saldo Restante en tiempo real */}
            <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs flex items-center justify-between font-bold">
              <span className="text-slate-500">Saldo que quedará debiendo:</span>
              <span className="font-mono text-slate-900 dark:text-white font-black text-sm">
                {formatCLP(
                  Math.max(
                    0,
                    (selectedCustomerForPayment.currentDebt || 0) -
                      (paymentType === 'TOTAL' ? (selectedCustomerForPayment.currentDebt || 0) : Number(amountToPayInput || 0))
                  )
                )}
              </span>
            </div>

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
                        ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <span>{m.icon}</span>
                    <span>{m.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Observación Opcional */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block">
                Nota u Observación (Opcional):
              </label>
              <input
                type="text"
                value={paymentNotes}
                onChange={e => setPaymentNotes(e.target.value)}
                placeholder="Ej: Dejó pagado en caja..."
                className="w-full text-xs p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
              />
            </div>

            {/* Checkbox Impresión Térmica 80mm */}
            <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={shouldPrintTicket}
                onChange={e => setShouldPrintTicket(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
              />
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              <span>Imprimir comprobante en ticket térmico de 80mm para el cliente</span>
            </label>

            {/* Botones del Modal */}
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
                onClick={handleConfirmPayment}
                className="px-5 py-2.5 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-md transition flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirmar Pago de {formatCLP(paymentType === 'TOTAL' ? (selectedCustomerForPayment.currentDebt || 0) : Number(amountToPayInput))}</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL 2: HISTORIAL DE CUENTA CORRIENTE (KARDEX COMPRAS Y ABONOS) */}
      {selectedCustomerForHistory && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-3xl max-h-[92vh] flex flex-col rounded-3xl border-2 border-blue-500 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden animate-scaleIn">
            
            <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 flex items-center justify-center font-bold">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base text-slate-900 dark:text-white">
                    Historial de Cuenta Corriente (Kardex)
                  </h3>
                  <p className="text-xs font-bold text-slate-500">
                    Vecino: <strong>{selectedCustomerForHistory.name}</strong> {selectedCustomerForHistory.alias ? `(${selectedCustomerForHistory.alias})` : ''}
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

            {/* Resumen Superior y Gestión de Cupo (Aumentar / Disminuir Cupo Personalizado) */}
            <div className="p-4 bg-gradient-to-r from-blue-50/90 via-indigo-50/50 to-slate-50 dark:from-slate-800 dark:via-slate-850 dark:to-slate-800 border-b border-blue-100 dark:border-slate-800 space-y-3">
              {/* Tarjetas de Métricas de la Cuenta */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/50 shadow-2xs">
                  <span className="text-slate-500 dark:text-slate-400 block text-[10px] font-black uppercase tracking-wider">
                    DEUDA VIGENTE ACTUAL
                  </span>
                  <span className="text-base sm:text-lg font-mono font-black text-rose-600 block">
                    {formatCLP(selectedCustomerForHistory.currentDebt || 0)}
                  </span>
                </div>

                <div className="p-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-900/50 shadow-2xs">
                  <span className="text-slate-500 dark:text-slate-400 block text-[10px] font-black uppercase tracking-wider">
                    CUPO DISPONIBLE
                  </span>
                  <span className={`text-base sm:text-lg font-mono font-black block ${
                    ((selectedCustomerForHistory.creditLimit || 50000) - (selectedCustomerForHistory.currentDebt || 0)) < 0
                      ? 'text-rose-600'
                      : 'text-emerald-600'
                  }`}>
                    {formatCLP(Math.max(0, (selectedCustomerForHistory.creditLimit || 50000) - (selectedCustomerForHistory.currentDebt || 0)))}
                  </span>
                </div>

                <div className="p-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-900/50 shadow-2xs">
                  <span className="text-slate-500 dark:text-slate-400 block text-[10px] font-black uppercase tracking-wider">
                    CUPO AUTORIZADO
                  </span>
                  <span className="text-base sm:text-lg font-mono font-black text-slate-900 dark:text-white block">
                    {formatCLP(selectedCustomerForHistory.creditLimit || 50000)}
                  </span>
                </div>

                <div className="p-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/50 shadow-2xs">
                  <span className="text-slate-500 dark:text-slate-400 block text-[10px] font-black uppercase tracking-wider">
                    DÍA DE PAGO PACTADO
                  </span>
                  <span className="text-xs sm:text-sm font-black text-amber-800 dark:text-amber-300 block">
                    {selectedCustomerForHistory.paymentDueDay ? `Días ${selectedCustomerForHistory.paymentDueDay} del mes` : 'A convenir'}
                  </span>
                </div>
              </div>

              {/* Panel de Ajuste Rápido de Cupo (Aumentar / Disminuir) */}
              <div className="p-3 bg-white dark:bg-slate-900 rounded-2xl border-2 border-blue-200 dark:border-blue-800 shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-black text-slate-900 dark:text-white">
                    <Sliders className="w-4 h-4 text-blue-600" />
                    <span>Ajustar Cupo Autorizado de este Vecino:</span>
                  </div>
                  {cupoSaveSuccess && (
                    <span className="text-[11px] font-black text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950 px-2.5 py-0.5 rounded-full flex items-center gap-1 animate-fadeIn">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>¡Cupo y condiciones actualizados!</span>
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 px-2.5 py-1 rounded-xl border border-slate-300 dark:border-slate-700 min-w-[150px]">
                    <span className="text-xs font-mono font-bold text-slate-400">$</span>
                    <input
                      type="number"
                      value={historyCupoInput}
                      onChange={(e) => setHistoryCupoInput(e.target.value)}
                      className="w-full bg-transparent text-xs sm:text-sm font-mono font-black text-slate-900 dark:text-white focus:outline-none"
                      placeholder="Monto de cupo"
                    />
                  </div>

                  {/* Botones de disminución y aumento rápido de cupo */}
                  <div className="flex items-center gap-1 flex-wrap">
                    <button
                      type="button"
                      title="Disminuir cupo en $20.000"
                      onClick={() => handleQuickCupoAdjust(-20000)}
                      className="px-2 py-1 rounded-lg text-[10.5px] font-black bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900/80 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 cursor-pointer transition active:scale-95"
                    >
                      -$20.000
                    </button>
                    <button
                      type="button"
                      title="Disminuir cupo en $10.000"
                      onClick={() => handleQuickCupoAdjust(-10000)}
                      className="px-2 py-1 rounded-lg text-[10.5px] font-black bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900/80 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 cursor-pointer transition active:scale-95"
                    >
                      -$10.000
                    </button>
                    <button
                      type="button"
                      title="Disminuir cupo en $5.000"
                      onClick={() => handleQuickCupoAdjust(-5000)}
                      className="px-2 py-1 rounded-lg text-[10.5px] font-black bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900/80 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 cursor-pointer transition active:scale-95"
                    >
                      -$5.000
                    </button>
                    <button
                      type="button"
                      title="Aumentar cupo en $5.000"
                      onClick={() => handleQuickCupoAdjust(5000)}
                      className="px-2 py-1 rounded-lg text-[10.5px] font-black bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 cursor-pointer transition active:scale-95"
                    >
                      +$5.000
                    </button>
                    <button
                      type="button"
                      title="Aumentar cupo en $10.000"
                      onClick={() => handleQuickCupoAdjust(10000)}
                      className="px-2 py-1 rounded-lg text-[10.5px] font-black bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 cursor-pointer transition active:scale-95"
                    >
                      +$10.000
                    </button>
                    <button
                      type="button"
                      title="Aumentar cupo en $20.000"
                      onClick={() => handleQuickCupoAdjust(20000)}
                      className="px-2 py-1 rounded-lg text-[10.5px] font-black bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 cursor-pointer transition active:scale-95"
                    >
                      +$20.000
                    </button>
                    <button
                      type="button"
                      title="Aumentar cupo en $50.000"
                      onClick={() => handleQuickCupoAdjust(50000)}
                      className="px-2 py-1 rounded-lg text-[10.5px] font-black bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 cursor-pointer transition active:scale-95"
                    >
                      +$50.000
                    </button>
                  </div>

                  {/* Día de pago */}
                  <div className="flex items-center gap-1.5 ml-auto">
                    <span className="text-[11px] font-bold text-slate-500">Día de pago:</span>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={historyDueDayInput}
                      onChange={(e) => setHistoryDueDayInput(e.target.value)}
                      className="w-12 px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono font-black text-center"
                    />
                    <button
                      type="button"
                      onClick={handleSaveHistoryCupo}
                      className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs cursor-pointer shadow-xs active:scale-95 transition"
                    >
                      Guardar Cupo
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Listado Cronológico de Movimientos */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
              {customerHistoryMovements.length === 0 ? (
                <div className="py-8 px-4 text-center space-y-3">
                  {(selectedCustomerForHistory.currentDebt || 0) > 0 ? (
                    <div className="max-w-md mx-auto p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-center space-y-1.5">
                      <span className="text-[11px] font-black uppercase text-amber-900 dark:text-amber-200 block">
                        Saldo Inicial Registrado en Libreta de Fiado
                      </span>
                      <span className="text-xl font-mono font-black text-rose-600 block">
                        {formatCLP(selectedCustomerForHistory.currentDebt || 0)}
                      </span>
                      <p className="text-xs text-amber-800 dark:text-amber-300">
                        El vecino cuenta con este saldo deudor registrado en su cuenta. Las compras con boleta y abonos futuros que registre se detallarán automáticamente en este kardex.
                      </p>
                    </div>
                  ) : (
                    <div className="text-slate-500 dark:text-slate-400">
                      <p className="font-bold text-sm">Este vecino no tiene movimientos registrados aún.</p>
                      <p className="text-xs">Al realizar compras a fiado con boleta o abonos, aparecerán detallados cronológicamente aquí.</p>
                    </div>
                  )}
                </div>
              ) : (
                customerHistoryMovements.map(m => (
                  <div
                    key={m.id}
                    className={`p-3 rounded-2xl border flex items-center justify-between text-xs transition ${
                      m.type === 'COMPRA'
                        ? 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40'
                        : 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40'
                    }`}
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                          m.type === 'COMPRA'
                            ? 'bg-rose-200 text-rose-900 dark:bg-rose-900 dark:text-rose-200'
                            : 'bg-emerald-200 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-200'
                        }`}>
                          {m.type === 'COMPRA' ? '🛒 COMPRA A FIADO' : '💵 ABONO / PAGO'}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {m.folio}
                        </span>
                        <span className="text-slate-400">•</span>
                        <span className="text-[11px] text-slate-500 font-semibold">
                          {new Date(m.date).toLocaleString('es-CL')}
                        </span>
                      </div>
                      <p className="font-bold text-slate-800 dark:text-slate-200">
                        {m.description}
                      </p>
                      <span className="text-[10px] text-slate-400">
                        Registrado por: {m.registeredBy}
                      </span>
                    </div>

                    <div className="text-right font-mono">
                      <span className={`text-sm sm:text-base font-black ${
                        m.type === 'COMPRA' ? 'text-rose-600' : 'text-emerald-600'
                      }`}>
                        {m.type === 'COMPRA' ? `+${formatCLP(m.amount)}` : `-${formatCLP(m.amount)}`}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedCustomerForHistory(null)}
                className="px-5 py-2 rounded-xl text-xs font-black bg-slate-800 text-white hover:bg-slate-700 cursor-pointer"
              >
                Cerrar Historial
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL 3: CONFIGURACIÓN DE CRÉDITO / MODIFICAR LÍMITE (SOLO DUEÑO) */}
      {selectedCustomerForConfig && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md rounded-3xl border-2 border-amber-500 bg-white dark:bg-slate-900 shadow-2xl p-5 space-y-4 animate-scaleIn">
            
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-600 flex items-center justify-center font-bold">
                  <Settings className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-base text-slate-900 dark:text-white">
                    Condiciones de Crédito
                  </h3>
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold uppercase">
                    Exclusivo del Dueño del Local
                  </span>
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
              Vecino: <strong>{selectedCustomerForConfig.name}</strong> {selectedCustomerForConfig.alias ? `(${selectedCustomerForConfig.alias})` : ''}
            </div>

            <div className="space-y-3 text-xs">
              {/* Activar / Suspender Crédito */}
              <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                <div>
                  <span className="font-black block text-slate-900 dark:text-white">Estado del Crédito</span>
                  <span className="text-slate-500 text-[11px]">Permitir o bloquear compras a fiado</span>
                </div>
                <select
                  value={editStatus}
                  onChange={e => setEditStatus(e.target.value as any)}
                  className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 font-bold"
                >
                  <option value="AL_DIA">Habilitado (Activo)</option>
                  <option value="CON_DEUDA">Con Deuda (Activo)</option>
                  <option value="BLOQUEADO">Bloqueado / Suspendido</option>
                </select>
              </div>

              {/* Límite de Crédito en Pesos */}
              <div className="space-y-1">
                <label className="font-black text-slate-800 dark:text-slate-200 block">
                  Cupo Máximo Autorizado en Pesos ($):
                </label>
                <input
                  type="number"
                  step="5000"
                  value={editLimit}
                  onChange={e => setEditLimit(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono font-black text-base"
                />
                <span className="text-[10px] text-slate-500">Monto tope hasta el cual el vecino puede llevar productos a fiado.</span>
              </div>

              {/* Día Pactado de Pago */}
              <div className="space-y-1">
                <label className="font-black text-slate-800 dark:text-slate-200 block">
                  Día del Mes Pactado para Pago:
                </label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={editDueDay}
                  onChange={e => setEditDueDay(e.target.value)}
                  placeholder="Ej: 5 (Día 5 de cada mes)"
                  className="w-full p-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold"
                />
              </div>

              {/* Notas y Acuerdos */}
              <div className="space-y-1">
                <label className="font-black text-slate-800 dark:text-slate-200 block">
                  Condiciones / Acuerdos del Dueño:
                </label>
                <textarea
                  rows={2}
                  value={editNotes}
                  onChange={e => setEditNotes(e.target.value)}
                  placeholder="Ej: Vecino de confianza, cancela quincena y fin de mes..."
                  className="w-full p-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
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
                className="px-5 py-2 rounded-xl text-xs font-black bg-amber-600 hover:bg-amber-700 text-white shadow-md cursor-pointer"
              >
                Guardar Cambios
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL 4: + AUTORIZAR NUEVO CRÉDITO A VECINO / PERSONA NORMAL (SOLO DUEÑO) */}
      {isNewCreditCustomerOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg rounded-3xl border-2 border-amber-500 bg-white dark:bg-slate-900 shadow-2xl p-5 space-y-4 animate-scaleIn">
            
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-600 flex items-center justify-center font-bold">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base text-slate-900 dark:text-white">
                    Autorizar Crédito a Vecino / Persona
                  </h3>
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold uppercase">
                    Libreta de Fiados (Compras con Boleta)
                  </span>
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

            <p className="text-xs text-slate-500">
              Complete los datos del vecino o persona de confianza que llevará mercadería a fiado:
            </p>

            <div className="space-y-2.5 text-xs max-h-[60vh] overflow-y-auto pr-1">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="font-black text-slate-800 dark:text-slate-200 block mb-1">
                    Nombre y Apellido *
                  </label>
                  <input
                    type="text"
                    required
                    value={newCustName}
                    onChange={e => setNewCustName(e.target.value)}
                    placeholder="Ej: Carlos Fuentes Morales"
                    className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
                  />
                </div>

                <div>
                  <label className="font-black text-slate-800 dark:text-slate-200 block mb-1">
                    Apodo / Referencia Vecinal
                  </label>
                  <input
                    type="text"
                    value={newCustAlias}
                    onChange={e => setNewCustAlias(e.target.value)}
                    placeholder="Ej: Don Carlos, Pasaje Los Robles #142"
                    className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="font-black text-slate-800 dark:text-slate-200 block mb-1">
                    Teléfono Celular / WhatsApp
                  </label>
                  <input
                    type="text"
                    value={newCustPhone}
                    onChange={e => setNewCustPhone(e.target.value)}
                    placeholder="Ej: +569 8765 4321"
                    className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="font-black text-slate-800 dark:text-slate-200 block mb-1">
                    RUT Personal (Opcional)
                  </label>
                  <input
                    type="text"
                    value={newCustRut}
                    onChange={e => setNewCustRut(e.target.value)}
                    placeholder="Ej: 12.345.678-9"
                    className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="font-black text-slate-800 dark:text-slate-200 block mb-1">
                  Dirección del Domicilio / Casa
                </label>
                <input
                  type="text"
                  value={newCustAddress}
                  onChange={e => setNewCustAddress(e.target.value)}
                  placeholder="Ej: Pasaje Los Robles #142, Barrio Sur"
                  className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-slate-200 dark:border-slate-800">
                <div>
                  <label className="font-black text-slate-800 dark:text-slate-200 block mb-1">
                    Cupo Máximo Autorizado ($) *
                  </label>
                  <input
                    type="number"
                    step="5000"
                    required
                    value={newCustLimit}
                    onChange={e => setNewCustLimit(e.target.value)}
                    placeholder="Ej: 50000"
                    className="w-full p-2.5 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/30 font-mono font-black text-sm text-amber-900 dark:text-amber-200"
                  />
                </div>

                <div>
                  <label className="font-black text-slate-800 dark:text-slate-200 block mb-1">
                    Día del Mes para Pagar
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={newCustDueDay}
                    onChange={e => setNewCustDueDay(e.target.value)}
                    placeholder="Ej: 5 (Día 5 de cada mes)"
                    className="w-full p-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="font-black text-slate-800 dark:text-slate-200 block mb-1">
                  Notas / Acuerdos del Dueño:
                </label>
                <textarea
                  rows={2}
                  value={newCustNotes}
                  onChange={e => setNewCustNotes(e.target.value)}
                  placeholder="Ej: Vecino de confianza, cancela los días 5 al cobrar jubilación..."
                  className="w-full p-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
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
                Autorizar y Guardar en Libreta
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
