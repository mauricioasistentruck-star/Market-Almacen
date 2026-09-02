import React, { useState, useEffect } from 'react';
import { db } from '../../db/database';
import type { Product } from '../../types';
import { useTheme } from '../../utils/themeContext';
import { useCompany } from '../../utils/companyContext';
import {
  Search,
  ScanLine,
  X,
  Package,
  Boxes,
  MapPin,
  Tag,
  AlertTriangle,
  CheckCircle2,
  Barcode,
  Sparkles
} from 'lucide-react';
import { BarcodeScannerModal } from '../BarcodeScannerModal';

interface ProductConsultantModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProductConsultantModal: React.FC<ProductConsultantModalProps> = ({
  isOpen,
  onClose
}) => {
  const { themeClasses } = useTheme();
  const { selectedCompanyId } = useCompany();

  const [query, setQuery] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedProduct(null);
      loadAllProducts();
    }
  }, [isOpen, selectedCompanyId]);

  const loadAllProducts = async () => {
    try {
      let list = await db.products.toArray();
      if (selectedCompanyId && selectedCompanyId !== 'ALL') {
        list = list.filter(p => !p.companyId || p.companyId === selectedCompanyId);
      }
      setProducts(list);
    } catch (e) {
      console.warn('Error loading products in consultant:', e);
    }
  };

  if (!isOpen) return null;

  const filtered = products.filter(p => {
    if (!query.trim()) return false;
    const q = query.trim().toLowerCase();
    return (
      (p.code && p.code.toLowerCase().includes(q)) ||
      (p.name && p.name.toLowerCase().includes(q)) ||
      (p.category && p.category.toLowerCase().includes(q)) ||
      (p.brand && p.brand.toLowerCase().includes(q))
    );
  }).slice(0, 15);

  const handleScan = (code: string) => {
    setIsScannerOpen(false);
    setQuery(code);
    const exact = products.find(p => p.code?.toLowerCase() === code.toLowerCase());
    if (exact) {
      setSelectedProduct(exact);
    }
  };

  const handleSelect = (p: Product) => {
    setSelectedProduct(p);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      <div className={`w-full max-w-xl max-h-[92vh] flex flex-col rounded-3xl border-2 ${themeClasses.border} ${themeClasses.card} shadow-2xl overflow-hidden`}>
        
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white shadow-md">
              <Search className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-base text-white flex items-center gap-1.5">
                <span>Consultor de Productos</span>
                <span className="text-[10px] font-black bg-white/25 px-2 py-0.5 rounded-full">
                  Stock & Precios
                </span>
              </h3>
              <p className="text-[11px] text-blue-100 font-medium">
                Escanea o busca para verificar precio y stock en segundos
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white/80 hover:text-white hover:bg-white/20 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar & Scanner Button */}
        <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 shrink-0 space-y-2">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                autoFocus
                placeholder="Escribe nombre o código de barras..."
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  const exact = products.find(p => p.code?.toLowerCase() === e.target.value.trim().toLowerCase());
                  if (exact) setSelectedProduct(exact);
                }}
                className={`w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm font-bold rounded-2xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} focus:outline-hidden focus:ring-2 focus:ring-blue-500`}
              />
              {query && (
                <button
                  type="button"
                  onClick={() => { setQuery(''); setSelectedProduct(null); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setIsScannerOpen(true)}
              className="h-10 px-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs flex items-center gap-1.5 shadow-md active:scale-95 transition cursor-pointer shrink-0"
              title="Escanear con la cámara"
            >
              <ScanLine className="w-4 h-4" />
              <span className="hidden sm:inline">Escanear</span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-3 custom-scrollbar">
          {selectedProduct ? (
            <div className="space-y-3 animate-fadeIn">
              <div className="p-4 rounded-2xl border-2 border-blue-500/40 bg-blue-500/5 dark:bg-blue-500/10 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="w-16 h-16 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0 overflow-hidden shadow-sm">
                    {selectedProduct.imageUrl ? (
                      <img src={selectedProduct.imageUrl} alt={selectedProduct.name} className="w-full h-full object-cover" />
                    ) : (
                      <Boxes className="w-8 h-8 text-blue-500/60" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[11px] font-mono font-black text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-950 px-2 py-0.5 rounded-md">
                      {selectedProduct.code || 'SIN CÓDIGO'}
                    </span>
                    <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white mt-1 leading-snug">
                      {selectedProduct.name}
                    </h2>
                    <p className="text-xs font-semibold text-slate-500 mt-0.5">
                      {selectedProduct.category || 'General'} {selectedProduct.brand ? `• ${selectedProduct.brand}` : ''}
                    </p>
                  </div>
                </div>

                {/* Precios y Stock */}
                <div className="grid grid-cols-2 gap-2.5 pt-2">
                  <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                    <span className="text-[10.5px] font-extrabold uppercase tracking-wider text-slate-500 block">
                      Precio de Venta
                    </span>
                    <span className="text-xl sm:text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400 block mt-0.5">
                      ${Math.round(selectedProduct.price || 0).toLocaleString('es-CL')}
                    </span>
                    {selectedProduct.offerPrice && selectedProduct.offerPrice > 0 && (
                      <span className="text-[10px] font-black text-amber-600 dark:text-amber-400 block mt-1">
                        Oferta: ${Math.round(selectedProduct.offerPrice).toLocaleString('es-CL')}
                      </span>
                    )}
                  </div>

                  <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                    <span className="text-[10.5px] font-extrabold uppercase tracking-wider text-slate-500 block">
                      Stock en Tienda
                    </span>
                    <span className={`text-xl sm:text-2xl font-black font-mono block mt-0.5 ${
                      (selectedProduct.stock || 0) <= (selectedProduct.minStock || 0)
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-blue-600 dark:text-blue-400'
                    }`}>
                      {selectedProduct.stock} <span className="text-xs font-bold text-slate-500">{selectedProduct.unit || 'UN'}</span>
                    </span>
                    <span className="text-[10px] font-bold text-slate-500 block mt-1">
                      Mínimo: {selectedProduct.minStock || 0} {selectedProduct.unit || 'UN'}
                    </span>
                  </div>
                </div>

                {/* Ubicación */}
                <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                    <MapPin className="w-4 h-4 text-orange-500" />
                    <span className="font-bold">Ubicación:</span>
                    <span className="font-black text-slate-900 dark:text-white font-mono">
                      {selectedProduct.location || 'Sin Ubicación Asignada'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedProduct(null)}
                    className="text-xs font-black text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    Consultar otro
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div>
              {query.trim() === '' ? (
                <div className="py-12 text-center text-slate-400 space-y-2">
                  <ScanLine className="w-12 h-12 mx-auto text-blue-500/40" />
                  <p className="font-black text-sm text-slate-600 dark:text-slate-300">
                    Ingresa un nombre o escanea con la cámara
                  </p>
                  <p className="text-xs text-slate-500">
                    Total productos en catálogo: {products.length}
                  </p>
                </div>
              ) : filtered.length === 0 ? (
                <div className="py-10 text-center text-slate-400 space-y-1">
                  <AlertTriangle className="w-8 h-8 mx-auto text-amber-500/60" />
                  <p className="font-black text-sm text-slate-700 dark:text-slate-300">
                    No se encontró ningún producto con "{query}"
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-black uppercase text-slate-400 px-1">
                    Resultados coincidentes ({filtered.length}):
                  </p>
                  {filtered.map(p => (
                    <div
                      key={p.id}
                      onClick={() => handleSelect(p)}
                      className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 hover:bg-blue-50 dark:hover:bg-slate-800 flex items-center justify-between gap-3 cursor-pointer transition active:scale-98 shadow-xs"
                    >
                      <div className="min-w-0">
                        <span className="font-mono text-[10.5px] font-black text-blue-600 dark:text-blue-400">
                          {p.code}
                        </span>
                        <h4 className="text-xs font-black text-slate-900 dark:text-white truncate">
                          {p.name}
                        </h4>
                        <span className="text-[10px] text-slate-500 font-bold">
                          {p.location ? `📍 ${p.location}` : 'Sin ubicación'}
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-black font-mono text-emerald-600 dark:text-emerald-400 block">
                          ${Math.round(p.price || 0).toLocaleString('es-CL')}
                        </span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-slate-700 dark:text-slate-300">
                          Stock: {p.stock}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 flex items-center justify-between shrink-0">
          <span className="text-[11px] font-bold text-slate-500">
            {products.length} productos registrados
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-xs font-black text-slate-800 dark:text-slate-200 transition cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>

      {isScannerOpen && (
        <BarcodeScannerModal
          isOpen={isScannerOpen}
          onClose={() => setIsScannerOpen(false)}
          onScan={handleScan}
        />
      )}
    </div>
  );
};
