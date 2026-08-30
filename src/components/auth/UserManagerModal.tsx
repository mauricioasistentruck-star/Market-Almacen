import { useBodyScrollLock } from '../../utils/scrollLock';
import React, { useState, useEffect } from 'react';
import type { AppUser, UserRole } from '../../types';
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
  AlertCircle
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
    deleteUser
  } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>('ADMIN');
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
    }
  }, [isOpen]);

  if (!isOpen) return null;

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
      const ok = await createUser({
        username: username.trim().toLowerCase(),
        password: password.trim() || undefined,
        name: name.trim(),
        role,
        companyId: companyToAssign
      });

      if (ok) {
        setSuccess(`Usuario "${username}" registrado exitosamente.`);
        setUsername('');
        setPassword('');
        setName('');
        setRole('ADMIN');
      }
    } catch (err: any) {
      setError(err?.message || 'Error al crear usuario');
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
    }
  };

  // Filtrado de usuarios visibles seguro con null-checks
  const visibleUsers = (usersList || []).filter((u) => {
    if (!u) return false;
    const uName = (u.username || '').toLowerCase();
    
    // Si no es superadmin, solo ve usuarios de su empresa y mauricio está oculto
    if (!isSuperAdmin) {
      const myCompId = currentUser?.companyId || selectedCompanyId;
      return (
        u.companyId === myCompId &&
        u.role !== 'SUPERADMIN' &&
        uName !== 'mauricio'
      );
    }

    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className={`w-full max-w-4xl max-h-[90vh] rounded-3xl border ${themeClasses?.border || 'border-slate-200'} ${themeClasses?.card || 'bg-white'} shadow-2xl flex flex-col justify-between overflow-hidden animate-scaleIn`}>
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-md ${themeClasses?.accentBg || 'bg-blue-600'}`}>
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>Gestión de Usuarios y Personal</span>
                {isSuperAdmin && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/30 flex items-center gap-1">
                    <Crown className="w-3 h-3" />
                    SUPERADMIN
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Crea y administra las cuentas de acceso para Administradores y Cajeros
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-6 overflow-y-auto max-h-[calc(90vh-140px)] custom-scrollbar">
          
          {error && (
            <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {/* Formulario de Registro de Usuario */}
          <form onSubmit={handleSubmit} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-3">
            <h4 className="font-black text-xs sm:text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-blue-500" />
              <span>Registrar Nuevo Usuario</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Nombre Completo *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: Juan Pérez"
                  className={`w-full px-3 py-2 text-xs rounded-xl border ${themeClasses?.inputBorder || 'border-slate-300'} ${themeClasses?.inputBg || 'bg-white'} font-medium text-slate-900 dark:text-slate-100`}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Nombre de Usuario *
                </label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Ej: juanperez"
                  className={`w-full px-3 py-2 text-xs rounded-xl border ${themeClasses?.inputBorder || 'border-slate-300'} ${themeClasses?.inputBg || 'bg-white'} font-medium text-slate-900 dark:text-slate-100`}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Contraseña *
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={`w-full px-3 py-2 text-xs rounded-xl border ${themeClasses?.inputBorder || 'border-slate-300'} ${themeClasses?.inputBg || 'bg-white'} font-medium text-slate-900 dark:text-slate-100`}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Rol / Permisos *
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="ADMIN">Administrador (Acceso total a todos los menús)</option>
                  <option value="VENTAS">Ventas y POS (Ventas y Cobro en Caja)</option>
                </select>
              </div>
            </div>

            {/* Asignación de Empresa (Solo visible si es Superadmin) */}
            {isSuperAdmin && companies && companies.length > 0 && (
              <div className="pt-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-blue-500" />
                  <span>Empresa Asignada *</span>
                </label>
                <select
                  value={targetCompanyId}
                  onChange={(e) => setTargetCompanyId(e.target.value)}
                  className="w-full sm:w-1/2 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.rut})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className={`flex items-center gap-2 px-5 py-2.5 text-xs font-black rounded-xl text-white shadow-md ${themeClasses?.accentBg || 'bg-blue-600'} hover:opacity-90 transition active:scale-95`}
              >
                <UserPlus className="w-4 h-4" />
                <span>Registrar Personal</span>
              </button>
            </div>
          </form>

          {/* Tabla de Usuarios Registrados */}
          <div className="space-y-3">
            <h4 className="font-black text-xs sm:text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>Personal Registrado ({visibleUsers.length})</span>
            </h4>

            <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800/80 text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    <th className="p-3">Nombre</th>
                    <th className="p-3">Usuario</th>
                    <th className="p-3">Rol / Permisos</th>
                    <th className="p-3">Empresa</th>
                    <th className="p-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs font-medium">
                  {visibleUsers.map((u) => {
                    const uName = (u.username || '').toLowerCase();
                    const isSuper = u.role === 'SUPERADMIN' || uName === 'mauricio';
                    const comp = (companies || []).find((c) => c && c.id === u.companyId);

                    return (
                      <tr key={u.id || u.username} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                        <td className="p-3 font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-blue-600/20 text-blue-600 font-black flex items-center justify-center text-xs shrink-0">
                            {u.name?.charAt(0).toUpperCase() || 'U'}
                          </div>
                          <span>{u.name || u.username}</span>
                        </td>
                        <td className="p-3 font-mono text-slate-600 dark:text-slate-400 font-bold">
                          @{u.username}
                        </td>
                        <td className="p-3">
                          {isSuper ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/30 flex items-center gap-1 w-fit">
                              <Crown className="w-3 h-3" />
                              SUPERADMIN
                            </span>
                          ) : u.role === 'ADMIN' ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30 flex items-center gap-1 w-fit">
                              <ShieldCheck className="w-3 h-3" />
                              ADMINISTRADOR
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1 w-fit">
                              <ShieldCheck className="w-3 h-3" />
                              VENTAS Y POS
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-slate-600 dark:text-slate-400">
                          {comp ? comp.name : u.companyId === 'ALL' ? 'Global (Todas)' : 'Market Almacén'}
                        </td>
                        <td className="p-3 text-right">
                          {!isSuper && (
                            <button
                              type="button"
                              onClick={() => handleDelete(u)}
                              className="p-1.5 rounded-lg text-red-500 hover:bg-red-500/10 transition"
                              title="Eliminar usuario"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
