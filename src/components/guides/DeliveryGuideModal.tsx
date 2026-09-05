import { WorkerAutocomplete } from '../workers/WorkerAutocomplete';
import { useBodyScrollLock } from '../../utils/scrollLock';
import React, { useState, useEffect } from 'react';
import type { DeliveryGuide, DeliveryGuideItem, Product, Tool, Company } from '../../types';
import { useTheme } from '../../utils/themeContext';
import { useCompany } from '../../utils/companyContext';
import { db } from '../../db/database';
import { formatRut, getNextDeliveryFolio } from '../../utils/barcodeGenerator';
import { formatChilePhone } from '../../utils/phoneFormatter';
import { generateDeliveryGuidePDF, downloadPDF, printPDF, sharePDFDocument } from '../../utils/pdfGenerator';
import { triggerCloudSync } from '../../utils/cloudSync';
import { SignaturePadModal } from '../SignaturePadModal';
import {
  X,
  FileText,
  Plus,
  Trash2,
  ScanLine,
  PenTool,
  Download,
  Printer,
  MessageSquare,
  Mail,
  Truck,
  AlertCircle,
  Check,
  Link as LinkIcon
} from 'lucide-react';

interface DeliveryGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  onOpenScanner?: () => void;
  scannedBarcode?: string;
}

export const DeliveryGuideModal: React.FC<DeliveryGuideModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  onOpenScanner,
  scannedBarcode
}) => {
  useBodyScrollLock(Boolean(isOpen));
  const { themeClasses } = useTheme();
  const { companies, selectedCompanyId } = useCompany();

  // Guide fields
  const [folio, setFolio] = useState('ENT-00001');
  const [dispatchType, setDispatchType] = useState<'FACTURABLE_CLIENTE' | 'TRASPASO_SUCURSAL'>('FACTURABLE_CLIENTE');
  const [destinationBranch, setDestinationBranch] = useState('Sucursal Norte / Bodega 2');
  const [customerBusinessName, setCustomerBusinessName] = useState('');
  const [customerActivity, setCustomerActivity] = useState('');
  const [companyId, setCompanyId] = useState(() => selectedCompanyId !== 'ALL' ? selectedCompanyId : (companies[0]?.id || ''));
  const [recipientName, setRecipientName] = useState('');
  const [recipientRut, setRecipientRut] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('+56 9 ');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [worksiteOrReason, setWorksiteOrReason] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [notes, setNotes] = useState('');
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [isSignPadOpen, setIsSignPadOpen] = useState(false);
  const [linkedFolio, setLinkedFolio] = useState<string | undefined>(undefined);

  // Items list (Max 20 items)
  const [items, setItems] = useState<DeliveryGuideItem[]>([]);

  // Add Item form
  const [itemCode, setItemCode] = useState('');
  const [itemName, setItemName] = useState('');
  const [itemQuantity, setItemQuantity] = useState<number | string>(1);
  const [itemUnit, setItemUnit] = useState('Unidades');
  const [itemBrand, setItemBrand] = useState('');
  const [itemPrice, setItemPrice] = useState<number | string>('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Autocomplete catalog state
  const [catalogItems, setCatalogItems] = useState<{
    code: string;
    name: string;
    brand?: string;
    category: string;
    unit: string;
    stock?: number;
    isTool?: boolean;
    rawProduct?: Product;
    rawTool?: Tool;
  }[]>([]);
  const [suggestions, setSuggestions] = useState<typeof catalogItems>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Preview created guide
  const [createdGuide, setCreatedGuide] = useState<DeliveryGuide | null>(null);

  useEffect(() => {
    if (isOpen) {
      const now = new Date();
      const localISO = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      setDeliveryDate(localISO);
      getNextDeliveryFolio().then(f => setFolio(f));
      setCompanyId(selectedCompanyId === 'ALL' ? (companies[0]?.id || '') : selectedCompanyId);
      setRecipientName('');
      setRecipientRut('');
      setRecipientPhone('+56 9 ');
      setVehiclePlate('');
      setWorksiteOrReason('');
      setLinkedFolio(undefined);
      setNotes('');
      setSignatureData(null);
      setItems([]);
      setCreatedGuide(null);
      resetItemForm();
      loadCatalog();
    }
  }, [isOpen, selectedCompanyId]);

  useEffect(() => {
    if (scannedBarcode && isOpen) {
      handleLookup(scannedBarcode);
    }
  }, [scannedBarcode, isOpen]);

  const loadCatalog = async () => {
    const prods = await db.products.toArray();
    const tls = await db.tools.toArray();

    const list: typeof catalogItems = [
      ...prods.map(p => ({
        code: p.code,
        name: p.name,
        brand: p.brand,
        category: p.category,
        unit: p.unit || 'Unidades',
        stock: p.stock,
        isTool: false,
        rawProduct: p
      })),
      ...tls.map(t => ({
        code: t.code,
        name: t.name,
        brand: t.brand,
        category: t.category,
        unit: 'Unidades',
        stock: 1,
        isTool: true,
        rawTool: t
      }))
    ];
    setCatalogItems(list);
  };

  const handleLookup = async (codeToLookup: string) => {
    const clean = codeToLookup.trim();
    if (!clean) return;

    const prod = await db.products.where('code').equals(clean).first();
    if (prod) {
      setItemCode(prod.code);
      setItemName(prod.name);
      setItemBrand(prod.brand || '');
      setItemUnit(prod.unit || 'Unidades');
      setItemPrice(prod.price || prod.costPrice || '');
      setSelectedProduct(prod);
      setShowSuggestions(false);
      return;
    }

    const tool = await db.tools.where('code').equals(clean).first();
    if (tool) {
      setItemCode(tool.code);
      setItemName(tool.name);
      setItemBrand(tool.brand || '');
      setItemUnit('Unidades');
      setSelectedProduct(null);
      setShowSuggestions(false);
    }
  };

  const handleNameChange = (val: string) => {
    setItemName(val);
    if (!val.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const term = val.toLowerCase().trim();
    const matches = catalogItems.filter(
      it =>
        it.name.toLowerCase().includes(term) ||
        it.code.toLowerCase().includes(term) ||
        (it.brand && it.brand.toLowerCase().includes(term))
    );

    setSuggestions(matches.slice(0, 8));
    setShowSuggestions(true);
  };

  const handleSelectCatalogItem = (selected: typeof catalogItems[0]) => {
    setItemCode(selected.code);
    setItemName(selected.name);
    setItemBrand(selected.brand || '');
    setItemUnit(selected.unit || 'Unidades');
    setItemPrice(selected.rawProduct?.price || selected.rawProduct?.costPrice || '');
    setSelectedProduct(selected.rawProduct || null);
    setShowSuggestions(false);
  };

  const resetItemForm = () => {
    setItemCode('');
    setItemName('');
    setItemQuantity(1);
    setItemUnit('Unidades');
    setItemBrand('');
    setItemPrice('');
    setSelectedProduct(null);
    setShowSuggestions(false);
  };

  const handleAddItem = () => {
    if (!itemCode.trim() || !itemName.trim()) {
      alert('Por favor complete código y descripción del ítem a entregar.');
      return;
    }
    if (items.length >= 20) {
      alert('Esta guía ha alcanzado el límite máximo de 20 productos. Por favor emita la guía o genere una correlativa vinculada.');
      return;
    }

    if (selectedProduct && selectedProduct.stock < Number(itemQuantity)) {
      if (!confirm(`Stock insuficiente en bodega (${selectedProduct.stock} disponibles). ¿Desea continuar con el despacho de ${Number(itemQuantity)} unidades?`)) {
        return;
      }
    }

    const newItem: DeliveryGuideItem = {
      code: itemCode.trim().toUpperCase(),
      name: itemName.trim(),
      quantity: Number(itemQuantity) || 1,
      unit: itemUnit,
      brand: itemBrand.trim() || undefined,
      productId: selectedProduct?.id
    };

    setItems([...items, newItem]);
    resetItemForm();
  };

  const handleRemoveItem = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) {
      alert('Debe agregar al menos un producto a la guía de entrega.');
      return;
    }
    if (!recipientName.trim()) {
      alert('Por favor ingrese el nombre del receptor.');
      return;
    }

    await saveCurrentDeliveryGuide();
  };

  const saveCurrentDeliveryGuide = async (): Promise<DeliveryGuide> => {
    const comp = companies.find(c => c.id === companyId);
    const compName = comp?.name || 'MARKET ALMACÉN SpA';
    const nowIso = new Date(deliveryDate || new Date()).toISOString();

    const guideData: DeliveryGuide = {
      folio,
      date: nowIso,
      companyId,
      companyName: compName,
      dispatchType,
      destinationBranch: dispatchType === 'TRASPASO_SUCURSAL' ? destinationBranch : undefined,
      recipientName: recipientName.trim(),
      recipientRut: recipientRut.trim() ? formatRut(recipientRut) : undefined,
      recipientPhone: recipientPhone.trim() || undefined,
      vehiclePlate: vehiclePlate.trim() ? vehiclePlate.trim().toUpperCase() : undefined,
      worksiteOrReason: worksiteOrReason.trim() || 'Despacho de Materiales',
      linkedFolio: linkedFolio || undefined,
      items,
      signatureData: signatureData || '',
      warehouseStamp: `DESPACHO_AUTORIZADO_${folio}`,
      notes: notes.trim() || undefined,
      createdAt: nowIso
    };

    // Save guide
    const id = await db.deliveryGuides.add(guideData);
    guideData.id = id as number;

    // Deduct stock for products and record movements
    for (const item of items) {
      const prod = await db.products.where('code').equals(item.code).first();
      if (prod) {
        const newStock = Math.max(0, prod.stock - item.quantity);
        await db.products.update(prod.id!, {
          stock: newStock,
          updatedAt: nowIso
        });

        await db.productMovements.add({
          productId: prod.id!,
          productCode: prod.code,
          productName: prod.name,
          type: 'SALIDA',
          quantity: item.quantity,
          previousStock: prod.stock,
          newStock,
          reason: `Salida por Guía de Entrega Folio ${folio} (Sin devolución)`,
          workerOrSupplier: `${recipientName} ${vehiclePlate ? `[Patente: ${vehiclePlate}]` : ''}`,
          date: nowIso,
          companyId,
          user: 'Mauricio Chamorro'
        });
      }
    }

    onSaved();
    triggerCloudSync();
    setCreatedGuide(guideData);
    return guideData;
  };

  // Handler to Create Linked Correlative Guide (When guide is full with 20 items)
  const handleCreateLinkedGuide = async () => {
    if (items.length === 0) return;
    const currentSaved = await saveCurrentDeliveryGuide();

    const nextFolio = await getNextDeliveryFolio();
    setFolio(nextFolio);
    setLinkedFolio(currentSaved.folio);
    setItems([]);
    setCreatedGuide(null);
    resetItemForm();
    alert(`¡Guía ${currentSaved.folio} guardada con éxito! Se ha abierto la guía correlativa vinculada ${nextFolio} con los datos del receptor precargados.`);
  };

  // PDF Action handlers
  const handleDownloadPDF = async () => {
    if (!createdGuide) return;
    const comp = companies.find(c => c.id === createdGuide.companyId);
    const doc = await generateDeliveryGuidePDF(createdGuide, comp);
    downloadPDF(doc, `Guia_Entrega_${createdGuide.folio}_${createdGuide.recipientName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
  };

  const handlePrintPDF = async () => {
    if (!createdGuide) return;
    const comp = companies.find(c => c.id === createdGuide.companyId);
    const doc = await generateDeliveryGuidePDF(createdGuide, comp);
    printPDF(doc);
  };

  const handleShareWhatsApp = async () => {
    if (!createdGuide) return;
    const comp = companies.find(c => c.id === createdGuide.companyId);
    const doc = await generateDeliveryGuidePDF(createdGuide, comp);
    await sharePDFDocument({
      doc,
      filename: `Guia_Entrega_${createdGuide.folio}.pdf`,
      recipientPhone: createdGuide.recipientPhone,
      title: `Guía de Entrega ${createdGuide.folio}`,
      messageText: `Estimado(a), adjunto copia oficial de la Guía de Despacho/Entrega Folio ${createdGuide.folio} de Market Almacén.`
    });
  };

  const handleShareEmail = async () => {
    if (!createdGuide) return;
    const comp = companies.find(c => c.id === createdGuide.companyId);
    const doc = await generateDeliveryGuidePDF(createdGuide, comp);
    await sharePDFDocument({
      doc,
      filename: `Guia_Entrega_${createdGuide.folio}.pdf`,
      title: `Guía de Entrega Folio ${createdGuide.folio} - Market Almacén`,
      messageText: `Estimados,\n\nSe adjunta registro oficial en PDF de entrega de materiales y herramientas sin devolución correspondiente al Folio ${createdGuide.folio}.\n\nReceptor: ${createdGuide.recipientName}\nDestino: ${createdGuide.worksiteOrReason}\n\nAtentamente,\nBodega MARKET ALMACÉN SpA.`
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className={`w-full max-w-3xl rounded-3xl border ${themeClasses.border} ${themeClasses.card} p-5 sm:p-6 shadow-2xl flex flex-col max-h-[92vh]`}>
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 pb-3 bg-slate-50 dark:bg-slate-900/60 -mx-6 -mt-6 p-4 sm:p-5 rounded-t-3xl mb-4">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl ${themeClasses.badge}`}>
              <Truck className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base sm:text-lg leading-tight">
                  {createdGuide ? 'Guía de Entrega Generada con Éxito' : 'Nueva Guía de Entrega (Sin Devolución)'}
                </h3>
                {linkedFolio && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1">
                    <LinkIcon className="w-3 h-3" />
                    Vinculada a {linkedFolio}
                  </span>
                )}
              </div>
              <p className={`text-xs ${themeClasses.textMuted}`}>
                {createdGuide
                  ? `Folio: ${createdGuide.folio} • Lista para imprimir o enviar con timbre digital`
                  : 'Despacho de productos para entrega a clientes o traspaso entre sucursales'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* VIEW 1: CREATED GUIDE ACTIONS */}
        {createdGuide ? (
          <div className="my-6 space-y-6 text-center py-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10">
              <Check className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h4 className="font-black text-xl text-slate-900 dark:text-slate-100">Guía Folio {createdGuide.folio} Guardada</h4>
              <p className="text-xs text-slate-400">
                Se rebajó el stock de bodega y se registró el despacho a nombre de <strong>{createdGuide.recipientName}</strong>.
              </p>
            </div>

            {/* Actions Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-2xl mx-auto pt-2">
              <button
                onClick={handleDownloadPDF}
                className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-orange-600/20 hover:bg-orange-600/30 border border-orange-500/40 text-orange-400 font-bold text-xs transition active:scale-95"
              >
                <Download className="w-5 h-5" />
                <span>Descargar PDF</span>
              </button>

              <button
                onClick={handlePrintPDF}
                className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-xs transition active:scale-95"
              >
                <Printer className="w-5 h-5" />
                <span>Imprimir</span>
              </button>

              <button
                onClick={handleShareEmail}
                className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/40 text-cyan-400 font-bold text-xs transition active:scale-95"
                title="Enviar documento PDF por correo"
              >
                <Mail className="w-5 h-5" />
                <span>Enviar Correo</span>
              </button>
            </div>

            <div className="pt-6">
              <button
                onClick={onClose}
                className={`px-8 py-2.5 rounded-xl text-xs font-bold ${themeClasses.accentBg} ${themeClasses.accentHover} shadow-md`}
              >
                Finalizar y Volver
              </button>
            </div>
          </div>
        ) : (
          /* VIEW 2: FORM TO CREATE GUIDE */
          <form onSubmit={handleSubmit} className="my-3 space-y-4 overflow-y-auto pr-1 flex-1">
            {/* 1. SELECCIÓN DE FACTURACIÓN: FACTURABLE VS TRASPASO */}
            <div className={`p-4 rounded-2xl border ${themeClasses.border} ${themeClasses.cardSubtle} space-y-3 shadow-sm`}>
              <span className="text-xs font-black text-slate-900 dark:text-slate-100 block">
                Tipo de Despacho y Facturación:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className={`flex items-start gap-3 p-3.5 rounded-2xl border-2 cursor-pointer transition select-none ${
                  dispatchType === 'FACTURABLE_CLIENTE'
                    ? 'border-blue-600 bg-blue-500/10 shadow-sm'
                    : `${themeClasses.border} hover:bg-slate-100 dark:hover:bg-slate-800/40`
                }`}>
                  <input
                    type="radio"
                    name="dispatchType"
                    value="FACTURABLE_CLIENTE"
                    checked={dispatchType === 'FACTURABLE_CLIENTE'}
                    onChange={() => setDispatchType('FACTURABLE_CLIENTE')}
                    className="mt-0.5"
                  />
                  <div>
                    <span className="text-xs font-black text-blue-600 dark:text-blue-400 block">
                      📄 FACTURABLE (Venta a Cliente)
                    </span>
                    <span className="text-[11px] text-slate-600 dark:text-slate-400 block mt-0.5">
                      Crea la Factura Electrónica oficial e inserta la Factura como Hoja 2 en el PDF.
                    </span>
                  </div>
                </label>

                <label className={`flex items-start gap-3 p-3.5 rounded-2xl border-2 cursor-pointer transition select-none ${
                  dispatchType === 'TRASPASO_SUCURSAL'
                    ? 'border-emerald-600 bg-emerald-500/10 shadow-sm'
                    : `${themeClasses.border} hover:bg-slate-100 dark:hover:bg-slate-800/40`
                }`}>
                  <input
                    type="radio"
                    name="dispatchType"
                    value="TRASPASO_SUCURSAL"
                    checked={dispatchType === 'TRASPASO_SUCURSAL'}
                    onChange={() => setDispatchType('TRASPASO_SUCURSAL')}
                    className="mt-0.5"
                  />
                  <div>
                    <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 block">
                      🏢 NO FACTURABLE (Traspaso entre Sucursales)
                    </span>
                    <span className="text-[11px] text-slate-600 dark:text-slate-400 block mt-0.5">
                      Movimiento interno entre bodegas / sucursales sin emisión tributaria.
                    </span>
                  </div>
                </label>
              </div>

              {/* Extra branch or billing fields */}
              {dispatchType === 'TRASPASO_SUCURSAL' ? (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Sucursal de Destino *
                  </label>
                  <input
                    type="text"
                    required={dispatchType === 'TRASPASO_SUCURSAL'}
                    value={destinationBranch}
                    onChange={(e) => setDestinationBranch(e.target.value)}
                    placeholder="Ej: Sucursal Centro / Bodega Norte"
                    className={`w-full px-3 py-2 text-xs rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg}`}
                  />
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Razón Social Cliente / Empresa (Para Factura)
                    </label>
                    <input
                      type="text"
                      value={customerBusinessName}
                      onChange={(e) => setCustomerBusinessName(e.target.value)}
                      placeholder="Ej: Comercializadora Los Andes SpA"
                      className={`w-full px-3 py-2 text-xs rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg}`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Giro Comercial Cliente
                    </label>
                    <input
                      type="text"
                      value={customerActivity}
                      onChange={(e) => setCustomerActivity(e.target.value)}
                      placeholder="Ej: Venta de Abarrotes y Alimentos"
                      className={`w-full px-3 py-2 text-xs rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg}`}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* 2. DATOS DE CABECERA: FOLIO, EMPRESA, FECHA */}
            <div className={`grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-2xl ${themeClasses.cardSubtle} border ${themeClasses.border}`}>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Folio Entrega</label>
                <input
                  type="text"
                  readOnly
                  value={folio}
                  className={`w-full px-3 py-2 text-xs font-mono font-bold text-blue-600 dark:text-blue-400 bg-slate-100 dark:bg-slate-900/80 rounded-xl border ${themeClasses.border}`}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Empresa Emisora *</label>
                <select
                  value={companyId}
                  onChange={(e) => setCompanyId(e.target.value)}
                  className={`w-full px-3 py-2 text-xs font-bold rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg}`}
                >
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Fecha y Hora *</label>
                <input
                  type="datetime-local"
                  required
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  className={`w-full px-3 py-2 text-xs rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg}`}
                />
              </div>
            </div>

            {/* 3. DATOS DEL RECEPTOR Y MOTIVO DEL DESPACHO (SIN PATENTE) */}
            <div className={`p-3.5 rounded-2xl border ${themeClasses.border} ${themeClasses.cardSubtle} space-y-2.5`}>
              <h4 className="text-xs font-black text-slate-900 dark:text-slate-100">
                Datos del Receptor / Solicitante
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Nombre Completo del Receptor *
                  </label>
                  <input
                    type="text"
                    required
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder="Ej: Marcelo Rojas Carrizo"
                    className={`w-full px-3 py-2 text-xs rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg}`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    RUT / DNI (Opcional)
                  </label>
                  <input
                    type="text"
                    value={recipientRut}
                    onChange={(e) => setRecipientRut(formatRut(e.target.value))}
                    placeholder="16.489.120-3"
                    className={`w-full px-3 py-2 text-xs font-mono rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg}`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Teléfono Celular (Opcional)
                  </label>
                  <input
                    type="text"
                    value={recipientPhone}
                    onChange={(e) => setRecipientPhone(e.target.value)}
                    placeholder="+56 9 8452 1190"
                    className={`w-full px-3 py-2 text-xs font-mono rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg}`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Motivo del Despacho
                </label>
                <input
                  type="text"
                  value={worksiteOrReason}
                  onChange={(e) => setWorksiteOrReason(e.target.value)}
                  placeholder="Ej: Entrega de pedido a cliente / Despacho a domicilio / Reposición"
                  className={`w-full px-3 py-2 text-xs rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg}`}
                />
              </div>
            </div>

            {/* 4. AGREGAR ÍTEMS A ENTREGAR */}
            <div className={`p-3.5 rounded-2xl border ${themeClasses.border} ${themeClasses.cardSubtle} space-y-3 shadow-sm`}>
              <div className="flex items-center justify-between">
                <h4 className={`font-black text-xs ${themeClasses.accent} flex items-center gap-1.5`}>
                  <Plus className="w-4 h-4" />
                  <span>Agregar Ítems a Entregar</span>
                </h4>
                <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-full ${
                  items.length >= 20 ? 'bg-red-500/20 text-red-500' : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}>
                  {items.length} / 20 ítems
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                <div className="sm:col-span-3">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Código Barra / SKU</label>
                  <input
                    type="text"
                    value={itemCode}
                    onChange={(e) => setItemCode(e.target.value)}
                    placeholder="Ej: ACE-001"
                    className={`w-full px-3 py-2 text-xs font-mono rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg}`}
                  />
                </div>

                <div className="sm:col-span-6 relative">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Descripción del Ítem (Escriba para buscar) *</label>
                  <input
                    type="text"
                    value={itemName}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="Ej: Bebida 1.5L, Arroz 1kg, Aceite vegetal..."
                    className={`w-full px-3 py-2 text-xs rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg}`}
                  />
                  {suggestions.length > 0 && (
                    <div className={`absolute top-full left-0 right-0 z-20 mt-1 max-h-48 overflow-y-auto rounded-xl border ${themeClasses.border} ${themeClasses.card} shadow-xl`}>
                      {suggestions.map((sug, i) => (
                        <div
                          key={i}
                          onClick={() => handleSelectCatalogItem(sug)}
                          className="p-2.5 text-xs hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer border-b border-slate-200 dark:border-slate-800 last:border-0"
                        >
                          <p className="font-bold text-slate-900 dark:text-slate-100">{sug.name}</p>
                          <p className="text-[10px] text-slate-500 font-mono">Código: {sug.code} | Stock: {sug.stock}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="sm:col-span-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Cant. *</label>
                  <input
                    type="number"
                    min="1"
                    value={itemQuantity}
                    onChange={(e) => setItemQuantity(parseInt(e.target.value) || 1)}
                    className={`w-full px-2 py-2 text-xs font-mono font-bold rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg}`}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Valor Unit. ($)</label>
                  <input
                    type="number"
                    min="0"
                    value={itemPrice}
                    onChange={(e) => setItemPrice(e.target.value)}
                    placeholder="Ej: 2990"
                    className={`w-full px-2 py-2 text-xs font-mono font-bold rounded-xl border border-blue-400 ${themeClasses.inputBg}`}
                  />
                </div>

                <div className="sm:col-span-1">
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className={`w-full py-2 rounded-xl text-xs font-black text-white shadow ${themeClasses.accentBg} flex items-center justify-center`}
                    title="Añadir a la guía"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* 5. TABLA DE ÍTEMS EN LA GUÍA */}
            <div className="space-y-1.5">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Ítems en la Guía de Entrega ({items.length} de máx. 20)
              </span>
              <div className={`border ${themeClasses.border} rounded-2xl overflow-hidden ${themeClasses.card} shadow-sm`}>
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-900 font-bold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">CÓDIGO</th>
                      <th className="py-2.5 px-3">DESCRIPCIÓN</th>
                      <th className="py-2.5 px-3 text-center">CANTIDAD</th>
                      <th className="py-2.5 px-3 text-right">P. UNIT ($)</th>
                      <th className="py-2.5 px-3 text-right">TOTAL ($)</th>
                      <th className="py-2.5 px-3">MARCA</th>
                      <th className="py-2.5 px-3 text-right">QUITAR</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-slate-500 font-medium">
                          No hay ítems agregados a esta entrega.
                        </td>
                      </tr>
                    ) : (
                      items.map((it, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                          <td className="py-2.5 px-3 font-mono font-bold text-blue-600 dark:text-blue-400">{it.code}</td>
                          <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-slate-100">{it.name}</td>
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-900 dark:text-slate-100">{it.quantity} {it.unit}</td>
                          <td className="py-2.5 px-3 text-slate-500">{it.brand || '-'}</td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 dark:hover:bg-red-950/30"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 6. OBSERVACIONES */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Observaciones Generales de la Entrega:</label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ej: Despacho correspondiente al pedido N° 124..."
                className={`w-full px-3 py-2 text-xs rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg}`}
              />
            </div>

            {/* 7. TIMBRE Y FIRMA */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className={`p-3.5 rounded-2xl border border-blue-500/30 bg-blue-500/10 text-center space-y-1`}>
                <span className="text-xs font-black text-blue-600 dark:text-blue-400 block tracking-wide">
                  ✓ DESPACHO AUTORIZADO
                </span>
                <span className="text-[11px] text-slate-700 dark:text-slate-300 block font-mono font-bold">
                  Folio: {folio} | Encargado: Mauricio Chamorro
                </span>
              </div>

              <div className={`p-3 rounded-2xl border ${themeClasses.border} ${themeClasses.cardSubtle} flex items-center justify-between gap-3 shadow-sm`}>
                <div className="space-y-0.5">
                  <span className="text-xs font-black text-slate-900 dark:text-slate-100 block">
                    Firma del Receptor
                  </span>
                  <span className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">
                    {signatureData ? '✓ Firma registrada en pantalla' : 'Pendiente de firma en pantalla'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSignPadOpen(true)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl text-white shadow transition ${
                    signatureData
                      ? 'bg-emerald-600 hover:bg-emerald-500'
                      : `${themeClasses.accentBg} hover:opacity-90`
                  }`}
                >
                  <PenTool className="w-3.5 h-3.5" />
                  <span>{signatureData ? 'Cambiar Firma' : 'Firmar en Pantalla'}</span>
                </button>
              </div>
            </div>

            {/* 8. BOTONES DE ACCIÓN */}
            <div className="flex flex-wrap justify-between items-center gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              {items.length >= 20 ? (
                <button
                  type="button"
                  onClick={handleCreateLinkedGuide}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-black rounded-xl bg-purple-600 hover:bg-purple-700 text-white shadow-md transition"
                >
                  <LinkIcon className="w-4 h-4" />
                  <span>Guardar y Crear Siguiente Guía Vinculada</span>
                </button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition shadow-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={items.length === 0}
                  className={`flex items-center gap-2 px-6 py-2.5 text-xs font-black rounded-xl transition ${
                    items.length > 0
                      ? `${themeClasses.accentBg} text-white shadow-lg active:scale-95`
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed'
                  }`}
                >
                  <Truck className="w-4 h-4" />
                  <span>Generar Guía y Rebajar Stock</span>
                </button>
              </div>
            </div>
          </form>
        )}
      </div>

      {/* Signature Modal */}
      <SignaturePadModal
        isOpen={isSignPadOpen}
        onClose={() => setIsSignPadOpen(false)}
        onSave={(data) => setSignatureData(data)}
        title="Firma del Receptor de Mercadería"
        subtitle={`Receptor: ${recipientName || 'Solicitante'}`}
      />
    </div>
  );
};

