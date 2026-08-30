import React, { useState, useEffect, useMemo } from 'react';
import { useTheme } from '../../utils/themeContext';
import { useCompany } from '../../utils/companyContext';
import { useAuth } from '../../utils/authContext';
import { db } from '../../db/database';
import type { Product, Sale, SaleItem } from '../../types';
import { formatCLP, formatRut, getDteLabel, getPaymentMethodLabel, generateSaleThermalTicketPDF, generateSaleInvoicePDF } from '../../utils/salesPdfGenerator';
import { exportSalesLedgerExcel } from '../../utils/salesExcelExporter';
import { PDFViewerModal } from '../PDFViewerModal';
import { SiiConfigModal } from './SiiConfigModal';
import { SaleCheckoutModal } from './SaleCheckoutModal';
import { SaleDetailsModal } from './SaleDetailsModal';
import { CashClosingModal } from './CashClosingModal';
import { WeighableProductModal } from './WeighableProductModal';
import {
  X,
  RotateCcw,
  ShoppingCart,
  Receipt,
  Search,
  Plus,
  Tag,
  Minus,
  Trash2,
  Barcode,
  FileSpreadsheet,
  FileText,
  Building,
  Printer,
  Eye,
  Settings,
  Lock,
  Boxes,
  Package,
  Calendar,
  CheckCircle2,
  DollarSign,
  Scale,
  Sparkles,
  SlidersHorizontal,
  CheckSquare,
  Square
} from 'lucide-react';

interface SalesViewProps {
  onOpenScanner?: () => void;
  scannedBarcode?: string;
  refreshTrigger?: number;
}

export const SalesView: React.FC<SalesViewProps> = ({
  onOpenScanner,
  scannedBarcode,
  refreshTrigger
}) => {
  const { theme, themeClasses } = useTheme();
  const { selectedCompanyId, selectedCompany } = useCompany();
  const { isReadOnly, currentUser, isSuperAdmin, isAdmin } = useAuth();

  const [activeSubTab, setActiveSubTab] = useState<'pos' | 'history'>('pos');
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [cart, setCart] = useState<SaleItem[]>([]);

  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isSiiConfigOpen, setIsSiiConfigOpen] = useState(false);
  const [isCashClosingOpen, setIsCashClosingOpen] = useState(false);
  const [selectedSaleForDetails, setSelectedSaleForDetails] = useState<Sale | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isWeighableModalOpen, setIsWeighableModalOpen] = useState(false);
  const [selectedWeighableProduct, setSelectedWeighableProduct] = useState<Product | null>(null);

  const [pdfDoc, setPdfDoc] = useState<any | null>(null);
  const [pdfFilename, setPdfFilename] = useState('');
  const [pdfTitle, setPdfTitle] = useState('');
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);

  const [salesHistory, setSalesHistory] = useState<Sale[]>([]);
  const [isQuickConfigOpen, setIsQuickConfigOpen] = useState(false);
  const [selectedProductForOffer, setSelectedProductForOffer] = useState<Product | null>(null);
  const [offerPriceInput, setOfferPriceInput] = useState<number | string>('');
  const [offerStockLimitInput, setOfferStockLimitInput] = useState<number | string>('');
  const [offerLabelInput, setOfferLabelInput] = useState<string>('Liquidación');
  const [customQuickProductIds, setCustomQuickProductIds] = useState<number[]>(() => {
    try {
      const saved = localStorage.getItem(`market_almacen_quick_prods_${selectedCompanyId}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Beep auditivo para pistola lectora de código de barras
  const playScannerBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1400, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.11);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.11);
    } catch {
      // AudioContext ignorado si no está disponible
    }
  };

  // Manejar escaneo desde pistola lectora
  const handleBarcodeScanned = (code: string) => {
    const clean = code.trim().toLowerCase();
    if (!clean) return;

    const matched = products.find(p => 
      p.code.toLowerCase() === clean || 
      (p.mannFilterCode && p.mannFilterCode.toLowerCase() === clean)
    );

    if (matched) {
      playScannerBeep();
      handleAddToCart(matched);
      setSearchQuery('');
    } else {
      alert(`⚠️ Producto con código "${code}" no encontrado en el catálogo de esta empresa.`);
    }
  };

  // Listener global para lector de código de barras por pistola USB / Bluetooth / Wireless
  useEffect(() => {
    let buffer = '';
    let lastKeyTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isCheckoutOpen || isSiiConfigOpen || isCashClosingOpen || isDetailsOpen || isWeighableModalOpen || isQuickConfigOpen) {
        return;
      }

      const target = e.target as HTMLElement;
      if (target && target.tagName === 'INPUT' && target.id !== 'pos-search-input') {
        return;
      }

      const currentTime = Date.now();
      if (currentTime - lastKeyTime > 150) {
        buffer = '';
      }
      lastKeyTime = currentTime;

      if (e.key === 'Enter') {
        if (buffer.length >= 3) {
          e.preventDefault();
          handleBarcodeScanned(buffer);
          buffer = '';
        }
      } else if (e.key.length === 1) {
        buffer += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [products, isCheckoutOpen, isSiiConfigOpen, isCashClosingOpen, isDetailsOpen, isWeighableModalOpen, isQuickConfigOpen]);
  const [historySearch, setHistorySearch] = useState('');
  const [historyDateFilter, setHistoryDateFilter] = useState<'today' | '7days' | 'month' | 'all'>('today');

  const loadProducts = async () => {
    const allProds = await db.products.toArray();
    const filtered = allProds.filter(p => {
      if (selectedCompanyId === 'ALL') return true;
      return !p.companyId || p.companyId === selectedCompanyId;
    });
    setProducts(filtered);
  };

  const loadSalesHistory = async () => {
    const allSales = await db.sales.orderBy('createdAt').reverse().toArray();
    const filtered = allSales.filter(s => {
      return selectedCompanyId === 'ALL' || s.companyId === selectedCompanyId;
    });
    setSalesHistory(filtered);
  };

  useEffect(() => {
    loadProducts();
    loadSalesHistory();
    const handleUpdate = () => {
      loadProducts();
      loadSalesHistory();
    };
    window.addEventListener('marketalmacen-data-updated', handleUpdate);
    return () => window.removeEventListener('marketalmacen-data-updated', handleUpdate);
  }, [selectedCompanyId, refreshTrigger]);

  // Handle scanned barcode input
  useEffect(() => {
    if (scannedBarcode && scannedBarcode.trim()) {
      const match = products.find(p => p.code.toLowerCase() === scannedBarcode.toLowerCase().trim());
      if (match) {
        handleAddToCart(match);
      }
    }
  }, [scannedBarcode]);

  const categories = ['ALL', ...Array.from(new Set(products.map(p => p.category).filter(Boolean)))];

  // 1. Top 9 Productos más vendidos calculados desde el historial
  const top9SoldProducts = useMemo(() => {
    const counts: Record<number, number> = {};
    salesHistory.forEach(s => {
      if (s.status !== 'ANULADA') {
        s.items.forEach(item => {
          if (item.productId) {
            counts[item.productId] = (counts[item.productId] || 0) + item.quantity;
          }
        });
      }
    });

    const sorted = [...products].sort((a, b) => {
      const soldA = a.id ? (counts[a.id] || 0) : 0;
      const soldB = b.id ? (counts[b.id] || 0) : 0;
      return soldB - soldA;
    });

    return sorted.slice(0, 9);
  }, [products, salesHistory]);

  // 2. 9 productos rápidos (personalizados o top 9)
  const quick9Products = useMemo(() => {
    if (customQuickProductIds.length > 0) {
      const customList = customQuickProductIds
        .map(id => products.find(p => p.id === id))
        .filter(Boolean) as Product[];
      if (customList.length > 0) return customList.slice(0, 9);
    }
    return top9SoldProducts;
  }, [customQuickProductIds, products, top9SoldProducts]);

  // 3. Productos a mostrar: Si hay búsqueda o categoría seleccionada, mostrar catálogo filtrado; de lo contrario, solo los 9 rápidos
  const isSearching = searchQuery.trim().length > 0 || selectedCategory !== 'ALL';
  const displayedProducts = useMemo(() => {
    if (isSearching) {
      const q = searchQuery.toLowerCase().trim();
      return products.filter(p => {
        const matchesCategory = selectedCategory === 'ALL' || p.category === selectedCategory;
        const matchesQuery = !q ||
          p.name.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q) ||
          (p.brand && p.brand.toLowerCase().includes(q)) ||
          (p.mannFilterCode && p.mannFilterCode.toLowerCase().includes(q));
        return matchesCategory && matchesQuery;
      });
    }
    return quick9Products;
  }, [isSearching, searchQuery, selectedCategory, products, quick9Products]);

  const saveCustomQuickProducts = (ids: number[]) => {
    setCustomQuickProductIds(ids);
    try {
      localStorage.setItem(`market_almacen_quick_prods_${selectedCompanyId}`, JSON.stringify(ids));
    } catch {}
    setIsQuickConfigOpen(false);
  };

  const handleAddToCartDirect = (saleItem: SaleItem) => {
    if (isReadOnly) return;
    setCart(prev => {
      // Si el ítem ya existe por código exacto o nombre exacto
      const existingIndex = prev.findIndex(item => item.productCode === saleItem.productCode || (item.productId && item.productId === saleItem.productId));
      if (existingIndex >= 0) {
        const next = [...prev];
        const updatedQty = Number((next[existingIndex].quantity + saleItem.quantity).toFixed(3));
        next[existingIndex] = {
          ...next[existingIndex],
          quantity: updatedQty,
          subtotal: Math.round(updatedQty * next[existingIndex].unitPrice)
        };
        return next;
      }
      return [...prev, saleItem];
    });
  };

  const handleAddToCart = (product: Product) => {
    if (isReadOnly) return;

    // Si el producto es pesable (Kg o Gramos o Panadería / Verdulería), abrir modal de pesaje
    const isWeighable = product.unit === 'Kg' || product.unit === 'Gramos' || product.category === 'Panadería y Pastelería' || product.category === 'Frutas y Verduras';
    if (isWeighable) {
      setSelectedWeighableProduct(product);
      setIsWeighableModalOpen(true);
      return;
    }

    if (product.stock <= 0) {
      alert('Este producto no tiene stock disponible.');
      return;
    }

    // Verificar si el producto tiene oferta/liquidación activa por lote
    const hasOffer = Boolean(
      product.offerPrice && 
      product.offerPrice > 0 && 
      (product.offerStockRemaining === undefined || product.offerStockRemaining > 0)
    );

    setCart(prev => {
      const existingIndex = prev.findIndex(item => item.productId === product.id);
      if (existingIndex >= 0) {
        const existing = prev[existingIndex];
        if (existing.quantity >= product.stock) {
          alert(`Stock máximo disponible: ${product.stock}`);
          return prev;
        }
        const next = [...prev];
        const nextQty = existing.quantity + 1;
        next[existingIndex] = {
          ...existing,
          quantity: nextQty,
          subtotal: Math.round(nextQty * existing.unitPrice)
        };
        return next;
      } else {
        const regularPrice = product.price && product.price > 0 ? product.price : 10000;
        const effectivePrice = hasOffer ? product.offerPrice! : regularPrice;

        return [
          ...prev,
          {
            productId: product.id,
            productCode: product.code,
            productName: product.name,
            quantity: 1,
            unitPrice: effectivePrice,
            originalPrice: regularPrice,
            isOffer: hasOffer,
            subtotal: effectivePrice,
            unit: product.unit || 'UN'
          }
        ];
      }
    });
  };

  const handleOpenOfferModal = (prod: Product, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedProductForOffer(prod);
    setOfferPriceInput(prod.offerPrice || Math.round((prod.price || 1000) * 0.8));
    setOfferStockLimitInput(prod.offerStockRemaining || Math.min(20, prod.stock));
    setOfferLabelInput(prod.offerLabel || 'Liquidación');
  };

  const handleSaveProductOffer = async () => {
    if (!selectedProductForOffer || !selectedProductForOffer.id) return;
    const priceNum = Number(offerPriceInput);
    const qtyNum = Number(offerStockLimitInput);

    if (isNaN(priceNum) || priceNum <= 0) {
      alert('Ingrese un precio de oferta válido.');
      return;
    }
    if (isNaN(qtyNum) || qtyNum <= 0) {
      alert('Ingrese una cantidad válida de unidades para la oferta.');
      return;
    }

    await db.products.update(selectedProductForOffer.id, {
      offerPrice: priceNum,
      offerStockLimit: qtyNum,
      offerStockRemaining: qtyNum,
      offerLabel: offerLabelInput.trim() || 'Liquidación'
    });

    await loadProducts();
    setSelectedProductForOffer(null);
  };

  const handleRemoveProductOffer = async () => {
    if (!selectedProductForOffer || !selectedProductForOffer.id) return;
    await db.products.update(selectedProductForOffer.id, {
      offerPrice: undefined,
      offerStockLimit: undefined,
      offerStockRemaining: undefined,
      offerLabel: undefined
    });
    await loadProducts();
    setSelectedProductForOffer(null);
  };

  const handleUpdateQuantity = (productId?: number, delta: number = 1, productCode?: string) => {
    setCart(prev => {
      return prev
        .map(item => {
          const match = (productId && item.productId === productId) || (productCode && item.productCode === productCode);
          if (match) {
            const step = (item.unit === 'Kg' || item.unit === 'Gramos' || !Number.isInteger(item.quantity)) ? (delta > 0 ? 0.250 : -0.250) : delta;
            const newQty = Number((item.quantity + step).toFixed(3));
            if (newQty <= 0) return null;
            return {
              ...item,
              quantity: newQty,
              subtotal: Math.round(newQty * item.unitPrice)
            };
          }
          return item;
        })
        .filter(Boolean) as SaleItem[];
    });
  };

  const handleRemoveFromCart = (productId: number) => {
    setCart(prev => prev.filter(item => item.productId !== productId));
  };

  const handleClearCart = () => {
    if (cart.length === 0) return;
    if (window.confirm('¿Desea vaciar todos los productos del carrito actual?')) {
      setCart([]);
    }
  };

  const cartSubtotal = cart.reduce((acc, item) => acc + item.subtotal, 0);
  const cartNeto = Math.round(cartSubtotal / 1.19);
  const cartIva = cartSubtotal - cartNeto;

  const handleSaleCompleted = (sale: Sale) => {
    setCart([]);
    loadProducts();
    loadSalesHistory();
    setSelectedSaleForDetails(sale);
    setIsDetailsOpen(true);
  };

  const handleQuickPrint = async (sale: Sale, type: 'ticket' | 'invoice') => {
    const config = await db.siiConfigs.where('companyId').equals(sale.companyId).first();
    const doc = type === 'ticket'
      ? generateSaleThermalTicketPDF(sale, selectedCompany, config)
      : generateSaleInvoicePDF(sale, selectedCompany, config);
    setPdfDoc(doc);
    setPdfTitle(type === 'ticket' ? `Ticket POS - ${sale.folio}` : `DTE Oficial - ${sale.folio}`);
    setPdfFilename(`${type === 'ticket' ? 'Ticket' : 'DTE'}_${sale.folio}.pdf`);
    setIsPdfModalOpen(true);
  };

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const filteredSalesHistory = salesHistory.filter(s => {
    const q = historySearch.toLowerCase().trim();
    const matchQuery = !q ||
      s.folio.toLowerCase().includes(q) ||
      (s.customerName && s.customerName.toLowerCase().includes(q)) ||
      (s.customerRut && s.customerRut.toLowerCase().includes(q)) ||
      (s.sellerName && s.sellerName.toLowerCase().includes(q));

    if (!matchQuery) return false;

    if (historyDateFilter === 'today') {
      return s.date === todayStr;
    } else if (historyDateFilter === '7days') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      return s.date >= d.toISOString().slice(0, 10);
    } else if (historyDateFilter === 'month') {
      const currentMonth = todayStr.slice(0, 7);
      return s.date.startsWith(currentMonth);
    }
    return true;
  });

  const totalHistoryRevenue = filteredSalesHistory
    .filter(s => s.status !== 'ANULADA')
    .reduce((acc, s) => acc + s.total, 0);

  const totalBoletasCount = filteredSalesHistory
    .filter(s => s.status !== 'ANULADA' && s.dteType.startsWith('BOLETA')).length;

  const totalFacturasCount = filteredSalesHistory
    .filter(s => s.status !== 'ANULADA' && s.dteType.startsWith('FACTURA')).length;

  // Función exclusiva para SUPERADMIN: Borrar historial de ventas y reiniciar folios
  const handleSuperadminPurgeSales = async () => {
    const pwd = prompt('⚠️ ATENCIÓN SUPERADMIN / ADMINISTRADOR:\n\nEsta acción eliminará el historial de ventas registrado.\nIngrese la Clave de Super Administrador (Mauricio2026 o clave admin) para proceder:');
    if (!pwd) return;

    if (pwd !== 'Mauricio2026' && pwd !== 'admin' && pwd !== currentUser?.password) {
      alert('❌ Clave incorrecta. Solo el Super Administrador puede vaciar el historial.');
      return;
    }

    const resetFolios = confirm('¿Desea además REINICIAR LOS CORRELATIVOS de Boleta y Factura al número 1 para comenzar de cero?');

    try {
      if (selectedCompanyId === 'ALL') {
        await db.sales.clear();
      } else {
        await db.sales.where('companyId').equals(selectedCompanyId).delete();
      }

      if (resetFolios) {
        const configs = await db.siiConfigs.toArray();
        for (const cfg of configs) {
          if (selectedCompanyId === 'ALL' || cfg.companyId === selectedCompanyId) {
            await db.siiConfigs.update(cfg.id!, {
              nextBoletaFolio: 1,
              nextFacturaFolio: 1,
              nextExentaFolio: 1,
              updatedAt: new Date().toISOString()
            });
          }
        }
      }

      alert('✅ Historial de ventas vaciado exitosamente' + (resetFolios ? ' y folios reiniciados al número 1.' : '.'));
      loadSalesHistory();
      setCart([]);
    } catch (err) {
      console.error('Error al purgar ventas:', err);
      alert('Ocurrió un error al vaciar el historial de ventas.');
    }
  };

  return (
    <div className="h-full flex-1 flex flex-col space-y-1.5 overflow-hidden animate-fadeIn">
      {/* 1. Encabezado de HISTORIAL */}
      {activeSubTab === 'history' && (
        <div className={`p-3.5 rounded-3xl border ${themeClasses.card} shadow-sm backdrop-blur-md flex flex-wrap items-center gap-3 sm:gap-4`}>
          <div className="flex items-center gap-2.5 shrink-0">
            <div className={`w-9 h-9 rounded-2xl flex items-center justify-center text-white shadow-md shrink-0 ${themeClasses.accentBg}`}>
              <ShoppingCart className="w-4.5 h-4.5" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-black flex items-center gap-2">
                <span>Historial de Ventas & DTE</span>
              </h1>
              <p className="text-[11px] opacity-75 hidden sm:block font-bold">
                Boletas, Facturas y Cierres Z
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className={`flex items-center p-1 rounded-2xl border ${themeClasses.cardSubtle}`}>
              <button
                type="button"
                onClick={() => setActiveSubTab('pos')}
                className="px-3 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                <span>Terminal POS</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveSubTab('history')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer ${themeClasses.accentBg} text-white shadow-md`}
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>Historial ({salesHistory.length})</span>
              </button>
            </div>

            {isSuperAdmin && (
              <button
                type="button"
                onClick={handleSuperadminPurgeSales}
                className="px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 border-2 border-red-500 text-xs font-black transition flex items-center gap-1.5 active:scale-95 shadow-xs cursor-pointer"
                title="Borrar historial de ventas y reiniciar correlativos de folios"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                <span>Borrar Historial</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsCashClosingOpen(true)}
              className={`px-3 py-1.5 rounded-xl border ${themeClasses.cardSubtle} text-xs font-black transition flex items-center gap-1.5 active:scale-95 shadow-xs cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800`}
            >
              <Lock className="w-3.5 h-3.5 text-amber-500" />
              <span>Cierre de Caja (Z)</span>
            </button>

            <button
              type="button"
              onClick={() => setIsSiiConfigOpen(true)}
              className={`px-3 py-1.5 rounded-xl border ${themeClasses.cardSubtle} text-xs font-black transition flex items-center gap-1.5 active:scale-95 shadow-xs cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800`}
            >
              <Settings className="w-3.5 h-3.5 text-blue-500" />
              <span>Config. SII</span>
            </button>
          </div>
        </div>
      )}

      {/* POS Terminal: Orden y Presentación Exacta como Imagen 2 */}
      {activeSubTab === 'pos' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch flex-1 h-full min-h-0 overflow-hidden">
          
          {/* Columna Izquierda: Encabezado -> Buscador -> Categorías + 9 Favoritos en 1 sola línea -> Tarjetas */}
          <div className="lg:col-span-7 xl:col-span-8 flex flex-col justify-start space-y-1.5 h-full min-h-0 overflow-hidden">
            
            {/* 1. ENCABEZADO POS */}
            <div className={`p-2.5 sm:p-3 rounded-2xl border ${themeClasses.card} shadow-xs flex flex-wrap items-center justify-between gap-2`}>
              <div className="flex items-center gap-2.5">
                <div className={`w-9 h-9 rounded-2xl flex items-center justify-center text-white shadow-md shrink-0 ${themeClasses.accentBg}`}>
                  <ShoppingCart className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h1 className="text-base font-black flex items-center gap-1.5 text-slate-900 dark:text-white">
                    <span>Punto de Venta & Facturación SII</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${themeClasses.badge}`}>
                      POS
                    </span>
                  </h1>
                  <p className="text-[11px] opacity-75 hidden sm:block font-bold">
                    Ventas rápidas, Boletas/Facturas Electrónicas y Cierre de Caja
                  </p>
                </div>
              </div>

              {/* Botones de navegación en el encabezado */}
              <div className="flex flex-wrap items-center gap-1.5">
                <div className={`flex items-center p-0.5 rounded-2xl border ${themeClasses.cardSubtle}`}>
                  <button
                    type="button"
                    onClick={() => setActiveSubTab('pos')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer ${themeClasses.accentBg} text-white shadow-md`}
                  >
                    <ShoppingCart className="w-3.5 h-3.5" />
                    <span>Terminal POS</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveSubTab('history')}
                    className="px-3 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  >
                    <Receipt className="w-3.5 h-3.5" />
                    <span>Historial ({salesHistory.length})</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setIsCashClosingOpen(true)}
                  className={`px-3 py-1.5 rounded-xl border ${themeClasses.cardSubtle} text-xs font-black transition flex items-center gap-1 active:scale-95 shadow-xs cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800`}
                >
                  <Lock className="w-3.5 h-3.5 text-amber-500" />
                  <span className="hidden sm:inline">Cierre (Z)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsSiiConfigOpen(true)}
                  className={`px-3 py-1.5 rounded-xl border ${themeClasses.cardSubtle} text-xs font-black transition flex items-center gap-1 active:scale-95 shadow-xs cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800`}
                >
                  <Settings className="w-3.5 h-3.5 text-blue-500" />
                  <span className="hidden sm:inline">SII</span>
                </button>
              </div>
            </div>

            {/* 2. BARRA DE BÚSQUEDA Y VENTA POR PESO */}
            <div className={`flex items-center gap-2 p-1.5 rounded-2xl border ${themeClasses.card} shadow-xs`}>
              <div className="relative flex-1">
                <Search className="w-4.5 h-4.5 absolute left-3.5 top-1/2 -translate-y-1/2 opacity-60 text-blue-600" />
                <input
                  type="text"
                  id="pos-search-input"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && searchQuery.trim()) {
                      const exact = products.find(p => p.code.toLowerCase() === searchQuery.trim().toLowerCase());
                      if (exact) {
                        handleAddToCart(exact);
                        setSearchQuery('');
                      }
                    }
                  }}
                  placeholder="Buscar producto por nombre, código de barras o SKU..."
                  className="w-full pl-9 pr-3 py-1.5 sm:py-2 rounded-xl bg-transparent border-none text-xs sm:text-sm font-black focus:outline-none placeholder:font-normal"
                />
              </div>

              {/* Botón Venta por Peso / Granel */}
              <button
                type="button"
                onClick={() => {
                  setSelectedWeighableProduct(null);
                  setIsWeighableModalOpen(true);
                }}
                className="px-3.5 py-1.5 sm:py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-900 dark:text-amber-200 border-2 border-amber-500/40 text-xs sm:text-sm font-black transition flex items-center gap-2 shrink-0 shadow-xs active:scale-95 cursor-pointer whitespace-nowrap"
                title="Venta de Pan, Papas, Frutas, Verduras y Productos por Peso o Monto"
              >
                <Scale className="w-4.5 h-4.5 text-amber-600 dark:text-amber-400" />
                <span>Venta por Peso / Granel</span>
              </button>
            </div>

            {/* 3. BARRA DE 9 FAVORITOS (Subida pegada al buscador y pegada a las tarjetas) */}
            <div className="flex items-center justify-between px-1.5 py-0.5">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-black shrink-0">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-slate-100">
                  {isSearching ? `Resultados de Búsqueda (${displayedProducts.length} productos)` : `9 Productos Rápidos / Más Vendidos (${displayedProducts.length}/9)`}
                </span>
              </div>

              {!isSearching && (
                <button
                  type="button"
                  onClick={() => setIsQuickConfigOpen(true)}
                  className="px-3 py-1.5 text-xs font-black rounded-2xl border border-slate-300 dark:border-slate-700 bg-white hover:bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 flex items-center gap-1.5 transition shadow-xs cursor-pointer active:scale-95"
                  title="Elegir qué 9 productos fijar en la botonera rápida"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span>Configurar 9 Favoritos</span>
                </button>
              )}
            </div>

            {/* 4. MATRIZ DE PRODUCTOS (Tarjetas Limpias y Espaciosas sin botón de liquidar) */}
            <div className={`grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 content-start flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-1 scrollbar-thin ${
              isSearching ? 'max-h-[540px] overflow-y-auto pr-1' : ''
            }`}>
              {displayedProducts.map((prod) => {
                const isOutOfStock = (prod.stock || 0) <= 0;
                const regularPrice = prod.price && prod.price > 0 ? prod.price : 10000;
                const hasOffer = Boolean(prod.offerPrice && prod.offerPrice > 0 && (prod.offerStockRemaining === undefined || prod.offerStockRemaining > 0));
                const currentPrice = hasOffer ? prod.offerPrice! : regularPrice;
                const offerStockRem = prod.offerStockRemaining !== undefined ? prod.offerStockRemaining : (prod.offerStockLimit || 0);

                return (
                  <div
                    key={prod.id}
                    onClick={() => !isOutOfStock && handleAddToCart(prod)}
                    className={`p-3 sm:p-3.5 rounded-2xl border-2 transition-all duration-150 flex flex-col justify-between cursor-pointer group select-none shadow-xs min-h-[118px] sm:min-h-[124px] overflow-hidden ${
                      isOutOfStock
                        ? 'opacity-50 cursor-not-allowed bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                        : hasOffer
                        ? 'bg-amber-50/90 dark:bg-amber-950/40 border-amber-400 dark:border-amber-600 hover:border-amber-500 hover:shadow-md active:bg-amber-100/60 dark:active:bg-amber-900/40'
                        : `${themeClasses.card} hover:border-blue-500 hover:shadow-md active:bg-blue-50/40 dark:active:bg-slate-800`
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1.5">
                        <span className={`text-[10px] font-mono font-black px-2 py-0.5 rounded-lg border ${themeClasses.badge}`}>
                          {prod.code}
                        </span>

                        <div className="flex items-center gap-1">
                          {hasOffer && (
                            <span className="text-[9.5px] font-black px-2 py-0.5 rounded-full bg-amber-500 text-white shadow-xs animate-pulse">
                              🔥 {offerStockRem} en Oferta
                            </span>
                          )}
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                            isOutOfStock ? 'bg-red-500/20 text-red-500' : 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                          }`}>
                            {prod.unit === 'Kg' || prod.unit === 'Gramos' || prod.category === 'Panadería y Pastelería' || prod.category === 'Frutas y Verduras' ? '⚖️ Granel' : `Stock: ${prod.stock} ${prod.unit || 'UN'}`}
                          </span>
                        </div>
                      </div>

                      <h4 className="font-black text-xs sm:text-sm text-slate-900 dark:text-slate-100 line-clamp-2 leading-snug group-hover:text-blue-600 dark:group-hover:text-blue-400">
                        {prod.name}
                      </h4>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-200/80 dark:border-slate-800/80 mt-2 shrink-0">
                      <div className="flex flex-col">
                        <div className="flex items-baseline gap-1.5">
                          <span className={`text-sm sm:text-base font-black font-mono ${hasOffer ? 'text-amber-700 dark:text-amber-300 font-extrabold' : 'text-emerald-700 dark:text-emerald-400'}`}>
                            ${currentPrice.toLocaleString('es-CL')}
                          </span>
                          {hasOffer && (
                            <span className="text-xs font-mono line-through opacity-50">
                              ${regularPrice.toLocaleString('es-CL')}
                            </span>
                          )}
                        </div>
                        {hasOffer && (
                          <span className="text-[9.5px] font-bold text-amber-700 dark:text-amber-400">
                            {prod.offerLabel || 'En Oferta'}
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        disabled={isOutOfStock}
                        className={`w-8 h-8 rounded-xl text-white transition flex items-center justify-center ${
                          isOutOfStock ? 'bg-slate-400' : `${themeClasses.accentBg} group-hover:scale-110 shadow-xs`
                        }`}
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Columna Derecha: Carrito de Venta - Alargado hacia Abajo */}
          <div className="lg:col-span-5 xl:col-span-4 flex flex-col h-full min-h-0 overflow-hidden">
            <div className={`rounded-3xl border-2 ${themeClasses.border} ${themeClasses.card} shadow-xl p-3 sm:p-3.5 flex flex-col justify-between h-full min-h-[460px] sticky top-0`}>
              
              {/* Header del Carrito */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
                <div className="flex items-center gap-2">
                  <ShoppingCart className={`w-5 h-5 ${themeClasses.accent}`} />
                  <h3 className="font-black text-sm sm:text-base text-slate-900 dark:text-slate-100">
                    Carrito de Venta
                  </h3>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-black ${themeClasses.badge}`}>
                    {cart.reduce((a, b) => a + b.quantity, 0)}
                  </span>
                </div>
                {cart.length > 0 && (
                  <button
                    onClick={handleClearCart}
                    className="text-xs font-bold text-red-500 hover:text-red-600 transition flex items-center gap-1 cursor-pointer active:scale-95"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Vaciar
                  </button>
                )}
              </div>

              {/* Lista de Ítems Alargada: Llena el Alto y Scroll Interno cuando sea necesario */}
              {cart.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3 opacity-50 min-h-[300px]">
                  <div className="w-16 h-16 rounded-3xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                    <ShoppingCart className="w-8 h-8 opacity-60" />
                  </div>
                  <p className="text-sm font-black">El carrito está vacío</p>
                  <p className="text-xs font-bold">Haz clic en los productos para agregarlos a la venta</p>
                </div>
              ) : (
                <div className="flex-1 space-y-2 overflow-y-auto pr-1 my-2 max-h-[260px] sm:max-h-[320px] lg:max-h-[360px] scrollbar-thin">
                  {cart.map((item) => (
                    <div
                      key={item.productId}
                      className={`p-3 rounded-2xl border ${item.isOffer ? 'bg-amber-50/80 border-amber-300 dark:bg-amber-950/40 dark:border-amber-700' : themeClasses.cardSubtle} flex items-center justify-between gap-2 shadow-2xs`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="font-black text-xs sm:text-sm truncate leading-tight text-slate-900 dark:text-slate-100">
                            {item.productName}
                          </p>
                          {item.isOffer && (
                            <span className="text-[9px] font-black px-2 py-0.2 bg-amber-500 text-white rounded-full">
                              🔥 Oferta
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] opacity-75 font-mono font-bold mt-0.5">
                          ${item.unitPrice.toLocaleString('es-CL')}/{item.unit || 'UN'} x {item.quantity < 1 || !Number.isInteger(item.quantity) ? item.quantity.toFixed(3) : item.quantity} {item.unit || 'UN'}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleUpdateQuantity(item.productId, -1)}
                          className="p-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 hover:opacity-80 text-slate-800 dark:text-slate-100 active:scale-95 cursor-pointer font-bold"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-xs font-black w-6 text-center font-mono">
                          {item.quantity < 1 || !Number.isInteger(item.quantity) ? item.quantity.toFixed(1) : item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleUpdateQuantity(item.productId, 1)}
                          className="p-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 hover:opacity-80 text-slate-800 dark:text-slate-100 active:scale-95 cursor-pointer font-bold"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-xs sm:text-sm font-black font-mono ml-1 text-emerald-700 dark:text-emerald-400 min-w-[62px] text-right">
                          ${item.subtotal.toLocaleString('es-CL')}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveFromCart(item.productId)}
                          className="p-1 text-slate-400 hover:text-red-500 ml-0.5 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Totales Fijos */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-1.5 text-xs shrink-0">
                <div className="flex justify-between opacity-75 font-bold">
                  <span>Neto:</span>
                  <span className="font-mono text-xs sm:text-sm">${cartNeto.toLocaleString('es-CL')}</span>
                </div>
                <div className="flex justify-between opacity-75 font-bold">
                  <span>19% I.V.A.:</span>
                  <span className="font-mono text-xs sm:text-sm">${cartIva.toLocaleString('es-CL')}</span>
                </div>
                <div className="flex justify-between font-black text-base sm:text-lg pt-1.5 border-t border-slate-200 dark:border-slate-800 text-slate-950 dark:text-white">
                  <span>TOTAL:</span>
                  <span className="font-mono font-black text-blue-600 dark:text-blue-400">${cartSubtotal.toLocaleString('es-CL')}</span>
                </div>
              </div>

              {/* Botón Cobrar Fijo */}
              <button
                type="button"
                disabled={cart.length === 0 || isReadOnly}
                onClick={() => setIsCheckoutOpen(true)}
                className={`w-full mt-3.5 py-3.5 rounded-2xl text-xs sm:text-sm font-black transition flex items-center justify-center gap-2 shadow-lg disabled:opacity-40 disabled:cursor-not-allowed text-white ${themeClasses.accentBg} shrink-0 cursor-pointer active:scale-98`}
              >
                <DollarSign className="w-4 h-4" />
                <span>COBRAR / FINALIZAR VENTA</span>
              </button>
            </div>
          </div>

        </div>
      )}

      {/* Vista de Historial de Ventas */}
      {activeSubTab === 'history' && (
        <div className="space-y-4">
          {/* Tarjetas de Resumen Rápido */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className={`p-3.5 rounded-2xl border ${themeClasses.card} shadow-xs flex items-center gap-3`}>
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center font-black">
                <DollarSign className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Total Recaudado</p>
                <p className="text-lg font-black font-mono text-emerald-600 dark:text-emerald-400">
                  ${totalHistoryRevenue.toLocaleString('es-CL')}
                </p>
              </div>
            </div>

            <div className={`p-3.5 rounded-2xl border ${themeClasses.card} shadow-xs flex items-center gap-3`}>
              <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 flex items-center justify-center font-black">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Boletas Emitidas</p>
                <p className="text-lg font-black font-mono text-blue-600 dark:text-blue-400">
                  {totalBoletasCount}
                </p>
              </div>
            </div>

            <div className={`p-3.5 rounded-2xl border ${themeClasses.card} shadow-xs flex items-center gap-3`}>
              <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 flex items-center justify-center font-black">
                <Building className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Facturas Emitidas</p>
                <p className="text-lg font-black font-mono text-indigo-600 dark:text-indigo-400">
                  {totalFacturasCount}
                </p>
              </div>
            </div>
          </div>

          {/* Filtros de Historial */}
          <div className={`p-3 rounded-2xl border ${themeClasses.card} shadow-xs flex flex-wrap items-center justify-between gap-3`}>
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 opacity-50" />
              <input
                type="text"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Buscar por folio, cliente, RUT..."
                className={`w-full pl-9 pr-3 py-1.5 rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-xs font-bold focus:outline-none`}
              />
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <div className={`flex items-center p-0.5 rounded-xl border ${themeClasses.cardSubtle}`}>
                {[
                  { id: 'today', label: 'Hoy' },
                  { id: '7days', label: '7 días' },
                  { id: 'month', label: 'Mes' },
                  { id: 'all', label: 'Todo' }
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setHistoryDateFilter(f.id as any)}
                    className={`px-2.5 py-1 text-xs font-black rounded-lg transition cursor-pointer ${
                      historyDateFilter === f.id
                        ? `${themeClasses.accentBg} text-white shadow-2xs`
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Tabla de Historial */}
          <div className={`rounded-2xl border ${themeClasses.border} overflow-hidden shadow-xs`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className={`border-b ${themeClasses.border} ${themeClasses.cardSubtle} font-black text-slate-700 dark:text-slate-300`}>
                    <th className="py-2.5 px-3">Folio / DTE</th>
                    <th className="py-2.5 px-3">Fecha y Hora</th>
                    <th className="py-2.5 px-3">Cliente / RUT</th>
                    <th className="py-2.5 px-3">Pago</th>
                    <th className="py-2.5 px-3 text-right">Total</th>
                    <th className="py-2.5 px-3 text-center">Estado</th>
                    <th className="py-2.5 px-3 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-bold">
                  {filteredSalesHistory.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No hay ventas registradas con los filtros seleccionados
                      </td>
                    </tr>
                  ) : (
                    filteredSalesHistory.map((sale) => (
                      <tr key={sale.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                        <td className="py-2 px-3">
                          <span className="font-mono font-black text-blue-600 dark:text-blue-400">
                            {sale.folio ? `#${sale.folio}` : 'S/F'}
                          </span>
                          <span className={`ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-black ${
                            sale.dteType.startsWith('FACTURA') ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300' : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
                          }`}>
                            {sale.dteType}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-mono text-[11px] opacity-75">
                          {sale.date} {sale.time}
                        </td>
                        <td className="py-2 px-3">
                          <p className="truncate max-w-[140px] font-black">{sale.customerName || 'Cliente General'}</p>
                          {sale.customerRut && <p className="text-[10px] font-mono opacity-60">{sale.customerRut}</p>}
                        </td>
                        <td className="py-2 px-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-100 dark:bg-slate-800">
                            {sale.paymentMethod}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-black text-emerald-600 dark:text-emerald-400">
                          ${sale.total.toLocaleString('es-CL')}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                            sale.status === 'COMPLETADA'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                          }`}>
                            {sale.status}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => {
                                setSelectedSaleForDetails(sale);
                                setIsDetailsOpen(true);
                              }}
                              className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950 transition cursor-pointer"
                              title="Ver Detalle y Documento"
                            >
                              <FileText className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Detalle de Venta */}
      {isDetailsOpen && selectedSaleForDetails && (
        <SaleDetailsModal
          isOpen={isDetailsOpen}
          onClose={() => {
            setIsDetailsOpen(false);
            setSelectedSaleForDetails(null);
          }}
          sale={selectedSaleForDetails}
          onSaleUpdated={() => {
            loadSalesHistory();
            loadProducts();
          }}
        />
      )}

      {/* Modal de Finalización de Venta (Checkout) */}
      {isCheckoutOpen && (
        <SaleCheckoutModal
          isOpen={isCheckoutOpen}
          onClose={() => setIsCheckoutOpen(false)}
          cartItems={cart}
          onSaleCompleted={handleSaleCompleted}
        />
      )}

      {/* Modal de Configuración SII */}
      {isSiiConfigOpen && (
        <SiiConfigModal
          isOpen={isSiiConfigOpen}
          onClose={() => setIsSiiConfigOpen(false)}
        />
      )}

      {/* Modal de Cierre de Caja (Z) */}
      {isCashClosingOpen && (
        <CashClosingModal
          isOpen={isCashClosingOpen}
          onClose={() => setIsCashClosingOpen(false)}
        />
      )}

      {/* Modal de Venta por Peso y Balanza */}
      {isWeighableModalOpen && (
        <WeighableProductModal
          isOpen={isWeighableModalOpen}
          onClose={() => {
            setIsWeighableModalOpen(false);
            setSelectedWeighableProduct(null);
          }}
          onAddToCart={handleAddToCartDirect}
          selectedProduct={selectedWeighableProduct}
        />
      )}

      {/* Modal de Configuración de 9 Favoritos */}
      {isQuickConfigOpen && (
        <QuickProductsConfigModal
          isOpen={isQuickConfigOpen}
          onClose={() => setIsQuickConfigOpen(false)}
          products={products}
          selectedIds={customQuickProductIds.length > 0 ? customQuickProductIds : top9SoldProducts.map(p => p.id!).filter(Boolean)}
          onSave={saveCustomQuickProducts}
        />
      )}

      {/* Modal de Visualización PDF */}
      {isPdfModalOpen && pdfDoc && (
        <PDFViewerModal
          isOpen={isPdfModalOpen}
          onClose={() => setIsPdfModalOpen(false)}
          doc={pdfDoc}
          filename={pdfFilename}
          title={pdfTitle}
        />
      )}
    </div>
  );
};


interface QuickProductsConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  selectedIds: number[];
  onSave: (selectedIds: number[]) => void;
}

const QuickProductsConfigModal: React.FC<QuickProductsConfigModalProps> = ({
  isOpen,
  onClose,
  products,
  selectedIds,
  onSave
}) => {
  const { themeClasses } = useTheme();
  const [selected, setSelected] = useState<number[]>(selectedIds);
  const [filterSearch, setFilterSearch] = useState('');

  if (!isOpen) return null;

  const toggleSelect = (id: number) => {
    if (selected.includes(id)) {
      setSelected(selected.filter(i => i !== id));
    } else {
      if (selected.length >= 9) {
        alert('Solo puedes seleccionar un máximo de 9 productos favoritos.');
        return;
      }
      setSelected([...selected, id]);
    }
  };

  const filteredProds = products.filter(p =>
    !filterSearch.trim() ||
    p.name.toLowerCase().includes(filterSearch.toLowerCase().trim()) ||
    p.code.toLowerCase().includes(filterSearch.toLowerCase().trim())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className={`w-full max-w-xl rounded-3xl border ${themeClasses.border} ${themeClasses.card} shadow-2xl p-4 sm:p-5 space-y-3 animate-scaleIn`}>
        <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-blue-600" />
            <div>
              <h3 className="font-black text-sm sm:text-base text-slate-900 dark:text-slate-100">
                Personalizar 9 Productos Rápidos
              </h3>
              <p className="text-[11px] font-bold text-slate-500">
                Selecciona hasta 9 productos para acceder a ellos con un solo clic ({selected.length}/9 seleccionados)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 opacity-50" />
          <input
            type="text"
            value={filterSearch}
            onChange={(e) => setFilterSearch(e.target.value)}
            placeholder="Buscar productos a incluir en los 9 rápidos..."
            className={`w-full pl-9 pr-3 py-1.5 text-xs font-bold rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg}`}
          />
        </div>

        <div className="max-h-[300px] overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
          {filteredProds.map(p => {
            const isSelected = selected.includes(p.id!);
            return (
              <div
                key={p.id}
                onClick={() => toggleSelect(p.id!)}
                className={`p-2 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                  isSelected
                    ? 'bg-blue-50/90 border-blue-500 dark:bg-blue-950/60 font-black'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-4 h-4 rounded flex items-center justify-center border ${
                    isSelected ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-400'
                  }`}>
                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                  </div>
                  <div>
                    <p className="text-xs text-slate-900 dark:text-slate-100">{p.name}</p>
                    <p className="text-[10px] font-mono opacity-60">{p.code} • Stock: {p.stock} {p.unit || 'UN'}</p>
                  </div>
                </div>
                <span className="text-xs font-mono font-black text-emerald-600">
                  ${(p.price || 0).toLocaleString('es-CL')}
                </span>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setSelected([])}
            className="text-xs font-bold text-slate-500 hover:text-red-500 cursor-pointer"
          >
            Restablecer a Top Automático
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl text-xs font-bold border border-slate-300 dark:border-slate-700 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => onSave(selected)}
              className="px-4 py-1.5 rounded-xl text-xs font-black bg-blue-600 hover:bg-blue-700 text-white shadow-md cursor-pointer"
            >
              Guardar 9 Favoritos
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
