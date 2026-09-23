import React, { useState, useEffect } from 'react';
import { useTheme } from '../../utils/themeContext';
import { useCompany } from '../../utils/companyContext';
import { db } from '../../db/database';
import type { SiiConfig } from '../../types';
import {
  getThermalPrinterConfig,
  saveThermalPrinterConfig,
  printTestThermalTicket80mm,
  type ThermalPrinterConfig
} from '../../utils/thermalPrinter';
import {
  Printer,
  X,
  CheckCircle2,
  Settings2,
  Zap,
  HelpCircle,
  Scissors,
  Check
} from 'lucide-react';

interface ThermalPrinterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ThermalPrinterModal: React.FC<ThermalPrinterModalProps> = ({
  isOpen,
  onClose
}) => {
  const { themeClasses } = useTheme();
  const { selectedCompany, selectedCompanyId } = useCompany();
  const [config, setConfig] = useState<ThermalPrinterConfig>(getThermalPrinterConfig());
  const [siiConfig, setSiiConfig] = useState<SiiConfig | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setConfig(getThermalPrinterConfig());
      const loadConfig = async () => {
        const c = await db.siiConfigs.where('companyId').equals(selectedCompanyId).first();
        if (c) setSiiConfig(c);
      };
      loadConfig();
    }
  }, [isOpen, selectedCompanyId]);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveThermalPrinterConfig(config);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 1200);
  };

  const handleTestPrint = () => {
    printTestThermalTicket80mm(selectedCompany, siiConfig || undefined);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-3xl shadow-2xl overflow-hidden animate-scaleIn">
        
        {/* Encabezado */}
        <div className="px-5 py-3.5 bg-gradient-to-r from-[#0c1b2b] via-[#162f4d] to-[#0c1b2b] text-white flex items-center justify-between border-b border-slate-700">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-white leading-tight">
                Impresora de Boletas Térmica (80mm)
              </h3>
              <p className="text-[11px] text-slate-300 font-medium">
                Configuración de impresión directa y automática sin ventanas
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Contenido */}
        <form onSubmit={handleSave} className="p-4 sm:p-5 space-y-4 text-xs">
          
          {/* Banner de Estado */}
          <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-black text-emerald-900 dark:text-emerald-200 text-xs sm:text-sm block">
                Impresión Automática Silenciosa Activa
              </span>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
                Al confirmar una venta en caja, el sistema envía el ticket de 80mm de forma directa a la impresora sin abrir ventanas ni pestañas adicionales.
              </p>
            </div>
          </div>

          {/* Opciones de la Impresora */}
          <div className="space-y-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80">
            
            {/* Nombre de la Impresora */}
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Nombre / Alias de la Impresora:
              </label>
              <input
                type="text"
                value={config.printerName}
                onChange={(e) => setConfig({ ...config, printerName: e.target.value })}
                placeholder="Ej: Impresora Térmica 80mm (POS)"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold"
              />
            </div>

            {/* Ancho de Rollo */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setConfig({ ...config, paperWidth: '80mm' })}
                className={`p-2.5 rounded-xl border-2 font-black text-xs transition cursor-pointer text-center ${
                  config.paperWidth === '80mm'
                    ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-100 shadow-xs'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                Rollo 80 mm (Recomendado POS)
              </button>

              <button
                type="button"
                onClick={() => setConfig({ ...config, paperWidth: '58mm' })}
                className={`p-2.5 rounded-xl border-2 font-black text-xs transition cursor-pointer text-center ${
                  config.paperWidth === '58mm'
                    ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-100 shadow-xs'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                Rollo 58 mm (Mini POS)
              </button>
            </div>

            {/* Switches / Checkboxes */}
            <div className="space-y-2 pt-1">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={config.autoPrintOnSale}
                  onChange={(e) => setConfig({ ...config, autoPrintOnSale: e.target.checked })}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  Imprimir ticket de forma automática al presionar "Cobrar"
                </span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={config.autoCut}
                  onChange={(e) => setConfig({ ...config, autoCut: e.target.checked })}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
                <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Scissors className="w-3.5 h-3.5 text-slate-500" />
                  <span>Corte de papel automático al finalizar el ticket</span>
                </span>
              </label>
            </div>
          </div>

          {/* Botón de Prueba */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900">
            <div>
              <span className="font-bold text-blue-950 dark:text-blue-200 block text-xs">
                ¿Deseas probar la impresora?
              </span>
              <span className="text-[11px] text-blue-700 dark:text-blue-300">
                Envía un ticket de prueba directamente en 80mm
              </span>
            </div>
            <button
              type="button"
              onClick={handleTestPrint}
              className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-black text-xs transition cursor-pointer shadow-xs flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Ticket de Prueba</span>
            </button>
          </div>

          {/* Consejos de Instalación */}
          <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-400 space-y-1">
            <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
              <HelpCircle className="w-3.5 h-3.5 text-blue-500" />
              <span>¿Cómo funciona con tu impresora física?</span>
            </span>
            <p>
              1. En Windows, ve a <strong>Configuración &gt; Impresoras y Escáneres</strong> y deja tu impresora de 80mm como la <strong>Impresora Predeterminada</strong>.
            </p>
            <p>
              2. El sistema mandará la orden automáticamente sin abrir ventanas nuevas de navegador.
            </p>
          </div>

          {/* Mensaje de Guardado */}
          {savedSuccess && (
            <div className="p-2 rounded-xl bg-emerald-500 text-white font-bold text-center flex items-center justify-center gap-1.5 animate-fadeIn">
              <Check className="w-4 h-4" />
              <span>¡Configuración de impresora guardada con éxito!</span>
            </div>
          )}

          {/* Botones de Pie */}
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold transition cursor-pointer"
            >
              Cerrar
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black transition cursor-pointer shadow-md"
            >
              Guardar Configuración
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
