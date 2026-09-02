import { useBodyScrollLock } from '../../utils/scrollLock';
import React, { useState } from 'react';
import { useTheme } from '../../utils/themeContext';
import { useAuth } from '../../utils/authContext';
import { db } from '../../db/database';
import type { Product } from '../../types';
import {
  X,
  Boxes,
  Barcode,
  ArrowDownLeft,
  ArrowUpRight,
  Sliders,
  Edit2,
  Trash2,
  Calendar,
  MapPin,
  Tag,
  DollarSign,
  AlertTriangle,
  Layers,
  Sparkles,
  History
} from 'lucide-react';

interface ProductDetailModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (product: Product) => void;
  onDelete: (id?: number) => void;
  onOpenMovement: (product: Product, type: 'ENTRADA' | 'SALIDA' | 'AJUSTE') => void;
  onOpenBarcode: (product: Product) => void;
  onOpenPhotoViewer?: (product: Product) => void;
  onOpenMovementsHistory?: (product: Product) => void;
  onProductUpdated?: () => void;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product: initialProduct,
  isOpen,
  onClose,
  onEdit,
  onDelete,
  onOpenMovement,
  onOpenBarcode,
  onOpenPhotoViewer,
  onOpenMovementsHistory,
  onProductUpdated
}) => {
  useBodyScrollLock(Boolean(isOpen));
  const { themeClasses } = useTheme();
  const { isReadOnly, canDeleteProducts } = useAuth();

  const [currentProduct, setCurrentProduct] = useState<Product | null>(initialProduct);
  const [isOfferModalOpen, setIsOfferModalOpen] = useState(false);
  const [offerPriceInput, setOfferPriceInput] = useState<number | string>('');
  const [offerStockLimitInput, setOfferStockLimitInput] = useState<number | string>('');
  const [offerLabelInput, setOfferLabelInput] = useState<string>('Liquidación');

  React.useEffect(() => {
    setCurrentProduct(initialProduct);
  }, [initialProduct]);

  if (!isOpen || !currentProduct) return null;

  const product = currentProduct;
  const isCritical = (product.stock || 0) <= (product.minStock || 0);
  const hasOffer = Boolean(product.offerPrice && product.offerPrice > 0 && (product.offerStockRemaining === undefined || product.offerStockRemaining > 0));
  const offerStockRem = product.offerStockRemaining !== undefined ? product.offerStockRemaining : (product.offerStockLimit || 0);

  const handleOpenOfferModal = () => {
    setOfferPriceInput(product.offerPrice || Math.round((product.price || 1000) * 0.8));
    setOfferStockLimitInput(product.offerStockRemaining || Math.min(20, product.stock));
    setOfferLabelInput(product.offerLabel || 'Liquidación');
    setIsOfferModalOpen(true);
  };

  const handleSaveOffer = async () => {
    if (!product.id) return;
    const p = Number(offerPriceInput);
    const q = Number(offerStockLimitInput);

    if (isNaN(p) || p <= 0) {
      alert('Ingrese un precio de oferta válido.');
      return;
    }
    if (isNaN(q) || q <= 0) {
      alert('Ingrese una cantidad válida de unidades.');
      return;
    }

    const updatedData = {
      offerPrice: p,
      offerStockLimit: q,
      offerStockRemaining: q,
      offerLabel: offerLabelInput.trim() || 'Liquidación'
    };

    await db.products.update(product.id, updatedData);
    setCurrentProduct({ ...product, ...updatedData });
    setIsOfferModalOpen(false);
    if (onProductUpdated) onProductUpdated();
    alert('✅ Liquidación por lote activada para ' + q + ' unidades a $' + p.toLocaleString('es-CL'));
  };

  const handleRemoveOffer = async () => {
    if (!product.id) return;
    const updatedData = {
      offerPrice: undefined,
      offerStockLimit: undefined,
      offerStockRemaining: undefined,
      offerLabel: undefined
    };
    await db.products.update(product.id, updatedData);
    setCurrentProduct({ ...product, ...updatedData });
    setIsOfferModalOpen(false);
    if (onProductUpdated) onProductUpdated();
    alert('✅ Liquidación/oferta quitada. Todas las unidades vuelven a precio normal.');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className={`w-full max-w-4xl max-h-[94vh] rounded-3xl border-2 ${themeClasses.border} ${themeClasses.card} shadow-2xl flex flex-col overflow-hidden animate-scaleIn`}>
        
        {/* Header Amplio y Elegante */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b-2 border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-white bg-blue-600 shadow-md shrink-0">
              <Boxes className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="font-mono font-black text-orange-600 dark:text-orange-400 text-xs sm:text-sm tracking-wider bg-orange-50 dark:bg-orange-950/60 px-2.5 py-0.5 rounded-lg border border-orange-300 dark:border-orange-700">
                  {product.code}
                </span>
                <span className={`px-3 py-0.5 rounded-full text-xs font-black border shadow-xs ${
                  hasOffer
                    ? 'bg-amber-500 text-white border-amber-600 animate-pulse'
                    : product.condition === 'DISPONIBLE' || product.condition === 'NUEVO'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-700'
                    : 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-700'
                }`}>
                  {hasOffer ? `🔥 ${offerStockRem} EN LIQUIDACIÓN` : (product.condition || 'DISPONIBLE')}
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 leading-tight mt-0.5 truncate">
                {product.name}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cuerpo Amplio sin Scroll */}
        <div className="p-5 space-y-4 overflow-y-auto">
          
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
            
            {/* Foto Amplia a la Izquierda */}
            <div className="sm:col-span-4 flex flex-col items-center justify-center p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border-2 border-slate-200 dark:border-slate-800 h-full max-h-44">
              {product.imageUrl ? (
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  onClick={() => onOpenPhotoViewer && onOpenPhotoViewer(product)}
                  className="max-h-36 max-w-full object-contain rounded-xl cursor-pointer hover:scale-105 transition shadow-xs"
                  title="Clic para ampliar foto"
                />
              ) : (
                <div className="py-8 text-center text-slate-400">
                  <Boxes className="w-12 h-12 mx-auto opacity-40 mb-1" />
                  <span className="text-xs font-bold">Sin Imagen</span>
                </div>
              )}
            </div>

            {/* Cuadrícula de 4 Fichas Informativas Grandes y Legibles */}
            <div className="sm:col-span-8 grid grid-cols-2 gap-3 text-xs">
              
              {/* 1. Categoría & Marca */}
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border-2 border-slate-200 dark:border-slate-700 space-y-1">
                <span className="font-black text-blue-700 dark:text-blue-400 uppercase text-[10.5px] tracking-wider flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5" /> Categoría & Marca
                </span>
                <p className="font-black text-sm text-slate-900 dark:text-slate-100 truncate">{product.category}</p>
                <p className="text-slate-600 dark:text-slate-400 font-bold truncate">Marca: <span className="font-black text-slate-800 dark:text-slate-200">{product.brand || 'Genérica'}</span></p>
              </div>

              {/* 2. Stock en Bodega */}
              <div className={`p-3 rounded-2xl border-2 space-y-1 ${
                isCritical 
                  ? 'bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800' 
                  : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700'
              }`}>
                <span className={`font-black uppercase text-[10.5px] tracking-wider flex items-center gap-1.5 ${isCritical ? 'text-red-700 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                  <Layers className="w-3.5 h-3.5" /> Stock en Bodega
                </span>
                <div className="flex items-baseline gap-2">
                  <span className={`text-base sm:text-lg font-black font-mono ${isCritical ? 'text-red-700 dark:text-red-400' : 'text-slate-900 dark:text-slate-100'}`}>
                    {product.stock} {product.unit || 'UN'}
                  </span>
                  {isCritical && (
                    <span className="text-[10px] font-black text-red-600 flex items-center gap-0.5">
                      <AlertTriangle className="w-3 h-3" /> ¡Crítico!
                    </span>
                  )}
                </div>
                <p className="text-slate-500 font-bold text-[11px]">Mínimo Alerta: {product.minStock || 0} {product.unit || 'UN'}</p>
              </div>

              {/* 3. Precios & Ofertas */}
              <div className={`p-3 rounded-2xl border-2 space-y-1 ${hasOffer ? 'bg-amber-50/90 dark:bg-amber-950/40 border-amber-400 dark:border-amber-600' : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700'}`}>
                <span className={`font-black uppercase text-[10.5px] tracking-wider flex items-center gap-1.5 ${hasOffer ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                  <DollarSign className="w-3.5 h-3.5" /> {hasOffer ? 'Precios (Con Oferta Activa)' : 'Precios'}
                </span>
                <div className="flex items-baseline gap-1.5 flex-wrap">
                  <p className="text-sm font-black text-slate-800 dark:text-slate-200">
                    Venta: <span className={`font-black font-mono text-base ${hasOffer ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-400'}`}>${(hasOffer ? product.offerPrice! : (product.price || 0)).toLocaleString('es-CL')}</span>
                  </p>
                  {hasOffer && (
                    <span className="text-xs font-mono line-through opacity-50">
                      ${(product.price || 0).toLocaleString('es-CL')}
                    </span>
                  )}
                </div>
                <p className="text-slate-500 font-bold text-[11px]">Costo: ${(product.costPrice || 0).toLocaleString('es-CL')}</p>
              </div>

              {/* 4. Ubicación & Vencimiento */}
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border-2 border-slate-200 dark:border-slate-700 space-y-1">
                <span className="font-black text-amber-700 dark:text-amber-400 uppercase text-[10.5px] tracking-wider flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" /> Ubicación & Vencimiento
                </span>
                <p className="font-black text-sm text-slate-900 dark:text-slate-100 truncate">{product.location || 'Bodega Principal'}</p>
                <p className="text-slate-500 font-bold text-[11px] flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-slate-400" />
                  <span>Vto: {product.expiryDate || 'No registra'}</span>
                </p>
              </div>

            </div>

          </div>

          {/* ACCIONES DE INVENTARIO Y GESTIÓN ORGANIZADAS EN BLOQUES EQUILIBRADOS */}
          <div className="pt-2.5 border-t border-slate-200 dark:border-slate-800/80 space-y-3">
            
            {/* BLOQUE 1: MOVIMIENTOS DE STOCK & AUDITORÍA (4 BOTONES) */}
            <div>
              <span className="text-[10.5px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 block mb-1.5 flex items-center gap-1.5">
                <Boxes className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                <span>Movimientos de Stock & Auditoría</span>
              </span>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {/* 1. Entrada de Stock */}
                {!isReadOnly && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenMovement(product, 'ENTRADA');
                    }}
                    className="h-10 sm:h-11 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 font-black text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
                    title="Registrar entrada de mercadería (Stock +)"
                  >
                    <ArrowDownLeft className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 stroke-[2.5]" />
                    <span>Entrada</span>
                  </button>
                )}

                {/* 2. Salida de Stock */}
                {!isReadOnly && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenMovement(product, 'SALIDA');
                    }}
                    className="h-10 sm:h-11 px-3 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 font-black text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
                    title="Registrar salida o traspaso (Stock -)"
                  >
                    <ArrowUpRight className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 stroke-[2.5]" />
                    <span>Salida</span>
                  </button>
                )}

                {/* 3. Ajuste de Stock */}
                {!isReadOnly && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenMovement(product, 'AJUSTE');
                    }}
                    className="h-10 sm:h-11 px-3 rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-800 font-black text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
                    title="Ajuste o cuadratura de inventario"
                  >
                    <Sliders className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                    <span>Ajuste</span>
                  </button>
                )}

                {/* 4. Kardex / Historial de Movimientos */}
                {!isReadOnly && onOpenMovementsHistory && (
                  <button
                    type="button"
                    onClick={() => onOpenMovementsHistory(currentProduct || product)}
                    className="h-10 sm:h-11 px-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800 font-black text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
                    title="[Exclusivo Administrador] Consultar trazabilidad completa y Kardex"
                  >
                    <History className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 stroke-[2.2]" />
                    <span>Kardex</span>
                  </button>
                )}
              </div>
            </div>

            {/* BLOQUE 2: GESTIÓN COMERCIAL & FICHA TÉCNICA (4 BOTONES) */}
            <div>
              <span className="text-[10.5px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 block mb-1.5 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span>Gestión Comercial & Ficha Técnica</span>
              </span>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {/* 5. Liquidar / Modo Oferta */}
                {!isReadOnly && (
                  <button
                    type="button"
                    onClick={handleOpenOfferModal}
                    className={`h-10 sm:h-11 px-3 rounded-xl font-black text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs active:scale-95 ${
                      hasOffer
                        ? 'bg-amber-500 text-white border border-amber-600 hover:bg-amber-600 shadow-sm'
                        : 'bg-orange-50 hover:bg-orange-100 dark:bg-orange-950/50 text-orange-800 dark:text-orange-300 border border-orange-300 dark:border-orange-800'
                    }`}
                    title="Configurar precio rebajado por lote acotado"
                  >
                    <Tag className="w-4 h-4 shrink-0" />
                    <span>{hasOffer ? 'En Oferta' : 'Liquidar'}</span>
                  </button>
                )}

                {/* 6. Imprimir Código de Barras */}
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenBarcode(product);
                  }}
                  className="h-10 sm:h-11 px-3 rounded-xl bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-800 font-black text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
                  title="Generar e imprimir etiquetas con código de barras"
                >
                  <Barcode className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                  <span>Código</span>
                </button>

                {/* 7. Editar Ficha del Producto */}
                {!isReadOnly && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onEdit(product);
                    }}
                    className="h-10 sm:h-11 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 font-black text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
                    title="Editar datos, precios y stock mínimo"
                  >
                    <Edit2 className="w-4 h-4 text-slate-600 dark:text-slate-400 shrink-0" />
                    <span>Editar</span>
                  </button>
                )}

                {/* 8. Eliminar Producto */}
                {canDeleteProducts && !isReadOnly && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onDelete(product.id);
                    }}
                    className="h-10 sm:h-11 px-3 rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 font-black text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
                    title="Dar de baja producto del catálogo"
                  >
                    <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
                    <span>Eliminar</span>
                  </button>
                )}
              </div>
            </div>

          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t-2 border-slate-200 dark:border-slate-800 flex justify-end bg-slate-100 dark:bg-slate-900/90 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 text-xs font-black rounded-xl bg-slate-800 hover:bg-slate-700 text-white transition cursor-pointer shadow-sm"
          >
            Cerrar Ficha
          </button>
        </div>

      </div>

      {/* Modal de Liquidación / Oferta por Lote */}
      {isOfferModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg rounded-3xl border-2 border-amber-400 bg-white dark:bg-slate-900 shadow-2xl p-5 space-y-4 animate-scaleIn">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-black shrink-0">
                  <Tag className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base text-slate-900 dark:text-white">
                    Modo Liquidación / Oferta por Lote
                  </h3>
                  <p className="text-[11px] font-bold text-slate-500">
                    Baja el precio solo a una cantidad de unidades sin alterar el resto del stock
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOfferModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-amber-50/90 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-700 space-y-1.5">
              <p className="text-xs sm:text-sm font-black text-slate-900 dark:text-slate-100">{product.name}</p>
              <div className="flex justify-between text-xs font-bold text-slate-600 dark:text-slate-300 font-mono">
                <span>Precio Normal: ${(product.price || 0).toLocaleString('es-CL')}</span>
                <span>Stock Total en Bodega: {product.stock} {product.unit || 'UN'}</span>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-xs font-black text-slate-800 dark:text-slate-200 mb-1">
                  1. Cantidad de Unidades a Dejar en Oferta / Liquidación *
                </label>
                <input
                  type="number"
                  min="1"
                  max={product.stock}
                  required
                  value={offerStockLimitInput}
                  onChange={(e) => setOfferStockLimitInput(e.target.value)}
                  placeholder="Ej: 20 (de las 100 disponibles)"
                  className="w-full px-3.5 py-2.5 rounded-xl border-2 border-amber-400 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-black text-sm focus:outline-none"
                />
                <div className="mt-1.5 p-2 rounded-xl bg-amber-100/60 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 text-[11px] text-amber-900 dark:text-amber-200 font-bold space-y-1">
                  <p>• Solo estas unidades se venderán con precio rebajado. Al agotarse, el producto <strong>volverá automáticamente al precio normal</strong> de ${(product.price || 0).toLocaleString('es-CL')}.</p>
                  <p>• Al cobrar en caja (POS), el vendedor podrá <strong>elegir cuál de los dos precios</strong> es el que el cliente lleva.</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-800 dark:text-slate-200 mb-1">
                  2. Precio de Oferta / Liquidación por Unidad ($) *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={offerPriceInput}
                  onChange={(e) => setOfferPriceInput(e.target.value)}
                  placeholder="Ej: 2200"
                  className="w-full px-3.5 py-2.5 rounded-xl border-2 border-amber-400 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-black text-sm focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-800 dark:text-slate-200 mb-1">
                  3. Motivo o Etiqueta de la Oferta
                </label>
                <input
                  type="text"
                  value={offerLabelInput}
                  onChange={(e) => setOfferLabelInput(e.target.value)}
                  placeholder="Ej: Liquidación por Vencimiento / Oferta Especial"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-bold focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
              {product.offerPrice ? (
                <button
                  type="button"
                  onClick={handleRemoveOffer}
                  className="px-4 py-2.5 rounded-xl text-xs font-black text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 cursor-pointer"
                >
                  Quitar Liquidación
                </button>
              ) : <div />}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsOfferModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold border border-slate-300 dark:border-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveOffer}
                  className="px-5 py-2.5 rounded-xl text-xs font-black bg-gradient-to-r from-amber-600 to-orange-500 hover:from-amber-500 hover:to-orange-400 text-white shadow-md transition cursor-pointer active:scale-95 flex items-center gap-1.5"
                >
                  <Tag className="w-4 h-4" />
                  <span>Aplicar Liquidación por Lote</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
