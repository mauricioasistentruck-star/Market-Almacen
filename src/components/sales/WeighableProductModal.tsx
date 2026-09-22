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
  Check
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
  const [weightGrams, setWeightGrams] = useState<number | string>('');
  const [directAmount, setDirectAmount] = useState<number | string>('');
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

  // Lista de departamentos pesables del rubro actual
  const weighableTabs = useMemo(() => {
    return getWeighableCategoriesForRubro(selectedCompany?.rubroKey);
  }, [selectedCompany?.rubroKey]);

  // Detectar el departamento exacto al que pertenece el producto o la vista actual
  const currentDepartment = useMemo<RubroWeighableCategory | null>(() => {
    if (activeDepartmentKey && activeDepartmentKey !== 'ALL' && activeDepartmentKey !== 'COMMON') {
      const match = weighableTabs.find(
        t => t.key.toLowerCase() === activeDepartmentKey.toLowerCase() ||
             t.id.toLowerCase() === activeDepartmentKey.toLowerCase() ||
             t.name.toLowerCase() === activeDepartmentKey.toLowerCase()
      );
      if (match) return match;
    }

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

      for (const tab of weighableTabs) {
        if (tab.keywords.some(k => pName.includes(k) || pCat.includes(k))) {
          return tab;
        }
      }
    }

    return null;
  }, [activeDepartmentKey, propSelectedProduct, weighableTabs]);

  // Filtrar estrictamente productos de este departamento
  const matchingStockProducts = useMemo(() => {
    if (!currentDepartment) {
      if (propSelectedProduct) {
        return allProducts.filter(p => p.category === propSelectedProduct.category || p.id === propSelectedProduct.id);
      }
      return allProducts.filter(p => p.unit === 'Kg' || p.unit === 'Gramos');
    }

    const deptId = currentDepartment.id.toLowerCase();

    return allProducts.filter(p => {
      // Exclusión estricta de productos cerrados / envasados
      const isClosedUnit = ['unidades', 'litros', 'pack', 'caja', 'bolsa', 'botella', 'lata'].includes((p.unit || '').toLowerCase());
      if (p.isBulk === false) return false;
      if (isClosedUnit && p.isBulk !== true) return false;

      const isBulkProduct = p.isBulk === true || p.isWeighable === true ||
        ((p.unit === 'Kg' || p.unit === 'Gramos') && !isClosedUnit);
      if (!isBulkProduct) return false;

      const pName = (p.name || '').toLowerCase();
      const pCat = (p.category || '').toLowerCase();

      // Panadería: ÚNICAMENTE panes y masas de panadería
      if (deptId.includes('pan')) {
        const isOther = ['jamon', 'jamón', 'cecina', 'queso', 'tomate', 'palta', 'verdura', 'fruta', 'nuez', 'almendra', 'mani', 'carne'].some(k => pName.includes(k) || pCat.includes(k));
        if (isOther) return false;
        return pCat === 'panadería' || pCat === 'panaderia' || pCat.includes('panad') ||
               ['pan', 'hallulla', 'marraqueta', 'coliza', 'dobladita', 'baguette', 'molde', 'amasado', 'croissant'].some(k => pName.includes(k) || pCat.includes(k));
      }

      // Fiambrería: ÚNICAMENTE cecinas, jamones y quesos al corte / granel
      if (deptId.includes('fiambr') || deptId.includes('cecina') || deptId.includes('queso')) {
        const isClosedDairy = ['leche', 'yogur', 'yogurt', 'sobre', 'crema de leche', 'mantequilla', 'postre'].some(k => pName.includes(k));
        if (isClosedDairy && p.isBulk !== true) return false;

        const isBreadOrVeg = ['pan', 'hallulla', 'marraqueta', 'tomate', 'palta', 'nuez', 'almendra', 'lechuga', 'fruta'].some(k => pName.includes(k) || pCat.includes(k));
        if (isBreadOrVeg) return false;
        return pCat.includes('fiambr') || pCat.includes('cecina') || pCat.includes('lácteo') || pCat.includes('lacteo') ||
               ['cecina', 'jamon', 'jamón', 'queso', 'salame', 'mortadela', 'vienesas', 'arrollado', 'tocino'].some(k => pName.includes(k) || pCat.includes(k));
      }

      // Verdulería: ÚNICAMENTE verduras y frutas
      if (deptId.includes('verdul') || deptId.includes('fruta') || deptId.includes('vegetal')) {
        const isBreadOrMeat = ['pan', 'hallulla', 'marraqueta', 'cecina', 'jamon', 'jamón', 'queso', 'nuez', 'almendra'].some(k => pName.includes(k) || pCat.includes(k));
        if (isBreadOrMeat) return false;
        return pCat.includes('verdul') || pCat.includes('fruta') || pCat.includes('vegetal') ||
               ['tomate', 'palta', 'papa', 'cebolla', 'lechuga', 'limon', 'limón', 'platano', 'plátano', 'manzana', 'naranja', 'zanahoria', 'pepino', 'fruta', 'verdura'].some(k => pName.includes(k) || pCat.includes(k));
      }

      // Frutos Secos
      if (deptId.includes('fruto') || deptId.includes('granel')) {
        const isMeatOrBread = ['carne', 'pollo', 'cecina', 'jamon', 'jamón', 'pan', 'hallulla', 'tomate'].some(k => pName.includes(k) || pCat.includes(k));
        if (isMeatOrBread) return false;
        return pCat.includes('fruto') ||
               ['fruto seco', 'nuez', 'nueces', 'almendra', 'mani', 'maní', 'semilla', 'pasas', 'castaña', 'avellana', 'pistacho'].some(k => pName.includes(k) || pCat.includes(k));
      }

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
      setWeightGrams('');
      setDirectAmount('');
    } else if (matchingStockProducts.length > 0) {
      const first = matchingStockProducts[0];
      setSelectedStockProduct(first);
      setProductName(first.name);
      setPricePerKg(first.price || 1990);
      setUnit(first.unit || 'Kg');
      setWeightGrams('');
      setDirectAmount('');
    } else {
      setSelectedStockProduct(null);
      setProductName('');
      setPricePerKg(1990);
      setUnit('Kg');
      setWeightGrams('');
      setDirectAmount('');
    }
  }, [propSelectedProduct, isOpen, matchingStockProducts]);

  const currentPricePerKg = Number(pricePerKg) || 0;

  // Al seleccionar una lámina / tecla del producto
  const handleSelectStockItem = (prod: Product) => {
    setSelectedStockProduct(prod);
    setProductName(prod.name);
    const newPrice = prod.price || 1990;
    setPricePerKg(newPrice);
    setUnit(prod.unit || 'Kg');

    const g = parseFloat(String(weightGrams));
    if (g > 0 && newPrice > 0) {
      setDirectAmount(String(Math.round((g / 1000) * newPrice)));
    }
  };

  // Cambio en Gramos (g): sincroniza el monto total si se ingresa peso
  const handleWeightGramsChange = (val: string) => {
    setWeightGrams(val);
    const numG = parseFloat(val);
    if (!isNaN(numG) && numG > 0 && currentPricePerKg > 0) {
      setDirectAmount(String(Math.round((numG / 1000) * currentPricePerKg)));
    } else if (!val) {
      setDirectAmount('');
    }
  };

  // Cambio en Monto Directo ($): si la balanza ya dio el valor del producto, calcula los gramos correspondientes
  const handleDirectAmountChange = (val: string) => {
    setDirectAmount(val);
    const numAmt = parseFloat(val);
    if (!isNaN(numAmt) && numAmt > 0 && currentPricePerKg > 0) {
      setWeightGrams(String(Math.round((numAmt / currentPricePerKg) * 1000)));
    } else if (!val) {
      setWeightGrams('');
    }
  };

  // Cambio manual de precio por kilo
  const handlePriceChange = (val: string) => {
    setPricePerKg(val);
    const newPrice = parseFloat(val) || 0;
    const g = parseFloat(String(weightGrams));
    if (g > 0 && newPrice > 0) {
      setDirectAmount(String(Math.round((g / 1000) * newPrice)));
    }
  };

  const finalGrams = parseFloat(String(weightGrams)) || 0;
  const finalDirectAmount = parseFloat(String(directAmount)) || 0;

  const finalQuantityKg = finalGrams > 0
    ? Number((finalGrams / 1000).toFixed(3))
    : (currentPricePerKg > 0 && finalDirectAmount > 0 ? Number((finalDirectAmount / currentPricePerKg).toFixed(3)) : 0);

  const finalSubtotal = finalDirectAmount > 0
    ? Math.round(finalDirectAmount)
    : (finalQuantityKg > 0 && currentPricePerKg > 0 ? Math.round(finalQuantityKg * currentPricePerKg) : 0);

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

    if (finalGrams <= 0 && finalDirectAmount <= 0) {
      alert('Por favor ingrese los gramos o el precio que marcó la pesa.');
      return;
    }

    const item: SaleItem = {
      productId: selectedStockProduct?.id,
      productCode: selectedStockProduct?.code || 'PESO-' + Date.now().toString().slice(-4),
      productName: productName.trim(),
      quantity: finalQuantityKg > 0 ? finalQuantityKg : 0.001,
      unitPrice: currentPricePerKg,
      subtotal: finalSubtotal,
      unit: unit || 'Kg'
    };

    onAddToCart(item);
    onClose();
  };

  if (!isOpen) return null;

  const deptTitle = currentDepartment ? currentDepartment.name : 'Venta por Balanza y Peso';
  const deptIcon = currentDepartment ? currentDepartment.icon : '⚖️';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      {/* Ventana Ampliada: max-w-4xl a max-w-6xl para que entren muchas variedades */}
      <div className={'w-full max-w-4xl lg:max-w-5xl xl:max-w-6xl rounded-3xl border ' + themeClasses.border + ' ' + themeClasses.card + ' shadow-2xl flex flex-col overflow-hidden animate-scaleIn my-auto max-h-[95vh]'}>
        
        {/* Header Compacto y Elegante */}
        <div className="flex items-center justify-between px-5 py-2.5 sm:py-3 border-b border-slate-200 dark:border-slate-800 shrink-0 bg-slate-50/70 dark:bg-slate-800/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center text-lg text-white bg-gradient-to-tr from-amber-600 to-orange-500 shadow-md shrink-0">
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
                Seleccione la variedad registrada, ingrese gramos o el precio de la balanza
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

        {/* Formulario Web: El área superior de variedades toma la mayor parte del espacio */}
        <form onSubmit={handleAdd} className="flex-1 flex flex-col overflow-hidden">
          
          {/* ÁREA DE VARIEDADES: Amplia, para que caigan muchas láminas/productos */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-3 scrollbar-thin min-h-[160px] max-h-[380px] lg:max-h-[440px]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-black uppercase text-slate-800 dark:text-slate-200 tracking-wider flex items-center gap-1.5">
                <Boxes className="w-4 h-4 text-blue-500" />
                <span>Variedades Registradas a la Venta ({matchingStockProducts.length})</span>
              </span>
              {selectedStockProduct && (
                <span className="text-xs font-black text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-md border border-emerald-300 dark:border-emerald-700">
                  Stock: {selectedStockProduct.stock} {selectedStockProduct.unit || 'Kg'}
                </span>
              )}
            </div>

            {/* Cuadrícula amplia de láminas compactas: caben de 6 a 8 por fila, múltiples filas */}
            {matchingStockProducts.length > 0 ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8 gap-2 sm:gap-2.5">
                {matchingStockProducts.map((prod, index) => {
                  const isSelected = selectedStockProduct?.id === prod.id || productName.toLowerCase() === prod.name.toLowerCase();
                  const keyNumber = index + 1;
                  return (
                    <button
                      key={prod.id || prod.code}
                      type="button"
                      onClick={() => handleSelectStockItem(prod)}
                      className={'relative w-full aspect-square min-h-[86px] max-h-[105px] p-1.5 rounded-xl border-2 transition-all flex flex-col justify-between items-center text-center cursor-pointer select-none group ' + (
                        isSelected
                          ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-600 shadow-md ring-2 ring-blue-500/20'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-400 hover:shadow-xs hover:bg-slate-50 dark:hover:bg-slate-850'
                      )}
                      title={prod.name}
                    >
                      {/* Cabecera de la lámina: Número amarillo y stock */}
                      <div className="flex items-center justify-between w-full">
                        <span className="w-4.5 h-4.5 rounded flex items-center justify-center text-[10px] font-black bg-[#ffd600] text-slate-950 shadow-2xs">
                          {keyNumber}
                        </span>
                        <span className={'text-[8.5px] font-bold truncate max-w-[50px] ' + (isSelected ? 'text-blue-700 dark:text-blue-300' : 'text-slate-400')}>
                          {prod.stock} {prod.unit || 'Kg'}
                        </span>
                      </div>

                      {/* Ícono representativo */}
                      <div className="text-lg sm:text-xl leading-none my-0.5 group-hover:scale-110 transition duration-150">
                        {deptIcon}
                      </div>

                      {/* Nombre del producto */}
                      <p className={'text-[10px] sm:text-[10.5px] font-black line-clamp-2 leading-tight px-0.5 ' + (
                        isSelected ? 'text-blue-950 dark:text-blue-100' : 'text-slate-800 dark:text-slate-200'
                      )}>
                        {prod.name}
                      </p>

                      {/* Precio por Kilo */}
                      <span className={'text-[9.5px] sm:text-[10px] font-black font-mono leading-none ' + (
                        isSelected ? 'text-emerald-700 dark:text-emerald-400' : 'text-emerald-600 dark:text-emerald-400'
                      )}>
                        {formatCLP(prod.price || 0)}/Kg
                      </span>

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
              <div className="p-6 text-center text-xs font-bold text-slate-500 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                <span>No hay otras variedades registradas en este rubro. Puede ingresar el nombre y precio abajo.</span>
              </div>
            )}
          </div>

          {/* ÁREA INFERIOR COMPACTA (Imagen 2 reducida): Ocupa poco espacio para dar prioridad a los productos */}
          <div className="border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 px-4 sm:px-6 py-2.5 space-y-2 shrink-0">
            
            {/* Fila compacta con los 4 campos alineados */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 text-xs">
              {/* 1. Producto Seleccionado (4 cols) */}
              <div className="sm:col-span-4">
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-0.5">
                  Producto Seleccionado *
                </label>
                <input
                  type="text"
                  required
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="Nombre del producto..."
                  className={'w-full px-2.5 py-1.5 text-xs font-bold rounded-lg border ' + themeClasses.inputBorder + ' ' + themeClasses.inputBg + ' text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500'}
                />
              </div>

              {/* 2. Precio por Kg (2 cols) */}
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-0.5">
                  Precio/Kg ($) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={pricePerKg}
                  onChange={(e) => handlePriceChange(e.target.value)}
                  className={'w-full px-2.5 py-1.5 text-xs font-black font-mono rounded-lg border ' + themeClasses.inputBorder + ' ' + themeClasses.inputBg + ' text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500'}
                />
              </div>

              {/* 3. Peso en Gramos (3 cols) */}
              <div className="sm:col-span-3">
                <label className="block text-[11px] font-bold text-amber-900 dark:text-amber-300 mb-0.5 flex justify-between">
                  <span>Peso en Gramos (g)</span>
                  <span className="text-[9px] text-amber-700 dark:text-amber-400">Pesa</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="1"
                    min="1"
                    placeholder="Ej: 350"
                    value={weightGrams}
                    onChange={(e) => handleWeightGramsChange(e.target.value)}
                    className="w-full px-2.5 py-1.5 pr-7 text-xs sm:text-sm font-black font-mono rounded-lg border border-amber-300 dark:border-amber-700/70 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500 shadow-2xs"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400">
                    g
                  </span>
                </div>
              </div>

              {/* 4. O Precio Total Balanza (3 cols) */}
              <div className="sm:col-span-3">
                <label className="block text-[11px] font-bold text-amber-900 dark:text-amber-300 mb-0.5 flex justify-between">
                  <span>O Total Balanza ($)</span>
                  <span className="text-[9px] text-amber-700 dark:text-amber-400">Si dio precio</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="1"
                    min="1"
                    placeholder="Ej: 660"
                    value={directAmount}
                    onChange={(e) => handleDirectAmountChange(e.target.value)}
                    className="w-full px-2.5 py-1.5 pr-7 text-xs sm:text-sm font-black font-mono rounded-lg border border-amber-300 dark:border-amber-700/70 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500 shadow-2xs"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400">
                    $
                  </span>
                </div>
              </div>
            </div>

            {/* Fila con Resumen del Total y Botones de Acción */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="px-3 py-1 rounded-xl bg-slate-900 text-white flex items-center gap-2 shadow-inner">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    TOTAL:
                  </span>
                  <span className="text-base sm:text-lg font-black font-mono text-emerald-400">
                    {formatCLP(finalSubtotal)}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:inline font-medium">
                  {finalGrams > 0
                    ? finalGrams + ' g (' + (finalGrams / 1000).toFixed(3) + ' Kg) × ' + formatCLP(currentPricePerKg) + '/Kg'
                    : 'Ingrese los gramos o el valor de la balanza'}
                </p>
              </div>

              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-1.5 sm:py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer border border-slate-300 dark:border-slate-700"
                >
                  ✕ Cerrar
                </button>
                <button
                  type="submit"
                  disabled={finalSubtotal <= 0}
                  className="px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-black bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-md transition flex items-center gap-2 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  <ShoppingCart className="w-4 h-4" />
                  <span>Agregar al Carrito ({formatCLP(finalSubtotal)})</span>
                </button>
              </div>
            </div>

          </div>

        </form>

      </div>
    </div>
  );
};
