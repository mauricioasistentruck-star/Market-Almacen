import React, { useState } from 'react';
import { Product } from '../../types';
import { useTheme } from '../../utils/themeContext';
import {
  X,
  Plus,
  Package,
  Settings,
  Sparkles,
  Check,
  ShoppingCart
} from 'lucide-react';

interface QuickProductsPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onAddToCart: (product: Product) => void;
  onOpenConfig: () => void;
}

export const QuickProductsPickerModal: React.FC<QuickProductsPickerModalProps> = ({
  isOpen,
  onClose,
  products,
  onAddToCart,
  onOpenConfig
}) => {
  const { themeClasses } = useTheme();
  const [addedId, setAddedId] = useState<number | null>(null);

  if (!isOpen) return null;

  const handlePick = (p: Product) => {
    onAddToCart(p);
    if (p.id) {
      setAddedId(p.id);
      setTimeout(() => setAddedId(null), 700);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-2xl max-h-[92vh] rounded-3xl border ${themeClasses.border} ${themeClasses.card} shadow-2xl flex flex-col overflow-hidden animate-scaleIn`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50 dark:bg-slate-900/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-slate-100">
                  9 Productos Rápidos
                </h3>
                <span className="text-[10px] font-black px-2 py-0.2 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                  Top Demanda
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Toca cualquier producto para sumarlo directamente al carrito de cobro
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onOpenConfig}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition"
              title="Personalizar cuáles son los 9 productos"
            >
              <Settings className="w-3.5 h-3.5 text-blue-500" />
              <span className="hidden sm:inline">Personalizar</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition"
              title="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body: 3x3 Grid */}
        <div className="flex-1 p-3 sm:p-4 overflow-y-auto">
          {products.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <Package className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto" />
              <p className="text-sm font-bold text-slate-500">
                No hay productos configurados en el catálogo aún.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
              {products.slice(0, 9).map((p, idx) => {
                const isJustAdded = addedId === p.id;

                return (
                  <div
                    key={p.id || idx}
                    onClick={() => handlePick(p)}
                    className={`p-3 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between select-none active:scale-95 ${
                      isJustAdded
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/50 shadow-lg'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-400 dark:hover:border-blue-600 shadow-sm'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 pb-1">
                        <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px] font-black flex items-center justify-center">
                          #{idx + 1}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 font-mono">
                          Stock: {p.stock}
                        </span>
                      </div>
                      <h4 className="text-xs font-black text-slate-900 dark:text-slate-100 line-clamp-2 leading-tight pt-0.5">
                        {p.name}
                      </h4>
                      <p className="text-[10px] font-bold text-slate-400 font-mono">
                        {p.code}
                      </p>
                    </div>

                    <div className="pt-2 flex items-center justify-between border-t border-slate-100 dark:border-slate-800 mt-2">
                      <span className="text-sm font-mono font-black text-emerald-600 dark:text-emerald-400">
                        ${Math.round(p.price || 0).toLocaleString('es-CL')}
                      </span>
                      <button
                        type="button"
                        className={`p-1.5 rounded-xl font-black text-xs flex items-center gap-1 transition ${
                          isJustAdded
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'bg-blue-600 hover:bg-blue-500 text-white shadow-sm'
                        }`}
                      >
                        {isJustAdded ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span className="text-[10px]">Listo</span>
                          </>
                        ) : (
                          <>
                            <Plus className="w-3.5 h-3.5" />
                            <span className="text-[10px]">Sumar</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/60 text-xs">
          <span className="text-slate-500 font-bold flex items-center gap-1">
            <ShoppingCart className="w-4 h-4 text-blue-500" />
            <span>Los productos tocados se añaden al carrito en vivo</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl font-black bg-slate-800 hover:bg-slate-700 text-white transition active:scale-95 cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
