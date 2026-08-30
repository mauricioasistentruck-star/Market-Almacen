import { exportSalesLedgerExcel } from '../../utils/salesExcelExporter';
import { formatCLP, getDteLabel, getPaymentMethodLabel } from '../../utils/salesPdfGenerator';
import React, { useState, useEffect } from 'react';
import { useTheme } from '../../utils/themeContext';
import { useCompany } from '../../utils/companyContext';
import { db } from '../../db/database';
import {
  exportConsolidatedExcelReport,
  exportToolLoansExcel,
  exportProductsInventoryExcel,
  exportToolsInventoryExcel,
  exportPurchaseRequestsExcel,
  exportWorkshopConsumptionExcel,
  type WorkshopConsumptionItem
} from '../../utils/excelExporter';
import { generateWordReport } from '../../utils/wordExporter';
import { generateExecutiveReportPDF, downloadPDF } from '../../utils/pdfGenerator';
import { PDFViewerModal } from '../PDFViewerModal';
import { LogbookView } from '../logbook/LogbookView';
import {
  BarChart3,
  Calendar,
  FileSpreadsheet,
  FileText,
  Download,
  Building2,
  CheckCircle2,
  Clock,
  Boxes,
  Wrench,
  AlertTriangle,
  ShoppingCart, Receipt, Banknote, CreditCard, ShieldCheck,
  Sparkles,
  Layers,
  Eye,
  BookOpen,
  Check
} from 'lucide-react';

export const ReportsView: React.FC = () => {
  const { themeClasses } = useTheme();
  const { companies, selectedCompanyId, selectedCompany, setSelectedCompanyId } = useCompany();

  // Helper for local YYYY-MM-DD
  const formatLocalDate = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Top Tab within Informes
  const [activeTab, setActiveTab] = useState<'reports' | 'sales' | 'logbook'>('reports');

  // Active preset state
  const [activePreset, setActivePreset] = useState<'today' | '7days' | 'thisMonth' | 'lastMonth' | 'all' | 'custom'>('7days');

  // Multi-Company Selection State for Reports
  const [selectedReportCompanyIds, setSelectedReportCompanyIds] = useState<string[]>(['ALL']);

  // Date Range state
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return formatLocalDate(d);
  });
  const [endDate, setEndDate] = useState(() => formatLocalDate(new Date()));

  // Metrics in selected period
  const [movementsCount, setMovementsCount] = useState(0);
  const [loansCount, setLoansCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [logbooksCount, setLogbooksCount] = useState(0);
  const [incidentsCount, setIncidentsCount] = useState(0);
  const [purchasesCount, setPurchasesCount] = useState(0);

  // Sales Report States
  const [salesList, setSalesList] = useState<any[]>([]);
  const [salesTotalAmount, setSalesTotalAmount] = useState(0);
  const [salesNetoAmount, setSalesNetoAmount] = useState(0);
  const [salesIvaAmount, setSalesIvaAmount] = useState(0);
  const [salesEfectivo, setSalesEfectivo] = useState(0);
  const [salesDebito, setSalesDebito] = useState(0);
  const [salesCredito, setSalesCredito] = useState(0);
  const [salesTransferencia, setSalesTransferencia] = useState(0);
  const [salesBoletasCount, setSalesBoletasCount] = useState(0);
  const [salesFacturasCount, setSalesFacturasCount] = useState(0);


  const [isGeneratingWord, setIsGeneratingWord] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  // Workshop Plate Filter State
  const [selectedWorkshopPlate, setSelectedWorkshopPlate] = useState<string>('');
  const [availablePlates, setAvailablePlates] = useState<string[]>([]);

  // PDF Viewer Modal State
  const [pdfDoc, setPdfDoc] = useState<any | null>(null);
  const [pdfFilename, setPdfFilename] = useState('');
  const [pdfTitle, setPdfTitle] = useState('');
  const [pdfSubtitle, setPdfSubtitle] = useState('');
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);

  const isCompanySelected = (id: string) => {
    if (id === 'ALL') return selectedReportCompanyIds.includes('ALL') || (companies.length > 0 && selectedReportCompanyIds.length === companies.length);
    return selectedReportCompanyIds.includes('ALL') || selectedReportCompanyIds.includes(id);
  };

  const handleToggleCompany = (id: string) => {
    if (id === 'ALL') {
      setSelectedReportCompanyIds(['ALL']);
      return;
    }
    // Select strictly the clicked company
    setSelectedReportCompanyIds([id]);
  };

  const getTargetCompanies = () => {
    if (selectedReportCompanyIds.includes('ALL')) {
      return companies;
    }
    return companies.filter(c => selectedReportCompanyIds.includes(c.id));
  };

  const getTargetCompanyName = () => {
    const targets = getTargetCompanies();
    if (targets.length === companies.length || selectedReportCompanyIds.includes('ALL')) {
      return 'MARKET ALMACÉN SpA';
    }
    return targets.map(c => c.name).join(' / ');
  };

  useEffect(() => {
    loadPeriodMetrics();
  }, [startDate, endDate, selectedReportCompanyIds]);

  const isDateInRange = (dateStr?: string): boolean => {
    if (!dateStr) return false;
    const cleanDate = dateStr.slice(0, 10);
    return cleanDate >= startDate && cleanDate <= endDate;
  };

  const loadPeriodMetrics = async () => {
    let movs = await db.productMovements.toArray();
    let loans = await db.toolLoans.toArray();
    let logs = await db.logbookEntries.toArray();
    let incs = await db.incidents.toArray();
    let purs = await db.purchaseRequests.toArray();
    let guides = await db.deliveryGuides.toArray();

    // Extract all unique vehicle plates
    const platesSet = new Set<string>();
    movs.forEach(m => {
      if (m.vehiclePlate && m.vehiclePlate.trim()) platesSet.add(m.vehiclePlate.trim().toUpperCase());
    });
    guides.forEach(g => {
      if (g.vehiclePlate && g.vehiclePlate.trim()) platesSet.add(g.vehiclePlate.trim().toUpperCase());
    });
    setAvailablePlates(Array.from(platesSet).sort());

    const targetCompIds = getTargetCompanies().map(c => c.id);
    if (!selectedReportCompanyIds.includes('ALL')) {
      movs = movs.filter(m => targetCompIds.includes(m.companyId));
      loans = loans.filter(l => targetCompIds.includes(l.companyId));
      logs = logs.filter(l => targetCompIds.includes(l.companyId));
      incs = incs.filter(i => targetCompIds.includes(i.companyId));
      purs = purs.filter(p => targetCompIds.includes(p.companyId));
      guides = guides.filter(g => targetCompIds.includes(g.companyId));
    }

    const filteredMovs = movs.filter(m => isDateInRange(m.date));
    const filteredLoans = loans.filter(l => isDateInRange(l.deliveryDate));
    const filteredPending = loans.filter(l => l.status === 'ACTIVO' || l.status === 'ATRASADO');
    const filteredLogs = logs.filter(l => isDateInRange(l.date));
    const filteredIncs = incs.filter(i => isDateInRange(i.date));
    const filteredPurs = purs.filter(p => isDateInRange(p.date));

    setMovementsCount(filteredMovs.length);
    setLoansCount(filteredLoans.length);
    setPendingCount(filteredPending.length);
    setLogbooksCount(filteredLogs.length);
    setIncidentsCount(filteredIncs.length);
    setPurchasesCount(filteredPurs.length);
  };

  // Quick Presets
  const handlePreset = (preset: 'today' | '7days' | 'thisMonth' | 'lastMonth' | 'all') => {
    setActivePreset(preset);
    const now = new Date();
    if (preset === 'today') {
      const todayStr = formatLocalDate(now);
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === '7days') {
      const past = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
      setStartDate(formatLocalDate(past));
      setEndDate(formatLocalDate(now));
    } else if (preset === 'thisMonth') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setStartDate(formatLocalDate(firstDay));
      setEndDate(formatLocalDate(lastDay));
    } else if (preset === 'lastMonth') {
      const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
      setStartDate(formatLocalDate(firstDay));
      setEndDate(formatLocalDate(lastDay));
    } else if (preset === 'all') {
      setStartDate('2020-01-01');
      setEndDate(formatLocalDate(now));
    }
  };

  // 1. Consolidated 4-in-1 Excel Export
  const handleExportConsolidated = async () => {
    let movs = await db.productMovements.toArray();
    let loans = await db.toolLoans.toArray();
    let incs = await db.incidents.toArray();
    let guides = await db.deliveryGuides.toArray();
    const allProducts = await db.products.toArray();
    const prodMap = new Map(allProducts.map(p => [p.code, p]));

    const targetCompIds = getTargetCompanies().map(c => c.id);
    if (!selectedReportCompanyIds.includes('ALL')) {
      movs = movs.filter(m => targetCompIds.includes(m.companyId));
      loans = loans.filter(l => targetCompIds.includes(l.companyId));
      incs = incs.filter(i => targetCompIds.includes(i.companyId));
      guides = guides.filter(g => targetCompIds.includes(g.companyId));
    }

    const filteredMovs = movs.filter(m => isDateInRange(m.date));
    const pendingLoans = loans.filter(l => l.status === 'ACTIVO' || l.status === 'ATRASADO');
    const filteredIncs = incs.filter(i => isDateInRange(i.date));

    // Consumo en Taller (Movimientos de SALIDA + Guías de Entrega)
    const periodMovs = movs.filter(m => m.type === 'SALIDA' && isDateInRange(m.date));
    const periodGuides = guides.filter(g => isDateInRange(g.date));

    const workshopConsumption: WorkshopConsumptionItem[] = [];

    // From Movements
    periodMovs.forEach(m => {
      const prod = prodMap.get(m.productCode);
      const plate = m.vehiclePlate ? m.vehiclePlate.trim().toUpperCase() : '';
      workshopConsumption.push({
        id: m.id,
        date: m.date,
        sourceType: 'MOVIMIENTO',
        folioOrRef: `MOV-${m.id || 0}`,
        vehiclePlate: plate || 'TALLER GENERAL',
        productCode: m.productCode,
        productName: m.productName,
        category: prod?.category || 'Insumos',
        brand: prod?.brand || 'Genérica',
        quantity: m.quantity,
        unit: prod?.unit || 'UN',
        responsibleWorker: m.workerOrSupplier || 'Taller',
        reasonOrNotes: m.reason || 'Consumo en taller'
      });
    });

    // From Delivery Guides
    periodGuides.forEach(g => {
      const plate = g.vehiclePlate ? g.vehiclePlate.trim().toUpperCase() : '';
      (g.items || []).forEach(item => {
        const prod = prodMap.get(item.code);
        workshopConsumption.push({
          date: g.date + 'T12:00:00.000Z',
          sourceType: 'GUIA_ENTREGA',
          folioOrRef: g.folio,
          vehiclePlate: plate || 'TALLER / ENTREGA',
          productCode: item.code,
          productName: item.name,
          category: prod?.category || 'Insumos',
          brand: item.brand || prod?.brand || 'Genérica',
          quantity: item.quantity,
          unit: item.unit || 'UN',
          responsibleWorker: g.recipientName || 'Receptor Guía',
          reasonOrNotes: g.worksiteOrReason || g.notes || `Guía entrega: ${g.folio}`
        });
      });
    });

    exportConsolidatedExcelReport({
      movements: filteredMovs,
      workshopConsumption,
      pendingLoans,
      incidents: filteredIncs,
      companyName: getTargetCompanyName(),
      startDate,
      endDate
    });
  };

  // 2. Executive Management Report in Word (.docx)
  const handleGenerateWord = async () => {
    setIsGeneratingWord(true);
    try {
      let movs = await db.productMovements.toArray();
      let loans = await db.toolLoans.toArray();
      let logs = await db.logbookEntries.toArray();
      let incs = await db.incidents.toArray();
      let purs = await db.purchaseRequests.toArray();

      const targetCompIds = getTargetCompanies().map(c => c.id);
      if (!selectedReportCompanyIds.includes('ALL')) {
        movs = movs.filter(m => targetCompIds.includes(m.companyId));
        loans = loans.filter(l => targetCompIds.includes(l.companyId));
        logs = logs.filter(l => targetCompIds.includes(l.companyId));
        incs = incs.filter(i => targetCompIds.includes(i.companyId));
        purs = purs.filter(p => targetCompIds.includes(p.companyId));
      }

      const filteredMovs = movs.filter(m => isDateInRange(m.date));
      const filteredLoans = loans.filter(l => isDateInRange(l.deliveryDate));
      const pendingLoans = loans.filter(l => l.status === 'ACTIVO' || l.status === 'ATRASADO');
      const filteredLogs = logs
        .filter(l => isDateInRange(l.date))
        .map(entry => ({
          ...entry,
          dayEvents: entry.dayEvents
            ? [...entry.dayEvents].sort((a, b) => (a.time || '').localeCompare(b.time || ''))
            : []
        }))
        .sort((a, b) => a.date.localeCompare(b.date)); // Cronológico para el informe
      const filteredIncs = incs.filter(i => isDateInRange(i.date));
      const filteredPurs = purs.filter(p => isDateInRange(p.date));

      await generateWordReport({
        companyName: getTargetCompanyName(),
        startDate,
        endDate,
        logbooks: filteredLogs,
        movements: filteredMovs,
        loans: filteredLoans,
        pendingLoans,
        incidents: filteredIncs,
        purchaseRequests: filteredPurs
      });
    } catch (err) {
      console.error('Error generating Word report:', err);
      alert('Ocurrió un error al generar el documento Word.');
    } finally {
      setIsGeneratingWord(false);
    }
  };

  // 3. Executive Management Report in PDF (.pdf)
  const handleGeneratePDF = async (mode: 'view' | 'download') => {
    setIsGeneratingPDF(true);
    try {
      let movs = await db.productMovements.toArray();
      let loans = await db.toolLoans.toArray();
      let logs = await db.logbookEntries.toArray();
      let incs = await db.incidents.toArray();
      let purs = await db.purchaseRequests.toArray();

      const targetCompanies = getTargetCompanies();
      const targetCompIds = targetCompanies.map(c => c.id);

      if (!selectedReportCompanyIds.includes('ALL')) {
        movs = movs.filter(m => targetCompIds.includes(m.companyId));
        loans = loans.filter(l => targetCompIds.includes(l.companyId));
        logs = logs.filter(l => targetCompIds.includes(l.companyId));
        incs = incs.filter(i => targetCompIds.includes(i.companyId));
        purs = purs.filter(p => targetCompIds.includes(p.companyId));
      }

      const filteredMovs = movs.filter(m => isDateInRange(m.date));
      const filteredLoans = loans.filter(l => isDateInRange(l.deliveryDate));
      const pendingLoans = loans.filter(l => l.status === 'ACTIVO' || l.status === 'ATRASADO');
      const filteredLogs = logs
        .filter(l => isDateInRange(l.date))
        .map(entry => ({
          ...entry,
          dayEvents: entry.dayEvents
            ? [...entry.dayEvents].sort((a, b) => (a.time || '').localeCompare(b.time || ''))
            : []
        }))
        .sort((a, b) => a.date.localeCompare(b.date)); // Cronológico para el informe
      const filteredIncs = incs.filter(i => isDateInRange(i.date));
      const filteredPurs = purs.filter(p => isDateInRange(p.date));

      // Build companies sections for multi-company reporting
      const companiesSections = targetCompanies.map(comp => {
        return {
          company: comp,
          logbooks: logs.filter(l => (l.companyId === comp.id ) && isDateInRange(l.date)),
          movements: movs.filter(m => (m.companyId === comp.id ) && isDateInRange(m.date)),
          loans: loans.filter(l => (l.companyId === comp.id ) && isDateInRange(l.deliveryDate)),
          pendingLoans: loans.filter(l => (l.companyId === comp.id ) && (l.status === 'ACTIVO' || l.status === 'ATRASADO')),
          incidents: incs.filter(i => (i.companyId === comp.id ) && isDateInRange(i.date)),
          purchases: purs.filter(p => (p.companyId === comp.id ) && isDateInRange(p.date))
        };
      });

      const doc = await generateExecutiveReportPDF({
        companyName: getTargetCompanyName(),
        startDate,
        endDate,
        logbooks: filteredLogs,
        movements: filteredMovs,
        loans: filteredLoans,
        pendingLoans,
        incidents: filteredIncs,
        purchases: filteredPurs,
        companiesSections
      }, targetCompanies.length === 1 ? targetCompanies[0] : undefined);

      const filename = `Informe_Gestion_${startDate}_al_${endDate}.pdf`;

      if (mode === 'download') {
        downloadPDF(doc, filename);
      } else {
        setPdfDoc(doc);
        setPdfFilename(filename);
        setPdfTitle(`Informe Ejecutivo de Gestión (${startDate} al ${endDate})`);
        setPdfSubtitle(`Empresa: ${getTargetCompanyName()} • Encargado: Mauricio Chamorro`);
        setIsPdfModalOpen(true);
      }
    } catch (err) {
      console.error('Error generating PDF report:', err);
      alert('Ocurrió un error al generar el documento PDF.');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  // Individual Excel exports
  const handleExportLoans = async () => {
    const loans = await db.toolLoans.toArray();
    exportToolLoansExcel(loans, getTargetCompanyName());
  };

  const handleExportProductsInventory = async () => {
    const prods = await db.products.toArray();
    exportProductsInventoryExcel(prods, getTargetCompanyName());
  };

  const handleExportToolsInventory = async () => {
    const tls = await db.tools.toArray();
    exportToolsInventoryExcel(tls, getTargetCompanyName());
  };

  const handleExportPurchases = async () => {
    const purs = await db.purchaseRequests.toArray();
    exportPurchaseRequestsExcel(purs, getTargetCompanyName());
  };

  const handleExportWorkshopConsumption = async () => {
    try {
      const startIso = new Date(startDate + 'T00:00:00').toISOString();
      const endIso = new Date(endDate + 'T23:59:59').toISOString();

      let movs = await db.productMovements.toArray();
      let guides = await db.deliveryGuides.toArray();
      const allProducts = await db.products.toArray();
      const prodMap = new Map(allProducts.map(p => [p.code, p]));

      if (selectedCompanyId !== 'ALL') {
        movs = movs.filter(m => m.companyId === selectedCompanyId);
        guides = guides.filter(g => g.companyId === selectedCompanyId);
      }

      // Filter by date range
      const periodMovs = movs.filter(m => m.type === 'SALIDA' && m.date >= startIso && m.date <= endIso);
      const periodGuides = guides.filter(g => g.date >= startDate && g.date <= endDate);

      const items: WorkshopConsumptionItem[] = [];

      // 1. From Product Movements (SALIDA)
      periodMovs.forEach(m => {
        const prod = prodMap.get(m.productCode);
        const plate = m.vehiclePlate ? m.vehiclePlate.trim().toUpperCase() : '';

        items.push({
          id: m.id,
          date: m.date,
          sourceType: 'MOVIMIENTO',
          folioOrRef: `MOV-${m.id || 0}`,
          vehiclePlate: plate || 'TALLER GENERAL',
          productCode: m.productCode,
          productName: m.productName,
          category: prod?.category || 'Insumos',
          brand: prod?.brand || 'Genérica',
          quantity: m.quantity,
          unit: prod?.unit || 'UN',
          responsibleWorker: m.workerOrSupplier || 'Taller',
          reasonOrNotes: m.reason || 'Consumo en taller'
        });
      });

      // 2. From Delivery Guides
      periodGuides.forEach(g => {
        const plate = g.vehiclePlate ? g.vehiclePlate.trim().toUpperCase() : '';

        (g.items || []).forEach(item => {
          const prod = prodMap.get(item.code);
          items.push({
            date: g.date + 'T12:00:00.000Z',
            sourceType: 'GUIA_ENTREGA',
            folioOrRef: g.folio,
            vehiclePlate: plate || 'TALLER / ENTREGA',
            productCode: item.code,
            productName: item.name,
            category: prod?.category || 'Insumos',
            brand: item.brand || prod?.brand || 'Genérica',
            quantity: item.quantity,
            unit: item.unit || 'UN',
            responsibleWorker: g.recipientName || 'Receptor Guía',
            reasonOrNotes: g.worksiteOrReason || g.notes || `Guía entrega: ${g.folio}`
          });
        });
      });

      if (items.length === 0) {
        alert('No se encontraron registros de consumo o salidas de bodega en el período seleccionado.');
        return;
      }

      exportWorkshopConsumptionExcel(items, {
        companyName: getTargetCompanyName(),
        startDate,
        endDate
      });
    } catch (err) {
      console.error('Error al exportar consumo de taller:', err);
      alert('Ocurrió un error al generar la planilla Excel.');
    }
  };

  return (
    <div className="space-y-4">
      {/* Sub Tabs: Reports vs Logbook */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-1">
        <button
          onClick={() => setActiveTab('reports')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition ${
            activeTab === 'reports'
              ? `${themeClasses.accentBg} ${themeClasses.accentHover} shadow-sm`
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Informes y Exportaciones</span>
        </button>

        <button
          onClick={() => setActiveTab('logbook')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition ${
            activeTab === 'logbook'
              ? `${themeClasses.accentBg} ${themeClasses.accentHover} shadow-sm`
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Bitácora Diaria y Solicitudes</span>
        </button>
      </div>

      
        {activeTab === 'sales' && (
          <div className="space-y-4 animate-fadeIn">
            {/* Sales Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Facturación Total del Período</p>
                <p className="text-xl font-black text-orange-400 font-mono mt-1">{formatCLP(salesTotalAmount)}</p>
                <p className="text-[11px] text-slate-500 font-bold">{salesList.length} ventas realizadas</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Desglose Tributario (19% IVA)</p>
                <div className="mt-1 space-y-0.5 text-xs">
                  <div className="flex justify-between text-slate-300">
                    <span>Neto:</span>
                    <span className="font-mono font-bold">{formatCLP(salesNetoAmount)}</span>
                  </div>
                  <div className="flex justify-between text-orange-400">
                    <span>IVA:</span>
                    <span className="font-mono font-bold">{formatCLP(salesIvaAmount)}</span>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Documentos Tributarios</p>
                <div className="mt-1 space-y-0.5 text-xs">
                  <div className="flex justify-between text-emerald-400">
                    <span>Boletas:</span>
                    <span className="font-mono font-bold">{salesBoletasCount}</span>
                  </div>
                  <div className="flex justify-between text-blue-400">
                    <span>Facturas:</span>
                    <span className="font-mono font-bold">{salesFacturasCount}</span>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Libro de Ventas Oficial</p>
                  <p className="text-xs text-slate-300 font-bold mt-0.5">Exportación completa para contador</p>
                </div>
                <button
                  type="button"
                  onClick={() => exportSalesLedgerExcel(salesList, selectedCompany?.name, `${startDate} a ${endDate}`)}
                  className="w-full py-2 px-3 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-black transition flex items-center justify-center gap-1.5 mt-2"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Descargar Libro de Ventas (Excel)</span>
                </button>
              </div>
            </div>

            {/* Desglose de Medios de Pago */}
            <div className="p-4 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-3">
              <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider">
                Desglose por Medios de Pago en el Período
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800">
                  <p className="text-[10px] font-bold text-slate-400 flex items-center gap-1"><Banknote className="w-3.5 h-3.5 text-emerald-400" /> Efectivo</p>
                  <p className="text-sm font-black text-emerald-400 font-mono mt-1">{formatCLP(salesEfectivo)}</p>
                </div>
                <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800">
                  <p className="text-[10px] font-bold text-slate-400 flex items-center gap-1"><CreditCard className="w-3.5 h-3.5 text-cyan-400" /> Débito POS</p>
                  <p className="text-sm font-black text-cyan-400 font-mono mt-1">{formatCLP(salesDebito)}</p>
                </div>
                <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800">
                  <p className="text-[10px] font-bold text-slate-400 flex items-center gap-1"><CreditCard className="w-3.5 h-3.5 text-indigo-400" /> Crédito</p>
                  <p className="text-sm font-black text-indigo-400 font-mono mt-1">{formatCLP(salesCredito)}</p>
                </div>
                <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800">
                  <p className="text-[10px] font-bold text-slate-400 flex items-center gap-1"><Building2 className="w-3.5 h-3.5 text-amber-400" /> Transferencia</p>
                  <p className="text-sm font-black text-amber-400 font-mono mt-1">{formatCLP(salesTransferencia)}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'logbook' ? (
        <LogbookView refreshTrigger={0} />
      ) : (
        <div className="space-y-4">
          {/* Header Card */}
          <div className={`p-4 sm:p-5 rounded-2xl border ${themeClasses.border} ${themeClasses.card} flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 shadow-sm`}>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black tracking-tight text-slate-100">
                  Centro de Informes y Reportería Oficial
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30">
                  Gestión Bodega
                </span>
              </div>
              <p className={`text-xs ${themeClasses.textMuted} mt-0.5`}>
                Generación de informes ejecutivos (PDF y Word) con separación por empresa y descarga de matrices Excel
              </p>
            </div>

            {/* Target Multi-Company Selector */}
            <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
              <span className="text-xs font-bold text-slate-300 mr-1 flex items-center gap-1.5 shrink-0">
                <Building2 className="w-4 h-4 text-orange-500" />
                Empresas:
              </span>

              {/* Botón Todas */}
              <button
                type="button"
                onClick={() => handleToggleCompany('ALL')}
                className={`px-3 py-1.5 text-xs font-black rounded-xl transition flex items-center gap-1.5 border shrink-0 ${
                  selectedReportCompanyIds.includes('ALL')
                    ? 'bg-orange-500 text-black border-orange-400 shadow-md shadow-orange-500/20'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white border-slate-700/60'
                }`}
              >
                <span>🏢 Todas las Empresas</span>
                {selectedReportCompanyIds.includes('ALL') && <Check className="w-3.5 h-3.5 stroke-[3]" />}
              </button>

              {/* Botones por Empresa Individual */}
              {companies.map((c) => {
                const isSelected = isCompanySelected(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleToggleCompany(c.id)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-xl transition flex items-center gap-1.5 border shrink-0 ${
                      isSelected && !selectedReportCompanyIds.includes('ALL')
                        ? 'bg-blue-600 text-white border-blue-400 shadow-md shadow-blue-500/20 font-black'
                        : isSelected
                        ? 'bg-slate-800 text-slate-200 border-slate-600'
                        : 'bg-slate-900/60 text-slate-500 hover:bg-slate-800 hover:text-slate-300 border-slate-800 opacity-60'
                    }`}
                  >
                    <span>🏢 {c.name}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* DATE RANGE FILTER CARD */}
          <div className={`p-4 sm:p-5 rounded-2xl border ${themeClasses.border} ${themeClasses.card} space-y-4 shadow-sm`}>
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 pb-3 border-b border-slate-800/80">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
                <Calendar className="w-4 h-4 text-orange-500" />
                <span>Período de Análisis:</span>
              </div>

              {/* Quick Presets */}
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handlePreset('today')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl transition ${
                    activePreset === 'today'
                      ? 'bg-orange-500 text-black shadow-md shadow-orange-500/20 font-black'
                      : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700/60'
                  }`}
                >
                  Hoy
                </button>
                <button
                  type="button"
                  onClick={() => handlePreset('7days')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl transition ${
                    activePreset === '7days'
                      ? 'bg-orange-500 text-black shadow-md shadow-orange-500/20 font-black'
                      : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700/60'
                  }`}
                >
                  Últimos 7 Días
                </button>
                <button
                  type="button"
                  onClick={() => handlePreset('thisMonth')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl transition ${
                    activePreset === 'thisMonth'
                      ? 'bg-orange-500 text-black shadow-md shadow-orange-500/20 font-black'
                      : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700/60'
                  }`}
                >
                  Este Mes
                </button>
                <button
                  type="button"
                  onClick={() => handlePreset('lastMonth')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl transition ${
                    activePreset === 'lastMonth'
                      ? 'bg-orange-500 text-black shadow-md shadow-orange-500/20 font-black'
                      : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700/60'
                  }`}
                >
                  Mes Pasado
                </button>
                <button
                  type="button"
                  onClick={() => handlePreset('all')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl transition ${
                    activePreset === 'all'
                      ? 'bg-orange-500 text-black shadow-md shadow-orange-500/20 font-black'
                      : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700/60'
                  }`}
                >
                  Histórico Completo
                </button>
              </div>
            </div>

            {/* Date Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Fecha Desde:</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setActivePreset('custom');
                  }}
                  className={`w-full px-3 py-2 text-xs font-bold rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} focus:outline-none focus:border-orange-500`}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Fecha Hasta:</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setActivePreset('custom');
                  }}
                  className={`w-full px-3 py-2 text-xs font-bold rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} focus:outline-none focus:border-orange-500`}
                />
              </div>
            </div>

            {/* Period Statistics Summary Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-2">
              <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-center">
                <span className="text-slate-400 block text-[10px]">Movimientos</span>
                <strong className="text-sm font-mono text-emerald-400">{movementsCount}</strong>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-center">
                <span className="text-slate-400 block text-[10px]">Préstamos</span>
                <strong className="text-sm font-mono text-cyan-400">{loansCount}</strong>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-center">
                <span className="text-slate-400 block text-[10px]">Pendientes</span>
                <strong className="text-sm font-mono text-amber-400">{pendingCount}</strong>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-center">
                <span className="text-slate-400 block text-[10px]">Bitácoras</span>
                <strong className="text-sm font-mono text-orange-400">{logbooksCount}</strong>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-center">
                <span className="text-slate-400 block text-[10px]">Daños/Pérdidas</span>
                <strong className="text-sm font-mono text-red-400">{incidentsCount}</strong>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-center">
                <span className="text-slate-400 block text-[10px]">Solicitudes</span>
                <strong className="text-sm font-mono text-indigo-400">{purchasesCount}</strong>
              </div>
            </div>
          </div>

          {/* SECTION 1: MASTER CONSOLIDATED EXCEL (4-IN-1) */}
          <div className="p-5 rounded-3xl border border-emerald-500/40 bg-gradient-to-br from-emerald-500/10 via-slate-900/90 to-slate-900/90 shadow-xl space-y-3 relative overflow-hidden">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-md">
                  <Layers className="w-7 h-7" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-base sm:text-lg text-emerald-300">
                      Reporte Consolidado Excel (4 en 1)
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      ★ 4 Hojas Integradas
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Reúne en un solo archivo Excel con 4 hojas independientes: <strong>1. Movimientos (Kardex)</strong>, <strong>2. Consumo en Taller</strong>, <strong>3. Herramientas Pendientes</strong> y <strong>4. Daños y Pérdidas</strong>.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleExportConsolidated}
                className="flex items-center gap-2 px-6 py-3 text-xs font-black rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-xl shadow-emerald-500/20 transition active:scale-95 shrink-0"
              >
                <Download className="w-4 h-4" />
                <span>Descargar Excel Consolidado (4 en 1)</span>
              </button>
            </div>
          </div>

          {/* SECTION 2: EXECUTIVE REPORT (WORD & PDF) */}
          <div className={`p-5 rounded-2xl border border-blue-500/40 bg-blue-500/5 shadow-md space-y-4`}>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-blue-500/20">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm sm:text-base text-slate-100">
                    Informe Ejecutivo de Gestión (Word & PDF)
                  </h4>
                  <p className="text-xs text-slate-400">
                    Estructurado por fechas: bitácora diaria con acontecimientos y tareas + métricas estadísticas + firmas
                  </p>
                </div>
              </div>

              {/* Action Buttons: Word + PDF Options */}
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={() => handleGeneratePDF('view')}
                  disabled={isGeneratingPDF}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-extrabold rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 shadow transition active:scale-95"
                  title="Ver informe en pantalla antes de descargar"
                >
                  <Eye className="w-4 h-4" />
                  <span>{isGeneratingPDF ? 'Cargando...' : 'Ver PDF'}</span>
                </button>

                <button
                  onClick={() => handleGeneratePDF('download')}
                  disabled={isGeneratingPDF}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-extrabold rounded-xl bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-500/20 transition active:scale-95"
                  title="Descargar informe en PDF (.pdf)"
                >
                  <Download className="w-4 h-4" />
                  <span>PDF (.pdf)</span>
                </button>

                <button
                  onClick={handleGenerateWord}
                  disabled={isGeneratingWord}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-5 py-2.5 text-xs font-extrabold rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/20 transition active:scale-95"
                  title="Descargar informe en Word (.docx)"
                >
                  <Download className="w-4 h-4" />
                  <span>{isGeneratingWord ? 'Generando...' : 'Word (.docx)'}</span>
                </button>
              </div>
            </div>

            <div className="text-xs text-slate-300 bg-slate-900/60 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
              <p className="font-bold text-blue-300">Contenido incluido automáticamente en los informes Word y PDF:</p>
              <ul className="list-disc list-inside text-slate-400 space-y-1 pl-1">
                <li>Membrete corporativo MARKET ALMACÉN SpA y período de gestión.</li>
                <li><strong>Bitácora Diaria Detallada:</strong> Registro organizado día por día con horarios, tipo de evento y tareas individuales.</li>
                <li><strong>Métricas de Movimientos:</strong> Entradas, salidas, consumos y valorización de inventario.</li>
                <li><strong>Control de Herramientas:</strong> Préstamos realizados y detalle de herramientas pendientes de devolución.</li>
                <li><strong>Registro de Daños y Pérdidas:</strong> Incidentes reportados en faena, folios de acta y costos estimados.</li>
                <li><strong>Solicitudes de Compra:</strong> Requerimientos de insumos con niveles de prioridad.</li>
                <li><strong>Espacio Oficial para Firmas:</strong> Encargado de Bodega (Mauricio Chamorro) y Gerencia de Operaciones.</li>
              </ul>
            </div>
          </div>

          {/* SECTION 3: INDIVIDUAL EXCEL REPORTS (CLEANED UP) */}
          <div className={`p-5 rounded-2xl border ${themeClasses.border} ${themeClasses.card} shadow-sm space-y-3.5`}>
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
              <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
              <h4 className="font-bold text-sm text-slate-200">
                Descargas Adicionales en Excel (.xlsx)
              </h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* 1. Historial Préstamos Herramientas */}
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 flex items-center justify-between gap-3 hover:border-emerald-500/40 transition">
                <div className="space-y-0.5">
                  <span className="font-bold text-xs text-slate-200 block">1. Historial Completo de Préstamos y Devoluciones</span>
                  <p className="text-[11px] text-slate-400">A quién se entregó, fecha/hora entrega, devolución y estado</p>
                </div>
                <button
                  onClick={handleExportLoans}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 transition shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Excel</span>
                </button>
              </div>

              {/* 2. Inventario Consolidado de Productos */}
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 flex items-center justify-between gap-3 hover:border-emerald-500/40 transition">
                <div className="space-y-0.5">
                  <span className="font-bold text-xs text-slate-200 block">2. Inventario Maestro de Productos</span>
                  <p className="text-[11px] text-slate-400">Stock actual, códigos Mann Filter, ubicación y condición</p>
                </div>
                <button
                  onClick={handleExportProductsInventory}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 transition shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Excel</span>
                </button>
              </div>

              {/* 3. Inventario Completo de Herramientas */}
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 flex items-center justify-between gap-3 hover:border-emerald-500/40 transition">
                <div className="space-y-0.5">
                  <span className="font-bold text-xs text-slate-200 block">3. Catálogo Maestro de Herramientas</span>
                  <p className="text-[11px] text-slate-400">Series, marcas, disponibilidad operativa y estado físico</p>
                </div>
                <button
                  onClick={handleExportToolsInventory}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 transition shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Excel</span>
                </button>
              </div>

              {/* 4. Solicitudes de Compra */}
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 flex items-center justify-between gap-3 hover:border-emerald-500/40 transition">
                <div className="space-y-0.5">
                  <span className="font-bold text-xs text-slate-200 block">4. Solicitudes de Compra y Reposición</span>
                  <p className="text-[11px] text-slate-400">Insumos solicitados por el personal, prioridades y justificaciones</p>
                </div>
                <button
                  onClick={handleExportPurchases}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 transition shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Excel</span>
                </button>
              </div>

              {/* 5. Consumo Interno de Taller y Salidas de Bodega */}
              <div className="p-4 rounded-xl border border-orange-500/40 bg-orange-500/5 md:col-span-2 space-y-3">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-orange-300 block">5. Reporte Consolidado de Consumo en Taller y Salidas por Patente</span>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-orange-500/20 text-orange-400 border border-orange-500/30">
                        COMPLETO
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Exporta la matriz completa de insumos, repuestos y herramientas utilizados en taller con identificación de patente, guía/movimiento, responsable y totales
                    </p>
                  </div>

                  <button
                    onClick={handleExportWorkshopConsumption}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-black rounded-xl bg-orange-500 hover:bg-orange-600 text-black shadow-lg shadow-orange-500/20 transition active:scale-95 shrink-0"
                  >
                    <Download className="w-4 h-4" />
                    <span>Descargar Excel Consumo Taller</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Interactive PDF Reader Modal for Executive Report */}
      {isPdfModalOpen && pdfDoc && (
        <PDFViewerModal
          isOpen={isPdfModalOpen}
          onClose={() => {
            setIsPdfModalOpen(false);
            setPdfDoc(null);
          }}
          doc={pdfDoc}
          filename={pdfFilename}
          title={pdfTitle}
          subtitle={pdfSubtitle}
        />
      )}
    </div>
  );
};
