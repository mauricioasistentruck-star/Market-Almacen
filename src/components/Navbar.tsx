import React, { useState, useEffect } from 'react';
import { useTheme } from '../utils/themeContext';
import { useCompany } from '../utils/companyContext';
import { useAuth } from '../utils/authContext';
import {
  ShoppingCart,
  Search,
  FileSpreadsheet,
  BarChart3,
  Package,
  FileText,
  ClipboardList,
  AlertTriangle,
  Building2,
  ClipboardCheck,
  Truck,
  Users,
  HardDrive,
  LogOut,
  ChevronDown,
  Palette,
  Cloud,
  CloudOff,
  RefreshCw
} from 'lucide-react';
import { CloudConfigModal } from './common/CloudConfigModal';
import { CafFoliosManagerModal } from './sales/CafFoliosManagerModal';
import { isCloudConfigured, subscribeCloudSync, type CloudSyncStatus } from '../utils/cloudSync';

export type TabType = 'sales' | 'inventory' | 'guides' | 'purchases' | 'mermas' | 'reports';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: any) => void;
  onOpenConsultant?: () => void;
  onOpenScanner?: () => void;
  onOpenCompanies?: () => void;
  onOpenUserManager?: () => void;
  onOpenBackup?: () => void;
  onOpenImport?: () => void;
  onOpenSuppliers?: () => void;
  onOpenCustomers?: () => void;
  onOpenInventoryTaking?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onOpenConsultant,
  onOpenCompanies,
  onOpenUserManager,
  onOpenBackup,
  onOpenSuppliers,
  onOpenCustomers,
  onOpenInventoryTaking
}) => {
  const { theme, setTheme, themeClasses } = useTheme();
  const { companies, selectedCompanyId, setSelectedCompanyId, selectedCompany } = useCompany();
  const { currentUser, isSuperAdmin, isAdmin, isVentas, isBodega, permissions, logout } = useAuth();

  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isCompanyMenuOpen, setIsCompanyMenuOpen] = useState(false);
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const [isCloudModalOpen, setIsCloudModalOpen] = useState(false);
  const [isCafModalOpen, setIsCafModalOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState<CloudSyncStatus>({
    isOnline: true,
    isSyncing: false,
    lastSync: null,
    mode: isCloudConfigured() ? 'cloud' : 'local'
  });

  useEffect(() => {
    const unsub = subscribeCloudSync((st) => setSyncStatus(st));
    return () => unsub();
  }, []);

  const allTabs: Array<{ id: TabType; label: string; icon: React.FC<{ className?: string }> }> = [
    { id: 'sales', label: 'Ventas y POS', icon: ShoppingCart },
    { id: 'inventory', label: 'Productos', icon: Package },
    { id: 'guides', label: 'Guías de Despacho', icon: FileText },
    { id: 'purchases', label: 'Compras', icon: ClipboardList },
    { id: 'mermas', label: 'Mermas', icon: AlertTriangle }
  ];

  // Si el usuario es de rol VENTAS, se restringe únicamente a Ventas, Productos y Guías
  const tabs = isVentas
    ? allTabs.filter(t => t.id === 'sales' || t.id === 'inventory' || t.id === 'guides')
    : allTabs;

  return (
    <header className={`sticky top-0 z-40 w-full border-b ${themeClasses.border} ${themeClasses.card} shadow-sm backdrop-blur-md transition-colors duration-200`}>
      <div className="max-w-[1600px] mx-auto px-3 sm:px-5 lg:px-6">
        <div className="flex items-center justify-between h-14 sm:h-16 gap-2 sm:gap-3">
          
          {/* Logo & App Title: Ahorro de espacio con icono MA y texto montado */}
          <div className="flex items-center gap-2 shrink-0 select-none">
            <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-2xl flex items-center justify-center shadow-md ${themeClasses.accentBg} shrink-0`}>
              <span className="font-black text-sm sm:text-base tracking-tighter leading-none">
                <span className="text-white">M</span>
                <span className="text-cyan-300 font-extrabold">A</span>
              </span>
            </div>
            <div className="flex flex-col justify-center leading-none">
              <span className="font-black text-[10.5px] sm:text-xs tracking-wider text-slate-900 dark:text-slate-100 uppercase">
                MARKET
              </span>
              <span className={`font-black text-[10.5px] sm:text-xs tracking-wider ${themeClasses.accent} uppercase -mt-0.5`}>
                ALMACÉN
              </span>
            </div>
          </div>

          {/* Desktop Navigation Tabs */}
          <nav className="hidden xl:flex items-center gap-1.5 lg:gap-2">
            {tabs.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`h-10 px-3.5 rounded-xl text-xs font-black transition-all duration-150 flex items-center gap-2 whitespace-nowrap shadow-sm cursor-pointer ${
                    isActive
                      ? `${themeClasses.accentBg} text-white shadow-blue-500/20 scale-[1.02]`
                      : `bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/80 hover:text-slate-900 dark:hover:text-white`
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-600 dark:text-slate-400'}`} />
                  <span className="whitespace-nowrap">{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right Action Tools: Company, Theme & User */}
          <div className="flex items-center gap-2 shrink-0">
            
            {/* Empresa: Selector interactivo para Superadmin, Indicador Fijo para Administradores y Personal */}
            {isSuperAdmin ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setIsCompanyMenuOpen(!isCompanyMenuOpen);
                    setIsUserMenuOpen(false);
                    setIsThemeMenuOpen(false);
                  }}
                  className="h-9 sm:h-10 flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 rounded-xl border border-purple-300 dark:border-purple-700 bg-purple-50/80 dark:bg-purple-950/50 text-xs font-black text-purple-900 dark:text-purple-200 hover:bg-purple-100 dark:hover:bg-purple-900/60 transition shadow-sm max-w-[120px] sm:max-w-[170px] lg:max-w-[240px] whitespace-nowrap cursor-pointer"
                  title="Superadmin: Cambiar o Gestionar Empresas"
                >
                  <Building2 className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                  <span className="truncate">
                    {selectedCompany?.tradeName || selectedCompany?.name || 'Empresa'}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-purple-500 shrink-0 ml-auto" />
                </button>

                {isCompanyMenuOpen && (
                  <div className="absolute left-0 sm:left-0 mt-2 w-80 max-w-[calc(100vw-24px)] rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl p-3 z-50 animate-scaleIn">
                    <div className="text-[10px] font-black uppercase text-purple-600 dark:text-purple-400 px-2 py-1 tracking-wider flex items-center justify-between">
                      <span>Empresas Registradas</span>
                      <span className="bg-purple-100 dark:bg-purple-950 px-1.5 py-0.5 rounded text-[9px]">{companies.length}</span>
                    </div>
                    <div className="space-y-1 py-1 max-h-56 overflow-y-auto">
                      {companies.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setSelectedCompanyId(c.id);
                            setIsCompanyMenuOpen(false);
                          }}
                          className={`w-full px-3 py-2 rounded-xl text-left text-xs font-bold transition truncate flex items-center justify-between ${
                            selectedCompanyId === c.id
                              ? 'bg-purple-600 text-white shadow-sm font-black'
                              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          <span className="truncate">{c.tradeName || c.name}</span>
                        </button>
                      ))}
                    </div>

                    {isSuperAdmin && onOpenCompanies && (
                      <div className="pt-1.5 mt-1 border-t border-slate-200 dark:border-slate-800">
                        <button
                          type="button"
                          onClick={() => {
                            setIsCompanyMenuOpen(false);
                            onOpenCompanies();
                          }}
                          className="w-full px-3 py-2 rounded-xl text-left text-xs font-black text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/50 flex items-center gap-2 transition"
                        >
                          <Building2 className="w-4 h-4 text-purple-600" />
                          <span>🏢 Gestionar y Crear Empresas (SuperAdmin)</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              /* Indicador visual fijo de la empresa para Administradores y Personal (Sin permiso de cambio) */
              <div
                className="h-9 sm:h-10 flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs font-black text-slate-800 dark:text-slate-200 max-w-[110px] sm:max-w-[160px] lg:max-w-[220px] whitespace-nowrap shadow-sm select-none"
                title={`Empresa Activa: ${selectedCompany?.name || 'Bodega'}`}
              >
                <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                <span className="truncate">
                  {selectedCompany?.tradeName || selectedCompany?.name || 'Mi Empresa'}
                </span>
              </div>
            )}

            

            {/* Consultor Rápido en Móvil */}
            {permissions.priceConsultant && onOpenConsultant && (
              <button
                type="button"
                onClick={onOpenConsultant}
                className="md:hidden h-9 w-9 flex items-center justify-center rounded-xl border border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 hover:bg-blue-100 transition shadow-xs cursor-pointer"
                title="Consultor de Precios y Stock"
              >
                <Search className="w-4 h-4" />
              </button>
            )}

            {/* Tema Switcher */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setIsThemeMenuOpen(!isThemeMenuOpen);
                  setIsUserMenuOpen(false);
                  setIsCompanyMenuOpen(false);
                }}
                className="h-10 w-10 flex items-center justify-center rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition shadow-sm cursor-pointer"
                title="Cambiar Tema Visual"
              >
                <Palette className="w-4 h-4 text-slate-700 dark:text-slate-300" />
              </button>

              {isThemeMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl p-2 z-50 animate-scaleIn">
                  <div className="text-[10px] font-black uppercase text-slate-400 px-2 py-1 tracking-wider">
                    Temas Visuales
                  </div>
                  <div className="space-y-1">
                    <button
                      type="button"
                      onClick={() => {
                        setTheme('white');
                        setIsThemeMenuOpen(false);
                      }}
                      className={`w-full px-3 py-2 rounded-xl text-left text-xs font-bold transition flex items-center justify-between ${
                        theme === 'white' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span>⚪ Blanco (Limpio)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTheme('dark-red');
                        setIsThemeMenuOpen(false);
                      }}
                      className={`w-full px-3 py-2 rounded-xl text-left text-xs font-bold transition flex items-center justify-between ${
                        theme === 'dark-red' ? 'bg-red-600 text-white shadow-sm' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span>⚫ Negro - Rojo</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTheme('blue-green');
                        setIsThemeMenuOpen(false);
                      }}
                      className={`w-full px-3 py-2 rounded-xl text-left text-xs font-bold transition flex items-center justify-between ${
                        theme === 'blue-green' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span>🔵 Azul - Verde</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* User Profile Menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setIsUserMenuOpen(!isUserMenuOpen);
                  setIsCompanyMenuOpen(false);
                  setIsThemeMenuOpen(false);
                }}
                className="h-10 flex items-center gap-2.5 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition shadow-sm cursor-pointer"
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black text-white shadow-sm ${
                  isSuperAdmin ? 'bg-purple-600' : isAdmin ? 'bg-blue-600' : 'bg-emerald-600'
                }`}>
                  {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
                </div>
                <span className="text-xs font-black hidden sm:inline truncate max-w-[130px]">
                  {currentUser?.name || currentUser?.username}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              </button>

              {isUserMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl p-2 z-50 animate-scaleIn">
                  <div className="px-3 py-2.5 border-b border-slate-200 dark:border-slate-800 mb-1">
                    <p className="text-xs font-black text-slate-900 dark:text-slate-100 truncate">
                      {currentUser?.name || currentUser?.username}
                    </p>
                    <p className="text-[10px] font-extrabold text-slate-500">
                      {(isAdmin || isSuperAdmin) ? '🛡️ Administrador' : '💼 Ventas y POS'}
                    </p>
                  </div>

                  <div className="space-y-0.5">
                    {/* Menú de Informes */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        setActiveTab('reports');
                      }}
                      className="w-full px-3 py-2 rounded-xl text-left text-xs font-black text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 cursor-pointer"
                    >
                      <BarChart3 className="w-4 h-4 text-emerald-500" />
                      <span>Menú de Informes</span>
                    </button>

                    {/* Registrar Proveedores */}
                    {onOpenSuppliers && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          onOpenSuppliers();
                        }}
                        className="w-full px-3 py-2 rounded-xl text-left text-xs font-black text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 cursor-pointer"
                      >
                        <Truck className="w-4 h-4 text-amber-500" />
                        <span>Registrar Proveedores</span>
                      </button>
                    )}

                    {/* Clientes con Factura */}
                    {onOpenCustomers && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          onOpenCustomers();
                        }}
                        className="w-full px-3 py-2 rounded-xl text-left text-xs font-black text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 cursor-pointer"
                      >
                        <Building2 className="w-4 h-4 text-blue-500" />
                        <span>Clientes con Factura</span>
                      </button>
                    )}

                    {/* Toma de Inventario Física (Para todos los usuarios) */}
                    {onOpenInventoryTaking && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          onOpenInventoryTaking();
                        }}
                        className="w-full px-3 py-2 rounded-xl text-left text-xs font-black text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-950/40 flex items-center gap-2.5 cursor-pointer transition"
                      >
                        <ClipboardCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        <span>Toma de Inventario</span>
                      </button>
                    )}
                    {/* Gestionar Usuarios */}
                    {isAdmin && onOpenUserManager && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          onOpenUserManager();
                        }}
                        className="w-full px-3 py-2 rounded-xl text-left text-xs font-black text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5"
                      >
                        <Users className="w-4 h-4 text-blue-500" />
                        <span>Gestionar Usuarios</span>
                      </button>
                    )}

                    {/* Configuración Nube Supabase */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        setIsCloudModalOpen(true);
                      }}
                      className="w-full px-3 py-2.5 rounded-xl text-left text-xs font-black text-slate-800 dark:text-slate-200 hover:bg-cyan-50 dark:hover:bg-cyan-950/40 flex items-center justify-between transition cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        <Cloud className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                        <span>Sincronización en la Nube</span>
                      </div>
                      <span className={`text-[9.5px] font-mono px-2 py-0.5 rounded-full font-black ${
                        !isCloudConfigured()
                          ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'
                          : syncStatus.error
                          ? 'bg-red-100 text-red-700'
                          : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                      }`}>
                        {!isCloudConfigured() ? 'Desconectada' : 'Activa'}
                      </span>
                    </button>

                    {/* Sistema de Folios CAF / SII (Exclusivo Administrador) */}
                    {(isAdmin || isSuperAdmin) && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          setIsCafModalOpen(true);
                        }}
                        className="w-full px-3 py-2 rounded-xl text-left text-xs font-black text-slate-700 dark:text-slate-300 hover:bg-amber-50 dark:hover:bg-amber-950/40 flex items-center justify-between cursor-pointer transition group"
                        title="[Exclusivo Administrador] Gestión de folios CAF, solicitar folios al SII y configurar alertas de stock mínimo"
                      >
                        <div className="flex items-center gap-2.5">
                          <FileSpreadsheet className="w-4 h-4 text-amber-500 group-hover:scale-110 transition" />
                          <span>Sistema de Folios CAF</span>
                        </div>
                        <span className="text-[9.5px] font-black px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                          SII
                        </span>
                      </button>
                    )}

                    {/* Copia de Seguridad */}
                    {isAdmin && onOpenBackup && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          onOpenBackup();
                        }}
                        className="w-full px-3 py-2 rounded-xl text-left text-xs font-black text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5"
                      >
                        <HardDrive className="w-4 h-4 text-purple-500" />
                        <span>Copia de Seguridad</span>
                      </button>
                    )}

                    <div className="pt-1 border-t border-slate-200 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          logout();
                        }}
                        className="w-full px-3 py-2 rounded-xl text-left text-xs font-black text-red-500 hover:bg-red-500/10 flex items-center gap-2.5"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Cerrar Sesión</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Mobile Navigation Tabs */}
        <div className="flex md:hidden items-center justify-around py-2 border-t border-slate-200 dark:border-slate-800 gap-1 overflow-x-auto">
          {tabs.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`px-2.5 py-1.5 rounded-xl text-[10px] font-black transition flex flex-col items-center gap-0.5 shrink-0 whitespace-nowrap ${
                  isActive
                    ? `${themeClasses.accentBg} text-white shadow-sm`
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

      </div>
      <CloudConfigModal isOpen={isCloudModalOpen} onClose={() => setIsCloudModalOpen(false)} />
      <CafFoliosManagerModal isOpen={isCafModalOpen} onClose={() => setIsCafModalOpen(false)} />
    </header>
  );
};
