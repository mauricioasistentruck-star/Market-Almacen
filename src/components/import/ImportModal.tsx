import { useBodyScrollLock } from '../../utils/scrollLock';
import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import type { Product, Tool, ItemCondition, ItemCompleteness } from '../../types';
import { useTheme } from '../../utils/themeContext';
import { useCompany } from '../../utils/companyContext';
import { db } from '../../db/database';
import { triggerCloudSync, notifyLocalMutation, pushAllToCloud } from '../../utils/cloudSync';
import { generateProductBarcode, getNextToolCode } from '../../utils/barcodeGenerator';
import { getDefaultImageForCategory } from '../../utils/imageFetcher';
import { generateMassiveDataset } from '../../db/seedData';
import {
  X,
  Upload,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  Boxes,
  Wrench,
  HelpCircle,
  Database,
  ArrowRight,
  Download,
  Info,
  Building2
} from 'lucide-react';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

interface ParsedRow {
  index: number;
  code: string;
  name: string;
  category: string;
  brand?: string;
  mannFilterCode?: string;
  companyId?: string;
  location: string;
  stock: number;
  minStock: number;
  unit: string;
  price?: number;
  condition: ItemCondition;
  completeness: ItemCompleteness;
  conditionNotes?: string;
  model?: string; // For tools
  isSpecialLiquidUnit?: boolean; // Balde, tambor, litros, kilos
  conflictType?: 'CODE_EXISTS' | 'NONE';
  conflictExistingItem?: Product | Tool;
  resolution?: 'SAME_LOCATION' | 'DIFFERENT_LOCATION' | 'SKIP';
  customLocation?: string;
  confirmedQuantity?: number;
}

export const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  onImportComplete
}) => {
  useBodyScrollLock(Boolean(isOpen));
  const { themeClasses } = useTheme();
  const { selectedCompanyId, companies } = useCompany();

  const [importType, setImportType] = useState<'products' | 'tools'>('products');
  const [step, setStep] = useState<'upload' | 'review' | 'importing' | 'complete'>('upload');
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  
  // Default to currently selected company or Asistentruck
  const [targetCompanyId, setTargetCompanyId] = useState<string>(() => {
    if (selectedCompanyId && selectedCompanyId !== 'ALL') return selectedCompanyId;
    const asis = companies.find(c => c.id === 'market-almacen' || c.name.toLowerCase().includes('market-almacen'));
    return asis ? asis.id : (companies[0]?.id || 'market-almacen');
  });

  const [importProgress, setImportProgress] = useState(0);
  const [importedCount, setImportedCount] = useState(0);

  // Demo generator state inside modal
  const [isGeneratingDemo, setIsGeneratingDemo] = useState(false);
  const [demoProgressMsg, setDemoProgressMsg] = useState('');

  // Keep targetCompanyId updated with active context
  useEffect(() => {
    if (isOpen) {
      if (selectedCompanyId && selectedCompanyId !== 'ALL') {
        setTargetCompanyId(selectedCompanyId);
      } else if (!targetCompanyId || !companies.some(c => c.id === targetCompanyId)) {
        const asis = companies.find(c => c.id === 'market-almacen' || c.name.toLowerCase().includes('market-almacen'));
        setTargetCompanyId(asis ? asis.id : (companies[0]?.id || 'market-almacen'));
      }
    }
  }, [isOpen, selectedCompanyId, companies]);

  if (!isOpen) return null;

  const currentSelectedCompany = companies.find(c => c.id === targetCompanyId) || companies[0];

  const downloadSampleTemplate = () => {
    const wb = XLSX.utils.book_new();
    if (importType === 'products') {
      const sample = [
        {
          'Código': '74829103',
          'Nombre': 'Bebida Coca-Cola Original 1.5 L',
          'Categoría': 'Bebidas y Licores',
          'Código Mann Filter': '',
          'Marca': 'Coca-Cola',
          'Ubicación': 'Estante A-1',
          'Stock': 20,
          'Stock Mínimo': 0,
          'Unidad': 'Unidades',
          'Precio CLP': 32000,
          'Estado': 'NUEVO',
          'Integridad': 'COMPLETO',
          'Detalle': 'Sellado'
        },
        {
          'Código': '10928374',
          'Nombre': 'Aceite Motor 15W40 Balde 20L',
          'Categoría': 'Lubricantes',
          'Código Mann Filter': '',
          'Marca': 'Mobil Delvac',
          'Ubicación': 'Pasillo B-2',
          'Stock': 10,
          'Stock Mínimo': 0,
          'Unidad': 'Baldes (20L)',
          'Precio CLP': 85000,
          'Estado': 'NUEVO',
          'Integridad': 'COMPLETO',
          'Detalle': ''
        }
      ];
      const ws = XLSX.utils.json_to_sheet(sample);
      XLSX.utils.book_append_sheet(wb, ws, 'Plantilla_Productos');
      XLSX.writeFile(wb, 'Plantilla_Importacion_Productos_Market_Almacen.xlsx');
    } else {
      const sample = [
        {
          'Código': 'HERR-001',
          'Nombre': 'Llave de Impacto Neumática 1 pulgada',
          'Marca': 'Ingersoll Rand',
          'Modelo': '285B-6',
          'Categoría': 'Neumáticas',
          'Ubicación': 'Gabinete 1 - Nivel 2',
          'Estado Físico': 'BUENO',
          'Integridad': 'COMPLETO',
          'Detalle': 'Con manguera y acople'
        },
        {
          'Código': 'HERR-002',
          'Nombre': 'Torquímetro 1/2 pulgada 40-200 Nm',
          'Marca': 'Snap-On',
          'Modelo': 'TAZ-200',
          'Categoría': 'Medición y Torque',
          'Ubicación': 'Estante Calibrados',
          'Estado Físico': 'EXCELENTE',
          'Integridad': 'COMPLETO',
          'Detalle': 'Certificado vigente'
        }
      ];
      const ws = XLSX.utils.json_to_sheet(sample);
      XLSX.utils.book_append_sheet(wb, ws, 'Plantilla_Herramientas');
      XLSX.writeFile(wb, 'Plantilla_Importacion_Herramientas_Market_Almacen.xlsx');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data);
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const rawJson: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

    if (rawJson.length === 0) {
      alert('El archivo no contiene filas con información válida.');
      return;
    }

    // Load existing items from DB to check strictly for duplicate codes
    const existingProducts = await db.products.toArray();
    const existingTools = await db.tools.toArray();

    const rows: ParsedRow[] = [];
    const usedCodesInFile = new Set<string>();

    for (let i = 0; i < rawJson.length; i++) {
      const row = rawJson[i];

      // Ignore empty row if all values are blank
      const values = Object.values(row).map(v => String(v).trim());
      const hasContent = values.some(v => v !== '');
      if (!hasContent) continue;

      // Map dynamic column names
      const name = (row['Nombre'] || row['Descripcion'] || row['DESCRIPCIÓN'] || row['Item'] || row['Producto'] || row['Herramienta'] || '').trim();
      if (!name) continue; // Ignore without name

      let code = String(row['Código'] || row['Codigo'] || row['CODIGO'] || row['SKU'] || row['Barcode'] || row['Serie'] || row['Ref'] || row['Referencia'] || row['Cod'] || '').trim();
      if (!code) {
        // Auto-generate a guaranteed unique 8-digit code
        let newCode = generateProductBarcode();
        while (usedCodesInFile.has(newCode)) {
          newCode = generateProductBarcode();
        }
        code = importType === 'products' ? newCode : `HERR-${String(rows.length + 1).padStart(3, '0')}`;
      }
      usedCodesInFile.add(code);

      const category = (row['Categoría'] || row['Categoria'] || row['CATEGORIA'] || (importType === 'products' ? 'Abarrotes' : 'Manuales')).trim();
      const brand = (row['Marca'] || row['MARCA'] || '').trim();
      const mannFilterCode = (row['Código Mann Filter'] || row['Mann Filter'] || row['Ref Mann'] || row['Mann'] || '').trim();
      const location = (row['Ubicación'] || row['Ubicacion'] || row['UBICACION'] || (importType === 'products' ? 'Bodega Principal' : 'Gabinete General')).trim();
      const stock = parseInt(row['Stock'] || row['Cantidad'] || row['CANTIDAD'] || '1', 10) || 1;
      const minStock = parseInt(row['Stock Mínimo'] || row['Stock Minimo'] || row['Minimo'] || '0', 10) || 0;
      const unit = (row['Unidad'] || row['UNIDAD'] || 'Unidades').trim();
      const price = parseFloat(row['Precio CLP'] || row['Precio'] || row['Costo'] || '0') || 0;
      const condition = (row['Estado'] || row['Estado Físico'] || row['Condicion'] || 'NUEVO').toUpperCase() as ItemCondition;
      const completeness = (row['Integridad'] || 'COMPLETO').toUpperCase() as ItemCompleteness;
      const conditionNotes = (row['Detalle'] || row['Observaciones'] || '').trim();
      const model = (row['Modelo'] || row['MODELO'] || '').trim();

      // Check per-row company if explicitly given in the row
      const rowCompRaw = String(
        row['Empresa'] || row['EMPRESA'] || row['Rut Empresa'] || row['RUT Empresa'] ||
        row['Razon Social'] || row['Company'] || ''
      ).trim().toLowerCase();

      let rowCompanyId: string | undefined = undefined;
      if (rowCompRaw) {
        const cleanRutSearch = rowCompRaw.replace(/[^0-9k]/gi, '');
        const matched = companies.find(c =>
          c.id.toLowerCase() === rowCompRaw ||
          c.name.toLowerCase().includes(rowCompRaw) ||
          c.tradeName?.toLowerCase().includes(rowCompRaw) ||
          (cleanRutSearch.length >= 7 && c.rut.toLowerCase().replace(/[^0-9k]/gi, '') === cleanRutSearch)
        );
        if (matched) {
          rowCompanyId = matched.id;
        }
      }

      // Check special liquid keywords
      const lowerName = name.toLowerCase();
      const lowerUnit = unit.toLowerCase();
      const isSpecialLiquidUnit =
        lowerName.includes('balde') ||
        lowerName.includes('tambor') ||
        lowerName.includes('litro') ||
        lowerName.includes('kilo') ||
        lowerUnit.includes('balde') ||
        lowerUnit.includes('tambor') ||
        lowerUnit.includes('litro') ||
        lowerUnit.includes('kilo') ||
        lowerUnit.includes('20l') ||
        lowerUnit.includes('200l');

      // Conflict detection ONLY by EXACT barcode/code (NEVER collapse by name)
      let conflictType: 'CODE_EXISTS' | 'NONE' = 'NONE';
      let conflictExistingItem: Product | Tool | undefined;

      const normEffectiveCompany = (rowCompanyId || targetCompanyId).toLowerCase().trim();

      if (importType === 'products') {
        const foundByCode = existingProducts.find(p =>
          p.code.toLowerCase().trim() === code.toLowerCase().trim() &&
          ((p.companyId || '').toLowerCase().trim() === normEffectiveCompany || !p.companyId)
        );
        if (foundByCode) {
          conflictType = 'CODE_EXISTS';
          conflictExistingItem = foundByCode;
        }
      } else {
        const foundByCode = existingTools.find(t =>
          t.code.toLowerCase().trim() === code.toLowerCase().trim() &&
          ((t.companyId || '').toLowerCase().trim() === normEffectiveCompany || !t.companyId)
        );
        if (foundByCode) {
          conflictType = 'CODE_EXISTS';
          conflictExistingItem = foundByCode;
        }
      }

      rows.push({
        index: rows.length + 1,
        code,
        name,
        category,
        brand: brand || undefined,
        mannFilterCode: mannFilterCode || undefined,
        companyId: rowCompanyId,
        location,
        stock,
        minStock,
        unit,
        price,
        condition: ['NUEVO', 'EXCELENTE', 'BUENO', 'DESGASTE', 'DANADO'].includes(condition) ? condition : 'NUEVO',
        completeness: completeness === 'INCOMPLETO' ? 'INCOMPLETO' : 'COMPLETO',
        conditionNotes: conditionNotes || undefined,
        model: model || undefined,
        isSpecialLiquidUnit,
        conflictType,
        conflictExistingItem,
        resolution: conflictType !== 'NONE' ? 'SAME_LOCATION' : undefined,
        confirmedQuantity: stock
      });
    }

    setParsedRows(rows);
    setStep('review');
  };

  const handleExecuteImport = async () => {
    setStep('importing');
    setImportProgress(0);
    const nowIso = new Date().toISOString();
    let count = 0;

    const effectiveTargetCompany = (targetCompanyId || selectedCompanyId || companies[0]?.id || 'market-almacen').trim();

    for (let i = 0; i < parsedRows.length; i++) {
      const row = parsedRows[i];

      if (row.resolution === 'SKIP') {
        continue;
      }

      const finalQuantity = Number(row.confirmedQuantity) || row.stock;
      const autoImage = getDefaultImageForCategory(row.name, row.category, row.brand, row.mannFilterCode);
      const rowCompany = (row.companyId || effectiveTargetCompany).trim();

      if (importType === 'products') {
        if (row.resolution === 'SAME_LOCATION' && row.conflictExistingItem) {
          // Sum stock to existing item
          const existing = row.conflictExistingItem as Product;
          await db.products.update(existing.id!, {
            stock: existing.stock + finalQuantity,
            companyId: rowCompany,
            updatedAt: nowIso
          });
        } else {
          let finalCode = row.code;
          if (row.resolution === 'DIFFERENT_LOCATION') {
            finalCode = generateProductBarcode();
          }

          const newProd: Product = {
            code: finalCode.trim(),
            name: row.name.trim(),
            category: row.category || 'Abarrotes',
            isFilter: row.category === 'Filtros' || Boolean(row.mannFilterCode && row.mannFilterCode.trim() !== ''),
            mannFilterCode: row.mannFilterCode,
            brand: row.brand,
            companyId: rowCompany,
            location: row.customLocation || row.location,
            stock: finalQuantity,
            minStock: row.minStock || 0,
            unit: row.unit,
            price: row.price,
            condition: row.condition,
            completeness: row.completeness,
            conditionNotes: row.conditionNotes,
            imageUrl: autoImage,
            createdAt: nowIso,
            updatedAt: nowIso
          };
          await db.products.add(newProd);
        }
      } else {
        // Tools
        if (row.resolution === 'SAME_LOCATION' && row.conflictExistingItem) {
          const existing = row.conflictExistingItem as Tool;
          await db.tools.update(existing.id!, {
            location: row.location,
            condition: row.condition,
            companyId: rowCompany,
            updatedAt: nowIso
          });
        } else {
          let finalCode = row.code;
          if (row.resolution === 'DIFFERENT_LOCATION') {
            finalCode = await getNextToolCode();
          }

          const newTool: Tool = {
            code: finalCode.trim(),
            name: row.name.trim(),
            brand: row.brand,
            model: row.model,
            category: row.category || 'Manuales',
            companyId: rowCompany,
            location: row.customLocation || row.location,
            status: 'DISPONIBLE',
            condition: row.condition,
            completeness: row.completeness,
            conditionNotes: row.conditionNotes,
            imageUrl: autoImage,
            createdAt: nowIso,
            updatedAt: nowIso
          };
          await db.tools.add(newTool);
        }
      }

      count++;
      setImportProgress(Math.round(((i + 1) / parsedRows.length) * 100));
    }

    setImportedCount(count);
    setStep('complete');
    
    // Save locally and push to cloud immediately with locking against incoming pulls
    notifyLocalMutation();
    await pushAllToCloud(true);
    onImportComplete();
  };

  const handleDemoStressTest = async () => {
    if (confirm('¿Desea generar e importar 10.000 productos y 10.000 herramientas con fotos y códigos automáticos para validar la capacidad extrema?')) {
      setIsGeneratingDemo(true);
      try {
        await generateMassiveDataset(10000, 10000, (msg, pct) => {
          setDemoProgressMsg(msg);
          setImportProgress(pct);
        });
        alert('¡10.000 Productos y 10.000 Herramientas cargadas exitosamente!');
        notifyLocalMutation();
        await pushAllToCloud(true);
        onImportComplete();
        onClose();
        window.location.reload();
      } catch (err) {
        alert('Error al generar datos: ' + err);
      } finally {
        setIsGeneratingDemo(false);
      }
    }
  };

  const conflictsCount = parsedRows.filter(r => r.conflictType === 'CODE_EXISTS').length;
  const liquidsCount = parsedRows.filter(r => r.isSpecialLiquidUnit).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md">
      <div className={`w-full max-w-4xl rounded-2xl border ${themeClasses.border} ${themeClasses.card} p-5 shadow-2xl flex flex-col max-h-[94vh]`}>
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-700/50">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-lg ${themeClasses.badge}`}>
              <FileSpreadsheet className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">Módulo de Importación Masiva (Excel / CSV)</h3>
              <p className={`text-xs ${themeClasses.textMuted}`}>
                Importación íntegra de catálogo, reconocimiento automático y respaldo permanente
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* STEP 1: UPLOAD & CONFIGURATION */}
        {step === 'upload' && (
          <div className="my-4 overflow-y-auto pr-1 flex-1 space-y-4">
            {/* Target & Type Selector */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Destino de Importación:
              </span>
              <div className="flex items-center gap-2 p-2 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-600 dark:text-blue-400 font-bold text-xs">
                <Boxes className="w-4 h-4" />
                <span>Catálogo de Productos de Almacén (Hasta 30.000 ítems)</span>
              </div>
            </div>

              <div>
                <label className="block text-xs font-bold text-orange-400 mb-1.5 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5" />
                  <span>Empresa Propietaria Destino *</span>
                </label>
                <select
                  value={targetCompanyId}
                  onChange={(e) => setTargetCompanyId(e.target.value)}
                  className={`w-full px-3 py-2.5 text-xs font-bold rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-slate-100 ring-2 ring-orange-500/40 bg-slate-900`}
                >
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.rut})
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-orange-300/80 mt-1 block font-medium">
                  ✓ Todos los ítems subidos se asignarán directamente al inventario de esta empresa.
                </span>
              </div>
            </div>

            {/* Drag & Drop Area */}
            <div className="p-8 rounded-2xl border-2 border-dashed border-slate-700 hover:border-orange-500/80 bg-slate-900/40 text-center space-y-3 transition">
              <Upload className="w-12 h-12 text-orange-400 mx-auto" />
              <div>
                <h4 className="font-extrabold text-sm text-slate-900 dark:text-slate-100">
                  Subir archivo Excel (.xlsx, .xls) o CSV con el listado de {importType === 'products' ? 'productos' : 'herramientas'}
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  Se importarán todos los ítems de forma completa sin omitir ni duplicar registros.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <label className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-xl ${themeClasses.accentBg} ${themeClasses.accentHover} text-xs font-extrabold cursor-pointer shadow-lg shadow-orange-500/20 transition`}>
                  <Upload className="w-4 h-4" />
                  <span>Seleccionar Archivo Excel / CSV</span>
                  <input
                    type="file"
                    accept=".xlsx, .xls, .csv"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>

                <button
                  type="button"
                  onClick={downloadSampleTemplate}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-xs font-medium text-slate-300 transition"
                >
                  <Download className="w-4 h-4 text-emerald-400" />
                  <span>Descargar Plantilla Oficial Excel</span>
                </button>
              </div>
            </div>

            {/* Info note */}
            <div className="p-3.5 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-start gap-3">
              <Info className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
              <div className="text-xs text-slate-300 space-y-1">
                <p className="font-bold text-orange-300">Garantía de Importación Completa:</p>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-[11px]">
                  • Cada fila del archivo se importa como un ítem único con su stock y ubicación correspondiente.
                  <br />
                  • Soporta hasta 30.000 productos sin límite de cantidad por cada producto.
                  <br />
                  • Respaldo automático inmediato a la nube y retención permanente en el dispositivo.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: REVIEW & CONFLICT RESOLUTION */}
        {step === 'review' && (
          <div className="my-4 overflow-y-auto pr-1 flex-1 space-y-4">
            {/* Header summary & Company selector on review */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs font-bold text-slate-300">
                  Total detectado: <span className="font-mono text-orange-400 text-sm font-extrabold">{parsedRows.length}</span> ítems
                </span>
                {conflictsCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[11px] font-bold">
                    {conflictsCount} códigos ya existentes
                  </span>
                )}
                {liquidsCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 text-[11px] font-bold">
                    {liquidsCount} aceites / fluidos especiales
                  </span>
                )}
              </div>

              {/* In-review company selector to guarantee user choice */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-400 whitespace-nowrap">Empresa Destino:</span>
                <select
                  value={targetCompanyId}
                  onChange={(e) => setTargetCompanyId(e.target.value)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg border ${themeClasses.inputBorder} bg-slate-950 text-orange-300 ring-1 ring-orange-500/40`}
                >
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Table Preview */}
            <div className="border border-slate-800 rounded-xl overflow-x-auto max-h-[45vh]">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/90 sticky top-0 text-slate-600 dark:text-slate-400 border-b border-slate-800 text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">CÓDIGO</th>
                    <th className="py-2.5 px-3">NOMBRE / DESCRIPCIÓN</th>
                    <th className="py-2.5 px-3">CATEGORÍA / MARCA</th>
                    <th className="py-2.5 px-3">CANTIDAD / UNIDAD</th>
                    <th className="py-2.5 px-3">UBICACIÓN</th>
                    <th className="py-2.5 px-3">ESTADO / ACCIÓN</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {parsedRows.map((r, idx) => (
                    <tr key={idx} className={`hover:bg-slate-800/30 ${r.conflictType === 'CODE_EXISTS' ? 'bg-amber-500/5' : ''}`}>
                      <td className="py-2 px-3 text-slate-500 font-mono">{r.index}</td>
                      <td className="py-2 px-3 font-mono font-bold text-orange-400 whitespace-nowrap">{r.code}</td>
                      <td className="py-2 px-3 font-medium text-slate-900 dark:text-slate-100">
                        {r.name}
                        {r.mannFilterCode && (
                          <span className="text-[10px] text-amber-400 font-mono block">Mann: {r.mannFilterCode}</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-slate-300">
                        <div>{r.category}</div>
                        <div className="text-[10px] text-slate-600 dark:text-slate-400">{r.brand || '-'}</div>
                      </td>

                      {/* Quantity */}
                      <td className="py-2 px-3 whitespace-nowrap">
                        {r.isSpecialLiquidUnit ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min="1"
                              value={r.confirmedQuantity}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10) || 1;
                                const updated = [...parsedRows];
                                updated[idx].confirmedQuantity = val;
                                setParsedRows(updated);
                              }}
                              className="w-16 px-1.5 py-0.5 text-xs font-mono font-bold bg-black/60 border border-cyan-500/50 rounded text-cyan-300"
                              title="Cantidad a importar para baldes/tambores/litros"
                            />
                            <span className="text-[10px] text-slate-600 dark:text-slate-400">{r.unit}</span>
                          </div>
                        ) : (
                          <span className="font-mono font-bold text-slate-300">{r.stock} {r.unit}</span>
                        )}
                      </td>

                      {/* Location */}
                      <td className="py-2 px-3 whitespace-nowrap">
                        {r.resolution === 'DIFFERENT_LOCATION' ? (
                          <input
                            type="text"
                            value={r.customLocation || r.location}
                            onChange={(e) => {
                              const updated = [...parsedRows];
                              updated[idx].customLocation = e.target.value;
                              setParsedRows(updated);
                            }}
                            placeholder="Nueva ubicación..."
                            className="w-28 px-1.5 py-0.5 text-xs bg-black/60 border border-orange-500 rounded text-slate-900 dark:text-slate-100"
                          />
                        ) : (
                          <span className="text-slate-600 dark:text-slate-400">{r.location}</span>
                        )}
                      </td>

                      {/* Duplicate Code Handler */}
                      <td className="py-2 px-3 whitespace-nowrap">
                        {r.conflictType === 'CODE_EXISTS' ? (
                          <select
                            value={r.resolution}
                            onChange={(e) => {
                              const updated = [...parsedRows];
                              updated[idx].resolution = e.target.value as any;
                              setParsedRows(updated);
                            }}
                            className="px-2 py-1 text-[11px] font-bold rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40"
                          >
                            <option value="SAME_LOCATION">Mismo Código (Sumar Stock)</option>
                            <option value="DIFFERENT_LOCATION">Generar Nuevo Código</option>
                            <option value="SKIP">Omitir</option>
                          </select>
                        ) : (
                          <span className="text-emerald-400 font-semibold text-[11px]">✓ Nuevo Ítem</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Review actions */}
            <div className="flex justify-between items-center pt-2">
              <button
                type="button"
                onClick={() => setStep('upload')}
                className="px-4 py-2 text-xs rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800"
              >
                Volver Atrás
              </button>

              <button
                type="button"
                onClick={handleExecuteImport}
                className={`flex items-center gap-2 px-6 py-2.5 text-xs font-bold rounded-xl ${themeClasses.accentBg} ${themeClasses.accentHover} shadow-lg shadow-orange-500/20`}
              >
                <span>Confirmar e Importar {parsedRows.length} Ítems a {currentSelectedCompany?.name}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: PROGRESS */}
        {step === 'importing' && (
          <div className="py-16 text-center space-y-4">
            <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <div>
              <h4 className="font-extrabold text-base text-slate-100">Importando {importType === 'products' ? 'Productos' : 'Herramientas'}...</h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Generando fotos automáticas, asignando a la empresa y actualizando base de datos...</p>
            </div>
            <div className="max-w-md mx-auto bg-slate-800 rounded-full h-3 overflow-hidden">
              <div
                className="bg-orange-500 h-full transition-all duration-200"
                style={{ width: `${importProgress}%` }}
              />
            </div>
            <span className="text-xs font-mono font-bold text-orange-400">{importProgress}% Completado</span>
          </div>
        )}

        {/* STEP 4: COMPLETE */}
        {step === 'complete' && (
          <div className="py-12 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-100">¡Importación Masiva Completada con Éxito!</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                Se han importado y asegurado permanentemente <strong className="text-orange-400 font-bold">{importedCount}</strong> {importType === 'products' ? 'productos' : 'herramientas'} en el inventario de <strong className="text-emerald-400 font-bold">{currentSelectedCompany?.name}</strong>.
              </p>
            </div>
            <div className="pt-3">
              <button
                type="button"
                onClick={onClose}
                className={`px-8 py-2.5 text-xs font-bold rounded-xl ${themeClasses.accentBg} ${themeClasses.accentHover} shadow-md shadow-orange-500/20`}
              >
                Finalizar y Ver Inventario
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
