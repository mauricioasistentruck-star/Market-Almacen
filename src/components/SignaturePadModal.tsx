import React, { useRef, useState, useEffect } from 'react';
import { useTheme } from '../utils/themeContext';
import { X, Check, RotateCcw, PenTool } from 'lucide-react';

interface SignaturePadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (signatureBase64: string) => void;
  title?: string;
  subtitle?: string;
}

export const SignaturePadModal: React.FC<SignaturePadModalProps> = ({
  isOpen,
  onClose,
  onSave,
  title = 'Firma Digital en Pantalla',
  subtitle = 'Firme con el dedo en su celular o con el ratón en PC'
}) => {
  const { themeClasses, theme } = useTheme();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        const canvas = canvasRef.current;
        if (canvas) {
          const rect = canvas.getBoundingClientRect();
          canvas.width = rect.width * 2;
          canvas.height = rect.height * 2;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.scale(2, 2);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, rect.width, rect.height);
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 2.5;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
          }
        }
      }, 100);
      setHasDrawn(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
    setHasDrawn(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, rect.width, rect.height);
    setHasDrawn(false);
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawn) return;
    const dataUrl = canvas.toDataURL('image/png');
    onSave(dataUrl);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className={`w-full max-w-lg rounded-2xl border ${themeClasses.border} ${themeClasses.card} p-5 shadow-2xl flex flex-col`}>
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-700/50">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-lg ${themeClasses.badge}`}>
              <PenTool className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">{title}</h3>
              <p className={`text-xs ${themeClasses.textMuted}`}>{subtitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Canvas area */}
        <div className="my-4">
          <div className="relative border-2 border-dashed border-slate-400 rounded-xl overflow-hidden bg-white shadow-inner">
            <canvas
              ref={canvasRef}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              className="w-full h-56 touch-none cursor-crosshair block"
            />
            {!hasDrawn && (
              <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center text-slate-400">
                <PenTool className="w-8 h-8 mb-1 stroke-1" />
                <span className="text-xs font-medium">Dibuje su firma aquí</span>
              </div>
            )}
          </div>
          <div className="flex justify-between items-center mt-2 px-1 text-xs text-slate-400">
            <span>Firma vinculante para control de bodega</span>
            <button
              onClick={clearCanvas}
              className="flex items-center gap-1 text-red-400 hover:text-red-300 font-medium py-1 px-2 rounded hover:bg-red-500/10 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Limpiar firma
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-700/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-xl border border-slate-600 hover:bg-slate-800 transition"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={!hasDrawn}
            className={`flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-xl transition ${
              hasDrawn
                ? `${themeClasses.accentBg} ${themeClasses.accentHover} shadow-lg shadow-orange-500/20`
                : 'bg-slate-700 text-slate-400 cursor-not-allowed'
            }`}
          >
            <Check className="w-4 h-4" />
            Guardar Firma
          </button>
        </div>
      </div>
    </div>
  );
};
