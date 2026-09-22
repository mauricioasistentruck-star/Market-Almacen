import { useBodyScrollLock } from '../../utils/scrollLock';
import React, { useState, useEffect, useMemo } from 'react';
import { useTheme } from '../../utils/themeContext';
import { useCompany } from '../../utils/companyContext';
import { db } from '../../db/database';
import { formatCLP } from '../../utils/salesPdfGenerator';
import { getWeighableCategoriesForRubro, type RubroWeighableCategory } from '../../utils/rubroPresets';
import type { Product, SaleItem } from '../../types';
import {
  X,
  Scale,
  ShoppingCart,
  Boxes,
  Check,
  RotateCcw
} from 'lucide-react';

interface WeighableProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddToCart: (item: SaleItem) => void;
  selectedProduct?: Product | null;
  activeDepartmentKey?: string;
}

export const WeighableProductModal: React.FC<WeighableProductModalProps> = ({
  isOpen,
  onClose,
  onAddToCart,
  selectedProduct: propSelectedProduct,
  activeDepartmentKey
}) => {
  useBodyScrollLock(Boolean(isOpen));
  const { themeClasses } = useTheme();
  const { selectedCompanyId, selectedCompany } = useCompany();

  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [selectedStockProduct, setSelectedStockProduct] = useState<Product | null>(null);

  const [productName, setProductName] = useState('');
  const [pricePerKg, setPricePerKg] = useState<number | string>(1990);
  const [weightKg, setWeightKg] = useState<number | string>('');
  const [weightGrams, setWeightGrams] = useState<number | string>('');
  const [unit, setUnit] = useState('Kg');

  // Cargar productos en inventario de la empresa actual
  useEffect(() => {
    if (!isOpen) return;
    const loadStock = async () => {
      const prods = await db.products.toArray();
      const filtered = prods.filter(p => {
        if (selectedCompanyId === 'ALL') return true;
        return !p.companyId || p.companyId === selectedCompanyId;
      });
      setAllProducts(filtered);
    };
    loadStock();
  }, [isOpen, selectedCompanyId]);

  // Lista de departamentos pesables del rubro actual (Almacén, Panadería, Ferretería, Mascotas, etc.)
  const weighableTabs = useMemo(() => {
    return getWeighableCategoriesForRubro(selectedCompany?.rubroKey);
  }, [selectedCompany?.rubroKey]);

  // Detectar el departamento exacto al que pertenece el producto o la vista actual
  const currentDepartment = useMemo<RubroWeighableCategory | null>(() => {
    // 1. Si viene una pestaña activa en el POS (ej: 'Panadería', 'Verdulería', 'Fiambrería', etc.)
    if (activeDepartmentKey && activeDepartmentKey !== 'ALL' && activeDepartmentKey !== 'COMMON') {
      const match = weighableTabs.find(
        t => t.key.toLowerCase() === activeDepartmentKey.toLowerCase() ||
             t.id.toLowerCase() === activeDepartmentKey.toLowerCase() ||
             t.name.toLowerCase() === activeDepartmentKey.toLowerCase()
      );
      if (match) return match;
    }

    // 2. Si hay un producto seleccionado, detectar según su nombre y categoría
    if (propSelectedProduct) {
      const pName = (propSelectedProduct.name || '').toLowerCase();
      const pCat = (propSelectedProduct.category || '').toLowerCase();

      // Panadería
      if (
        pCat === 'panadería' || pCat === 'panaderia' || pCat.includes('panad') ||
        ['pan', 'hallulla', 'marraqueta', 'coliza', 'dobladita', 'baguette', 'molde', 'amasado'].some(k => pName.includes(k))
      ) {
        const found = weighableTabs.find(t => t.id.includes('pan'));
        if (found) return found;
        return {
          id: 'panaderia',
          name: 'Panadería',
          key: 'Panadería',
          icon: '🥖',
          badgeColor: '',
          activeColor: '',
          keywords: ['pan']
        };
      }

      // Verdulería / Frutas
      if (
        pCat === 'verdulería' || pCat === 'verduleria' || pCat.includes('verdul') || pCat.includes('fruta') ||
        ['tomate', 'palta', 'papa', 'cebolla', 'lechuga', 'limon', 'platano', 'manzana', 'naranja', 'zanahoria'].some(k => pName.includes(k))
      ) {
        const found = weighableTabs.find(t => t.id.includes('verdul') || t.id.includes('fruta'));
        if (found) return found;
        return {
          id: 'verduleria',
          name: 'Verdulería y Frutería',
          key: 'Verdulería',
          icon: '🥬',
          badgeColor: '',
          activeColor: '',
          keywords: ['verdura', 'fruta']
        };
      }

      // Fiambrería / Cecinas y Quesos
      if (
        pCat === 'fiambrería' || pCat === 'fiambreria' || pCat.includes('fiambr') || pCat.includes('cecina') || pCat.includes('lácteo') || pCat.includes('lacteo') ||
        ['cecina', 'jamon', 'jamón', 'queso', 'salame', 'mortadela', 'vienesas'].some(k => pName.includes(k))
      ) {
        const found = weighableTabs.find(t => t.id.includes('fiambr') || t.id.includes('cecina'));
        if (found) return found;
        return {
          id: 'fiambreria',
          name: 'Fiambrería y Quesos',
          key: 'Fiambrería',
          icon: '🥪',
          badgeColor: '',
          activeColor: '',
          keywords: ['fiambreria', 'cecina', 'queso']
        };
      }

      // Frutos Secos
      if (
        pCat === 'frutos secos' || pCat.includes('fruto') ||
        ['nuez', 'nueces', 'almendra', 'mani', 'maní', 'semilla'].some(k => pName.includes(k))
      ) {
        const found = weighableTabs.find(t => t.id.includes('fruto'));
        if (found) return found;
        return {
          id: 'frutos_secos',
          name: 'Frutos Secos y Granel',
          key: 'Frutos Secos',
          icon: '🥜',
          badgeColor: '',
          activeColor: '',
          keywords: ['frutos secos']
        };
      }

      // Probar si coincide con alguna otra pestaña del rubro activo
      for (const tab of weighableTabs) {
        if (tab.keywords.some(k => pName.includes(k) || pCat.includes(k))) {
          return tab;
        }
      }
    }

    return null;
  }, [activeDepartmentKey, propSelectedProduct, weighableTabs]);

  // Filtrar de manera ESTRICTA solo los productos de este departamento específico
  const matchingStockProducts = useMemo(() => {
    if (!currentDepartment) {
      // Si no pertenece a un departamento específico, mostrar únicamente el producto seleccionado o productos de su misma categoría
      if (propSelectedProduct) {
        return allProducts.filter(p => p.category === propSelectedProduct.category || p.id === propSelectedProduct.id);
      }
      return allProducts.filter(p => p.unit === 'Kg' || p.unit === 'Gramos');
    }

    const deptId = currentDepartment.id.toLowerCase();

    return allProducts.filter(p => {
      const pName = (p.name || '').toLowerCase();
      const pCat = (p.category || '').toLowerCase();

      // 1. Panadería: ÚNICAMENTE panes y masas de panadería (descarta cecinas, quesos, verduras, frutas)
      if (deptId.includes('pan')) {
        const isOther = ['jamon', 'jamón', 'cecina', 'queso', 'tomate', 'palta', 'verdura', 'fruta', 'nuez', 'almendra', 'mani', 'carne'].some(k => pName.includes(k) || pCat.includes(k));
        if (isOther) return false;
        return pCat === 'panadería' || pCat === 'panaderia' || pCat.includes('panad') ||
               ['pan', 'hallulla', 'marraqueta', 'coliza', 'dobladita', 'baguette', 'molde', 'amasado', 'croissant'].some(k => pName.includes(k) || pCat.includes(k));
      }

      // 2. Fiambrería: ÚNICAMENTE cecinas, jamones y quesos (descarta pan y verduras)
      if (deptId.includes('fiambr') || deptId.includes('cecina') || deptId.includes('queso')) {
        const isBreadOrVeg = ['pan', 'hallulla', 'marraqueta', 'tomate', 'palta', 'nuez', 'almendra', 'lechuga', 'fruta'].some(k => pName.includes(k) || pCat.includes(k));
        if (isBreadOrVeg) return false;
        return pCat.includes('fiambr') || pCat.includes('cecina') || pCat.includes('lácteo') || pCat.includes('lacteo') ||
               ['cecina', 'jamon', 'jamón', 'queso', 'salame', 'mortadela', 'vienesas', 'arrollado', 'tocino'].some(k => pName.includes(k) || pCat.includes(k));
      }

      // 3. Verdulería: ÚNICAMENTE verduras, hortalizas y frutas (descarta pan y cecinas)
      if (deptId.includes('verdul') || deptId.includes('fruta') || deptId.includes('vegetal')) {
        const isBreadOrMeat = ['pan', 'hallulla', 'marraqueta', 'cecina', 'jamon', 'jamón', 'queso', 'nuez', 'almendra'].some(k => pName.includes(k) || pCat.includes(k));
        if (isBreadOrMeat) return false;
        return pCat.includes('verdul') || pCat.includes('fruta') || pCat.includes('vegetal') ||
               ['tomate', 'palta', 'papa', 'cebolla', 'lechuga', 'limon', 'limón', 'platano', 'plátano', 'manzana', 'naranja', 'zanahoria', 'pepino', 'fruta', 'verdura'].some(k => pName.includes(k) || pCat.includes(k));
      }

      // 4. Frutos Secos: ÚNICAMENTE frutos secos y semillas a granel (descarta carnes y pan)
      if (deptId.includes('fruto') || deptId.includes('granel')) {
        const isMeatOrBread = ['carne', 'pollo', 'cecina', 'jamon', 'jamón', 'pan', 'hallulla', 'tomate'].some(k => pName.includes(k) || pCat.includes(k));
        if (isMeatOrBread) return false;
        return pCat.includes('fruto') ||
               ['fruto seco', 'nuez', 'nueces', 'almendra', 'mani', 'maní', 'semilla', 'pasas', 'castaña', 'avellana', 'pistacho'].some(k => pName.includes(k) || pCat.includes(k));
      }

      // Coincidencias de palabras clave de la pestaña
      return currentDepartment.keywords.some(k => pName.includes(k) || pCat.includes(k));
    });
  }, [currentDepartment, allProducts, propSelectedProduct]);

  // Inicializar producto seleccionado al abrir
  useEffect(() => {
    if (!isOpen) return;

    if (propSelectedProduct) {
      setSelectedStockProduct(propSelectedProduct);
      setProductName(propSelectedProduct.name);
      setPricePerKg(propSelectedProduct.price || 1990);
      setUnit(propSelectedProduct.unit || 'Kg');
      setWeightKg('');
      setWeightGrams('');
    } else if (matchingStockProducts.length > 0) {
      const first = matchingStockProducts[0];
      setSelectedStockProduct(first);
      setProductName(first.name);
      setPricePerKg(first.price || 1990);
      setUnit(first.unit || 'Kg');
      setWeightKg('');
      setWeightGrams('');
    } else {
      setSelectedStockProduct(null);
      setProductName('');
      setPricePerKg(1990);
      setUnit('Kg');
      setWeightKg('');
      setWeightGrams('');
    }
  }, [propSelectedProduct, isOpen, matchingStockProducts]);

  // Al hacer clic en una tecla del teclado de balanza (como el teclado de supermercado de la foto 3)
  const handleSelectStockItem = (prod: Product) => {
    setSelectedStockProduct(prod);
    setProductName(prod.name);
    setPricePerKg(prod.price || 1990);
    setUnit(prod.unit || 'Kg');
  };

  // Sincronización exacta de peso (Kg <-> Gramos)
  const currentPricePerKg = Number(pricePerKg) || 0;

  const handleWeightKgChange = (val: string) => {
    setWeightKg(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0) {
      setWeightGrams((num * 1000).toFixed(0));
    } else {
      setWeightGrams('');
    }
  };

  const handleWeightGramsChange = (val: string) => {
    setWeightGrams(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0) {
      setWeightKg((num / 1000).toFixed(3));
    } else {
      setWeightKg('');
    }
  };

  // Botones de peso rápido en balanza (+100g, +250g, +500g, +1000g)
  const handleAddQuickGrams = (gramsToAdd: number) => {
    const currentG = parseFloat(String(weightGrams)) || 0;
    const newG = currentG + gramsToAdd;
    setWeightGrams(String(newG));
    setWeightKg((newG / 1000).toFixed(3));
  };

  const handleSetExactGrams = (exactGrams: number) => {
    setWeightGrams(String(exactGrams));
    setWeightKg((exactGrams / 1000).toFixed(3));
  };

  const handleClearWeight = () => {
    setWeightKg('');
    setWeightGrams('');
  };

  const finalQuantityKg = parseFloat(String(weightKg)) || 0;
  const finalSubtotal = currentPricePerKg > 0 && finalQuantityKg > 0
    ? Math.round(finalQuantityKg * currentPricePerKg)
    : 0;

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();

    if (!productName.trim()) {
      alert('Por favor seleccione o ingrese el nombre del producto.');
      return;
    }

    if (currentPricePerKg <= 0) {
      alert('Por favor ingrese un precio válido por Kilo.');
      return;
    }

    if (finalQuantityKg <= 0) {
      alert('Por favor ingrese el peso pesado en balanza (en Kg o Gramos).');
      return;
    }

    const item: SaleItem = {
      productId: selectedStockProduct?.id,
      productCode: selectedStockProduct?.code || 'PESO-' + Date.now().toString().slice(-4),
      productName: productName.trim(),
      quantity: finalQuantityKg,
      unitPrice: currentPricePerKg,
      subtotal: finalSubtotal,
      unit: unit || 'Kg'
    };

    onAddToCart(item);
    onClose();
  };

  if (!isOpen) return null;

  // Título e ícono según el departamento
  const deptTitle = currentDepartment ? currentDepartment.name : 'Venta por Balanza y Peso';
  const deptIcon = currentDepartment ? currentDepartment.icon : '⚖️';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      {/* Modal Principal Web: Espacioso, cómodo, 100% visible sin scroll de ventana */}
      <div className={'w-full max-w-xl sm:max-w-2xl lg:max-w-3xl rounded-3xl border ' + themeClasses.border + ' ' + themeClasses.card + ' shadow-2xl flex flex-col overflow-hidden animate-scaleIn my-auto'}>
        
        {/* Header Elegante y Específico del Departamento */}
        <div className="flex items-center justify-between px-5 py-3 sm:py-3.5 border-b border-slate-200 dark:border-slate-800 shrink-0 bg-slate-50/70 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-lg sm:text-xl text-white bg-gradient-to-tr from-amber-600 to-orange-500 shadow-md shrink-0">
              <span>{deptIcon}</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 leading-tight">
                  Balanza de {deptTitle}
                </h3>
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800">
                  Pesaje Directo
                </span>
              </div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Seleccione la variedad registrada, ingrese el peso de balanza y agregue al cobro
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            title="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulario Web - Sin scroll general, cómodo y amplio */}
        <form onSubmit={handleAdd} className="p-4 sm:p-5 space-y-3.5 flex flex-col">
          
          {/* TECLADO DE BALANZA (Inspirado en balanza de supermercado: teclas táctiles numeradas) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase text-slate-800 dark:text-slate-200 tracking-wider flex items-center gap-1.5">
                  <Boxes className="w-4 h-4 text-blue-500" />
                  <span>Variedades Registradas a la Venta ({matchingStockProducts.length})</span>
                </span>
              </div>
              {selectedStockProduct && (
                <span className="text-xs font-black text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-md border border-emerald-300 dark:border-emerald-700">
                  Stock: {selectedStockProduct.stock} {selectedStockProduct.unit || 'Kg'}
                </span>
              )}
            </div>

            {/* Cuadrícula de Teclas Táctiles (Teclado estilo balanza de supermercado con número amarillo) */}
            <div className="max-h-[175px] overflow-y-auto pr-1 scrollbar-thin">
              {matchingStockProducts.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {matchingStockProducts.map((prod, index) => {
                    const isSelected = selectedStockProduct?.id === prod.id || productName.toLowerCase() === prod.name.toLowerCase();
                    const keyNumber = index + 1;
                    return (
                      <button
                        key={prod.id || prod.code}
                        type="button"
                        onClick={() => handleSelectStockItem(prod)}
                        className={'relative p-2.5 rounded-2xl border-2 text-left transition-all flex flex-col justify-between cursor-pointer min-h-[76px] select-none group ' + (
                          isSelected
                            ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-600 shadow-md ring-2 ring-blue-500/20'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-400 hover:bg-slate-50 dark:hover:bg-slate-850'
                        )}
                      >
                        {/* Cabecera de la tecla: Número en cuadro amarillo (estilo balanza Cencosud/Santa Isabel) y stock */}
                        <div className="flex items-center justify-between w-full mb-1">
                          <span className="w-5 h-5 rounded flex items-center justify-center text-[11px] font-black bg-[#ffd600] text-slate-950 shadow-2xs">
                            {keyNumber}
                          </span>
                          <span className={'text-[10px] font-bold ' + (isSelected ? 'text-blue-700 dark:text-blue-300' : 'text-slate-400')}>
                            {prod.stock} {prod.unit || 'Kg'}
                          </span>
                        </div>

                        {/* Nombre del producto */}
                        <p className={'text-xs font-black line-clamp-2 leading-snug my-0.5 ' + (
                          isSelected ? 'text-blue-950 dark:text-blue-100' : 'text-slate-800 dark:text-slate-200'
                        )}>
                          {prod.name}
                        </p>

                        {/* Precio por Kilo */}
                        <div className="flex items-center justify-between w-full mt-1 pt-1 border-t border-slate-100 dark:border-slate-800/80">
                          <span className="text-[9px] font-bold uppercase text-slate-400">Precio/Kg</span>
                          <span className={'text-xs font-black font-mono ' + (
                            isSelected ? 'text-emerald-700 dark:text-emerald-400' : 'text-emerald-600 dark:text-emerald-400'
                          )}>
                            {formatCLP(prod.price || 0)}
                          </span>
                        </div>

                        {/* Indicador de seleccionado */}
                        {isSelected && (
                          <div className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-xs">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="p-4 text-center text-xs font-bold text-slate-500 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                  <span>No hay otras variedades de este rubro registradas en el inventario. Ingrese el nombre y precio abajo.</span>
                </div>
              )}
            </div>
          </div>

          {/* Nombre y Precio por Kilo seleccionado */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="sm:col-span-2">
              <label className="block text-xs font-black text-slate-800 dark:text-slate-200 mb-1">
                Producto Seleccionado *
              </label>
              <input
                type="text"
                required
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="Nombre del producto..."
                className={'w-full px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-bold rounded-xl border ' + themeClasses.inputBorder + ' ' + themeClasses.inputBg + ' text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500'}
              />
            </div>

            <div>
              <label className="block text-xs font-black text-slate-800 dark:text-slate-200 mb-1">
                Precio por Kg ($) *
              </label>
              <input
                type="number"
                required
                min="1"
                value={pricePerKg}
                onChange={(e) => setPricePerKg(e.target.value)}
                className={'w-full px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-black font-mono rounded-xl border ' + themeClasses.inputBorder + ' ' + themeClasses.inputBg + ' text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500'}
              />
            </div>
          </div>

          {/* Ingreso de Peso en Balanza con Botones de Acceso Rápido */}
          <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-black text-amber-950 dark:text-amber-300 mb-1">
                  Peso en Kilos (Kg)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    placeholder="Ej: 0.350"
                    value={weightKg}
                    onChange={(e) => handleWeightKgChange(e.target.value)}
                    className="w-full px-3 py-1.5 sm:py-2 pr-10 text-sm font-black font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    Kg
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-amber-950 dark:text-amber-300 mb-1">
                  O Peso en Gramos (g)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="1"
                    min="1"
                    placeholder="Ej: 350"
                    value={weightGrams}
                    onChange={(e) => handleWeightGramsChange(e.target.value)}
                    className="w-full px-3 py-1.5 sm:py-2 pr-10 text-sm font-black font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    g
                  </span>
                </div>
              </div>
            </div>

            {/* Atajos Rápidos de Peso Frecuente */}
            <div className="flex items-center gap-1.5 pt-1 overflow-x-auto">
              <span className="text-[10px] font-black uppercase text-amber-800 dark:text-amber-400 shrink-0">
                Atajos:
              </span>
              <button
                type="button"
                onClick={() => handleSetExactGrams(250)}
                className="px-2 py-1 rounded-lg bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700/60 text-xs font-bold text-amber-900 dark:text-amber-200 hover:bg-amber-100 transition cursor-pointer shadow-2xs"
              >
                1/4 Kg (250g)
              </button>
              <button
                type="button"
                onClick={() => handleSetExactGrams(500)}
                className="px-2 py-1 rounded-lg bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700/60 text-xs font-bold text-amber-900 dark:text-amber-200 hover:bg-amber-100 transition cursor-pointer shadow-2xs"
              >
                1/2 Kg (500g)
              </button>
              <button
                type="button"
                onClick={() => handleSetExactGrams(1000)}
                className="px-2 py-1 rounded-lg bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700/60 text-xs font-bold text-amber-900 dark:text-amber-200 hover:bg-amber-100 transition cursor-pointer shadow-2xs"
              >
                1 Kg (1.000g)
              </button>
              <button
                type="button"
                onClick={() => handleAddQuickGrams(100)}
                className="px-2 py-1 rounded-lg bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700/60 text-xs font-bold text-amber-900 dark:text-amber-200 hover:bg-amber-100 transition cursor-pointer shadow-2xs"
              >
                +100g
              </button>
              {finalQuantityKg > 0 && (
                <button
                  type="button"
                  onClick={handleClearWeight}
                  className="px-2 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-700 text-xs font-bold text-rose-700 dark:text-rose-300 hover:bg-rose-100 transition cursor-pointer ml-auto flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Borrar</span>
                </button>
              )}
            </div>
          </div>

          {/* Resumen del Monto a Cobrar */}
          <div className="p-3 rounded-2xl bg-slate-900 text-white flex items-center justify-between shadow-inner">
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                TOTAL A COBRAR
              </p>
              <p className="text-xs text-slate-300 mt-0.5">
                {finalQuantityKg > 0
                  ? finalQuantityKg + ' Kg × ' + formatCLP(currentPricePerKg) + '/Kg'
                  : 'Ingrese el peso en balanza'}
              </p>
            </div>
            <p className="text-xl sm:text-2xl font-black font-mono text-emerald-400">
              {formatCLP(finalSubtotal)}
            </p>
          </div>

          {/* Botones de Acción */}
          <div className="flex items-center justify-between gap-3 pt-1 border-t border-slate-200 dark:border-slate-800 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer border border-slate-300 dark:border-slate-700"
            >
              ✕ Cerrar
            </button>
            <button
              type="submit"
              disabled={finalQuantityKg <= 0 || currentPricePerKg <= 0}
              className="px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-black bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-md transition flex items-center gap-2 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <ShoppingCart className="w-4 h-4" />
              <span>Agregar al Carrito ({formatCLP(finalSubtotal)})</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
