import { useBodyScrollLock } from '../../utils/scrollLock';
import React, { useState, useEffect } from 'react';
import type { ToolLoan, ItemCondition } from '../../types';
import { useTheme } from '../../utils/themeContext';
import { db } from '../../db/database';
import { triggerCloudSync, notifyLocalMutation } from '../../utils/cloudSync';
import {
  X,
  RotateCcw,
  Check,
  ScanLine,
  AlertCircle,
  Wrench,
  CheckSquare,
  Square,
  Search,
  User
} from 'lucide-react';

interface ToolReturnModalProps {
  isOpen: boolean;
  onClose: () => void;
  loan?: ToolLoan | null;
  onSaved: () => void;
  onOpenScanner?: () => void;
  scannedBarcode?: string;
}

export const ToolReturnModal: React.FC<ToolReturnModalProps> = ({
  isOpen,
  onClose,
  loan,
  onSaved,
  onOpenScanner,
  scannedBarcode
}) => {
  useBodyScrollLock(Boolean(isOpen));
  const { themeClasses } = useTheme();

  const [activeLoans, setActiveLoans] = useState<ToolLoan[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWorker, setSelectedWorker] = useState<string>('');
  
  // Selected loan IDs to return (checkboxes)
  const [selectedLoanIds, setSelectedLoanIds] = useState<number[]>([]);

  // Return Form Details
  const [returnDate, setReturnDate] = useState('');
  const [returnCondition, setReturnCondition] = useState<'BUEN_ESTADO' | 'DANADA' | 'INCOMPLETA' | 'PERDIDA'>('BUEN_ESTADO');
  const [returnNotes, setReturnNotes] = useState('');

  useEffect(() => {
    if (isOpen) {
      const now = new Date();
      const localISO = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      setReturnDate(localISO);
      setReturnCondition('BUEN_ESTADO');
      setReturnNotes('');
      setSearchQuery('');
      setSelectedLoanIds([]);

      loadActiveLoans(loan, scannedBarcode);
    }
  }, [isOpen, loan, scannedBarcode]);

  const loadActiveLoans = async (initialLoan?: ToolLoan | null, barcode?: string) => {
    const list = await db.toolLoans.where('status').equals('ACTIVO').toArray();
    setActiveLoans(list);

    if (initialLoan) {
      setSelectedWorker(initialLoan.workerName);
      setSelectedLoanIds([initialLoan.id!]);
      setSearchQuery(initialLoan.toolCode);
    } else if (barcode) {
      const clean = barcode.trim().toLowerCase();
      const found = list.find((l) => l.toolCode.toLowerCase() === clean);
      if (found) {
        setSelectedWorker(found.workerName);
        setSelectedLoanIds([found.id!]);
        setSearchQuery(found.toolCode);
      }
    } else {
      setSelectedWorker('');
    }
  };

  // Group active loans by worker
  const workersWithActiveLoans = Array.from(
    new Set(activeLoans.map((l) => l.workerName.trim()))
  ).sort();

  // Filtered loans for display
  const currentWorkerLoans = selectedWorker
    ? activeLoans.filter((l) => l.workerName.trim().toLowerCase() === selectedWorker.trim().toLowerCase())
    : activeLoans.filter((l) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase().trim();
        return (
          l.toolCode.toLowerCase().includes(q) ||
          l.toolName.toLowerCase().includes(q) ||
          l.workerName.toLowerCase().includes(q)
        );
      });

  const toggleSelectLoan = (id: number) => {
    setSelectedLoanIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllWorkerLoans = () => {
    const ids = currentWorkerLoans.map((l) => l.id!);
    if (selectedLoanIds.length === ids.length) {
      setSelectedLoanIds([]);
    } else {
      setSelectedLoanIds(ids);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedLoanIds.length === 0) {
      alert('Por favor marque al menos una herramienta para procesar la devolución.');
      return;
    }

    const isoReturnDate = new Date(returnDate).toISOString();
    const loansToReturn = activeLoans.filter((l) => selectedLoanIds.includes(l.id!));

    for (const l of loansToReturn) {
      // 1. Update loan record to DEVUELTO
      await db.toolLoans.update(l.id!, {
        returnDate: isoReturnDate,
        status: 'DEVUELTO',
        returnCondition,
        returnNotes: returnNotes.trim() || undefined,
        receivedBy: 'Mauricio Chamorro'
      });

      // 2. Update tool availability
      let newStatus: any = 'DISPONIBLE';
      if (returnCondition === 'DANADA') newStatus = 'DANADA';
      if (returnCondition === 'PERDIDA') newStatus = 'PERDIDA';

      await db.tools.update(l.toolId, {
        status: newStatus,
        updatedAt: isoReturnDate
      });

      // 3. Auto incident if damaged or lost
      if (returnCondition === 'DANADA' || returnCondition === 'PERDIDA' || returnCondition === 'INCOMPLETA') {
        await db.incidents.add({
          date: isoReturnDate.split('T')[0],
          type: returnCondition === 'PERDIDA' ? 'PERDIDA' : 'DANO',
          itemType: 'HERRAMIENTA',
          itemId: l.toolId,
          itemCode: l.toolCode,
          itemName: l.toolName,
          brand: l.toolBrand,
          quantity: 1,
          responsibleName: l.workerName,
          responsibleRut: l.workerRut,
          responsiblePhone: l.workerPhone,
          location: 'Devolución de Taller / Pañol',
          description: `Herramienta devuelta en estado: ${returnCondition}. Detalle: ${returnNotes || 'Sin notas adicionales'}`,
          estimatedCost: 0,
          resolutionStatus: 'ABIERTO',
          companyId: l.companyId,
          isWorkerAtFault: returnCondition === 'PERDIDA',
          faultType: returnCondition === 'PERDIDA' ? 'NEGLIGENCIA_TRABAJADOR' : 'DESGASTE_NATURAL',
          createdAt: isoReturnDate
        });
      }
    }

    notifyLocalMutation();
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm">
      <div className={`w-full max-w-xl rounded-2xl border ${themeClasses.border} ${themeClasses.card} p-5 shadow-2xl flex flex-col max-h-[94vh]`}>
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-700/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">Registrar Devolución de Herramientas</h3>
              <p className={`text-xs ${themeClasses.textMuted}`}>
                Seleccione las herramientas específicas a devolver (Devolución Parcial o Total)
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
          {/* Worker Filter & Quick Search */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Filtrar por Trabajador Receptor:
              </label>
              <select
                value={selectedWorker}
                onChange={(e) => {
                  setSelectedWorker(e.target.value);
                  setSelectedLoanIds([]);
                }}
                className={`w-full px-3 py-2 text-xs font-bold rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-slate-100`}
              >
                <option value="">-- Todos los Trabajadores con Préstamos ({workersWithActiveLoans.length}) --</option>
                {workersWithActiveLoans.map((name) => {
                  const count = activeLoans.filter((l) => l.workerName.trim() === name).length;
                  return (
                    <option key={name} value={name}>
                      👤 {name} ({count} herramientas)
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Buscar por Código o Nombre:
              </label>
              <div className="flex gap-1">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Ej: HER-001 / Taladro..."
                  className={`flex-1 px-3 py-2 text-xs font-mono rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg}`}
                />
                {onOpenScanner && (
                  <button
                    type="button"
                    onClick={onOpenScanner}
                    className="p-2 text-xs bg-orange-500/20 text-orange-400 rounded-xl border border-orange-500/30"
                    title="Escanear código de barras"
                  >
                    <ScanLine className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* List of Loans with Checkboxes */}
          <div className="p-3.5 rounded-xl border border-emerald-500/40 bg-emerald-500/5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                <Wrench className="w-4 h-4" />
                <span>Marque las herramientas que entrega en este acto:</span>
              </span>
              {currentWorkerLoans.length > 0 && (
                <button
                  type="button"
                  onClick={handleSelectAllWorkerLoans}
                  className="text-[11px] font-bold text-emerald-400 hover:underline"
                >
                  {selectedLoanIds.length === currentWorkerLoans.length ? 'Desmarcar Todas' : 'Marcar Todas'}
                </button>
              )}
            </div>

            {currentWorkerLoans.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-900/60 text-center text-xs text-slate-400">
                No hay préstamos activos que coincidan con la búsqueda o filtro.
              </div>
            ) : (
              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {currentWorkerLoans.map((l) => {
                  const isChecked = selectedLoanIds.includes(l.id!);
                  return (
                    <div
                      key={l.id}
                      onClick={() => toggleSelectLoan(l.id!)}
                      className={`p-2.5 rounded-xl border cursor-pointer flex items-center justify-between gap-2.5 transition ${
                        isChecked
                          ? 'bg-emerald-950/40 border-emerald-500 text-emerald-200'
                          : 'bg-slate-900/80 border-slate-700/80 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <button type="button" className="text-emerald-400 shrink-0">
                          {isChecked ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5 text-slate-500" />}
                        </button>
                        <div className="truncate">
                          <div className="font-bold text-xs truncate flex items-center gap-1.5">
                            <span>{l.toolName}</span>
                            <span className="font-mono text-orange-400 text-[10.5px]">({l.toolCode})</span>
                          </div>
                          <div className="text-[10.5px] text-slate-400">
                            A cargo de: <strong className="text-slate-200">{l.workerName}</strong> • Entregada: {new Date(l.deliveryDate).toLocaleDateString('es-CL')}
                          </div>
                        </div>
                      </div>
                      <span
                        className={`text-[9.5px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                          isChecked ? 'bg-emerald-500/30 text-emerald-300' : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {isChecked ? '✓ DEVOLVIENDO' : 'En Poder'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Partial Return Explanation Notice */}
            {selectedWorker && currentWorkerLoans.length > selectedLoanIds.length && selectedLoanIds.length > 0 && (
              <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-300">
                ⚠️ <strong>Devolución Parcial:</strong> Se devolverán {selectedLoanIds.length} herramienta(s). Las{' '}
                {currentWorkerLoans.length - selectedLoanIds.length} restantes continuarán activas bajo la responsabilidad de{' '}
                <strong>{selectedWorker}</strong>.
              </div>
            )}
          </div>

          {/* Return Date & Condition */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Fecha y Hora de Devolución Real *
              </label>
              <input
                type="datetime-local"
                required
                value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)}
                className={`w-full px-3 py-2 text-xs rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg}`}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Estado / Condición al Recibir *
              </label>
              <select
                value={returnCondition}
                onChange={(e) => setReturnCondition(e.target.value as any)}
                className={`w-full px-3 py-2 text-xs font-semibold rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg}`}
              >
                <option value="BUEN_ESTADO">✓ Buen Estado (Operativa y Completa)</option>
                <option value="DANADA">⚠ Con Daño o Falla (Requiere Mantención)</option>
                <option value="INCOMPLETA">⚠ Incompleta (Faltan accesorios/piezas)</option>
                <option value="PERDIDA">✖ Declarada Perdida / Extraviada</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Observaciones / Comentarios de Recepción
              </label>
              <input
                type="text"
                value={returnNotes}
                onChange={(e) => setReturnNotes(e.target.value)}
                placeholder="Ej: Se recibe limpia y probada / Faltan llaves de ajuste..."
                className={`w-full px-3 py-2 text-xs rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg}`}
              />
            </div>
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
              disabled={selectedLoanIds.length === 0}
              className={`flex items-center gap-1.5 px-6 py-2 text-xs font-bold rounded-xl transition ${
                selectedLoanIds.length > 0
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-500/20'
                  : 'bg-slate-700 text-slate-400 cursor-not-allowed'
              }`}
            >
              <Check className="w-4 h-4" />
              <span>Confirmar Devolución ({selectedLoanIds.length})</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
