import React, { createContext, useContext, useState, useEffect } from 'react';
import type { AppUser, UserRole, UserPermissions } from '../types';
import { getUserPermissions, DEFAULT_PERMISSIONS_BY_ROLE } from '../types';
import { db } from '../db/database';
import { triggerCloudSync, pullAllFromCloud, pushAllToCloud } from './cloudSync';

interface AuthContextType {
  currentUser: AppUser | null;
  isAuthenticated: boolean;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isVentas: boolean;
  isBodega: boolean;
  permissions: UserPermissions;
  isReadOnly: boolean;
  canManageUsers: boolean;
  canManageCompanies: boolean;
  canExportImport: boolean;
  canDeleteProducts: boolean;
  login: (username: string, password?: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  usersList: AppUser[];
  loadUsers: () => Promise<void>;
  createUser: (user: Omit<AppUser, 'id' | 'createdAt'>) => Promise<boolean>;
  updateUser: (id: number, userData: Partial<AppUser>) => Promise<boolean>;
  deleteUser: (id: number) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Superadmin maestro Mauricio (Acceso y control total global)
const DEFAULT_SUPERADMIN: AppUser = {
  username: 'mauricio',
  password: '041118',
  name: 'Mauricio Chamorro',
  role: 'SUPERADMIN',
  companyId: 'market-almacen',
  createdAt: new Date().toISOString()
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => {
    const saved = localStorage.getItem('marketalmacen_logged_user');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.username?.toLowerCase() === 'mauricio') {
          return {
            ...parsed,
            username: 'mauricio',
            role: 'SUPERADMIN',
            companyId: 'market-almacen'
          };
        }
        return parsed;
      } catch {
        return null;
      }
    }
    return null;
  });

  const [usersList, setUsersList] = useState<AppUser[]>([]);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const all = await db.users.toArray();
      setUsersList(all);
    } catch (e) {
      console.warn('Error loading users:', e);
    }
  };

  const login = async (username: string, password?: string): Promise<{ success: boolean; message?: string }> => {
    const uClean = username.trim().toLowerCase();
    const pClean = password?.trim() || '';

    // Autenticación Mauricio Superadmin
    if (uClean === 'mauricio') {
      if (pClean === '041118') {
        const superUser: AppUser = {
          ...DEFAULT_SUPERADMIN,
          name: 'Mauricio Chamorro (Encargado)'
        };
        setCurrentUser(superUser);
        localStorage.setItem('marketalmacen_logged_user', JSON.stringify(superUser));
        return { success: true };
      } else {
        return { success: false, message: 'Contraseña de Superadministrador incorrecta' };
      }
    }

    // Autenticación de usuarios creados en la base de datos
    try {
      const found = await db.users.where('username').equalsIgnoreCase(uClean).first();
      if (!found) {
        return { success: false, message: 'Usuario no encontrado en el sistema' };
      }
      if (found.password && found.password !== pClean) {
        return { success: false, message: 'Contraseña incorrecta' };
      }

      setCurrentUser(found);
      localStorage.setItem('marketalmacen_logged_user', JSON.stringify(found));
      return { success: true };
    } catch (err: any) {
      return { success: false, message: 'Error al iniciar sesión: ' + err.message };
    }
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem('marketalmacen_logged_user');
  };

  const createUser = async (userData: Omit<AppUser, 'id' | 'createdAt'>): Promise<boolean> => {
    try {
      const existing = await db.users.where('username').equalsIgnoreCase(userData.username.trim()).first();
      if (existing || userData.username.trim().toLowerCase() === 'mauricio') {
        alert('El nombre de usuario ya existe. Elija otro.');
        return false;
      }

      await db.users.add({
        ...userData,
        username: userData.username.trim().toLowerCase(),
        createdAt: new Date().toISOString()
      });

      await loadUsers();
      triggerCloudSync();
      return true;
    } catch (e: any) {
      alert('Error al crear usuario: ' + e.message);
      return false;
    }
  };

  const deleteUser = async (id: number): Promise<boolean> => {
    try {
      await db.users.delete(id);
      await loadUsers();
      triggerCloudSync();
      return true;
    } catch (e: any) {
      alert('Error al eliminar usuario: ' + e.message);
      return false;
    }
  };

  const updateUser = async (id: number, userData: Partial<AppUser>): Promise<boolean> => {
    try {
      await db.users.update(id, userData);
      await loadUsers();
      if (currentUser?.id === id) {
        const updated = { ...currentUser, ...userData };
        setCurrentUser(updated);
        localStorage.setItem('marketalmacen_logged_user', JSON.stringify(updated));
      }
      triggerCloudSync();
      return true;
    } catch (e: any) {
      alert('Error al actualizar usuario: ' + e.message);
      return false;
    }
  };

  const permissions: UserPermissions = getUserPermissions(currentUser);
  const isSuperAdmin = currentUser?.role === 'SUPERADMIN';
  const isAdmin = isSuperAdmin || currentUser?.role === 'ADMIN';
  const isVentas = currentUser?.role === 'VENTAS';
  const isBodega = currentUser?.role === 'BODEGA';
  const isReadOnly = false;
  const canManageUsers = isSuperAdmin || currentUser?.role === 'ADMIN' || permissions.manageUsers;
  const canManageCompanies = isSuperAdmin;
  const canExportImport = isSuperAdmin || currentUser?.role === 'ADMIN' || permissions.inventory;
  const canDeleteProducts = isSuperAdmin || currentUser?.role === 'ADMIN';

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated: !!currentUser,
        isSuperAdmin,
        isAdmin,
        isVentas,
        isBodega,
        permissions,
        isReadOnly,
        canManageUsers,
        canManageCompanies,
        canExportImport,
        canDeleteProducts,
        login,
        logout,
        usersList,
        loadUsers,
        createUser,
        updateUser,
        deleteUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
