import { useBodyScrollLock } from '../../utils/scrollLock';
import React, { useState, useEffect } from 'react';
import type { SiiConfig } from '../../types';
import { db } from '../../db/database';
import { useCompany } from '../../utils/companyContext';
import { useTheme } from '../../utils/themeContext';
import { triggerCloudSync } from '../../utils/cloudSync';
import {
  X,
  Building2,
  CheckCircle2,
  ShieldCheck,
  Zap,
  Hash,
  FileCheck2,
  Save,
  Globe
} from 'lucide-react';

interface SiiConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export const SiiConfigModal: React.FC<SiiConfigModalProps> = ({
  isOpen,
  onClose,
  onSaved
}) => {
  useBodyScrollLock(Boolean(isOpen));
  const { themeClasses } = useTheme();
  const { selectedCompanyId, selectedCompany, companies } = useCompany();

  const [config, setConfig] = useState<SiiConfig>({
    companyId: 'market-almacen',
    environment: 'CERTIFICACION',
    rutEmisor: '77.890.120-5',
    razonSocial: 'MARKET ALMACÉN SpA',
    giro: 'Comercio, Almacén y Distribución General',
    acteco: '453000',
    direccionOrigen: 'Av. Principal 1000, Bodega Central',
    comunaOrigen: 'Santiago',
    ciudadOrigen: 'Santiago',
    resolucionNumero: '80',
    resolucionFecha: '2014-08-22',
    nextBoletaFolio: 1,
    nextFacturaFolio: 1,
    nextExentaFolio: 1,
        isAutoSendEnabled: true, updatedAt: new Date().toISOString()
  });

  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadConfig();
      setIsSaved(false);
    }
  }, [isOpen, selectedCompanyId]);

  const loadConfig = async () => {
    const targetCompId = selectedCompanyId && selectedCompanyId !== 'ALL' ? selectedCompanyId : 'market-almacen';
    const existing = await db.siiConfigs.where('companyId').equals(targetCompId).first();
    const currentComp = companies.find(c => c.id === targetCompId) || selectedCompany;

    if (existing) {
      setConfig(existing);
    } else {
      setConfig({
        companyId: targetCompId,
        environment: 'CERTIFICACION',
        rutEmisor: currentComp?.rut || '77.890.120-5',
        razonSocial: currentComp?.name || 'MARKET ALMACÉN SpA',
        giro: currentComp?.industry || 'Comercio, Almacén y Distribución General',
        acteco: '453000',
        direccionOrigen: currentComp?.address || 'Av. Principal 1000, Bodega Central',
        comunaOrigen: 'Santiago',
        ciudadOrigen: 'Santiago',
        resolucionNumero: '80',
        resolucionFecha: '2014-08-22',
        nextBoletaFolio: 1,
        nextFacturaFolio: 1,
        nextExentaFolio: 1,
                isAutoSendEnabled: true, updatedAt: new Date().toISOString()
      });
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const targetCompId = selectedCompanyId && selectedCompanyId !== 'ALL' ? selectedCompanyId : 'market-almacen';
      const existing = await db.siiConfigs.where('companyId').equals(targetCompId).first();
      
      if (existing && existing.id) {
        await db.siiConfigs.update(existing.id, {
          ...config,
          companyId: targetCompId,
          updatedAt: new Date().toISOString()
        });
      } else {
        await db.siiConfigs.add({
          ...config,
          companyId: targetCompId,
          
        });
      }

      setIsSaved(true);
      triggerCloudSync();
      if (onSaved) onSaved();

      setTimeout(() => {
        onClose();
      }, 900);
    } catch (err: any) {
      alert('Error al guardar configuración SII: ' + err.message);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className={`w-full max-w-2xl max-h-[92vh] rounded-3xl border ${themeClasses.border} ${themeClasses.card} shadow-2xl flex flex-col justify-between overflow-hidden animate-scaleIn`}>
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-md ${themeClasses.accentBg}`}>
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100">
                  Configuración DTE y Conexión SII
                </h3>
                <span className="px-2 py-0.5 rounded-md bg-red-500/10 text-red-600 dark:text-red-400 font-black text-[10px] border border-red-500/20">
                  Chile
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Parámetros de facturación electrónica, folios y timbraje reglamentario
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body Scrollable */}
        <form onSubmit={handleSave} className="p-4 sm:p-6 space-y-4 overflow-y-auto pr-2 flex-1">
          
          {/* Selector de Ambiente de Operación SII */}
          <div className={`p-4 rounded-2xl border ${themeClasses.border} ${themeClasses.cardSubtle} space-y-2.5 shadow-sm`}>
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <label className="text-xs font-black text-slate-900 dark:text-slate-100">
                Ambiente de Operación SII
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setConfig({ ...config, environment: 'CERTIFICACION' })}
                className={`p-3 rounded-xl border text-xs font-black transition flex items-center justify-center gap-2 shadow-sm ${
                  config.environment === 'CERTIFICACION'
                    ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-md scale-[1.02]'
                    : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                <Zap className="w-4 h-4 text-amber-950 dark:text-amber-400" />
                <span>Certificación / Pruebas</span>
              </button>

              <button
                type="button"
                onClick={() => setConfig({ ...config, environment: 'PRODUCCION' })}
                className={`p-3 rounded-xl border text-xs font-black transition flex items-center justify-center gap-2 shadow-sm ${
                  config.environment === 'PRODUCCION'
                    ? 'bg-emerald-600 text-white border-emerald-700 shadow-md scale-[1.02]'
                    : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Producción Real (SII)</span>
              </button>
            </div>
          </div>

          {/* 1. Datos de la Empresa Emisora */}
          <div className={`p-4 rounded-2xl border ${themeClasses.border} ${themeClasses.cardSubtle} space-y-3 shadow-sm`}>
            <h4 className="text-xs font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>1. DATOS DE LA EMPRESA EMISORA</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  RUT Emisor *
                </label>
                <input
                  type="text"
                  value={config.rutEmisor}
                  onChange={(e) => setConfig({ ...config, rutEmisor: e.target.value })}
                  className={`w-full px-3 py-2 rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-slate-900 dark:text-slate-100 font-mono font-bold text-xs`}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Razón Social *
                </label>
                <input
                  type="text"
                  value={config.razonSocial}
                  onChange={(e) => setConfig({ ...config, razonSocial: e.target.value })}
                  className={`w-full px-3 py-2 rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-slate-900 dark:text-slate-100 font-bold text-xs`}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Giro Comercial *
                </label>
                <input
                  type="text"
                  value={config.giro}
                  onChange={(e) => setConfig({ ...config, giro: e.target.value })}
                  className={`w-full px-3 py-2 rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-slate-900 dark:text-slate-100 font-bold text-xs`}
                  placeholder="Giro registrado en el SII"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Cód. ACTECO
                </label>
                <input
                  type="text"
                  value={config.acteco || ''}
                  onChange={(e) => setConfig({ ...config, acteco: e.target.value })}
                  className={`w-full px-3 py-2 rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-slate-900 dark:text-slate-100 font-mono font-bold text-xs`}
                  placeholder="Ej: 453000"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Dirección Matriz
                </label>
                <input
                  type="text"
                  value={config.direccionOrigen}
                  onChange={(e) => setConfig({ ...config, direccionOrigen: e.target.value })}
                  className={`w-full px-3 py-2 rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-slate-900 dark:text-slate-100 font-bold text-xs`}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Comuna
                </label>
                <input
                  type="text"
                  value={config.comunaOrigen}
                  onChange={(e) => setConfig({ ...config, comunaOrigen: e.target.value })}
                  className={`w-full px-3 py-2 rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-slate-900 dark:text-slate-100 font-bold text-xs`}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Ciudad
                </label>
                <input
                  type="text"
                  value={config.ciudadOrigen}
                  onChange={(e) => setConfig({ ...config, ciudadOrigen: e.target.value })}
                  className={`w-full px-3 py-2 rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-slate-900 dark:text-slate-100 font-bold text-xs`}
                />
              </div>
            </div>
          </div>

          {/* 2. Correlativos y Folios DTE */}
          <div className={`p-4 rounded-2xl border ${themeClasses.border} ${themeClasses.cardSubtle} space-y-3 shadow-sm`}>
            <h4 className="text-xs font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Hash className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>2. CORRELATIVOS Y FOLIOS DTE</span>
            </h4>

            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 space-y-1 shadow-sm">
                <label className="block text-[11px] font-black text-slate-800 dark:text-slate-200">
                  Próx. Boleta N°
                </label>
                <input
                  type="number"
                  min="1"
                  value={config.nextBoletaFolio}
                  onChange={(e) => setConfig({ ...config, nextBoletaFolio: parseInt(e.target.value) || 1 })}
                  className="w-full px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-blue-600 dark:text-blue-400 font-mono font-black text-base text-center"
                />
              </div>

              <div className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 space-y-1 shadow-sm">
                <label className="block text-[11px] font-black text-slate-800 dark:text-slate-200">
                  Próx. Factura N°
                </label>
                <input
                  type="number"
                  min="1"
                  value={config.nextFacturaFolio}
                  onChange={(e) => setConfig({ ...config, nextFacturaFolio: parseInt(e.target.value) || 1 })}
                  className="w-full px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-blue-600 dark:text-blue-400 font-mono font-black text-base text-center"
                />
              </div>

              <div className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 space-y-1 shadow-sm">
                <label className="block text-[11px] font-black text-slate-800 dark:text-slate-200">
                  Próx. Exenta N°
                </label>
                <input
                  type="number"
                  min="1"
                  value={config.nextExentaFolio}
                  onChange={(e) => setConfig({ ...config, nextExentaFolio: parseInt(e.target.value) || 1 })}
                  className="w-full px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-blue-600 dark:text-blue-400 font-mono font-black text-base text-center"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  N° Resolución SII
                </label>
                <input
                  type="text"
                  value={config.resolucionNumero}
                  onChange={(e) => setConfig({ ...config, resolucionNumero: e.target.value })}
                  className={`w-full px-3 py-2 rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-slate-900 dark:text-slate-100 font-mono font-bold text-xs`}
                  placeholder="Ej: 80"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Fecha Resolución
                </label>
                <input
                  type="date"
                  value={config.resolucionFecha}
                  onChange={(e) => setConfig({ ...config, resolucionFecha: e.target.value })}
                  className={`w-full px-3 py-2 rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-slate-900 dark:text-slate-100 font-bold text-xs`}
                />
              </div>
            </div>
          </div>

          {/* Timbre Electrónico DTE (TED) */}
          <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-600 text-white shadow-sm">
                <FileCheck2 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-black text-emerald-800 dark:text-emerald-300">
                  Timbre Electrónico DTE (TED) Activo
                </p>
                <p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                  Genera código de barras bidimensional reglamentario PDF417 para Boletas y Facturas
                </p>
              </div>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-black shadow-sm">
              HABILITADO
            </span>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-xs font-bold border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaved}
              className={`px-6 py-2.5 rounded-xl text-xs font-black text-white shadow-md flex items-center gap-2 transition active:scale-95 ${
                isSaved ? 'bg-emerald-600' : 'bg-blue-600 hover:bg-blue-500'
              }`}
            >
              {isSaved ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-white" />
                  <span>¡Guardado Exitosamente!</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Guardar Configuración</span>
                </>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
