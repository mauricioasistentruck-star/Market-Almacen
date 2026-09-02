import { useBodyScrollLock } from '../../utils/scrollLock';
import React, { useState, useEffect, useMemo } from 'react';
import jsPDF from 'jspdf';
import { useTheme } from '../../utils/themeContext';
import { useCompany } from '../../utils/companyContext';
import { db } from '../../db/database';
import { formatRut } from '../../utils/barcodeGenerator';
import { formatCLP, generateSaleInvoicePDF } from '../../utils/salesPdfGenerator';
import { notifyLocalMutation } from '../../utils/cloudSync';
import { PDFViewerModal } from '../PDFViewerModal';
import type { Customer, Sale, SiiConfig } from '../../types';
import {
  X,
  Building2,
  Plus,
  Search,
  Pencil,
  Trash2,
  Check,
  Phone,
  Mail,
  MapPin,
  Briefcase,
  FileCheck2,
  Users,
  FileText,
  Eye,
  Download,
  Send,
  ArrowLeft,
  Calendar,
  DollarSign,
  ChevronDown,
  ChevronUp,
  AlertCircle
} from 'lucide-react';

interface CustomerManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CustomerManagerModal: React.FC<CustomerManagerModalProps> = ({
  isOpen,
  onClose
}) => {
  useBodyScrollLock(Boolean(isOpen));
  const { themeClasses } = useTheme();
  const { selectedCompanyId, selectedCompany } = useCompany();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [siiConfig, setSiiConfig] = useState<SiiConfig | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Modos de vista
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [historyCustomer, setHistoryCustomer] = useState<Customer | null>(null);

  // Estados del visor PDF y envío de correo
  const [viewingPdfDoc, setViewingPdfDoc] = useState<jsPDF | null>(null);
  const [viewingPdfFilename, setViewingPdfFilename] = useState('');
  const [viewingPdfTitle, setViewingPdfTitle] = useState('');

  const [emailModalSale, setEmailModalSale] = useState<Sale | null>(null);
  const [emailRecipient, setEmailRecipient] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [emailSuccessMsg, setEmailSuccessMsg] = useState<string | null>(null);

  // Ítems expandidos en el historial
  const [expandedSaleId, setExpandedSaleId] = useState<number | null>(null);

  // Campos del Formulario de Factura
  const [rut, setRut] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [tradeName, setTradeName] = useState('');
  const [industry, setIndustry] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [contactName, setContactName] = useState('');

  const loadData = async () => {
    try {
      const allCustomers = await db.customers.toArray();
      const filteredCustomers = allCustomers.filter(c => {
        if (!c.companyId || selectedCompanyId === 'ALL') return true;
        return c.companyId === selectedCompanyId;
      });
      setCustomers(filteredCustomers);

      const allSales = await db.sales.toArray();
      const filteredSales = allSales.filter(s => {
        if (selectedCompanyId !== 'ALL' && s.companyId && s.companyId !== selectedCompanyId) return false;
        return s.dteType === 'FACTURA_ELECTRONICA';
      });
      setSales(filteredSales);

      // Cargar config SII para emisión de PDF
      const configs = await db.siiConfigs.toArray();
      const matchedConfig = configs.find(c => {
        if (selectedCompanyId !== 'ALL' && c.companyId) {
          return c.companyId === selectedCompanyId;
        }
        return true;
      });
      setSiiConfig(matchedConfig || null);
    } catch (err) {
      console.error('Error al cargar datos de clientes y facturas:', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
      setIsFormOpen(false);
      setEditingCustomer(null);
      setHistoryCustomer(null);
      setEmailModalSale(null);
    }
  }, [isOpen, selectedCompanyId]);

  // Mapa de facturas por RUT limpio del cliente
  const customerSalesMap = useMemo(() => {
    const map: Record<string, Sale[]> = {};
    for (const sale of sales) {
      if (sale.customerRut) {
        const clean = sale.customerRut.replace(/[^0-9kK]/g, '').toUpperCase();
        if (!map[clean]) map[clean] = [];
        map[clean].push(sale);
      }
    }
    return map;
  }, [sales]);

  const openNewForm = () => {
    setEditingCustomer(null);
    setRut('');
    setBusinessName('');
    setTradeName('');
    setIndustry('');
    setAddress('');
    setCity('');
    setEmail('');
    setPhone('');
    setContactName('');
    setIsFormOpen(true);
    setHistoryCustomer(null);
  };

  const openEditForm = (cust: Customer) => {
    setEditingCustomer(cust);
    setRut(cust.rut || '');
    setBusinessName(cust.businessName || '');
    setTradeName(cust.tradeName || '');
    setIndustry(cust.industry || '');
    setAddress(cust.address || '');
    setCity(cust.city || '');
    setEmail(cust.email || '');
    setPhone(cust.phone || '');
    setContactName(cust.contactName || '');
    setIsFormOpen(true);
    setHistoryCustomer(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rut.trim() || !businessName.trim()) {
      alert('Por favor complete al menos el RUT y la Razón Social del cliente.');
      return;
    }

    const formattedRut = formatRut(rut.trim());

    if (editingCustomer && editingCustomer.id) {
      await db.customers.update(editingCustomer.id, {
        rut: formattedRut,
        businessName: businessName.trim().toUpperCase(),
        tradeName: tradeName.trim(),
        industry: industry.trim(),
        address: address.trim(),
        city: city.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        contactName: contactName.trim(),
        updatedAt: new Date().toISOString()
      });
    } else {
      const newCust: Customer = {
        rut: formattedRut,
        businessName: businessName.trim().toUpperCase(),
        tradeName: tradeName.trim(),
        industry: industry.trim(),
        address: address.trim(),
        city: city.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        contactName: contactName.trim(),
        companyId: selectedCompanyId !== 'ALL' ? selectedCompanyId : undefined,
        createdAt: new Date().toISOString()
      };
      await db.customers.add(newCust);
    }

    notifyLocalMutation();
    await loadData();
    setIsFormOpen(false);
    setEditingCustomer(null);
  };

  const handleDelete = async (cust: Customer) => {
    if (!cust.id) return;
    if (window.confirm(`¿Está seguro de eliminar al cliente "${cust.businessName}" (${cust.rut})?`)) {
      await db.customers.delete(cust.id);
      notifyLocalMutation();
      await loadData();
    }
  };

  // Abrir Historial de Facturas de un Cliente
  const handleOpenHistory = (cust: Customer) => {
    setHistoryCustomer(cust);
    setIsFormOpen(false);
    setEditingCustomer(null);
  };

  // Generar y Visualizar PDF de Factura
  const handleViewInvoicePdf = (sale: Sale) => {
    const doc = generateSaleInvoicePDF(sale, selectedCompany || undefined, siiConfig || undefined);
    setViewingPdfDoc(doc);
    setViewingPdfFilename(`Factura_${sale.folio}.pdf`);
    setViewingPdfTitle(`Factura Electrónica Folio N° ${sale.folio}`);
  };

  // Descargar directamente el PDF de Factura
  const handleDownloadInvoicePdf = (sale: Sale) => {
    const doc = generateSaleInvoicePDF(sale, selectedCompany || undefined, siiConfig || undefined);
    doc.save(`Factura_${sale.folio}.pdf`);
  };

  // Abrir modal para Enviar Factura por Correo
  const handleOpenEmailModal = (sale: Sale) => {
    const targetEmail = sale.customerEmail || historyCustomer?.email || '';
    const companyTitle = selectedCompany?.name || 'MARKET ALMACÉN';
    
    setEmailModalSale(sale);
    setEmailRecipient(targetEmail);
    setEmailSubject(`Factura Electrónica Folio N° ${sale.folio} — ${companyTitle}`);
    setEmailBody(
`Estimados ${sale.customerName || historyCustomer?.businessName || 'Clientes'},

Adjuntamos a continuación la Factura Electrónica Folio N° ${sale.folio}, emitida con fecha ${sale.date} ${sale.time || ''} por un monto total de ${formatCLP(sale.total)}.

Resumen Tributario:
- Monto Neto: ${formatCLP(sale.subtotalNeto)}
- IVA (19%): ${formatCLP(sale.iva)}
- Total a Pagar: ${formatCLP(sale.total)}
- Forma de Pago: ${sale.paymentMethod}

Agradecemos sinceramente su preferencia.
Saludos cordiales,
${companyTitle}`
    );
    setEmailSuccessMsg(null);
  };

  // Abrir en cliente de correo local (mailto) y descargar PDF para adjuntar
  const handleLaunchMailto = () => {
    if (!emailModalSale) return;
    handleDownloadInvoicePdf(emailModalSale);

    const mailtoUrl = `mailto:${encodeURIComponent(emailRecipient)}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
    window.open(mailtoUrl, '_blank');

    setEmailSuccessMsg('Se ha descargado el archivo PDF en su equipo y se abrió su cliente de correo. Adjunte el PDF descargado para completar el envío.');
  };

  // Registrar Envío por Correo en la base de datos
  const handleConfirmEmailSent = async () => {
    if (!emailModalSale || !emailModalSale.id) return;
    const nowIso = new Date().toISOString();
    await db.sales.update(emailModalSale.id, {
      emailSentAt: nowIso,
      emailSentTo: emailRecipient
    });
    notifyLocalMutation();
    await loadData();
    setEmailSuccessMsg(`✓ Se ha registrado exitosamente el envío de la factura a "${emailRecipient}".`);
    setTimeout(() => {
      setEmailModalSale(null);
    }, 1800);
  };

  const filteredList = useMemo(() => {
    if (!searchTerm.trim()) return customers;
    const term = searchTerm.toLowerCase();
    return customers.filter(c =>
      c.rut.toLowerCase().includes(term) ||
      c.businessName.toLowerCase().includes(term) ||
      (c.industry && c.industry.toLowerCase().includes(term)) ||
      (c.city && c.city.toLowerCase().includes(term)) ||
      (c.email && c.email.toLowerCase().includes(term))
    );
  }, [customers, searchTerm]);

  if (!isOpen) return null;

  // Facturas del cliente actualmente en vista de historial
  const currentCustomerCleanRut = historyCustomer ? historyCustomer.rut.replace(/[^0-9kK]/g, '').toUpperCase() : '';
  const currentCustomerInvoices = historyCustomer ? (customerSalesMap[currentCustomerCleanRut] || []) : [];
  const totalFacturadoHistorico = currentCustomerInvoices.reduce((sum, s) => sum + (s.total || 0), 0);

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
        <div className={`w-full max-w-3xl rounded-3xl border-2 ${themeClasses.border} ${themeClasses.card} p-4 sm:p-6 shadow-2xl flex flex-col max-h-[92vh] overflow-hidden`}>
          
          {/* Encabezado */}
          <div className="flex items-center justify-between pb-3.5 border-b border-slate-700/40 shrink-0">
            <div className="flex items-center gap-3">
              {historyCustomer ? (
                <button
                  type="button"
                  onClick={() => setHistoryCustomer(null)}
                  className="p-2 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400 hover:bg-blue-500/25 transition cursor-pointer"
                  title="Volver a la lista de clientes"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
              ) : (
                <div className="p-2.5 rounded-2xl bg-blue-500/15 text-blue-500 shadow-sm">
                  <Building2 className="w-6 h-6" />
                </div>
              )}
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-black text-base sm:text-lg leading-tight text-slate-900 dark:text-white">
                    {historyCustomer ? `Historial de Facturas — ${historyCustomer.businessName}` : 'Clientes Registrados con Factura'}
                  </h3>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-300 font-extrabold border border-blue-500/30">
                    {selectedCompany?.name || 'Local'}
                  </span>
                </div>
                <p className={`text-xs ${themeClasses.textMuted} font-bold`}>
                  {historyCustomer
                    ? `RUT: ${historyCustomer.rut} • ${currentCustomerInvoices.length} facturas emitidas • Total: ${formatCLP(totalFacturadoHistorico)}`
                    : 'Base de datos de empresas, historial de compras tributarias y envío de facturas PDF'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Contenido */}
          <div className="my-3.5 overflow-y-auto space-y-4 pr-1 flex-1">
            
            {/* VISTA 1: HISTORIAL DE FACTURAS DE UN CLIENTE SELECCIONADO */}
            {historyCustomer ? (
              <div className="space-y-4">
                {/* Banner Resumen del Cliente */}
                <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/80 flex flex-col sm:flex-row justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-black text-sm text-slate-900 dark:text-slate-100">{historyCustomer.businessName}</h4>
                      <span className="text-xs font-black text-blue-600 dark:text-blue-400">RUT: {historyCustomer.rut}</span>
                    </div>
                    {historyCustomer.industry && (
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">Giro: <strong>{historyCustomer.industry}</strong></p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1 flex-wrap font-medium">
                      {historyCustomer.email && <span>Email: {historyCustomer.email}</span>}
                      {historyCustomer.phone && <span>Tel: {historyCustomer.phone}</span>}
                      {historyCustomer.address && <span>Dirección: {historyCustomer.address}{historyCustomer.city ? `, ${historyCustomer.city}` : ''}</span>}
                    </div>
                  </div>
                  <div className="self-start sm:self-center shrink-0 text-right">
                    <span className="text-[10px] font-black uppercase text-slate-500 block">Total Facturado Histórico</span>
                    <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">{formatCLP(totalFacturadoHistorico)}</span>
                  </div>
                </div>

                {/* Lista de Facturas del Cliente */}
                {currentCustomerInvoices.length > 0 ? (
                  <div className="space-y-2.5">
                    <div className="flex justify-between items-center text-xs font-bold text-slate-500">
                      <span>{currentCustomerInvoices.length} Facturas Registradas</span>
                      <span className="text-slate-400">Ordenadas de la más reciente a la más antigua</span>
                    </div>

                    {currentCustomerInvoices.map((sale) => {
                      const isExpanded = expandedSaleId === sale.id;
                      const isCancelled = sale.status === 'ANULADA';

                      return (
                        <div
                          key={sale.id}
                          className={`p-3.5 rounded-2xl border ${
                            isCancelled
                              ? 'border-red-300 dark:border-red-900 bg-red-50/40 dark:bg-red-950/20'
                              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-xs hover:border-blue-500/40'
                          } transition`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-black px-2.5 py-0.5 rounded-lg bg-blue-600 text-white font-mono shadow-xs">
                                  {sale.folio}
                                </span>
                                <span className="text-xs text-slate-500 font-bold flex items-center gap-1">
                                  <Calendar className="w-3.5 h-3.5" />
                                  <span>{sale.date} {sale.time || ''}</span>
                                </span>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                                  isCancelled
                                    ? 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300'
                                    : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                                }`}>
                                  {isCancelled ? 'ANULADA' : 'EMITIDA'}
                                </span>
                                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold">
                                  {sale.paymentMethod}
                                </span>
                              </div>

                              <div className="flex items-center gap-3 text-xs mt-1.5 flex-wrap">
                                <span>Neto: <strong>{formatCLP(sale.subtotalNeto)}</strong></span>
                                <span>IVA (19%): <strong>{formatCLP(sale.iva)}</strong></span>
                                <span className="text-sm font-black text-slate-900 dark:text-white">
                                  Total: {formatCLP(sale.total)}
                                </span>
                              </div>

                              {/* Distintivo si ya fue enviada por correo */}
                              {sale.emailSentAt && (
                                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold mt-1 flex items-center gap-1">
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Enviada por correo a <strong>{sale.emailSentTo}</strong> ({new Date(sale.emailSentAt).toLocaleDateString()})</span>
                                </p>
                              )}
                            </div>

                            {/* Botones de Acción para esta Factura */}
                            <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                              <button
                                type="button"
                                onClick={() => handleViewInvoicePdf(sale)}
                                className="px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-blue-50 text-xs font-bold text-slate-700 dark:text-slate-200 transition flex items-center gap-1 cursor-pointer"
                                title="Visualizar Factura en PDF"
                              >
                                <Eye className="w-3.5 h-3.5 text-blue-500" />
                                <span>Ver</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDownloadInvoicePdf(sale)}
                                className="px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-blue-50 text-xs font-bold text-slate-700 dark:text-slate-200 transition flex items-center gap-1 cursor-pointer"
                                title="Descargar Factura en PDF"
                              >
                                <Download className="w-3.5 h-3.5 text-emerald-500" />
                                <span>PDF</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleOpenEmailModal(sale)}
                                className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black transition flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
                                title="Enviar Factura por Correo Electrónico al Cliente"
                              >
                                <Mail className="w-3.5 h-3.5" />
                                <span>Enviar Correo</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => setExpandedSaleId(isExpanded ? null : (sale.id || null))}
                                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                                title="Ver ítems comprados"
                              >
                                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              </button>
                            </div>
                          </div>

                          {/* Detalle Desplegable de Ítems */}
                          {isExpanded && sale.items && sale.items.length > 0 && (
                            <div className="mt-3 pt-2.5 border-t border-slate-200 dark:border-slate-800 space-y-1 text-xs">
                              <span className="text-[11px] font-black text-slate-500 block uppercase">
                                Ítems de esta Factura ({sale.items.length}):
                              </span>
                              <div className="bg-slate-50 dark:bg-slate-800/60 p-2 rounded-xl space-y-1">
                                {sale.items.map((it, idx) => (
                                  <div key={idx} className="flex justify-between items-center text-slate-700 dark:text-slate-300">
                                    <span className="font-medium truncate max-w-xs sm:max-w-md">
                                      {it.quantity} {it.unit || 'UN'} × {it.productName}
                                    </span>
                                    <span className="font-bold shrink-0">{formatCLP(it.subtotal)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-8 text-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 text-slate-500">
                    <FileText className="w-10 h-10 mx-auto mb-2 opacity-30 text-blue-500" />
                    <p className="text-sm font-bold">No hay facturas emitidas para este cliente todavía</p>
                    <p className="text-xs mt-1">Al emitir una Factura Electrónica con el RUT de este cliente en el Terminal POS, quedará registrada automáticamente aquí.</p>
                  </div>
                )}
              </div>
            ) : !isFormOpen ? (
              /* VISTA 2: LISTADO GENERAL DE CLIENTES FACTURA */
              <div>
                {/* Barra Superior: Búsqueda y Botón Nuevo */}
                <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2.5 mb-3">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Buscar cliente por RUT, Razón Social, Giro o Comuna..."
                      className="w-full pl-9 pr-3 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                    />
                  </div>
                  <button
                    onClick={openNewForm}
                    className="flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-black rounded-xl bg-blue-600 hover:bg-blue-700 transition text-white shadow-md cursor-pointer shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    Registrar Cliente Factura
                  </button>
                </div>

                {/* Contador */}
                <div className="flex justify-between items-center text-xs font-bold text-slate-500 mb-2">
                  <span>{filteredList.length} Clientes Factura Guardados</span>
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-extrabold flex items-center gap-1">
                    <FileCheck2 className="w-3.5 h-3.5" />
                    Autocompletado activo al tipear RUT en caja
                  </span>
                </div>

                {/* Listado de Tarjetas de Clientes */}
                {filteredList.length > 0 ? (
                  <div className="space-y-2.5">
                    {filteredList.map((c) => {
                      const cleanRut = c.rut.replace(/[^0-9kK]/g, '').toUpperCase();
                      const clientInvoices = customerSalesMap[cleanRut] || [];
                      const facturasCount = clientInvoices.length;

                      return (
                        <div
                          key={c.id}
                          className={`p-3.5 rounded-2xl border ${themeClasses.border} ${themeClasses.cardSubtle} flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs hover:border-blue-500/40 transition`}
                        >
                          <div className="flex items-start gap-3 min-w-0">
                            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-500 shrink-0 mt-0.5">
                              <Building2 className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="font-black text-sm text-slate-900 dark:text-slate-100">{c.businessName}</h4>
                                {c.tradeName && (
                                  <span className="text-xs text-slate-500 font-bold">({c.tradeName})</span>
                                )}
                                {facturasCount > 0 && (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-black border border-emerald-500/30">
                                    {facturasCount} {facturasCount === 1 ? 'Factura' : 'Facturas'}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1 flex-wrap font-medium">
                                <span>RUT: <strong className="text-blue-600 dark:text-blue-400">{c.rut}</strong></span>
                                {c.industry && <span>Giro: <strong className="text-slate-700 dark:text-slate-200">{c.industry}</strong></span>}
                                {c.phone && <span>Tel: {c.phone}</span>}
                                {c.email && <span>Email DTE: {c.email}</span>}
                              </div>
                              {c.address && (
                                <p className="text-[11px] text-slate-400 mt-0.5 truncate flex items-center gap-1">
                                  <MapPin className="w-3 h-3 shrink-0" />
                                  <span>{c.address}{c.city ? `, ${c.city}` : ''}</span>
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                            {/* Botón Ver Historial de Facturas */}
                            <button
                              onClick={() => handleOpenHistory(c)}
                              className="px-3 py-1.5 text-xs font-black rounded-xl bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 transition flex items-center gap-1 cursor-pointer shadow-xs"
                              title="Ver historial de facturas y compras realizadas"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>Facturas ({facturasCount})</span>
                            </button>

                            <button
                              onClick={() => openEditForm(c)}
                              className="p-2 text-slate-500 hover:text-blue-500 hover:bg-blue-500/10 rounded-xl transition cursor-pointer"
                              title="Modificar datos de facturación"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(c)}
                              className="p-2 text-slate-500 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition cursor-pointer"
                              title="Eliminar cliente"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-8 text-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 text-slate-500">
                    <Users className="w-10 h-10 mx-auto mb-2 opacity-30 text-blue-500" />
                    <p className="text-sm font-bold">No hay clientes de factura guardados</p>
                    <p className="text-xs mt-1">Cada vez que emita una Factura en caja, los datos del cliente se guardarán automáticamente aquí para autocompletarse en futuras compras.</p>
                  </div>
                )}
              </div>
            ) : (
              /* VISTA 3: FORMULARIO CREAR / EDITAR CLIENTE */
              <form onSubmit={handleSave} className="space-y-4 bg-slate-50 dark:bg-slate-900/80 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800">
                <div className="flex justify-between items-center pb-2.5 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <Briefcase className="w-4.5 h-4.5 text-blue-500" />
                    <h4 className="font-black text-sm sm:text-base text-slate-900 dark:text-white">
                      {editingCustomer ? 'Modificar Datos de Facturación de Cliente' : 'Inscripción de Cliente para Factura'}
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="text-xs font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-black text-slate-800 dark:text-slate-200 mb-1">
                      RUT del Cliente / Empresa *
                    </label>
                    <input
                      type="text"
                      required
                      value={rut}
                      onChange={(e) => setRut(e.target.value)}
                      placeholder="Ej: 76.987.654-3"
                      className={`w-full px-3 py-2 text-xs font-bold rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-slate-900 dark:text-slate-100`}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-800 dark:text-slate-200 mb-1">
                      Razón Social *
                    </label>
                    <input
                      type="text"
                      required
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      placeholder="Ej: CONSTRUCTORA DEL SUR SpA"
                      className={`w-full px-3 py-2 text-xs font-bold uppercase rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-slate-900 dark:text-slate-100`}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-800 dark:text-slate-200 mb-1">
                      Nombre de Fantasía (Opcional)
                    </label>
                    <input
                      type="text"
                      value={tradeName}
                      onChange={(e) => setTradeName(e.target.value)}
                      placeholder="Ej: Constructora Sur"
                      className={`w-full px-3 py-2 text-xs font-bold rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-slate-900 dark:text-slate-100`}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-800 dark:text-slate-200 mb-1">
                      Giro Comercial (Exigido por SII) *
                    </label>
                    <input
                      type="text"
                      required
                      value={industry}
                      onChange={(e) => setIndustry(e.target.value)}
                      placeholder="Ej: Obras Menores en Construcción"
                      className={`w-full px-3 py-2 text-xs font-bold rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-slate-900 dark:text-slate-100`}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-800 dark:text-slate-200 mb-1">
                      Dirección Casa Matriz / Sucursal *
                    </label>
                    <input
                      type="text"
                      required
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Ej: Av. Los Conquistadores 1234"
                      className={`w-full px-3 py-2 text-xs font-bold rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-slate-900 dark:text-slate-100`}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-800 dark:text-slate-200 mb-1">
                      Comuna / Ciudad *
                    </label>
                    <input
                      type="text"
                      required
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="Ej: Providencia, Santiago"
                      className={`w-full px-3 py-2 text-xs font-bold rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-slate-900 dark:text-slate-100`}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-800 dark:text-slate-200 mb-1">
                      Correo Electrónico para Factura Electrónica (DTE) *
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="facturas@constructorasur.cl"
                      className={`w-full px-3 py-2 text-xs font-bold rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-slate-900 dark:text-slate-100`}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-800 dark:text-slate-200 mb-1">
                      Teléfono de Contacto
                    </label>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+56 9 7654 3210"
                      className={`w-full px-3 py-2 text-xs font-bold rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-slate-900 dark:text-slate-100`}
                    />
                  </div>
                </div>

                {/* Botones */}
                <div className="flex justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-800 transition cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 px-5 py-2 text-xs font-black rounded-xl bg-blue-600 hover:bg-blue-700 transition text-white shadow-md cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    {editingCustomer ? 'Guardar Cambios' : 'Registrar Cliente'}
                  </button>
                </div>
              </form>
            )}

          </div>
        </div>
      </div>

      {/* MODAL PARA ENVIAR FACTURA POR CORREO ELECTRÓNICO */}
      {emailModalSale && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg rounded-3xl border-2 border-blue-500 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-base font-black text-slate-900 dark:text-white">
                    Enviar Factura por Correo
                  </h4>
                  <p className="text-xs text-slate-500 font-bold">
                    Folio: <strong>{emailModalSale.folio}</strong> • Total: <strong>{formatCLP(emailModalSale.total)}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEmailModalSale(null)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {emailSuccessMsg && (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-start gap-2">
                <Check className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
                <span>{emailSuccessMsg}</span>
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-black text-slate-800 dark:text-slate-200 mb-1">
                  Destinatario (Correo Electrónico del Cliente) *
                </label>
                <input
                  type="email"
                  required
                  value={emailRecipient}
                  onChange={(e) => setEmailRecipient(e.target.value)}
                  placeholder="cliente@empresa.cl"
                  className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-black text-slate-800 dark:text-slate-200 mb-1">
                  Asunto del Mensaje
                </label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-black text-slate-800 dark:text-slate-200 mb-1">
                  Cuerpo del Mensaje
                </label>
                <textarea
                  rows={6}
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono font-medium rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/80 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-600" />
                  <span className="font-bold text-slate-700 dark:text-slate-200">Factura_{emailModalSale.folio}.pdf</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleDownloadInvoicePdf(emailModalSale)}
                  className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 text-blue-600 hover:text-blue-700 text-xs font-black border border-blue-200 dark:border-slate-700 shadow-2xs flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3 h-3" />
                  <span>Descargar PDF</span>
                </button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setEmailModalSale(null)}
                className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
              >
                Cerrar
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleLaunchMailto}
                  className="flex-1 sm:flex-initial px-3.5 py-2 text-xs font-black rounded-xl border border-blue-300 dark:border-blue-700 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                  title="Abre su cliente de correo predeterminado y descarga el PDF"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Abrir en Gmail / Outlook</span>
                </button>

                <button
                  type="button"
                  onClick={handleConfirmEmailSent}
                  className="flex-1 sm:flex-initial px-4 py-2 text-xs font-black rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                  title="Marcar y registrar en el sistema que la factura fue entregada por correo"
                >
                  <Check className="w-4 h-4" />
                  <span>Registrar Envío</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VISOR MODAL DE PDF */}
      <PDFViewerModal
        isOpen={Boolean(viewingPdfDoc)}
        onClose={() => setViewingPdfDoc(null)}
        doc={viewingPdfDoc}
        filename={viewingPdfFilename}
        title={viewingPdfTitle}
      />
    </>
  );
};
