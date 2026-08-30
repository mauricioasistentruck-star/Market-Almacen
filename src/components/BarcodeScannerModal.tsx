import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { useTheme } from '../utils/themeContext';
import { X, ScanLine, Flashlight, Keyboard, AlertCircle } from 'lucide-react';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
  title?: string;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onScan,
  title = 'Lector de Código de Barras / QR'
}) => {
  const { themeClasses } = useTheme();
  const [manualCode, setManualCode] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerId = 'barcode-reader-viewport';

  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    let active = true;

    if (isOpen) {
      setErrorMessage(null);
      setManualCode('');

      setTimeout(async () => {
        if (!active) return;
        try {
          const html5QrCode = new Html5Qrcode(containerId);
          scannerRef.current = html5QrCode;

          const config = {
            fps: 15,
            qrbox: { width: 260, height: 160 },
            aspectRatio: 1.0
          };

          await html5QrCode.start(
            { facingMode: 'environment' },
            config,
            (decodedText) => {
              playBeep();
              onScan(decodedText.trim());
              onClose();
            },
            () => {
              // ignore frame parse failures
            }
          );
          setIsScanning(true);
        } catch (err: any) {
          console.warn('Camera start error:', err);
          setErrorMessage('No se pudo acceder a la cámara o no tiene permisos activados. Puede ingresar el código manualmente abajo.');
          setIsScanning(false);
        }
      }, 200);
    }

    return () => {
      active = false;
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current
          .stop()
          .then(() => scannerRef.current?.clear())
          .catch(() => {});
      }
    };
  }, [isOpen]);

  const toggleTorch = async () => {
    if (!scannerRef.current || !isScanning) return;
    try {
      await (scannerRef.current as any).applyVideoConstraints({
        advanced: [{ torch: !torchOn }]
      });
      setTorchOn(!torchOn);
    } catch {
      // torch not supported on this device
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      playBeep();
      onScan(manualCode.trim());
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className={`w-full max-w-md rounded-3xl border ${themeClasses.border} ${themeClasses.card} p-5 sm:p-6 shadow-2xl flex flex-col animate-scaleIn`}>
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-md ${themeClasses.accentBg}`}>
              <ScanLine className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-base leading-tight text-slate-900 dark:text-slate-100">{title}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Apunte la cámara al código de barra o QR</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewport */}
        <div className="my-4 relative">
          <div
            id={containerId}
            className="w-full h-64 rounded-2xl overflow-hidden bg-black flex items-center justify-center border border-slate-700 relative shadow-inner"
          />

          {errorMessage && (
            <div className="absolute inset-0 bg-slate-950/95 rounded-2xl p-4 flex flex-col items-center justify-center text-center">
              <AlertCircle className="w-8 h-8 text-amber-400 mb-2" />
              <p className="text-xs text-slate-200 font-bold mb-2">{errorMessage}</p>
              <span className="text-[11px] text-slate-400">Use el teclado para ingresar el código abajo</span>
            </div>
          )}

          {isScanning && (
            <div className="absolute top-2.5 right-2.5 flex gap-1 z-10">
              <button
                type="button"
                onClick={toggleTorch}
                className={`p-2.5 rounded-xl text-xs font-bold backdrop-blur-md transition shadow-md ${
                  torchOn ? 'bg-amber-500 text-slate-950' : 'bg-black/60 text-white hover:bg-black/80'
                }`}
                title="Linterna / Flash"
              >
                <Flashlight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Manual Input Fallback */}
        <form onSubmit={handleManualSubmit} className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
          <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <Keyboard className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>O ingrese código manual / pistola USB:</span>
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Ej: 7801234567890 o PROD-001..."
              className={`flex-1 px-3.5 py-2.5 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-850 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500`}
              autoFocus
            />
            <button
              type="submit"
              disabled={!manualCode.trim()}
              className={`px-5 py-2.5 text-xs font-black rounded-xl transition active:scale-95 shadow-sm ${
                manualCode.trim()
                  ? `${themeClasses.accentBg} text-white shadow-md hover:opacity-90`
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-500 border border-slate-300 dark:border-slate-700 cursor-not-allowed'
              }`}
            >
              Aplicar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
