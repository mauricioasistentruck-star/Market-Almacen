import React, { useState, useEffect } from 'react';
import type { ToolLoan } from '../../types';
import { useTheme } from '../../utils/themeContext';
import { useCompany } from '../../utils/companyContext';
import { db } from '../../db/database';
import { exportPendingLoansExcel } from '../../utils/excelExporter';
import { shareViaWhatsApp } from '../../utils/pdfGenerator';
import {
  Clock,
  User,
  Phone,
  FileSpreadsheet,
  RotateCcw,
  MessageSquare,
  AlertCircle,
  Wrench,
  Calendar
} from 'lucide-react';

interface PendingLoansViewProps {
  loans?: ToolLoan[];
  onOpenReturn: (loan?: ToolLoan) => void;
  onRefresh?: () => void;
  refreshTrigger?: number;
}

export const PendingLoansView: React.FC<PendingLoansViewProps> = ({
  loans: initialLoans,
  onOpenReturn,
  onRefresh,
  refreshTrigger
}) => {
  const { themeClasses } = useTheme();
  const { selectedCompany, selectedCompanyId } = useCompany();

  const [activeLoans, setActiveLoans] = useState<ToolLoan[]>([]);

  useEffect(() => {
    loadPendingLoans();
  }, [initialLoans, refreshTrigger, selectedCompanyId]);

  const loadPendingLoans = async () => {
    if (initialLoans) {
      const filtered = initialLoans.filter(l => l.status === 'ACTIVO' || l.status === 'ATRASADO');
      setActiveLoans(filtered);
    } else {
      let list = await db.toolLoans.where('status').equals('ACTIVO').toArray();
      if (selectedCompanyId !== 'ALL') {
        list = list.filter(l => l.companyId === selectedCompanyId);
      }
      setActiveLoans(list);
    }
  };

  const now = new Date().getTime();

  const handleExportExcel = () => {
    const compName = selectedCompanyId === 'ALL' ? 'Todas_las_Empresas' : selectedCompany?.name || 'Bodega';
    exportPendingLoansExcel(activeLoans, compName);
  };

  const handleWhatsAppReminder = (loan: ToolLoan) => {
    const deliveryDateStr = new Date(loan.deliveryDate).toLocaleDateString('es-CL');
    const msg = `Hola ${loan.workerName}, le saludamos de Market Almacén. Le recordamos que mantiene en su poder la herramienta *${loan.toolName}* (Código: *${loan.toolCode}*) entregada el día *${deliveryDateStr}*. Por favor acérquese a bodega para su devolución o renovación. ¡Muchas gracias!`;
    shareViaWhatsApp(loan.workerPhone || '', msg);
  };

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className={`p-4 rounded-2xl border ${themeClasses.border} ${themeClasses.card} flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-sm`}>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-extrabold text-base sm:text-lg text-slate-100">
              Herramientas Pendientes de Devolución
            </h3>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
              {activeLoans.length} activas
            </span>
          </div>
          <p className={`text-xs ${themeClasses.textMuted}`}>
            Control en tiempo real de herramientas actualmente en poder del personal
          </p>
        </div>

        <button
          onClick={handleExportExcel}
          disabled={activeLoans.length === 0}
          className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-700 bg-slate-800/60 hover:bg-slate-800 text-emerald-400 disabled:opacity-40 transition"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Exportar Pendientes a Excel</span>
        </button>
      </div>

      {/* Grid of Pending Loans Cards */}
      {activeLoans.length === 0 ? (
        <div className={`p-12 rounded-2xl border ${themeClasses.border} ${themeClasses.card} text-center space-y-2`}>
          <Wrench className="w-12 h-12 text-slate-600 mx-auto" />
          <h4 className="font-bold text-base text-slate-300">No hay herramientas pendientes</h4>
          <p className="text-xs text-slate-500">Todas las herramientas prestadas han sido devueltas a pañol conforme.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {activeLoans.map((loan) => {
            const deliveryMs = new Date(loan.deliveryDate).getTime();
            const daysOut = Math.floor((now - deliveryMs) / (1000 * 3600 * 24));
            const isProlonged = daysOut >= 3;

            return (
              <div
                key={loan.id}
                className={`p-4 rounded-2xl border transition flex flex-col justify-between ${
                  isProlonged
                    ? 'border-amber-500/50 bg-amber-500/5 shadow-md shadow-amber-500/5'
                    : `${themeClasses.border} ${themeClasses.card}`
                }`}
              >
                <div className="space-y-2.5">
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-mono text-xs font-bold text-orange-400 block">{loan.toolCode}</span>
                      <h4 className="font-bold text-sm text-slate-100 leading-snug">{loan.toolName}</h4>
                      {loan.toolBrand && <span className="text-[11px] text-slate-400 font-medium">{loan.toolBrand}</span>}
                    </div>

                    <div className="text-right shrink-0">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black animate-pulse ${
                          isProlonged
                            ? 'bg-red-500/20 text-red-300 border border-red-500/50 shadow-sm'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-sm'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${isProlonged ? 'bg-red-400' : 'bg-amber-400'} animate-ping`} />
                        <span>{daysOut === 0 ? 'Prestada Hoy' : `${daysOut}d en préstamo`}</span>
                      </span>
                    </div>
                  </div>

                  {/* Worker Details */}
                  <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1 text-xs">
                    <div className="flex items-center gap-1.5 text-slate-200 font-semibold">
                      <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{loan.workerName}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono pl-5">RUT: {loan.workerRut}</div>
                    {loan.workerRole && <div className="text-[11px] text-slate-400 pl-5">Cargo: {loan.workerRole}</div>}
                    {loan.workerPhone && (
                      <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 pl-5 pt-0.5">
                        <Phone className="w-3 h-3" />
                        <span>{loan.workerPhone}</span>
                      </div>
                    )}
                  </div>

                  {/* Dates */}
                  <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-800/80">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-500" />
                      <span>Entrega: {new Date(loan.deliveryDate).toLocaleDateString('es-CL')}</span>
                    </span>
                    <span>Estado: {loan.deliveryCondition}</span>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="flex items-center justify-between gap-2 pt-3 mt-3 border-t border-slate-800/80">
                  {loan.workerPhone ? (
                    <button
                      onClick={() => handleWhatsAppReminder(loan)}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 transition"
                      title="Enviar recordatorio de devolución por WhatsApp"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>WhatsApp</span>
                    </button>
                  ) : (
                    <span />
                  )}

                  <button
                    onClick={() => onOpenReturn(loan)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-orange-600 hover:bg-orange-700 text-white shadow-sm transition active:scale-95"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Recibir Devolución</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
