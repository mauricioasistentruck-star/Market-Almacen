import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../db/database';
import { useTheme } from '../../utils/themeContext';
import { useCompany } from '../../utils/companyContext';
import { useAuth } from '../../utils/authContext';
import type { Product } from '../../types';
import { formatCLP } from '../../utils/salesPdfGenerator';
import confetti from 'canvas-confetti';
import {
  Package,
  Plus,
  Minus,
  Trash2,
  X,
  Check,
  Search,
  Sparkles,
  AlertTriangle,
  Barcode,
  Layers,
  Tag,
  ArrowRight,
  TrendingDown
} from 'lucide-react';

interface PackItemSelection {
  product: Product;
  quantityPerPack: number;
}

interface PackGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPackCreated?: (newPack: Product) => void;
  initialProduct?: Product | null;
}

export const PackGeneratorModal: React.FC<PackGeneratorModalProps> = ({
  isOpen,
  onClose,
  onPackCreated,
  initialProduct
}) => {
  const { themeClasses } = useTheme();
  const { selectedCompanyId } = useCompany();
  const { currentUser } = useAuth();

  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [packItems, setPackItems] = useState<PackItemSelection[]>([]);
  const [searchProductTerm, setSearchProductTerm] = useState('');
  
  // Datos del nuevo Pack
  const [packName, setPackName] = useState('');
  const [packCode, setPackCode] = useState('');
  const [packPrice, setPackPrice] = useState<number | string>('');
  const [packDescription, setPackDescription] = useState('');
  const [packsToBuild, setPacksToBuild] = useState<number>(1);

  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Cargar productos de la base de datos
  useEffect(() => {
    if (!isOpen) return;
    const load = async () => {
      try {
        const prods = await db.products.toArray();
        // Filtrar productos con stock > 0
        setAllProducts(prods.filter(p => (p.stock || 0) > 0));
      } catch (err) {
        console.error('Error cargando productos:', err);
      }
    };
    load();
  }, [isOpen]);

  // Inicializar con producto inicial si se abrió desde Liquidación
  useEffect(() => {
    if (!isOpen) return;
    if (initialProduct && (initialProduct.stock || 0) > 0) {
      setPackItems([
        { product: initialProduct, quantityPerPack: 1 }
      ]);
      setPackName(`Pack Promocional: ${initialProduct.name}`);
      setPackCode(`PACK-${Math.floor(100000 + Math.random() * 900000)}`);
      setPackPrice(initialProduct.price || 0);
    } else {
      setPackItems([]);
      setPackName('');
      setPackCode(`PACK-${Math.floor(100000 + Math.random() * 900000)}`);
      setPackPrice('');
    }
    setPacksToBuild(1);
    setErrorMessage('');
  }, [isOpen, initialProduct]);

  // Cálculo de Máximo de Packs posibles según el stock de cada producto
  const maxPossiblePacks = useMemo(() => {
    if (packItems.length === 0) return 0;
    const limits = packItems.map(it => {
      const currentStock = it.product.stock || 0;
      if (it.quantityPerPack <= 0) return 0;
      return Math.floor(currentStock / it.quantityPerPack);
    });
    return Math.min(...limits);
  }, [packItems]);

  // Ajustar cantidad de packs a generar si supera el máximo
  useEffect(() => {
    if (maxPossiblePacks > 0 && packsToBuild > maxPossiblePacks) {
      setPacksToBuild(maxPossiblePacks);
    }
  }, [maxPossiblePacks, packsToBuild]);

  // Sumas de precios y costos individuales
  const originalTotalPrice = useMemo(() => {
    return packItems.reduce((acc, it) => acc + (it.product.price || 0) * it.quantityPerPack, 0);
  }, [packItems]);

  const totalCostPrice = useMemo(() => {
    return packItems.reduce((acc, it) => acc + (it.product.costPrice || 0) * it.quantityPerPack, 0);
  }, [packItems]);

  const numPackPrice = Number(packPrice) || 0;
  const customerSaving = Math.max(0, originalTotalPrice - numPackPrice);

  // Auto-sugerir nombre cuando cambian los productos si el usuario no ha puesto un nombre manual
  const handleAddProduct = (prod: Product) => {
    if (packItems.some(it => it.product.id === prod.id)) {
      alert('Este producto ya está incluido en el pack. Puedes aumentar su cantidad por pack.');
      return;
    }
    const newItems = [...packItems, { product: prod, quantityPerPack: 1 }];
    setPackItems(newItems);
    setSearchProductTerm('');

    // Actualizar nombre y precio sugerido si está vacío
    if (!packName || packName.startsWith('Pack Promocional:')) {
      const names = newItems.map(it => `${it.quantityPerPack > 1 ? it.quantityPerPack + 'x ' : ''}${it.product.name}`);
      setPackName(`Pack Promo: ${names.join(' + ')}`);
    }

    const newOriginalTotal = newItems.reduce((acc, it) => acc + (it.product.price || 0) * it.quantityPerPack, 0);
    if (!packPrice || numPackPrice === originalTotalPrice) {
      // Sugerir un precio con pequeño descuento
      const suggested = Math.round((newOriginalTotal * 0.9) / 10) * 10;
      setPackPrice(suggested);
    }
  };

  const handleUpdateItemQuantity = (productId: number, qty: number) => {
    if (qty <= 0) return;
    setPackItems(prev =>
      prev.map(it => (it.product.id === productId ? { ...it, quantityPerPack: qty } : it))
    );
  };

  const handleRemoveItem = (productId: number) => {
    setPackItems(prev => prev.filter(it => it.product.id !== productId));
  };

  // Productos disponibles para agregar
  const searchResults = useMemo(() => {
    if (!searchProductTerm.trim()) return [];
    const q = searchProductTerm.toLowerCase().trim();
    return allProducts
      .filter(p => !packItems.some(it => it.product.id === p.id))
      .filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        (p.brand && p.brand.toLowerCase().includes(q))
      )
      .slice(0, 6);
  }, [allProducts, packItems, searchProductTerm]);

  // Procesar Creación y Armado del Pack (con descuento estricto de inventario)
  const handleCreatePack = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!packName.trim()) {
      setErrorMessage('Por favor ingrese un nombre para el Pack o Promoción.');
      return;
    }

    if (!packCode.trim()) {
      setErrorMessage('Por favor asigne un código de barras o SKU para el nuevo Pack.');
      return;
    }

    if (packItems.length < 2) {
      setErrorMessage('Un pack debe incluir al menos 2 productos para armar una promoción combinada.');
      return;
    }

    if (maxPossiblePacks <= 0) {
      setErrorMessage('No hay stock suficiente en los productos seleccionados para armar al menos 1 pack.');
      return;
    }

    if (packsToBuild <= 0 || packsToBuild > maxPossiblePacks) {
      setErrorMessage(`La cantidad de packs a generar debe ser entre 1 y ${maxPossiblePacks}.`);
      return;
    }

    if (numPackPrice <= 0) {
      setErrorMessage('El precio de venta del pack debe ser mayor a 0.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage('');

    try {
      // 1. Verificar que el código no esté en uso por otro producto existente
      const existingProd = await db.products.where('code').equals(packCode.trim()).first();
      if (existingProd) {
        setErrorMessage(`El código "${packCode.trim()}" ya está registrado en el producto "${existingProd.name}". Usa un código diferente.`);
        setIsProcessing(false);
        return;
      }

      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];

      // 2. DESCONTAR DEL SISTEMA LOS PRODUCTOS SELECCIONADOS (Mantener inventario general)
      for (const item of packItems) {
        const totalToDeduct = item.quantityPerPack * packsToBuild;
        const currentProd = await db.products.get(item.product.id!);
        if (currentProd) {
          const prevStock = currentProd.stock || 0;
          const newStock = Math.max(0, prevStock - totalToDeduct);

          // Actualizar stock del producto componente
          await db.products.update(currentProd.id!, {
            stock: newStock,
            updatedAt: now.toISOString()
          });

          // Registrar movimiento de SALIDA por armado de pack
          await db.productMovements.add({
            productId: currentProd.id!,
            productCode: currentProd.code,
            productName: currentProd.name,
            type: 'SALIDA',
            quantity: totalToDeduct,
            previousStock: prevStock,
            newStock: newStock,
            reason: `Armado de Pack / Promoción: ${packName.trim()} (${packsToBuild} unidades de pack)`,
            referenceDoc: packCode.trim(),
            workerOrSupplier: 'Transformación Interna a Pack',
            user: currentUser?.name || 'Administrador',
            date: dateStr,
            responsibleName: currentUser?.name || 'Administrador',
            companyId: selectedCompanyId
          });
        }
      }

      // 3. CREAR EL NUEVO PRODUCTO PACK CON SU CÓDIGO DIFERENTE Y CATEGORÍA DE PACKS
      const componentsDescription = packItems
        .map(it => `${it.quantityPerPack}x ${it.product.name}`)
        .join(' + ');

      const newPackProduct: Product = {
        companyId: selectedCompanyId || 'ALL',
        code: packCode.trim(),
        name: packName.trim(),
        category: 'Packs y Promociones',
        location: 'Bodega Principal',
        completeness: 'COMPLETO',
        brand: 'Promoción Especial',
        stock: packsToBuild,
        minStock: 2,
        unit: 'Pack',
        isBulk: false,
        isWeighable: false,
        condition: 'OFERTA',
        offerLabel: 'Pack Promocional',
        price: numPackPrice,
        costPrice: totalCostPrice,
        conditionNotes: packDescription.trim() || `Contenido del Pack: ${componentsDescription}`,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
      };

      const newPackId = await db.products.add(newPackProduct as any);
      newPackProduct.id = newPackId;

      // 4. REGISTRAR MOVIMIENTO DE ENTRADA DEL NUEVO PACK GENERADO
      await db.productMovements.add({
        productId: newPackId,
        productCode: newPackProduct.code,
        productName: newPackProduct.name,
        type: 'ENTRADA',
        quantity: packsToBuild,
        previousStock: 0,
        newStock: packsToBuild,
        reason: `Creación y armado de Pack Promocional (${componentsDescription})`,
        referenceDoc: packCode.trim(),
        workerOrSupplier: 'Armado Interno de Pack',
        user: currentUser?.name || 'Administrador',
        date: dateStr,
        responsibleName: currentUser?.name || 'Administrador',
        companyId: selectedCompanyId
      });

      // 5. Efecto de Éxito
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });
      } catch (e) {}

      setIsProcessing(false);
      if (onPackCreated) onPackCreated(newPackProduct);
      alert(`✓ ¡Pack "${packName.trim()}" creado con éxito!\n\nSe descontaron las unidades de inventario de cada producto y se ingresaron ${packsToBuild} packs a la categoría "Packs y Promociones".`);
      onClose();
    } catch (err: any) {
      console.error('Error al generar el pack:', err);
      setErrorMessage(err.message || 'Error al procesar la creación del pack');
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-2xl lg:max-w-3xl bg-white dark:bg-slate-900 border-2 border-amber-500 rounded-3xl shadow-2xl overflow-hidden animate-scaleIn flex flex-col max-h-[92vh]">
        
        {/* Encabezado */}
        <div className="px-5 py-3.5 bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white flex items-center justify-between border-b border-amber-700/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-white/20 text-white backdrop-blur-xs shadow-xs">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-white leading-tight flex items-center gap-1.5">
                <span>Generar Pack de Productos y Promociones</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/20 font-mono">Inventario Dinámico</span>
              </h3>
              <p className="text-[11px] text-amber-100">
                Suma productos existentes, calcula el stock disponible y crea un pack con código propio
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-black/20 hover:bg-black/30 text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Cuerpo del formulario con Scroll */}
        <form onSubmit={handleCreatePack} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs custom-scrollbar">
          
          {/* Banner Explicativo */}
          <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-950 dark:text-amber-200 flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="text-[11px] space-y-0.5">
              <p className="font-bold">
                Los productos que agregues al pack se descontarán automáticamente del stock del sistema al confirmar.
              </p>
              <p className="text-amber-700 dark:text-amber-300">
                El nuevo pack aparecerá en el menú lateral de <strong>Packs y Promociones</strong> listo para venderse.
              </p>
            </div>
          </div>

          {/* 1. SECCIÓN: PRODUCTOS QUE COMPONEN EL PACK */}
          <div className="space-y-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black uppercase text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-amber-600" />
                <span>1. Productos a Sumar en el Pack ({packItems.length})</span>
              </label>
              {maxPossiblePacks > 0 ? (
                <span className="text-[11px] font-black px-2 py-0.5 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300">
                  Stock permite armar hasta: {maxPossiblePacks} packs
                </span>
              ) : (
                <span className="text-[11px] font-black px-2 py-0.5 rounded-lg bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 border border-red-300">
                  Sin stock suficiente para armar packs
                </span>
              )}
            </div>

            {/* Buscador de Productos para Añadir */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchProductTerm}
                onChange={(e) => setSearchProductTerm(e.target.value)}
                placeholder="Buscar y sumar producto al pack (nombre, código o marca)..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />

              {/* Menú de Resultados de Búsqueda */}
              {searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-white dark:bg-slate-800 border-2 border-amber-400 rounded-xl shadow-xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-700">
                  {searchResults.map((prod) => (
                    <button
                      key={prod.id}
                      type="button"
                      onClick={() => handleAddProduct(prod)}
                      className="w-full text-left p-2.5 hover:bg-amber-50 dark:hover:bg-slate-700 transition flex items-center justify-between cursor-pointer"
                    >
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white text-xs">{prod.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {prod.code} • Stock: <strong className="text-emerald-600">{prod.stock} {prod.unit || 'UN'}</strong>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-xs text-slate-800 dark:text-slate-200">
                          {formatCLP(prod.price || 0)}
                        </span>
                        <span className="p-1 rounded-lg bg-amber-500 text-white">
                          <Plus className="w-3.5 h-3.5" />
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Lista de Productos Seleccionados */}
            {packItems.length === 0 ? (
              <div className="p-4 text-center text-slate-400 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl">
                Busca y selecciona los productos que formarán este pack (mínimo 2 productos).
              </div>
            ) : (
              <div className="space-y-2">
                {packItems.map((item) => {
                  const maxForThisItem = Math.floor((item.product.stock || 0) / item.quantityPerPack);
                  const isLimitingItem = maxForThisItem === maxPossiblePacks;

                  return (
                    <div
                      key={item.product.id}
                      className={`p-2.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition ${
                        isLimitingItem
                          ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-slate-900 dark:text-white truncate text-xs">
                          {item.product.name}
                        </div>
                        <div className="text-[10px] text-slate-500 flex items-center gap-2">
                          <span>Stock bodega: <strong className="text-slate-800 dark:text-slate-200">{item.product.stock} {item.product.unit || 'UN'}</strong></span>
                          <span>•</span>
                          <span>Precio individual: {formatCLP(item.product.price || 0)}</span>
                          {isLimitingItem && (
                            <span className="text-amber-700 dark:text-amber-400 font-bold">
                              (Limita a {maxForThisItem} packs)
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Control de Cantidad por Pack */}
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Por pack:</span>
                          <div className="flex items-center border border-slate-300 dark:border-slate-600 rounded-lg overflow-hidden bg-white dark:bg-slate-900">
                            <button
                              type="button"
                              onClick={() => handleUpdateItemQuantity(item.product.id!, Math.max(1, item.quantityPerPack - 1))}
                              className="px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <input
                              type="number"
                              min="1"
                              value={item.quantityPerPack}
                              onChange={(e) => handleUpdateItemQuantity(item.product.id!, Number(e.target.value) || 1)}
                              className="w-10 text-center font-mono font-bold text-xs bg-transparent border-none focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => handleUpdateItemQuantity(item.product.id!, item.quantityPerPack + 1)}
                              className="px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        <div className="font-mono font-bold text-xs text-right min-w-[70px]">
                          {formatCLP((item.product.price || 0) * item.quantityPerPack)}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.product.id!)}
                          className="p-1 text-slate-400 hover:text-red-600 transition cursor-pointer"
                          title="Quitar producto del pack"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 2. SECCIÓN: IDENTIFICACIÓN DEL NUEVO PACK (CÓDIGO DIFERENTE Y NOMBRE) */}
          <div className="space-y-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
            <label className="text-xs font-black uppercase text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Barcode className="w-4 h-4 text-purple-600" />
              <span>2. Datos del Nuevo Producto Pack</span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Nombre del Pack o Promoción *
                </label>
                <input
                  type="text"
                  required
                  value={packName}
                  onChange={(e) => setPackName(e.target.value)}
                  placeholder="Ej: Pack Piscola: Pisco + Coca-Cola 1.5L"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Código de Barras / SKU Diferente *
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    required
                    value={packCode}
                    onChange={(e) => setPackCode(e.target.value)}
                    placeholder="PACK-00123"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono font-bold text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setPackCode(`PACK-${Math.floor(100000 + Math.random() * 900000)}`)}
                    className="px-2.5 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-700 dark:text-slate-200 text-xs font-bold shrink-0"
                    title="Generar código aleatorio"
                  >
                    Nuevo
                  </button>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                Descripción / Detalle de la Promoción (Opcional):
              </label>
              <input
                type="text"
                value={packDescription}
                onChange={(e) => setPackDescription(e.target.value)}
                placeholder="Ej: Promoción de fin de semana, incluye 2 cervezas + snack"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
              />
            </div>
          </div>

          {/* 3. SECCIÓN: CANTIDAD DE PACKS A ARMAR Y PRECIO PROMOCIONAL */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-800">
            
            {/* Cantidad de packs a armar */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-black text-amber-950 dark:text-amber-200">
                  Cantidad de Packs a Armar *
                </label>
                <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400">
                  (Disponibles: {maxPossiblePacks})
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max={maxPossiblePacks || 1}
                  value={packsToBuild}
                  onChange={(e) => setPacksToBuild(Number(e.target.value) || 1)}
                  disabled={maxPossiblePacks <= 0}
                  className="w-full px-3 py-2 rounded-xl border border-amber-400 bg-white dark:bg-slate-800 font-mono font-black text-base text-right text-slate-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => setPacksToBuild(maxPossiblePacks)}
                  disabled={maxPossiblePacks <= 0}
                  className="px-2.5 py-2 rounded-xl bg-amber-200 hover:bg-amber-300 text-amber-900 font-black text-[11px] shrink-0"
                >
                  Máximo
                </button>
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                Se restará esta cantidad proporcional de cada producto individual.
              </p>
            </div>

            {/* Precio de venta del Pack */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-black text-amber-950 dark:text-amber-200">
                  Precio de Venta del Pack ($) *
                </label>
                {originalTotalPrice > 0 && (
                  <span className="text-[10px] text-slate-500 line-through">
                    Suma: {formatCLP(originalTotalPrice)}
                  </span>
                )}
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono font-bold text-emerald-600 text-base">$</span>
                <input
                  type="number"
                  required
                  value={packPrice}
                  onChange={(e) => setPackPrice(e.target.value)}
                  placeholder="0"
                  className="w-full pl-8 pr-3 py-2 rounded-xl border border-emerald-500 bg-white dark:bg-slate-800 font-mono font-black text-base text-right text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-400 focus:outline-none"
                />
              </div>
              {customerSaving > 0 && (
                <div className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 mt-1 flex items-center gap-1">
                  <TrendingDown className="w-3.5 h-3.5" />
                  <span>Ahorro cliente: {formatCLP(customerSaving)} ({Math.round((customerSaving / originalTotalPrice) * 100)}% dcto)</span>
                </div>
              )}
            </div>

          </div>

          {/* Aviso de Error */}
          {errorMessage && (
            <div className="p-2.5 rounded-xl bg-red-100 dark:bg-red-950/60 border border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 text-xs font-bold text-center">
              {errorMessage}
            </div>
          )}

          {/* Botones de Acción */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="px-4 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold transition cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={isProcessing || packItems.length < 2 || maxPossiblePacks <= 0 || packsToBuild <= 0}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black shadow-lg transition active:scale-95 flex items-center gap-2 cursor-pointer"
            >
              <Package className="w-4 h-4" />
              <span>
                {isProcessing
                  ? 'Armando Pack y Descontando Stock...'
                  : `Crear y Armar ${packsToBuild} ${packsToBuild === 1 ? 'Pack' : 'Packs'}`}
              </span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
