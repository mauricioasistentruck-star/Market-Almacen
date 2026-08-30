import { WorkerAutocomplete } from '../workers/WorkerAutocomplete';
import React, { useState, useEffect } from 'react';
import type { Incident, Product, Tool } from '../../types';
import { useTheme } from '../../utils/themeContext';
import { useCompany } from '../../utils/companyContext';
import { useAuth } from '../../utils/authContext';
import { db } from '../../db/database';
import { formatRut, getNextLossActFolio } from '../../utils/barcodeGenerator';
import { formatChilePhone } from '../../utils/phoneFormatter';
import { generateLossActPDF, downloadPDF, printPDF, sharePDFDocument } from '../../utils/pdfGenerator';
import { triggerCloudSync, notifyLocalMutation } from '../../utils/cloudSync';
import { SignaturePadModal } from '../SignaturePadModal';
import { LossActModal } from './LossActModal';
import {
  AlertTriangle,
  Plus,
  FileText,
  Trash2,
  Calendar,
  User,
  Search,
  ScanLine,
  DollarSign,
  Check,
  X,
  PenTool,
  Download,
  Printer,
  MessageSquare,
  ShieldCheck,
  ShieldAlert
} from 'lucide-react';

interface IncidentsViewProps {
  onOpenScanner?: () => void;
  scannedBarcode?: string;
  refreshTrigger: number;
}

export const IncidentsView: React.FC<IncidentsViewProps> = ({
  onOpenScanner,
  scannedBarcode,
  refreshTrigger
}) => {
  const { themeClasses } = useTheme();
  const { selectedCompanyId, selectedCompany, companies } = useCompany();
  const { isAdmin } = useAuth();

  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [selectedIncidentForAct, setSelectedIncidentForAct] = useState<Incident | null>(null);

  // Form states
  const [folio, setFolio] = useState('ACT-00001');
  const [date, setDate] = useState('');
  const [type, setType] = useState<'DANO' | 'PERDIDA' | 'MERMA'>('PERDIDA');
  const [itemType, setItemType] = useState<'HERRAMIENTA' | 'PRODUCTO'>('HERRAMIENTA');
  const [isWorkerAtFault, setIsWorkerAtFault] = useState<boolean>(false);
  const [faultType, setFaultType] = useState<'DESGASTE_NATURAL' | 'FALLA_EQUIPO' | 'FUERZA_MAYOR' | 'NEGLIGENCIA_TRABAJADOR'>('DESGASTE_NATURAL');
  const [itemCode, setItemCode] = useState('');
  const [itemName, setItemName] = useState('');
  const [brand, setBrand] = useState('');
  const [quantity, setQuantity] = useState<number | string>(1);
  const [responsibleName, setResponsibleName] = useState('');
  const [responsibleRut, setResponsibleRut] = useState('');
  const [responsiblePhone, setResponsiblePhone] = useState('+56 9 ');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [estimatedCost, setEstimatedCost] = useState(0);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [isSignPadOpen, setIsSignPadOpen] = useState(false);

  // Autocomplete catalog state
  const [catalogItems, setCatalogItems] = useState<{
    code: string;
    name: string;
    brand?: string;
    isTool: boolean;
    price?: number;
  }[]>([]);
  const [suggestions, setSuggestions] = useState<typeof catalogItems>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Quick created incident modal
  const [createdIncident, setCreatedIncident] = useState<Incident | null>(null);

  useEffect(() => {
    loadIncidents();
    loadCatalog();
  }, [refreshTrigger, selectedCompanyId]);

  useEffect(() => {
    if (scannedBarcode && isAdding) {
      handleLookupItem(scannedBarcode);
    }
  }, [scannedBarcode, isAdding]);

  const loadCatalog = async () => {
    const prods = await db.products.toArray();
    const tls = await db.tools.toArray();
    setCatalogItems([
      ...prods.map(p => ({ code: p.code, name: p.name, brand: p.brand, isTool: false, price: p.price })),
      ...tls.map(t => ({ code: t.code, name: t.name, brand: t.brand, isTool: true, price: 0 }))
    ]);
  };

  const loadIncidents = async () => {
    let query = db.incidents.toCollection();
    if (selectedCompanyId !== 'ALL') {
      const list = await db.incidents.where('companyId').equals(selectedCompanyId).reverse().toArray();
      setIncidents(list);
    } else {
      const list = await query.reverse().toArray();
      setIncidents(list);
    }
  };

  const handleOpenAdd = async () => {
    const now = new Date();
    setDate(now.toISOString().split('T')[0]);
    const nextFolio = await getNextLossActFolio();
    setFolio(nextFolio);
    setType('PERDIDA');
    setItemType('HERRAMIENTA');
    setIsWorkerAtFault(false);
    setFaultType('DESGASTE_NATURAL');
    setItemCode('');
    setItemName('');
    setBrand('');
    setQuantity(1);
    setResponsibleName('');
    setResponsibleRut('');
    setResponsiblePhone('+56 9 ');
    setLocation('Faena Central / Taller');
    setDescription('');
    setEstimatedCost(0);
    setSignatureData(null);
    setCreatedIncident(null);
    setIsAdding(true);
  };

  const handleNameChange = (val: string) => {
    setItemName(val);
    if (!val.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    const q = val.toLowerCase().trim();
    const matches = catalogItems.filter(item =>
      item.name.toLowerCase().includes(q) ||
      item.code.toLowerCase().includes(q) ||
      (item.brand && item.brand.toLowerCase().includes(q))
    ).slice(0, 8);

    setSuggestions(matches);
    setShowSuggestions(matches.length > 0);
  };

  const handleSelectCatalogItem = (item: typeof catalogItems[0]) => {
    setItemCode(item.code);
    setItemName(item.name);
    setBrand(item.brand || '');
    setItemType(item.isTool ? 'HERRAMIENTA' : 'PRODUCTO');
    if (item.price) setEstimatedCost(item.price);
    setShowSuggestions(false);
  };

  const handleLookupItem = async (codeStr: string) => {
    const clean = codeStr.trim().toUpperCase();
    setItemCode(clean);
    const tool = await db.tools.where('code').equals(clean).first();
    if (tool) {
      setItemName(tool.name);
      setBrand(tool.brand || '');
      setItemType('HERRAMIENTA');
      return;
    }
    const prod = await db.products.where('code').equals(clean).first();
    if (prod) {
      setItemName(prod.name);
      setBrand(prod.brand || '');
      setItemType('PRODUCTO');
      setEstimatedCost(prod.price || 0);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!responsibleName.trim() || !itemCode.trim()) {
      alert('Por favor complete los campos obligatorios del reporte.');
      return;
    }

    const newInc: Incident = {
      date: date || new Date().toISOString().split('T')[0],
      type,
      itemType,
      itemCode: itemCode.trim().toUpperCase(),
      itemName: itemName.trim() || 'Ítem sin descripción',
      brand: brand.trim().toUpperCase() || undefined,
      quantity: Number(quantity) || 1,
      responsibleName: responsibleName.trim().toUpperCase(),
      responsibleRut: responsibleRut.trim() ? formatRut(responsibleRut) : undefined,
      responsiblePhone: responsiblePhone.trim() || undefined,
      location: location.trim() || 'Faena / Taller',
      description: description.trim(),
      estimatedCost: Number(estimatedCost) || 0,
      resolutionStatus: 'ABIERTO',
      lossActFolio: folio,
      lossActSigned: !!signatureData,
      signatureData: signatureData || undefined,
      isWorkerAtFault,
      faultType,
      companyId: selectedCompanyId === 'ALL' ? (companies[0]?.id || '') : selectedCompanyId,
      createdAt: new Date().toISOString()
    };

    // If it's a tool, update tool status
    if (itemType === 'HERRAMIENTA') {
      const tool = await db.tools.where('code').equals(newInc.itemCode).first();
      if (tool) {
        await db.tools.update(tool.id!, {
          status: type === 'PERDIDA' ? 'PERDIDA' : 'DANADA',
          condition: type === 'PERDIDA' ? 'DANADO' : 'DANADO',
          conditionNotes: `Reporte de ${type}: ${description.slice(0, 50)}...`,
          updatedAt: new Date().toISOString()
        });
      }
    }

    const id = await db.incidents.add(newInc);
    newInc.id = id as number;

    notifyLocalMutation();
    loadIncidents();
    setCreatedIncident(newInc);
  };

  const handleDelete = async (id: number) => {
    if (!isAdmin) return;
    if (confirm('¿Está seguro de eliminar este registro de incidencia?')) {
      await db.incidents.delete(id);
      notifyLocalMutation();
      loadIncidents();
    }
  };

  const handleDownloadActPDF = async (inc: Incident) => {
    const comp = companies.find(c => c.id === inc.companyId);
    const doc = await generateLossActPDF(inc, comp);
    downloadPDF(doc, `Acta_Responsabilidad_${inc.lossActFolio || inc.id}_${inc.responsibleName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
  };

  const handlePrintActPDF = async (inc: Incident) => {
    const comp = companies.find(c => c.id === inc.companyId);
    const doc = await generateLossActPDF(inc, comp);
    printPDF(doc);
  };

  const handleWhatsAppAct = async (inc: Incident) => {
    const comp = companies.find(c => c.id === inc.companyId);
    const doc = await generateLossActPDF(inc, comp);
    await sharePDFDocument({
      doc,
      filename: `Acta_Responsabilidad_${inc.lossActFolio || inc.id}.pdf`,
      recipientPhone: inc.responsiblePhone,
      title: `Acta de Responsabilidad ${inc.lossActFolio || 'Oficial'}`,
      messageText: `Estimado(a) ${inc.responsibleName}, adjunto acta oficial emitida por Market Almacén referente a ${inc.itemName}.`
    });
  };

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className={`p-4 rounded-2xl border ${themeClasses.border} ${themeClasses.card} flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-sm`}>
        <div>
          <h2 className="font-extrabold text-lg sm:text-xl text-slate-100 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <span>Control de Daños, Pérdidas y Actas de Responsabilidad</span>
          </h2>
          <p className={`text-xs ${themeClasses.textMuted}`}>
            Registro formal con timbre de bodega, firma virtual y generación inmediata de PDF
          </p>
        </div>

        {isAdmin && !isAdding && (
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-500/20 transition active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Reporte & Generar Acta</span>
          </button>
        )}
      </div>

      {/* CREATE MODAL / FORM VIEW */}
      {isAdding && (
        <div className={`p-5 rounded-2xl border border-red-500/30 ${themeClasses.card} shadow-xl space-y-4`}>
          {createdIncident ? (
            /* AFTER CREATED: ACTIONS */
            <div className="text-center py-6 space-y-5">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto shadow-lg">
                <Check className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="font-black text-xl text-slate-100">
                  Acta Folio {createdIncident.lossActFolio} Registrada con Éxito
                </h3>
                <p className="text-xs text-slate-400">
                  Se guardó la firma virtual de <strong>{createdIncident.responsibleName}</strong> y el timbre de bodega conforme.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-xl mx-auto pt-2">
                <button
                  onClick={() => handlePrintActPDF(createdIncident)}
                  className="p-3.5 rounded-2xl bg-slate-900 border border-slate-700 hover:border-orange-500 flex flex-col items-center gap-1.5 text-slate-200 transition"
                >
                  <Printer className="w-5 h-5 text-orange-400" />
                  <span className="text-xs font-bold">Imprimir Acta</span>
                </button>

                <button
                  onClick={() => handleDownloadActPDF(createdIncident)}
                  className="p-3.5 rounded-2xl bg-red-600 hover:bg-red-700 text-white flex flex-col items-center gap-1.5 shadow-lg shadow-red-500/20 transition"
                >
                  <Download className="w-5 h-5" />
                  <span className="text-xs font-bold">Descargar PDF</span>
                </button>

                <button
                  onClick={() => handleWhatsAppAct(createdIncident)}
                  className="p-3.5 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 hover:bg-emerald-900/50 flex flex-col items-center gap-1.5 text-emerald-300 transition"
                >
                  <MessageSquare className="w-5 h-5 text-emerald-400" />
                  <span className="text-xs font-bold">Enviar WhatsApp</span>
                </button>
              </div>

              <div className="pt-3 border-t border-slate-800">
                <button
                  onClick={() => {
                    setIsAdding(false);
                    setCreatedIncident(null);
                  }}
                  className="px-6 py-2 text-xs font-bold rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 transition"
                >
                  Finalizar y Volver al Listado
                </button>
              </div>
            </div>
          ) : (
            /* FORM */
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2 text-red-400 font-bold text-sm">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Nuevo Reporte de Incidencia & Generador de Acta ({folio})</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">Tipo de Incidencia *</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as any)}
                    className={`w-full px-2.5 py-1.5 text-xs font-bold rounded-lg border ${themeClasses.inputBorder} ${themeClasses.inputBg}`}
                  >
                    <option value="PERDIDA">PÉRDIDA / EXTRAVÍO</option>
                    <option value="DANO">DAÑO / ROTURA</option>
                    <option value="MERMA">MERMA OPERATIVA</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">Tipo de Ítem *</label>
                  <select
                    value={itemType}
                    onChange={(e) => setItemType(e.target.value as any)}
                    className={`w-full px-2.5 py-1.5 text-xs rounded-lg border ${themeClasses.inputBorder} ${themeClasses.inputBg}`}
                  >
                    <option value="HERRAMIENTA">Herramienta</option>
                    <option value="PRODUCTO">Producto / Repuesto</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">Fecha del Hecho *</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className={`w-full px-2.5 py-1.5 text-xs rounded-lg border ${themeClasses.inputBorder} ${themeClasses.inputBg}`}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">Código de Ítem *</label>
                  <div className="flex gap-1">
                    <input
                      type="text"
                      required
                      value={itemCode}
                      onChange={(e) => {
                        setItemCode(e.target.value);
                        handleLookupItem(e.target.value);
                      }}
                      placeholder="Ej: HERR-001 / 74829103..."
                      className={`flex-1 px-2.5 py-1.5 text-xs font-mono rounded-lg border ${themeClasses.inputBorder} ${themeClasses.inputBg}`}
                    />
                    {onOpenScanner && (
                      <button
                        type="button"
                        onClick={onOpenScanner}
                        className="p-1.5 text-xs bg-orange-500/20 text-orange-400 rounded-lg border border-orange-500/30"
                      >
                        <ScanLine className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Name with Live Autocomplete */}
                <div className="sm:col-span-2 relative">
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">
                    Descripción del Ítem (Escriba para autocompletar) *
                  </label>
                  <input
                    type="text"
                    required
                    value={itemName}
                    onChange={(e) => handleNameChange(e.target.value)}
                    onFocus={() => {
                      if (itemName.trim()) handleNameChange(itemName);
                    }}
                    placeholder="Gata Hidráulica 30 Ton / Filtro de Aceite..."
                    className={`w-full px-2.5 py-1.5 text-xs rounded-lg border ${themeClasses.inputBorder} ${themeClasses.inputBg}`}
                  />

                  {showSuggestions && suggestions.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-slate-900 border border-orange-500/50 rounded-xl shadow-2xl overflow-hidden max-h-48 overflow-y-auto divide-y divide-slate-800">
                      {suggestions.map((s, idx) => (
                        <div
                          key={idx}
                          onClick={() => handleSelectCatalogItem(s)}
                          className="p-2 hover:bg-slate-800 cursor-pointer flex items-center justify-between text-xs transition"
                        >
                          <div>
                            <div className="font-bold text-slate-100">{s.name}</div>
                            <div className="text-[10px] text-slate-400">
                              Cód: <span className="font-mono text-orange-400">{s.code}</span> {s.brand && `• ${s.brand}`}
                            </div>
                          </div>
                          <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-orange-500/20 text-orange-300">
                            {s.isTool ? 'HERRAMIENTA' : 'PRODUCTO'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">Marca (Opcional)</label>
                  <input
                    type="text"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    placeholder="Mega, Snap-On..."
                    className={`w-full px-2.5 py-1.5 text-xs rounded-lg border ${themeClasses.inputBorder} ${themeClasses.inputBg}`}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">Cantidad Afectada *</label>
                  <input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => { const v = e.target.value; setQuantity(v === "" ? "" : Math.max(1, parseInt(v) || 1)); }} onBlur={(e) => { if (!e.target.value || Number(e.target.value) < 1) setQuantity(1); }}
                    className={`w-full px-2.5 py-1.5 text-xs font-mono font-bold rounded-lg border ${themeClasses.inputBorder} ${themeClasses.inputBg}`}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">Costo Reposición Aprox. CLP</label>
                  <input
                    type="number"
                    value={estimatedCost}
                    onChange={(e) => setEstimatedCost(parseInt(e.target.value) || 0)}
                    className={`w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border ${themeClasses.inputBorder} ${themeClasses.inputBg}`}
                  />
                </div>
              </div>

              {/* Responsible Worker info */}
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2.5">
                <h4 className="text-xs font-bold text-slate-200">Datos del Trabajador Responsable</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">Nombre Completo *</label>
                    <input
                      type="text"
                      required
                      value={responsibleName}
                      onChange={(e) => setResponsibleName(e.target.value)}
                      placeholder="Ej: Pedro Soto Alarcón"
                      className={`w-full px-2.5 py-1.5 text-xs rounded-lg border ${themeClasses.inputBorder} ${themeClasses.inputBg}`}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">
                      RUT / DNI <span className="text-slate-400 font-normal">(Opcional)</span>
                    </label>
                    <input
                      type="text"
                      value={responsibleRut}
                      onChange={(e) => setResponsibleRut(e.target.value)}
                      placeholder="17.432.890-5"
                      className={`w-full px-2.5 py-1.5 text-xs rounded-lg border ${themeClasses.inputBorder} ${themeClasses.inputBg}`}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">
                      Teléfono Celular <span className="text-slate-400 font-normal">(Opcional)</span>
                    </label>
                    <input
                      type="text"
                      value={responsiblePhone}
                      onChange={(e) => setResponsiblePhone(formatChilePhone(e.target.value))}
                      placeholder="+56 9 6123 4567"
                      className={`w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border ${themeClasses.inputBorder} ${themeClasses.inputBg}`}
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">Lugar / Faena donde ocurrió el hecho *</label>
                    <input
                      type="text"
                      required
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="Faena Central / Taller"
                      className={`w-full px-2.5 py-1.5 text-xs rounded-lg border ${themeClasses.inputBorder} ${themeClasses.inputBg}`}
                    />
                  </div>
                </div>
              </div>

              {/* Dictamen y Atribución de Responsabilidad */}
              <div className="p-3.5 rounded-xl border border-slate-700/80 bg-slate-900/60 space-y-2.5">
                <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-blue-400" />
                  <span>Dictamen y Atribución de Responsabilidad *</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => { setIsWorkerAtFault(false); setFaultType('DESGASTE_NATURAL'); }}
                    className={`p-3 rounded-xl border text-left transition ${
                      !isWorkerAtFault
                        ? 'bg-blue-500/20 border-blue-500 text-blue-200 shadow-md ring-1 ring-blue-500/50'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <ShieldCheck className="w-4 h-4 text-blue-400" />
                      <span className="font-bold text-xs">Exento de Culpa / Desgaste Natural</span>
                    </div>
                    <p className="text-[10.5px] text-slate-400 leading-tight">
                      Fatiga de material, defecto de fábrica o desgaste por uso operativo normal. No culpa al trabajador ni aplica cobro ni sanción.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => { setIsWorkerAtFault(true); setFaultType('NEGLIGENCIA_TRABAJADOR'); }}
                    className={`p-3 rounded-xl border text-left transition ${
                      isWorkerAtFault
                        ? 'bg-red-500/20 border-red-500 text-red-200 shadow-md ring-1 ring-red-500/50'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <ShieldAlert className="w-4 h-4 text-red-400" />
                      <span className="font-bold text-xs">Con Responsabilidad del Operador</span>
                    </div>
                    <p className="text-[10.5px] text-slate-400 leading-tight">
                      Descuido, pérdida no justificada o mal uso de la herramienta. Aplica acta formal de responsabilidad.
                    </p>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Descripción de las Circunstancias y Hechos (Se incluirá en el acta formal): *
                </label>
                <textarea
                  rows={2}
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ej: Durante faena en taller, se produce rotura por fatiga de material tras uso continuo..."
                  className={`w-full px-3 py-2 text-xs rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg}`}
                />
              </div>

              {/* Digital Stamp Preview & Signature Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {/* Stamp Box */}
                <div className={`p-3.5 rounded-xl border text-center space-y-1 ${
                  !isWorkerAtFault
                    ? 'border-blue-500/40 bg-blue-500/10 text-blue-300'
                    : 'border-red-500/40 bg-red-500/10 text-red-300'
                }`}>
                  <span className="text-xs font-black block">
                    {!isWorkerAtFault ? 'INFORME TÉCNICO DE NOVEDAD' : 'CONSTANCIA DE BODEGA'}
                  </span>
                  <span className="text-[10px] block font-mono opacity-80">
                    Folio: {folio} | Fecha: {date || 'Hoy'}
                  </span>
                  <span className="text-[10px] font-bold block">
                    Encargado de Bodega: Mauricio Chamorro
                  </span>
                </div>

                {/* Worker Signature Box */}
                <div className="p-3 rounded-xl border border-slate-700 bg-slate-900/60 flex items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-slate-200 block">Firma del Trabajador</span>
                    <span className="text-[11px] text-slate-400">
                      {signatureData ? '✓ Firma registrada' : 'Firmar acta en pantalla en el acto'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsSignPadOpen(true)}
                    className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl transition ${
                      signatureData
                        ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/40'
                        : isWorkerAtFault ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                  >
                    <PenTool className="w-3.5 h-3.5" />
                    <span>{signatureData ? 'Cambiar Firma' : 'Firmar en Pantalla'}</span>
                  </button>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="px-4 py-2 text-xs rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={`flex items-center gap-1.5 px-6 py-2 text-xs font-bold rounded-xl text-white shadow-lg transition active:scale-95 ${
                    !isWorkerAtFault ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20' : 'bg-red-600 hover:bg-red-700 shadow-red-500/20'
                  }`}
                >
                  <Check className="w-4 h-4" />
                  <span>Guardar e Imprimir Acta</span>
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Table List Container */}
      <div className={`rounded-2xl border ${themeClasses.border} ${themeClasses.card} overflow-hidden shadow-md`}>
        <div className="p-3.5 bg-slate-900/60 border-b border-slate-800 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-200">Historial de Reportes Registrados ({incidents.length})</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 bg-slate-900/40">
                <th className="py-2.5 px-3">Folio / Fecha</th>
                <th className="py-2.5 px-3">Tipo / Dictamen</th>
                <th className="py-2.5 px-3">Ítem / Herramienta</th>
                <th className="py-2.5 px-3">Trabajador Involucrado</th>
                <th className="py-2.5 px-3">Lugar / Faena</th>
                <th className="py-2.5 px-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {incidents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    No se han registrado reportes de daño o pérdidas.
                  </td>
                </tr>
              ) : (
                incidents.map((inc) => (
                  <tr key={inc.id} className="hover:bg-slate-800/20 transition">
                    <td className="py-2.5 px-3">
                      <span className="font-mono font-bold text-orange-400 block">{inc.lossActFolio || `ACT-${inc.id}`}</span>
                      <span className="text-[11px] text-slate-400">{new Date(inc.date).toLocaleDateString('es-CL')}</span>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex flex-col gap-1">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black w-fit ${
                            inc.type === 'PERDIDA'
                              ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                              : inc.type === 'DANO'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                          }`}
                        >
                          {inc.type}
                        </span>
                        {inc.isWorkerAtFault === false ? (
                          <span className="inline-flex items-center gap-1 text-[9.5px] font-bold text-blue-400">
                            <ShieldCheck className="w-3 h-3" /> Sin Culpa (Desgaste)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[9.5px] font-bold text-red-400">
                            <ShieldAlert className="w-3 h-3" /> Con Responsabilidad
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-slate-200">{inc.itemName}</div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        Cód: {inc.itemCode} • Cant: {inc.quantity} {inc.brand ? `(${inc.brand})` : ''}
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-slate-200">{inc.responsibleName}</div>
                      <div className="text-[11px] text-slate-400 font-mono">RUT: {inc.responsibleRut}</div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-300">{inc.location}</td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleDownloadActPDF(inc)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 transition"
                          title="Descargar Acta en PDF"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>PDF</span>
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => handleDelete(inc.id!)}
                            className="p-1.5 text-slate-400 hover:text-red-400 transition"
                            title="Eliminar reporte"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Signature Pad Modal */}
      <SignaturePadModal
        isOpen={isSignPadOpen}
        onClose={() => setIsSignPadOpen(false)}
        onSave={(data) => {
          setSignatureData(data);
          setIsSignPadOpen(false);
        }}
        title="Firma del Trabajador Responsable"
        subtitle={`Responsable: ${responsibleName || 'Trabajador'} (RUT: ${responsibleRut || 'Declarado'})`}
      />

      {/* Loss Act Modal */}
      {selectedIncidentForAct && (
        <LossActModal
          isOpen={!!selectedIncidentForAct}
          onClose={() => setSelectedIncidentForAct(null)}
          incident={selectedIncidentForAct}
          onSaved={() => {
            loadIncidents();
            setSelectedIncidentForAct(null);
          }}
        />
      )}
    </div>
  );
};

