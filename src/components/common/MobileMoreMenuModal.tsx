import React from 'react';
import { useAuth } from '../../utils/authContext';
import { useTheme } from '../../utils/themeContext';
import { useCompany } from '../../utils/companyContext';
import {
  X,
  Search,
  AlertTriangle,
  ClipboardList,
  Lock,
  BarChart3,
  Truck,
  Building2,
  ClipboardCheck,
  Users,
  Cloud,
  FileSpreadsheet,
  HardDrive,
  LogOut,
  Palette,
  ShoppingCart,
  Package,
  FileText
} from 'lucide-react';

interface MobileMoreMenuModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenConsultant: () => void;
  onOpenCashClosing?: () => void;
  onOpenSuppliers?: () => void;
  onOpenCustomers?: () => void;
  onOpenInventoryTaking?: () => void;
  onOpenUserManager?: () => void;
  onOpenCloudModal?: () => void;
  onOpenCafModal?: () => void;
  onOpenBackup?: () => void;
}

export const MobileMoreMenuModal: React.FC<MobileMoreMenuModalProps> = ({
  isOpen,
  onClose,
  activeTab,
  setActiveTab,
  onOpenConsultant,
  onOpenCashClosing,
  onOpenSuppliers,
  onOpenCustomers,
  onOpenInventoryTaking,
  onOpenUserManager,
  onOpenCloudModal,
  onOpenCafModal,
  onOpenBackup
}) => {
  const { currentUser, isSuperAdmin, isAdmin, permissions, logout } = useAuth();
  const { theme, setTheme, themeClasses } = useTheme();
  const { selectedCompany } = useCompany();

  if (!isOpen) return null;

  const navigateTo = (tabName: string) => {
    setActiveTab(tabName);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className={`w-full max-w-lg max-h-[90vh] rounded-t-3xl sm:rounded-3xl border-t sm:border-2 ${themeClasses.border} ${themeClasses.card} shadow-2xl flex flex-col overflow-hidden animate-slideUp`}>
        
        {/* Header Drawer */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-blue-600 text-white font-black text-sm flex items-center justify-center shadow-sm">
              {currentUser?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div>
              <h3 className="font-black text-sm text-slate-900 dark:text-white leading-snug">
                {currentUser?.name || currentUser?.username}
              </h3>
              <p className="text-[10px] font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                {isSuperAdmin ? 'Super Administrador' : isAdmin ? 'Administrador' : currentUser?.role === 'BODEGA' ? 'Bodeguero' : 'Ventas y POS'} • {selectedCompany?.name || 'Bodega'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Menu Items Grid */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          
          {/* Herramientas Principales Autorizadas */}
          <div className="space-y-1.5">
            <span className="text-[10.5px] font-black uppercase tracking-wider text-slate-400 px-1 block">
              Operaciones Rápidas
            </span>

            <div className="grid grid-cols-2 gap-2">
              {/* Consultor de Productos */}
              {permissions.priceConsultant && (
                <button
                  type="button"
                  onClick={() => { onClose(); onOpenConsultant(); }}
                  className="p-3 rounded-2xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/60 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 flex items-center gap-2.5 text-left transition cursor-pointer"
                >
                  <Search className="w-5 h-5 text-blue-600 shrink-0" />
                  <div className="min-w-0">
                    <span className="text-xs font-black text-blue-950 dark:text-blue-100 block truncate">Consultor</span>
                    <span className="text-[10px] text-blue-700 dark:text-blue-300 font-bold block truncate">Precio y Stock</span>
                  </div>
                </button>
              )}

              {/* Cierre Z de Caja */}
              {permissions.cashClosing && onOpenCashClosing && (
                <button
                  type="button"
                  onClick={() => { onClose(); onOpenCashClosing(); }}
                  className="p-3 rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/60 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-900/50 flex items-center gap-2.5 text-left transition cursor-pointer"
                >
                  <Lock className="w-5 h-5 text-amber-600 shrink-0" />
                  <div className="min-w-0">
                    <span className="text-xs font-black text-amber-950 dark:text-amber-100 block truncate">Cierre de Caja</span>
                    <span className="text-[10px] text-amber-700 dark:text-amber-300 font-bold block truncate">Cuadratura Z</span>
                  </div>
                </button>
              )}

              {/* Registro de Mermas */}
              {permissions.mermas && (
                <button
                  type="button"
                  onClick={() => navigateTo('mermas')}
                  className={`p-3 rounded-2xl border flex items-center gap-2.5 text-left transition cursor-pointer ${
                    activeTab === 'mermas'
                      ? 'border-red-500 bg-red-50 dark:bg-red-950/40 text-red-900 dark:text-red-100 font-black'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'
                  }`}
                >
                  <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
                  <div className="min-w-0">
                    <span className="text-xs font-black block truncate">Mermas</span>
                    <span className="text-[10px] opacity-75 font-bold block truncate">Pérdidas y Daños</span>
                  </div>
                </button>
              )}

              {/* Solicitud de Productos (Compras) */}
              {permissions.purchases && (
                <button
                  type="button"
                  onClick={() => navigateTo('purchases')}
                  className={`p-3 rounded-2xl border flex items-center gap-2.5 text-left transition cursor-pointer ${
                    activeTab === 'purchases'
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-100 font-black'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'
                  }`}
                >
                  <ClipboardList className="w-5 h-5 text-indigo-500 shrink-0" />
                  <div className="min-w-0">
                    <span className="text-xs font-black block truncate">Solicitud Stock</span>
                    <span className="text-[10px] opacity-75 font-bold block truncate">Requerimientos</span>
                  </div>
                </button>
              )}
            </div>
          </div>

          {/* Módulos Secundarios */}
          <div className="space-y-1">
            <span className="text-[10.5px] font-black uppercase tracking-wider text-slate-400 px-1 block">
              Gestión y Registros
            </span>

            <div className="space-y-1">
              {/* Toma de Inventario */}
              {permissions.inventoryTaking && onOpenInventoryTaking && (
                <button
                  type="button"
                  onClick={() => { onClose(); onOpenInventoryTaking(); }}
                  className="w-full p-2.5 rounded-xl text-left text-xs font-black text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-3 transition cursor-pointer"
                >
                  <ClipboardCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Toma de Inventario Física</span>
                </button>
              )}

              {/* Informes de Ventas */}
              {permissions.reports && (
                <button
                  type="button"
                  onClick={() => navigateTo('reports')}
                  className="w-full p-2.5 rounded-xl text-left text-xs font-black text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-3 transition cursor-pointer"
                >
                  <BarChart3 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Centro de Informes y Estadísticas</span>
                </button>
              )}

              {/* Proveedores */}
              {permissions.suppliers && onOpenSuppliers && (
                <button
                  type="button"
                  onClick={() => { onClose(); onOpenSuppliers(); }}
                  className="w-full p-2.5 rounded-xl text-left text-xs font-black text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-3 transition cursor-pointer"
                >
                  <Truck className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>Registrar Proveedores</span>
                </button>
              )}

              {/* Clientes */}
              {permissions.customers && onOpenCustomers && (
                <button
                  type="button"
                  onClick={() => { onClose(); onOpenCustomers(); }}
                  className="w-full p-2.5 rounded-xl text-left text-xs font-black text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-3 transition cursor-pointer"
                >
                  <Building2 className="w-4 h-4 text-blue-500 shrink-0" />
                  <span>Clientes con Factura</span>
                </button>
              )}

              {/* Gestión de Usuarios (Admin) */}
              {permissions.manageUsers && onOpenUserManager && (
                <button
                  type="button"
                  onClick={() => { onClose(); onOpenUserManager(); }}
                  className="w-full p-2.5 rounded-xl text-left text-xs font-black text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/40 flex items-center gap-3 transition cursor-pointer"
                >
                  <Users className="w-4 h-4 text-purple-500 shrink-0" />
                  <span>Gestionar Usuarios y Permisos</span>
                </button>
              )}

              {/* Sincronización Nube */}
              {permissions.cloudSync && onOpenCloudModal && (
                <button
                  type="button"
                  onClick={() => { onClose(); onOpenCloudModal(); }}
                  className="w-full p-2.5 rounded-xl text-left text-xs font-black text-cyan-600 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-950/40 flex items-center gap-3 transition cursor-pointer"
                >
                  <Cloud className="w-4 h-4 text-cyan-500 shrink-0" />
                  <span>Sincronización Nube Supabase</span>
                </button>
              )}

              {/* Sistema Folios CAF */}
              {permissions.cafFolios && onOpenCafModal && (
                <button
                  type="button"
                  onClick={() => { onClose(); onOpenCafModal(); }}
                  className="w-full p-2.5 rounded-xl text-left text-xs font-black text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 flex items-center gap-3 transition cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>Folios CAF / SII</span>
                </button>
              )}

              {/* Copia de Seguridad */}
              {permissions.backup && onOpenBackup && (
                <button
                  type="button"
                  onClick={() => { onClose(); onOpenBackup(); }}
                  className="w-full p-2.5 rounded-xl text-left text-xs font-black text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-3 transition cursor-pointer"
                >
                  <HardDrive className="w-4 h-4 text-purple-500 shrink-0" />
                  <span>Copia de Seguridad</span>
                </button>
              )}
            </div>
          </div>

          {/* Selector de Tema Visual */}
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
            <div className="text-[10px] font-black uppercase text-slate-400 px-1 mb-1.5 flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5" />
              <span>Tema Visual</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => setTheme('white')}
                className={`py-2 px-2 text-center text-[11px] font-bold rounded-xl border ${
                  theme === 'white' ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                Blanco
              </button>
              <button
                type="button"
                onClick={() => setTheme('dark-red')}
                className={`py-2 px-2 text-center text-[11px] font-bold rounded-xl border ${
                  theme === 'dark-red' ? 'bg-red-600 text-white border-red-600' : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                Negro-Rojo
              </button>
              <button
                type="button"
                onClick={() => setTheme('blue-green')}
                className={`py-2 px-2 text-center text-[11px] font-bold rounded-xl border ${
                  theme === 'blue-green' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                Azul-Verde
              </button>
            </div>
          </div>

          {/* Cerrar Sesión */}
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => {
                onClose();
                logout();
              }}
              className="w-full p-2.5 rounded-xl text-left text-xs font-black text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 flex items-center gap-3 transition cursor-pointer"
            >
              <LogOut className="w-4 h-4 text-red-500 shrink-0" />
              <span>Cerrar Sesión</span>
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};
