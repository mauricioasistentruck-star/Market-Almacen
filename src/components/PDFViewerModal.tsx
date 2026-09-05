import React from 'react';
import jsPDF from 'jspdf';
import { useTheme } from '../utils/themeContext';
import { downloadPDF, printPDF, sharePDFDocument } from '../utils/pdfGenerator';
import {
  X,
  Download,
  Printer,
  FileText,
  ExternalLink,
  Share2
} from 'lucide-react';

interface PDFViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  doc: jsPDF | null;
  filename: string;
  title?: string;
  subtitle?: string;
  recipientPhone?: string;
  previewNode?: React.ReactNode;
}

export const PDFViewerModal: React.FC<PDFViewerModalProps> = ({
  isOpen,
  onClose,
  doc,
  filename,
  title = 'Documento PDF Oficial',
  subtitle,
  recipientPhone,
  previewNode
}) => {
  const { themeClasses } = useTheme();

  if (!isOpen || !doc) return null;

  const pdfBlob = doc.output('blob');
  const blobUrl = URL.createObjectURL(pdfBlob);

  const handleOpenInNewTab = () => {
    window.open(blobUrl, '_blank');
  };

  const handleDownload = () => {
    downloadPDF(doc, filename);
  };

  const handlePrint = () => {
    printPDF(doc, filename);
  };

  const handleShare = async () => {
    await sharePDFDocument({
      doc,
      filename,
      recipientPhone,
      title,
      messageText: `Adjunto documento oficial ${title} emitido por Market Almacén.`
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-5xl h-[92vh] rounded-3xl border ${themeClasses.border} ${themeClasses.card} shadow-2xl flex flex-col overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >
                {/* Header Bar Aclarada, Nítida & Moderna */}
        <div className="px-3 sm:px-5 py-3 bg-white dark:bg-slate-900 border-b border-slate-300 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0 shadow-sm">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/30 shrink-0 shadow-sm">
              <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-black text-sm sm:text-base text-slate-950 dark:text-white truncate tracking-tight">
                {title}
              </h3>
              {subtitle && (
                <p className="text-xs text-slate-600 dark:text-slate-300 font-semibold truncate">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          {/* Action Buttons Claros y Nítidos */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-bold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 transition shadow-sm active:scale-95"
              title="Imprimir documento"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Imprimir</span>
            </button>

            <button
              onClick={handleShare}
              className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 text-xs font-black rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-700 shadow-sm transition active:scale-95"
              title="Compartir por WhatsApp"
            >
              <Share2 className="w-4 h-4" />
              <span>WhatsApp</span>
            </button>

            <button
              onClick={handleDownload}
              className="flex items-center gap-1 px-3 sm:px-3.5 py-1.5 text-xs font-black rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 border border-blue-700 transition active:scale-95"
              title="Descargar archivo PDF"
            >
              <Download className="w-4 h-4" />
              <span>PDF</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white border border-slate-300 dark:border-slate-700 transition ml-0.5 sm:ml-1"
              title="Cerrar visor"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Document Reader / Content */}
        <div className="flex-1 bg-slate-200 dark:bg-slate-950 w-full h-full p-2 sm:p-4 overflow-y-auto flex flex-col items-center">
          {previewNode ? (
            <div className="w-full max-w-4xl py-1">
              {previewNode}
            </div>
          ) : (
            typeof window !== 'undefined' && typeof (window as any).Capacitor?.isNativePlatform === 'function' && (window as any).Capacitor.isNativePlatform() ? (
              <div className="w-full max-w-lg my-auto rounded-3xl border border-slate-800 bg-slate-950 p-6 flex flex-col items-center justify-center text-center space-y-5">
                <div className="p-4 rounded-3xl bg-orange-500/15 text-orange-400 border border-orange-500/30">
                  <FileText className="w-12 h-12" />
                </div>
                <div className="space-y-1 max-w-sm">
                  <h4 className="font-extrabold text-base text-slate-100">{title}</h4>
                  <p className="text-xs text-slate-400 font-mono truncate">{filename}</p>
                  <p className="text-xs text-orange-400 font-semibold pt-1">
                    Documento oficial emitido por Market Almacén
                  </p>
                </div>

                <div className="w-full max-w-xs space-y-2.5">
                  <button
                    onClick={handleDownload}
                    className={`w-full flex items-center justify-center gap-2 py-3 px-4 text-xs font-black rounded-2xl ${themeClasses.accentBg} ${themeClasses.accentHover} shadow-lg shadow-orange-500/25 transition active:scale-95`}
                  >
                    <Download className="w-4 h-4" />
                    <span>📱 Abrir / Guardar Documento PDF</span>
                  </button>

                  <button
                    onClick={handleShare}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 text-xs font-bold rounded-2xl bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 transition active:scale-95"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>Compartir por WhatsApp / Enviar</span>
                  </button>
                </div>
              </div>
            ) : (
              <iframe
                src={`${blobUrl}#toolbar=1&navpanes=0`}
                title={title}
                className="w-full h-full min-h-[70vh] rounded-2xl border border-slate-800 shadow-inner bg-white"
              />
            )
          )}
        </div>
      </div>
    </div>
  );
};
