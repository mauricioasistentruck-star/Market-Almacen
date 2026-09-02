import React, { useState, useEffect } from 'react';
import { useTheme } from './utils/themeContext';
import { useCompany } from './utils/companyContext';
import { useAuth } from './utils/authContext';
import { db } from './db/database';
import type { Product, Tool, Sale } from './types';
import { ArrowLeft, BarChart3 } from 'lucide-react';
import { Navbar } from './components/Navbar';
import { LoginView } from './components/auth/LoginView';
import { initCloudSync } from './utils/cloudSync';

// Tab Views
import { SalesView } from './components/sales/SalesView';
import { SalesReportsSubView } from './components/sales/SalesReportsSubView';
import { PDFViewerModal } from './components/PDFViewerModal';
import jsPDF from 'jspdf';
import { ProductListView } from './components/inventory/ProductListView';
import { GuidesListView } from './components/guides/GuidesListView';
import { PurchasesView } from './components/purchases/PurchasesView';
import { MermasView } from './components/mermas/MermasView';

// Modals
import { BarcodeScannerModal } from './components/BarcodeScannerModal';
import { ProductFormModal } from './components/inventory/ProductFormModal';
import { StockMovementModal } from './components/inventory/StockMovementModal';
import { DeliveryGuideModal } from './components/guides/DeliveryGuideModal';
import { ReceptionGuideModal } from './components/guides/ReceptionGuideModal';
import { CompanyManagerModal } from './components/companies/CompanyManagerModal';
import { UserManagerModal } from './components/auth/UserManagerModal';
import { ImportModal } from './components/import/ImportModal';
import { MasterBackupModal } from './components/MasterBackupModal';
import { SupplierManagerModal } from './components/suppliers/SupplierManagerModal';
import { CustomerManagerModal } from './components/customers/CustomerManagerModal';
import { InventoryTakingModal } from './components/inventory/InventoryTakingModal';
import { MobileBottomNav } from './components/common/MobileBottomNav';
import { MobileMoreMenuModal } from './components/common/MobileMoreMenuModal';
import { ProductConsultantModal } from './components/inventory/ProductConsultantModal';
import { CashClosingModal } from './components/sales/CashClosingModal';

export const App: React.FC = () => {
  const { themeClasses } = useTheme();
  const { selectedCompanyId, selectedCompany, companies } = useCompany();
  const { isAuthenticated, isReadOnly, currentUser, permissions } = useAuth();

  // Pestaña inicial por defecto: Ventas y POS
  const [activeTab, setActiveTab] = useState<string>('sales');
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);
  const [isConsultantOpen, setIsConsultantOpen] = useState(false);
  const [isMobileMoreOpen, setIsMobileMoreOpen] = useState(false);
  const [isCashClosingOpen, setIsCashClosingOpen] = useState(false);
  const [cartCount, setCartCount] = useState<number>(0);

  useEffect(() => {
    if (currentUser) {
      if (currentUser.role === 'BODEGA' || (!permissions.pos && permissions.inventory)) {
        setActiveTab('inventory');
      } else if (permissions.pos) {
        setActiveTab('sales');
      }
    }
  }, [currentUser?.username, currentUser?.role]);

  // Scanner state
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannedBarcode, setScannedBarcode] = useState('');
  const [scannerContext, setScannerContext] = useState<string>('general');

  // Sales state for standalone reports view
  const [salesList, setSalesList] = useState<Sale[]>([]);
  const [reportPdfDoc, setReportPdfDoc] = useState<jsPDF | null>(null);
  const [reportPdfFilename, setReportPdfFilename] = useState('');
  const [reportPdfTitle, setReportPdfTitle] = useState('Informe Ejecutivo de Ventas');
  const [isReportPdfModalOpen, setIsReportPdfModalOpen] = useState(false);

  useEffect(() => {
    const loadSales = async () => {
      try {
        const all = await db.sales.toArray();
        if (selectedCompanyId && selectedCompanyId !== 'ALL') {
          setSalesList(all.filter(s => s.companyId === selectedCompanyId));
        } else {
          setSalesList(all);
        }
      } catch {
        setSalesList([]);
      }
    };
    loadSales();
  }, [selectedCompanyId, refreshTrigger, activeTab]);

  // Modals state
  const [isProductFormOpen, setIsProductFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const [isMovementOpen, setIsMovementOpen] = useState(false);
  const [movementProduct, setMovementProduct] = useState<Product | null>(null);
  const [movementType, setMovementType] = useState<'ENTRADA' | 'SALIDA' | 'AJUSTE'>('ENTRADA');

  const [isDeliveryGuideOpen, setIsDeliveryGuideOpen] = useState(false);
  const [isReceptionGuideOpen, setIsReceptionGuideOpen] = useState(false);

  const [isCompanyManagerOpen, setIsCompanyManagerOpen] = useState(false);
  const [isUserManagerOpen, setIsUserManagerOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isBackupOpen, setIsBackupOpen] = useState(false);
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isInventoryTakingOpen, setIsInventoryTakingOpen] = useState(false);

  const triggerRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  useEffect(() => {
    initCloudSync();
    const handleDataUpdate = () => triggerRefresh();
    window.addEventListener('marketalmacen-data-updated', handleDataUpdate);
    return () => window.removeEventListener('marketalmacen-data-updated', handleDataUpdate);
  }, []);

  const handleGlobalScan = (barcode: string) => {
    setScannedBarcode(barcode);

    if (activeTab === 'inventory') {
      db.products.where('code').equals(barcode).first().then(prod => {
        if (prod) {
          if (!isReadOnly) {
            setMovementProduct(prod);
            setIsMovementOpen(true);
          }
        } else if (!isReadOnly) {
          setEditingProduct(null);
          setIsProductFormOpen(true);
        }
      });
    } else if (activeTab === 'sales') {
      // Manejado internamente por SalesView
    } else if (activeTab === 'guides' && !isReadOnly) {
      setIsReceptionGuideOpen(true);
    }
  };

  // If user is not authenticated, show Login view
  if (!isAuthenticated) {
    return <LoginView />;
  }

  return (
    <div className={`${activeTab === 'sales' ? 'lg:h-screen lg:overflow-hidden min-h-screen' : 'min-h-screen'} ${themeClasses.bg} ${themeClasses.text} flex flex-col font-sans transition-colors duration-200 pb-16 xl:pb-0`}>
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenConsultant={() => setIsConsultantOpen(true)}
        onOpenCompanies={() => setIsCompanyManagerOpen(true)}
        onOpenImport={() => setIsImportOpen(true)}
        onOpenUserManager={() => setIsUserManagerOpen(true)}
        onOpenBackup={() => setIsBackupOpen(true)}
          onOpenSuppliers={() => setIsSupplierModalOpen(true)}
          onOpenCustomers={() => setIsCustomerModalOpen(true)}
          onOpenInventoryTaking={() => setIsInventoryTakingOpen(true)}
      />

      {/* Main Content Area */}
      <main className={`flex-1 max-w-[1750px] w-full mx-auto ${activeTab === 'sales' ? 'p-1.5 sm:p-2 overflow-hidden' : 'p-2.5 sm:p-4 lg:p-5'}`}>
        
        {/* Menú Exclusivo de Informes (Activado desde Sesión de Usuario) */}
        {activeTab === 'reports' && (
          <div className="space-y-4 max-w-7xl mx-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setActiveTab('sales')}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-black flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Volver a Ventas y POS</span>
                </button>
                <div className="h-4 w-px bg-slate-300 dark:bg-slate-700" />
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-emerald-500" />
                  <h1 className="text-sm font-black text-slate-800 dark:text-slate-100">
                    Centro de Informes y Estadísticas Comerciales
                  </h1>
                </div>
              </div>
            </div>

            <SalesReportsSubView
              sales={salesList}
              company={companies.find(c => c.id === selectedCompanyId) || null}
              onOpenPdf={(doc, filename, title) => {
                setReportPdfDoc(doc);
                setReportPdfFilename(filename);
                setReportPdfTitle(title);
                setIsReportPdfModalOpen(true);
              }}
            />
          </div>
        )}

        {/* 1. Menú Principal: Ventas y POS */}
        {activeTab === 'sales' && (
          <SalesView
            onOpenScanner={() => {
              setScannerContext('sales');
              setIsScannerOpen(true);
            }}
            onOpenConsultant={() => setIsConsultantOpen(true)}
            onCartCountChange={(c) => setCartCount(c)}
            scannedBarcode={scannedBarcode}
            refreshTrigger={refreshTrigger}
          />
        )}

        {/* 2. Menú: Productos e Inventario */}
        {activeTab === 'inventory' && (
          <ProductListView
            onOpenNewProduct={() => {
              if (isReadOnly) return;
              setEditingProduct(null);
              setScannedBarcode('');
              setIsProductFormOpen(true);
            }}
            onEditProduct={(p) => {
              if (isReadOnly) return;
              setEditingProduct(p);
              setIsProductFormOpen(true);
            }}
            onOpenMovement={(p, type) => {
              if (isReadOnly) return;
              setMovementProduct(p || null);
              setMovementType(type || 'ENTRADA');
              setScannedBarcode('');
              setIsMovementOpen(true);
            }}
            onOpenScanner={() => {
              setScannerContext('inventory');
              setIsScannerOpen(true);
            }}
            refreshTrigger={refreshTrigger}
          />
        )}

        {/* 3. Menú: Guías de Despacho */}
        {activeTab === 'guides' && (
          <GuidesListView
            onOpenNewReception={() => {
              if (isReadOnly) return;
              setScannedBarcode('');
              setIsReceptionGuideOpen(true);
            }}
            onOpenNewDelivery={() => {
              if (isReadOnly) return;
              setScannedBarcode('');
              setIsDeliveryGuideOpen(true);
            }}
            refreshTrigger={refreshTrigger}
          />
        )}

        {/* 4. Menú: Solicitud de Compras (Reemplaza Bitácora) */}
        {activeTab === 'purchases' && (
          <PurchasesView refreshTrigger={refreshTrigger} />
        )}

        {/* 5. Menú: Mermas y Control de Vencimientos */}
        {activeTab === 'mermas' && (
          <MermasView refreshTrigger={refreshTrigger} />
        )}
      </main>

      {/* Footer */}
      <footer className={`py-4 border-t ${themeClasses.border} text-center text-xs text-slate-500`}>
        <div className="max-w-[1700px] mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>© 2026 MARKET ALMACÉN - Sistema de Control de Inventario y Ventas</span>
          <span className="font-mono text-[11px] text-slate-400">PWA Multiplataforma • Android & Web • 10.000+ Items</span>
        </div>
      </footer>

      {/* Global Modals */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={handleGlobalScan}
      />

      <CompanyManagerModal
        isOpen={isCompanyManagerOpen}
        onClose={() => setIsCompanyManagerOpen(false)}
      />

      <ImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onImportComplete={triggerRefresh}
      />

      <UserManagerModal
        isOpen={isUserManagerOpen}
        onClose={() => setIsUserManagerOpen(false)}
      />

      <MasterBackupModal
        isOpen={isBackupOpen}
        onClose={() => setIsBackupOpen(false)}
        onOpenImport={() => {
          setIsBackupOpen(false);
          setIsImportOpen(true);
        }}
      />

      <SupplierManagerModal
        isOpen={isSupplierModalOpen}
        onClose={() => setIsSupplierModalOpen(false)}
      />

      <CustomerManagerModal
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
      />

      <InventoryTakingModal
        isOpen={isInventoryTakingOpen}
        onClose={() => setIsInventoryTakingOpen(false)}
      />

      <ProductFormModal
        isOpen={isProductFormOpen}
        onClose={() => setIsProductFormOpen(false)}
        productToEdit={editingProduct}
        onSaved={triggerRefresh}
        onOpenScanner={() => {
          setScannerContext('productForm');
          setIsScannerOpen(true);
        }}
        initialBarcode={scannedBarcode}
      />

      <StockMovementModal
        isOpen={isMovementOpen}
        onClose={() => setIsMovementOpen(false)}
        product={movementProduct}
        defaultType={movementType}
        onSaved={triggerRefresh}
        onOpenScanner={() => {
          setScannerContext('movement');
          setIsScannerOpen(true);
        }}
        scannedBarcode={scannedBarcode}
      />

      <ReceptionGuideModal
        isOpen={isReceptionGuideOpen}
        onClose={() => setIsReceptionGuideOpen(false)}
        onSaved={triggerRefresh}
        onOpenScanner={() => {
          setScannerContext('receptionGuide');
          setIsScannerOpen(true);
        }}
        scannedBarcode={scannedBarcode}
      />

      <DeliveryGuideModal
        isOpen={isDeliveryGuideOpen}
        onClose={() => setIsDeliveryGuideOpen(false)}
        onSaved={triggerRefresh}
        onOpenScanner={() => {
          setScannerContext('deliveryGuide');
          setIsScannerOpen(true);
        }}
        scannedBarcode={scannedBarcode}
      />
      {/* Barra de Navegación Inferior Nativa para Celulares */}
      <MobileBottomNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenMoreMenu={() => setIsMobileMoreOpen(true)}
        onOpenConsultant={() => setIsConsultantOpen(true)}
        cartCount={cartCount}
      />

      {/* Menú Desplegable "Más" para Celulares */}
      <MobileMoreMenuModal
        isOpen={isMobileMoreOpen}
        onClose={() => setIsMobileMoreOpen(false)}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenConsultant={() => setIsConsultantOpen(true)}
        onOpenCashClosing={() => setIsCashClosingOpen(true)}
        onOpenSuppliers={() => setIsSupplierModalOpen(true)}
        onOpenCustomers={() => setIsCustomerModalOpen(true)}
        onOpenInventoryTaking={() => setIsInventoryTakingOpen(true)}
        onOpenUserManager={() => setIsUserManagerOpen(true)}
        onOpenBackup={() => setIsBackupOpen(true)}
      />

      {/* Consultor Rápido de Precios y Stock */}
      <ProductConsultantModal
        isOpen={isConsultantOpen}
        onClose={() => setIsConsultantOpen(false)}
      />

      {/* Cierre Z de Caja */}
      {isCashClosingOpen && (
        <CashClosingModal
          isOpen={isCashClosingOpen}
          onClose={() => setIsCashClosingOpen(false)}
          onClosingSuccess={() => triggerRefresh()}
        />
      )}
    </div>
  );
};
