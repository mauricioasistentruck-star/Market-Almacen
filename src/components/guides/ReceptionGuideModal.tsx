import { WorkerAutocomplete } from '../workers/WorkerAutocomplete';
import { useBodyScrollLock } from '../../utils/scrollLock';
import React, { useState, useEffect, useRef } from 'react';
import type { ReceptionGuide, ReceptionGuideItem, Product } from '../../types';
import { useTheme } from '../../utils/themeContext';
import { useCompany } from '../../utils/companyContext';
import { db } from '../../db/database';
import { formatRut, getNextReceptionFolio } from '../../utils/barcodeGenerator';
import { formatChilePhone } from '../../utils/phoneFormatter';
import { generateReceptionGuidePDF, downloadPDF, printPDF, sharePDFDocument } from '../../utils/pdfGenerator';
import { triggerCloudSync } from '../../utils/cloudSync';
import { SignaturePadModal } from '../SignaturePadModal';
import { ImageViewerModal } from '../ImageViewerModal';
import { DocumentScannerModal } from '../scanner/DocumentScannerModal';
import {
  X,
  FileCheck,
  Plus,
  Trash2,
  PenTool,
  Download,
  Printer,
  Mail,
  FileText,
  Upload,
  Camera,
  Link as LinkIcon,
  CheckCircle2
} from 'lucide-react';

interface ReceptionGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  onOpenScanner?: () => void;
  scannedBarcode?: string;
}

export const ReceptionGuideModal: React.FC<ReceptionGuideModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  onOpenScanner,
  scannedBarcode
}) => {
  useBodyScrollLock(Boolean(isOpen));
  const { theme, themeClasses } = useTheme();
  const { companies, selectedCompanyId } = useCompany();

  const [folio, setFolio] = useState('');
  const [receptionDate, setReceptionDate] = useState('');
  const [companyId, setCompanyId] = useState(
    selectedCompanyId && selectedCompanyId !== 'ALL' ? selectedCompanyId : 'market-almacen'
  );

  // Supplier & Carrier Information
  const [supplierOrCarrierName, setSupplierOrCarrierName] = useState('');
  const [carrierRut, setCarrierRut] = useState('');
  const [carrierPhone, setCarrierPhone] = useState('');
  const [externalDocNumber, setExternalDocNumber] = useState('');

  // Attached Document Scan / PDF
  const [invoiceScanImage, setInvoiceScanImage] = useState<string | null>(null);
  const [invoiceDocName, setInvoiceDocName] = useState<string | undefined>(undefined);
  const [invoiceDocType, setInvoiceDocType] = useState<'PDF' | 'IMAGE' | undefined>(undefined);
  const digitalDocInputRef = useRef<HTMLInputElement>(null);
  const [isDocumentScannerOpen, setIsDocumentScannerOpen] = useState(false);
  const [isPreviewScanOpen, setIsPreviewScanOpen] = useState(false);

  // Linked Folio (Multi-sheet management for >20 items)
  const [linkedFolio, setLinkedFolio] = useState<string | undefined>(undefined);

  // Items List in Current Guide (Up to 20 per physical sheet)
  const [items, setItems] = useState<ReceptionGuideItem[]>([]);

  // Item Form Input States
  const [itemCode, setItemCode] = useState('');
  const [itemName, setItemName] = useState('');
  const [itemQuantity, setItemQuantity] = useState<number>(1);
  const [itemUnit, setItemUnit] = useState('UN');
  const [itemCategory, setItemCategory] = useState('Abarrotes');
  const [itemBrand, setItemBrand] = useState('');
  const [itemLocation, setItemLocation] = useState('Góndola Principal');

  // Signature & Notes
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [isSignPadOpen, setIsSignPadOpen] = useState(false);
  const [notes, setNotes] = useState('');

  // Success & Created Guide State
  const [createdGuide, setCreatedGuide] = useState<ReceptionGuide | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadInitialData();
    }
  }, [isOpen, selectedCompanyId]);

  useEffect(() => {
    if (scannedBarcode && isOpen) {
      setItemCode(scannedBarcode);
      // Auto-fill if exists in database
      db.products.where('code').equals(scannedBarcode).first().then(prod => {
        if (prod) {
          setItemName(prod.name);
          setItemCategory(prod.category || 'Abarrotes');
          setItemBrand(prod.brand || '');
          setItemUnit(prod.unit || 'UN');
        }
      });
    }
  }, [scannedBarcode, isOpen]);

  const loadInitialData = async () => {
    const nextFolio = await getNextReceptionFolio();
    setFolio(nextFolio);
    setReceptionDate(new Date().toISOString().slice(0, 16));
    setCompanyId(selectedCompanyId && selectedCompanyId !== 'ALL' ? selectedCompanyId : 'market-almacen');
    setSupplierOrCarrierName('');
    setCarrierRut('');
    setCarrierPhone('');
    setExternalDocNumber('');
    setInvoiceScanImage(null);
    setInvoiceDocName(undefined);
    setInvoiceDocType(undefined);
    setLinkedFolio(undefined);
    setItems([]);
    resetItemForm();
    setSignatureData(null);
    setNotes('');
    setCreatedGuide(null);
  };

  const resetItemForm = () => {
    setItemCode('');
    setItemName('');
    setItemQuantity(1);
    setItemUnit('UN');
    setItemCategory('Abarrotes');
    setItemBrand('');
    setItemLocation('Góndola Principal');
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemCode.trim() || !itemName.trim() || itemQuantity <= 0) {
      alert('Por favor complete código, nombre y cantidad válida.');
      return;
    }

    if (items.length >= 20) {
      alert('Ha alcanzado el límite máximo de 20 ítems por hoja oficial de recepción.');
      return;
    }

    const newItem: ReceptionGuideItem = {
      code: itemCode.trim().toUpperCase(),
      name: itemName.trim(),
      quantity: Number(itemQuantity),
      unit: itemUnit,
      category: itemCategory,
      brand: itemBrand.trim() || undefined,
      location: itemLocation.trim() || undefined
    };

    setItems([...items, newItem]);
    resetItemForm();
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, idx) => idx !== index));
  };

  const handleDigitalDocUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setInvoiceScanImage(result);
      setInvoiceDocName(file.name);
      setInvoiceDocType(isPdf ? 'PDF' : 'IMAGE');
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) {
      alert('Debe agregar al menos un producto a la guía de recepción.');
      return;
    }
    if (!supplierOrCarrierName.trim()) {
      alert('Por favor ingrese el nombre del proveedor o transportista.');
      return;
    }

    await saveCurrentReceptionGuide();
  };

  const saveCurrentReceptionGuide = async (): Promise<ReceptionGuide> => {
    const targetComp = companies.find(c => c.id === companyId);
    const nowIso = new Date(receptionDate || new Date()).toISOString();

    const guideData: ReceptionGuide = {
      folio,
      date: nowIso,
      companyId,
      companyName: targetComp?.name || 'MARKET ALMACÉN SpA',
      supplierOrCarrierName: supplierOrCarrierName.trim(),
      carrierRut: carrierRut.trim() || undefined,
      carrierPhone: carrierPhone.trim() || undefined,
      externalDocNumber: externalDocNumber.trim() || undefined,
      invoiceScanImage: invoiceScanImage || undefined,
      invoiceDocName: invoiceDocName || undefined,
      invoiceDocType: invoiceDocType || (invoiceScanImage ? (invoiceScanImage.startsWith('data:application/pdf') ? 'PDF' : 'IMAGE') : undefined),
      linkedFolio: linkedFolio || undefined,
      items,
      signatureData: signatureData || undefined,
      warehouseStamp: `RECEPCION_CONFORME_${folio}`,
      notes: notes.trim() || undefined,
      createdAt: nowIso
    };

    await db.receptionGuides.add(guideData);

    // Actualizar Stock y Registrar Movimientos en Kardex
    for (const item of items) {
      const existing = await db.products.where('code').equals(item.code).first();
      if (existing) {
        const newStock = existing.stock + item.quantity;
        await db.products.update(existing.id!, {
          stock: newStock,
          category: item.category || existing.category,
          brand: item.brand || existing.brand,
          location: item.location || existing.location,
          updatedAt: nowIso
        });

        await db.productMovements.add({
          productId: existing.id!,
          productCode: existing.code,
          productName: existing.name,
          type: 'ENTRADA',
          quantity: item.quantity,
          previousStock: existing.stock,
          newStock,
          reason: `Ingreso Guía de Recepción Folio ${folio} (Doc ext: ${externalDocNumber || 'S/N'})`,
          workerOrSupplier: supplierOrCarrierName,
          date: nowIso,
          companyId,
          user: 'Mauricio Chamorro'
        });
      } else {
        const newProd: Product = {
          code: item.code,
          name: item.name,
          category: item.category || 'Abarrotes',
          brand: item.brand,
          companyId,
          location: item.location || 'Góndola Principal',
          stock: item.quantity,
          minStock: 5,
          unit: item.unit,
          price: 0,
          condition: 'DISPONIBLE',
          completeness: 'COMPLETO',
          createdAt: nowIso,
          updatedAt: nowIso
        };
        const newId = await db.products.add(newProd);

        await db.productMovements.add({
          productId: newId as number,
          productCode: item.code,
          productName: item.name,
          type: 'ENTRADA',
          quantity: item.quantity,
          previousStock: 0,
          newStock: item.quantity,
          reason: `Creación e Ingreso Inicial por Guía de Recepción Folio ${folio}`,
          workerOrSupplier: supplierOrCarrierName,
          date: nowIso,
          companyId,
          user: 'Mauricio Chamorro'
        });
      }
    }

    setCreatedGuide(guideData);
    onSaved();
    triggerCloudSync();
    return guideData;
  };

  const handleDownloadPDF = async () => {
    if (!createdGuide) return;
    const comp = companies.find(c => c.id === createdGuide.companyId);
    const pdfDoc = await generateReceptionGuidePDF(createdGuide, comp);
    downloadPDF(pdfDoc, `Guia_Recepcion_${createdGuide.folio}.pdf`);
  };

  const handlePrintPDF = async () => {
    if (!createdGuide) return;
    const comp = companies.find(c => c.id === createdGuide.companyId);
    const pdfDoc = await generateReceptionGuidePDF(createdGuide, comp);
    printPDF(pdfDoc);
  };

  const handleEmailShare = async () => {
    if (!createdGuide) return;
    const comp = companies.find(c => c.id === createdGuide.companyId);
    const pdfDoc = await generateReceptionGuidePDF(createdGuide, comp);
    await sharePDFDocument({
      doc: pdfDoc,
      filename: `Guia_Recepcion_${createdGuide.folio}.pdf`,
      title: `Guía de Recepción Conforme ${createdGuide.folio} - Market Almacén`,
      messageText: `Estimados,\n\nSe ha emitido la Guía de Recepción Conforme Folio ${createdGuide.folio} para la empresa ${createdGuide.companyName}.\n\nProveedor: ${createdGuide.supplierOrCarrierName}\nDoc Ext: ${createdGuide.externalDocNumber || 'S/N'}\n\nAdjunto documento oficial en PDF.\n\nAtentamente,\nMarket Almacén Central.`
    });
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
        <div className={`w-full max-w-4xl max-h-[92vh] rounded-3xl border ${themeClasses.border} ${themeClasses.card} shadow-2xl flex flex-col justify-between overflow-hidden animate-scaleIn`}>
          
          {/* Header */}
          <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-md ${themeClasses.accentBg}`}>
                <FileCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100">
                  Emitir Guía de Recepción de Mercadería
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Ingreso conforme con timbre oficial, firma, escaneo de factura y máximo 20 ítems
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

          {/* Body Content Scrollable */}
          <div className="p-4 sm:p-6 space-y-4 overflow-y-auto pr-2 flex-1">
            {!createdGuide ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                
                {/* Info Bar (Empresa, Folio, Fecha) */}
                <div className={`p-3.5 sm:p-4 rounded-2xl border ${themeClasses.border} ${themeClasses.cardSubtle} grid grid-cols-1 sm:grid-cols-3 gap-3`}>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Empresa Destino *
                    </label>
                    <select
                      value={companyId}
                      onChange={(e) => setCompanyId(e.target.value)}
                      className={`w-full px-3 py-2 text-xs font-bold rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-slate-900 dark:text-slate-100`}
                    >
                      {companies.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Folio Guía Recepción
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={folio}
                      className={`w-full px-3 py-2 text-xs font-mono font-black rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-blue-600 dark:text-blue-400 bg-slate-100 dark:bg-slate-800`}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Fecha y Hora *
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={receptionDate}
                      onChange={(e) => setReceptionDate(e.target.value)}
                      className={`w-full px-3 py-2 text-xs font-bold rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-slate-900 dark:text-slate-100`}
                    />
                  </div>
                </div>

                {/* Proveedor y Transporte */}
                <div className={`p-3.5 sm:p-4 rounded-2xl border ${themeClasses.border} ${themeClasses.cardSubtle} space-y-3`}>
                  <h4 className="text-xs font-black text-slate-900 dark:text-slate-100">
                    Datos del Proveedor y Documento Externo
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Nombre Proveedor / Conductor *
                      </label>
                      <input
                        type="text"
                        required
                        value={supplierOrCarrierName}
                        onChange={(e) => setSupplierOrCarrierName(e.target.value)}
                        placeholder="Ej: Distribuidora Central / Juan Alarcón"
                        className={`w-full px-3 py-2 text-xs font-bold rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-slate-900 dark:text-slate-100`}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        RUT / Identificación (Opcional)
                      </label>
                      <input
                        type="text"
                        value={carrierRut}
                        onChange={(e) => setCarrierRut(formatRut(e.target.value))}
                        placeholder="15.890.123-4"
                        className={`w-full px-3 py-2 text-xs font-bold rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-slate-900 dark:text-slate-100`}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        N° Factura / Guía Externa
                      </label>
                      <input
                        type="text"
                        value={externalDocNumber}
                        onChange={(e) => setExternalDocNumber(e.target.value)}
                        placeholder="Ej: Factura F-1092 / Guía N° 45892"
                        className={`w-full px-3 py-2 text-xs font-bold rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-slate-900 dark:text-slate-100`}
                      />
                    </div>
                  </div>
                </div>

                {/* Adjuntar Documento Tributario (Escáner o PDF) */}
                <div className="p-3.5 sm:p-4 rounded-2xl border border-orange-500/30 bg-orange-500/5 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                      <h4 className="text-xs font-black text-slate-900 dark:text-slate-100">
                        Documento Tributario de Respaldo (Factura, Boleta, Guía Proveedor)
                      </h4>
                    </div>
                    <span className="text-[10px] text-orange-600 dark:text-orange-300 font-black px-2.5 py-0.5 rounded-full bg-orange-500/15 border border-orange-500/30">
                      PDF / Foto / Escáner
                    </span>
                  </div>

                  <input
                    type="file"
                    ref={digitalDocInputRef}
                    accept="application/pdf,image/*"
                    onChange={handleDigitalDocUpload}
                    className="hidden"
                  />

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setIsDocumentScannerOpen(true)}
                      className="flex items-center gap-2 px-3.5 py-2 text-xs font-black rounded-xl bg-orange-600 hover:bg-orange-500 text-white shadow-md transition active:scale-95"
                    >
                      <Camera className="w-4 h-4" />
                      <span>Escanear Hoja Física</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => digitalDocInputRef.current?.click()}
                      className="flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition active:scale-95 shadow-sm"
                    >
                      <Upload className="w-4 h-4 text-orange-500" />
                      <span>Adjuntar PDF / Foto Digital</span>
                    </button>

                    {invoiceScanImage && (
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/40 text-xs shadow-sm">
                        <span className="text-emerald-700 dark:text-emerald-300 font-bold truncate max-w-xs">
                          ✓ {invoiceDocName || 'Documento_Adjunto.pdf'}
                        </span>
                        <button
                          type="button"
                          onClick={() => setIsPreviewScanOpen(true)}
                          className="px-2 py-0.5 rounded-lg bg-emerald-600 text-white text-[11px] font-bold"
                        >
                          Ver
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setInvoiceScanImage(null);
                            setInvoiceDocName(undefined);
                          }}
                          className="p-1 text-red-500 hover:bg-red-500/10 rounded"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Formulario Añadir Ítem */}
                <div className="p-4 rounded-2xl border border-blue-500/30 bg-blue-500/5 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                        <Plus className="w-4 h-4 text-blue-600" />
                        <span>Ingresar Productos a la Guía</span>
                      </span>
                      <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700">
                        {items.length} / 20 ítems
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Código de Barra / SKU *
                      </label>
                      <input
                        type="text"
                        value={itemCode}
                        onChange={(e) => setItemCode(e.target.value)}
                        placeholder="Ej: PROD-001..."
                        className={`w-full px-3 py-2 text-xs font-mono font-bold rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-slate-900 dark:text-slate-100`}
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Descripción del Ítem *
                      </label>
                      <input
                        type="text"
                        value={itemName}
                        onChange={(e) => setItemName(e.target.value)}
                        placeholder="Ej: Escriba 'arroz', 'leche', 'bebida' o nombre del producto..."
                        className={`w-full px-3 py-2 text-xs font-bold rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-slate-900 dark:text-slate-100`}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Cantidad *
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={itemQuantity}
                        onChange={(e) => setItemQuantity(Number(e.target.value))}
                        className={`w-full px-3 py-2 text-xs font-bold rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-slate-900 dark:text-slate-100`}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Unidad
                      </label>
                      <select
                        value={itemUnit}
                        onChange={(e) => setItemUnit(e.target.value)}
                        className={`w-full px-3 py-2 text-xs font-bold rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-slate-900 dark:text-slate-100`}
                      >
                        <option value="UN">Unidades</option>
                        <option value="KG">Kilos</option>
                        <option value="L">Litros</option>
                        <option value="PACK">Pack</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Categoría
                      </label>
                      <select
                        value={itemCategory}
                        onChange={(e) => setItemCategory(e.target.value)}
                        className={`w-full px-3 py-2 text-xs font-bold rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-slate-900 dark:text-slate-100`}
                      >
                        <option value="Abarrotes">Abarrotes</option>
                        <option value="Bebidas">Bebidas</option>
                        <option value="Lácteos">Lácteos</option>
                        <option value="Snacks">Snacks</option>
                        <option value="Limpieza">Limpieza</option>
                        <option value="Panadería">Panadería</option>
                        <option value="Otros">Otros</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      onClick={handleAddItem}
                      className="flex items-center gap-2 px-5 py-2 text-xs font-black rounded-xl bg-blue-600 hover:bg-blue-500 text-white shadow-md transition active:scale-95"
                    >
                      <Plus className="w-4 h-4" />
                      <span>+ Añadir Ítem a la Lista</span>
                    </button>
                  </div>
                </div>

                {/* Lista de Ítems Añadidos */}
                <div className="space-y-2">
                  <h4 className="text-xs font-black text-slate-900 dark:text-slate-100">
                    Ítems a Recepcionar ({items.length} de máx. 20)
                  </h4>

                  {items.length === 0 ? (
                    <div className="p-6 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 text-center space-y-1">
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        No ha agregado productos a la guía aún.
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Complete el formulario superior y presione "+ Añadir Ítem a la Lista".
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-100 dark:bg-slate-800 text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase">
                            <th className="p-2.5">#</th>
                            <th className="p-2.5">Código</th>
                            <th className="p-2.5">Descripción</th>
                            <th className="p-2.5">Categoría</th>
                            <th className="p-2.5 text-center">Cantidad</th>
                            <th className="p-2.5 text-right">Acción</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                          {items.map((it, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                              <td className="p-2.5 font-bold text-slate-500">{idx + 1}</td>
                              <td className="p-2.5 font-mono font-bold text-slate-900 dark:text-slate-100">{it.code}</td>
                              <td className="p-2.5 font-bold text-slate-900 dark:text-slate-100">{it.name}</td>
                              <td className="p-2.5 text-slate-600 dark:text-slate-400">{it.category}</td>
                              <td className="p-2.5 text-center font-black text-blue-600 dark:text-blue-400">
                                {it.quantity} {it.unit}
                              </td>
                              <td className="p-2.5 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveItem(idx)}
                                  className="p-1 rounded text-red-500 hover:bg-red-500/10"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Estampas y Firmas */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="p-3.5 rounded-2xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 flex flex-col justify-center space-y-1 shadow-sm">
                    <span className="text-xs font-black text-emerald-800 dark:text-emerald-300 uppercase tracking-wide flex items-center gap-1.5">
                      <FileCheck className="w-4 h-4 text-emerald-600" />
                      <span>✓ RECEPCIÓN CONFORME</span>
                    </span>
                    <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 font-mono">
                      Folio: {folio} | Encargado: Mauricio Chamorro
                    </p>
                  </div>

                  <div className="p-3.5 rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center justify-between gap-3 shadow-sm">
                    <div className="space-y-0.5">
                      <span className="text-xs font-black text-slate-900 dark:text-slate-100 block">
                        Firma del Transportista
                      </span>
                      <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                        {signatureData ? '✓ Firma capturada en pantalla' : 'Firme en pantalla con dedo/ratón'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsSignPadOpen(true)}
                      className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-500 text-white shadow-sm transition active:scale-95"
                    >
                      <PenTool className="w-3.5 h-3.5" />
                      <span>{signatureData ? 'Cambiar' : 'Firmar'}</span>
                    </button>
                  </div>
                </div>

                {/* Observaciones */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Observaciones Generales:
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Ej: Sellos de seguridad intactos, bultos revisados conforme"
                    className={`w-full px-3 py-2 text-xs font-bold rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-slate-900 dark:text-slate-100`}
                  />
                </div>

                {/* Botones de Acción */}
                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-5 py-2.5 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={items.length === 0}
                    className={`flex items-center gap-2 px-6 py-2.5 text-xs font-black rounded-xl text-white shadow-md transition active:scale-95 ${
                      items.length > 0
                        ? 'bg-emerald-600 hover:bg-emerald-500 cursor-pointer shadow-emerald-500/20'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-500 border border-slate-300 dark:border-slate-700 cursor-not-allowed'
                    }`}
                  >
                    <FileCheck className="w-4 h-4" />
                    <span>Emitir Guía de Recepción y Sumar Stock</span>
                  </button>
                </div>
              </form>
            ) : (
              /* Success / Actions Mode */
              <div className="py-6 px-4 text-center space-y-5">
                <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-600 font-black flex items-center justify-center mx-auto">
                  <FileCheck className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">
                    ¡Guía de Recepción {createdGuide.folio} Emitida con Éxito!
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 font-bold">
                    Se actualizaron {createdGuide.items.length} productos en el inventario de {createdGuide.companyName}.
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-3 max-w-lg mx-auto">
                  <button
                    onClick={handleDownloadPDF}
                    className="flex flex-col items-center justify-center gap-2 p-3.5 rounded-2xl bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 text-orange-600 dark:text-orange-400 font-bold text-xs transition"
                  >
                    <Download className="w-5 h-5" />
                    <span>Descargar PDF</span>
                  </button>

                  <button
                    onClick={handlePrintPDF}
                    className="flex flex-col items-center justify-center gap-2 p-3.5 rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs transition"
                  >
                    <Printer className="w-5 h-5" />
                    <span>Imprimir</span>
                  </button>

                  <button
                    onClick={handleEmailShare}
                    className="flex flex-col items-center justify-center gap-2 p-3.5 rounded-2xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-600 dark:text-blue-400 font-bold text-xs transition"
                  >
                    <Mail className="w-5 h-5" />
                    <span>Enviar Correo</span>
                  </button>
                </div>

                <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                  <button
                    onClick={onClose}
                    className={`px-8 py-2.5 text-xs font-black rounded-xl text-white shadow-md ${themeClasses.accentBg} hover:opacity-90 transition`}
                  >
                    Finalizar y Volver
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Signature Modal */}
      <SignaturePadModal
        isOpen={isSignPadOpen}
        onClose={() => setIsSignPadOpen(false)}
        onSave={(data) => setSignatureData(data)}
        title="Firma del Transportista / Entregador"
        subtitle={`Transportista: ${supplierOrCarrierName || 'Entregador'}`}
      />

      {/* Scanned Document Preview Modal */}
      {invoiceScanImage && (
        <ImageViewerModal
          isOpen={isPreviewScanOpen}
          onClose={() => setIsPreviewScanOpen(false)}
          imageUrl={invoiceScanImage}
          title="Documento de Respaldo Escaneado"
          subtitle={`Guía: ${folio} • Doc Externo: ${externalDocNumber || 'S/N'}`}
        />
      )}

      {/* Real Document Scanner Modal */}
      <DocumentScannerModal
        isOpen={isDocumentScannerOpen}
        onClose={() => setIsDocumentScannerOpen(false)}
        onScanComplete={(base64) => {
          setInvoiceScanImage(base64);
          setInvoiceDocName(`Escaneo_Boleta_${folio}.jpg`);
          setInvoiceDocType('IMAGE');
        }}
        title="Escáner de Factura / Boleta del Proveedor"
        subtitle={`Asociado a Guía ${folio} • Se procesará con nitidez y se anexará en el PDF`}
      />
    </>
  );
};
