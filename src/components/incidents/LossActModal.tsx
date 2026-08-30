import { useBodyScrollLock } from '../../utils/scrollLock';
import React from 'react';
import type { Incident } from '../../types';
import { useTheme } from '../../utils/themeContext';
import { useCompany } from '../../utils/companyContext';
import { generateLossActPDF, downloadPDF, printPDF, shareViaWhatsApp } from '../../utils/pdfGenerator';
import { X, Download, Printer, MessageSquare, AlertTriangle, ShieldCheck } from 'lucide-react';

interface LossActModalProps {
  isOpen: boolean;
  onClose: () => void;
  incident: Incident | null;
  onSaved?: () => void;
}

export const LossActModal: React.FC<LossActModalProps> = ({ isOpen, onClose, incident }) => {
  useBodyScrollLock(Boolean(isOpen));
  const { themeClasses } = useTheme();
  const { companies } = useCompany();

  if (!isOpen || !incident) return null;

  const comp = companies.find(c => c.id === incident.companyId);
  const compName = comp?.name || 'MARKET ALMACÉN SpA';
  const compRut = comp?.rut || '77.542.190-8';

  const handleDownload = async () => {
    const doc = await generateLossActPDF(incident, comp);
    downloadPDF(doc, `Acta_Responsabilidad_${incident.itemCode}_${incident.responsibleName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
  };

  const handlePrint = async () => {
    const doc = await generateLossActPDF(incident, comp);
    printPDF(doc);
  };

  const handleWhatsApp = () => {
    const msg = `*ACTA DE RESPONSABILIDAD - MARKET ALMACÉN*\n*Evento:* ${incident.type === 'PERDIDA' ? 'PÉRDIDA / EXTRAVÍO' : 'DAÑO DE MATERIAL'}\n*Ítem:* ${incident.itemName} (Cód: ${incident.itemCode})\n*Trabajador Responsable:* ${incident.responsibleName} (${incident.responsibleRut})\n*Lugar:* ${incident.location}\n*Fecha:* ${new Date(incident.date).toLocaleDateString('es-CL')}\n*Detalle:* ${incident.description}\n\n_Documento oficial de constancia emitido para firma de responsabilidad._`;
    shareViaWhatsApp(incident.responsiblePhone || '', msg);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md">
      <div className={`w-full max-w-2xl rounded-2xl border ${themeClasses.border} ${themeClasses.card} p-5 shadow-2xl flex flex-col max-h-[94vh]`}>
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-700/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-red-500/10 text-red-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">Acta Oficial de Responsabilidad</h3>
              <p className={`text-xs ${themeClasses.textMuted}`}>Comprobante formal imprimible para firma del trabajador</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Printable Document Preview (Styled like official sheet) */}
        <div className="my-3 overflow-y-auto pr-1 flex-1">
          <div className="p-6 rounded-xl bg-white text-slate-900 border border-slate-300 shadow-inner space-y-4 text-xs font-sans">
            {/* Header Preview */}
            <div className="flex justify-between items-start border-b pb-3">
              <div className="flex items-center gap-3">
                <img src="/logo.png" alt="Logo" className="w-12 h-12 object-contain" />
                <div>
                  <h4 className="font-black text-sm text-orange-600 uppercase">{compName}</h4>
                  <p className="text-[10px] text-slate-600">RUT: {compRut} • Depto. Bodega y Operaciones</p>
                </div>
              </div>
              <div className="text-right">
                <span className="font-bold text-red-600 block text-xs">ACTA DE RESPONSABILIDAD</span>
                <span className="text-[10px] text-slate-500 font-mono">FECHA: {new Date(incident.date).toLocaleDateString('es-CL')}</span>
              </div>
            </div>

            {/* Title Bar */}
            <div className="bg-red-50 border border-red-200 p-2 rounded text-center">
              <span className="font-bold text-red-800 text-[11px] uppercase">
                DECLARACIÓN FORMAL POR {incident.type === 'PERDIDA' ? 'PÉRDIDA / EXTRAVÍO' : incident.type === 'DANO' ? 'DAÑO / ROTURA' : 'MERMA'}
              </span>
            </div>

            {/* Section 1: Worker */}
            <div className="border p-2.5 rounded bg-slate-50 space-y-1">
              <span className="font-bold text-slate-800 block text-[11px]">1. ANTECEDENTES DEL TRABAJADOR / RESPONSABLE:</span>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>Nombre: <strong>{incident.responsibleName}</strong></div>
                <div>RUT / DNI: <strong className="font-mono">{incident.responsibleRut}</strong></div>
                <div>Teléfono: <strong>{incident.responsiblePhone || 'N/A'}</strong></div>
                <div>Lugar del Hecho: <strong>{incident.location}</strong></div>
              </div>
            </div>

            {/* Section 2: Item */}
            <div className="border p-2.5 rounded bg-slate-50 space-y-1">
              <span className="font-bold text-slate-800 block text-[11px]">2. DETALLE DEL ÍTEM AFECTADO:</span>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>Código: <strong className="font-mono text-orange-700">{incident.itemCode}</strong></div>
                <div>Tipo: <strong>{incident.itemType}</strong></div>
                <div className="col-span-2">Descripción: <strong>{incident.itemName} {incident.brand ? `(${incident.brand})` : ''}</strong></div>
                <div>Cantidad: <strong>{incident.quantity}</strong></div>
                <div>Costo Reposición Aprox: <strong>${(incident.estimatedCost || 0).toLocaleString('es-CL')} CLP</strong></div>
              </div>
            </div>

            {/* Section 3: Circumstances */}
            <div className="space-y-1">
              <span className="font-bold text-slate-800 block text-[11px]">3. CIRCUNSTANCIAS Y DECLARACIÓN:</span>
              <p className="p-2 border rounded bg-slate-50 text-[10px] text-slate-700 leading-relaxed italic">
                "{incident.description || 'Sin descripción adicional informada.'}"
              </p>
            </div>

            {/* Commitment Note */}
            <div className="text-[9.5px] text-slate-500 italic text-justify pt-1">
              El trabajador individualizado declara bajo su responsabilidad la veracidad de los hechos señalados y asume el compromiso de custodia y normativas de cuidado de los equipos entregados por la empresa.
            </div>

            {/* Signature Boxes */}
            <div className="grid grid-cols-2 gap-8 pt-8 text-center text-[10px]">
              <div>
                <div className="border-t border-slate-700 pt-1 font-bold">Firma del Trabajador Responsable</div>
                <div className="text-slate-600">RUT: {incident.responsibleRut}</div>
                <div className="text-slate-500">{incident.responsibleName}</div>
              </div>

              <div>
                <div className="border-t border-slate-700 pt-1 font-bold">Firma Encargado de Bodega</div>
                <div className="text-slate-600">{compName}</div>
                <div className="text-slate-500">Recepción y Registro Conforme</div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap justify-between items-center gap-2 pt-3 border-t border-slate-700/50">
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 transition"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir Acta</span>
            </button>

            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-orange-600 hover:bg-orange-700 text-white transition shadow-sm"
            >
              <Download className="w-4 h-4" />
              <span>Descargar PDF</span>
            </button>

            <button
              onClick={handleWhatsApp}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 transition"
            >
              <MessageSquare className="w-4 h-4" />
              <span>WhatsApp</span>
            </button>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 text-xs rounded-xl border border-slate-600 hover:bg-slate-800 transition"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
