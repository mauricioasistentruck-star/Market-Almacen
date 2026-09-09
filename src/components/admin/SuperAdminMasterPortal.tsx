import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db, deleteCompanyWithCascade } from '../../db/database';
import { useAuth } from '../../utils/authContext';
import { useCompany } from '../../utils/companyContext';
import { useTheme } from '../../utils/themeContext';
import { triggerCloudSync } from '../../utils/cloudSync';
import { syncNow } from '../../utils/realtimeSync';
import { ThemeSelectorMenu } from '../common/ThemeSelectorMenu';
import type { Company, AppUser, Sale, Expense, Product, Worker, UserRole } from '../../types';
import {
  Shield,
  Building2,
  Users,
  DollarSign,
  TrendingDown,
  Package,
  Plus,
  Trash2,
  Image as ImageIcon,
  Upload,
  RefreshCw,
  LogOut,
  Search,
  UserPlus,
  Receipt,
  Download,
  Store,
  Croissant,
  Hammer,
  Pill,
  Utensils,
  Laptop,
  Shirt,
  Wrench,
  Beef,
  Apple,
  Boxes,
  Palette
} from 'lucide-react';
import jsPDF from 'jspdf';

// Preset icon gallery definitions
const ICON_PRESETS = [
  { id: 'store', label: 'Almacén / Market', icon: Store, bg: 'bg-orange-500', color: '#f97316' },
  { id: 'bakery', label: 'Panadería / Pastelería', icon: Croissant, bg: 'bg-amber-500', color: '#f59e0b' },
  { id: 'hardware', label: 'Ferretería / Herramientas', icon: Hammer, bg: 'bg-blue-600', color: '#2563eb' },
  { id: 'pharmacy', label: 'Farmacia / Salud', icon: Pill, bg: 'bg-emerald-500', color: '#10b981' },
  { id: 'restaurant', label: 'Restaurant / Café', icon: Utensils, bg: 'bg-rose-500', color: '#f43f5e' },
  { id: 'tech', label: 'Tecnología / Computación', icon: Laptop, bg: 'bg-indigo-600', color: '#4f46e5' },
  { id: 'boutique', label: 'Boutique / Vestuario', icon: Shirt, bg: 'bg-purple-500', color: '#a855f7' },
  { id: 'mechanic', label: 'Taller / Automotriz', icon: Wrench, bg: 'bg-slate-700', color: '#334155' },
  { id: 'butcher', label: 'Carnicería / Cecinas', icon: Beef, bg: 'bg-red-600', color: '#dc2626' },
  { id: 'produce', label: 'Frutas y Verduras', icon: Apple, bg: 'bg-lime-600', color: '#65a30d' },
  { id: 'logistics', label: 'Bodega / Logística', icon: Boxes, bg: 'bg-cyan-600', color: '#0891b2' },
  { id: 'corporate', label: 'Empresa / Servicios', icon: Building2, bg: 'bg-violet-600', color: '#7c3aed' }
];

export const SuperAdminMasterPortal: React.FC = () => {
  const { logout } = useAuth();
  const { companies, reloadCompanies } = useCompany();
  const { theme, themeClasses } = useTheme();

  // Estados de datos cargados de toda la plataforma
  const [users, setUsers] = useState<AppUser[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filtros y pestañas
  const [activeTab, setActiveTab] = useState<'companies' | 'branding' | 'users'>('companies');
  const [searchQuery, setSearchQuery] = useState('');

  // Modales
  const [isNewCompanyModalOpen, setIsNewCompanyModalOpen] = useState(false);
  const [isBrandingModalOpen, setIsBrandingModalOpen] = useState(false);
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);

  // Estado para modal de cambio de icono
  const [targetCompanyForIcon, setTargetCompanyForIcon] = useState<Company | null>(null);
  const [customLogoDataUrl, setCustomLogoDataUrl] = useState<string>('');
  const [selectedPresetId, setSelectedPresetId] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estado para nuevo usuario
  const [targetCompanyForUser, setTargetCompanyForUser] = useState<Company | null>(null);
  const [newUserName, setNewUserName] = useState('');
  const [newUserUsername, setNewUserUsername] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('ADMIN');

  // Estado para nueva empresa
  const [newCompRut, setNewCompRut] = useState('');
  const [newCompName, setNewCompName] = useState('');
  const [newCompTradeName, setNewCompTradeName] = useState('');
  const [newCompIndustry, setNewCompIndustry] = useState('');
  const [newCompPhone, setNewCompPhone] = useState('');
  const [newCompAddress, setNewCompAddress] = useState('');
  const [newCompAdminUser, setNewCompAdminUser] = useState('');
  const [newCompAdminPass, setNewCompAdminPass] = useState('');

  // Carga inicial y refresco
  const loadMasterData = async () => {
    setIsLoading(true);
    try {
      await reloadCompanies();
      const [allUsers, allWorkers, allSales, allExpenses, allProducts] = await Promise.all([
        db.users.toArray(),
        db.workers.toArray(),
        db.sales.toArray(),
        db.expenses.toArray(),
        db.products.toArray()
      ]);
      setUsers(allUsers);
      setWorkers(allWorkers);
      setSales(allSales);
      setExpenses(allExpenses);
      setProducts(allProducts);
    } catch (err) {
      console.error('Error loading master data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMasterData();
    const interval = setInterval(loadMasterData, 5000);
    return () => clearInterval(interval);
  }, []);

  // Métricas Globales Consolidadas
  const globalStats = useMemo(() => {
    const totalCompanies = companies.length;
    // Filtrar a mauricio de los conteos públicos
    const nonSuperUsers = users.filter(u => u.username?.toLowerCase() !== 'mauricio');
    const totalUsers = nonSuperUsers.length;
    const adminCount = nonSuperUsers.filter(u => u.role === 'ADMIN').length;
    const ventasCount = nonSuperUsers.filter(u => u.role === 'VENTAS').length;
    const bodegaCount = nonSuperUsers.filter(u => u.role === 'BODEGA').length;
    const customCount = nonSuperUsers.filter(u => u.role === 'CUSTOM').length;

    const totalSalesAmount = sales.reduce((acc, s) => acc + (s.total || 0), 0);
    const totalExpensesAmount = expenses.reduce((acc, e) => acc + (e.amount || 0), 0);
    const totalDtes = sales.filter(s => s.dteType && s.dteType !== 'TICKET_INTERNO').length;
    const totalProductsCount = products.length;

    return {
      totalCompanies,
      totalUsers,
      adminCount,
      ventasCount,
      bodegaCount,
      customCount,
      totalSalesAmount,
      totalExpensesAmount,
      totalDtes,
      totalProductsCount
    };
  }, [companies, users, sales, expenses, products]);

  // Auditoría por empresa
  const companyAudits = useMemo(() => {
    return companies.map(comp => {
      const compUsers = users.filter(u => u.companyId === comp.id && u.username?.toLowerCase() !== 'mauricio');
      const compWorkers = workers.filter(w => w.companyId === comp.id);
      const compSales = sales.filter(s => s.companyId === comp.id);
      const compExpenses = expenses.filter(e => e.companyId === comp.id);
      const compProducts = products.filter(p => p.companyId === comp.id);

      const salesTotal = compSales.reduce((acc, s) => acc + (s.total || 0), 0);
      const expensesTotal = compExpenses.reduce((acc, e) => acc + (e.amount || 0), 0);
      const netMargin = salesTotal - expensesTotal;
      const dteCount = compSales.filter(s => s.dteType && s.dteType !== 'TICKET_INTERNO').length;

      const admins = compUsers.filter(u => u.role === 'ADMIN');
      const ventas = compUsers.filter(u => u.role === 'VENTAS');
      const bodega = compUsers.filter(u => u.role === 'BODEGA');

      return {
        company: comp,
        users: compUsers,
        workers: compWorkers,
        salesCount: compSales.length,
        salesTotal,
        expensesTotal,
        netMargin,
        dteCount,
        productsCount: compProducts.length,
        adminsCount: admins.length,
        ventasCount: ventas.length,
        bodegaCount: bodega.length
      };
    });
  }, [companies, users, workers, sales, expenses, products]);

  // Filtrar empresas
  const filteredAudits = useMemo(() => {
    if (!searchQuery.trim()) return companyAudits;
    const q = searchQuery.toLowerCase();
    return companyAudits.filter(a =>
      a.company.name.toLowerCase().includes(q) ||
      (a.company.tradeName && a.company.tradeName.toLowerCase().includes(q)) ||
      a.company.rut.toLowerCase().includes(q) ||
      (a.company.industry && a.company.industry.toLowerCase().includes(q))
    );
  }, [companyAudits, searchQuery]);

  // Abrir modal de icono
  const handleOpenIconModal = (company: Company) => {
    setTargetCompanyForIcon(company);
    setCustomLogoDataUrl(company.logoUrl || '');
    setSelectedPresetId(company.appIconPreset || '');
    setIsBrandingModalOpen(true);
  };

  // Manejo de carga de archivo de imagen
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('La imagen es demasiado grande. Seleccione un archivo menor a 2 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const result = uploadEvent.target?.result as string;
      setCustomLogoDataUrl(result);
      setSelectedPresetId(''); // clear preset if custom uploaded
    };
    reader.readAsDataURL(file);
  };

  // Helper para generar imagen PNG en DataURL desde un preset
  const generatePresetIconDataUrl = (presetId: string, compName: string): string => {
    try {
      const preset = ICON_PRESETS.find(p => p.id === presetId);
      const color = preset?.color || '#2563eb';
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');
      if (!ctx) return '';

      // Fondo redondeado con el color del rubro
      ctx.fillStyle = color;
      const r = 28;
      ctx.beginPath();
      ctx.moveTo(r, 0);
      ctx.lineTo(128 - r, 0);
      ctx.quadraticCurveTo(128, 0, 128, r);
      ctx.lineTo(128, 128 - r);
      ctx.quadraticCurveTo(128, 128, 128 - r, 128);
      ctx.lineTo(r, 128);
      ctx.quadraticCurveTo(0, 128, 0, 128 - r);
      ctx.lineTo(0, r);
      ctx.quadraticCurveTo(0, 0, r, 0);
      ctx.closePath();
      ctx.fill();

      // Iniciales de la empresa nítidas y centradas
      const initials = (compName.trim() || 'MA').split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase()).join('');
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 52px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(initials || 'MA', 64, 66);

      return canvas.toDataURL('image/png');
    } catch {
      return '';
    }
  };

  // Guardar icono de la empresa y propagarlo a todos los documentos
  const handleSaveCompanyIcon = async () => {
    if (!targetCompanyForIcon) return;

    try {
      let finalLogoUrl = customLogoDataUrl;
      if (!finalLogoUrl && selectedPresetId) {
        finalLogoUrl = generatePresetIconDataUrl(selectedPresetId, targetCompanyForIcon.tradeName || targetCompanyForIcon.name);
      }

      const updated: Company = {
        ...targetCompanyForIcon,
        logoUrl: finalLogoUrl || undefined,
        appIconPreset: selectedPresetId || undefined,
        updatedAt: new Date().toISOString()
      };

      await db.companies.put(updated);
      await loadMasterData();
      triggerCloudSync();
      syncNow().catch(() => {});
      setIsBrandingModalOpen(false);
      alert(`¡Ícono actualizado correctamente para ${updated.tradeName || updated.name}! Se aplicará de inmediato a documentos (guías, facturas y boletas) y a toda la aplicación.`);
    } catch (err: any) {
      alert('Error al guardar ícono: ' + err.message);
    }
  };

  // Crear nuevo usuario dentro de una empresa
  const handleCreateUserForCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetCompanyForUser) return;

    const uClean = newUserUsername.trim().toLowerCase();
    if (uClean === 'mauricio') {
      alert('El nombre Mauricio está reservado para el SuperAdmin.');
      return;
    }

    const existing = await db.users.where('username').equalsIgnoreCase(uClean).first();
    if (existing) {
      alert('Este nombre de usuario ya existe. Elija otro.');
      return;
    }

    const newUser: AppUser = {
      username: uClean,
      password: newUserPassword.trim() || '123',
      name: newUserName.trim() || 'Usuario Empresa',
      role: newUserRole,
      companyId: targetCompanyForUser.id,
      createdAt: new Date().toISOString()
    };

    await db.users.add(newUser);
    await loadMasterData();
    triggerCloudSync();
    syncNow().catch(() => {});
    setIsAddUserModalOpen(false);
    setNewUserName('');
    setNewUserUsername('');
    setNewUserPassword('');
    alert(`Usuario ${newUser.username} creado con éxito y guardado permanentemente para ${targetCompanyForUser.tradeName || targetCompanyForUser.name}`);
  };

  // Eliminar usuario
  const handleDeleteUser = async (user: AppUser) => {
    if (user.username?.toLowerCase() === 'mauricio') {
      alert('No se puede eliminar la cuenta de SuperAdmin.');
      return;
    }
    if (!confirm(`¿Seguro que deseas eliminar al usuario @${user.username} (${user.name})?`)) {
      return;
    }

    if (user.id) {
      await db.users.delete(user.id);
      await loadMasterData();
      triggerCloudSync();
      syncNow().catch(() => {});
    }
  };

  // Crear nueva empresa desde el portal
  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompRut.trim() || !newCompName.trim()) {
      alert('RUT y Nombre de Empresa son requeridos.');
      return;
    }

    const compId = 'comp-' + Date.now();
    const newCompany: Company = {
      id: compId,
      rut: newCompRut.trim(),
      name: newCompName.trim(),
      tradeName: newCompTradeName.trim() || newCompName.trim(),
      industry: newCompIndustry.trim() || 'Comercio General',
      phone: newCompPhone.trim(),
      address: newCompAddress.trim(),
      isNaturalPerson: false,
      createdAt: new Date().toISOString()
    };

    await db.companies.put(newCompany);

    // Si especificó un admin inicial para la empresa
    if (newCompAdminUser.trim()) {
      const uClean = newCompAdminUser.trim().toLowerCase();
      const existingUser = await db.users.where('username').equalsIgnoreCase(uClean).first();
      if (!existingUser) {
        await db.users.add({
          username: uClean,
          password: newCompAdminPass.trim() || '123',
          name: `Admin ${newCompany.tradeName}`,
          role: 'ADMIN',
          companyId: compId,
          createdAt: new Date().toISOString()
        });
      }
    }

    await loadMasterData();
    triggerCloudSync();
    syncNow().catch(() => {});
    setIsNewCompanyModalOpen(false);
    // Limpiar formulario
    setNewCompRut('');
    setNewCompName('');
    setNewCompTradeName('');
    setNewCompIndustry('');
    setNewCompPhone('');
    setNewCompAddress('');
    setNewCompAdminUser('');
    setNewCompAdminPass('');
    alert(`¡Empresa ${newCompany.name} creada exitosamente con control total!`);
  };

  // Eliminar empresa
  const handleDeleteCompany = async (comp: Company) => {
    if (companies.length <= 1) {
      alert('Debe existir al menos una empresa en el sistema. Crea otra empresa antes de eliminar esta.');
      return;
    }

    const confirmMsg = `¿ADVERTENCIA: Deseas eliminar permanentemente la empresa "${comp.name}" (${comp.rut})?\n\nSe eliminarán sus usuarios, productos y registros asociados. Esta acción no se puede deshacer.`;
    if (!confirm(confirmMsg)) return;

    try {
      await deleteCompanyWithCascade(comp.id);
      await loadMasterData();
      triggerCloudSync();
      syncNow().catch(() => {});
      alert(`Empresa "${comp.name}" eliminada correctamente.`);
    } catch (err: any) {
      alert('Error al eliminar empresa: ' + err.message);
    }
  };

  // Exportar reporte consolidado en PDF
  const handleExportGlobalReport = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('INFORME CONSOLIDADO DE EMPRESAS — CONTROL SUPERADMIN', 14, 20);
    doc.setFontSize(10);
    doc.text(`Generado por Mauricio Chamorro (@mauricio) - Fecha: ${new Date().toLocaleString('es-CL')}`, 14, 28);
    doc.line(14, 32, 196, 32);

    let y = 40;
    doc.setFontSize(12);
    doc.text('Resumen General de la Plataforma:', 14, y);
    y += 8;
    doc.setFontSize(10);
    doc.text(`• Total de Empresas: ${globalStats.totalCompanies}`, 16, y); y += 6;
    doc.text(`• Total de Usuarios Registrados: ${globalStats.totalUsers} (Admins: ${globalStats.adminCount}, Ventas: ${globalStats.ventasCount}, Bodega: ${globalStats.bodegaCount})`, 16, y); y += 6;
    doc.text(`• Facturación Acumulada: $${globalStats.totalSalesAmount.toLocaleString('es-CL')} CLP`, 16, y); y += 6;
    doc.text(`• Gastos Totales: $${globalStats.totalExpensesAmount.toLocaleString('es-CL')} CLP`, 16, y); y += 6;
    doc.text(`• Margen Operativo Global: $${(globalStats.totalSalesAmount - globalStats.totalExpensesAmount).toLocaleString('es-CL')} CLP`, 16, y); y += 6;
    doc.text(`• Boletas / Facturas Emitidas: ${globalStats.totalDtes}`, 16, y); y += 12;

    doc.setFontSize(12);
    doc.text('Detalle por Empresa:', 14, y);
    y += 8;

    companyAudits.forEach((item, idx) => {
      if (y > 260) {
        doc.addPage();
        y = 20;
      }
      doc.setFontSize(11);
      doc.text(`${idx + 1}. ${item.company.name} (${item.company.rut})`, 16, y);
      y += 5;
      doc.setFontSize(9);
      doc.text(`   Nombre Fantasía: ${item.company.tradeName || 'N/A'} | Giro: ${item.company.industry || 'General'}`, 16, y);
      y += 5;
      doc.text(`   Usuarios: ${item.users.length} (Admins: ${item.adminsCount}, Ventas: ${item.ventasCount}, Bodega: ${item.bodegaCount}) | Personal Operativo: ${item.workers.length}`, 16, y);
      y += 5;
      doc.text(`   Ventas: $${item.salesTotal.toLocaleString('es-CL')} | Gastos: $${item.expensesTotal.toLocaleString('es-CL')} | Margen: $${item.netMargin.toLocaleString('es-CL')} | DTEs: ${item.dteCount}`, 16, y);
      y += 8;
    });

    doc.save(`Informe_Consolidado_SuperAdmin_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div className={`min-h-screen ${themeClasses.bg} ${themeClasses.text} flex flex-col font-sans transition-colors duration-200 overflow-y-auto pb-28`}>
      {/* Top SuperAdmin Master Header: Adaptado responsive y temático */}
      <header className={`sticky top-0 z-50 ${themeClasses.card} border-b ${themeClasses.border} backdrop-blur-md px-3.5 sm:px-6 py-2.5 sm:py-3 shadow-sm`}>
        <div className="max-w-7xl mx-auto space-y-2.5">
          
          {/* Fila 1: Logo, Título, Selector de Tema y Salir */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-tr from-amber-500 via-orange-500 to-rose-600 flex items-center justify-center shadow-md shadow-orange-500/20 shrink-0">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h1 className="text-xs sm:text-sm font-black tracking-tight uppercase text-slate-900 dark:text-slate-100">
                    CONTROL SUPERADMIN
                  </h1>
                  <span className="text-[10px] px-2 py-0.2 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 font-black">
                    Master
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 truncate">
                  Mauricio Chamorro (@mauricio) — Control Total
                </p>
              </div>
            </div>

            {/* Controles de Tema y Logout */}
            <div className="flex items-center gap-1.5 shrink-0">
              <ThemeSelectorMenu />
              <button
                type="button"
                onClick={logout}
                className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-600 dark:text-red-400 text-xs font-black flex items-center gap-1 transition cursor-pointer"
                title="Cerrar Sesión"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Salir</span>
              </button>
            </div>
          </div>

          {/* Fila 2: Barra de acciones rápidas */}
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/60 dark:border-slate-800/60">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsNewCompanyModalOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-xs font-black shadow-sm flex items-center gap-1.5 transition cursor-pointer active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Nueva Empresa</span>
              </button>

              <button
                type="button"
                onClick={loadMasterData}
                title="Refrescar datos"
                className={`p-1.5 rounded-xl border ${themeClasses.border} ${themeClasses.cardSubtle} hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer`}
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-orange-500' : ''}`} />
              </button>

              <button
                type="button"
                onClick={handleExportGlobalReport}
                className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30 text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                title="Descargar Informe Consolidado PDF"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">PDF</span>
              </button>
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[10px] sm:text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-emerald-700 dark:text-emerald-400 font-bold whitespace-nowrap">Cloud Sync 3s</span>
            </div>
          </div>

        </div>
      </header>

      {/* Main Content Dashboard */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-5 space-y-4 sm:space-y-6">
        
        {/* KPI Cards Globales: Adaptadas visualmente al Tema */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
          
          <div className={`p-3 sm:p-4 rounded-2xl border ${themeClasses.border} ${themeClasses.card} relative overflow-hidden shadow-xs`}>
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider">Empresas</span>
              <Building2 className="w-3.5 h-3.5 text-orange-500" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100">{globalStats.totalCompanies}</div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Activas en sistema</p>
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-500" />
          </div>

          <div className={`p-3 sm:p-4 rounded-2xl border ${themeClasses.border} ${themeClasses.card} relative overflow-hidden shadow-xs`}>
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider">Usuarios</span>
              <Users className="w-3.5 h-3.5 text-blue-500" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100">{globalStats.totalUsers}</div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{globalStats.adminCount} Adm / {globalStats.ventasCount} Ventas</p>
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
          </div>

          <div className={`p-3 sm:p-4 rounded-2xl border ${themeClasses.border} ${themeClasses.card} relative overflow-hidden shadow-xs`}>
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider">Ventas Global</span>
              <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
            </div>
            <div className="text-base sm:text-xl font-black text-emerald-600 dark:text-emerald-400 truncate">
              ${globalStats.totalSalesAmount.toLocaleString('es-CL')}
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Todas las empresas</p>
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500" />
          </div>

          <div className={`p-3 sm:p-4 rounded-2xl border ${themeClasses.border} ${themeClasses.card} relative overflow-hidden shadow-xs`}>
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider">Gastos Totales</span>
              <TrendingDown className="w-3.5 h-3.5 text-rose-500" />
            </div>
            <div className="text-base sm:text-xl font-black text-rose-600 dark:text-rose-400 truncate">
              ${globalStats.totalExpensesAmount.toLocaleString('es-CL')}
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Egresos registrados</p>
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-rose-500" />
          </div>

          <div className={`p-3 sm:p-4 rounded-2xl border ${themeClasses.border} ${themeClasses.card} relative overflow-hidden shadow-xs`}>
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider">Boletas / DTE</span>
              <Receipt className="w-3.5 h-3.5 text-purple-500" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-purple-600 dark:text-purple-400">{globalStats.totalDtes}</div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Emitidos</p>
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500" />
          </div>

          <div className={`p-3 sm:p-4 rounded-2xl border ${themeClasses.border} ${themeClasses.card} relative overflow-hidden shadow-xs`}>
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider">Catálogo Total</span>
              <Package className="w-3.5 h-3.5 text-cyan-500" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-cyan-600 dark:text-cyan-400">{globalStats.totalProductsCount}</div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Productos creados</p>
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-500" />
          </div>

        </div>

        {/* Barra de navegación de pestañas del portal */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <button
              type="button"
              onClick={() => setActiveTab('companies')}
              className={`px-3 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === 'companies'
                  ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                  : `${themeClasses.cardSubtle} border ${themeClasses.border} text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white`
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Informes ({companies.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('branding')}
              className={`px-3 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === 'branding'
                  ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                  : `${themeClasses.cardSubtle} border ${themeClasses.border} text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white`
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>Ícono de la App</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('users')}
              className={`px-3 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === 'users'
                  ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                  : `${themeClasses.cardSubtle} border ${themeClasses.border} text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white`
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Personas ({users.filter(u => u.username?.toLowerCase() !== 'mauricio').length})</span>
            </button>
          </div>

          {/* Buscador de empresas */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Buscar por RUT o nombre..."
              className={`w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-orange-500`}
            />
          </div>
        </div>

        {/* PESTAÑA 1: INFORMES Y AUDITORÍA POR EMPRESA */}
        {activeTab === 'companies' && (
          <div className="space-y-4">
            {filteredAudits.length === 0 ? (
              <div className={`p-8 text-center rounded-2xl border ${themeClasses.border} ${themeClasses.cardSubtle}`}>
                <Building2 className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400">No se encontraron empresas con ese criterio.</p>
              </div>
            ) : (
              filteredAudits.map(item => {
                const presetObj = ICON_PRESETS.find(p => p.id === item.company.appIconPreset);
                const PresetIcon = presetObj?.icon || Building2;

                return (
                  <div
                    key={item.company.id}
                    className={`p-4 sm:p-5 rounded-2xl border ${themeClasses.border} ${themeClasses.card} shadow-sm space-y-3.5`}
                  >
                    {/* Header de la Empresa */}
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        
                        {/* Ícono de la Aplicación de esta Empresa */}
                        <div className="relative group shrink-0">
                          {item.company.logoUrl ? (
                            <img
                              src={item.company.logoUrl}
                              alt={item.company.name}
                              className="w-12 h-12 rounded-2xl object-cover border-2 border-orange-500/50 shadow-md bg-white p-0.5"
                            />
                          ) : (
                            <div className={`w-12 h-12 rounded-2xl ${presetObj?.bg || 'bg-blue-600'} flex items-center justify-center shadow-md text-white`}>
                              <PresetIcon className="w-6 h-6 text-white" />
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={() => handleOpenIconModal(item.company)}
                            title="Cambiar ícono de esta empresa"
                            className="absolute -bottom-1 -right-1 p-1 rounded-lg bg-orange-600 hover:bg-orange-500 text-white shadow transition cursor-pointer"
                          >
                            <ImageIcon className="w-3 h-3" />
                          </button>
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-slate-100">
                              {item.company.tradeName || item.company.name}
                            </h2>
                            <span className="text-[10px] font-mono px-2 py-0.2 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold">
                              {item.company.rut}
                            </span>
                            {item.company.id === 'market-almacen' && (
                              <span className="text-[10px] px-2 py-0.2 rounded-md bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 border border-cyan-500/30 font-bold">
                                Empresa Base
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                            Razón Social: <strong className="text-slate-800 dark:text-slate-200">{item.company.name}</strong> • Giro: {item.company.industry || 'Comercio General'}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {item.company.address ? `📍 ${item.company.address}` : 'Sin dirección'} {item.company.phone ? ` • 📞 ${item.company.phone}` : ''}
                          </p>
                        </div>
                      </div>

                      {/* Acciones para la Empresa */}
                      <div className="flex items-center gap-1.5 self-start sm:self-auto">
                        <button
                          type="button"
                          onClick={() => handleOpenIconModal(item.company)}
                          className={`px-2.5 py-1.5 rounded-xl border ${themeClasses.border} ${themeClasses.cardSubtle} text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1 transition cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800`}
                        >
                          <ImageIcon className="w-3.5 h-3.5 text-orange-500" />
                          <span>Ícono App</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setTargetCompanyForUser(item.company);
                            setIsAddUserModalOpen(true);
                          }}
                          className="px-2.5 py-1.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1 transition cursor-pointer"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>+ Usuario</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteCompany(item.company)}
                          className="p-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-500 transition cursor-pointer"
                          title="Eliminar Empresa"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Resumen de Personas y Roles en esta Empresa */}
                    <div className={`p-3 rounded-xl border ${themeClasses.border} ${themeClasses.cardSubtle} space-y-2`}>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5">
                          <Users className="w-4 h-4 text-blue-500" />
                          <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                            Personal y Usuarios ({item.users.length} con acceso / {item.workers.length} trabajadores)
                          </h3>
                        </div>
                        {/* Badges de Roles con wrap garantizado para que nunca se desborden */}
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                          <span className="px-2 py-0.5 rounded-lg bg-blue-500/10 text-blue-700 dark:text-blue-300 font-bold border border-blue-500/20">
                            {item.adminsCount} Admin(s)
                          </span>
                          <span className="px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-500/20">
                            {item.ventasCount} Ventas/Caja
                          </span>
                          <span className="px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300 font-bold border border-amber-500/20">
                            {item.bodegaCount} Bodega
                          </span>
                        </div>
                      </div>

                      {/* Lista de usuarios con botones de acción */}
                      {item.users.length === 0 ? (
                        <p className="text-[11px] text-slate-500 italic pt-1">
                          No hay usuarios registrados en esta empresa. Puedes agregar un Administrador o Cajero con el botón "+ Usuario".
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5 pt-1">
                          {item.users.map(u => (
                            <div
                              key={u.id || u.username}
                              className={`p-2 rounded-xl border ${themeClasses.border} ${themeClasses.card} flex items-center justify-between gap-2 shadow-xs`}
                            >
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{u.name}</p>
                                <div className="flex items-center gap-1 text-[11px] text-slate-500">
                                  <span className="font-mono">@{u.username}</span>
                                  <span>•</span>
                                  <span className={`font-bold ${
                                    u.role === 'ADMIN' ? 'text-blue-600 dark:text-blue-400' :
                                    u.role === 'VENTAS' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                                  }`}>
                                    {u.role}
                                  </span>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleDeleteUser(u)}
                                className="p-1 text-slate-400 hover:text-red-500 transition cursor-pointer"
                                title="Eliminar usuario"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Métricas Financieras y Operativas de la Empresa */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                      <div className={`p-2.5 rounded-xl border ${themeClasses.border} ${themeClasses.cardSubtle}`}>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase block">Ventas Acumuladas</span>
                        <span className="text-xs sm:text-sm font-black text-emerald-600 dark:text-emerald-400">
                          ${item.salesTotal.toLocaleString('es-CL')}
                        </span>
                        <span className="text-[10px] text-slate-500 block">{item.salesCount} ventas</span>
                      </div>

                      <div className={`p-2.5 rounded-xl border ${themeClasses.border} ${themeClasses.cardSubtle}`}>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase block">Gastos Registrados</span>
                        <span className="text-xs sm:text-sm font-black text-rose-600 dark:text-rose-400">
                          ${item.expensesTotal.toLocaleString('es-CL')}
                        </span>
                      </div>

                      <div className={`p-2.5 rounded-xl border ${themeClasses.border} ${themeClasses.cardSubtle}`}>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase block">Margen Neto</span>
                        <span className={`text-xs sm:text-sm font-black ${item.netMargin >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`}>
                          ${item.netMargin.toLocaleString('es-CL')}
                        </span>
                      </div>

                      <div className={`p-2.5 rounded-xl border ${themeClasses.border} ${themeClasses.cardSubtle}`}>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase block">Catálogo y Boletas</span>
                        <span className="text-xs sm:text-sm font-black text-purple-600 dark:text-purple-400">
                          {item.productsCount} prod. / {item.dteCount} DTE
                        </span>
                      </div>
                    </div>

                  </div>
                );
              })
            )}
          </div>
        )}

        {/* PESTAÑA 2: PERSONALIZACIÓN DE ÍCONO Y MARCA */}
        {activeTab === 'branding' && (
          <div className={`p-4 sm:p-6 rounded-2xl border ${themeClasses.border} ${themeClasses.card} space-y-5`}>
            <div>
              <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-orange-500" />
                <span>Personalizar Ícono de la Aplicación por Empresa</span>
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                Aplica a cada empresa el ícono y logo deseado para otorgarle total identidad y pertenencia corporativa.
                Cuando los trabajadores de la empresa usen la app, verán su propio ícono en la barra superior y documentos.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {companies.map(comp => {
                const presetObj = ICON_PRESETS.find(p => p.id === comp.appIconPreset);
                const PresetIcon = presetObj?.icon || Building2;

                return (
                  <div
                    key={comp.id}
                    className={`p-3.5 rounded-2xl border ${themeClasses.border} ${themeClasses.cardSubtle} flex flex-col justify-between space-y-3.5`}
                  >
                    <div className="flex items-center gap-3">
                      {comp.logoUrl ? (
                        <img
                          src={comp.logoUrl}
                          alt={comp.name}
                          className="w-12 h-12 rounded-xl object-contain bg-white p-0.5 border border-slate-300 dark:border-slate-700 shadow"
                        />
                      ) : (
                        <div className={`w-12 h-12 rounded-xl ${presetObj?.bg || 'bg-blue-600'} flex items-center justify-center shadow text-white`}>
                          <PresetIcon className="w-6 h-6 text-white" />
                        </div>
                      )}
                      <div>
                        <h3 className="text-xs font-black text-slate-900 dark:text-slate-100">{comp.tradeName || comp.name}</h3>
                        <p className="text-[11px] font-mono text-slate-500">{comp.rut}</p>
                        <span className="text-[10px] text-orange-600 dark:text-orange-400 font-semibold">
                          {comp.logoUrl ? 'Logo personalizado cargado' : `Ícono: ${presetObj?.label || 'Genérico'}`}
                        </span>
                      </div>
                    </div>

                    {/* Previsualización Navbar simulada */}
                    <div className={`p-2.5 rounded-xl border ${themeClasses.border} ${themeClasses.card} text-[11px]`}>
                      <span className="text-[9px] uppercase font-bold text-slate-500 block mb-1">Vista en Barra Superior (Navbar):</span>
                      <div className="flex items-center gap-2 py-1 px-2 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        {comp.logoUrl ? (
                          <img src={comp.logoUrl} className="w-6 h-6 rounded-md object-contain bg-white p-0.5" />
                        ) : (
                          <div className={`w-6 h-6 rounded-md ${presetObj?.bg || 'bg-blue-600'} flex items-center justify-center text-white`}>
                            <PresetIcon className="w-3.5 h-3.5 text-white" />
                          </div>
                        )}
                        <span className="font-black text-xs text-slate-900 dark:text-slate-100 uppercase truncate">
                          {comp.tradeName || comp.name}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenIconModal(comp)}
                      className="w-full py-2 px-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-black shadow transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <ImageIcon className="w-3.5 h-3.5" />
                      <span>Cambiar Ícono / Logo</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* PESTAÑA 3: GESTIÓN GLOBAL DE PERSONAS Y ROLES */}
        {activeTab === 'users' && (
          <div className={`p-4 sm:p-6 rounded-2xl border ${themeClasses.border} ${themeClasses.card} space-y-4`}>
            <div>
              <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-500" />
                <span>Control Global de Personas y Roles</span>
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                Auditoría completa de todas las personas registradas en las empresas de la aplicación.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase text-[10px] font-black">
                    <th className="py-2.5 px-3">Persona / Nombre</th>
                    <th className="py-2.5 px-3">Usuario</th>
                    <th className="py-2.5 px-3">Empresa Asignada</th>
                    <th className="py-2.5 px-3">Rol</th>
                    <th className="py-2.5 px-3">Fecha Alta</th>
                    <th className="py-2.5 px-3 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {users.filter(u => u.username?.toLowerCase() !== 'mauricio').map(u => {
                    const comp = companies.find(c => c.id === u.companyId);
                    return (
                      <tr key={u.id || u.username} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                        <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-slate-100">{u.name}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-500">@{u.username}</td>
                        <td className="py-2.5 px-3 font-semibold text-slate-700 dark:text-slate-300">
                          {comp ? (comp.tradeName || comp.name) : 'Sin empresa / Global'}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            u.role === 'ADMIN' ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30' :
                            u.role === 'VENTAS' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30' :
                            'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                          }`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-500">{u.createdAt ? new Date(u.createdAt).toLocaleDateString('es-CL') : 'N/A'}</td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleDeleteUser(u)}
                            className="p-1 text-slate-400 hover:text-red-500 transition cursor-pointer"
                            title="Eliminar usuario"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </main>

      {/* MODAL: CAMBIAR ÍCONO DE LA EMPRESA / APP */}
      {isBrandingModalOpen && targetCompanyForIcon && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`max-w-lg w-full rounded-3xl border ${themeClasses.border} ${themeClasses.card} p-5 sm:p-6 space-y-4 shadow-2xl`}>
            
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-orange-500" />
                <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
                  Personalizar Ícono: {targetCompanyForIcon.tradeName || targetCompanyForIcon.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsBrandingModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Previsualización en vivo */}
            <div className={`p-3 rounded-2xl border ${themeClasses.border} ${themeClasses.cardSubtle} flex items-center gap-3.5`}>
              <div className="shrink-0">
                {customLogoDataUrl ? (
                  <img
                    src={customLogoDataUrl}
                    alt="Preview"
                    className="w-12 h-12 rounded-xl object-contain bg-white p-1 border border-slate-300 dark:border-slate-700 shadow"
                  />
                ) : (
                  <div className={`w-12 h-12 rounded-xl ${ICON_PRESETS.find(p => p.id === selectedPresetId)?.bg || 'bg-blue-600'} flex items-center justify-center shadow text-white`}>
                    {(() => {
                      const P = ICON_PRESETS.find(p => p.id === selectedPresetId)?.icon || Building2;
                      return <P className="w-6 h-6 text-white" />;
                    })()}
                  </div>
                )}
              </div>

              <div>
                <span className="text-[10px] text-slate-500 font-bold uppercase block">Previsualización de la Marca</span>
                <p className="text-xs font-black text-slate-900 dark:text-slate-100">{targetCompanyForIcon.tradeName || targetCompanyForIcon.name}</p>
                <p className="text-[11px] text-slate-500">Este ícono se verá en la app móvil y en la web.</p>
              </div>
            </div>

            {/* Opción 1: Subir imagen */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                Opción A: Subir imagen o logo (PNG, JPG, SVG)
              </label>
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex-1 py-2 px-3 rounded-xl border ${themeClasses.border} ${themeClasses.cardSubtle} text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center justify-center gap-2 transition cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800`}
                >
                  <Upload className="w-4 h-4 text-orange-500" />
                  <span>Subir Archivo de Imagen</span>
                </button>
                {customLogoDataUrl && (
                  <button
                    type="button"
                    onClick={() => setCustomLogoDataUrl('')}
                    className="py-2 px-3 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-600 dark:text-red-400 text-xs font-bold transition cursor-pointer"
                  >
                    Quitar
                  </button>
                )}
              </div>
            </div>

            {/* Opción 2: Galería de presets temáticos */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                Opción B: O seleccionar un ícono temático según el rubro
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 max-h-44 overflow-y-auto pr-1">
                {ICON_PRESETS.map(preset => {
                  const Icon = preset.icon;
                  const isSelected = selectedPresetId === preset.id && !customLogoDataUrl;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        setSelectedPresetId(preset.id);
                        setCustomLogoDataUrl('');
                      }}
                      className={`p-2 rounded-xl border flex flex-col items-center gap-1 transition cursor-pointer text-center ${
                        isSelected
                          ? 'border-orange-500 bg-orange-500/20 text-orange-600 dark:text-orange-300 scale-95'
                          : `border-slate-200 dark:border-slate-800 ${themeClasses.cardSubtle} text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white`
                      }`}
                    >
                      <div className={`w-7 h-7 rounded-lg ${preset.bg} flex items-center justify-center text-white`}>
                        <Icon className="w-3.5 h-3.5 text-white" />
                      </div>
                      <span className="text-[10px] font-bold leading-tight line-clamp-1">{preset.label.split('/')[0]}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Botones de acción modal */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsBrandingModalOpen(false)}
                className={`px-3.5 py-2 rounded-xl border ${themeClasses.border} ${themeClasses.cardSubtle} text-xs font-bold text-slate-700 dark:text-slate-300 transition cursor-pointer`}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveCompanyIcon}
                className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-black shadow transition cursor-pointer"
              >
                Guardar Ícono
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL: CREAR NUEVA EMPRESA */}
      {isNewCompanyModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`max-w-lg w-full rounded-3xl border ${themeClasses.border} ${themeClasses.card} p-5 sm:p-6 space-y-4 shadow-2xl`}>
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-orange-500" />
                <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">Crear Nueva Empresa en la Plataforma</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsNewCompanyModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCompany} className="space-y-3">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">RUT Empresa *</label>
                  <input
                    type="text"
                    required
                    placeholder="76.123.456-7"
                    value={newCompRut}
                    onChange={e => setNewCompRut(e.target.value)}
                    className={`w-full px-3 py-2 text-xs rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-slate-900 dark:text-slate-100 focus:outline-none focus:border-orange-500`}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Nombre Fantasía</label>
                  <input
                    type="text"
                    placeholder="Mi Tienda"
                    value={newCompTradeName}
                    onChange={e => setNewCompTradeName(e.target.value)}
                    className={`w-full px-3 py-2 text-xs rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-slate-900 dark:text-slate-100 focus:outline-none focus:border-orange-500`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Razón Social *</label>
                <input
                  type="text"
                  required
                  placeholder="Comercial y Distribuidora Ejemplo SpA"
                  value={newCompName}
                  onChange={e => setNewCompName(e.target.value)}
                  className={`w-full px-3 py-2 text-xs rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-slate-900 dark:text-slate-100 focus:outline-none focus:border-orange-500`}
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Giro Comercial</label>
                  <input
                    type="text"
                    placeholder="Almacén, Panadería..."
                    value={newCompIndustry}
                    onChange={e => setNewCompIndustry(e.target.value)}
                    className={`w-full px-3 py-2 text-xs rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-slate-900 dark:text-slate-100 focus:outline-none focus:border-orange-500`}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Teléfono</label>
                  <input
                    type="text"
                    placeholder="+56 9 1234 5678"
                    value={newCompPhone}
                    onChange={e => setNewCompPhone(e.target.value)}
                    className={`w-full px-3 py-2 text-xs rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-slate-900 dark:text-slate-100 focus:outline-none focus:border-orange-500`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Dirección Casa Matriz</label>
                <input
                  type="text"
                  placeholder="Av. Providencia 1234, Santiago"
                  value={newCompAddress}
                  onChange={e => setNewCompAddress(e.target.value)}
                  className={`w-full px-3 py-2 text-xs rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-slate-900 dark:text-slate-100 focus:outline-none focus:border-orange-500`}
                />
              </div>

              {/* Crear Administrador inicial para la nueva empresa */}
              <div className={`p-3 rounded-2xl border ${themeClasses.border} ${themeClasses.cardSubtle} space-y-2`}>
                <span className="text-[11px] font-bold text-orange-600 dark:text-orange-400 block">
                  👤 Asignar Administrador Inicial para esta Empresa
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Usuario Admin (ej: admin_tienda)"
                    value={newCompAdminUser}
                    onChange={e => setNewCompAdminUser(e.target.value)}
                    className={`px-2.5 py-1.5 text-xs rounded-lg border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-slate-900 dark:text-slate-100`}
                  />
                  <input
                    type="text"
                    placeholder="Contraseña (ej: 123)"
                    value={newCompAdminPass}
                    onChange={e => setNewCompAdminPass(e.target.value)}
                    className={`px-2.5 py-1.5 text-xs rounded-lg border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-slate-900 dark:text-slate-100`}
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsNewCompanyModalOpen(false)}
                  className={`px-3.5 py-2 rounded-xl border ${themeClasses.border} ${themeClasses.cardSubtle} text-xs font-bold text-slate-700 dark:text-slate-300 transition cursor-pointer`}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-black shadow transition cursor-pointer"
                >
                  Crear Empresa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: AGREGAR USUARIO A UNA EMPRESA ESPECÍFICA */}
      {isAddUserModalOpen && targetCompanyForUser && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`max-w-md w-full rounded-3xl border ${themeClasses.border} ${themeClasses.card} p-5 sm:p-6 space-y-3.5 shadow-2xl`}>
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-blue-500" />
                <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
                  Agregar Persona a {targetCompanyForUser.tradeName || targetCompanyForUser.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddUserModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateUserForCompany} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Nombre Completo *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Juan Pérez"
                  value={newUserName}
                  onChange={e => setNewUserName(e.target.value)}
                  className={`w-full px-3 py-2 text-xs rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-slate-900 dark:text-slate-100 focus:outline-none focus:border-orange-500`}
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Nombre de Usuario *</label>
                  <input
                    type="text"
                    required
                    placeholder="juanp"
                    value={newUserUsername}
                    onChange={e => setNewUserUsername(e.target.value)}
                    className={`w-full px-3 py-2 text-xs rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-slate-900 dark:text-slate-100 focus:outline-none focus:border-orange-500`}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Contraseña</label>
                  <input
                    type="text"
                    placeholder="123"
                    value={newUserPassword}
                    onChange={e => setNewUserPassword(e.target.value)}
                    className={`w-full px-3 py-2 text-xs rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-slate-900 dark:text-slate-100 focus:outline-none focus:border-orange-500`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Rol en la Empresa *</label>
                <select
                  value={newUserRole}
                  onChange={e => setNewUserRole(e.target.value as UserRole)}
                  className={`w-full px-3 py-2 text-xs rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-slate-900 dark:text-slate-100 focus:outline-none focus:border-orange-500`}
                >
                  <option value="ADMIN">ADMIN — Administrador de la Empresa</option>
                  <option value="VENTAS">VENTAS — Cajero y Punto de Venta</option>
                  <option value="BODEGA">BODEGA — Bodeguero e Inventario</option>
                  <option value="CUSTOM">CUSTOM — Personalizado</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddUserModalOpen(false)}
                  className={`px-3.5 py-2 rounded-xl border ${themeClasses.border} ${themeClasses.cardSubtle} text-xs font-bold text-slate-700 dark:text-slate-300 transition cursor-pointer`}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black shadow transition cursor-pointer"
                >
                  Crear y Guardar Usuario
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
