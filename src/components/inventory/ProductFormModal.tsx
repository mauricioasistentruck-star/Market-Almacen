import { getRubroPreset } from '../../utils/rubroPresets';
import { useBodyScrollLock } from '../../utils/scrollLock';
import React, { useState, useEffect, useRef } from 'react';
import type { Product, ItemCondition, ItemCompleteness } from '../../types';
import { useTheme } from '../../utils/themeContext';
import { useCompany } from '../../utils/companyContext';
import { useAuth } from '../../utils/authContext';
import { db } from '../../db/database';
import { generateProductBarcode } from '../../utils/barcodeGenerator';
import { triggerCloudSync, notifyLocalMutation } from '../../utils/cloudSync';
import {
  X,
  ScanLine,
  Sparkles,
  Save,
  Package,
  Camera,
  Trash2,
  Building2,
  DollarSign,
  Layers,
  MapPin,
  Tag,
  Calendar,
  AlertCircle
} from 'lucide-react';

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  productToEdit?: Product | null;
  onSaved: () => void;
  onOpenScanner?: () => void;
  initialBarcode?: string;
}

const CATEGORIES = [
  'Abarrotes',
  'Bebidas y Licores',
  'Lácteos y Fiambrería',
  'Limpieza y Aseo',
  'Carnes y Congelados',
  'Snacks y Golosinas',
  'Frutas y Verduras',
  'Panadería y Pastelería',
  'Cuidado Personal',
  'Ferretería y Hogar',
  'Insumos y Embalaje',
  'Otros'
];

const UNITS = [
  'Unidades',
  'Kg',
  'Gramos',
  'Litros',
  'Pack',
  'Caja',
  'Bolsa',
  'Botella',
  'Lata',
  'Metro'
];

export const ProductFormModal: React.FC<ProductFormModalProps> = ({
  isOpen,
  onClose,
  productToEdit,
  onSaved,
  onOpenScanner,
  initialBarcode
}) => {
  useBodyScrollLock(Boolean(isOpen));
  const { themeClasses } = useTheme();
  const { companies, selectedCompanyId, selectedCompany } = useCompany();
  const { isSuperAdmin, currentUser } = useAuth();



  // Estados del Formulario
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Abarrotes');
  const [brand, setBrand] = useState('');
  const [companyId, setCompanyId] = useState(() => 
    selectedCompanyId !== 'ALL' ? selectedCompanyId : (currentUser?.companyId || companies[0]?.id || '')
  );

  // Contexto dinámico de Rubro y Empresa activa
  const activeCompany = React.useMemo(() => {
    if (companyId && companyId !== 'ALL') {
      return companies.find(c => c.id === companyId) || selectedCompany;
    }
    return selectedCompany;
  }, [companyId, companies, selectedCompany]);

  const activeRubro = React.useMemo(() => {
    return getRubroPreset(activeCompany?.rubroKey);
  }, [activeCompany?.rubroKey]);

  const availableCategories = React.useMemo(() => {
    if (activeCompany?.customCategories && activeCompany.customCategories.length > 0) {
      return activeCompany.customCategories;
    }
    return activeRubro.categories;
  }, [activeCompany?.customCategories, activeRubro]);

  const availableUnits = React.useMemo(() => {
    if (activeCompany?.customUnits && activeCompany.customUnits.length > 0) {
      return activeCompany.customUnits;
    }
    return activeRubro.units;
  }, [activeCompany?.customUnits, activeRubro]);
  const [location, setLocation] = useState('');
  const [stock, setStock] = useState<number | string>('');
  const [minStock, setMinStock] = useState<number | string>(5);
  const [unit, setUnit] = useState('Unidades');
  const [costPrice, setCostPrice] = useState<number | string>('');
  const [lastPurchaseCost, setLastPurchaseCost] = useState<number | string>('');
  const [averageCost, setAverageCost] = useState<number | string>('');
  const [price, setPrice] = useState<number | string>('');
  const [expiryDate, setExpiryDate] = useState('');
  const [condition, setCondition] = useState<ItemCondition>('DISPONIBLE');
  const [completeness, setCompleteness] = useState<ItemCompleteness>('COMPLETO');
  const [conditionNotes, setConditionNotes] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (productToEdit) {
      setCode(productToEdit.code || '');
      setName(productToEdit.name || '');
      setCategory(productToEdit.category || 'Abarrotes');
      setBrand(productToEdit.brand || '');
      setCompanyId(productToEdit.companyId || selectedCompanyId || companies[0]?.id || '');
      setLocation(productToEdit.location || '');
      setStock(productToEdit.stock ?? '');
      setMinStock(productToEdit.minStock ?? 5);
      setUnit(productToEdit.unit || 'Unidades');
      setCostPrice(productToEdit.costPrice ?? '');
      setLastPurchaseCost(productToEdit.lastPurchaseCost ?? '');
      setAverageCost(productToEdit.averageCost ?? '');
      setPrice(productToEdit.price ?? '');
      setExpiryDate(productToEdit.expiryDate || '');
      setCondition(productToEdit.condition || 'DISPONIBLE');
      setCompleteness(productToEdit.completeness || 'COMPLETO');
      setConditionNotes(productToEdit.conditionNotes || '');
      setImageUrl(productToEdit.imageUrl || '');
    } else {
      // Modo Nuevo Producto
      setCode(initialBarcode || generateProductBarcode());
      setName('');
      setCategory(availableCategories[0] || 'General');
      setBrand('');
      setCompanyId(selectedCompanyId !== 'ALL' ? selectedCompanyId : (currentUser?.companyId || companies[0]?.id || ''));
      setLocation('');
      setStock('');
      setMinStock(5);
      setUnit('Unidades');
      setCostPrice('');
      setLastPurchaseCost('');
      setAverageCost('');
      setPrice('');
      setExpiryDate('');
      setCondition('DISPONIBLE');
      setCompleteness('COMPLETO');
      setConditionNotes('');
      setImageUrl('');
    }
  }, [productToEdit, isOpen, initialBarcode, selectedCompanyId, currentUser, companies]);

  const handleGenerateCode = () => {
    setCode(generateProductBarcode());
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setImageUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      alert('Por favor ingrese el Nombre del Producto.');
      return;
    }

    if (!code.trim()) {
      alert('Por favor ingrese o genere un Código de Barra.');
      return;
    }

    const now = new Date().toISOString();
    const finalStock = Number(stock) || 0;
    const finalMinStock = Number(minStock) || 0;
    const finalCostPrice = Number(costPrice) || 0;
    const finalLastPurchaseCost = lastPurchaseCost !== '' ? Number(lastPurchaseCost) : (finalCostPrice || undefined);
    const finalAverageCost = averageCost !== '' ? Number(averageCost) : (finalCostPrice || undefined);
    const finalPrice = Number(price) || 0;
    const targetComp = companyId || selectedCompanyId || companies[0]?.id || 'market-almacen';

    try {
      if (productToEdit && productToEdit.id) {
        // Actualizar
        const updatedProduct: Product = {
          ...productToEdit,
          code: code.trim(),
          name: name.trim(),
          category,
          brand: brand.trim(),
          companyId: targetComp,
          location: location.trim(),
          stock: finalStock,
          minStock: finalMinStock,
          unit,
          costPrice: finalCostPrice,
          lastPurchaseCost: finalLastPurchaseCost,
          averageCost: finalAverageCost,
          price: finalPrice,
          expiryDate: expiryDate || undefined,
          condition,
          completeness,
          conditionNotes: conditionNotes.trim() || undefined,
          imageUrl: imageUrl || undefined,
          updatedAt: now
        };

        await db.products.put(updatedProduct);
      } else {
        // Crear nuevo
        const newProduct: Product = {
          code: code.trim(),
          name: name.trim(),
          category,
          brand: brand.trim(),
          companyId: targetComp,
          location: location.trim(),
          stock: finalStock,
          minStock: finalMinStock,
          unit,
          costPrice: finalCostPrice,
          lastPurchaseCost: finalLastPurchaseCost,
          averageCost: finalAverageCost,
          price: finalPrice,
          expiryDate: expiryDate || undefined,
          condition,
          completeness,
          conditionNotes: conditionNotes.trim() || undefined,
          imageUrl: imageUrl || undefined,
          createdAt: now,
          updatedAt: now
        };

        await db.products.add(newProduct);
      }

      notifyLocalMutation();
      triggerCloudSync();
      onSaved();
      onClose();
    } catch (err: any) {
      console.error('Error al guardar producto:', err);
      alert('Ocurrió un error al guardar el producto: ' + (err?.message || ''));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className={`w-full max-w-4xl max-h-[92vh] rounded-3xl border ${themeClasses.border} ${themeClasses.card} shadow-2xl flex flex-col overflow-hidden animate-scaleIn`}>
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-md ${themeClasses.accentBg}`}>
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100">
                {productToEdit ? 'Editar Producto en Catálogo' : 'Registrar Nuevo Producto en Bodega'}
              </h3>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                Control de Stock, Precios, Código de Barra y Categoría
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body Scrollable */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-4 sm:p-6 space-y-5 flex-1 custom-scrollbar">
          
          {/* 1. Fotografía y Cámara */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center gap-4">
            <div className="relative group w-24 h-24 rounded-2xl overflow-hidden bg-white dark:bg-slate-950 border-2 border-slate-300 dark:border-slate-700 shrink-0 flex items-center justify-center shadow-inner">
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt={name || 'Foto'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Camera className="w-8 h-8 text-slate-400" />
              )}
            </div>

            <div className="space-y-1.5 text-center sm:text-left flex-1">
              <span className="text-xs font-black text-slate-900 dark:text-slate-100 block">
                Fotografía del Producto
              </span>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                Tome una fotografía con la cámara o seleccione una imagen desde su galería o archivo.
              </p>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  capture="environment"
                  onChange={handleImageFileChange}
                  className="hidden"
                />
                <input
                  type="file"
                  id="gallery-input-product"
                  accept="image/*"
                  onChange={handleImageFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-black rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 transition cursor-pointer"
                >
                  <Camera className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>Cámara</span>
                </button>
                <button
                  type="button"
                  onClick={() => document.getElementById('gallery-input-product')?.click()}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-black rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 transition cursor-pointer"
                >
                  <span>📁 Galería</span>
                </button>
                {imageUrl && (
                  <button
                    type="button"
                    onClick={() => setImageUrl('')}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-black rounded-xl text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Quitar</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 2. Nombre del Producto & Código de Barras */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Nombre del Producto (Colspan 2) */}
            <div className="md:col-span-2">
              <label className="block text-xs font-black text-slate-800 dark:text-slate-200 mb-1.5">
                Nombre del Producto / Descripción Comercial *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Aceite de Oliva Extra Virgen 1L / Filtro Aceite W712"
                className={`w-full px-3.5 py-2.5 text-sm font-black rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-slate-900 dark:text-slate-100 placeholder:text-slate-400 shadow-sm`}
              />
            </div>

            {/* Código de Barra / SKU */}
            <div>
              <label className="block text-xs font-black text-slate-800 dark:text-slate-200 mb-1.5">
                Código de Barra / SKU *
              </label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Ej: 7801610001523"
                  className={`flex-1 min-w-0 px-3 py-2 text-xs font-mono font-black rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-slate-900 dark:text-slate-100 shadow-sm`}
                />
                <button
                  type="button"
                  onClick={handleGenerateCode}
                  className="px-2.5 py-2 text-xs font-black rounded-xl bg-orange-50 hover:bg-orange-100 dark:bg-orange-950/50 text-orange-700 dark:text-orange-300 border border-orange-300 dark:border-orange-700 transition flex items-center gap-1 shrink-0 cursor-pointer"
                  title="Generar código aleatorio"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Auto</span>
                </button>
                {onOpenScanner && (
                  <button
                    type="button"
                    onClick={onOpenScanner}
                    className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 transition shrink-0 cursor-pointer"
                    title="Escanear con cámara"
                  >
                    <ScanLine className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

          </div>

          {/* 3. Categoría, Marca y Empresa */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            
            {/* Categoría */}
            <div>
              <label className="block text-xs font-black text-slate-800 dark:text-slate-200 mb-1.5">
                Categoría *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className={`w-full px-3 py-2 text-xs font-black rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-slate-900 dark:text-slate-100`}
              >
                {availableCategories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Marca */}
            <div>
              <label className="block text-xs font-black text-slate-800 dark:text-slate-200 mb-1.5">
                Marca / Fabricante
              </label>
              <input
                type="text"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="Ej: Nestlé, Bosch, Coca-Cola..."
                className={`w-full px-3 py-2 text-xs font-bold rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-slate-900 dark:text-slate-100`}
              />
            </div>

            {/* Empresa Asignada */}
            <div>
              <label className="block text-xs font-black text-slate-800 dark:text-slate-200 mb-1.5">
                Empresa Propietaria *
              </label>
              {isSuperAdmin ? (
                <select
                  value={companyId}
                  onChange={(e) => setCompanyId(e.target.value)}
                  className={`w-full px-3 py-2 text-xs font-black rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-slate-900 dark:text-slate-100`}
                >
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>{c.tradeName || c.name}</option>
                  ))}
                </select>
              ) : (
                <div className="px-3 py-2 text-xs font-black rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 truncate">
                  {companies.find(c => c.id === companyId)?.name || 'Mi Empresa'}
                </div>
              )}
            </div>

          </div>

          {/* 4. Cantidad / Stock y Precios */}
          <div className="p-4 rounded-2xl border border-blue-200/80 dark:border-blue-900/50 bg-blue-50/40 dark:bg-blue-950/20 space-y-3">
            <div className="text-xs font-black uppercase text-blue-700 dark:text-blue-400 tracking-wider flex items-center gap-1.5">
              <DollarSign className="w-4 h-4" />
              <span>Control de Inventario y Precios</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              
              {/* Stock Inicial / Cantidad */}
              <div>
                <label className="block text-xs font-black text-slate-800 dark:text-slate-200 mb-1">
                  Cantidad en Stock *
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  placeholder="0"
                  className={`w-full px-3 py-2 text-sm font-black rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-slate-900 dark:text-slate-100`}
                />
              </div>

              {/* Unidad de Medida */}
              <div>
                <label className="block text-xs font-black text-slate-800 dark:text-slate-200 mb-1">
                  Unidad de Medida
                </label>
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className={`w-full px-3 py-2 text-xs font-bold rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-slate-900 dark:text-slate-100`}
                >
                  {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>

                            {/* Precio Costo Neto */}
              <div>
                <label className="block text-xs font-black text-slate-800 dark:text-slate-200 mb-1">
                  Precio Costo ($ CLP)
                </label>
                <input
                  type="number"
                  min="0"
                  value={costPrice}
                  onChange={(e) => setCostPrice(e.target.value)}
                  placeholder="Ej: 2500"
                  className={`w-full px-3 py-2 text-sm font-mono font-bold rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-slate-900 dark:text-slate-100`}
                />
              </div>

              {/* Costo de Última Compra */}
              <div>
                <label className="block text-xs font-black text-slate-800 dark:text-slate-200 mb-1">
                  Costo Última Compra ($ CLP)
                </label>
                <input
                  type="number"
                  min="0"
                  value={lastPurchaseCost}
                  onChange={(e) => setLastPurchaseCost(e.target.value)}
                  placeholder="Ej: 2450"
                  className={`w-full px-3 py-2 text-sm font-mono font-bold rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-slate-900 dark:text-slate-100`}
                />
              </div>

              {/* Costo Promedio PMP */}
              <div>
                <label className="block text-xs font-black text-slate-800 dark:text-slate-200 mb-1">
                  Costo Promedio ($ CLP)
                </label>
                <input
                  type="number"
                  min="0"
                  value={averageCost}
                  onChange={(e) => setAverageCost(e.target.value)}
                  placeholder="Ej: 2480"
                  className={`w-full px-3 py-2 text-sm font-mono font-bold rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-slate-900 dark:text-slate-100`}
                />
              </div>

              {/* Precio Venta al Público */}
              <div>
                <label className="block text-xs font-black text-slate-800 dark:text-slate-200 mb-1">
                  Precio Venta ($ CLP) *
                </label>
                <input
                  type="number"
                  min="0"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="Ej: 3990"
                  className={`w-full px-3 py-2 text-sm font-mono font-black rounded-xl border border-emerald-400 dark:border-emerald-600 bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 shadow-sm`}
                />
              </div>

            </div>

            {/* Fila secundaria de inventario: Stock Mínimo y Ubicación */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div>
                <label className="block text-xs font-black text-slate-800 dark:text-slate-200 mb-1">
                  Stock Mínimo de Alerta
                </label>
                <input
                  type="number"
                  min="0"
                  value={minStock}
                  onChange={(e) => setMinStock(e.target.value)}
                  placeholder="5"
                  className={`w-full px-3 py-2 text-xs font-bold rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-slate-900 dark:text-slate-100`}
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-800 dark:text-slate-200 mb-1">
                  Ubicación en Bodega / Pasillo
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Ej: Pasillo 3, Estante B"
                  className={`w-full px-3 py-2 text-xs font-bold rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-slate-900 dark:text-slate-100`}
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-800 dark:text-slate-200 mb-1">
                  Fecha de Vencimiento (Opcional)
                </label>
                <input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className={`w-full px-3 py-2 text-xs font-bold rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-slate-900 dark:text-slate-100`}
                />
              </div>
            </div>

          </div>

          {/* 5. Estado Comercial e Integridad */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-black text-slate-800 dark:text-slate-200 mb-1.5">
                Estado / Condición Comercial *
              </label>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value as ItemCondition)}
                className={`w-full px-3 py-2 text-xs font-black rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-slate-900 dark:text-slate-100`}
              >
                <option value="DISPONIBLE">🟢 Disponible para Venta (Normal)</option>
                <option value="OFERTA">🏷️ En Oferta / Promoción Especial</option>
                <option value="LIQUIDACION">⚡ En Liquidación</option>
                <option value="POR_VENCER">⏳ Próximo a Vencer (Rebaja)</option>
                <option value="AGOTADO">📦 Agotado / Sin Stock</option>
                <option value="DANADO">⚠️ Dañado / Merma (No vender)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-black text-slate-800 dark:text-slate-200 mb-1.5">
                Integridad del Ítem *
              </label>
              <select
                value={completeness}
                onChange={(e) => setCompleteness(e.target.value as ItemCompleteness)}
                className={`w-full px-3 py-2 text-xs font-black rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-slate-900 dark:text-slate-100`}
              >
                <option value="COMPLETO">COMPLETO (Sellado y Nuevo)</option>
                <option value="INCOMPLETO">INCOMPLETO (Faltan piezas o accesorios)</option>
              </select>
            </div>
          </div>

          {/* Observaciones */}
          <div>
            <label className="block text-xs font-black text-slate-800 dark:text-slate-200 mb-1.5">
              Detalle de Condición / Observaciones (Opcional):
            </label>
            <input
              type="text"
              value={conditionNotes}
              onChange={(e) => setConditionNotes(e.target.value)}
              placeholder="Ej: Embalaje sellado de fábrica, lote 2026..."
              className={`w-full px-3.5 py-2 text-xs rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-slate-900 dark:text-slate-100`}
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-xs font-black rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className={`flex items-center gap-2 px-6 py-2.5 text-xs font-black rounded-xl ${themeClasses.accentBg} text-white shadow-lg shadow-blue-500/25 transition cursor-pointer active:scale-95`}
            >
              <Save className="w-4 h-4 stroke-[2.5]" />
              <span>{productToEdit ? 'Actualizar Producto' : 'Guardar Producto'}</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
