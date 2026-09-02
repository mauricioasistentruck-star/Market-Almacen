import { useBodyScrollLock } from '../../utils/scrollLock';
import React, { useState, useEffect, useMemo } from 'react';
import { useTheme } from '../../utils/themeContext';
import { useCompany } from '../../utils/companyContext';
import { db } from '../../db/database';
import { formatCLP } from '../../utils/salesPdfGenerator';
import type { Product, SaleItem } from '../../types';
import {
  X,
  Scale,
  ShoppingCart,
  Boxes
} from 'lucide-react';

interface WeighableProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddToCart: (item: SaleItem) => void;
  selectedProduct?: Product | null;
}

const CATEGORY_PRESETS = [
  { id: 'cecinas', name: 'Cecinas', icon: '🥩', defaultPrice: 8990, keywords: ['cecina', 'jamon', 'jamón', 'salchicha', 'mortadela', 'salame', 'arrollado', 'paté', 'pate', 'vienesas', 'tocino', 'fiambreria'] },
  { id: 'quesos', name: 'Quesos', icon: '🧀', defaultPrice: 7990, keywords: ['queso', 'gauda', 'chanco', 'mozzarella', 'mantecoso', 'ricotta', 'parmesano', 'lacteo', 'lácteo'] },
  { id: 'panaderia', name: 'Panadería', icon: '🥖', defaultPrice: 1990, keywords: ['pan', 'marraqueta', 'hallulla', 'baguette', 'coliza', 'dobladita', 'panaderia', 'panadería'] },
  { id: 'verduras', name: 'Verduras', icon: '🥬', defaultPrice: 1500, keywords: ['verdura', 'lechuga', 'espinaca', 'acelga', 'zapallo', 'zanahoria', 'apio', 'pepino', 'cilantro', 'perejil', 'cebolla'] },
  { id: 'papas', name: 'Papas', icon: '🥔', defaultPrice: 1200, keywords: ['papa', 'camote', 'betarraga', 'tuberculo', 'tubérculo'] },
  { id: 'tomates', name: 'Tomates', icon: '🍅', defaultPrice: 1690, keywords: ['tomate', 'pimenton', 'pimentón', 'morron', 'morrón', 'aji', 'ají', 'hortaliza'] },
  { id: 'frutas', name: 'Frutas', icon: '🍎', defaultPrice: 1490, keywords: ['manzana', 'platano', 'plátano', 'naranja', 'pera', 'uva', 'fruta', 'limon', 'limón', 'sandia', 'sandía', 'melon', 'melón', 'frutilla', 'durazno', 'palta'] },
  { id: 'carnes', name: 'Carnes', icon: '🍗', defaultPrice: 6990, keywords: ['carne', 'pollo', 'vacuno', 'cerdo', 'posta', 'molida', 'pechuga', 'trutro', 'costillar', 'lomo', 'sobrecostilla', 'asado', 'carniceria', 'carnicería', 'alitas'] },
  { id: 'frutos', name: 'Frutos', icon: '🥜', defaultPrice: 9900, keywords: ['fruto seco', 'frutos secos', 'nuez', 'nueces', 'almendra', 'mani', 'maní', 'castaña', 'avellana', 'pasas', 'pistacho', 'datil', 'dátil', 'chia', 'chía', 'linaza', 'granola', 'semilla'] },
  { id: 'legumbres', name: 'Legumbres', icon: '🌾', defaultPrice: 2490, keywords: ['poroto', 'lenteja', 'garbanzo', 'arveja', 'haba', 'legumbre'] }
];

export const WeighableProductModal: React.FC<WeighableProductModalProps> = ({
  isOpen,
  onClose,
  onAddToCart,
  selectedProduct: propSelectedProduct
}) => {
  useBodyScrollLock(Boolean(isOpen));
  const { themeClasses } = useTheme();
  const { selectedCompanyId } = useCompany();

  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('cecinas');
  const [selectedStockProduct, setSelectedStockProduct] = useState<Product | null>(null);

  const [productName, setProductName] = useState('');
  const [pricePerKg, setPricePerKg] = useState<number | string>(8990);
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

  // Helper para detectar la categoría adecuada para un producto
  const findMatchingCategoryPreset = (prod: Product) => {
    const pName = (prod.name || '').toLowerCase();
    const pCat = (prod.category || '').toLowerCase();

    for (const preset of CATEGORY_PRESETS) {
      if (preset.id === 'frutos') {
        const isMeatOrPoultry = ['carne', 'pollo', 'cerdo', 'vacuno', 'trutro', 'pechuga', 'costillar', 'cecina', 'jamon', 'jamón'].some(k => pName.includes(k) || pCat.includes(k));
        if (isMeatOrPoultry) continue;
      }
      const matches = preset.keywords.some(k => pName.includes(k) || pCat.includes(k));
      if (matches) return preset;
    }
    return CATEGORY_PRESETS[0];
  };

  // Inicializar al abrir
  useEffect(() => {
    if (!isOpen) return;

    if (propSelectedProduct) {
      const matchedPreset = findMatchingCategoryPreset(propSelectedProduct);
      setActiveCategory(matchedPreset.id);
      setSelectedStockProduct(propSelectedProduct);
      setProductName(propSelectedProduct.name);
      setPricePerKg(propSelectedProduct.price || matchedPreset.defaultPrice);
      setUnit(propSelectedProduct.unit || 'Kg');
      setWeightKg('');
      setWeightGrams('');
    } else {
      const initialPreset = CATEGORY_PRESETS[0];
      setActiveCategory(initialPreset.id);
      applyCategoryFilter(initialPreset, allProducts);
      setWeightKg('');
      setWeightGrams('');
    }
  }, [propSelectedProduct, isOpen, allProducts.length]);

  // Filtrar productos de inventario estrictamente coincidentes con la categoría
  const getMatchingStockProducts = (categoryPreset: typeof CATEGORY_PRESETS[0], list: Product[]) => {
    return list.filter(p => {
      const pName = (p.name || '').toLowerCase();
      const pCat = (p.category || '').toLowerCase();

      if (categoryPreset.id === 'frutos') {
        const isMeatOrPoultry = ['carne', 'pollo', 'cerdo', 'vacuno', 'trutro', 'pechuga', 'costillar', 'cecina', 'jamon', 'jamón'].some(k => pName.includes(k) || pCat.includes(k));
        if (isMeatOrPoultry) return false;
      }

      if (categoryPreset.id === 'carnes') {
        const isMeat = categoryPreset.keywords.some(k => pName.includes(k) || pCat.includes(k));
        return isMeat;
      }

      const matchesKeyword = categoryPreset.keywords.some(k => pName.includes(k) || pCat.includes(k));
      const matchesUnit = p.unit === 'Kg' || p.unit === 'Gramos' || p.unit === 'UN' || !p.unit;
      return matchesKeyword && matchesUnit;
    });
  };

  const applyCategoryFilter = (preset: typeof CATEGORY_PRESETS[0], list: Product[]) => {
    const matching = getMatchingStockProducts(preset, list);
    if (matching.length > 0) {
      const first = matching[0];
      setSelectedStockProduct(first);
      setProductName(first.name);
      setPricePerKg(first.price || preset.defaultPrice);
      setUnit(first.unit || 'Kg');
    } else {
      setSelectedStockProduct(null);
      setProductName('');
      setPricePerKg(preset.defaultPrice);
      setUnit('Kg');
    }
  };

  const handleSelectCategory = (preset: typeof CATEGORY_PRESETS[0]) => {
    setActiveCategory(preset.id);
    applyCategoryFilter(preset, allProducts);
  };

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

  const finalQuantityKg = parseFloat(String(weightKg)) || 0;
  const finalSubtotal = currentPricePerKg > 0 && finalQuantityKg > 0
    ? Math.round(finalQuantityKg * currentPricePerKg)
    : 0;

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();

    if (!productName.trim()) {
      alert('Por favor ingrese el nombre del producto.');
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
      productCode: selectedStockProduct?.code || `PESO-${Date.now().toString().slice(-4)}`,
      productName: productName.trim(),
      quantity: finalQuantityKg,
      unitPrice: currentPricePerKg,
      subtotal: finalSubtotal,
      unit: unit || 'Kg'
    };

    onAddToCart(item);
    onClose();
  };

  const currentPreset = CATEGORY_PRESETS.find(c => c.id === activeCategory) || CATEGORY_PRESETS[0];
  const matchingStockList = getMatchingStockProducts(currentPreset, allProducts);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      {/* Modal Principal: Ancho fijo max-w-2xl, SIN SCROLL EXTERNO y con altura estable */}
      <div className={`w-full max-w-2xl rounded-3xl border ${themeClasses.border} ${themeClasses.card} shadow-2xl flex flex-col overflow-hidden animate-scaleIn max-h-[92vh] my-auto`}>
        
        {/* Header con icono naranja */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white bg-gradient-to-tr from-amber-600 to-orange-500 shadow-md shrink-0">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-slate-100 leading-tight">
                Venta por Peso y Balanza (Descuento de Stock)
              </h3>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Seleccione el producto inventariado, ingrese los gramos/kilos y cobre al instante
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulario con altura fija y sin saltos entre opciones */}
        <form onSubmit={handleAdd} className="p-4 sm:p-5 space-y-3 overflow-y-auto flex-1 scrollbar-thin">
          
          {/* 1. Categoría de Producto a Pesar (10 botones en 5 columnas x 2 filas) */}
          <div>
            <label className="block text-xs font-black uppercase text-slate-700 dark:text-slate-300 mb-1.5 tracking-wider">
              1. CATEGORÍA DE PRODUCTO A PESAR
            </label>
            <div className="grid grid-cols-5 gap-2">
              {CATEGORY_PRESETS.map((preset) => {
                const isSelected = activeCategory === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectCategory(preset)}
                    className={`py-2 px-1.5 rounded-2xl border text-center transition flex flex-col items-center justify-center cursor-pointer ${
                      isSelected
                        ? 'bg-[#ffedd5] dark:bg-orange-950/40 border-2 border-orange-400 text-orange-950 dark:text-orange-200 font-extrabold shadow-xs'
                        : 'bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold'
                    }`}
                  >
                    <span className="text-xl mb-0.5">{preset.icon}</span>
                    <span className="text-xs leading-tight">{preset.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Variedad en Stock Inventariado: ALTURA COMPLETAMENTE FIJA (114px) */}
          <div className="p-3 rounded-2xl border border-blue-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-black text-xs">
                <Boxes className="w-4 h-4 shrink-0" />
                <span>2. Variedad en Stock Inventariado ({matchingStockList.length} disponibles)</span>
              </div>
              {selectedStockProduct && (
                <span className="text-[11px] font-black text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/80 px-2.5 py-0.5 rounded-lg border border-emerald-300 dark:border-emerald-700">
                  Stock actual: {selectedStockProduct.stock} {selectedStockProduct.unit || 'Kg'}
                </span>
              )}
            </div>

            {/* CONTENEDOR CON ALTURA FIJA QUE NUNCA CAMBIA DE TAMAÑO (114px) */}
            <div className="h-[114px] min-h-[114px] max-h-[114px] overflow-y-auto pr-1 scrollbar-thin">
              {matchingStockList.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {matchingStockList.map((prod) => {
                    const isSelected = selectedStockProduct?.id === prod.id;
                    return (
                      <button
                        key={prod.id}
                        type="button"
                        onClick={() => handleSelectStockItem(prod)}
                        className={`p-2.5 rounded-xl border text-left transition flex items-center justify-between gap-2 cursor-pointer h-[50px] ${
                          isSelected
                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs font-black'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-slate-400 text-slate-900 dark:text-slate-100'
                        }`}
                      >
                        <div className="truncate flex-1">
                          <p className="text-xs font-black truncate leading-tight">{prod.name}</p>
                          <p className={`text-[10.5px] font-bold mt-0.5 ${isSelected ? 'text-blue-100' : 'text-slate-500'}`}>
                            Stock: {prod.stock} {prod.unit || 'Kg'}
                          </p>
                        </div>
                        <span className={`text-xs font-black font-mono shrink-0 ${isSelected ? 'text-white' : 'text-emerald-600 dark:text-emerald-400'}`}>
                          ${(prod.price || currentPreset.defaultPrice).toLocaleString('es-CL')}/Kg
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-center text-xs font-bold text-slate-500 p-2">
                  <span>No hay productos inventariados en esta categoría. Puedes ingresar el nombre y precio manualmente abajo.</span>
                </div>
              )}
            </div>
          </div>

          {/* 3. Nombre y Precio por Kilo */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="sm:col-span-2">
              <label className="block text-xs font-black text-slate-800 dark:text-slate-200 mb-1">
                Producto a Descontar *
              </label>
              <input
                type="text"
                required
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="Ej: Trutro Pollo Granel..."
                className={`w-full px-3.5 py-2 text-xs font-black rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500`}
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
                className={`w-full px-3.5 py-2 text-xs font-black font-mono rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500`}
              />
            </div>
          </div>

          {/* 4. Ingreso de Peso en Balanza: ALTURA FIJA SIN ATAJOS QUE DESFIGUREN EL MODAL */}
          <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                    className="w-full px-3.5 py-2 pr-10 text-sm font-black font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
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
                    className="w-full px-3.5 py-2 pr-10 text-sm font-black font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    g
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 5. Resumen del Monto a Cobrar */}
          <div className="p-3.5 rounded-2xl bg-slate-900 text-white flex items-center justify-between shadow-inner">
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                TOTAL A COBRAR
              </p>
              <p className="text-xs text-slate-300 mt-0.5">
                {finalQuantityKg > 0
                  ? `${finalQuantityKg} Kg × ${formatCLP(currentPricePerKg)}/Kg`
                  : 'Ingrese el peso en balanza'}
              </p>
            </div>
            <p className="text-2xl font-black font-mono text-emerald-400">
              {formatCLP(finalSubtotal)}
            </p>
          </div>

          {/* Botones de Acción Accesibles Siempre */}
          <div className="flex items-center justify-between gap-3 pt-2 pb-1 border-t border-slate-200 dark:border-slate-800 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer border border-slate-300 dark:border-slate-700"
            >
              ✕ Cerrar
            </button>
            <button
              type="submit"
              disabled={finalQuantityKg <= 0 || currentPricePerKg <= 0}
              className="px-5 py-2.5 rounded-xl text-xs font-black bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-md transition flex items-center gap-2 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
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
