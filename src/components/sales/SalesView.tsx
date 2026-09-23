import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useTheme } from '../../utils/themeContext';
import { useCompany } from '../../utils/companyContext';
import { useAuth } from '../../utils/authContext';
import { db } from '../../db/database';
import type { Product, Sale, SaleItem, Customer, DTEType } from '../../types';
import { getChileLocalDateString } from '../../utils/chileanCurrencyAndDates';
import { formatCLP, generateSaleInvoicePDF } from '../../utils/salesPdfGenerator';
import { getWeighableCategoriesForRubro, type RubroWeighableCategory } from '../../utils/rubroPresets';
import { exportSalesLedgerExcel } from '../../utils/salesExcelExporter';
import { PDFViewerModal } from '../PDFViewerModal';
import { SiiConfigModal } from './SiiConfigModal';
import { CustomerManagerModal } from '../customers/CustomerManagerModal';
import { SaleCheckoutModal } from './SaleCheckoutModal';
import { ThermalPrinterModal } from './ThermalPrinterModal';
import { SaleDetailsModal } from './SaleDetailsModal';
import { CashClosingModal } from './CashClosingModal';
import { WeighableProductModal } from './WeighableProductModal';
import { ProductConsultantModal } from '../inventory/ProductConsultantModal';
import type jsPDF from 'jspdf';
import {
  Printer,
  Package,
  X,
  ShoppingCart,
  Receipt,
  Search,
  Plus,
  Minus,
  Trash2,
  Barcode,
  Lock,
  Menu,
  Home,
  User,
  Folder,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet
} from 'lucide-react';

interface SalesViewProps {
  onOpenScanner?: () => void;
  onOpenConsultant?: () => void;
  scannedBarcode?: string;
  refreshTrigger?: number;
  onCartCountChange?: (count: number) => void;
}

// Subcomponente de edición numérica rápida de cantidad
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
      className="w-10 sm:w-12 h-7 text-center font-black font-mono text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded focus:outline-hidden focus:ring-1 focus:ring-sky-500 shadow-2xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
    />
  );
};

const STANDARD_CATEGORIES = [
  { code: '00', name: 'Producto Común', key: 'COMMON' },
  { code: '01', name: 'ABARROTES', key: 'Abarrotes' },
  { code: '02', name: 'BEBIDAS Y LICORES', key: 'Bebidas y Licores' },
  { code: '03', name: 'CONGELADOS', key: 'Congelados' },
  { code: '04', name: 'ART LIMPIEZA', key: 'Limpieza y Aseo' },
  { code: '05', name: 'CUIDADO PERSONAL', key: 'Cuidado Personal' },
  { code: '06', name: 'SNACKS Y GOLOSINAS', key: 'Snacks y Golosinas' },
  { code: '07', name: '🎁 PACKS Y PROMOS', key: 'Packs y Promociones' },
  { code: '08', name: 'ADICIONAL', key: 'ADICIONAL' }
];

export const SalesView: React.FC<SalesViewProps> = ({
  onOpenScanner,
  onOpenConsultant,
  scannedBarcode,
  refreshTrigger,
  onCartCountChange
}) => {
  const { selectedCompanyId, selectedCompany } = useCompany();
  const weighableTabs = useMemo(() => getWeighableCategoriesForRubro(selectedCompany?.rubroKey), [selectedCompany?.rubroKey]);
  const { isReadOnly, currentUser } = useAuth();

  const [activeSubTab, setActiveSubTab] = useState<'pos' | 'history'>('pos');
  const [showCategorySidebar, setShowCategorySidebar] = useState<boolean>(true);

  // Reloj chileno en vivo
  const [currentClock, setCurrentClock] = useState<string>('');
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
      const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      const dayName = days[now.getDay()];
      const day = now.getDate();
      const month = months[now.getMonth()];
      const year = now.getFullYear();
      let hours = now.getHours();
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      setCurrentClock(`${dayName} ${day} ${month} ${year} ${hours}:${minutes} ${ampm}`);
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // Datos de base de datos
  const [products, setProducts] = useState<Product[]>([]);
  const [salesHistory, setSalesHistory] = useState<Sale[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('GENERAL');

  // Filtros y busqueda
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [categoryFilterText, setCategoryFilterText] = useState<string>('');
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [catalogPage, setCatalogPage] = useState<number>(0);

  // Modales
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [checkoutInitialDteType, setCheckoutInitialDteType] = useState<DTEType>('BOLETA_ELECTRONICA');
  const cartEndRef = useRef<HTMLDivElement>(null);
  const [isCashClosingOpen, setIsCashClosingOpen] = useState(false);
  const [isThermalPrinterModalOpen, setIsThermalPrinterModalOpen] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedSaleForDetails, setSelectedSaleForDetails] = useState<Sale | null>(null);
  const [isWeighableModalOpen, setIsWeighableModalOpen] = useState(false);
  const [selectedWeighableProduct, setSelectedWeighableProduct] = useState<Product | null>(null);
  const [activeWeighableDepartment, setActiveWeighableDepartment] = useState<string | null>(null);

  // Auto-scroll hacia abajo al agregar nuevo producto al carrito
  useEffect(() => {
    if (cartEndRef.current && cart.length > 0) {
      cartEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [cart.length]);
  const [isTurnModalOpen, setIsTurnModalOpen] = useState(false);

  // Modal para Agregar Producto Comun
  const [isCommonProductModalOpen, setIsCommonProductModalOpen] = useState(false);
  const [commonProductName, setCommonProductName] = useState('Producto Común');
  const [commonProductPrice, setCommonProductPrice] = useState<number>(1000);
  const [commonProductQty, setCommonProductQty] = useState<number>(1);

  // Modal para seleccion de precio oferta vs normal
  const [priceChoiceProduct, setPriceChoiceProduct] = useState<Product | null>(null);
  const [priceChoiceQty, setPriceChoiceQty] = useState<number>(1);

  // PDF Viewer
  const [pdfDoc, setPdfDoc] = useState<jsPDF | null>(null);
  const [pdfFilename, setPdfFilename] = useState('');
  const [pdfTitle, setPdfTitle] = useState('');
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);

  // Historial de Ventas
  const [historySearch, setHistorySearch] = useState('');

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Carga de datos reactiva
  const loadProducts = async () => {
    const allProds = await db.products.toArray();
    const filtered = allProds.filter(p => {
      if (selectedCompanyId === 'ALL') return true;
      return !p.companyId || p.companyId === selectedCompanyId;
    });
    setProducts(filtered);
  };

  const loadSalesHistory = async () => {
    const allSales = await db.sales.orderBy('date').reverse().toArray();
    const filtered = allSales.filter(s => {
      return selectedCompanyId === 'ALL' || s.companyId === selectedCompanyId;
    });
    setSalesHistory(filtered);
  };

  const loadCustomers = async () => {
    const allCust = await db.customers.toArray();
    setCustomers(allCust);
  };

  useEffect(() => {
    loadProducts();
    loadSalesHistory();
    loadCustomers();
    const handleUpdate = () => {
      loadProducts();
      loadSalesHistory();
      loadCustomers();
    };
    window.addEventListener('marketalmacen-data-updated', handleUpdate);
    return () => window.removeEventListener('marketalmacen-data-updated', handleUpdate);
  }, [selectedCompanyId, refreshTrigger]);

  // Manejo de pistola lectora de codigo de barras
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
    } catch {}
  };

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
      alert(`Producto con código "${code}" no encontrado en el catálogo de esta empresa.`);
    }
  };

  useEffect(() => {
    let buffer = '';
    let lastKeyTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isCheckoutOpen || isCashClosingOpen || isDetailsOpen || isWeighableModalOpen || isCommonProductModalOpen || isTurnModalOpen) {
        return;
      }

      const target = e.target as HTMLElement;
      if (target && target.tagName === 'INPUT' && target.id !== 'pos-barcode-search-input') {
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
  }, [products, isCheckoutOpen, isCashClosingOpen, isDetailsOpen, isWeighableModalOpen, isCommonProductModalOpen, isTurnModalOpen]);

  useEffect(() => {
    if (scannedBarcode && scannedBarcode.trim()) {
      const match = products.find(p => p.code.toLowerCase() === scannedBarcode.toLowerCase().trim());
      if (match) {
        handleAddToCart(match);
      }
    }
  }, [scannedBarcode]);

  useEffect(() => {
    onCartCountChange?.(cart.reduce((a, b) => a + b.quantity, 0));
  }, [cart, onCartCountChange]);

  // Lista dinamica de categorias para la barra lateral
  const categoriesList = useMemo(() => {
    const dbCats = Array.from(new Set(products.map(p => p.category).filter(Boolean)));
    const list = [...STANDARD_CATEGORIES];

    // Lista de palabras de los botones de abajo para EXCLUIR de la orilla
    const weighableKeywords = weighableTabs.flatMap(w => [w.name.toLowerCase(), w.key.toLowerCase(), ...w.keywords]);

    dbCats.forEach((cat) => {
      const lower = cat.toLowerCase();
      // NO listar en la orilla si es un artículo pesable / granel de abajo
      const isWeighable = weighableKeywords.some(k => lower === k || lower.includes(k) || k.includes(lower));
      if (isWeighable) return;

      if (lower.includes('cerveza') || lower.includes('vino') || lower.includes('bebida') || lower.includes('licor')) {
        return;
      }
      if (lower.includes('congelad') || lower === 'carnes y congelados') {
        return;
      }
      if (!list.some(c => c.name.toLowerCase() === lower || c.key.toLowerCase() === lower)) {
        list.push({
          code: String(list.length).padStart(2, '0'),
          name: cat.toUpperCase(),
          key: cat
        });
      }
    });

    if (!categoryFilterText.trim()) return list;
    const q = categoryFilterText.toLowerCase().trim();
    return list.filter(c => c.name.toLowerCase().includes(q) || c.code.includes(q));
  }, [products, categoryFilterText, weighableTabs]);

  // Filtro de productos para la cuadricula central
  const filteredProducts = useMemo(() => {
    let result = products;

    if (selectedCategory && selectedCategory !== 'ALL' && selectedCategory !== 'COMMON') {
      const activeWeighable = weighableTabs.find(
        w => w.key.toLowerCase() === selectedCategory.toLowerCase() || 
             w.id.toLowerCase() === selectedCategory.toLowerCase() || 
             w.name.toLowerCase() === selectedCategory.toLowerCase()
      );

            if (activeWeighable) {
        result = result.filter(p => {
          // EXCLUSIÓN ESTRICTA DE PRODUCTOS CERRADOS / ENVASADOS (Leches, quesos en sobre, paquetes)
          // Solo se admiten productos señalizados explícitamente para venta a granel / por peso
          const isClosedUnit = ['unidades', 'litros', 'pack', 'caja', 'bolsa', 'botella', 'lata'].includes((p.unit || '').toLowerCase());
          if (p.isBulk === false) return false;
          if (isClosedUnit && p.isBulk !== true) return false;

          const isBulkProduct = p.isBulk === true || p.isWeighable === true ||
            ((p.unit === 'Kg' || p.unit === 'Gramos') && !isClosedUnit);
          if (!isBulkProduct) return false;

          const pCat = (p.category || '').toLowerCase();
          const pName = (p.name || '').toLowerCase();

          // 1. Pestaña Panadería: SOLO panes a granel
          if (activeWeighable.id.includes('pan')) {
            const isOther = ['jamon', 'jamón', 'cecina', 'queso', 'tomate', 'palta', 'verdura', 'nuez', 'almendra', 'mani'].some(k => pName.includes(k) || pCat.includes(k));
            if (isOther) return false;
            return pCat === 'panadería' || pCat === 'panaderia' || pCat.includes('panad') ||
                   pName.includes('pan ') || pName.includes('hallulla') || pName.includes('marraqueta') || pName.includes('coliza') || pName.includes('dobladita') || pName.includes('baguette') || pName.includes('molde') || pName.includes('amasado') || pName.includes('pan');
          }

          // 2. Pestaña Fiambrería: SOLO Cecinas y Quesos AL CORTE / A GRANEL (NUNCA leches, yogur ni sobres cerrados)
          if (activeWeighable.id.includes('fiambr') || activeWeighable.id.includes('cecina') || activeWeighable.id.includes('queso')) {
            const isClosedDairy = ['leche', 'yogur', 'yogurt', 'sobre', 'crema de leche', 'mantequilla', 'postre'].some(k => pName.includes(k));
            if (isClosedDairy && p.isBulk !== true) return false;

            const isBreadOrVeg = ['pan ', 'hallulla', 'marraqueta', 'tomate', 'palta', 'nuez', 'almendra'].some(k => pName.includes(k) || pCat.includes(k));
            if (isBreadOrVeg) return false;
            return pCat === 'fiambrería' || pCat === 'fiambreria' || pCat.includes('fiambr') || pCat.includes('cecina') ||
                   pName.includes('jamón') || pName.includes('jamon') || pName.includes('queso') || pName.includes('cecina') || pName.includes('salame') || pName.includes('mortadela');
          }

          // 3. Pestaña Verdulería: SOLO Frutas y Verduras A GRANEL
          if (activeWeighable.id.includes('verdur') || activeWeighable.id.includes('fruta')) {
            const isBreadOrMeat = ['pan ', 'hallulla', 'marraqueta', 'jamon', 'queso', 'cecina', 'nuez'].some(k => pName.includes(k) || pCat.includes(k));
            if (isBreadOrMeat) return false;
            return pCat === 'verdulería' || pCat === 'verduleria' || pCat.includes('verdur') || pCat.includes('fruta') ||
                   pName.includes('tomate') || pName.includes('palta') || pName.includes('papa') || pName.includes('cebolla') || pName.includes('limon') || pName.includes('limón') || pName.includes('platano');
          }

          // 4. Pestaña Frutos Secos: SOLO Frutos Secos y Semillas A GRANEL
          if (activeWeighable.id.includes('fruto')) {
            const isBreadOrMeat = ['pan ', 'hallulla', 'marraqueta', 'jamon', 'queso', 'cecina', 'tomate'].some(k => pName.includes(k) || pCat.includes(k));
            if (isBreadOrMeat) return false;
            return pCat === 'frutos secos' || pCat.includes('fruto') ||
                   pName.includes('nuez') || pName.includes('nueces') || pName.includes('almendra') || pName.includes('mani') || pName.includes('maní') || pName.includes('frutos secos') || pName.includes('pasas');
          }

          // 5. Pestaña Carne a Granel: SOLO Carnes al corte / pesables (NO congelados envasados con código)
          if (activeWeighable.id.includes('carne') || activeWeighable.id.includes('carnic')) {
            const isBreadOrDairy = ['pan ', 'hallulla', 'marraqueta', 'tomate', 'palta', 'nuez', 'leche', 'yogur'].some(k => pName.includes(k) || pCat.includes(k));
            if (isBreadOrDairy) return false;
            return pCat.includes('carne') || pCat.includes('carnic') ||
                   ['carne', 'vacuno', 'pollo', 'cerdo', 'posta', 'lomo', 'trutro', 'pechuga', 'costillar', 'asado', 'molida', 'churrasco', 'pulpa', 'sobrecostilla', 'abastero'].some(k => pName.includes(k) || pCat.includes(k));
          }

          return activeWeighable.keywords.some(k => pCat.includes(k) || pName.includes(k));
        });
      } else {
        // Categoría de la orilla (No pesables: Abarrotes, Bebidas, etc.)
        result = result.filter(p => {
          const cat = (p.category || '').toLowerCase();
          const key = selectedCategory.toLowerCase();
          if (key === 'congelados' || key === 'congelado' || key.includes('congelad')) {
            // En Congelados: alimentos congelados y carnes selladas/pesadas previamente con etiqueta (isBulk !== true)
            return (cat.includes('congelad') || cat.includes('carne')) && p.isBulk !== true;
          }
          if (key.includes('pack') || key.includes('promo')) {
            return cat.includes('pack') || cat.includes('promo') || (p.unit && p.unit.toLowerCase() === 'pack') || (p.condition === 'OFERTA' && (p.offerLabel || '').toLowerCase().includes('pack'));
          }
          if (key.includes('bebida') || key.includes('licor')) {
            return cat.includes('bebida') || cat.includes('licor') || cat.includes('cerveza') || cat.includes('vino') || cat.includes('alcohol');
          }
          return cat.includes(key) || key.includes(cat);
        });
      }
    }

    const q = searchQuery.toLowerCase().trim();
    if (q) {
      result = result.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        (p.brand && p.brand.toLowerCase().includes(q)) ||
        (p.category && p.category.toLowerCase().includes(q))
      );
    }

    return result;
  }, [products, selectedCategory, searchQuery, weighableTabs]);

  const PAGE_SIZE = 20;
  const totalPages = Math.ceil(filteredProducts.length / PAGE_SIZE) || 1;
  const displayedCatalogProducts = useMemo(() => {
    const start = catalogPage * PAGE_SIZE;
    return filteredProducts.slice(start, start + PAGE_SIZE);
  }, [filteredProducts, catalogPage]);

  // Agregar al carrito
  const handleAddToCart = (product: Product, forceChoice?: 'NORMAL' | 'OFFER', requestedQty: number = 1) => {
    if (isReadOnly) return;

    const isClosedUnit = ['unidades', 'litros', 'pack', 'caja', 'bolsa', 'botella', 'lata'].includes((product.unit || '').toLowerCase());
    const isWeighable = (product.isBulk === true || product.isWeighable === true) ||
      (product.isBulk !== false && (product.unit === 'Kg' || product.unit === 'Gramos') && !isClosedUnit);
    if (isWeighable) {
      setSelectedWeighableProduct(product);
      setIsWeighableModalOpen(true);
      return;
    }

    if (product.stock <= 0) {
      alert('Este producto no tiene stock disponible.');
      return;
    }

    const hasOffer = Boolean(
      product.offerPrice &&
      product.offerPrice > 0 &&
      (product.offerStockRemaining === undefined || product.offerStockRemaining > 0)
    );

    if (hasOffer && !forceChoice) {
      setPriceChoiceProduct(product);
      setPriceChoiceQty(1);
      return;
    }

    const isTakingOffer = forceChoice === 'OFFER';
    const regularPrice = product.price && product.price > 0 ? product.price : 1000;
    const effectivePrice = isTakingOffer ? product.offerPrice! : regularPrice;
    const qtyToAdd = Math.max(1, requestedQty);

    setCart(prev => {
      const existingIndex = prev.findIndex(item => item.productId === product.id && item.isOffer === isTakingOffer);
      if (existingIndex >= 0) {
        const next = [...prev];
        const updatedQty = Number((next[existingIndex].quantity + qtyToAdd).toFixed(3));
        next[existingIndex] = {
          ...next[existingIndex],
          quantity: updatedQty,
          subtotal: Math.round(updatedQty * next[existingIndex].unitPrice)
        };
        return next;
      }

      const newItem: SaleItem = {
        productId: product.id,
        productName: isTakingOffer && product.offerLabel ? `${product.name} (${product.offerLabel})` : product.name,
        productCode: product.code,
        quantity: qtyToAdd,
        unitPrice: effectivePrice,
        subtotal: Math.round(qtyToAdd * effectivePrice),
        unit: product.unit || 'UN',
        isOffer: isTakingOffer
      };
      return [...prev, newItem];
    });
  };

  const handleOpenWeighableDepartment = (tabKey: string) => {
    if (selectedCategory !== 'ALL' && selectedCategory !== 'COMMON') {
      setSelectedCategory('ALL');
    }
    setActiveWeighableDepartment(tabKey);
    setSelectedWeighableProduct(null);
    setIsWeighableModalOpen(true);
  };

  const handleAddToCartDirect = (saleItem: SaleItem) => {
    if (isReadOnly) return;
    setCart(prev => {
      const existingIndex = prev.findIndex(item => item.productCode === saleItem.productCode);
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

  const handleUpdateQuantity = (productId?: number, delta: number = 0, isOffer?: boolean) => {
    setCart(prev =>
      prev.map(item => {
        if (item.productId === productId && item.isOffer === isOffer) {
          const newQty = Number((item.quantity + delta).toFixed(3));
          if (newQty <= 0) return null;
          return {
            ...item,
            quantity: newQty,
            subtotal: Math.round(newQty * item.unitPrice)
          };
        }
        return item;
      }).filter(Boolean) as SaleItem[]
    );
  };

  const handleSetQuantity = (productId?: number, exactQty: number = 1, isOffer?: boolean) => {
    if (exactQty <= 0) {
      handleRemoveFromCart(productId, isOffer);
      return;
    }
    setCart(prev =>
      prev.map(item => {
        if (item.productId === productId && item.isOffer === isOffer) {
          return {
            ...item,
            quantity: exactQty,
            subtotal: Math.round(exactQty * item.unitPrice)
          };
        }
        return item;
      })
    );
  };

  const handleRemoveFromCart = (productId?: number, isOffer?: boolean) => {
    setCart(prev => prev.filter(item => !(item.productId === productId && item.isOffer === isOffer)));
  };

  const handleClearCart = () => {
    setCart([]);
  };

  const cartSubtotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.subtotal, 0);
  }, [cart]);

  const totalCartUnits = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.quantity, 0);
  }, [cart]);

  // Generar Cotizacion en PDF
  const handleGenerateQuotation = async () => {
    if (cart.length === 0) {
      alert('El carrito está vacío. Agrega productos para generar la cotización.');
      return;
    }

    try {
      const selectedCustomer = customers.find(c => String(c.id) === String(selectedCustomerId));
      const dummySale: Sale = {
        folio: `COT-${Date.now().toString().slice(-5)}`,
        date: new Date().toISOString(),
        time: new Date().toLocaleTimeString('es-CL'),
        companyId: selectedCompanyId,
        companyName: selectedCompany?.name || 'MARKET ALMACEN SpA',
        sellerName: currentUser?.name || 'Vendedor',
        customerName: selectedCustomer ? (selectedCustomer.businessName || selectedCustomer.tradeName) : 'Cliente Final',
        customerRut: selectedCustomer ? selectedCustomer.rut : undefined,
        customerBusiness: selectedCustomer ? selectedCustomer.industry : undefined,
        customerAddress: selectedCustomer ? selectedCustomer.address : undefined,
        items: cart,
        subtotalNeto: Math.round(cartSubtotal / 1.19),
        iva: Math.round(cartSubtotal - (cartSubtotal / 1.19)),
        total: cartSubtotal,
        amountPaid: cartSubtotal,
        cashChange: 0,
        paymentMethod: 'EFECTIVO',
        dteType: 'TICKET_INTERNO',
        siiStatus: 'EMITIDO',
        status: 'COMPLETADA',
        createdAt: new Date().toISOString()
      };

      const doc = generateSaleInvoicePDF(dummySale, selectedCompany);
      setPdfDoc(doc);
      setPdfFilename(`Cotizacion_${Date.now()}.pdf`);
      setPdfTitle('Cotización de Venta - Market Almacén');
      setIsPdfModalOpen(true);
    } catch (err: any) {
      alert('Error al generar cotización: ' + err.message);
    }
  };

  // Abrir Ultima Venta
  const handleOpenLastSale = () => {
    if (salesHistory.length === 0) {
      alert('No hay ventas registradas aún en el historial.');
      return;
    }
    setSelectedSaleForDetails(salesHistory[0]);
    setIsDetailsOpen(true);
  };

  // Resumen del turno actual
  const todaySalesSummary = useMemo(() => {
    const todayStr = getChileLocalDateString();
    const todaySales = salesHistory.filter(s => s.status !== 'ANULADA' && (s.date || '').startsWith(todayStr));
    const totalRevenue = todaySales.reduce((sum, s) => sum + (s.total || 0), 0);
    const cashRevenue = todaySales.filter(s => s.paymentMethod === 'EFECTIVO').reduce((sum, s) => sum + (s.total || 0), 0);
    const cardRevenue = todaySales.filter(s => s.paymentMethod === 'DEBITO' || s.paymentMethod === 'CREDITO').reduce((sum, s) => sum + (s.total || 0), 0);
    const transferRevenue = todaySales.filter(s => s.paymentMethod === 'TRANSFERENCIA').reduce((sum, s) => sum + (s.total || 0), 0);
    return {
      count: todaySales.length,
      totalRevenue,
      cashRevenue,
      cardRevenue,
      transferRevenue
    };
  }, [salesHistory]);

  return (
    <div className="h-full flex-1 flex flex-col bg-slate-100 dark:bg-[#0b1118] text-slate-800 dark:text-slate-100 overflow-hidden select-none">
      
      {/* ========================================================================= */}
      {/* 1. BARRA SUPERIOR (HEADER POS TEMA CLARO MARKET ALMACÉN)                   */}
      {/* ========================================================================= */}
      <header className="h-12 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 flex items-center justify-between px-3 shrink-0 shadow-xs z-20 border-b border-slate-200 dark:border-slate-800">
        {/* Lado Izquierdo: Burger + Reloj en vivo + Home + Busqueda */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setActiveSubTab(prev => prev === 'pos' ? 'history' : 'pos')}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition active:scale-95 cursor-pointer"
            title="Cambiar entre Terminal POS e Historial"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Reloj chileno en vivo */}
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 pl-1 border-l border-slate-200 dark:border-slate-700">
            <span>{currentClock || 'Market Almacén POS'}</span>
          </div>


        </div>

        {/* Centro: Accesos directos de Caja y Turno */}
        <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs font-bold uppercase tracking-wider">
          <button
            type="button"
            onClick={() => setIsTurnModalOpen(true)}
            className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition cursor-pointer shadow-2xs"
          >
            VENTA DE TURNO
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('history')}
            className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition cursor-pointer shadow-2xs"
          >
            VENTA TOTAL
          </button>
          <button
            type="button"
            onClick={() => setIsCashClosingOpen(true)}
            className="px-2.5 py-1 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 font-bold transition cursor-pointer shadow-2xs flex items-center gap-1"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>CIERRE DE CAJA</span>
          </button>
          <button
            type="button"
            onClick={() => setIsThermalPrinterModalOpen(true)}
            className="px-2.5 py-1 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/60 font-bold transition cursor-pointer shadow-2xs flex items-center gap-1.5"
            title="Configuración de Impresora Térmica de Boletas (80mm)"
          >
            <Printer className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>IMPRESORA 80MM</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          </button>
        </div>

        {/* Lado Derecho: Usuario Activo + Boton Verde Categorias */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden md:flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-lg">
            <User className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
            <span className="truncate max-w-[130px]">{currentUser?.name || 'Administrador Inicial'}</span>
          </div>

          <button
            type="button"
            onClick={() => setShowCategorySidebar(prev => !prev)}
            className={`px-3 py-1 rounded-md text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer ${
              showCategorySidebar
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
            }`}
            title="Mostrar / Ocultar panel de Categorías"
          >
            <Folder className="w-3.5 h-3.5" />
            <span>Categorías</span>
          </button>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 2. AREA PRINCIPAL: TERMINAL POS (3 COLUMNAS ESTILO MONITOR LG)            */}
      {/* ========================================================================= */}
      {activeSubTab === 'pos' && (
        <div className="flex-1 flex flex-col lg:flex-row h-[calc(100%-3rem)] overflow-hidden">
          
          {/* --------------------------------------------------------------------- */}
          {/* COLUMNA 1: PANEL IZQUIERDO DE VENTA Y COBRO (~33% ANCHO)             */}
          {/* --------------------------------------------------------------------- */}
          <section className="w-full lg:w-[35%] xl:w-[32%] shrink-0 flex flex-col h-full bg-white dark:bg-[#0d1620] border-r border-slate-200 dark:border-slate-800 shadow-md p-2.5 sm:p-3 overflow-hidden">
            
            {/* Botones Superiores: ÚLTIMA VENTA | FACTURA */}
            <div className="grid grid-cols-2 gap-2 mb-2 shrink-0">
              <button
                type="button"
                onClick={handleOpenLastSale}
                className="bg-slate-700 hover:bg-slate-800 active:scale-98 text-white font-bold text-xs py-2 px-2 rounded-lg text-center shadow-xs uppercase tracking-wider transition cursor-pointer"
                title="Ver o reimprimir el comprobante de la última venta"
              >
                ÚLTIMA VENTA
              </button>

              <button
                type="button"
                onClick={() => {
                  if (cart.length === 0) {
                    alert('El carrito está vacío. Agrega productos antes de facturar.');
                    return;
                  }
                  setCheckoutInitialDteType('FACTURA_ELECTRONICA');
                  setIsCheckoutOpen(true);
                }}
                disabled={cart.length === 0 || isReadOnly}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed active:scale-98 text-white font-black text-xs py-2 px-2 rounded-lg text-center shadow-xs uppercase tracking-wider transition cursor-pointer"
                title="Abrir cobro directo con Factura Electrónica (RUT y Razón Social)"
              >
                FACTURA
              </button>
            </div>

            {/* Buscador de Producto y Codigo de Barras */}
            <div className="relative mb-2 shrink-0">
              <input
                ref={barcodeInputRef}
                id="pos-barcode-search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchQuery.trim()) {
                    handleBarcodeScanned(searchQuery);
                  }
                }}
                placeholder="Codigo de barras, Nombre de producto..."
                className="w-full bg-slate-50 dark:bg-[#162330] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 text-xs rounded-lg pl-8 pr-8 py-2 focus:outline-hidden focus:ring-2 focus:ring-sky-500 shadow-2xs font-medium"
              />
              <Barcode className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* TABLA DE PRODUCTOS EN LA COMPRA */}
            <div className="flex-1 flex flex-col min-h-0 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden bg-slate-50/50 dark:bg-[#101a24]">
              {/* Encabezados de Columna */}
              <div className="bg-slate-200/80 dark:bg-[#162330] text-slate-700 dark:text-slate-300 text-[10.5px] font-black uppercase px-2 py-1.5 flex items-center justify-between border-b border-slate-300 dark:border-slate-700 select-none">
                <span className="w-[42%] text-left">PRODUCTO</span>
                <span className="w-[18%] text-right">PRECIO</span>
                <span className="w-[20%] text-center">CANTIDAD</span>
                <span className="w-[15%] text-right">SUBTOTAL</span>
                <span className="w-[5%] text-center">✕</span>
              </div>

              {/* Listado de items con scroll */}
              <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-slate-200 dark:divide-slate-800/80 p-1">
                {cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 p-4 text-center">
                    <ShoppingCart className="w-10 h-10 stroke-[1.5] mb-2 opacity-40 text-sky-500" />
                    <p className="text-xs font-bold">Carrito de venta vacío</p>
                    <p className="text-[11px] opacity-75 mt-0.5">Escanea o haz clic en un producto para cargarlo</p>
                  </div>
                ) : (
                  cart.map((item, idx) => (
                    <div
                      key={`${item.productId || 0}-${item.productCode}-${idx}`}
                      className="py-1.5 px-1 flex items-center justify-between gap-1 text-xs hover:bg-white dark:hover:bg-slate-800/40 transition"
                    >
                      {/* Producto con capsula azul marina */}
                      <div className="w-[42%] min-w-0 pr-1">
                        <span
                          className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-[11px] font-bold px-2 py-1 rounded inline-block truncate max-w-full shadow-2xs leading-tight"
                          title={`${item.productName} (${item.productCode})`}
                        >
                          {item.productName} {item.productCode ? `(${item.productCode})` : ''}
                        </span>
                      </div>

                      {/* Precio */}
                      <div className="w-[18%] text-right font-mono font-bold text-slate-700 dark:text-slate-300 text-[11px]">
                        ${item.unitPrice.toLocaleString('es-CL')}
                      </div>

                      {/* Control de Cantidad [-] [ qty ] [+] */}
                      <div className="w-[20%] flex items-center justify-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleUpdateQuantity(item.productId, -1, item.isOffer)}
                          className="w-5 h-5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 rounded flex items-center justify-center active:scale-95 cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <CartQuantityInput
                          quantity={item.quantity}
                          unit={item.unit}
                          onCommit={(newQty) => handleSetQuantity(item.productId, newQty, item.isOffer)}
                        />
                        <button
                          type="button"
                          onClick={() => handleUpdateQuantity(item.productId, 1, item.isOffer)}
                          className="w-5 h-5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 rounded flex items-center justify-center active:scale-95 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Subtotal */}
                      <div className="w-[15%] text-right font-mono font-black text-slate-900 dark:text-emerald-400 text-xs">
                        ${item.subtotal.toLocaleString('es-CL')}
                      </div>

                      {/* Boton Eliminar */}
                      <div className="w-[5%] text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveFromCart(item.productId, item.isOffer)}
                          className="text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition p-0.5 cursor-pointer"
                          title="Quitar producto"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
                <div ref={cartEndRef} />
              </div>
            </div>

            {/* SECCION INFERIOR: RESUMEN Y TOTAL DESTACADO */}
            <div className="pt-2 mt-2 border-t border-slate-200 dark:border-slate-800 space-y-2 shrink-0">
              {/* Linea de Items y Descuento */}
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400 px-1">
                <span>Item {cart.length} ({totalCartUnits})</span>
                <span>Descuento ($0) $0</span>
              </div>

              {/* Recuadro Verde Claro Destacado con TOTAL: $8.450 */}
              <div className="bg-[#dcfce7] border-2 border-emerald-400/80 rounded-lg px-3 py-2 flex items-center justify-between shadow-xs">
                <span className="text-base sm:text-lg font-black text-emerald-950 tracking-wider">
                  TOTAL:
                </span>
                <span className="text-2xl sm:text-3xl font-black font-mono text-emerald-950 tracking-tight">
                  ${cartSubtotal.toLocaleString('es-CL')}
                </span>
              </div>

              {/* BARRA DE 3 BOTONES: CANCELAR | COTIZACION | $PAGAR */}
              <div className="grid grid-cols-3 gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    if (cart.length > 0 && window.confirm('¿Deseas cancelar la venta actual y vaciar el carrito?')) {
                      handleClearCart();
                    }
                  }}
                  disabled={cart.length === 0}
                  className="bg-[#ef4444] hover:bg-[#dc2626] disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-xs sm:text-sm py-3 rounded-lg text-center uppercase tracking-wider shadow-xs transition active:scale-98 cursor-pointer"
                >
                  CANCELAR
                </button>

                <button
                  type="button"
                  onClick={handleGenerateQuotation}
                  disabled={cart.length === 0}
                  className="bg-slate-600 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-xs sm:text-sm py-3 rounded-lg text-center uppercase tracking-wider shadow-xs transition active:scale-98 cursor-pointer"
                >
                  COTIZACIÓN
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (cart.length === 0) {
                      alert('El carrito está vacío. Agrega productos antes de pagar.');
                      return;
                    }
                    setCheckoutInitialDteType('BOLETA_ELECTRONICA');
                    setIsCheckoutOpen(true);
                  }}
                  disabled={cart.length === 0 || isReadOnly}
                  className="bg-[#10b981] hover:bg-[#059669] disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-xs sm:text-sm py-3 rounded-lg text-center uppercase tracking-wider shadow-md transition active:scale-98 cursor-pointer flex items-center justify-center gap-1"
                >
                  $PAGAR
                </button>
              </div>
            </div>
          </section>

          {/* --------------------------------------------------------------------- */}
          {/* COLUMNA 2: CATALOGO CENTRAL EN CUADRICULA (~50% ANCHO)               */}
          {/* --------------------------------------------------------------------- */}
          <section className="flex-1 flex flex-col h-full bg-slate-100 dark:bg-[#0f1722] overflow-hidden p-2.5">
            {/* Barra de estado / Paginacion superior */}
            <div className="flex items-center justify-between pb-2 text-xs font-bold text-slate-600 dark:text-slate-400 shrink-0">
              <div className="flex items-center gap-2">
                <span>Mostrando {displayedCatalogProducts.length} de {filteredProducts.length} productos</span>
                {selectedCategory !== 'ALL' && (
                  <span className="bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300 px-2 py-0.5 rounded-full text-[10px] font-black">
                    Categoría: {selectedCategory}
                  </span>
                )}
              </div>

              {/* Botones de Paginacion */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setCatalogPage(p => Math.max(0, p - 1))}
                  disabled={catalogPage === 0}
                  className="p-1 rounded bg-white dark:bg-[#162330] border border-slate-300 dark:border-slate-700 disabled:opacity-40 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-[11px] font-mono font-bold">
                  {catalogPage + 1} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setCatalogPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={catalogPage >= totalPages - 1}
                  className="p-1 rounded bg-white dark:bg-[#162330] border border-slate-300 dark:border-slate-700 disabled:opacity-40 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* CUADRICULA DE TARJETAS DE PRODUCTOS */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-1">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2.5 content-start">
                {displayedCatalogProducts.map(product => {
                  const hasUploadedImage = Boolean(
                    product.imageUrl &&
                    product.imageUrl.trim().length > 5 &&
                    !product.imageUrl.includes('unsplash.com')
                  );
                  const isOffer = Boolean(product.offerPrice && product.offerPrice > 0);
                  const priceToDisplay = isOffer ? product.offerPrice! : (product.price || 1000);

                  return (
                    <div
                      key={product.id || product.code}
                      onClick={() => handleAddToCart(product)}
                      className="bg-white dark:bg-[#131f2b] border border-slate-200 dark:border-slate-700/70 rounded-xl p-2.5 shadow-2xs hover:shadow-md hover:border-sky-400 dark:hover:border-sky-500 transition cursor-pointer flex flex-col justify-between items-center text-center group active:scale-97 select-none relative overflow-hidden min-h-[145px]"
                    >
                      {/* Foto solo si el usuario la subió; de lo contrario caja limpia sin foto */}
                      {hasUploadedImage ? (
                        <div className="w-full h-20 sm:h-22 flex items-center justify-center overflow-hidden rounded-lg bg-slate-50 dark:bg-[#0c141d] mb-1.5">
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="max-h-full max-w-full object-contain group-hover:scale-105 transition duration-200"
                            loading="lazy"
                          />
                        </div>
                      ) : (
                        <div className="w-full h-20 sm:h-22 flex flex-col items-center justify-center rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-dashed border-slate-200 dark:border-slate-700 mb-1.5 text-slate-400 dark:text-slate-500 group-hover:border-slate-300 dark:group-hover:border-slate-600 transition">
                          <Package className="w-6 h-6 stroke-[1.5]" />
                          <span className="text-[9px] font-semibold mt-1">Sin foto</span>
                        </div>
                      )}

                      {/* Nombre del producto */}
                      <div className="w-full text-center px-0.5">
                        <h4 className="text-[11.5px] font-bold text-slate-800 dark:text-slate-100 line-clamp-2 leading-tight">
                          {product.name}
                        </h4>
                      </div>

                      {/* Pie de tarjeta: Stock a la izquierda | Precio Morado a la derecha */}
                      <div className="w-full flex items-center justify-between pt-2 mt-auto border-t border-slate-100 dark:border-slate-800/80 text-xs">
                        <div className="flex items-center gap-1 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                          <ShoppingCart className="w-3.5 h-3.5 text-slate-400" />
                          <span>{product.stock}</span>
                        </div>

                        <div className="font-mono font-black text-purple-700 dark:text-purple-400 text-xs sm:text-sm">
                          ${priceToDisplay.toLocaleString('es-CL')}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Barra Inferior de Pestañas Pesables / Granel del Rubro */}
            <div className="pt-2 flex items-center justify-between shrink-0 gap-2">
              <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar py-0.5">
                {/* Botón Todos para regresar a ver el catálogo completo */}
                <button
                  type="button"
                  onClick={() => setSelectedCategory('ALL')}
                  className={`px-3.5 py-1.5 rounded-lg font-bold text-xs transition cursor-pointer shadow-2xs ${
                    selectedCategory === 'ALL'
                      ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 font-black'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                  }`}
                >
                  Todos
                </button>

                {/* Botones de Artículos Pesables / Granel según el Rubro - Abren directamente la ventana modal de productos */}
                {weighableTabs.map(tab => {
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => handleOpenWeighableDepartment(tab.key)}
                      className={`px-3.5 py-1.5 rounded-lg font-bold text-xs transition cursor-pointer shadow-2xs flex items-center gap-1.5 hover:opacity-90 active:scale-95 border border-transparent hover:border-slate-300 dark:hover:border-slate-600 ${tab.badgeColor}`}
                      title={`Abrir balanza y productos de ${tab.name}`}
                    >
                      <span>{tab.icon}</span>
                      <span>{tab.name}</span>
                    </button>
                  );
                })}
              </div>

              <span className="text-[11px] font-bold text-slate-400 hidden sm:inline">
                {products.length} productos registrados
              </span>
            </div>
          </section>

          {/* --------------------------------------------------------------------- */}
          {/* COLUMNA 3: BARRA LATERAL DERECHA DE CATEGORIAS (~17% ANCHO)           */}
          {/* --------------------------------------------------------------------- */}
          {showCategorySidebar && (
            <aside className="w-56 xl:w-64 shrink-0 flex flex-col h-full bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 p-2.5 border-l border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden animate-fadeIn">
              {/* Buscador de Categorias */}
              <div className="mb-2 shrink-0">
                <input
                  type="text"
                  value={categoryFilterText}
                  onChange={(e) => setCategoryFilterText(e.target.value)}
                  placeholder="Escriba para filtrar..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 placeholder-slate-400 text-xs px-2.5 py-1.5 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-medium"
                />
              </div>

              {/* Listado de Categorias con scroll */}
              <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1.5 pr-0.5">
                {categoriesList.map(cat => {
                  const isActive = selectedCategory === cat.key;

                  return (
                    <button
                      key={cat.code + cat.key}
                      type="button"
                      onClick={() => {
                        if (cat.key === 'COMMON') {
                          setIsCommonProductModalOpen(true);
                        } else {
                          setSelectedCategory(cat.key);
                          setCatalogPage(0);
                        }
                      }}
                      className={`w-full p-2 rounded-xl flex items-center gap-2.5 text-left transition cursor-pointer ${
                        isActive
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 border-2 border-emerald-500 text-emerald-900 dark:text-emerald-200 font-bold shadow-xs'
                          : 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/70 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-medium'
                      }`}
                    >
                      {/* Icono carpeta */}
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        isActive
                          ? 'bg-emerald-500 text-white'
                          : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                      }`}>
                        <Folder className="w-3.5 h-3.5" />
                      </div>

                      {/* Codigo y Nombre */}
                      <div className="min-w-0 flex-1">
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono leading-none">{cat.code}</div>
                        <div className="text-[11px] truncate uppercase mt-0.5 leading-tight font-bold">{cat.name}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </aside>
          )}

        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. VISTA DE HISTORIAL DE VENTAS & COMPROBANTES (DTE)                       */}
      {/* ========================================================================= */}
      {activeSubTab === 'history' && (
        <div className="flex-1 p-3 sm:p-4 overflow-y-auto custom-scrollbar space-y-3">
          {/* Boton para regresar a la vista POS */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setActiveSubTab('pos')}
              className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs"
            >
              <ShoppingCart className="w-4 h-4" />
              <span>← Volver al Terminal de Ventas POS</span>
            </button>

            <button
              type="button"
              onClick={() => exportSalesLedgerExcel(salesHistory, selectedCompany?.name || 'Empresa')}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Exportar Excel</span>
            </button>
          </div>

          {/* Tabla de historial */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-[#131f2b] shadow-sm overflow-hidden">
            <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-black flex items-center gap-2">
                <Receipt className="w-4 h-4 text-sky-500" />
                <span>Historial de Ventas ({salesHistory.length})</span>
              </h3>
              <input
                type="text"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Buscar por cliente, folio, RUT..."
                className="text-xs bg-slate-50 dark:bg-[#1c2c3b] border border-slate-300 dark:border-slate-700 px-3 py-1.5 rounded-lg w-64"
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-[#1a2735] text-slate-500 font-bold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-3">FOLIO</th>
                    <th className="p-3">FECHA</th>
                    <th className="p-3">CLIENTE</th>
                    <th className="p-3">MEDIO PAGO</th>
                    <th className="p-3 text-right">TOTAL</th>
                    <th className="p-3 text-center">ACCIONES</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {salesHistory
                    .filter(s => {
                      if (!historySearch.trim()) return true;
                      const q = historySearch.toLowerCase();
                      return String(s.folio).includes(q) || (s.customerName || '').toLowerCase().includes(q);
                    })
                    .slice(0, 50)
                    .map(sale => (
                      <tr key={sale.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="p-3 font-mono font-bold">#{sale.folio}</td>
                        <td className="p-3 text-slate-500">{new Date(sale.date).toLocaleString('es-CL')}</td>
                        <td className="p-3 font-bold">{sale.customerName || 'Público General'}</td>
                        <td className="p-3">{sale.paymentMethod}</td>
                        <td className="p-3 text-right font-mono font-black text-emerald-600 dark:text-emerald-400">
                          ${sale.total.toLocaleString('es-CL')}
                        </td>
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSaleForDetails(sale);
                              setIsDetailsOpen(true);
                            }}
                            className="px-2 py-1 rounded bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 font-bold hover:underline cursor-pointer"
                          >
                            Ver Detalle
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. MODALES INTEGRADOS                                                     */}
      {/* ========================================================================= */}

      {/* Modal de Cobro Completo (Boleta, Factura, Efectivo, Tarjeta, Vuelto) */}
      {isCheckoutOpen && (
        <SaleCheckoutModal
          isOpen={isCheckoutOpen}
          onClose={() => setIsCheckoutOpen(false)}
          cartItems={cart}
          initialDteType={checkoutInitialDteType}
          selectedCustomer={customers.find(c => String(c.id) === String(selectedCustomerId))}
          onSaleCompleted={() => {
            setIsCheckoutOpen(false);
            setCart([]);
            loadSalesHistory();
            loadProducts();
          }}
        />
      )}

      {/* Modal Agregar Producto Comun Rapido */}
      {isCommonProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-[#131f2b] rounded-2xl border-2 border-sky-400 shadow-2xl max-w-sm w-full p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
              <h3 className="font-black text-sm text-sky-600 dark:text-sky-400 flex items-center gap-1.5">
                <Plus className="w-4 h-4" />
                <span>Agregar Producto Común</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsCommonProductModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Nombre o Descripción</label>
                <input
                  type="text"
                  value={commonProductName}
                  onChange={(e) => setCommonProductName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-[#1a2938] border border-slate-300 dark:border-slate-700 rounded-lg p-2 font-medium"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Precio Unitario ($)</label>
                <input
                  type="number"
                  min="1"
                  value={commonProductPrice}
                  onChange={(e) => setCommonProductPrice(Math.max(1, parseInt(e.target.value) || 0))}
                  className="w-full bg-slate-50 dark:bg-[#1a2938] border border-slate-300 dark:border-slate-700 rounded-lg p-2 font-mono font-bold text-sm"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Cantidad</label>
                <input
                  type="number"
                  min="1"
                  value={commonProductQty}
                  onChange={(e) => setCommonProductQty(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full bg-slate-50 dark:bg-[#1a2938] border border-slate-300 dark:border-slate-700 rounded-lg p-2 font-mono font-bold text-sm"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsCommonProductModalOpen(false)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-bold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  const commonItem: SaleItem = {
                    productId: 0,
                    productName: commonProductName.trim() || 'Producto Común',
                    productCode: 'COMUN-' + Date.now().toString().slice(-4),
                    quantity: commonProductQty > 0 ? commonProductQty : 1,
                    unitPrice: commonProductPrice > 0 ? commonProductPrice : 1000,
                    subtotal: Math.round((commonProductPrice > 0 ? commonProductPrice : 1000) * (commonProductQty > 0 ? commonProductQty : 1)),
                    unit: 'UN'
                  };
                  handleAddToCartDirect(commonItem);
                  setIsCommonProductModalOpen(false);
                }}
                className="px-4 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-black shadow-xs"
              >
                Agregar a Venta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Resumen Venta de Turno */}
      {isTurnModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-[#131f2b] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-sm w-full p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
              <h3 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                <Receipt className="w-4 h-4 text-emerald-500" />
                <span>Resumen de Venta de Turno</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsTurnModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between p-2 rounded-lg bg-slate-50 dark:bg-[#1a2938]">
                <span className="text-slate-500">Cajero / Vendedor:</span>
                <span className="font-bold">{currentUser?.name || 'admin Molina'}</span>
              </div>
              <div className="flex justify-between p-2 rounded-lg bg-slate-50 dark:bg-[#1a2938]">
                <span className="text-slate-500">Ventas Registradas Hoy:</span>
                <span className="font-black font-mono">{todaySalesSummary.count}</span>
              </div>
              <div className="flex justify-between p-2 rounded-lg bg-slate-50 dark:bg-[#1a2938]">
                <span className="text-slate-500">Efectivo en Caja:</span>
                <span className="font-black font-mono text-emerald-600 dark:text-emerald-400">
                  ${todaySalesSummary.cashRevenue.toLocaleString('es-CL')}
                </span>
              </div>
              <div className="flex justify-between p-2 rounded-lg bg-slate-50 dark:bg-[#1a2938]">
                <span className="text-slate-500">Tarjetas (Débito/Crédito):</span>
                <span className="font-black font-mono text-sky-600 dark:text-sky-400">
                  ${todaySalesSummary.cardRevenue.toLocaleString('es-CL')}
                </span>
              </div>
              <div className="flex justify-between p-2 rounded-lg bg-slate-50 dark:bg-[#1a2938]">
                <span className="text-slate-500">Transferencias:</span>
                <span className="font-black font-mono">
                  ${todaySalesSummary.transferRevenue.toLocaleString('es-CL')}
                </span>
              </div>
              <div className="flex justify-between p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800">
                <span className="font-black text-emerald-900 dark:text-emerald-200">TOTAL RECAUDADO TURNO:</span>
                <span className="font-black font-mono text-base text-emerald-700 dark:text-emerald-300">
                  ${todaySalesSummary.totalRevenue.toLocaleString('es-CL')}
                </span>
              </div>
            </div>

            <div className="pt-2 text-right">
              <button
                type="button"
                onClick={() => setIsTurnModalOpen(false)}
                className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold"
              >
                Cerrar
              </button>
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

      {/* Modal de Pesaje */}
      {isWeighableModalOpen && (
        <WeighableProductModal
          isOpen={isWeighableModalOpen}
          onClose={() => {
            setIsWeighableModalOpen(false);
            setSelectedWeighableProduct(null);
            setActiveWeighableDepartment(null);
          }}
          selectedProduct={selectedWeighableProduct}
          activeDepartmentKey={activeWeighableDepartment || selectedCategory}
          onAddToCart={(cartItem) => {
            handleAddToCartDirect(cartItem);
            setIsWeighableModalOpen(false);
            setSelectedWeighableProduct(null);
            setActiveWeighableDepartment(null);
          }}
        />
      )}

      {/* Modal de Cierre de Caja (Z) */}
      {isCashClosingOpen && (
        <CashClosingModal
          isOpen={isCashClosingOpen}
          onClose={() => setIsCashClosingOpen(false)}
        />
      )}

      {/* Modal de Clientes */}
      {isCustomerModalOpen && (
        <CustomerManagerModal
          isOpen={isCustomerModalOpen}
          onClose={() => {
            setIsCustomerModalOpen(false);
            loadCustomers();
          }}
        />
      )}

      {/* Modal de Visor de PDF */}
      {isPdfModalOpen && pdfDoc && (
        <PDFViewerModal
          isOpen={isPdfModalOpen}
          onClose={() => setIsPdfModalOpen(false)}
          doc={pdfDoc}
          filename={pdfFilename}
          title={pdfTitle}
        />
      )}

      {/* Modal de Seleccion de Precio Oferta vs Normal */}
      {priceChoiceProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-amber-400 shadow-2xl max-w-md w-full p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
              <h3 className="font-black text-sm text-slate-900 dark:text-white">Seleccionar Precio de Venta</h3>
              <button
                type="button"
                onClick={() => setPriceChoiceProduct(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <h4 className="font-black text-sm">{priceChoiceProduct.name}</h4>
              <p className="text-xs text-slate-500 mt-0.5">Elige el precio a cobrar:</p>
            </div>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  handleAddToCart(priceChoiceProduct, 'OFFER', priceChoiceQty);
                  setPriceChoiceProduct(null);
                }}
                className="w-full p-3 rounded-xl border-2 border-amber-400 bg-amber-50 dark:bg-amber-950/40 text-left flex justify-between items-center"
              >
                <div>
                  <span className="text-[10px] font-black uppercase bg-amber-500 text-white px-1.5 py-0.5 rounded">OFERTA</span>
                  <div className="text-lg font-black font-mono text-amber-700 dark:text-amber-300 mt-1">
                    ${(priceChoiceProduct.offerPrice || 0).toLocaleString('es-CL')}
                  </div>
                </div>
                <span className="text-xs font-bold text-amber-700 dark:text-amber-300">Llevar Oferta →</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  handleAddToCart(priceChoiceProduct, 'NORMAL', priceChoiceQty);
                  setPriceChoiceProduct(null);
                }}
                className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-left flex justify-between items-center"
              >
                <div>
                  <span className="text-[10px] font-black uppercase bg-slate-600 text-white px-1.5 py-0.5 rounded">NORMAL</span>
                  <div className="text-lg font-black font-mono mt-1">
                    ${(priceChoiceProduct.price || 1000).toLocaleString('es-CL')}
                  </div>
                </div>
                <span className="text-xs font-bold">Llevar Normal →</span>
              </button>
            </div>
          </div>
        </div>
      )}

    
      {/* Modal de Configuración de Impresora Térmica 80mm */}
      <ThermalPrinterModal
        isOpen={isThermalPrinterModalOpen}
        onClose={() => setIsThermalPrinterModalOpen(false)}
      />
    </div>
  );
};
