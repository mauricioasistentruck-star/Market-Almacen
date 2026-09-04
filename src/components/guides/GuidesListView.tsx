import React, { useState, useEffect } from 'react';
import type { ReceptionGuide, DeliveryGuide, Company } from '../../types';
import { useTheme } from '../../utils/themeContext';
import { useCompany } from '../../utils/companyContext';
import { useAuth } from '../../utils/authContext';
import { db } from '../../db/database';
import { generateReceptionGuidePDF, generateDeliveryGuidePDF, downloadPDF, printPDF, sharePDFDocument } from '../../utils/pdfGenerator';
import { triggerCloudSync } from '../../utils/cloudSync';
import { ImageViewerModal } from '../ImageViewerModal';
import { PDFViewerModal } from '../PDFViewerModal';
import { GuideDocumentVisualizer } from './GuideDocumentVisualizer';
import {
  FileCheck,
  Send,
  Search,
  Download,
  Printer,
  MessageSquare,
  Trash2,
  Calendar,
  User,
  Car,
  Plus,
  FileText,
  Eye,
  Link as LinkIcon,
  Building2,
  CheckCircle2,
  Lock
} from 'lucide-react';

interface GuidesListViewProps {
  onOpenNewReception: () => void;
  onOpenNewDelivery: () => void;
  refreshTrigger: number;
}

export const GuidesListView: React.FC<GuidesListViewProps> = ({
  onOpenNewReception,
  onOpenNewDelivery,
  refreshTrigger
}) => {
  const { themeClasses } = useTheme();
  const { companies, selectedCompanyId } = useCompany();
  const { isReadOnly } = useAuth();

  const [activeTab, setActiveTab] = useState<'reception' | 'delivery'>('reception');
  const [receptionGuides, setReceptionGuides] = useState<ReceptionGuide[]>([]);
  const [deliveryGuides, setDeliveryGuides] = useState<DeliveryGuide[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Scanned Document Viewer Modal State
  const [viewDocumentUrl, setViewDocumentUrl] = useState<string | null>(null);
  const [viewDocumentTitle, setViewDocumentTitle] = useState('');
  const [viewDocumentSubtitle, setViewDocumentSubtitle] = useState('');

  // Interactive PDF Viewer State (Read on screen / Download / Print / Share)
  const [viewerPdfDoc, setViewerPdfDoc] = useState<any | null>(null);
  const [viewerPdfFilename, setViewerPdfFilename] = useState('');
  const [viewerPdfTitle, setViewerPdfTitle] = useState('');
  const [viewerPdfSubtitle, setViewerPdfSubtitle] = useState('');
  const [viewerRecipientPhone, setViewerRecipientPhone] = useState<string | undefined>(undefined);
  const [viewingGuide, setViewingGuide] = useState<{
    guide: ReceptionGuide | DeliveryGuide;
    type: 'RECEPTION' | 'DELIVERY';
    company?: Company;
  } | null>(null);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);

  useEffect(() => {
    loadGuides();
  }, [refreshTrigger, selectedCompanyId]);

  const loadGuides = async () => {
    setLoading(true);
    let recQuery = db.receptionGuides.toCollection();
    let delQuery = db.deliveryGuides.toCollection();

    if (selectedCompanyId !== 'ALL') {
      const r = await db.receptionGuides.where('companyId').equals(selectedCompanyId).reverse().toArray();
      const d = await db.deliveryGuides.where('companyId').equals(selectedCompanyId).reverse().toArray();
      setReceptionGuides(r);
      setDeliveryGuides(d);
    } else {
      const r = await recQuery.reverse().toArray();
      const d = await delQuery.reverse().toArray();
      setReceptionGuides(r);
      setDeliveryGuides(d);
    }
    setLoading(false);
  };

  const filteredReceptions = receptionGuides.filter((g) => {
    const s = search.toLowerCase().trim();
    if (!s) return true;
    return (
      g.folio.toLowerCase().includes(s) ||
      (g.linkedFolio && g.linkedFolio.toLowerCase().includes(s)) ||
      g.companyName.toLowerCase().includes(s) ||
      g.supplierOrCarrierName.toLowerCase().includes(s) ||
      (g.carrierRut && g.carrierRut.toLowerCase().includes(s)) ||
      (g.vehiclePlate && g.vehiclePlate.toLowerCase().includes(s)) ||
      (g.externalDocNumber && g.externalDocNumber.toLowerCase().includes(s)) ||
      g.items.some(i => i.name.toLowerCase().includes(s) || i.code.toLowerCase().includes(s))
    );
  });

  const filteredDeliveries = deliveryGuides.filter((g) => {
    const s = search.toLowerCase().trim();
    if (!s) return true;
    return (
      g.folio.toLowerCase().includes(s) ||
      (g.linkedFolio && g.linkedFolio.toLowerCase().includes(s)) ||
      g.companyName.toLowerCase().includes(s) ||
      g.recipientName.toLowerCase().includes(s) ||
      (g.recipientRut && g.recipientRut.toLowerCase().includes(s)) ||
      (g.vehiclePlate && g.vehiclePlate.toLowerCase().includes(s)) ||
      g.worksiteOrReason.toLowerCase().includes(s) ||
      g.items.some(i => i.name.toLowerCase().includes(s) || i.code.toLowerCase().includes(s))
    );
  });

  const handleOpenRecPDFViewer = async (g: ReceptionGuide) => {
    const comp = companies.find((c) => c.id === g.companyId);
    const doc = await generateReceptionGuidePDF(g, comp);
    setViewerPdfDoc(doc);
    setViewerPdfFilename(`Guia_Recepcion_${g.folio}.pdf`);
    setViewerPdfTitle(`Guía de Recepción ${g.folio}`);
    setViewerPdfSubtitle(`Proveedor / Transportista: ${g.supplierOrCarrierName} • Empresa: ${g.companyName || comp?.name || 'Market Almacén'}`);
    setViewerRecipientPhone(g.carrierPhone);
    setViewingGuide({ guide: g, type: 'RECEPTION', company: comp });
    setIsPdfModalOpen(true);
  };

  const handleDownloadRecPDF = async (g: ReceptionGuide) => {
    const comp = companies.find((c) => c.id === g.companyId);
    const doc = await generateReceptionGuidePDF(g, comp);
    downloadPDF(doc, `Guia_Recepcion_${g.folio}.pdf`);
  };

  const handlePrintRecPDF = async (g: ReceptionGuide) => {
    const comp = companies.find((c) => c.id === g.companyId);
    const doc = await generateReceptionGuidePDF(g, comp);
    printPDF(doc);
  };

  const handleShareRecWhatsApp = async (g: ReceptionGuide) => {
    const comp = companies.find((c) => c.id === g.companyId);
    const doc = await generateReceptionGuidePDF(g, comp);
    await sharePDFDocument({
      doc,
      filename: `Guia_Recepcion_${g.folio}.pdf`,
      recipientPhone: g.carrierPhone,
      title: `Guía de Recepción ${g.folio}`,
      messageText: `Estimado(a), adjunto copia oficial en PDF de la Guía de Recepción ${g.folio} emitida por Market Almacén.`
    });
  };

  const handleOpenDelPDFViewer = async (g: DeliveryGuide) => {
    const comp = companies.find((c) => c.id === g.companyId);
    const doc = await generateDeliveryGuidePDF(g, comp);
    setViewerPdfDoc(doc);
    setViewerPdfFilename(`Guia_Entrega_${g.folio}.pdf`);
    setViewerPdfTitle(`Guía de Entrega ${g.folio}`);
    setViewerPdfSubtitle(`Receptor: ${g.recipientName} • Empresa: ${g.companyName || comp?.name || 'Market Almacén'}`);
    setViewerRecipientPhone(g.recipientPhone);
    setViewingGuide({ guide: g, type: 'DELIVERY', company: comp });
    setIsPdfModalOpen(true);
  };

  const handleDownloadDelPDF = async (g: DeliveryGuide) => {
    const comp = companies.find((c) => c.id === g.companyId);
    const doc = await generateDeliveryGuidePDF(g, comp);
    downloadPDF(doc, `Guia_Entrega_${g.folio}.pdf`);
  };

  const handlePrintDelPDF = async (g: DeliveryGuide) => {
    const comp = companies.find((c) => c.id === g.companyId);
    const doc = await generateDeliveryGuidePDF(g, comp);
    printPDF(doc);
  };

  const handleShareDelWhatsApp = async (g: DeliveryGuide) => {
    const comp = companies.find((c) => c.id === g.companyId);
    const doc = await generateDeliveryGuidePDF(g, comp);
    await sharePDFDocument({
      doc,
      filename: `Guia_Entrega_${g.folio}.pdf`,
      recipientPhone: g.recipientPhone,
      title: `Guía de Entrega ${g.folio}`,
      messageText: `Estimado(a), adjunto copia oficial en PDF de la Guía de Entrega/Despacho ${g.folio} emitida por Market Almacén.`
    });
  };

  const handleDeleteReception = async (id: number, folio: string, confirmed?: boolean) => {
    if (isReadOnly) return;
    if (confirmed) {
      alert(`La guía ${folio} está CONFIRMADA y no puede eliminarse.\nSi necesita anularla, contacte al administrador.`);
      return;
    }
    if (confirm(`¿Eliminar la guía ${folio}?\nEsta guía no está confirmada — el folio podrá reutilizarse.`)) {
      await db.receptionGuides.delete(id);
      loadGuides();
      triggerCloudSync();
    }
  };

  const handleDeleteDelivery = async (id: number, folio: string, confirmed?: boolean) => {
    if (isReadOnly) return;
    if (confirmed) {
      alert(`La guía ${folio} está CONFIRMADA y no puede eliminarse.\nSi necesita anularla, contacte al administrador.`);
      return;
    }
    if (confirm(`¿Eliminar la guía ${folio}?\nEsta guía no está confirmada — el folio podrá reutilizarse.`)) {
      await db.deliveryGuides.delete(id);
      loadGuides();
      triggerCloudSync();
    }
  };

  const handleConfirmReception = async (g: ReceptionGuide) => {
    if (isReadOnly) return;
    if (g.confirmed) return;
    if (!confirm(`¿Confirmar guía de recepción ${g.folio}?\n\nUna vez confirmada, la guía quedará BLOQUEADA y no podrá eliminarse.\nEsta acción es irreversible.`)) return;
    await db.receptionGuides.update(g.id!, {
      confirmed: true,
      confirmedAt: new Date().toISOString()
    });
    loadGuides();
    triggerCloudSync();
  };

  const handleConfirmDelivery = async (g: DeliveryGuide) => {
    if (isReadOnly) return;
    if (g.confirmed) return;
    if (!confirm(`¿Confirmar guía de entrega ${g.folio}?\n\nUna vez confirmada, la guía quedará BLOQUEADA y no podrá eliminarse.\nEsta acción es irreversible.`)) return;
    await db.deliveryGuides.update(g.id!, {
      confirmed: true,
      confirmedAt: new Date().toISOString()
    });
    loadGuides();
    triggerCloudSync();
  };

  return (
    <div className="space-y-4">
      {/* Top Header & Buttons */}
      <div className={`p-4 rounded-2xl border ${themeClasses.border} ${themeClasses.card} flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-sm`}>
        <div>
          <h3 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-slate-100">
            Guías de Despacho y Recepción
          </h3>
          <p className={`text-xs ${themeClasses.textMuted}`}>
            Control oficial con timbres digitales, firma de conformidad, documentos asociados y respaldo PDF
          </p>
        </div>

        {!isReadOnly && (
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <button
              onClick={onOpenNewReception}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-500/20 transition active:scale-95"
            >
              <FileCheck className="w-4 h-4" />
              <span>+ Guía Recepción</span>
            </button>
            <button
              onClick={onOpenNewDelivery}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl ${themeClasses.accentBg} ${themeClasses.accentHover} shadow-md shadow-orange-500/20 transition active:scale-95`}
            >
              <Send className="w-4 h-4" />
              <span>+ Guía Entrega</span>
            </button>
          </div>
        )}
      </div>

      {/* Tabs & Search */}
      <div className={`p-3 rounded-2xl border ${themeClasses.border} ${themeClasses.card} flex flex-col sm:flex-row justify-between items-center gap-3 shadow-sm`}>
        {/* Tabs */}
        <div className={`flex items-center gap-1 ${themeClasses.cardSubtle} p-1 rounded-xl border ${themeClasses.border} w-full sm:w-auto`}>
          <button
            onClick={() => setActiveTab('reception')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition flex items-center gap-1.5 ${
              activeTab === 'reception'
                ? 'bg-emerald-600 text-white shadow-md font-black'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span>📥 Recepciones</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'reception' ? 'bg-emerald-700/80 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
              {receptionGuides.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('delivery')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition flex items-center gap-1.5 ${
              activeTab === 'delivery'
                ? `${themeClasses.accentBg} text-white shadow-md font-black`
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span>📤 Entregas</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'delivery' ? 'bg-blue-700/80 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
              {deliveryGuides.length}
            </span>
          </button>
        </div>
      </div>

      {/* Grid of Guides */}
      {loading ? (
        <div className="text-center py-12 text-slate-400 text-xs">Cargando guías...</div>
      ) : (
        <div className="space-y-6">
          {/* RECEPTION GUIDES LIST */}
          {activeTab === 'reception' && (
            <div className="space-y-2.5">
              <h4 className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 px-1">
                <FileCheck className="w-4 h-4" />
                <span>Guías de Recepción Emitidas ({filteredReceptions.length})</span>
              </h4>

              {filteredReceptions.length === 0 ? (
                <div className={`p-6 rounded-2xl border ${themeClasses.border} ${themeClasses.card} text-center text-xs text-slate-500`}>
                  No hay guías de recepción registradas.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredReceptions.map((g) => (
                    <div
                      key={g.id}
                      className="p-4 rounded-3xl border-2 border-emerald-400/80 dark:border-emerald-600/80 bg-white dark:bg-slate-900 shadow-md hover:shadow-lg transition flex flex-col justify-between space-y-3"
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-mono font-black text-emerald-700 dark:text-emerald-400">{g.folio}</span>
                              {g.linkedFolio && (
                                <span className="px-2 py-0.5 rounded text-[9.5px] font-black bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-700 flex items-center gap-0.5">
                                  <LinkIcon className="w-2.5 h-2.5" />
                                  {g.linkedFolio}
                                </span>
                              )}
                            </div>
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1 mt-0.5">
                              <Calendar className="w-3.5 h-3.5 text-slate-500" />
                              {new Date(g.date).toLocaleString('es-CL')}
                            </span>
                          </div>
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-emerald-600 text-white shadow-xs">
                            ✓ Recepción Conforme
                          </span>
                        </div>

                        <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-1 text-xs">
                          <div className="flex items-center gap-2 text-slate-950 dark:text-white font-black text-sm">
                            <User className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            <span className="truncate">{g.supplierOrCarrierName}</span>
                          </div>
                          {g.companyName && (
                            <div className="text-xs font-bold text-slate-800 dark:text-slate-200 pl-6 flex items-center gap-1 truncate">
                              <Building2 className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                              <span>{g.companyName}</span>
                            </div>
                          )}
                          {g.carrierRut && (
                            <div className="text-xs font-bold font-mono text-slate-800 dark:text-slate-200 pl-6">
                              RUT: {g.carrierRut}
                            </div>
                          )}
                          {g.externalDocNumber && (
                            <div className="text-xs font-mono font-black text-blue-700 dark:text-cyan-400 pl-6 flex items-center gap-1">
                              <span className="bg-blue-100 dark:bg-blue-950/80 px-2 py-0.5 rounded border border-blue-300 dark:border-blue-700">
                                Doc: {g.externalDocNumber}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Items list preview con alto contraste */}
                        <div className="p-2.5 rounded-2xl bg-emerald-50/50 dark:bg-slate-800/60 border border-emerald-200 dark:border-slate-700">
                          <span className="font-black text-xs uppercase tracking-wider text-slate-900 dark:text-white block mb-1">
                            Ítems recibidos ({g.items.length}):
                          </span>
                          <ul className="space-y-1">
                            {g.items.slice(0, 3).map((it, idx) => (
                              <li key={idx} className="text-xs font-bold text-slate-950 dark:text-white truncate flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400 shrink-0"></span>
                                <span className="truncate">{it.name}</span>
                                <span className="text-emerald-800 dark:text-emerald-300 font-mono font-black ml-auto shrink-0 bg-emerald-100 dark:bg-emerald-950 px-1.5 py-0.2 rounded">
                                  {it.quantity} {it.unit}
                                </span>
                              </li>
                            ))}
                            {g.items.length > 3 && (
                              <li className="text-[11px] font-bold text-slate-600 dark:text-slate-400 pt-0.5">
                                + {g.items.length - 3} ítems adicionales...
                              </li>
                            )}
                          </ul>
                        </div>
                      </div>

                      {/* Card Action Buttons */}
                      <div className="flex flex-wrap items-center justify-between gap-1.5 pt-2 border-t border-slate-800/80">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleOpenRecPDFViewer(g)}
                            className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition shadow-sm"
                            title="Abrir y Leer PDF en Pantalla"
                          >
                            <Eye className="w-3 h-3" />
                            <span>Ver PDF</span>
                          </button>
                          <button
                            onClick={() => handleDownloadRecPDF(g)}
                            className="p-1.5 text-slate-700 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition"
                            title="Descargar archivo PDF directamente"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handlePrintRecPDF(g)}
                            className="p-1.5 text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition"
                            title="Imprimir"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleShareRecWhatsApp(g)}
                            className="p-1 text-emerald-400 hover:text-emerald-300 rounded-lg hover:bg-slate-800"
                            title="Enviar PDF por WhatsApp"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>

                          {/* View Associated Scanned Invoice or Attached PDF Button */}
                          {g.invoiceScanImage && (
                            <button
                              onClick={() => {
                                setViewDocumentUrl(g.invoiceScanImage!);
                                setViewDocumentTitle(g.invoiceDocName || `Documento de Respaldo Guía ${g.folio}`);
                                setViewDocumentSubtitle(`Proveedor: ${g.supplierOrCarrierName} • Doc: ${g.externalDocNumber || 'S/N'}`);
                              }}
                              className="flex items-center gap-1 px-2 py-1 text-[11px] font-bold rounded-lg bg-orange-600/20 hover:bg-orange-600/30 text-orange-300 border border-blue-500/30 transition"
                              title="Ver factura, boleta o PDF adjunto asociado"
                            >
                              <FileText className="w-3 h-3" />
                              <span>{g.invoiceDocType === 'PDF' || g.invoiceScanImage.startsWith('data:application/pdf') ? 'Ver PDF Adjunto' : 'Ver Doc. Adjunto'}</span>
                            </button>
                          )}
                        </div>

                        {!isReadOnly && (
                          <div className="flex items-center gap-1">
                            {!g.confirmed ? (
                              <button
                                onClick={() => handleConfirmReception(g)}
                                className="flex items-center gap-1 px-2 py-1 text-[11px] font-bold rounded-lg bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 border border-blue-500/30 transition"
                                title="Confirmar guía — quedará bloqueada y no se podrá eliminar"
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Confirmar</span>
                              </button>
                            ) : (
                              <span className="flex items-center gap-1 px-2.5 py-1 text-xs font-black rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-200 border-2 border-emerald-500 shadow-xs">
                                <Lock className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-300" />
                                <span>Confirmada</span>
                              </span>
                            )}
                            <button
                              onClick={() => handleDeleteReception(g.id!, g.folio, g.confirmed)}
                              className={`p-1 rounded-lg transition ${g.confirmed ? 'text-slate-700 cursor-not-allowed' : 'text-slate-500 hover:text-red-400 hover:bg-slate-800'}`}
                              title={g.confirmed ? 'Guía confirmada — no se puede eliminar' : 'Eliminar registro'}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* DELIVERY GUIDES LIST */}
          {activeTab === 'delivery' && (
            <div className="space-y-2.5">
              <h4 className="text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1.5 px-1">
                <Send className="w-4 h-4" />
                <span>Guías de Entrega / Despacho Emitidas ({filteredDeliveries.length})</span>
              </h4>

              {filteredDeliveries.length === 0 ? (
                <div className={`p-6 rounded-2xl border ${themeClasses.border} ${themeClasses.card} text-center text-xs text-slate-500`}>
                  No hay guías de entrega registradas.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredDeliveries.map((g) => (
                    <div
                      key={g.id}
                      className="p-4 rounded-3xl border-2 border-orange-400/80 dark:border-orange-600/80 bg-white dark:bg-slate-900 shadow-md hover:shadow-lg transition flex flex-col justify-between space-y-3"
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-mono font-black text-orange-700 dark:text-orange-400">{g.folio}</span>
                              {g.linkedFolio && (
                                <span className="px-2 py-0.5 rounded text-[9.5px] font-black bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-700 flex items-center gap-0.5">
                                  <LinkIcon className="w-2.5 h-2.5" />
                                  {g.linkedFolio}
                                </span>
                              )}
                            </div>
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1 mt-0.5">
                              <Calendar className="w-3.5 h-3.5 text-slate-500" />
                              {new Date(g.date).toLocaleString('es-CL')}
                            </span>
                          </div>
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-orange-600 text-white shadow-xs">
                            ✓ Sin Devolución
                          </span>
                        </div>

                        <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-1 text-xs">
                          <div className="flex items-center gap-2 text-slate-950 dark:text-white font-black text-sm">
                            <User className="w-4 h-4 text-orange-600 dark:text-orange-400 shrink-0" />
                            <span className="truncate">{g.recipientName}</span>
                          </div>
                          {g.companyName && (
                            <div className="text-xs font-bold text-slate-800 dark:text-slate-200 pl-6 flex items-center gap-1 truncate">
                              <Building2 className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                              <span>{g.companyName}</span>
                            </div>
                          )}
                          {g.recipientRut && (
                            <div className="text-xs font-bold font-mono text-slate-800 dark:text-slate-200 pl-6">
                              RUT: {g.recipientRut}
                            </div>
                          )}
                          <div className="text-xs font-bold text-slate-800 dark:text-slate-200 pl-6 flex items-center gap-1 truncate">
                            <span className="bg-amber-100 dark:bg-amber-950/80 px-2 py-0.5 rounded border border-amber-300 dark:border-amber-700 truncate">
                              Destino: {g.worksiteOrReason}
                            </span>
                          </div>
                        </div>

                        {/* Items list preview con alto contraste */}
                        <div className="p-2.5 rounded-2xl bg-orange-50/50 dark:bg-slate-800/60 border border-orange-200 dark:border-slate-700">
                          <span className="font-black text-xs uppercase tracking-wider text-slate-900 dark:text-white block mb-1">
                            Ítems entregados ({g.items.length}):
                          </span>
                          <ul className="space-y-1">
                            {g.items.slice(0, 3).map((it, idx) => (
                              <li key={idx} className="text-xs font-bold text-slate-950 dark:text-white truncate flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-orange-600 dark:bg-orange-400 shrink-0"></span>
                                <span className="truncate">{it.name}</span>
                                <span className="text-orange-800 dark:text-orange-300 font-mono font-black ml-auto shrink-0 bg-orange-100 dark:bg-orange-950 px-1.5 py-0.2 rounded">
                                  {it.quantity} {it.unit}
                                </span>
                              </li>
                            ))}
                            {g.items.length > 3 && (
                              <li className="text-[11px] font-bold text-slate-600 dark:text-slate-400 pt-0.5">
                                + {g.items.length - 3} ítems adicionales...
                              </li>
                            )}
                          </ul>
                        </div>
                      </div>

                      {/* Card Action Buttons */}
                      <div className="flex items-center justify-between gap-1.5 pt-2 border-t border-slate-800/80">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleOpenDelPDFViewer(g)}
                            className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg bg-orange-600 hover:bg-orange-700 text-white transition shadow-sm"
                            title="Abrir y Leer PDF en Pantalla"
                          >
                            <Eye className="w-3 h-3" />
                            <span>Ver PDF</span>
                          </button>
                          <button
                            onClick={() => handleDownloadDelPDF(g)}
                            className="p-1.5 text-slate-700 dark:text-slate-300 hover:text-orange-600 dark:hover:text-orange-400 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition"
                            title="Descargar archivo PDF directamente"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handlePrintDelPDF(g)}
                            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                            title="Imprimir"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleShareDelWhatsApp(g)}
                            className="p-1 text-emerald-400 hover:text-emerald-300 rounded-lg hover:bg-slate-800"
                            title="Enviar PDF por WhatsApp"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>
                        </div>


                        {!isReadOnly && (
                          <div className="flex items-center gap-1">
                            {!g.confirmed ? (
                              <button
                                onClick={() => handleConfirmDelivery(g)}
                                className="flex items-center gap-1 px-2 py-1 text-[11px] font-bold rounded-lg bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 border border-blue-500/30 transition"
                                title="Confirmar guía — quedará bloqueada y no se podrá eliminar"
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Confirmar</span>
                              </button>
                            ) : (
                              <span className="flex items-center gap-1 px-2 py-1 text-[11px] font-bold rounded-lg bg-emerald-600/20 text-emerald-400 border border-emerald-500/30">
                                <Lock className="w-3 h-3" />
                                <span>Confirmada</span>
                              </span>
                            )}
                            <button
                              onClick={() => handleDeleteDelivery(g.id!, g.folio, g.confirmed)}
                              className={`p-1 rounded-lg transition ${g.confirmed ? 'text-slate-700 cursor-not-allowed' : 'text-slate-500 hover:text-red-400 hover:bg-slate-800'}`}
                              title={g.confirmed ? 'Guía confirmada — no se puede eliminar' : 'Eliminar registro'}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Associated Scanned Document Modal */}
      {viewDocumentUrl && (
        <ImageViewerModal
          isOpen={Boolean(viewDocumentUrl)}
          onClose={() => setViewDocumentUrl(null)}
          imageUrl={viewDocumentUrl}
          title={viewDocumentTitle}
          subtitle={viewDocumentSubtitle}
        />
      )}

      {/* Interactive PDF Reader Modal (Read on screen / Download / Print / Share) */}
      {isPdfModalOpen && viewerPdfDoc && (
        <PDFViewerModal
          isOpen={isPdfModalOpen}
          onClose={() => {
            setIsPdfModalOpen(false);
            setViewerPdfDoc(null);
            setViewingGuide(null);
          }}
          doc={viewerPdfDoc}
          filename={viewerPdfFilename}
          title={viewerPdfTitle}
          subtitle={viewerPdfSubtitle}
          recipientPhone={viewerRecipientPhone}
          previewNode={
            viewingGuide ? (
              <GuideDocumentVisualizer
                guide={viewingGuide.guide}
                type={viewingGuide.type}
                company={viewingGuide.company}
                onDownloadPDF={() => {
                  if (viewingGuide.type === 'RECEPTION') {
                    handleDownloadRecPDF(viewingGuide.guide as ReceptionGuide);
                  } else {
                    handleDownloadDelPDF(viewingGuide.guide as DeliveryGuide);
                  }
                }}
                onShareWhatsApp={() => {
                  if (viewingGuide.type === 'RECEPTION') {
                    handleShareRecWhatsApp(viewingGuide.guide as ReceptionGuide);
                  } else {
                    handleShareDelWhatsApp(viewingGuide.guide as DeliveryGuide);
                  }
                }}
                onPrint={() => {
                  if (viewingGuide.type === 'RECEPTION') {
                    handlePrintRecPDF(viewingGuide.guide as ReceptionGuide);
                  } else {
                    handlePrintDelPDF(viewingGuide.guide as DeliveryGuide);
                  }
                }}
              />
            ) : undefined
          }
        />
      )}
    </div>
  );
};
