/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import localforage from 'localforage';
import { syncToDb, loadFromDbOrIndexedDB } from './syncUtils';
import { User, UserRole } from './types';

// ─── Context Type ─────────────────────────────────────────────────────────────
interface AppContextType {
  user: User | null;
  users: User[];
  isLoading: boolean;
  login: (email: string, password: string) => boolean;
  loginAs: (userId: string) => void;
  setAuthUser: (user: User) => void;
  logout: () => void;
  addUser: (userData: Omit<User, 'id'>) => void;
  updateUser: (id: string, updates: Partial<User>) => void;
  deleteUser: (id: string) => void;
  sidebarPermissions: Record<UserRole, string[]>;
  updatePermissions: (role: UserRole, permissions: string[]) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// ─── Provider ─────────────────────────────────────────────────────────────────
export function AppProvider({ children }: { children: React.ReactNode }) {
  const [users, setUsers] = useState<User[]>([]);
  const [sidebarPermissions, setSidebarPermissions] = useState<Record<UserRole, string[]>>({} as any);

  const [user, setUser] = useState<User | null>(null);
  const [isLoading] = useState(false);

  // Persistence
  useEffect(() => {
    if (users.length > 0) syncToDb('poultry_users', users);
  }, [users]);

  useEffect(() => {
    if (Object.keys(sidebarPermissions).length > 0) syncToDb('poultry_permissions', sidebarPermissions);
  }, [sidebarPermissions]);

  useEffect(() => {
    if (user) {
      localforage.setItem('poultry_session', user);
    } else {
      localforage.removeItem('poultry_session');
    }
  }, [user]);

  useEffect(() => {
    loadFromDbOrIndexedDB('poultry_users', setUsers);
    loadFromDbOrIndexedDB('poultry_permissions', (data) => {
      // Provide defaults if DB is empty
      if (!data || Object.keys(data).length === 0) {
        setSidebarPermissions({
          [UserRole.SUPER_ADMIN]: ['dashboard', 'production', 'population', 'feedFormulation', 'vaccine', 'sales', 'inventory', 'finance', 'workers', 'settings'],
          [UserRole.ADMIN]: ['dashboard', 'production', 'population', 'feedFormulation', 'vaccine', 'sales', 'inventory'],
          [UserRole.WORKER]: ['production', 'population', 'vaccine'],
        });
      } else {
        setSidebarPermissions(data);
      }
    });

    localforage.getItem<User>('poultry_session').then(savedUser => {
      if (savedUser) {
        setUser(savedUser);
      } else {
        // Fallback to localStorage if rememberMe was true
        const remembered = localStorage.getItem('poultry_remember') === 'true';
        if (remembered) {
          const saved = localStorage.getItem('poultry_session');
          if (saved) setUser(JSON.parse(saved));
        }
      }
    });
  }, []);

  // Migration for new tabs
  React.useEffect(() => {
    const defaultPerms = {
      [UserRole.SUPER_ADMIN]: ['dashboard', 'production', 'population', 'feedFormulation', 'vaccine', 'sales', 'inventory', 'finance', 'workers', 'settings'],
      [UserRole.ADMIN]: ['dashboard', 'production', 'population', 'feedFormulation', 'vaccine', 'sales', 'inventory'],
      [UserRole.WORKER]: ['production', 'population', 'vaccine'],
    };

    let needsUpdate = false;
    const currentPerms = { ...sidebarPermissions };

    Object.keys(defaultPerms).forEach((role) => {
      const r = role as UserRole;
      if (defaultPerms[r].some(p => !currentPerms[r]?.includes(p))) {
        currentPerms[r] = Array.from(new Set([...(currentPerms[r] || []), ...defaultPerms[r]]));
        needsUpdate = true;
      }
    });

    if (needsUpdate) {
      setSidebarPermissions(currentPerms);
    }
  }, []);


  const login = (email: string, password: string, rememberMe: boolean = false): boolean => {
    const found = users.find(
      u => u.email.toLowerCase() === email.toLowerCase() && u.password === password
    );
    if (found) {
      const { password: _, ...safeUser } = found;
      setUser(safeUser as User);
      if (rememberMe) {
        localStorage.setItem('poultry_session', JSON.stringify(safeUser));
        localStorage.setItem('poultry_remember', 'true');
      } else {
        localStorage.removeItem('poultry_remember');
      }
      return true;
    }
    return false;
  };

  const loginAs = (userId: string) => {
    const found = users.find(u => u.id === userId);
    if (found) {
      const { password: _, ...safeUser } = found;
      setUser(safeUser as User);
    }
  };

  const setAuthUser = (loggedInUser: User) => {
    setUser(loggedInUser);
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('poultry_session');
    localStorage.removeItem('poultry_remember');
  };

  const addUser = (userData: Omit<User, 'id'>) => {
    const newUser = { ...userData, id: `u${Date.now()}` };
    setUsers(prev => [...prev, newUser as User]);
  };

  const updateUser = (id: string, updates: Partial<User>) => {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, ...updates } : u));
    if (user?.id === id) {
      const updatedUser = { ...user, ...updates };
      setUser(updatedUser);
    }
  };

  const deleteUser = (id: string) => {
    setUsers(prev => prev.filter(u => u.id !== id));
    if (user?.id === id) logout();
  };

  const updatePermissions = (role: UserRole, permissions: string[]) => {
    setSidebarPermissions(prev => ({ ...prev, [role]: permissions }));
  };

  return (
    <AppContext.Provider value={{
      user, users, isLoading, login, loginAs, setAuthUser, logout,
      addUser, updateUser, deleteUser,
      sidebarPermissions, updatePermissions
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within an AppProvider');
  return ctx;
}
