import { getRubroPreset, type CompanyServiceOption } from '../../utils/rubroPresets';
import React, { useState, useEffect, useMemo } from 'react';
import { useTheme } from '../../utils/themeContext';
import { useCompany } from '../../utils/companyContext';
import { useAuth } from '../../utils/authContext';
import { db } from '../../db/database';
import type { Product, Sale, SaleItem } from '../../types';
import { getChileLocalDateString } from '../../utils/chileanCurrencyAndDates';
import { formatCLP, formatRut, getDteLabel, getPaymentMethodLabel, generateSaleThermalTicketPDF, generateSaleInvoicePDF } from '../../utils/salesPdfGenerator';
import { exportSalesLedgerExcel } from '../../utils/salesExcelExporter';
import { PDFViewerModal } from '../PDFViewerModal';
import { SiiConfigModal } from './SiiConfigModal';
import { CustomerManagerModal } from '../customers/CustomerManagerModal';
import { SaleCheckoutModal } from './SaleCheckoutModal';
import { SaleDetailsModal } from './SaleDetailsModal';
import { CashClosingModal } from './CashClosingModal';
import { WeighableProductModal } from './WeighableProductModal';
import { ProductConsultantModal } from '../inventory/ProductConsultantModal';
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
  Square,
  ArrowRight,
  LayoutGrid
} from 'lucide-react';

interface SalesViewProps {
  onOpenScanner?: () => void;
  onOpenConsultant?: () => void;
  scannedBarcode?: string;
  refreshTrigger?: number;
  onCartCountChange?: (count: number) => void;
}

// Subcomponente para edición libre y reactiva de cantidad de ítem en el carrito
const CartQuantityInput: React.FC<{
  quantity: number;
  unit?: string;
  onCommit: (newQty: number) => void;
}> = ({ quantity, unit, onCommit }) => {
  const [val, setVal] = useState<string>(String(quantity));

  useEffect(() => {
    setVal(String(quantity));
  }, [quantity]);

  const handleBlurOrCommit = () => {
    const parsed = parseFloat(val);
    if (isNaN(parsed) || parsed <= 0) {
      setVal(String(quantity));
    } else {
      onCommit(parsed);
    }
  };

  return (
    <input
      type="number"
      min="0.001"
      step={unit === 'Kg' || unit === 'Gramos' ? "0.001" : "1"}
      value={val}
      onChange={(e) => {
        setVal(e.target.value);
        const parsed = parseFloat(e.target.value);
        if (!isNaN(parsed) && parsed > 0) {
          onCommit(parsed);
        }
      }}
      onBlur={handleBlurOrCommit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          handleBlurOrCommit();
          e.currentTarget.blur();
        }
      }}
      onFocus={(e) => e.target.select()}
      className="w-14 sm:w-16 h-8 text-center font-black font-mono text-xs sm:text-sm bg-white dark:bg-slate-900 border-2 border-blue-500/80 dark:border-blue-400 text-blue-950 dark:text-blue-100 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 shadow-xs cursor-text [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      title="Haz clic para anotar la cantidad solicitada por el cliente"
    />
  );
};

export const SalesView: React.FC<SalesViewProps> = ({
  onOpenScanner,
  onOpenConsultant,
  scannedBarcode,
  refreshTrigger,
  onCartCountChange
}) => {
  const { theme, themeClasses } = useTheme();
  const { selectedCompanyId, selectedCompany } = useCompany();
  const { isReadOnly, currentUser, isSuperAdmin, isAdmin } = useAuth();

  const [activeSubTab, setActiveSubTab] = useState<'pos' | 'history'>('pos');
  const [mobilePosTab, setMobilePosTab] = useState<'catalog' | 'cart'>('catalog');
  const [isConsultantOpen, setIsConsultantOpen] = useState(false);
  const [showQuick9Only, setShowQuick9Only] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);

  // Perfil de Rubro y Servicios Contextuales de la Empresa
  const currentRubro = React.useMemo(() => {
    return getRubroPreset(selectedCompany?.rubroKey);
  }, [selectedCompany?.rubroKey]);

  const activeServices = React.useMemo(() => {
    if (selectedCompany?.customServices && selectedCompany.customServices.length > 0) {
      return selectedCompany.customServices.filter(s => s.active);
    }
    return currentRubro.serviceOptions?.filter(s => s.active) || [];
  }, [selectedCompany?.customServices, currentRubro]);

  const [isServicesModalOpen, setIsServicesModalOpen] = useState(false);
  const [servicePriceInput, setServicePriceInput] = useState<Record<string, number>>({});

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
  const [priceChoiceProduct, setPriceChoiceProduct] = useState<Product | null>(null);
  const [priceChoiceQty, setPriceChoiceQty] = useState<number>(1);
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
  const [historyDateFilter, setHistoryDateFilter] = useState<'today' | '7days' | 'month' | 'all' | 'custom'>('all');
  const [historyCalendarDate, setHistoryCalendarDate] = useState<string>('');
  const [historyDteTypeFilter, setHistoryDteTypeFilter] = useState<'ALL' | 'BOLETA' | 'FACTURA' | 'INTERNA'>('ALL');

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

  useEffect(() => {
    onCartCountChange?.(cart.reduce((a, b) => a + b.quantity, 0));
  }, [cart, onCartCountChange]);

  const handleAddToCart = (product: Product, forceChoice?: 'NORMAL' | 'OFFER', requestedQty: number = 1) => {
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

    // Si tiene oferta activa y no se especificó cuál precio llevar, abrir modal de selección
    if (hasOffer && !forceChoice) {
      setPriceChoiceProduct(product);
      setPriceChoiceQty(1);
      return;
    }

    const isTakingOffer = forceChoice === 'OFFER';
    const regularPrice = product.price && product.price > 0 ? product.price : 10000;
    const effectivePrice = isTakingOffer ? product.offerPrice! : regularPrice;
    const maxOfferRemaining = product.offerStockRemaining !== undefined ? product.offerStockRemaining : (product.offerStockLimit || 0);
    const qtyToAdd = Math.max(1, requestedQty);

    setCart(prev => {
      // Diferenciar en el carrito si se lleva a precio normal o de liquidación
      const existingIndex = prev.findIndex(item => item.productId === product.id && Boolean(item.isOffer) === isTakingOffer);

      // Validar stock total en tienda
      const otherInCart = prev
        .filter(item => item.productId === product.id && (existingIndex < 0 || prev[existingIndex] !== item))
        .reduce((sum, item) => sum + item.quantity, 0);

      const existingQty = existingIndex >= 0 ? prev[existingIndex].quantity : 0;
      if (otherInCart + existingQty + qtyToAdd > product.stock) {
        alert(`Stock máximo disponible en tienda: ${product.stock} ${product.unit || 'UN'}`);
        return prev;
      }

      // Si lleva oferta, validar unidades restantes disponibles en liquidación
      if (isTakingOffer) {
        const offerInCart = prev
          .filter(item => item.productId === product.id && item.isOffer && (existingIndex < 0 || prev[existingIndex] !== item))
          .reduce((sum, item) => sum + item.quantity, 0);

        if (offerInCart + existingQty + qtyToAdd > maxOfferRemaining) {
          alert(`Solo quedan ${maxOfferRemaining} unidades disponibles a precio de liquidación. El resto debe llevarse a precio normal.`);
          return prev;
        }
      }

      if (existingIndex >= 0) {
        const existing = prev[existingIndex];
        const next = [...prev];
        const nextQty = existing.quantity + qtyToAdd;
        next[existingIndex] = {
          ...existing,
          quantity: nextQty,
          subtotal: Math.round(nextQty * existing.unitPrice)
        };
        return next;
      } else {
        return [
          ...prev,
          {
            productId: product.id,
            productCode: product.code,
            productName: product.name,
            quantity: qtyToAdd,
            unitPrice: effectivePrice,
            originalPrice: regularPrice,
            isOffer: isTakingOffer,
            subtotal: Math.round(qtyToAdd * effectivePrice),
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

  const handleSetQuantity = (productId: number | undefined, rawQty: number, isOffer?: boolean, productCode?: string) => {
    if (isNaN(rawQty) || rawQty <= 0) return;

    setCart(prev => {
      return prev.map(item => {
        const match = ((productId && item.productId === productId) || (productCode && item.productCode === productCode)) && (isOffer === undefined || Boolean(item.isOffer) === Boolean(isOffer));
        if (!match) return item;

        let newQty = rawQty;
        if (item.unit !== 'Kg' && item.unit !== 'Gramos') {
          newQty = Math.max(1, Math.round(newQty));
        }

        // Validar stock total en tienda
        if (item.productId) {
          const prod = products.find(p => p.id === item.productId);
          if (prod) {
            const otherInCart = prev
              .filter(p => p.productId === item.productId && p !== item)
              .reduce((sum, p) => sum + p.quantity, 0);

            if (otherInCart + newQty > prod.stock) {
              alert(`Stock máximo disponible en tienda: ${prod.stock} ${prod.unit || 'UN'}`);
              newQty = Math.max(1, prod.stock - otherInCart);
            }

            if (item.isOffer) {
              const maxOfferRem = prod.offerStockRemaining !== undefined ? prod.offerStockRemaining : (prod.offerStockLimit || 0);
              if (newQty > maxOfferRem) {
                alert(`Solo quedan ${maxOfferRem} unidades disponibles a precio de liquidación.`);
                newQty = maxOfferRem;
              }
            }
          }
        }

        return {
          ...item,
          quantity: newQty,
          subtotal: Math.round(newQty * item.unitPrice)
        };
      });
    });
  };

  const handleUpdateQuantity = (productId?: number, delta: number = 1, isOffer?: boolean, productCode?: string) => {
    setCart(prev => {
      return prev
        .map(item => {
          const match = ((productId && item.productId === productId) || (productCode && item.productCode === productCode)) && (isOffer === undefined || Boolean(item.isOffer) === Boolean(isOffer));
          if (match) {
            const step = (item.unit === 'Kg' || item.unit === 'Gramos' || !Number.isInteger(item.quantity)) ? (delta > 0 ? 0.250 : -0.250) : delta;
            const newQty = Number((item.quantity + step).toFixed(3));
            if (newQty <= 0) return null;

            // Validar stock si aumenta
            if (delta > 0 && item.productId) {
              const prod = products.find(p => p.id === item.productId);
              if (prod) {
                const totalInCart = prev
                  .filter(p => p.productId === item.productId)
                  .reduce((sum, p) => sum + (p === item ? newQty : p.quantity), 0);
                if (totalInCart > prod.stock) {
                  alert(`Stock máximo disponible: ${prod.stock} ${prod.unit || 'UN'}`);
                  return item;
                }
                if (item.isOffer) {
                  const maxOfferRem = prod.offerStockRemaining !== undefined ? prod.offerStockRemaining : (prod.offerStockLimit || 0);
                  if (newQty > maxOfferRem) {
                    alert(`Solo quedan ${maxOfferRem} unidades disponibles a precio de liquidación.`);
                    return item;
                  }
                }
              }
            }

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

  const handleRemoveFromCart = (productId: number, isOffer?: boolean) => {
    setCart(prev => prev.filter(item => !(item.productId === productId && (isOffer === undefined || Boolean(item.isOffer) === Boolean(isOffer)))));
  };

  // Permite al vendedor alternar en el carrito si el cliente lleva a precio normal o de liquidación
  const handleToggleCartItemPrice = (itemToToggle: SaleItem) => {
    if (!itemToToggle.productId) return;
    const prod = products.find(p => p.id === itemToToggle.productId);
    if (!prod) return;

    const currentlyOffer = Boolean(itemToToggle.isOffer);
    const targetOffer = !currentlyOffer;

    if (targetOffer) {
      // Pasar a precio de liquidación
      const hasOffer = Boolean(prod.offerPrice && prod.offerPrice > 0 && (prod.offerStockRemaining === undefined || prod.offerStockRemaining > 0));
      if (!hasOffer) {
        alert('Este producto ya no cuenta con unidades disponibles en liquidación.');
        return;
      }
      const maxOfferRem = prod.offerStockRemaining !== undefined ? prod.offerStockRemaining : (prod.offerStockLimit || 0);
      const otherOfferInCart = cart
        .filter(it => it.productId === prod.id && it.isOffer && it !== itemToToggle)
        .reduce((sum, it) => sum + it.quantity, 0);

      if (otherOfferInCart + itemToToggle.quantity > maxOfferRem) {
        alert(`Solo quedan ${maxOfferRem} unidades en liquidación (ya tienes ${otherOfferInCart} en el carrito).`);
        return;
      }

      setCart(prev => {
        const withoutCurrent = prev.filter(it => it !== itemToToggle);
        const existingOfferIndex = withoutCurrent.findIndex(it => it.productId === prod.id && it.isOffer);
        const offerUnitPrice = prod.offerPrice!;

        if (existingOfferIndex >= 0) {
          const mergedQty = withoutCurrent[existingOfferIndex].quantity + itemToToggle.quantity;
          withoutCurrent[existingOfferIndex] = {
            ...withoutCurrent[existingOfferIndex],
            quantity: mergedQty,
            subtotal: Math.round(mergedQty * offerUnitPrice)
          };
          return withoutCurrent;
        } else {
          return [
            ...withoutCurrent,
            {
              ...itemToToggle,
              isOffer: true,
              unitPrice: offerUnitPrice,
              subtotal: Math.round(itemToToggle.quantity * offerUnitPrice)
            }
          ];
        }
      });
    } else {
      // Pasar a precio normal
      const regularPrice = prod.price && prod.price > 0 ? prod.price : (itemToToggle.originalPrice || 10000);
      setCart(prev => {
        const withoutCurrent = prev.filter(it => it !== itemToToggle);
        const existingNormalIndex = withoutCurrent.findIndex(it => it.productId === prod.id && !it.isOffer);

        if (existingNormalIndex >= 0) {
          const mergedQty = withoutCurrent[existingNormalIndex].quantity + itemToToggle.quantity;
          withoutCurrent[existingNormalIndex] = {
            ...withoutCurrent[existingNormalIndex],
            quantity: mergedQty,
            subtotal: Math.round(mergedQty * regularPrice)
          };
          return withoutCurrent;
        } else {
          return [
            ...withoutCurrent,
            {
              ...itemToToggle,
              isOffer: false,
              unitPrice: regularPrice,
              subtotal: Math.round(itemToToggle.quantity * regularPrice)
            }
          ];
        }
      });
    }
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
  const chileToday = getChileLocalDateString(now);
  const utcToday = now.toISOString().slice(0, 10);
  const currentChileMonth = chileToday.slice(0, 7);
  const currentUtcMonth = utcToday.slice(0, 7);
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  const filteredSalesHistory = salesHistory.filter(s => {
    // 1. Filtro por tipo de documento (Boleta, Factura, Venta Interna)
    if (historyDteTypeFilter === 'BOLETA' && !s.dteType.toUpperCase().includes('BOLETA')) return false;
    if (historyDteTypeFilter === 'FACTURA' && !s.dteType.toUpperCase().includes('FACTURA')) return false;
    if (historyDteTypeFilter === 'INTERNA') {
      const isInternal = s.dteType.toUpperCase().includes('INTERNA') || 
                         s.dteType.toUpperCase().includes('TICKET') || 
                         (!s.dteType.toUpperCase().includes('BOLETA') && !s.dteType.toUpperCase().includes('FACTURA'));
      if (!isInternal) return false;
    }

    // 2. Buscador por cliente, número de boleta, RUT, vendedor, medio de pago, producto
    const q = historySearch.toLowerCase().trim();
    if (q) {
      const matchFolio = String(s.folio || '').toLowerCase().includes(q) || `#${s.folio}`.toLowerCase().includes(q);
      const matchCustomer = String(s.customerName || '').toLowerCase().includes(q) || String(s.customerRut || '').toLowerCase().includes(q);
      const matchSeller = String(s.sellerName || '').toLowerCase().includes(q);
      const matchDte = String(s.dteType || '').toLowerCase().includes(q);
      const matchPayment = String(s.paymentMethod || '').toLowerCase().includes(q);
      const matchItems = s.items?.some(it => 
        (it.productName && it.productName.toLowerCase().includes(q)) || (it.productCode && it.productCode.toLowerCase().includes(q))
      );
      if (!matchFolio && !matchCustomer && !matchSeller && !matchDte && !matchPayment && !matchItems) {
        return false;
      }
    }

    // 3. Buscador tipo calendario para las fechas
    if (historyCalendarDate) {
      const saleDate = s.date || '';
      const saleCreatedDate = s.createdAt ? s.createdAt.slice(0, 10) : '';
      const saleChileDate = s.createdAt ? getChileLocalDateString(new Date(s.createdAt)) : '';
      const matchesCalendar = saleDate === historyCalendarDate || saleCreatedDate === historyCalendarDate || saleChileDate === historyCalendarDate;
      if (!matchesCalendar) return false;
    } else if (historyDateFilter === 'today') {
      const saleDate = s.date || '';
      const saleCreatedDate = s.createdAt ? s.createdAt.slice(0, 10) : '';
      const saleChileDate = s.createdAt ? getChileLocalDateString(new Date(s.createdAt)) : '';
      return saleDate === chileToday || saleDate === utcToday || saleCreatedDate === utcToday || saleChileDate === chileToday;
    } else if (historyDateFilter === '7days') {
      const saleTime = s.createdAt ? new Date(s.createdAt).getTime() : new Date(s.date).getTime();
      return !isNaN(saleTime) && saleTime >= sevenDaysAgo;
    } else if (historyDateFilter === 'month') {
      const saleDate = s.date || '';
      const saleCreatedDate = s.createdAt ? s.createdAt.slice(0, 7) : '';
      return saleDate.startsWith(currentChileMonth) || saleDate.startsWith(currentUtcMonth) || saleCreatedDate === currentChileMonth || saleCreatedDate === currentUtcMonth;
    }

    return true;
  });

  const totalHistoryRevenue = filteredSalesHistory
    .filter(s => s.status !== 'ANULADA')
    .reduce((acc, s) => acc + s.total, 0);

  const totalBoletasCount = salesHistory
    .filter(s => s.status !== 'ANULADA' && s.dteType.toUpperCase().includes('BOLETA')).length;

  const totalFacturasCount = salesHistory
    .filter(s => s.status !== 'ANULADA' && s.dteType.toUpperCase().includes('FACTURA')).length;

  const totalInternasCount = salesHistory
    .filter(s => s.status !== 'ANULADA' && !s.dteType.toUpperCase().includes('BOLETA') && !s.dteType.toUpperCase().includes('FACTURA')).length;

  const totalBoletasRevenue = salesHistory
    .filter(s => s.status !== 'ANULADA' && s.dteType.toUpperCase().includes('BOLETA'))
    .reduce((acc, s) => acc + (s.total || 0), 0);

  const totalFacturasRevenue = salesHistory
    .filter(s => s.status !== 'ANULADA' && s.dteType.toUpperCase().includes('FACTURA'))
    .reduce((acc, s) => acc + (s.total || 0), 0);

  const totalInternasRevenue = salesHistory
    .filter(s => s.status !== 'ANULADA' && !s.dteType.toUpperCase().includes('BOLETA') && !s.dteType.toUpperCase().includes('FACTURA'))
    .reduce((acc, s) => acc + (s.total || 0), 0);

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
      {/* 1. Encabezado de HISTORIAL (Alineado exactamente con la columna del Menú de Ventas) */}
      {activeSubTab === 'history' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
          <div className="lg:col-span-7 xl:col-span-8">
            <div className={`p-2.5 sm:p-3 rounded-2xl border ${themeClasses.card} shadow-xs flex flex-wrap items-center justify-between gap-2`}>
              <div className="flex items-center gap-2.5">
                <div className={`w-9 h-9 rounded-2xl flex items-center justify-center text-white shadow-md shrink-0 ${themeClasses.accentBg}`}>
                  <ShoppingCart className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h1 className="text-base font-black flex items-center gap-1.5 text-slate-900 dark:text-white">
                    <span>Historial de Ventas & DTE</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${themeClasses.badge}`}>
                      DTE
                    </span>
                  </h1>
                  <p className="text-[11px] opacity-75 hidden sm:block font-bold">
                    Boletas, Facturas y Cierres Z
                  </p>
                </div>
              </div>

              {/* Botones de navegación en el encabezado */}
              <div className="flex flex-wrap items-center gap-1.5">
                <div className={`flex items-center p-0.5 rounded-2xl border ${themeClasses.cardSubtle}`}>
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
          </div>
        </div>
      )}

      {/* POS Terminal: Orden y Presentación Exacta como Imagen 2 */}
      {activeSubTab === 'pos' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch flex-1 h-full min-h-0 overflow-hidden">
          
          {/* Columna Izquierda: Encabezado -> Buscador -> Categorías + 9 Favoritos en 1 sola línea -> Tarjetas */}
          <div className={`lg:col-span-7 xl:col-span-8 ${mobilePosTab === 'catalog' ? 'flex' : 'hidden lg:flex'} flex-col justify-start space-y-1.5 h-full min-h-0 overflow-hidden pb-16 lg:pb-0`}>
            
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
                      {hasOffer && !isOutOfStock ? (
                        <div className="flex items-center gap-1.5 w-full justify-between" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => handleAddToCart(prod, 'NORMAL')}
                            className="flex-1 py-1.5 px-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-mono font-black text-[10.5px] text-center transition active:scale-95 cursor-pointer shadow-2xs"
                            title="Llevar a Precio Normal"
                          >
                            Normal: ${regularPrice.toLocaleString('es-CL')}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAddToCart(prod, 'OFFER')}
                            className="flex-1 py-1.5 px-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-mono font-black text-[10.5px] text-center transition active:scale-95 cursor-pointer shadow-xs"
                            title="Llevar a Precio Liquidación"
                          >
                            🔥 Liq: ${prod.offerPrice!.toLocaleString('es-CL')}
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex flex-col">
                            <div className="flex items-baseline gap-1.5">
                              <span className="text-sm sm:text-base font-black font-mono text-emerald-700 dark:text-emerald-400">
                                ${currentPrice.toLocaleString('es-CL')}
                              </span>
                            </div>
                          </div>

                          <button
                            type="button"
                            disabled={isOutOfStock}
                            onClick={(e) => { e.stopPropagation(); handleAddToCart(prod); }}
                            className={`w-8 h-8 rounded-xl text-white transition flex items-center justify-center ${
                              isOutOfStock ? 'bg-slate-400' : `${themeClasses.accentBg} group-hover:scale-110 shadow-xs`
                            }`}
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Columna Derecha: Carrito de Venta - Alargado hacia Abajo */}
          <div className={`lg:col-span-5 xl:col-span-4 ${mobilePosTab === 'cart' ? 'flex' : 'hidden lg:flex'} flex-col h-full min-h-0 overflow-hidden pb-16 lg:pb-0`}>
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
                  {cart.map((item, idx) => {
                    const prod = products.find(p => p.id === item.productId);
                    const canOffer = prod && prod.offerPrice && prod.offerPrice > 0 && (prod.offerStockRemaining === undefined || prod.offerStockRemaining > 0);

                    return (
                      <div
                        key={`${item.productId || idx}_${item.isOffer ? 'offer' : 'normal'}`}
                        className={`p-2.5 sm:p-3 rounded-2xl border ${item.isOffer ? 'bg-amber-50/90 border-amber-300 dark:bg-amber-950/40 dark:border-amber-700' : themeClasses.cardSubtle} flex items-center justify-between gap-2 shadow-2xs`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="font-black text-xs sm:text-sm truncate leading-tight text-slate-900 dark:text-slate-100">
                              {item.productName}
                            </p>
                            {item.isOffer ? (
                              <button
                                type="button"
                                onClick={() => handleToggleCartItemPrice(item)}
                                className="text-[9px] font-black px-2 py-0.5 bg-amber-500 hover:bg-amber-600 text-white rounded-full flex items-center gap-1 cursor-pointer transition shadow-2xs active:scale-95"
                                title="Click para cambiar a Precio Normal"
                              >
                                <span>🔥 Liq.</span>
                                <span className="opacity-80 text-[8px]">⇄ Normal</span>
                              </button>
                            ) : canOffer ? (
                              <button
                                type="button"
                                onClick={() => handleToggleCartItemPrice(item)}
                                className="text-[9px] font-black px-2 py-0.5 bg-slate-200 hover:bg-amber-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:text-amber-900 rounded-full flex items-center gap-1 cursor-pointer transition shadow-2xs active:scale-95"
                                title="Click para cambiar a Precio Liquidación"
                              >
                                <span>💵 Normal</span>
                                <span className="opacity-80 text-[8px]">⇄ Liq.</span>
                              </button>
                            ) : null}
                          </div>
                          <p className="text-[11px] opacity-75 font-mono font-bold mt-0.5">
                            ${item.unitPrice.toLocaleString('es-CL')}/{item.unit || 'UN'}
                          </p>
                        </div>

                        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleUpdateQuantity(item.productId, -1, item.isOffer)}
                            className="p-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 hover:opacity-80 text-slate-800 dark:text-slate-100 active:scale-95 cursor-pointer font-bold"
                            title="Restar 1 unidad"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>

                          {/* Input directo para anotar el número de unidades exacto que solicita el cliente */}
                          <div className="relative flex items-center">
                            <CartQuantityInput
                              quantity={item.quantity}
                              unit={item.unit}
                              onCommit={(newQty) => handleSetQuantity(item.productId, newQty, item.isOffer)}
                            />
                          </div>

                          <button
                            type="button"
                            onClick={() => handleUpdateQuantity(item.productId, 1, item.isOffer)}
                            className="p-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 hover:opacity-80 text-slate-800 dark:text-slate-100 active:scale-95 cursor-pointer font-bold"
                            title="Sumar 1 unidad"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>

                          <span className="text-xs sm:text-sm font-black font-mono ml-1 text-emerald-700 dark:text-emerald-400 min-w-[64px] text-right">
                            ${item.subtotal.toLocaleString('es-CL')}
                          </span>

                          <button
                            type="button"
                            onClick={() => handleRemoveFromCart(item.productId!, item.isOffer)}
                            className="p-1 text-slate-400 hover:text-red-500 ml-0.5 cursor-pointer"
                            title="Quitar producto"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
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

      {/* Vista de Historial de Ventas (Listado hacia abajo con apertura en tarjeta) */}
      {activeSubTab === 'history' && (
        <div className="space-y-4">
          {/* Tarjetas y Botones Interactivos de Métricas por Tipo de Comprobante */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {/* 1. Botón Métrica: Total Recaudado / Todos */}
            <button
              type="button"
              onClick={() => setHistoryDteTypeFilter('ALL')}
              className={`p-3 sm:p-3.5 rounded-2xl border text-left transition cursor-pointer active:scale-98 ${
                historyDteTypeFilter === 'ALL'
                  ? 'border-2 border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/40 dark:bg-emerald-950/30'
                  : `${themeClasses.border} ${themeClasses.card} hover:border-slate-400 dark:hover:border-slate-600`
              } shadow-xs flex items-center gap-2.5 sm:gap-3`}
              title="Presione para ver todos los documentos emitidos"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center font-black shrink-0">
                <DollarSign className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 truncate">Total Recaudado</p>
                  <span className="text-[9.5px] font-black px-1.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200">
                    {salesHistory.filter(s => s.status !== 'ANULADA').length} cant.
                  </span>
                </div>
                <p className="text-sm sm:text-base font-black font-mono text-emerald-600 dark:text-emerald-400 truncate">
                  ${totalHistoryRevenue.toLocaleString('es-CL')}
                </p>
                <p className="text-[9.5px] font-bold text-slate-400 truncate">Todos los documentos</p>
              </div>
            </button>

            {/* 2. Botón Métrica: Boletas Emitidas */}
            <button
              type="button"
              onClick={() => setHistoryDteTypeFilter('BOLETA')}
              className={`p-3 sm:p-3.5 rounded-2xl border text-left transition cursor-pointer active:scale-98 ${
                historyDteTypeFilter === 'BOLETA'
                  ? 'border-2 border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/40 dark:bg-blue-950/30'
                  : `${themeClasses.border} ${themeClasses.card} hover:border-slate-400 dark:hover:border-slate-600`
              } shadow-xs flex items-center gap-2.5 sm:gap-3`}
              title="Presione para filtrar solo Boletas Electrónicas"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 flex items-center justify-center font-black shrink-0">
                <Receipt className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 truncate">Boletas Emitidas</p>
                  <span className="text-[9.5px] font-black px-1.5 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                    {totalBoletasCount} cant.
                  </span>
                </div>
                <p className="text-sm sm:text-base font-black font-mono text-blue-600 dark:text-blue-400 truncate">
                  ${totalBoletasRevenue.toLocaleString('es-CL')}
                </p>
                <p className="text-[9.5px] font-bold text-slate-400 truncate">Total en Boletas (39)</p>
              </div>
            </button>

            {/* 3. Botón Métrica: Facturas Emitidas */}
            <button
              type="button"
              onClick={() => setHistoryDteTypeFilter('FACTURA')}
              className={`p-3 sm:p-3.5 rounded-2xl border text-left transition cursor-pointer active:scale-98 ${
                historyDteTypeFilter === 'FACTURA'
                  ? 'border-2 border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/40 dark:bg-indigo-950/30'
                  : `${themeClasses.border} ${themeClasses.card} hover:border-slate-400 dark:hover:border-slate-600`
              } shadow-xs flex items-center gap-2.5 sm:gap-3`}
              title="Presione para filtrar solo Facturas Electrónicas"
            >
              <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 flex items-center justify-center font-black shrink-0">
                <Building className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 truncate">Facturas Emitidas</p>
                  <span className="text-[9.5px] font-black px-1.5 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200">
                    {totalFacturasCount} cant.
                  </span>
                </div>
                <p className="text-sm sm:text-base font-black font-mono text-indigo-600 dark:text-indigo-400 truncate">
                  ${totalFacturasRevenue.toLocaleString('es-CL')}
                </p>
                <p className="text-[9.5px] font-bold text-slate-400 truncate">Total en Facturas (33)</p>
              </div>
            </button>

            {/* 4. Botón Métrica: Comprobantes Internos */}
            <button
              type="button"
              onClick={() => setHistoryDteTypeFilter('INTERNA')}
              className={`p-3 sm:p-3.5 rounded-2xl border text-left transition cursor-pointer active:scale-98 ${
                historyDteTypeFilter === 'INTERNA'
                  ? 'border-2 border-amber-500 ring-2 ring-amber-500/20 bg-amber-50/40 dark:bg-amber-950/30'
                  : `${themeClasses.border} ${themeClasses.card} hover:border-slate-400 dark:hover:border-slate-600`
              } shadow-xs flex items-center gap-2.5 sm:gap-3`}
              title="Presione para filtrar solo Comprobantes Internos"
            >
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-600 flex items-center justify-center font-black shrink-0">
                <Tag className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 truncate">Comprobantes Internos</p>
                  <span className="text-[9.5px] font-black px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200">
                    {totalInternasCount} cant.
                  </span>
                </div>
                <p className="text-sm sm:text-base font-black font-mono text-amber-600 dark:text-amber-400 truncate">
                  ${totalInternasRevenue.toLocaleString('es-CL')}
                </p>
                <p className="text-[9.5px] font-bold text-slate-400 truncate">Total Venta Interna</p>
              </div>
            </button>
          </div>

          {/* Barra de Filtros, Buscador por Texto y Buscador Tipo Calendario */}
          <div className={`p-3.5 rounded-2xl border ${themeClasses.card} shadow-xs space-y-3`}>
            
            {/* Fila 1: Filtro por Tipo de Documento */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-2.5">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] font-black text-slate-500 mr-1">Documentos:</span>
                {[
                  { id: 'ALL', label: 'Todos los Documentos', count: salesHistory.length },
                  { id: 'BOLETA', label: '🧾 Boletas Electrónicas', count: totalBoletasCount },
                  { id: 'FACTURA', label: '🏢 Facturas Electrónicas', count: totalFacturasCount },
                  { id: 'INTERNA', label: '🎫 Venta Interna / Tickets', count: totalInternasCount }
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setHistoryDteTypeFilter(t.id as any)}
                    className={`px-3 py-1 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
                      historyDteTypeFilter === t.id
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    <span>{t.label}</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                      historyDteTypeFilter === t.id ? 'bg-blue-800 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                    }`}>
                      {t.count}
                    </span>
                  </button>
                ))}
              </div>

              <div className="text-[11px] font-bold text-slate-500">
                Mostrando <strong className="text-slate-900 dark:text-white">{filteredSalesHistory.length}</strong> documentos
              </div>
            </div>

            {/* Fila 2: Barra de Búsqueda y Buscador Tipo Calendario */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-center">
              
              {/* Barra de Búsqueda por cliente, número de boleta/factura, etc. */}
              <div className="md:col-span-6 relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder="Buscar por cliente, RUT, N° boleta o factura (#1001), vendedor..."
                  className={`w-full pl-9 pr-8 py-2 rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-xs font-bold focus:outline-none`}
                />
                {historySearch && (
                  <button
                    type="button"
                    onClick={() => setHistorySearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer p-0.5"
                    title="Limpiar búsqueda"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Buscador Tipo Calendario para las Fechas */}
              <div className="md:col-span-3">
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} shadow-2xs`}>
                  <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span className="text-[11px] font-black text-slate-500 shrink-0">Fecha:</span>
                  <input
                    type="date"
                    value={historyCalendarDate}
                    onChange={(e) => {
                      setHistoryCalendarDate(e.target.value);
                      if (e.target.value) {
                        setHistoryDateFilter('custom');
                      }
                    }}
                    className="bg-transparent text-xs font-black text-slate-900 dark:text-white focus:outline-none cursor-pointer w-full"
                    title="Buscador tipo calendario: selecciona una fecha exacta"
                  />
                  {historyCalendarDate && (
                    <button
                      type="button"
                      onClick={() => {
                        setHistoryCalendarDate('');
                        setHistoryDateFilter('all');
                      }}
                      className="text-xs font-bold text-slate-400 hover:text-red-500 cursor-pointer shrink-0 ml-1"
                      title="Quitar filtro de fecha"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Filtros Rápidos de Periodo */}
              <div className="md:col-span-3 flex items-center justify-end">
                <div className={`flex items-center p-0.5 rounded-xl border ${themeClasses.cardSubtle} w-full justify-between sm:justify-end`}>
                  {[
                    { id: 'today', label: 'Hoy' },
                    { id: '7days', label: '7 días' },
                    { id: 'month', label: 'Mes' },
                    { id: 'all', label: 'Todo' }
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => {
                        setHistoryCalendarDate('');
                        setHistoryDateFilter(f.id as any);
                      }}
                      className={`px-2.5 py-1 text-xs font-black rounded-lg transition cursor-pointer ${
                        !historyCalendarDate && historyDateFilter === f.id
                          ? `${themeClasses.accentBg} text-white shadow-2xs`
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

            </div>

          </div>

          {/* ========================================================================= */}
          {/* LISTADO HACIA ABAJO (AL PRESIONAR SE MUESTRA LA TARJETA COMPLETA)         */}
          {/* ========================================================================= */}
          {filteredSalesHistory.length === 0 ? (
            <div className={`p-10 rounded-3xl border-2 ${themeClasses.border} ${themeClasses.card} text-center space-y-3 shadow-xs`}>
              <Receipt className="w-12 h-12 mx-auto text-slate-400 opacity-50 mb-1" />
              <p className="font-black text-base text-slate-800 dark:text-slate-200">
                No se encontraron documentos en el listado
              </p>
              <p className="font-bold text-xs text-slate-500 dark:text-slate-400">
                {salesHistory.length > 0
                  ? `No hay ventas que coincidan con los filtros aplicados (Fecha: ${historyCalendarDate || historyDateFilter}, Búsqueda: "${historySearch || 'Ninguna'}")`
                  : 'Aún no se han registrado ventas en el sistema.'}
              </p>
              {salesHistory.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setHistoryCalendarDate('');
                    setHistoryDateFilter('all');
                    setHistorySearch('');
                    setHistoryDteTypeFilter('ALL');
                  }}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs cursor-pointer shadow-xs active:scale-95 transition inline-flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restablecer y mostrar todos los {salesHistory.length} documentos</span>
                </button>
              )}
            </div>
          ) : (
            /* LISTADO HACIA ABAJO ESTRUCTURADO (TABLA / LISTA VERTICAL INTERACTIVA) */
            <div className={`rounded-2xl border-2 ${themeClasses.border} ${themeClasses.card} overflow-hidden shadow-xs`}>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className={`border-b-2 ${themeClasses.border} ${themeClasses.cardSubtle} font-black text-slate-700 dark:text-slate-300 select-none`}>
                    <tr>
                      <th className="py-3 px-3.5 w-[16%]">FOLIO / TIPO DTE</th>
                      <th className="py-3 px-3 w-[15%]">FECHA Y HORA</th>
                      <th className="py-3 px-3 w-[23%]">CLIENTE / RUT</th>
                      <th className="py-3 px-3 w-[13%]">MEDIO DE PAGO</th>
                      <th className="py-3 px-2.5 w-[9%] text-center">ÍTEMS</th>
                      <th className="py-3 px-3.5 w-[13%] text-right">TOTAL</th>
                      <th className="py-3 px-3 w-[11%] text-center">ACCIÓN</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-bold">
                    {filteredSalesHistory.map((sale) => (
                      <tr
                        key={sale.id}
                        onClick={() => {
                          setSelectedSaleForDetails(sale);
                          setIsDetailsOpen(true);
                        }}
                        className="hover:bg-blue-50/80 dark:hover:bg-slate-800/60 transition cursor-pointer active:scale-[0.99] group"
                        title="Presione para abrir la tarjeta del documento con todas sus opciones"
                      >
                        {/* Folio y Tipo DTE */}
                        <td className="py-2.5 px-3.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-black text-sm text-blue-600 dark:text-blue-400">
                              {sale.folio ? `#${sale.folio}` : 'S/F'}
                            </span>
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                              sale.dteType.toUpperCase().includes('FACTURA')
                                ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                                : sale.dteType.toUpperCase().includes('BOLETA')
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                                : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                            }`}>
                              {getDteLabel(sale.dteType)}
                            </span>
                          </div>
                        </td>

                        {/* Fecha y Hora */}
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {sale.date} {sale.time}
                        </td>

                        {/* Cliente y RUT */}
                        <td className="py-2.5 px-3">
                          <p className="truncate max-w-[200px] font-black text-slate-900 dark:text-slate-100 text-xs">
                            {sale.customerName || 'Público General'}
                          </p>
                          {sale.customerRut && (
                            <p className="text-[10px] font-mono text-slate-500 font-bold">
                              RUT: {formatRut(sale.customerRut)}
                            </p>
                          )}
                        </td>

                        {/* Medio de Pago */}
                        <td className="py-2.5 px-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10.5px] font-black bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {getPaymentMethodLabel(sale.paymentMethod)}
                          </span>
                        </td>

                        {/* Ítems */}
                        <td className="py-2.5 px-2.5 text-center font-mono text-[11px] text-slate-500 font-bold">
                          {sale.items.length} {sale.items.length === 1 ? 'ítem' : 'ítems'}
                        </td>

                        {/* Total Pagado */}
                        <td className="py-2.5 px-3.5 text-right font-mono font-black text-sm text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                          {formatCLP(sale.total)}
                        </td>

                        {/* Botón de Acción para Ver Tarjeta */}
                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedSaleForDetails(sale);
                              setIsDetailsOpen(true);
                            }}
                            className="px-2.5 py-1 rounded-xl bg-blue-50 group-hover:bg-blue-600 text-blue-600 group-hover:text-white dark:bg-blue-950/60 dark:text-blue-300 dark:group-hover:bg-blue-600 dark:group-hover:text-white text-[11px] font-black transition flex items-center justify-center gap-1 mx-auto cursor-pointer shadow-2xs active:scale-95"
                            title="Presione para ver la tarjeta del documento con opciones de Ticket, DTE y Anulación"
                          >
                            <span>Ver Tarjeta</span>
                            <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

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

      {/* Modal de Selección de Precio al Vender (Normal vs Liquidación) */}
      {priceChoiceProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border-2 border-slate-200 dark:border-slate-800 shadow-2xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold text-lg">🏷️</span>
                <div>
                  <h3 className="font-black text-sm text-slate-900 dark:text-white">Seleccionar Precio de Venta</h3>
                  <p className="text-xs text-slate-500 font-mono">{priceChoiceProduct.code}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPriceChoiceProduct(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <h4 className="font-black text-base text-slate-900 dark:text-white leading-tight">
                {priceChoiceProduct.name}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
                Este producto tiene unidades asignadas a precio de liquidación y unidades a precio normal. Elija la cantidad y cuál precio llevará el cliente:
              </p>
            </div>

            {/* Selector interactivo de cantidad solicitada por el cliente */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
              <div className="text-left">
                <span className="text-xs font-black text-slate-800 dark:text-slate-200 block">
                  Cantidad solicitada:
                </span>
                <span className="text-[10.5px] text-slate-500 dark:text-slate-400 font-medium">
                  Anota el número de unidades que pide el cliente
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setPriceChoiceQty(q => Math.max(1, q - 1))}
                  className="w-8 h-8 rounded-xl bg-slate-200 dark:bg-slate-700 hover:opacity-80 active:scale-95 text-slate-800 dark:text-slate-200 flex items-center justify-center font-bold"
                  title="Restar 1"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <input
                  type="number"
                  min="1"
                  value={priceChoiceQty}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setPriceChoiceQty(isNaN(val) || val <= 0 ? 1 : val);
                  }}
                  onFocus={(e) => e.target.select()}
                  className="w-16 h-8 text-center font-mono font-black text-sm bg-white dark:bg-slate-900 border-2 border-blue-500 text-blue-950 dark:text-blue-100 rounded-xl focus:ring-2 focus:ring-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none shadow-2xs"
                  title="Escribe la cantidad que el cliente solicita"
                />
                <button
                  type="button"
                  onClick={() => setPriceChoiceQty(q => q + 1)}
                  className="w-8 h-8 rounded-xl bg-slate-200 dark:bg-slate-700 hover:opacity-80 active:scale-95 text-slate-800 dark:text-slate-200 flex items-center justify-center font-bold"
                  title="Sumar 1"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="space-y-2.5">
              {/* Opción 1: Liquidación */}
              <button
                type="button"
                onClick={() => {
                  handleAddToCart(priceChoiceProduct, 'OFFER', priceChoiceQty);
                  setPriceChoiceProduct(null);
                }}
                className="w-full p-3.5 rounded-2xl border-2 border-amber-400 bg-amber-50/90 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/60 transition text-left flex items-center justify-between group cursor-pointer shadow-xs"
              >
                <div>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500 text-white">
                    🔥 Precio Liquidación
                  </span>
                  <div className="text-2xl font-black font-mono text-amber-700 dark:text-amber-300 mt-1">
                    ${(priceChoiceProduct.offerPrice || 0).toLocaleString('es-CL')}
                  </div>
                  <p className="text-[11px] font-bold text-amber-800 dark:text-amber-300/90 mt-0.5">
                    Quedan {priceChoiceProduct.offerStockRemaining !== undefined ? priceChoiceProduct.offerStockRemaining : (priceChoiceProduct.offerStockLimit || 0)} unidades a este precio
                  </p>
                </div>
                <div className="px-3.5 py-2 rounded-xl bg-amber-500 text-white font-black text-xs group-hover:scale-105 transition shadow-xs">
                  Llevar Oferta ➔
                </div>
              </button>

              {/* Opción 2: Normal */}
              <button
                type="button"
                onClick={() => {
                  handleAddToCart(priceChoiceProduct, 'NORMAL', priceChoiceQty);
                  setPriceChoiceProduct(null);
                }}
                className="w-full p-3.5 rounded-2xl border-2 border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 transition text-left flex items-center justify-between group cursor-pointer shadow-xs"
              >
                <div>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-slate-600 text-white">
                    💵 Precio Normal
                  </span>
                  <div className="text-2xl font-black font-mono text-slate-800 dark:text-slate-200 mt-1">
                    ${(priceChoiceProduct.price || 10000).toLocaleString('es-CL')}
                  </div>
                  <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-0.5">
                    Stock total en local: {priceChoiceProduct.stock} {priceChoiceProduct.unit || 'UN'}
                  </p>
                </div>
                <div className="px-3.5 py-2 rounded-xl bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 font-black text-xs group-hover:scale-105 transition shadow-xs">
                  Llevar Normal ➔
                </div>
              </button>
            </div>

            <div className="pt-2 text-center">
              <p className="text-[11px] text-slate-400 font-medium">
                💡 Al acabarse las unidades en liquidación, el producto continuará vendiéndose automáticamente al precio normal.
              </p>
            </div>
          </div>
        </div>
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


      {/* Modal de Servicios del Local */}
      {isServicesModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg rounded-3xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    Servicios del Local — {selectedCompany?.name || 'Comercio'}
                  </h3>
                  <p className="text-xs text-slate-500 font-bold">
                    Opciones de servicio autorizadas por administración
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsServicesModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
              {activeServices.map((srv) => {
                const currentVal = servicePriceInput[srv.id] ?? srv.price ?? 3000;
                return (
                  <div
                    key={srv.id}
                    className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between gap-3 shadow-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-2xl">{srv.icon || '✨'}</span>
                      <div className="min-w-0">
                        <p className="text-xs font-black text-slate-900 dark:text-white truncate">{srv.name}</p>
                        {srv.description && (
                          <p className="text-[11px] text-slate-500 truncate">{srv.description}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="relative w-24">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">$</span>
                        <input
                          type="number"
                          value={currentVal}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setServicePriceInput({ ...servicePriceInput, [srv.id]: val });
                          }}
                          className="w-full pl-5 pr-2 py-1 text-xs font-black rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-right"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const item: SaleItem = {
                            productId: 0,
                            productCode: 'SRV-' + srv.id.slice(-4).toUpperCase(),
                            productName: `${srv.icon || '✨'} [Servicio] ${srv.name}`,
                            unitPrice: currentVal,
                            quantity: 1,
                            subtotal: currentVal,
                            category: 'Servicios del Local',
                            unit: 'Servicio'
                          };
                          setCart(prev => [...prev, item]);
                          setIsServicesModalOpen(false);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition cursor-pointer shadow-xs active:scale-95"
                      >
                        + Cobrar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsServicesModalOpen(false)}
                className="px-4 py-1.5 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
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
