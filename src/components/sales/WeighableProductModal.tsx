import { useBodyScrollLock } from '../../utils/scrollLock';
import React, { useState, useEffect } from 'react';
import { useTheme } from '../../utils/themeContext';
import { useCompany } from '../../utils/companyContext';
import { db } from '../../db/database';
import { formatCLP } from '../../utils/salesPdfGenerator';
import type { Product, SaleItem } from '../../types';
import {
  X,
  Scale,
  ShoppingCart,
  Boxes,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';

interface WeighableProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddToCart: (item: SaleItem) => void;
  selectedProduct?: Product | null;
}

const CATEGORY_PRESETS = [
  { id: 'cecinas', name: 'Cecinas y Fiambrería', icon: '🥩', defaultPrice: 8990, keywords: ['cecina', 'jamon', 'jamón', 'salchicha', 'mortadela', 'salame', 'arrollado', 'paté', 'pate', 'vienesas', 'tocino', 'fiambreria'] },
  { id: 'quesos', name: 'Quesos y Lácteos', icon: '🧀', defaultPrice: 7990, keywords: ['queso', 'gauda', 'chanco', 'mozzarella', 'mantecoso', 'ricotta', 'parmesano', 'lacteo', 'lácteo'] },
  { id: 'pan', name: 'Panadería y Pan', icon: '🥖', defaultPrice: 1990, keywords: ['pan', 'marraqueta', 'hallulla', 'baguette', 'coliza', 'dobladita', 'panaderia', 'panadería'] },
  { id: 'verduras', name: 'Verduras y Ensaladas', icon: '🥬', defaultPrice: 1500, keywords: ['verdura', 'lechuga', 'espinaca', 'acelga', 'zapallo', 'zanahoria', 'apio', 'pepino', 'cilantro', 'perejil', 'cebolla'] },
  { id: 'papas', name: 'Papas y Tubérculos', icon: '🥔', defaultPrice: 1200, keywords: ['papa', 'camote', 'betarraga', 'tuberculo', 'tubérculo'] },
  { id: 'tomates', name: 'Tomates y Hortalizas', icon: '🍅', defaultPrice: 1690, keywords: ['tomate', 'pimenton', 'pimentón', 'morron', 'morrón', 'aji', 'ají', 'hortaliza'] },
  { id: 'frutas', name: 'Frutas de Estación', icon: '🍎', defaultPrice: 1490, keywords: ['manzana', 'platano', 'plátano', 'naranja', 'pera', 'uva', 'fruta', 'limon', 'limón', 'sandia', 'sandía', 'melon', 'melón', 'frutilla', 'durazno', 'palta'] },
  { id: 'carnes', name: 'Carnes y Pollo', icon: '🍗', defaultPrice: 6990, keywords: ['carne', 'pollo', 'vacuno', 'cerdo', 'posta', 'molida', 'pechuga', 'trutro', 'costillar', 'lomo', 'sobrecostilla', 'asado', 'carniceria', 'carnicería', 'alitas'] },
  { id: 'frutos_secos', name: 'Frutos Secos', icon: '🥜', defaultPrice: 9900, keywords: ['fruto seco', 'frutos secos', 'nuez', 'nueces', 'almendra', 'mani', 'maní', 'castaña', 'avellana', 'pasas', 'pistacho', 'datil', 'dátil', 'chia', 'chía', 'linaza', 'granola', 'semilla'] },
  { id: 'legumbres', name: 'Legumbres a Granel', icon: '🌾', defaultPrice: 2490, keywords: ['poroto', 'lenteja', 'garbanzo', 'arveja', 'haba', 'legumbre'] }
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
      if (preset.id === 'frutos_secos') {
        const isMeatOrPoultry = ['carne', 'pollo', 'cerdo', 'vacuno', 'trutro', 'pechuga', 'costillar', 'cecina', 'jamon', 'jamón'].some(k => pName.includes(k) || pCat.includes(k));
        if (isMeatOrPoultry) continue;
      }
      const matches = preset.keywords.some(k => pName.includes(k) || pCat.includes(k));
      if (matches) return preset;
    }
    return CATEGORY_PRESETS[0];
  };

  // Inicializar al abrir: siempre detecta la categoría y mantiene el tamaño constante
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

      // Reglas estrictas de aislamiento entre categorías
      if (categoryPreset.id === 'frutos_secos') {
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
      setProductName(preset.name);
      setPricePerKg(preset.defaultPrice);
      setUnit('Kg');
    }
  };

  // Al hacer clic en una categoría rápida
  const handleSelectCategory = (preset: typeof CATEGORY_PRESETS[0]) => {
    setActiveCategory(preset.id);
    applyCategoryFilter(preset, allProducts);
  };

  // Al seleccionar un producto específico del inventario
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

  const handlePresetWeight = (kg: number) => {
    handleWeightKgChange(kg.toString());
  };

  const handlePresetGrams = (grams: number) => {
    handleWeightGramsChange(grams.toString());
  };

  const currentPreset = CATEGORY_PRESETS.find(c => c.id === activeCategory) || CATEGORY_PRESETS[0];
  const matchingStockList = getMatchingStockProducts(currentPreset, allProducts);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-3 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className={`w-full max-w-2xl rounded-3xl border ${themeClasses.border} ${themeClasses.card} shadow-2xl flex flex-col overflow-hidden animate-scaleIn`}>
        
        {/* Header Compacto */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white bg-gradient-to-tr from-amber-600 to-orange-500 shadow-md shrink-0">
              <Scale className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-slate-100 leading-tight">
                Venta por Peso y Balanza (Descuento de Stock)
              </h3>
              <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                Seleccione el producto inventariado, ingrese los gramos/kilos y cobre al instante
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Form Body: Altura fija y sin cambios de tamaño */}
        <form onSubmit={handleAdd} className="p-3 sm:p-4 space-y-2.5">
          
          {/* 1. Categorías Rápidas (10 botones compactos) */}
          {/* 1. Categoría de Producto a Pesar siempre visible */}
            <div>
              <label className="block text-[10.5px] font-black uppercase text-slate-600 dark:text-slate-400 mb-1 tracking-wider">
                1. Categoría de Producto a Pesar
              </label>
              <div className="grid grid-cols-5 gap-1.5">
                {CATEGORY_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectCategory(preset)}
                    className={`py-1.5 px-2 rounded-xl border text-center transition flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                      activeCategory === preset.id
                        ? 'bg-orange-500/15 border-orange-500 text-orange-700 dark:text-orange-300 font-black ring-1 ring-orange-500 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <span className="text-base leading-none">{preset.icon}</span>
                    <span className="text-[10px] font-bold truncate w-full leading-tight">
                      {preset.name.split(' ')[0]}
                    </span>
                  </button>
                ))}
              </div>
            </div>

          {/* 2. Selector de Variedad / Tipo en Stock Inventariado (Exacto para 4 ítems sin scroll, scroll si > 4) */}
          <div className="p-2.5 rounded-2xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-black text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                <Boxes className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>2. Variedad en Stock Inventariado ({matchingStockList.length} disponibles)</span>
              </label>
              {selectedStockProduct && (
                <span className="text-[10.5px] font-black text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/80 px-2 py-0.5 rounded-lg border border-emerald-300 dark:border-emerald-800">
                  Stock actual: {selectedStockProduct.stock} {selectedStockProduct.unit || 'Kg'}
                </span>
              )}
            </div>

            <div className="max-h-[114px] min-h-[106px] overflow-y-auto pr-1 scrollbar-thin">
              {matchingStockList.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {matchingStockList.map((prod) => {
                    const isSelected = selectedStockProduct?.id === prod.id;
                    return (
                      <button
                        key={prod.id}
                        type="button"
                        onClick={() => handleSelectStockItem(prod)}
                        className={`p-1.5 px-2.5 rounded-xl border text-left transition flex items-center justify-between gap-2 cursor-pointer ${
                          isSelected
                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs font-black'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:bg-blue-50 text-slate-800 dark:text-slate-200'
                        }`}
                      >
                        <div className="truncate">
                          <p className="text-xs font-black truncate">{prod.name}</p>
                          <p className={`text-[10px] font-mono ${isSelected ? 'text-blue-100' : 'text-slate-500'}`}>
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
                  <span>No hay ítems registrados en esta categoría. Puedes ingresar el nombre y precio manualmente abajo.</span>
                </div>
              )}
            </div>
          </div>

          {/* 3. Nombre y Precio por Kilo */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-black text-slate-800 dark:text-slate-200 mb-0.5">
                Producto a Descontar *
              </label>
              <input
                type="text"
                required
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="Ej: Jamón Pierna Colonial..."
                className={`w-full px-3 py-1.5 text-xs font-black rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-slate-900 dark:text-slate-100`}
              />
            </div>

            <div>
              <label className="block text-[11px] font-black text-slate-800 dark:text-slate-200 mb-0.5">
                Precio por Kg ($) *
              </label>
              <input
                type="number"
                required
                min="1"
                value={pricePerKg}
                onChange={(e) => setPricePerKg(e.target.value)}
                className={`w-full px-3 py-1.5 text-xs font-black font-mono rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-slate-900 dark:text-slate-100`}
              />
            </div>
          </div>

          {/* 4. Ingreso de Peso en Balanza */}
          <div className="p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-black text-amber-900 dark:text-amber-300 mb-0.5">
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
                    className="w-full px-3 py-1.5 pr-8 text-sm font-black font-mono rounded-xl border border-amber-400 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    Kg
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-amber-900 dark:text-amber-300 mb-0.5">
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
                    className="w-full px-3 py-1.5 pr-8 text-sm font-black font-mono rounded-xl border border-amber-400 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    g
                  </span>
                </div>
              </div>
            </div>


          </div>

          {/* 5. Resumen del Monto a Cobrar */}
          <div className="p-3 rounded-2xl bg-slate-900 text-white flex items-center justify-between shadow-inner">
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                Total a Cobrar
              </p>
              <p className="text-xs text-slate-300">
                {finalQuantityKg > 0
                  ? `${finalQuantityKg} Kg × ${formatCLP(currentPricePerKg)}/Kg`
                  : 'Ingrese el peso en balanza'}
              </p>
            </div>
            <p className="text-xl sm:text-2xl font-black font-mono text-emerald-400">
              {formatCLP(finalSubtotal)}
            </p>
          </div>

          {/* Botones de Acción */}
          <div className="flex items-center justify-end gap-2.5 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={finalQuantityKg <= 0 || currentPricePerKg <= 0}
              className="px-5 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-md shadow-orange-500/20 transition flex items-center gap-2 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
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
