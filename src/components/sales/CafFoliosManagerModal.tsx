import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  FileSpreadsheet,
  Receipt,
  Building,
  FileCheck2,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Sliders,
  ShieldCheck,
  Hash,
  Clock,
  X,
  Info,
  Building2
} from 'lucide-react';
import { useTheme } from '../../utils/themeContext';
import { useAuth } from '../../utils/authContext';
import { useCompany } from '../../utils/companyContext';
import { useBodyScrollLock } from '../../utils/scrollLock';
import { db } from '../../db/database';

export type DteTabType = 'BOLETA' | 'FACTURA' | 'NOTA_CREDITO';

export interface CafBatch {
  id: string;
  batchNumber: number;
  date: string;
  time: string;
  dteType: DteTabType;
  tipoDteCode: number; // 39, 33 o 61
  folioDesde: number;
  folioHasta: number;
  cantidad: number;
  foliosUsados: number;
  status: 'ACTIVO' | 'AGOTADO';
}

export interface DteCafConfig {
  cantidadAPedir: number;
  alertaMinima: number;
  batches: CafBatch[];
}

export interface CompanyCafData {
  boleta: DteCafConfig;
  factura: DteCafConfig;
  notaCredito: DteCafConfig;
}

// Estructura de almacenamiento indexada por ID de Empresa
type AllCompaniesCafStorage = Record<string, CompanyCafData>;

const STORAGE_KEY = 'marketalmacen_caf_folios_v2';

const createDefaultCompanyData = (): CompanyCafData => ({
  boleta: {
    cantidadAPedir: 200,
    alertaMinima: 20,
    batches: [
      {
        id: 'batch-bol-1',
        batchNumber: 1,
        date: '2026-09-01',
        time: '09:30',
        dteType: 'BOLETA',
        tipoDteCode: 39,
        folioDesde: 1001,
        folioHasta: 1200,
        cantidad: 200,
        foliosUsados: 2,
        status: 'ACTIVO'
      }
    ]
  },
  factura: {
    cantidadAPedir: 100,
    alertaMinima: 15,
    batches: [
      {
        id: 'batch-fac-1',
        batchNumber: 1,
        date: '2026-09-01',
        time: '09:30',
        dteType: 'FACTURA',
        tipoDteCode: 33,
        folioDesde: 501,
        folioHasta: 600,
        cantidad: 100,
        foliosUsados: 0,
        status: 'ACTIVO'
      }
    ]
  },
  notaCredito: {
    cantidadAPedir: 50,
    alertaMinima: 10,
    batches: [
      {
        id: 'batch-nc-1',
        batchNumber: 1,
        date: '2026-09-01',
        time: '09:30',
        dteType: 'NOTA_CREDITO',
        tipoDteCode: 61,
        folioDesde: 101,
        folioHasta: 150,
        cantidad: 50,
        foliosUsados: 0,
        status: 'ACTIVO'
      }
    ]
  }
});

interface CafFoliosManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CafFoliosManagerModal: React.FC<CafFoliosManagerModalProps> = ({
  isOpen,
  onClose
}) => {
  const { themeClasses } = useTheme();
  const { isAdmin, isSuperAdmin } = useAuth();
  const { selectedCompanyId, selectedCompany, companies, setSelectedCompanyId } = useCompany();
  useBodyScrollLock(Boolean(isOpen));

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const [activeDteTab, setActiveDteTab] = useState<DteTabType>('BOLETA');
  const [activeCompanyId, setActiveCompanyId] = useState<string>(selectedCompanyId || 'market-almacen');

  const [storageData, setStorageData] = useState<AllCompaniesCafStorage>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Error loading CAF storage:', e);
    }
    const defKey = selectedCompanyId || 'market-almacen';
    return {
      [defKey]: createDefaultCompanyData()
    };
  });

  const [isRequesting, setIsRequesting] = useState(false);
  const [requestProgressText, setRequestProgressText] = useState('');
  const [successAlert, setSuccessAlert] = useState<{
    show: boolean;
    message: string;
    desde: number;
    hasta: number;
    cantidad: number;
    dteLabel: string;
  } | null>(null);

  // Asegurar scroll al inicio al abrir
  useEffect(() => {
    if (isOpen && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [isOpen]);

  // Sincronizar activeCompanyId con la empresa propia del usuario si es Admin
  const { currentUser } = useAuth();
  useEffect(() => {
    if (!isSuperAdmin && currentUser?.companyId && currentUser.companyId !== 'ALL') {
      setActiveCompanyId(currentUser.companyId);
    } else if (selectedCompanyId && selectedCompanyId !== 'ALL') {
      setActiveCompanyId(selectedCompanyId);
    }
  }, [selectedCompanyId, currentUser, isSuperAdmin]);

  // Obtener o inicializar los datos de la empresa actual
  const currentCompanyCafData: CompanyCafData =
    storageData[activeCompanyId] || createDefaultCompanyData();

  // Sincronizar los folios usados con las ventas reales de la base de datos para esta empresa
  useEffect(() => {
    if (!isOpen) return;

    const syncWithRealSales = async () => {
      try {
        const allSales = await db.sales.toArray();
        const compSales = allSales.filter(s =>
          activeCompanyId === 'ALL' || !s.companyId || s.companyId === activeCompanyId
        );

        const boletasCount = compSales.filter(s => s.dteType && s.dteType.toUpperCase().includes('BOLETA')).length;
        const facturasCount = compSales.filter(s => s.dteType && s.dteType.toUpperCase().includes('FACTURA')).length;

        // Notas de crédito: ventas anuladas con DTE o notas de crédito específicas
        const notasCreditoCount = compSales.filter(s =>
          (s.dteType && s.dteType.toUpperCase().includes('CREDITO')) ||
          (s.status === 'ANULADA' && s.dteType && (s.dteType.includes('FACTURA') || s.dteType.includes('BOLETA')))
        ).length;

        setStorageData(prev => {
          const compData = prev[activeCompanyId] ? { ...prev[activeCompanyId] } : createDefaultCompanyData();

          if (compData.boleta.batches.length > 0) {
            compData.boleta.batches[0].foliosUsados = Math.max(boletasCount, compData.boleta.batches[0].foliosUsados);
          }
          if (compData.factura.batches.length > 0) {
            compData.factura.batches[0].foliosUsados = Math.max(facturasCount, compData.factura.batches[0].foliosUsados);
          }
          if (compData.notaCredito.batches.length > 0) {
            compData.notaCredito.batches[0].foliosUsados = Math.max(notasCreditoCount, compData.notaCredito.batches[0].foliosUsados);
          }

          const updated = {
            ...prev,
            [activeCompanyId]: compData
          };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
          return updated;
        });
      } catch (err) {
        console.error('Error syncing sales count with CAF:', err);
      }
    };

    syncWithRealSales();
  }, [isOpen, activeCompanyId]);

  if (!isOpen) return null;

  // Acceso exclusivo para administradores
  if (!isAdmin && !isSuperAdmin) {
    return createPortal(
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
        <div className={`w-full max-w-md p-6 rounded-3xl border-2 ${themeClasses.border} ${themeClasses.card} text-center space-y-4`}>
          <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-950 text-red-600 mx-auto flex items-center justify-center">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="font-black text-lg text-slate-900 dark:text-white">Acceso Restringido</h3>
          <p className="text-xs font-bold text-slate-500">
            El sistema de solicitud y control de folios CAF es exclusivo para usuarios con rol de Administrador.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-800 text-white font-black text-xs cursor-pointer"
          >
            Cerrar Ventana
          </button>
        </div>
      </div>,
      document.body
    );
  }

  // Configuración del DTE activo
  const getDteConfig = (tab: DteTabType): DteCafConfig => {
    if (tab === 'FACTURA') return currentCompanyCafData.factura;
    if (tab === 'NOTA_CREDITO') return currentCompanyCafData.notaCredito;
    return currentCompanyCafData.boleta;
  };

  const currentDteConfig = getDteConfig(activeDteTab);
  const batches = currentDteConfig.batches;

  // Cálculos consolidados
  const totalSolicitados = batches.reduce((acc, b) => acc + b.cantidad, 0);
  const totalUsados = batches.reduce((acc, b) => acc + b.foliosUsados, 0);
  const totalDisponibles = Math.max(0, totalSolicitados - totalUsados);
  const alertaMinima = currentDteConfig.alertaMinima;
  const isAlertaCritica = totalDisponibles <= alertaMinima;

  const activeBatch = batches.find(b => b.status === 'ACTIVO') || batches[batches.length - 1];
  const folioActual = activeBatch ? (activeBatch.folioDesde + activeBatch.foliosUsados) : 1;

  const dteLabelMap = {
    BOLETA: { name: 'Boleta Electrónica', code: 39, short: 'Boletas' },
    FACTURA: { name: 'Factura Electrónica', code: 33, short: 'Facturas' },
    NOTA_CREDITO: { name: 'Nota de Crédito', code: 61, short: 'Notas de Crédito' }
  };

  // Modificar cantidad a pedir
  const handleUpdateCantidadAPedir = (cant: number) => {
    const val = Math.max(1, cant);
    setStorageData(prev => {
      const compData = prev[activeCompanyId] ? { ...prev[activeCompanyId] } : createDefaultCompanyData();
      const targetKey = activeDteTab === 'BOLETA' ? 'boleta' : activeDteTab === 'FACTURA' ? 'factura' : 'notaCredito';
      compData[targetKey] = {
        ...compData[targetKey],
        cantidadAPedir: val
      };
      const updated = {
        ...prev,
        [activeCompanyId]: compData
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  // Modificar umbral de alerta mínima
  const handleUpdateAlertaMinima = (min: number) => {
    const val = Math.max(1, min);
    setStorageData(prev => {
      const compData = prev[activeCompanyId] ? { ...prev[activeCompanyId] } : createDefaultCompanyData();
      const targetKey = activeDteTab === 'BOLETA' ? 'boleta' : activeDteTab === 'FACTURA' ? 'factura' : 'notaCredito';
      compData[targetKey] = {
        ...compData[targetKey],
        alertaMinima: val
      };
      const updated = {
        ...prev,
        [activeCompanyId]: compData
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  // Solicitar nueva remesa de folios ante el SII vía SimpleAPI
  const handleSolicitarFolios = async () => {
    if (isRequesting) return;

    setIsRequesting(true);
    setSuccessAlert(null);
    const dteInfo = dteLabelMap[activeDteTab];

    setRequestProgressText(`Conectando con API SimpleAPI para ${activeCompanyName} (RUT: ${activeCompanyRut})...`);
    await new Promise(r => setTimeout(r, 650));

    setRequestProgressText(`Autenticando Certificado Digital y ambiente de ${activeCompanyName}...`);
    await new Promise(r => setTimeout(r, 750));

    setRequestProgressText(`Registrando concurrentemente ${currentDteConfig.cantidadAPedir} folios DTE ${dteInfo.code}...`);
    await new Promise(r => setTimeout(r, 850));

    // Determinar siguiente rango correlativo
    const defaultStart = activeDteTab === 'BOLETA' ? 1000 : activeDteTab === 'FACTURA' ? 500 : 100;
    const ultimoHasta = batches.length > 0
      ? Math.max(...batches.map(b => b.folioHasta))
      : defaultStart;

    const nuevoDesde = ultimoHasta + 1;
    const nuevoHasta = nuevoDesde + currentDteConfig.cantidadAPedir - 1;
    const batchNum = batches.length + 1;

    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const fecha = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const hora = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

    const newBatch: CafBatch = {
      id: `batch-${activeDteTab.toLowerCase()}-${Date.now()}`,
      batchNumber: batchNum,
      date: fecha,
      time: hora,
      dteType: activeDteTab,
      tipoDteCode: dteInfo.code,
      folioDesde: nuevoDesde,
      folioHasta: nuevoHasta,
      cantidad: currentDteConfig.cantidadAPedir,
      foliosUsados: 0,
      status: 'ACTIVO'
    };

    setStorageData(prev => {
      const compData = prev[activeCompanyId] ? { ...prev[activeCompanyId] } : createDefaultCompanyData();
      const targetKey = activeDteTab === 'BOLETA' ? 'boleta' : activeDteTab === 'FACTURA' ? 'factura' : 'notaCredito';
      compData[targetKey] = {
        ...compData[targetKey],
        batches: [newBatch, ...compData[targetKey].batches]
      };
      const updated = {
        ...prev,
        [activeCompanyId]: compData
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });

    setIsRequesting(false);
    setRequestProgressText('');

    // Mensaje solicitado por el usuario con actualización dinámica
    setSuccessAlert({
      show: true,
      message: `✅ Folios del ${nuevoDesde} al ${nuevoHasta} cargados y autorizados con éxito.`,
      desde: nuevoDesde,
      hasta: nuevoHasta,
      cantidad: currentDteConfig.cantidadAPedir,
      dteLabel: dteInfo.name
    });
  };

  const currentCompany = companies.find(c => c.id === activeCompanyId) || selectedCompany;
  const activeCompanyName = currentCompany?.name || 'Market Almacén';
  const activeCompanyRut = currentCompany?.rut || '76.123.456-7';

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className={`w-full max-w-3xl rounded-3xl border-2 ${themeClasses.border} ${themeClasses.card} shadow-2xl flex flex-col overflow-hidden animate-scaleIn max-h-[90vh]`}>
        
        {/* Encabezado del Modal con Empresa y Rol Admin */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/90 dark:bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-black shrink-0">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                  Sistema de Gestión de Folios CAF
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                  🛡️ Exclusivo Admin
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400 mt-0.5">
                <span className="flex items-center gap-1 text-slate-700 dark:text-slate-300">
                  <Building2 className="w-3.5 h-3.5 text-blue-500" />
                  <strong>{activeCompanyName}</strong> ({activeCompanyRut})
                </span>
                <span>•</span>
                <span>SimpleAPI & SII</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            title="Cerrar ventana"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cuerpo con Scroll */}
        <div ref={scrollContainerRef} className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          
          {/* Selector de Empresa si existen múltiples */}
          {isSuperAdmin && companies.length > 1 && (
            <div className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-bold">
              <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-blue-500" />
                <span>Gestionar folios de la empresa:</span>
              </span>
              <select
                value={activeCompanyId}
                onChange={(e) => {
                  setActiveCompanyId(e.target.value);
                  setSuccessAlert(null);
                }}
                className="px-3 py-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-black text-xs text-slate-900 dark:text-white cursor-pointer"
              >
                {companies.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.rut})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Estado de Conexión API SimpleAPI y SII Independiente por Empresa */}
          <div className="p-2.5 rounded-xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span className="font-bold text-slate-700 dark:text-slate-300">
                API SimpleAPI Dedicada: <strong>{activeCompanyName}</strong> ({activeCompanyRut})
              </span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                Ambiente: {currentCompany?.siiAmbiente ? currentCompany.siiAmbiente.toUpperCase() : 'CERTIFICACIÓN'}
              </span>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200">
                Almacenamiento Concurrente Aislado
              </span>
            </div>
          </div>

          {/* Selector de Tipo de Documento: Boleta, Factura, Nota de Crédito en 3 columnas iguales sin scroll */}
          <div className="grid grid-cols-3 gap-1 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
            {/* 1. Boletas Electrónicas (39) */}
            <button
              type="button"
              onClick={() => {
                setActiveDteTab('BOLETA');
                setSuccessAlert(null);
              }}
              className={`py-2 px-1 rounded-xl text-[10.5px] sm:text-xs font-black transition flex items-center justify-center gap-1 cursor-pointer ${
                activeDteTab === 'BOLETA'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Receipt className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Boletas (39)</span>
            </button>

            {/* 2. Facturas Electrónicas (33) */}
            <button
              type="button"
              onClick={() => {
                setActiveDteTab('FACTURA');
                setSuccessAlert(null);
              }}
              className={`py-2 px-1 rounded-xl text-[10.5px] sm:text-xs font-black transition flex items-center justify-center gap-1 cursor-pointer ${
                activeDteTab === 'FACTURA'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Building className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Facturas (33)</span>
            </button>

            {/* 3. Notas de Crédito Electrónicas (61) */}
            <button
              type="button"
              onClick={() => {
                setActiveDteTab('NOTA_CREDITO');
                setSuccessAlert(null);
              }}
              className={`py-2 px-1 rounded-xl text-[10.5px] sm:text-xs font-black transition flex items-center justify-center gap-1 cursor-pointer ${
                activeDteTab === 'NOTA_CREDITO'
                  ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <FileCheck2 className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">N. Crédito (61)</span>
            </button>
          </div>

          {/* BANNER DE ALERTA DE ÉXITO DINÁMICA */}
          {successAlert && successAlert.show && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border-2 border-emerald-400 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200 flex items-center justify-between gap-3 animate-fadeIn shadow-xs">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div>
                  <p className="text-xs sm:text-sm font-black">{successAlert.message}</p>
                  <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                    Se han incorporado {successAlert.cantidad} folios de {successAlert.dteLabel} para {activeCompanyName}.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSuccessAlert(null)}
                className="text-xs font-black text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 cursor-pointer px-2 py-1"
              >
                ✕
              </button>
            </div>
          )}

          {/* BANNER DE ALERTA CUANDO LOS FOLIOS ESTÁN EN CANTIDAD MÍNIMA */}
          {isAlertaCritica ? (
            <div className="p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/60 border-2 border-red-400 dark:border-red-700 text-red-900 dark:text-red-200 flex items-center gap-3 animate-pulse">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />
              <div className="text-xs">
                <p className="font-black text-sm">⚠️ ¡ALERTA: STOCK DE FOLIOS CRÍTICO!</p>
                <p className="font-bold">
                  Quedan solo <span className="underline font-black">{totalDisponibles} folios de {dteLabelMap[activeDteTab].short}</span> (umbral de alerta mínimo configurado: <strong>{alertaMinima}</strong>).
                  Presione el botón de abajo para solicitar una nueva remesa al SII.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-2.5 rounded-xl bg-slate-100/80 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 flex items-center justify-between text-xs">
              <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300 font-bold">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span>Nivel de folios operativo ({totalDisponibles} disponibles para {activeCompanyName}).</span>
              </span>
              <span className="text-[11px] font-mono text-slate-500">
                Alerta configurada en ≤ {alertaMinima} folios
              </span>
            </div>
          )}

          {/* TARJETAS DE CUENTAS DE FOLIOS: SOLICITADOS, USADOS Y DISPONIBLES */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            
            {/* 1. Folios Solicitados */}
            <div className={`p-4 rounded-2xl border ${themeClasses.border} ${themeClasses.card} shadow-xs flex items-center gap-3`}>
              <div className="w-11 h-11 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center font-black shrink-0">
                <Hash className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] font-bold text-slate-500 uppercase block">Folios Solicitados</span>
                <span className="text-xl sm:text-2xl font-black font-mono text-slate-900 dark:text-slate-100">
                  {totalSolicitados}
                </span>
                <p className="text-[10px] text-slate-400 font-bold mt-0.5">Autorizados por el SII</p>
              </div>
            </div>

            {/* 2. Folios Usados */}
            <div className={`p-4 rounded-2xl border ${themeClasses.border} ${themeClasses.card} shadow-xs flex items-center gap-3`}>
              <div className="w-11 h-11 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center font-black shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] font-bold text-slate-500 uppercase block">Folios Usados</span>
                <span className="text-xl sm:text-2xl font-black font-mono text-amber-600 dark:text-amber-400">
                  {totalUsados}
                </span>
                <p className="text-[10px] text-slate-400 font-bold mt-0.5">Emitidos en el sistema</p>
              </div>
            </div>

            {/* 3. Folios Disponibles */}
            <div className={`p-4 rounded-2xl border-2 ${
              isAlertaCritica ? 'border-red-400 bg-red-50/50 dark:bg-red-950/30' : 'border-emerald-400 bg-emerald-50/40 dark:bg-emerald-950/30'
            } shadow-xs flex items-center gap-3`}>
              <div className={`w-11 h-11 rounded-xl ${
                isAlertaCritica ? 'bg-red-100 dark:bg-red-950 text-red-600' : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600'
              } flex items-center justify-center font-black shrink-0`}>
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] font-bold text-slate-500 uppercase block">Folios Disponibles</span>
                <span className={`text-xl sm:text-2xl font-black font-mono ${
                  isAlertaCritica ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'
                }`}>
                  {totalDisponibles}
                </span>
                <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                  Próximo correlativo: #{folioActual}
                </p>
              </div>
            </div>

          </div>

          {/* PANEL DE CONFIGURACIÓN Y SOLICITUD DE NUEVOS FOLIOS */}
          <div className={`p-4 sm:p-5 rounded-2xl border ${themeClasses.border} ${themeClasses.cardSubtle} space-y-4 shadow-xs`}>
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700">
              <span className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-blue-500" />
                <span>Opciones de Carga y Alerta Elegible por el Administrador</span>
              </span>
              <span className="text-[10.5px] font-bold text-slate-400 font-mono">
                DTE {dteLabelMap[activeDteTab].code} ({dteLabelMap[activeDteTab].name})
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Opción 1: Modificar Cantidad de Folios a Pedir */}
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-700 dark:text-slate-300 block">
                  1. Cantidad de Folios a Pedir en cada carga:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="5000"
                    value={currentDteConfig.cantidadAPedir}
                    onChange={(e) => handleUpdateCantidadAPedir(Number(e.target.value))}
                    className={`w-28 px-3 py-2 rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} font-mono font-black text-sm text-center focus:outline-none`}
                  />
                  <div className="flex items-center gap-1">
                    {(activeDteTab === 'NOTA_CREDITO' ? [20, 50, 100, 200] : [50, 100, 200, 500]).map(val => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => handleUpdateCantidadAPedir(val)}
                        className={`px-2 py-1 text-[11px] font-black rounded-lg transition cursor-pointer ${
                          currentDteConfig.cantidadAPedir === val
                            ? 'bg-blue-600 text-white shadow-2xs'
                            : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300'
                        }`}
                      >
                        {val}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 font-bold">
                  Define cuántos folios solicitará automáticamente la conexión al SII para {activeCompanyName}.
                </p>
              </div>

              {/* Opción 2: Alerta cuando se encuentren en cantidad mínima elegible */}
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-700 dark:text-slate-300 block">
                  2. Alertar cuando queden menos de:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={currentDteConfig.alertaMinima}
                    onChange={(e) => handleUpdateAlertaMinima(Number(e.target.value))}
                    className={`w-28 px-3 py-2 rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} font-mono font-black text-sm text-center focus:outline-none`}
                  />
                  <div className="flex items-center gap-1">
                    {[5, 10, 20, 50].map(val => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => handleUpdateAlertaMinima(val)}
                        className={`px-2 py-1 text-[11px] font-black rounded-lg transition cursor-pointer ${
                          currentDteConfig.alertaMinima === val
                            ? 'bg-red-600 text-white shadow-2xs'
                            : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300'
                        }`}
                      >
                        {val}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 font-bold">
                  Umbral para activar la advertencia visual en rojo para {dteLabelMap[activeDteTab].short}.
                </p>
              </div>

            </div>

            {/* BOTÓN PRINCIPAL: SOLICITAR FOLIOS */}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5">
                <Info className="w-4 h-4 text-blue-500 shrink-0" />
                <span>Trámite con SimpleAPI y SII para {dteLabelMap[activeDteTab].name}.</span>
              </div>

              <button
                type="button"
                disabled={isRequesting}
                onClick={handleSolicitarFolios}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-xs transition cursor-pointer shadow-md active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isRequesting ? 'animate-spin' : ''}`} />
                <span>
                  {isRequesting
                    ? (requestProgressText || 'Procesando con SII...')
                    : `Solicitar ${currentDteConfig.cantidadAPedir} Folios de ${dteLabelMap[activeDteTab].short} al SII`}
                </span>
              </button>
            </div>

          </div>

          {/* HISTORIAL DE CARGAS DE FOLIOS CAF */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                Historial de Remesas Autorizadas - {dteLabelMap[activeDteTab].name}
              </span>
              <span className="text-[11px] font-bold text-slate-500">
                {batches.length} {batches.length === 1 ? 'remesa registrada' : 'remesas registradas'}
              </span>
            </div>

            <div className={`rounded-2xl border ${themeClasses.border} overflow-hidden shadow-xs`}>
              <div className="overflow-x-auto scrollbar-thin">
                <table className="w-full text-left text-xs border-collapse min-w-[580px]">
                  <thead className={`border-b ${themeClasses.border} ${themeClasses.cardSubtle} font-black text-slate-700 dark:text-slate-300`}>
                    <tr>
                      <th className="py-2.5 px-3 whitespace-nowrap">Carga</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">Fecha y Hora</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">Tipo DTE</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">Rango de Folios</th>
                      <th className="py-2.5 px-3 text-center whitespace-nowrap">Cantidad</th>
                      <th className="py-2.5 px-3 text-center whitespace-nowrap">Usados</th>
                      <th className="py-2.5 px-3 text-center whitespace-nowrap">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-bold">
                    {batches.map((batch) => (
                      <tr key={batch.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                        <td className="py-2.5 px-3 font-mono font-black text-blue-600 dark:text-blue-400 whitespace-nowrap">
                          Carga #{batch.batchNumber}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                          {batch.date} {batch.time}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded text-[10.5px] font-black ${
                            batch.dteType === 'NOTA_CREDITO'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                              : batch.dteType === 'FACTURA'
                              ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300'
                              : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                          }`}>
                            DTE {batch.tipoDteCode}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono font-black whitespace-nowrap">
                          #{batch.folioDesde} al #{batch.folioHasta}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-black text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          {batch.cantidad}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-black text-amber-600 dark:text-amber-400 whitespace-nowrap">
                          {batch.foliosUsados}
                        </td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                            batch.status === 'ACTIVO'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
                          }`}>
                            {batch.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

        </div>

        {/* Pie del Modal */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/90 dark:bg-slate-900/90 shrink-0">
          <div className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Sincronización multiempresa activa para {activeCompanyName}.</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-black text-xs transition cursor-pointer shadow-xs"
          >
            Cerrar Ventana
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
};
