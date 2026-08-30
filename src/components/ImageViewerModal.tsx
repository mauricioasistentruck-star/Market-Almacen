import { useBodyScrollLock } from '../utils/scrollLock';
import React from 'react';
import jsPDF from 'jspdf';
import { X, Download, FileText, Image as ImageIcon } from 'lucide-react';

interface ImageViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl?: string | null;
  title?: string;
  subtitle?: string;
}

export const ImageViewerModal: React.FC<ImageViewerModalProps> = ({
  isOpen,
  onClose,
  imageUrl,
  title = 'Fotografía del Ítem',
  subtitle
}) => {
  useBodyScrollLock(Boolean(isOpen));
  if (!isOpen || !imageUrl) return null;

  const handleDownloadImage = () => {
    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = `Documento_${title.replace(/[^a-zA-Z0-9]/g, '_')}.png`;
    a.click();
  };

  const handleDownloadPDF = () => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'letter'
    });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(234, 88, 12);
    doc.text(title, 14, 15);

    if (subtitle) {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(subtitle, 14, 20);
    }

    doc.setDrawColor(203, 213, 225);
    doc.line(14, 23, 202, 23);

    try {
      doc.addImage(imageUrl, 'JPEG', 14, 26, 188, 235, undefined, 'FAST');
    } catch {
      try {
        doc.addImage(imageUrl, 'PNG', 14, 26, 188, 235, undefined, 'FAST');
      } catch {
        // ignore
      }
    }

    doc.save(`Doc_${title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/90 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative max-w-4xl max-h-[90vh] w-full flex flex-col items-center bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="w-full px-5 py-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm sm:text-base text-slate-100">{title}</h3>
            {subtitle && <p className="text-xs text-slate-400 font-mono">{subtitle}</p>}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadPDF}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-orange-600/20 hover:bg-orange-600/30 text-orange-300 border border-orange-500/40 transition"
              title="Descargar como archivo PDF"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Guardar PDF</span>
            </button>
            <button
              onClick={handleDownloadImage}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
              title="Descargar imagen PNG"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Guardar Imagen</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
              title="Cerrar visor"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content (Image or Embedded PDF) */}
        <div className="p-4 sm:p-6 flex items-center justify-center overflow-auto w-full max-h-[78vh] min-h-[400px]">
          {imageUrl.startsWith('data:application/pdf') || imageUrl.endsWith('.pdf') ? (
            <div className="w-full h-[70vh] flex flex-col rounded-2xl overflow-hidden border border-slate-800 bg-slate-950">
              <iframe
                src={imageUrl}
                title={title}
                className="w-full h-full border-0 rounded-2xl"
              />
            </div>
          ) : (
            <img
              src={imageUrl}
              alt={title}
              className="max-h-[72vh] max-w-full rounded-2xl object-contain shadow-2xl border border-slate-800 bg-white"
            />
          )}
        </div>
      </div>
    </div>
  );
};
