import { useBodyScrollLock } from '../../utils/scrollLock';
import React, { useState, useEffect } from 'react';
import type { Product, Worker } from '../../types';
import { WorkerAutocomplete } from '../workers/WorkerAutocomplete';
import { useTheme } from '../../utils/themeContext';
import { db } from '../../db/database';
import { notifyLocalMutation } from '../../utils/cloudSync';
import {
  X,
  ArrowDownLeft,
  ArrowUpRight,
  Sliders,
  Check,
  ScanLine,
  AlertCircle,
  Package,
  Layers
} from 'lucide-react';

interface StockMovementModalProps {
  isOpen: boolean;
  onClose: () => void;
  product?: Product | null;
  defaultType?: 'ENTRADA' | 'SALIDA' | 'AJUSTE';
  onSaved: () => void;
  onOpenScanner?: () => void;
  scannedBarcode?: string;
}

export const StockMovementModal: React.FC<StockMovementModalProps> = ({
  isOpen,
  onClose,
  product,
  defaultType = 'ENTRADA',
  onSaved,
  onOpenScanner,
  scannedBarcode
}) => {
  useBodyScrollLock(Boolean(isOpen));
  const { themeClasses } = useTheme();

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [searchCode, setSearchCode] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [type, setType] = useState<'ENTRADA' | 'SALIDA' | 'AJUSTE'>(defaultType);
  const [quantity, setQuantity] = useState<number | string>(1);
  const [reason, setReason] = useState('Compra a proveedor / Ingreso');
  const [workerOrSupplier, setWorkerOrSupplier] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [allProducts, setAllProducts] = useState<Product[]>([]);

  useEffect(() => {
    if (isOpen) {
      setType(defaultType);
      setWorkerOrSupplier('');
      setVehiclePlate('');
      setIsDropdownOpen(false);
      loadProducts();

      if (defaultType === 'AJUSTE') {
        setQuantity(product ? product.stock : 0);
        setReason('Cuadratura de inventario físico');
      } else if (defaultType === 'ENTRADA') {
        setQuantity(1);
        setReason('Compra a proveedor / Ingreso');
      } else {
        setQuantity(1);
        setReason('Consumo en faena / mantención');
      }

      if (product) {
        setSelectedProduct(product);
        setSearchCode(`${product.code} - ${product.name}`);
        if (defaultType === 'AJUSTE') setQuantity(product.stock);
      } else if (scannedBarcode) {
        findProductByCode(scannedBarcode);
      } else {
        setSelectedProduct(null);
        setSearchCode('');
      }
    }
  }, [isOpen, product, scannedBarcode, defaultType]);

  const loadProducts = async () => {
    const list = await db.products.toArray();
    setAllProducts(list);
  };

  const findProductByCode = async (codeStr: string) => {
    const clean = codeStr.trim().toUpperCase();
    const found = await db.products.where('code').equals(clean).first() ||
                  await db.products.where('mannFilterCode').equalsIgnoreCase(clean).first();
    if (found) {
      setSelectedProduct(found);
      setSearchCode(`${found.code} - ${found.name}`);
      setIsDropdownOpen(false);
      if (type === 'AJUSTE') setQuantity(found.stock);
    }
  };

  const handleInputChange = (val: string) => {
    setSearchCode(val);
    setIsDropdownOpen(true);

    const clean = val.trim().toUpperCase();
    if (!clean) {
      setSelectedProduct(null);
      return;
    }

    const exactMatch = allProducts.find(p => p.code.toUpperCase() === clean || (p.mannFilterCode && p.mannFilterCode.toUpperCase() === clean));
    if (exactMatch) {
      setSelectedProduct(exactMatch);
      if (type === 'AJUSTE') setQuantity(exactMatch.stock);
    } else if (selectedProduct && !selectedProduct.name.toLowerCase().includes(val.toLowerCase()) && !selectedProduct.code.toLowerCase().includes(val.toLowerCase())) {
      setSelectedProduct(null);
    }
  };

  const handleSelectProduct = (prod: Product) => {
    setSelectedProduct(prod);
    setSearchCode(`${prod.code} - ${prod.name}`);
    setIsDropdownOpen(false);
    if (type === 'AJUSTE') setQuantity(prod.stock);
  };

  const matchingProducts = React.useMemo(() => {
    if (!searchCode.trim() || !isDropdownOpen) return [];
    const term = searchCode.trim().toLowerCase();
    return allProducts.filter(p =>
      p.name.toLowerCase().includes(term) ||
      p.code.toLowerCase().includes(term) ||
      (p.brand && p.brand.toLowerCase().includes(term)) ||
      (p.mannFilterCode && p.mannFilterCode.toLowerCase().includes(term))
    ).slice(0, 8);
  }, [allProducts, searchCode, isDropdownOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) {
      alert('Por favor seleccione un producto del catálogo.');
      return;
    }

    const qtyNum = Number(quantity);
    if (isNaN(qtyNum) || (type !== 'AJUSTE' && qtyNum <= 0) || (type === 'AJUSTE' && qtyNum < 0)) {
      alert('Por favor ingrese una cantidad válida.');
      return;
    }

    const previousStock = selectedProduct.stock || 0;
    let newStock = previousStock;

    if (type === 'ENTRADA') {
      newStock = Number((previousStock + qtyNum).toFixed(3));
    } else if (type === 'SALIDA') {
      if (qtyNum > previousStock) {
        const confirmExceed = confirm(
          `La cantidad a retirar (${qtyNum} ${selectedProduct.unit}) supera el stock actual disponible (${previousStock} ${selectedProduct.unit}).\n\n¿Desea registrar la salida de todas formas?`
        );
        if (!confirmExceed) return;
      }
      newStock = Math.max(0, Number((previousStock - qtyNum).toFixed(3)));
    } else if (type === 'AJUSTE') {
      newStock = Number(qtyNum.toFixed(3));
    }

    // Actualizar producto en Dexie
    await db.products.update(selectedProduct.id!, {
      stock: newStock,
      updatedAt: new Date().toISOString()
    });

    // Registrar movimiento oficial en bitácora de bodega
    await db.productMovements.add({
      productId: selectedProduct.id!,
      productCode: selectedProduct.code,
      productName: selectedProduct.name,
      type: type,
      quantity: type === 'AJUSTE' ? Math.abs(newStock - previousStock) : qtyNum,
      previousStock,
      newStock,
      reason: reason.trim() || 'Movimiento de inventario',
      workerOrSupplier: workerOrSupplier.trim() || (type === 'ENTRADA' ? 'Proveedor' : 'Personal Bodega'),
      vehiclePlate: vehiclePlate.trim() || undefined,
      date: new Date().toISOString(),
      companyId: selectedProduct.companyId || 'market-almacen',
      user: 'Mauricio Chamorro'
    });

    notifyLocalMutation();
    onSaved();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className={`w-full max-w-lg rounded-3xl border-2 ${themeClasses.border} ${themeClasses.card} shadow-2xl flex flex-col overflow-hidden animate-scaleIn`}>
        
        {/* Header con Colores Vivos y Alto Contraste */}
        <div className="flex items-center justify-between px-5 py-4 border-b-2 border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-md shrink-0 ${
              type === 'ENTRADA' ? 'bg-emerald-600' : type === 'SALIDA' ? 'bg-amber-600' : 'bg-blue-600'
            }`}>
              {type === 'ENTRADA' ? <ArrowDownLeft className="w-5 h-5 stroke-[2.5]" /> :
               type === 'SALIDA' ? <ArrowUpRight className="w-5 h-5 stroke-[2.5]" /> :
               <Sliders className="w-5 h-5 stroke-[2.5]" />}
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 leading-tight">
                {type === 'ENTRADA' ? 'Registrar Entrada de Stock' :
                 type === 'SALIDA' ? 'Registrar Salida / Despacho' :
                 'Ajuste y Cuadratura de Stock'}
              </h3>
              <p className="text-xs font-bold text-slate-600 dark:text-slate-400">
                Movimiento instantáneo de inventario y bodega
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-3.5">
          
          {/* Pestañas de Tipo de Movimiento (Visibles y Altamente Contrastadas) */}
          <div className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-slate-200 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700">
            <button
              type="button"
              onClick={() => {
                setType('ENTRADA');
                setReason('Compra a proveedor / Ingreso');
                if (selectedProduct && type === 'AJUSTE') setQuantity(1);
              }}
              className={`py-2 px-2 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer ${
                type === 'ENTRADA'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30 ring-2 ring-emerald-400'
                  : 'text-slate-800 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700'
              }`}
            >
              <ArrowDownLeft className="w-4 h-4 stroke-[2.5]" />
              <span>ENTRADA</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setType('SALIDA');
                setReason('Consumo en faena / mantención');
                if (selectedProduct && type === 'AJUSTE') setQuantity(1);
              }}
              className={`py-2 px-2 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer ${
                type === 'SALIDA'
                  ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30 ring-2 ring-amber-400'
                  : 'text-slate-800 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700'
              }`}
            >
              <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
              <span>SALIDA</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setType('AJUSTE');
                setReason('Cuadratura de inventario físico');
                if (selectedProduct) setQuantity(selectedProduct.stock);
              }}
              className={`py-2 px-2 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer ${
                type === 'AJUSTE'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 ring-2 ring-blue-400'
                  : 'text-slate-800 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700'
              }`}
            >
              <Sliders className="w-4 h-4 stroke-[2.5]" />
              <span>AJUSTE</span>
            </button>
          </div>

          {/* Buscador de Producto */}
          <div className="relative">
            <label className="block text-xs font-black text-slate-900 dark:text-slate-100 mb-1">
              Buscar Producto (por Código o por Nombre) *
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                required
                value={searchCode}
                onChange={(e) => handleInputChange(e.target.value)}
                onFocus={() => setIsDropdownOpen(true)}
                placeholder="Escriba nombre o código (ej: Aceite, Filtro, FIL-001...)"
                className={`w-full px-3.5 py-2.5 text-xs font-black rounded-xl border-2 ${themeClasses.inputBorder} ${themeClasses.inputBg} text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500`}
              />
              {onOpenScanner && (
                <button
                  type="button"
                  onClick={onOpenScanner}
                  className="p-2.5 rounded-xl bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 border-2 border-orange-300 dark:border-orange-700 hover:bg-orange-200 transition cursor-pointer shrink-0 shadow-sm"
                  title="Escanear código con cámara"
                >
                  <ScanLine className="w-5 h-5 stroke-[2.5]" />
                </button>
              )}
            </div>

            {/* Dropdown de productos coincidentes */}
            {isDropdownOpen && matchingProducts.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-2xl shadow-2xl z-50 max-h-56 overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800">
                {matchingProducts.map((p) => (
                  <button
                    key={p.id || p.code}
                    type="button"
                    onClick={() => handleSelectProduct(p)}
                    className="w-full px-3.5 py-2.5 text-left hover:bg-blue-50 dark:hover:bg-slate-800/80 flex items-center justify-between transition group cursor-pointer"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-black px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700">
                          {p.code}
                        </span>
                        <span className="text-xs font-black text-slate-900 dark:text-slate-100 group-hover:text-blue-600">
                          {p.name}
                        </span>
                      </div>
                      <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-0.5 flex gap-2">
                        <span>{p.category}</span>
                        {p.brand && <span>• Marca: {p.brand}</span>}
                        {p.location && <span>• Ubic: {p.location}</span>}
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <span className="text-xs font-mono font-black text-emerald-600 dark:text-emerald-400">
                        {p.stock} {p.unit || 'UN'}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Ficha del Producto Seleccionado o Aviso */}
          {selectedProduct ? (
            <div className="p-3.5 rounded-2xl border-2 border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/40 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-black text-sm text-slate-900 dark:text-slate-100">{selectedProduct.name}</span>
                <span className="text-xs font-mono font-black text-blue-700 dark:text-blue-300">{selectedProduct.code}</span>
              </div>
              <div className="flex flex-wrap gap-x-3 text-xs font-bold text-slate-700 dark:text-slate-300">
                <span>Stock Actual: <strong className="text-emerald-700 dark:text-emerald-400 font-mono font-black">{selectedProduct.stock} {selectedProduct.unit || 'UN'}</strong></span>
                <span>Ubicación: <strong className="text-slate-900 dark:text-slate-100 font-black">{selectedProduct.location || 'Sin asignar'}</strong></span>
                {selectedProduct.price && <span>Precio: <strong className="text-slate-900 dark:text-slate-100 font-mono font-black">${selectedProduct.price.toLocaleString('es-CL')}</strong></span>}
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-300 dark:border-amber-700 text-xs font-black text-amber-900 dark:text-amber-200 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>Seleccione un producto escribiendo en la barra superior o use la cámara.</span>
            </div>
          )}

          {/* Cantidad y Responsable */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-black text-slate-900 dark:text-slate-100 mb-1">
                {type === 'AJUSTE' ? 'Nuevo Stock Real Físico *' : 'Cantidad a Mover *'}
              </label>
              <input
                type="number"
                min="0"
                step="any"
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className={`w-full px-3.5 py-2 text-sm font-black font-mono rounded-xl border-2 ${themeClasses.inputBorder} ${themeClasses.inputBg} text-slate-900 dark:text-slate-100`}
              />
              {type === 'AJUSTE' && selectedProduct && (
                <div className="mt-1 text-[11px] font-bold">
                  {Number(quantity) === selectedProduct.stock ? (
                    <span className="text-slate-500">✓ El stock ingresado es idéntico al del sistema.</span>
                  ) : Number(quantity) > selectedProduct.stock ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-black">
                      ▲ Incremento de +{(Number(quantity) - selectedProduct.stock).toFixed(2)} {selectedProduct.unit}
                    </span>
                  ) : (
                    <span className="text-red-600 dark:text-red-400 font-black">
                      ▼ Reducción / Merma de {(Number(quantity) - selectedProduct.stock).toFixed(2)} {selectedProduct.unit}
                    </span>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-black text-slate-900 dark:text-slate-100 mb-1">
                {type === 'ENTRADA' ? 'Proveedor / Procedencia' : type === 'SALIDA' ? 'Trabajador / Receptor' : 'Encargado de Cuadratura'}
              </label>
              <WorkerAutocomplete
                value={workerOrSupplier}
                onChange={setWorkerOrSupplier}
                onSelect={(w: Worker) => setWorkerOrSupplier(w.name)}
                placeholder={type === 'ENTRADA' ? 'Distribuidora Mann...' : type === 'SALIDA' ? 'Carlos Morales (Mecánico)' : 'Mauricio Chamorro'}
                className={`w-full px-3.5 py-2 text-xs font-black rounded-xl border-2 ${themeClasses.inputBorder} ${themeClasses.inputBg} text-slate-900 dark:text-slate-100`}
                filterType={type === 'ENTRADA' ? ['PROVEEDOR', 'TRANSPORTISTA'] : ['TRABAJADOR', 'OTRO']}
              />
            </div>
          </div>

          {/* Patente Vehicular si es Salida */}
          {type === 'SALIDA' && (
            <div>
              <label className="block text-xs font-black text-slate-900 dark:text-slate-100 mb-1">
                Patente Vehicular / Equipo
              </label>
              <input
                type="text"
                value={vehiclePlate}
                onChange={(e) => setVehiclePlate(e.target.value.toUpperCase())}
                placeholder="Ej: AB-CD-12 O CAMIÓN #14"
                className={`w-full px-3.5 py-2 text-xs font-mono font-black uppercase rounded-xl border-2 ${themeClasses.inputBorder} ${themeClasses.inputBg} text-slate-900 dark:text-slate-100`}
              />
            </div>
          )}

          {/* Motivo */}
          <div>
            <label className="block text-xs font-black text-slate-900 dark:text-slate-100 mb-1">
              Motivo / Justificación *
            </label>
            <input
              type="text"
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej: Mantención preventiva / Reposición stock / Conteo físico"
              className={`w-full px-3.5 py-2 text-xs font-bold rounded-xl border-2 ${themeClasses.inputBorder} ${themeClasses.inputBg} text-slate-900 dark:text-slate-100`}
            />
          </div>

          {/* Botones de Acción */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t-2 border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-black rounded-xl border-2 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!selectedProduct}
              className={`flex items-center gap-1.5 px-6 py-2 text-xs font-black rounded-xl transition cursor-pointer shadow-md active:scale-95 ${
                !selectedProduct
                  ? 'bg-slate-300 dark:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-not-allowed'
                  : type === 'ENTRADA'
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
                  : type === 'SALIDA'
                  ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/30'
                  : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30'
              }`}
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>
                {type === 'ENTRADA' ? 'Confirmar Ingreso' :
                 type === 'SALIDA' ? 'Confirmar Salida' :
                 'Confirmar Ajuste y Cuadratura'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
