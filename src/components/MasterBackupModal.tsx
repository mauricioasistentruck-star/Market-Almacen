import { useBodyScrollLock } from '../utils/scrollLock';
import React, { useState, useEffect, useRef } from 'react';
import { db } from '../db/database';
import { useCompany } from '../utils/companyContext';
import { useAuth } from '../utils/authContext';
import { useTheme } from '../utils/themeContext';
import { exportProductsInventoryExcel } from '../utils/excelExporter';
import { triggerCloudSync } from '../utils/cloudSync';
import {
  X,
  Download,
  Upload,
  HardDrive,
  FileSpreadsheet,
  Trash2,
  AlertTriangle,
  Building2,
  Boxes,
  CheckCircle2,
  Receipt,
  ShoppingCart,
  Users,
  Layers,
  FileText
} from 'lucide-react';

interface MasterBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefresh?: () => void;
  onOpenImport?: () => void;
}

export const MasterBackupModal: React.FC<MasterBackupModalProps> = ({
  isOpen,
  onClose,
  onRefresh,
  onOpenImport
}) => {
  useBodyScrollLock(Boolean(isOpen));
  const { theme, themeClasses } = useTheme();
  const { selectedCompanyId, selectedCompany } = useCompany();
  const { isSuperAdmin } = useAuth();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [productCount, setProductCount] = useState(0);
  const [salesCount, setSalesCount] = useState(0);
  const [guidesCount, setGuidesCount] = useState(0);
  const [mermasCount, setMermasCount] = useState(0);

  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isExportingTotal, setIsExportingTotal] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  const [confirmClearType, setConfirmClearType] = useState<'products' | null>(null);
  const [isClearing, setIsClearing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadCounts();
      setImportStatus(null);
    }
  }, [isOpen, selectedCompanyId]);

  const loadCounts = async () => {
    if (selectedCompanyId === 'ALL') {
      const pCount = await db.products.count();
      const sCount = await db.sales.count();
      const recCount = await db.receptionGuides.count();
      const delCount = await db.deliveryGuides.count();
      const mCount = await db.incidents.count();
      setProductCount(pCount);
      setSalesCount(sCount);
      setGuidesCount(recCount + delCount);
      setMermasCount(mCount);
    } else {
      const pCount = await db.products.where('companyId').equals(selectedCompanyId).count();
      const sCount = await db.sales.where('companyId').equals(selectedCompanyId).count();
      const recCount = await db.receptionGuides.where('companyId').equals(selectedCompanyId).count();
      const delCount = await db.deliveryGuides.where('companyId').equals(selectedCompanyId).count();
      const mCount = await db.incidents.where('companyId').equals(selectedCompanyId).count();
      setProductCount(pCount);
      setSalesCount(sCount);
      setGuidesCount(recCount + delCount);
      setMermasCount(mCount);
    }
  };

  if (!isOpen) return null;

  const currentCompanyName = selectedCompany?.name || (selectedCompanyId === 'ALL' ? 'Todas las Empresas (Global)' : 'Market Almacén');

  // 1. Exportar Catálogo de Productos a Excel
  const handleExportProducts = async () => {
    try {
      setIsExportingExcel(true);
      const prods = selectedCompanyId === 'ALL'
        ? await db.products.toArray()
        : await db.products.where('companyId').equals(selectedCompanyId).toArray();
      await exportProductsInventoryExcel(prods, currentCompanyName);
    } catch (err: any) {
      alert('Error al exportar productos a Excel: ' + err.message);
    } finally {
      setIsExportingExcel(false);
    }
  };

  // 2. Respaldo Total Maestro del Sistema (Exportar Todo)
  const handleExportFullBackup = async () => {
    try {
      setIsExportingTotal(true);
      const [
        products,
        sales,
        receptionGuides,
        deliveryGuides,
        cashClosings,
        siiConfigs,
        purchaseRequests,
        incidents,
        productMovements,
        companies,
        users,
        workers
      ] = await Promise.all([
        db.products.toArray(),
        db.sales.toArray(),
        db.receptionGuides.toArray(),
        db.deliveryGuides.toArray(),
        db.cashClosings.toArray(),
        db.siiConfigs.toArray(),
        db.purchaseRequests.toArray(),
        db.incidents.toArray(),
        db.productMovements.toArray(),
        db.companies.toArray(),
        db.users.toArray(),
        db.workers.toArray()
      ]);

      const backupData = {
        metadata: {
          system: 'Market Almacén SpA',
          version: '2.0.0',
          type: 'FULL_MASTER_BACKUP',
          exportedAt: new Date().toISOString(),
          companyId: selectedCompanyId,
          companyName: currentCompanyName
        },
        data: {
          products,
          sales,
          receptionGuides,
          deliveryGuides,
          cashClosings,
          siiConfigs,
          purchaseRequests,
          incidents,
          productMovements,
          companies,
          users,
          workers
        }
      };

      const jsonStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `Market_Almacen_Respaldo_Total_${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert('Error al generar respaldo total: ' + err.message);
    } finally {
      setIsExportingTotal(false);
    }
  };

  // 3. Restaurar / Importar Respaldo Total al Sistema
  const handleRestoreFullBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm('¿Está seguro de restaurar este respaldo? La información importada se sincronizará e integrará en la base de datos.')) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    try {
      setIsImporting(true);
      setImportStatus('Leyendo archivo de respaldo...');

      const text = await file.text();
      const parsed = JSON.parse(text);
      const d = parsed.data || parsed;

      await db.transaction('rw', [
        db.products,
        db.sales,
        db.receptionGuides,
        db.deliveryGuides,
        db.cashClosings,
        db.siiConfigs,
        db.purchaseRequests,
        db.incidents,
        db.productMovements,
        db.companies,
        db.users,
        db.workers
      ], async () => {
        if (Array.isArray(d.products) && d.products.length > 0) {
          await db.products.bulkPut(d.products);
        }
        if (Array.isArray(d.sales) && d.sales.length > 0) {
          await db.sales.bulkPut(d.sales);
        }
        if (Array.isArray(d.receptionGuides) && d.receptionGuides.length > 0) {
          await db.receptionGuides.bulkPut(d.receptionGuides);
        }
        if (Array.isArray(d.deliveryGuides) && d.deliveryGuides.length > 0) {
          await db.deliveryGuides.bulkPut(d.deliveryGuides);
        }
        if (Array.isArray(d.cashClosings) && d.cashClosings.length > 0) {
          await db.cashClosings.bulkPut(d.cashClosings);
        }
        if (Array.isArray(d.siiConfigs) && d.siiConfigs.length > 0) {
          await db.siiConfigs.bulkPut(d.siiConfigs);
        }
        if (Array.isArray(d.purchaseRequests) && d.purchaseRequests.length > 0) {
          await db.purchaseRequests.bulkPut(d.purchaseRequests);
        }
        if (Array.isArray(d.incidents) && d.incidents.length > 0) {
          await db.incidents.bulkPut(d.incidents);
        }
        if (Array.isArray(d.productMovements) && d.productMovements.length > 0) {
          await db.productMovements.bulkPut(d.productMovements);
        }
        if (Array.isArray(d.companies) && d.companies.length > 0) {
          await db.companies.bulkPut(d.companies);
        }
        if (Array.isArray(d.users) && d.users.length > 0) {
          await db.users.bulkPut(d.users);
        }
        if (Array.isArray(d.workers) && d.workers.length > 0) {
          await db.workers.bulkPut(d.workers);
        }
      });

      triggerCloudSync();
      await loadCounts();
      if (onRefresh) onRefresh();

      const counts = [
        d.products?.length ? `${d.products.length} productos` : '',
        d.sales?.length ? `${d.sales.length} ventas/boletas/facturas` : '',
        d.deliveryGuides?.length ? `${d.deliveryGuides.length} guías despacho` : '',
        d.receptionGuides?.length ? `${d.receptionGuides.length} guías recepción` : '',
        d.incidents?.length ? `${d.incidents.length} mermas` : '',
        d.users?.length ? `${d.users.length} usuarios` : ''
      ].filter(Boolean).join(', ');

      setImportStatus(`¡Restauración exitosa! Se importaron: ${counts || 'registros'}.`);
      alert(`✅ Respaldo restaurado correctamente en Market Almacén.\n\nDatos importados: ${counts}`);
    } catch (err: any) {
      alert('Error al restaurar respaldo: ' + err.message);
      setImportStatus('Error al restaurar archivo: ' + err.message);
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // 4. Vaciar Bodega de Productos
  const executeClearProducts = async () => {
    try {
      setIsClearing(true);
      if (selectedCompanyId === 'ALL') {
        await db.products.clear();
      } else {
        const prods = await db.products.where('companyId').equals(selectedCompanyId).toArray();
        const ids = prods.map(p => p.id).filter(Boolean) as number[];
        await db.products.bulkDelete(ids);
      }
      triggerCloudSync();
      await loadCounts();
      if (onRefresh) onRefresh();
      setConfirmClearType(null);
      alert(`✅ Se han eliminado todos los productos de ${currentCompanyName}.`);
    } catch (err: any) {
      alert('Error al vaciar productos: ' + err.message);
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className={`w-full max-w-3xl max-h-[92vh] rounded-3xl border ${themeClasses.border} ${themeClasses.card} shadow-2xl flex flex-col justify-between overflow-hidden animate-scaleIn`}>
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-md ${themeClasses.accentBg}`}>
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100">
                Centro de Respaldo y Restauración
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Exportación completa, importación de base de datos y control de existencias
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

        {/* Content Scrollable */}
        <div className="p-5 space-y-4 overflow-y-auto pr-2 flex-1">
          {importStatus && (
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{importStatus}</span>
            </div>
          )}

          {/* 1. SECCIÓN: RESPALDO TOTAL MAESTRO (EXCLUSIVO SUPERADMIN) */}
          {isSuperAdmin && (

          <div className={`p-4 sm:p-5 rounded-2xl border ${themeClasses.border} ${themeClasses.cardSubtle} space-y-4 shadow-sm`}>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-600 text-white shadow">
                  <HardDrive className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-black text-sm text-slate-900 dark:text-slate-100">
                    Respaldo Total Maestro del Sistema
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Incluye toda la información: Productos ({productCount}), Ventas/Facturas ({salesCount}), Guías ({guidesCount}), Mermas ({mermasCount}), Personal y Usuarios.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {/* Botón Exportar Respaldo Total */}
              <button
                type="button"
                onClick={handleExportFullBackup}
                disabled={isExportingTotal}
                className={`p-3.5 rounded-2xl border ${themeClasses.border} ${themeClasses.card} hover:shadow-md transition flex items-center justify-between gap-3 text-left group`}
              >
                <div className="space-y-0.5">
                  <span className="text-xs font-black text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                    <Download className="w-4 h-4" />
                    <span>Exportar Respaldo Completo</span>
                  </span>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    Descargar archivo .JSON con todos los datos
                  </p>
                </div>
                <div className={`p-2 rounded-xl text-white ${themeClasses.accentBg} shadow-sm group-hover:scale-105 transition`}>
                  <Download className="w-4 h-4" />
                </div>
              </button>

              {/* Botón Importar / Restaurar Respaldo Total */}
              <div className="relative">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".json"
                  onChange={handleRestoreFullBackup}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isImporting}
                  className={`w-full h-full p-3.5 rounded-2xl border border-purple-500/30 bg-purple-500/5 hover:bg-purple-500/10 hover:shadow-md transition flex items-center justify-between gap-3 text-left group`}
                >
                  <div className="space-y-0.5">
                    <span className="text-xs font-black text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
                      <Upload className="w-4 h-4" />
                      <span>{isImporting ? 'Restaurando...' : 'Restaurar / Importar Respaldo'}</span>
                    </span>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400">
                      Cargar archivo .JSON para restaurar el sistema
                    </p>
                  </div>
                  <div className="p-2 rounded-xl bg-purple-600 text-white shadow-sm group-hover:scale-105 transition">
                    <Upload className="w-4 h-4" />
                  </div>
                </button>
              </div>
            </div>
 
          </div>
          )}

          {/* 2. SECCIÓN: EXPORTACIÓN E IMPORTACIÓN MASIVA DE CATÁLOGO (MISMA LÍNEA) */}
          <div className={`p-4 sm:p-5 rounded-2xl border ${themeClasses.border} ${themeClasses.cardSubtle} space-y-3 shadow-sm`}>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h4 className="font-black text-xs text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>Gestión de Catálogo de Productos ({currentCompanyName})</span>
              </h4>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                Capacidad: Hasta 30.000 Productos
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Botón 1: Importar Catálogo Masivo Excel / CSV */}
              <button
                type="button"
                onClick={() => {
                  if (onOpenImport) {
                    onClose();
                    onOpenImport();
                  }
                }}
                className={`p-3.5 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 hover:shadow-md transition flex items-center justify-between gap-3 text-left group`}
              >
                <div className="space-y-0.5">
                  <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <Upload className="w-4 h-4" />
                    <span>Importar Catálogo Masivo</span>
                  </span>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    Cargar archivo Excel (.xlsx) o CSV con hasta 30.000 productos
                  </p>
                </div>
                <div className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm group-hover:scale-105 transition shrink-0">
                  <Upload className="w-4 h-4" />
                </div>
              </button>

              {/* Botón 2: Exportar Catálogo a Excel */}
              <button
                type="button"
                onClick={handleExportProducts}
                disabled={isExportingExcel}
                className={`p-3.5 rounded-2xl border ${themeClasses.border} ${themeClasses.card} hover:shadow-md transition flex items-center justify-between gap-3 text-left group`}
              >
                <div className="space-y-0.5">
                  <span className="text-xs font-black text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                    <Boxes className="w-4 h-4" />
                    <span>Exportar Catálogo a Excel</span>
                  </span>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    Descargar lista completa ({productCount} ítems) en formato XLSX
                  </p>
                </div>
                <div className={`p-2 rounded-xl text-white ${themeClasses.accentBg} shadow-sm group-hover:scale-105 transition shrink-0`}>
                  <Download className="w-4 h-4" />
                </div>
              </button>
            </div>
          </div>

          {/* 3. SECCIÓN: VACIADO MASIVO DE BODEGA POR EMPRESA (EXCLUSIVO SUPERADMIN) */}
          {isSuperAdmin && (
            <div className="p-4 sm:p-5 rounded-2xl border border-red-500/30 bg-red-500/5 space-y-3 shadow-sm">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  <span className="font-black text-xs text-red-600 dark:text-red-400">
                    Zona de Vaciado de Catálogo de Productos
                  </span>
                </div>
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
                  Aplica a: {currentCompanyName}
                </span>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-400">
                Elimina de forma permanente el catálogo de productos cargado para la empresa actual (<strong>{currentCompanyName}</strong>).
              </p>

              <button
                type="button"
                onClick={() => setConfirmClearType('products')}
                className="w-full p-3.5 rounded-2xl border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 transition flex items-center justify-between gap-3 text-left group"
              >
                <div className="space-y-0.5">
                  <span className="text-xs font-black text-red-600 dark:text-red-400 flex items-center gap-1.5">
                    <Boxes className="w-4 h-4" />
                    <span>Vaciar Bodega de Productos</span>
                  </span>
                  <p className="text-[11px] text-red-500/80">
                    Borrar los {productCount} productos de {currentCompanyName}
                  </p>
                </div>
                <div className="p-2 rounded-xl bg-red-600 text-white shadow-sm group-hover:scale-105 transition">
                  <Trash2 className="w-4 h-4" />
                </div>
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition shadow-sm"
          >
            Cerrar
          </button>
        </div>
      </div>

      {/* Modal Confirmación Vaciado */}
      {confirmClearType && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
          <div className={`w-full max-w-md rounded-3xl border border-red-500/40 ${themeClasses.card} p-6 shadow-2xl space-y-4`}>
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-red-500/20 text-red-500 border border-red-500/30">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
                  ¿Vaciar Bodega de Productos?
                </h3>
                <p className="text-xs text-red-500 font-bold uppercase tracking-wider">Confirmación Requerida</p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-xs text-slate-700 dark:text-slate-300 space-y-2">
              <p>
                ¿Está seguro de eliminar <strong>TODOS</strong> los productos ({productCount} ítems) de la empresa:
              </p>
              <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-center font-black text-sm text-red-600 dark:text-red-400">
                {currentCompanyName}
              </div>
              <p className="text-[11px] text-slate-500">
                ⚠️ Esta acción es definitiva. No se restaurarán automáticamente al reiniciar.
              </p>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmClearType(null)}
                disabled={isClearing}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={executeClearProducts}
                disabled={isClearing}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-black transition flex items-center justify-center gap-1.5 shadow-lg shadow-red-600/30"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isClearing ? 'Borrando...' : 'Sí, Vaciar'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
