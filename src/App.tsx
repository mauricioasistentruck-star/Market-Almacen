import React, { useState, useEffect } from 'react';
import { useTheme } from './utils/themeContext';
import { useCompany } from './utils/companyContext';
import { useAuth } from './utils/authContext';
import { db } from './db/database';
import type { Product, Tool } from './types';
import { Navbar } from './components/Navbar';
import { LoginView } from './components/auth/LoginView';

// Tab Views
import { SalesView } from './components/sales/SalesView';
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

export const App: React.FC = () => {
  const { themeClasses } = useTheme();
  const { selectedCompanyId } = useCompany();
  const { isAuthenticated, isReadOnly } = useAuth();

  // Pestaña inicial por defecto: Ventas y POS
  const [activeTab, setActiveTab] = useState<string>('sales');
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  // Scanner state
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannedBarcode, setScannedBarcode] = useState('');
  const [scannerContext, setScannerContext] = useState<string>('general');

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

  const triggerRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

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
    <div className={`${activeTab === 'sales' ? 'h-screen overflow-hidden' : 'min-h-screen'} ${themeClasses.bg} ${themeClasses.text} flex flex-col font-sans transition-colors duration-200`}>
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenCompanies={() => setIsCompanyManagerOpen(true)}
        onOpenImport={() => setIsImportOpen(true)}
        onOpenUserManager={() => setIsUserManagerOpen(true)}
        onOpenBackup={() => setIsBackupOpen(true)}
      />

      {/* Main Content Area */}
      <main className={`flex-1 max-w-[1750px] w-full mx-auto ${activeTab === 'sales' ? 'p-1.5 sm:p-2 overflow-hidden' : 'p-2.5 sm:p-4 lg:p-5'}`}>
        {/* 1. Menú Principal: Ventas y POS */}
        {activeTab === 'sales' && (
          <SalesView
            onOpenScanner={() => {
              setScannerContext('sales');
              setIsScannerOpen(true);
            }}
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
    </div>
  );
};
