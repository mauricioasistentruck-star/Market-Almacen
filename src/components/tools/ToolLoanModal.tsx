import { useBodyScrollLock } from '../../utils/scrollLock';
import React, { useState, useEffect } from 'react';
import type { Tool, ToolLoan, ToolKit, ItemCondition, Worker } from '../../types';
import { WorkerAutocomplete } from '../workers/WorkerAutocomplete';
import { useTheme } from '../../utils/themeContext';
import { db } from '../../db/database';
import { formatRut } from '../../utils/barcodeGenerator';
import { formatChilePhone } from '../../utils/phoneFormatter';
import { triggerCloudSync, notifyLocalMutation } from '../../utils/cloudSync';
import {
  X,
  Handshake,
  Check,
  ScanLine,
  AlertCircle,
  PenTool,
  Briefcase,
  Wrench,
  Sparkles,
  Layers,
  Plus,
  Trash2,
  Search,
  UserCheck
} from 'lucide-react';
import { SignaturePadModal } from '../SignaturePadModal';

interface ToolLoanModalProps {
  isOpen: boolean;
  onClose: () => void;
  tool?: Tool | null;
  onSaved: () => void;
  onOpenScanner?: () => void;
  scannedBarcode?: string;
}

export const ToolLoanModal: React.FC<ToolLoanModalProps> = ({
  isOpen,
  onClose,
  tool,
  onSaved,
  onOpenScanner,
  scannedBarcode
}) => {
  useBodyScrollLock(Boolean(isOpen));
  const { themeClasses } = useTheme();

  // Multi-tool Loan List
  const [selectedTools, setSelectedTools] = useState<{ tool: Tool; fromKitName?: string }[]>([]);
  const [allAvailableTools, setAllAvailableTools] = useState<Tool[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Tool[]>([]);

  // Kit State
  const [availableKits, setAvailableKits] = useState<ToolKit[]>([]);
  const [selectedKitId, setSelectedKitId] = useState<number | ''>('');

  // Common Loan Form State
  const [workerName, setWorkerName] = useState('');
  const [workerRut, setWorkerRut] = useState('');
  const [workerPhone, setWorkerPhone] = useState('+56 9 ');
  const [workerRole, setWorkerRole] = useState('MECÁNICO DE TALLER');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [expectedReturnDate, setExpectedReturnDate] = useState('');
  const [deliveryCondition, setDeliveryCondition] = useState<ItemCondition>('BUENO');
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [isSignPadOpen, setIsSignPadOpen] = useState(false);

  // Active Loans for selected worker
  const [workerActiveLoans, setWorkerActiveLoans] = useState<ToolLoan[]>([]);

  useEffect(() => {
    if (isOpen) {
      const now = new Date();
      const localISO = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      setDeliveryDate(localISO);

      const tomorrow = new Date(now.getTime() + 24 * 3600 * 1000);
      setExpectedReturnDate(tomorrow.toISOString().split('T')[0]);

      setSignatureData(null);
      setSearchQuery('');
      setSelectedKitId('');
      setWorkerActiveLoans([]);

      // Load all available tools & kits
      loadToolsAndKits();

      if (tool) {
        setSelectedTools([{ tool }]);
        setDeliveryCondition(tool.condition || 'BUENO');
      } else if (scannedBarcode) {
        findAndAddToolByCode(scannedBarcode);
      } else {
        setSelectedTools([]);
      }
    }
  }, [isOpen, tool, scannedBarcode]);

  const loadToolsAndKits = async () => {
    const tools = await db.tools.toArray();
    setAllAvailableTools(tools);
    const kits = await db.toolKits.toArray();
    setAvailableKits(kits || []);
  };

  // Case-insensitive tool search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const q = searchQuery.toLowerCase().trim();
    const results = allAvailableTools.filter((t) => {
      const matchCode = t.code?.toLowerCase().includes(q);
      const matchName = t.name?.toLowerCase().includes(q);
      const matchBrand = t.brand?.toLowerCase().includes(q);
      const matchModel = t.model?.toLowerCase().includes(q);
      const matchLoc = t.location?.toLowerCase().includes(q);
      return (matchCode || matchName || matchBrand || matchModel || matchLoc) && t.status !== 'DE_BAJA';
    }).slice(0, 8);

    setSearchResults(results);
  }, [searchQuery, allAvailableTools]);

  const findAndAddToolByCode = async (codeStr: string) => {
    const clean = codeStr.trim().toLowerCase();
    const found = allAvailableTools.find(
      (t) => t.code.toLowerCase() === clean || (t.brand && t.brand.toLowerCase() === clean)
    );
    if (found) {
      addToolToLoan(found);
      setSearchQuery('');
    }
  };

  const addToolToLoan = (t: Tool, fromKitName?: string) => {
    if (selectedTools.some((item) => item.tool.id === t.id)) {
      alert(`La herramienta ${t.code} ya está agregada a la lista de entrega actual.`);
      return;
    }
    if (t.status === 'PRESTADA') {
      if (!confirm(`⚠️ La herramienta ${t.code} (${t.name}) figura actualmente como PRESTADA en el sistema. ¿Desea agregarla de todas formas?`)) {
        return;
      }
    }
    setSelectedTools((prev) => [...prev, { tool: t, fromKitName }]);
    setSearchQuery('');
    setSearchResults([]);
  };

  const removeToolFromLoan = (toolId?: number) => {
    setSelectedTools((prev) => prev.filter((item) => item.tool.id !== toolId));
  };

  const handleAddKitTools = async () => {
    if (!selectedKitId) return;
    const kit = availableKits.find((k) => k.id === Number(selectedKitId));
    if (!kit || !kit.toolIds || kit.toolIds.length === 0) {
      alert('El kit seleccionado no contiene herramientas asociadas.');
      return;
    }
    const kitTools = allAvailableTools.filter((t) => kit.toolIds.includes(t.id!));
    let addedCount = 0;
    setSelectedTools((prev) => {
      const next = [...prev];
      for (const t of kitTools) {
        if (!next.some((item) => item.tool.id === t.id)) {
          next.push({ tool: t, fromKitName: kit.name });
          addedCount++;
        }
      }
      return next;
    });
    alert(`Se agregaron ${addedCount} herramientas del kit "${kit.name}" a la lista de entrega.`);
  };

  // Check worker active loans when worker name changes
  const handleWorkerSelected = async (name: string) => {
    setWorkerName(name.toUpperCase());
    if (name.trim()) {
      const active = await db.toolLoans
        .filter((l) => l.status === 'ACTIVO' && l.workerName.trim().toLowerCase() === name.trim().toLowerCase())
        .toArray();
      setWorkerActiveLoans(active);
    } else {
      setWorkerActiveLoans([]);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workerName.trim()) {
      alert('Por favor ingrese el nombre del trabajador receptor.');
      return;
    }

    if (selectedTools.length === 0) {
      alert('Por favor agregue al menos una herramienta a la lista de entrega.');
      return;
    }

    const isoDeliveryDate = new Date(deliveryDate).toISOString();

    for (const item of selectedTools) {
      const t = item.tool;
      const toolTitle = item.fromKitName ? `${t.name} (Kit: ${item.fromKitName})` : t.name;

      const loanData: ToolLoan = {
        toolId: t.id!,
        toolCode: t.code,
        toolName: toolTitle,
        toolBrand: t.brand,
        workerName: workerName.trim().toUpperCase(),
        workerRut: workerRut.trim() ? formatRut(workerRut) : undefined,
        workerPhone: workerPhone.trim() || undefined,
        workerRole: workerRole.trim().toUpperCase() || undefined,
        deliveryDate: isoDeliveryDate,
        expectedReturnDate: expectedReturnDate || undefined,
        status: 'ACTIVO',
        deliveryCondition: t.condition || deliveryCondition,
        companyId: t.companyId,
        signatureData: signatureData || undefined,
        deliveredBy: 'Mauricio Chamorro'
      };

      await db.toolLoans.add(loanData);
      await db.tools.update(t.id!, {
        status: 'PRESTADA',
        updatedAt: new Date().toISOString()
      });
    }

    notifyLocalMutation();
    onSaved();
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm">
        <div className={`w-full max-w-2xl rounded-2xl border ${themeClasses.border} ${themeClasses.card} p-5 shadow-2xl flex flex-col max-h-[94vh]`}>
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-700/50">
            <div className="flex items-center gap-2.5">
              <div className={`p-2 rounded-lg ${themeClasses.badge}`}>
                <Handshake className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <h3 className="font-bold text-base leading-tight">Registrar Préstamo de Herramientas</h3>
                <p className={`text-xs ${themeClasses.textMuted}`}>
                  Entrega múltiple de herramientas y kits a cargo del trabajador
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="my-2 space-y-3.5 overflow-y-auto pr-1 flex-1">
            {/* Tool Selection Section */}
            <div className="p-3.5 rounded-xl border border-orange-500/40 bg-orange-500/5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-orange-400 flex items-center gap-1.5">
                  <Wrench className="w-4 h-4" />
                  <span>1. Buscar y Agregar Herramientas o Kits a la Entrega</span>
                </span>
                <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-300">
                  {selectedTools.length} seleccionada(s)
                </span>
              </div>

              {/* Live Search Input */}
              <div className="relative">
                <div className="flex gap-1.5">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Buscar por código, nombre, marca o modelo (minúsculas o mayúsculas)..."
                      className={`w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-white`}
                    />
                  </div>
                  {onOpenScanner && (
                    <button
                      type="button"
                      onClick={onOpenScanner}
                      className="p-2 text-xs font-medium rounded-xl bg-orange-500/20 text-orange-400 border border-orange-500/30 hover:bg-orange-500/30"
                      title="Escanear con cámara"
                    >
                      <ScanLine className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Dropdown Suggestions */}
                {searchResults.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-slate-900 border border-orange-500/50 rounded-xl shadow-2xl overflow-hidden max-h-48 overflow-y-auto divide-y divide-slate-800">
                    {searchResults.map((t) => (
                      <div
                        key={t.id}
                        onClick={() => addToolToLoan(t)}
                        className="p-2.5 hover:bg-slate-800 cursor-pointer flex items-center justify-between text-xs transition"
                      >
                        <div>
                          <div className="font-bold text-slate-100 flex items-center gap-1.5">
                            <span>{t.name}</span>
                            <span className="font-mono text-orange-400 text-[11px]">({t.code})</span>
                          </div>
                          <div className="text-[10.5px] text-slate-400">
                            Marca: {t.brand || 'Genérica'} • Ubic: {t.location}
                          </div>
                        </div>
                        <span
                          className={`text-[9.5px] font-bold px-2 py-0.5 rounded-full ${
                            t.status === 'DISPONIBLE'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-red-500/20 text-red-300'
                          }`}
                        >
                          {t.status === 'DISPONIBLE' ? '+ Agregar' : '⚠️ Prestada'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add Kit Option */}
              {availableKits.length > 0 && (
                <div className="flex items-center gap-2 pt-1">
                  <select
                    value={selectedKitId}
                    onChange={(e) => setSelectedKitId(Number(e.target.value))}
                    className={`flex-1 px-3 py-1.5 text-xs font-bold rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-slate-100`}
                  >
                    <option value="">-- Seleccionar Mochila / Kit de Herramientas --</option>
                    {availableKits.map((k) => (
                      <option key={k.id} value={k.id}>
                        🎒 {k.name} ({k.toolIds?.length || 0} herramientas)
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleAddKitTools}
                    disabled={!selectedKitId}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-xl bg-orange-600 hover:bg-orange-700 disabled:bg-slate-800 disabled:text-slate-500 text-white transition shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Añadir Kit</span>
                  </button>
                </div>
              )}

              {/* Selected Tools Badge List */}
              {selectedTools.length > 0 ? (
                <div className="space-y-1.5 pt-1">
                  <span className="text-[11px] font-bold text-slate-300 block">
                    Herramientas que se entregarán en esta solicitud ({selectedTools.length}):
                  </span>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {selectedTools.map((item) => (
                      <div
                        key={item.tool.id}
                        className="p-2 rounded-xl bg-slate-900/90 border border-slate-700/80 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <Wrench className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                          <span className="font-bold text-slate-100 truncate">{item.tool.name}</span>
                          <span className="font-mono text-orange-400 text-[10.5px]">({item.tool.code})</span>
                          {item.fromKitName && (
                            <span className="text-[9.5px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold">
                              Kit: {item.fromKitName}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeToolFromLoan(item.tool.id)}
                          className="p-1 text-slate-400 hover:text-red-400 transition ml-2 shrink-0"
                          title="Quitar de la lista"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-2.5 rounded-xl bg-slate-800/40 text-xs text-slate-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Busque herramientas arriba o elija un kit para armar la entrega.</span>
                </div>
              )}
            </div>

            {/* Worker Selection & Active Loan History Detection */}
            <div className="p-3.5 rounded-xl border border-slate-700/60 bg-slate-900/40 space-y-3">
              <h4 className="text-xs font-bold text-slate-200">2. Datos del Trabajador Receptor</h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Buscar o Seleccionar Trabajador *
                  </label>
                  <WorkerAutocomplete
                    value={workerName}
                    onChange={(val) => handleWorkerSelected(val)}
                    onSelect={(w: Worker) => {
                      handleWorkerSelected(w.name);
                      if (w.rut) setWorkerRut(w.rut);
                      if (w.phone) setWorkerPhone(w.phone);
                      if (w.role) setWorkerRole(w.role.toUpperCase());
                    }}
                    placeholder="Escriba nombre o apellido del trabajador (ej: Carlos Morales)"
                    className={`w-full px-3 py-2 text-sm rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} uppercase`}
                    filterType={['TRABAJADOR', 'OTRO']}
                  />
                </div>

                {/* Banner if worker has previous active loans */}
                {workerActiveLoans.length > 0 && (
                  <div className="sm:col-span-2 p-2.5 rounded-xl border border-blue-500/40 bg-blue-500/10 text-xs text-blue-200 flex items-start gap-2">
                    <UserCheck className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">
                        {workerName} tiene {workerActiveLoans.length} herramienta(s) activa(s) en su poder actualmente:
                      </span>
                      <div className="mt-1 flex flex-wrap gap-1 text-[10.5px]">
                        {workerActiveLoans.map((l) => (
                          <span key={l.id} className="px-1.5 py-0.5 rounded bg-blue-900/60 text-blue-200 border border-blue-700/50">
                            {l.toolCode} - {l.toolName}
                          </span>
                        ))}
                      </div>
                      <span className="text-[10px] text-blue-300 mt-1 block">
                        ✓ Los nuevos ítems solicitados se anexarán a su registro de responsabilidad.
                      </span>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    RUT / DNI <span className="text-slate-400 font-normal">(Opcional)</span>
                  </label>
                  <input
                    type="text"
                    value={workerRut}
                    onChange={(e) => setWorkerRut(e.target.value)}
                    placeholder="16.892.341-2"
                    className={`w-full px-3 py-2 text-sm rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg}`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Teléfono Celular <span className="text-slate-400 font-normal">(Opcional)</span>
                  </label>
                  <input
                    type="text"
                    value={workerPhone}
                    onChange={(e) => setWorkerPhone(formatChilePhone(e.target.value))}
                    placeholder="+56 9 7844 1290"
                    className={`w-full px-3 py-2 text-sm font-mono rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg}`}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-300 mb-1">Cargo / Área / Faena</label>
                  <input
                    type="text"
                    value={workerRole}
                    onChange={(e) => setWorkerRole(e.target.value.toUpperCase())}
                    placeholder="MECÁNICO / TURNO NOCHE / TALLER"
                    className={`w-full px-3 py-2 text-sm rounded-xl uppercase border ${themeClasses.inputBorder} ${themeClasses.inputBg}`}
                  />
                </div>
              </div>
            </div>

            {/* Dates & Condition */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Fecha Entrega *</label>
                <input
                  type="datetime-local"
                  required
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  className={`w-full px-3 py-2 text-xs rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg}`}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Fecha Devolución</label>
                <input
                  type="date"
                  value={expectedReturnDate}
                  onChange={(e) => setExpectedReturnDate(e.target.value)}
                  className={`w-full px-3 py-2 text-xs rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg}`}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Estado de Entrega</label>
                <select
                  value={deliveryCondition}
                  onChange={(e) => setDeliveryCondition(e.target.value as ItemCondition)}
                  className={`w-full px-3 py-2 text-xs font-semibold rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg}`}
                >
                  <option value="EXCELENTE">Excelente Estado</option>
                  <option value="BUENO">Buen Estado / Operativo</option>
                  <option value="DESGASTE">Con Desgaste de Uso</option>
                </select>
              </div>
            </div>

            {/* Signature Pad Section */}
            <div className="p-3 rounded-xl border border-slate-700 bg-slate-900/60 flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-slate-200 block">Firma del Trabajador</span>
                <span className="text-[11px] text-slate-400">
                  {signatureData ? '✓ Firma registrada para la entrega' : 'Firma opcional en pantalla táctil'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsSignPadOpen(true)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl transition ${
                  signatureData
                    ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/40'
                    : 'bg-orange-500/20 text-orange-400 border border-orange-500/30 hover:bg-orange-500/30'
                }`}
              >
                <PenTool className="w-3.5 h-3.5" />
                <span>{signatureData ? 'Cambiar Firma' : 'Firmar en Pantalla'}</span>
              </button>
            </div>

            {/* Footer Buttons */}
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-700/50">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs rounded-xl border border-slate-600 hover:bg-slate-800 transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={selectedTools.length === 0 || !workerName.trim()}
                className={`flex items-center gap-1.5 px-6 py-2 text-xs font-bold rounded-xl transition ${
                  selectedTools.length > 0 && workerName.trim()
                    ? `${themeClasses.accentBg} ${themeClasses.accentHover} shadow-md shadow-orange-500/20`
                    : 'bg-slate-700 text-slate-400 cursor-not-allowed'
                }`}
              >
                <Check className="w-4 h-4" />
                <span>Confirmar Préstamo ({selectedTools.length})</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      <SignaturePadModal
        isOpen={isSignPadOpen}
        onClose={() => setIsSignPadOpen(false)}
        onSave={(data) => {
          setSignatureData(data);
          setIsSignPadOpen(false);
        }}
        title="Firma de Recepción de Herramientas"
        subtitle={`Receptor: ${workerName || 'Trabajador'} (RUT: ${workerRut || 'Declarado'})`}
      />
    </>
  );
};
