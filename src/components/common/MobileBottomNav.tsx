import React from 'react';
import { useAuth } from '../../utils/authContext';
import { useTheme } from '../../utils/themeContext';
import {
  ShoppingCart,
  Package,
  FileText,
  ClipboardList,
  Search,
  Menu,
  AlertTriangle
} from 'lucide-react';

interface MobileBottomNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenMoreMenu: () => void;
  onOpenConsultant: () => void;
  cartCount?: number;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  setActiveTab,
  onOpenMoreMenu,
  onOpenConsultant,
  cartCount = 0
}) => {
  const { permissions, currentUser } = useAuth();
  const { themeClasses } = useTheme();

  // Determinar los botones principales según permisos del usuario
  const navButtons: Array<{
    id: string;
    label: string;
    icon: React.FC<{ className?: string }>;
    badge?: number;
    action?: () => void;
  }> = [];

  // 1. POS / Ventas (si tiene permiso)
  if (permissions.pos) {
    navButtons.push({
      id: 'sales',
      label: 'POS Ventas',
      icon: ShoppingCart,
      badge: cartCount > 0 ? cartCount : undefined
    });
  }

  // 2. Inventario / Productos (si tiene permiso)
  if (permissions.inventory) {
    navButtons.push({
      id: 'inventory',
      label: 'Productos',
      icon: Package
    });
  } else if (permissions.priceConsultant) {
    // Si no tiene catálogo completo pero sí consultor (ej: Cajera pura)
    navButtons.push({
      id: 'consultor',
      label: 'Consultor',
      icon: Search,
      action: onOpenConsultant
    });
  }

  // 3. Guías (si tiene permiso)
  if (permissions.guides) {
    navButtons.push({
      id: 'guides',
      label: 'Guías',
      icon: FileText
    });
  }

  // 4. Compras / Solicitud de Stock (si tiene permiso)
  if (permissions.purchases) {
    navButtons.push({
      id: 'purchases',
      label: 'Compras',
      icon: ClipboardList
    });
  } else if (permissions.mermas) {
    // Si no tiene compras pero tiene mermas
    navButtons.push({
      id: 'mermas',
      label: 'Mermas',
      icon: AlertTriangle
    });
  }

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 pb-safe shadow-2xl transition-colors">
      <div className="flex items-center justify-around h-14 px-1">
        {navButtons.map((btn) => {
          const Icon = btn.icon;
          const isActive = activeTab === btn.id;
          return (
            <button
              key={btn.id}
              type="button"
              onClick={() => {
                if (btn.action) {
                  btn.action();
                } else {
                  setActiveTab(btn.id);
                }
              }}
              className={`flex-1 flex flex-col items-center justify-center py-1 relative transition-transform active:scale-95 cursor-pointer ${
                isActive
                  ? 'text-blue-600 dark:text-blue-400 font-black'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-bold'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${isActive ? 'scale-110' : 'opacity-80'}`} />
                {btn.badge !== undefined && btn.badge > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 bg-orange-600 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-xs animate-pulse">
                    {btn.badge > 99 ? '99+' : btn.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] mt-0.5 tracking-tight truncate max-w-[68px]">
                {btn.label}
              </span>
              {isActive && (
                <div className="absolute top-0 w-8 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-full" />
              )}
            </button>
          );
        })}

        {/* Botón Más / Menú Desplegable */}
        <button
          type="button"
          onClick={onOpenMoreMenu}
          className="flex-1 flex flex-col items-center justify-center py-1 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-bold transition-transform active:scale-95 cursor-pointer"
        >
          <Menu className="w-5 h-5 opacity-80" />
          <span className="text-[10px] mt-0.5 tracking-tight">Más</span>
        </button>
      </div>
    </nav>
  );
};
