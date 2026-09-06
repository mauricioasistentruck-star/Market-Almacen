import { useBodyScrollLock } from '../../utils/scrollLock';
import React, { useState, useEffect } from 'react';
import type { AppUser, UserRole, UserPermissions } from '../../types';
import { DEFAULT_PERMISSIONS_BY_ROLE, getUserPermissions } from '../../types';
import { useTheme } from '../../utils/themeContext';
import { useCompany } from '../../utils/companyContext';
import { useAuth } from '../../utils/authContext';
import {
  X,
  UserPlus,
  Trash2,
  ShieldCheck,
  Users,
  Building2,
  Crown,
  AlertCircle,
  Edit2,
  CheckSquare,
  Square,
  Sliders,
  Sparkles,
  ShoppingBag,
  Package,
  Shield
} from 'lucide-react';

interface UserManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UserManagerModal: React.FC<UserManagerModalProps> = ({
  isOpen,
  onClose
}) => {
  useBodyScrollLock(Boolean(isOpen));
  const { themeClasses } = useTheme();
  const { companies = [], selectedCompanyId } = useCompany();
  const {
    currentUser,
    isSuperAdmin,
    usersList = [],
    loadUsers,
    createUser,
    updateUser,
    deleteUser
  } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>('VENTAS');
  const [permissions, setPermissions] = useState<UserPermissions>(DEFAULT_PERMISSIONS_BY_ROLE.VENTAS);
  const [showCustomPermissions, setShowCustomPermissions] = useState(false);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);

  const [targetCompanyId, setTargetCompanyId] = useState<string>(
    selectedCompanyId && selectedCompanyId !== 'ALL' ? selectedCompanyId : 'market-almacen'
  );
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadUsers().catch((err) => console.warn('Error loading users:', err));
      setError('');
      setSuccess('');
      handleResetForm();
    }
  }, [isOpen]);

  const handleResetForm = () => {
    setUsername('');
    setPassword('');
    setName('');
    setRole('VENTAS');
    setPermissions(DEFAULT_PERMISSIONS_BY_ROLE.VENTAS);
    setShowCustomPermissions(false);
    setEditingUserId(null);
  };

  if (!isOpen) return null;

  const handleSelectRolePreset = (newRole: UserRole) => {
    setRole(newRole);
    setPermissions({ ...DEFAULT_PERMISSIONS_BY_ROLE[newRole] });
    if (newRole === 'CUSTOM') {
      setShowCustomPermissions(true);
    }
  };

  const handleTogglePermission = (key: keyof UserPermissions) => {
    setRole('CUSTOM');
    setPermissions(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleStartEdit = (user: AppUser) => {
    setEditingUserId(user.id || null);
    setUsername(user.username);
    setPassword('');
    setName(user.name);
    setRole(user.role);
    setPermissions(getUserPermissions(user));
    setTargetCompanyId(user.companyId || selectedCompanyId || 'market-almacen');
    setShowCustomPermissions(user.role === 'CUSTOM' || Boolean(user.permissions));
    setError('');
    setSuccess('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!username.trim() || !name.trim()) {
      setError('Por favor complete todos los campos obligatorios');
      return;
    }

    const companyToAssign = isSuperAdmin
      ? targetCompanyId
      : currentUser?.companyId || selectedCompanyId || 'market-almacen';

    try {
      if (editingUserId) {
        // Actualizar usuario existente
        const ok = await updateUser(editingUserId, {
          name: name.trim(),
          password: password.trim() ? password.trim() : undefined,
          role,
          permissions,
          companyId: companyToAssign
        });

        if (ok) {
          setSuccess(`Usuario "${username}" actualizado exitosamente.`);
          handleResetForm();
        }
      } else {
        // Crear nuevo usuario
        const ok = await createUser({
          username: username.trim().toLowerCase(),
          password: password.trim() || undefined,
          name: name.trim(),
          role,
          permissions,
          companyId: companyToAssign
        });

        if (ok) {
          setSuccess(`Usuario "${username}" registrado exitosamente.`);
          handleResetForm();
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Error al guardar usuario');
    }
  };

  const handleDelete = async (user: AppUser) => {
    if (!user || !user.id) return;
    const uName = (user.username || '').toLowerCase();
    if (user.role === 'SUPERADMIN' || uName === 'mauricio') {
      alert('El Super Administrador no puede ser eliminado.');
      return;
    }

    if (window.confirm(`¿Eliminar el usuario "${user.name || user.username}"?`)) {
      await deleteUser(user.id);
      setSuccess('Usuario eliminado correctamente.');
      if (editingUserId === user.id) handleResetForm();
    }
  };

  // Filtrado de usuarios visibles seguro con null-checks
    const visibleUsers = (usersList || []).filter((u) => {
    if (!u) return false;
    const uName = (u.username || '').toLowerCase();
    // Mauricio es SuperAdmin invisible: NADIE debe ver su existencia en las listas de usuarios
    if (uName === 'mauricio' || u.role === 'SUPERADMIN') return false;

    if (!isSuperAdmin) {
      const myCompId = currentUser?.companyId || selectedCompanyId;
      return u.companyId === myCompId;
    }
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className={`w-full max-w-4xl max-h-[92vh] rounded-3xl border ${themeClasses?.border || 'border-slate-200'} ${themeClasses?.card || 'bg-white'} shadow-2xl flex flex-col justify-between overflow-hidden animate-scaleIn`}>
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-md ${themeClasses?.accentBg || 'bg-blue-600'}`}>
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>Gestión de Personal y Permisos Móviles</span>
                {isSuperAdmin && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/30 flex items-center gap-1">
                    <Crown className="w-3 h-3" />
                    SUPERADMIN
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Personaliza qué menús y accesos ve cada trabajador en su celular y en el computador
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body: Scrollable */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
          
          {/* Alertas */}
          {error && (
            <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {/* Formulario de Creación / Edición */}
          <form onSubmit={handleSubmit} className="p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 tracking-wider flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-blue-600" />
                <span>{editingUserId ? 'Editar Usuario y Permisos' : 'Crear Nuevo Personal'}</span>
              </h4>
              {editingUserId && (
                <button
                  type="button"
                  onClick={handleResetForm}
                  className="text-xs font-black text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  Cancelar Edición (+ Crear Nuevo)
                </button>
              )}
            </div>

            {/* Inputs Básicos */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 block">
                  Nombre Completo *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Ana Morales"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={`w-full px-3 py-2 text-xs font-medium rounded-xl border ${themeClasses?.inputBorder || 'border-slate-300'} ${themeClasses?.inputBg || 'bg-white'} focus:outline-none focus:ring-2 focus:ring-blue-500`}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 block">
                  Usuario (Login) *
                </label>
                <input
                  type="text"
                  required
                  disabled={Boolean(editingUserId)}
                  placeholder="Ej: ana.caja"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className={`w-full px-3 py-2 text-xs font-medium rounded-xl border ${themeClasses?.inputBorder || 'border-slate-300'} ${themeClasses?.inputBg || 'bg-white'} focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50`}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 block">
                  Contraseña {editingUserId ? '(Dejar vacía para no cambiar)' : '*'}
                </label>
                <input
                  type="password"
                  placeholder={editingUserId ? '•••••••• (sin cambios)' : 'Contraseña de acceso'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`w-full px-3 py-2 text-xs font-medium rounded-xl border ${themeClasses?.inputBorder || 'border-slate-300'} ${themeClasses?.inputBg || 'bg-white'} focus:outline-none focus:ring-2 focus:ring-blue-500`}
                />
              </div>
            </div>

            {/* Selector de Plantilla de Rol Rápida */}
            <div>
              <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5 block">
                Plantilla de Rol para Celular y PC:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                
                {/* Cajera */}
                <button
                  type="button"
                  onClick={() => handleSelectRolePreset('VENTAS')}
                  className={`p-2.5 rounded-xl border-2 text-left transition flex items-center gap-2 cursor-pointer ${
                    role === 'VENTAS'
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-100 font-black shadow-xs'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <ShoppingBag className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div className="min-w-0">
                    <span className="text-xs block truncate font-black">Caja / Ventas</span>
                    <span className="text-[10px] text-slate-500 block truncate">POS, Cobro y Stock</span>
                  </div>
                </button>

                {/* Bodeguero */}
                <button
                  type="button"
                  onClick={() => handleSelectRolePreset('BODEGA')}
                  className={`p-2.5 rounded-xl border-2 text-left transition flex items-center gap-2 cursor-pointer ${
                    role === 'BODEGA'
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-950 dark:text-blue-100 font-black shadow-xs'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <Package className="w-4 h-4 text-blue-600 shrink-0" />
                  <div className="min-w-0">
                    <span className="text-xs block truncate font-black">Bodeguero</span>
                    <span className="text-[10px] text-slate-500 block truncate">Stock, Guías y Mermas</span>
                  </div>
                </button>

                {/* Administrador */}
                <button
                  type="button"
                  onClick={() => handleSelectRolePreset('ADMIN')}
                  className={`p-2.5 rounded-xl border-2 text-left transition flex items-center gap-2 cursor-pointer ${
                    role === 'ADMIN'
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/40 text-purple-950 dark:text-purple-100 font-black shadow-xs'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <Shield className="w-4 h-4 text-purple-600 shrink-0" />
                  <div className="min-w-0">
                    <span className="text-xs block truncate font-black">Administrador</span>
                    <span className="text-[10px] text-slate-500 block truncate">Control Total</span>
                  </div>
                </button>

                {/* Personalizado */}
                <button
                  type="button"
                  onClick={() => { setRole('CUSTOM'); setShowCustomPermissions(true); }}
                  className={`p-2.5 rounded-xl border-2 text-left transition flex items-center gap-2 cursor-pointer ${
                    role === 'CUSTOM'
                      ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-950 dark:text-amber-100 font-black shadow-xs'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <Sliders className="w-4 h-4 text-amber-600 shrink-0" />
                  <div className="min-w-0">
                    <span className="text-xs block truncate font-black">Personalizado</span>
                    <span className="text-[10px] text-slate-500 block truncate">Elegir Casillas</span>
                  </div>
                </button>

              </div>
            </div>

            {/* Asignación de Empresa (Si es Superadmin) */}
            {isSuperAdmin && (
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 block">
                  Empresa o Sucursal Asignada:
                </label>
                <select
                  value={targetCompanyId}
                  onChange={(e) => setTargetCompanyId(e.target.value)}
                  className={`w-full px-3 py-2 text-xs font-bold rounded-xl border ${themeClasses?.inputBorder || 'border-slate-300'} ${themeClasses?.inputBg || 'bg-white'} focus:outline-none`}
                >
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.tradeName || c.name} ({c.rut})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Desplegable de Permisos Granulares */}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowCustomPermissions(!showCustomPermissions)}
                className="text-xs font-black text-blue-600 dark:text-blue-400 flex items-center gap-1.5 cursor-pointer hover:underline"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>{showCustomPermissions ? 'Ocultar Casillas de Permisos' : 'Personalizar Permisos y Menús Específicos (+)'}</span>
              </button>

              {showCustomPermissions && (
                <div className="mt-3 p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2.5">
                  <p className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                    Marca qué menús y herramientas puede ver este usuario en el celular:
                  </p>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {[
                      { key: 'pos', label: '🛒 POS de Ventas' },
                      { key: 'priceConsultant', label: '🔍 Consultor Precios' },
                      { key: 'inventory', label: '📦 Catálogo / Stock' },
                      { key: 'productHistory', label: '🔄 Historial / Kardex' },
                      { key: 'guides', label: '📄 Guías de Despacho' },
                      { key: 'purchases', label: '📋 Solicitud Stock' },
                      { key: 'mermas', label: '⚠️ Registro Mermas' },
                      { key: 'cashClosing', label: '🔒 Cierre de Caja (Z)' },
                      { key: 'reports', label: '📊 Informes Ventas' },
                      { key: 'suppliers', label: '🚚 Proveedores' },
                      { key: 'customers', label: '🏢 Clientes Factura' },
                      { key: 'inventoryTaking', label: '📝 Toma Inventario' },
                      { key: 'cafFolios', label: '📑 Folios CAF SII' },
                      { key: 'cloudSync', label: '☁️ Sincronización Nube' },
                      { key: 'backup', label: '💾 Copia Respaldo' },
                      { key: 'manageUsers', label: '👥 Gestionar Usuarios' },
                    ].map((item) => {
                      const isChecked = Boolean(permissions[item.key as keyof UserPermissions]);
                      return (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => handleTogglePermission(item.key as keyof UserPermissions)}
                          className={`p-2 rounded-xl text-left text-xs font-bold border transition flex items-center justify-between cursor-pointer ${
                            isChecked
                              ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-500 text-blue-950 dark:text-blue-100 font-black'
                              : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-500 opacity-70'
                          }`}
                        >
                          <span className="truncate">{item.label}</span>
                          {isChecked ? (
                            <CheckSquare className="w-4 h-4 text-blue-600 shrink-0 ml-1" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400 shrink-0 ml-1" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Botón Submit */}
            <div className="flex justify-end gap-2 pt-2">
              {editingUserId && (
                <button
                  type="button"
                  onClick={handleResetForm}
                  className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
              )}
              <button
                type="submit"
                className="px-5 py-2.5 text-xs font-black text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-md active:scale-95 transition cursor-pointer"
              >
                {editingUserId ? 'Guardar Cambios de Usuario' : 'Registrar Nuevo Usuario'}
              </button>
            </div>
          </form>

          {/* Listado de Usuarios Existentes */}
          <div className="space-y-3">
            <h4 className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 tracking-wider">
              Personal Registrado ({visibleUsers.length}):
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {visibleUsers.map((u) => {
                const isSuper = u.role === 'SUPERADMIN' || (u.username || '').toLowerCase() === 'mauricio';
                const userCompany = companies.find((c) => c.id === u.companyId);
                const roleBadge = u.role === 'VENTAS' ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                  : u.role === 'BODEGA' ? 'bg-blue-100 text-blue-800 border-blue-300'
                  : u.role === 'ADMIN' ? 'bg-purple-100 text-purple-800 border-purple-300'
                  : 'bg-amber-100 text-amber-800 border-amber-300';

                return (
                  <div
                    key={u.id || u.username}
                    className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-black shadow-xs shrink-0 ${
                        isSuper ? 'bg-purple-600' : u.role === 'BODEGA' ? 'bg-blue-600' : u.role === 'ADMIN' ? 'bg-purple-600' : 'bg-emerald-600'
                      }`}>
                        {u.name?.charAt(0).toUpperCase() || 'U'}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h5 className="text-xs font-black text-slate-900 dark:text-slate-100 truncate">
                            {u.name}
                          </h5>
                          <span className={`text-[9.5px] font-black px-2 py-0.2 rounded-full border ${roleBadge}`}>
                            {u.role === 'VENTAS' ? 'Cajera' : u.role === 'BODEGA' ? 'Bodeguero' : u.role === 'ADMIN' ? 'Admin' : 'Personalizado'}
                          </span>
                        </div>
                        <p className="text-[11px] font-mono text-slate-500 truncate">
                          @{u.username} • {userCompany?.tradeName || userCompany?.name || 'Bodega'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {!isSuper && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleStartEdit(u)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded-lg transition cursor-pointer"
                            title="Editar usuario y permisos"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(u)}
                            className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg transition cursor-pointer"
                            title="Eliminar usuario"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-xs font-black text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
};
