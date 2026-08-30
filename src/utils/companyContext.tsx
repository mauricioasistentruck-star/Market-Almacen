import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Company } from '../types';
import { db } from '../db/database';
import { INITIAL_COMPANIES } from '../db/seedData';

interface CompanyContextType {
  companies: Company[];
  selectedCompanyId: string;
  selectedCompany?: Company;
  setSelectedCompanyId: (id: string) => void;
  reloadCompanies: () => Promise<void>;
  addCompany: (company: Omit<Company, 'createdAt'>) => Promise<string>;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export const CompanyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [companies, setCompanies] = useState<Company[]>(INITIAL_COMPANIES);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(() => {
    if (typeof localStorage !== 'undefined') {
      const savedUser = localStorage.getItem('marketalmacen_logged_user');
      if (savedUser) {
        try {
          const user = JSON.parse(savedUser);
          if (user.companyId && user.companyId !== 'ALL') {
            return user.companyId;
          }
        } catch (_) {}
      }
      const saved = localStorage.getItem('marketalmacen_selected_company');
      if (saved) return saved;
    }
    return 'market-almacen';
  });

  const reloadCompanies = async () => {
    const list = await db.companies.toArray();
    if (list.length > 0) {
      setCompanies(list);
      setSelectedCompanyId(current => {
        if (current === 'ALL') return list[0]?.id || 'market-almacen';
        if (list.some(c => c.id === current)) return current;
        return list[0].id;
      });
    } else {
      setCompanies(INITIAL_COMPANIES);
    }
  };

  useEffect(() => {
    reloadCompanies();
    const handleSync = () => {
      reloadCompanies();
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('marketalmacen-data-updated', handleSync);
      return () => window.removeEventListener('marketalmacen-data-updated', handleSync);
    }
  }, []);

  const handleSetSelectedCompanyId = (id: string) => {
    setSelectedCompanyId(id);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('marketalmacen_selected_company', id);
    }
  };

  const addCompany = async (compData: Omit<Company, 'createdAt'>) => {
    const newComp: Company = {
      ...compData,
      createdAt: new Date().toISOString()
    };
    await db.companies.put(newComp);
    await reloadCompanies();
    return newComp.id;
  };

  const selectedCompany = companies.find(c => c.id === selectedCompanyId);

  return (
    <CompanyContext.Provider
      value={{
        companies,
        selectedCompanyId,
        selectedCompany,
        setSelectedCompanyId: handleSetSelectedCompanyId,
        reloadCompanies,
        addCompany
      }}
    >
      {children}
    </CompanyContext.Provider>
  );
};

export function useCompany() {
  const context = useContext(CompanyContext);
  if (!context) {
    throw new Error('useCompany must be used within a CompanyProvider');
  }
  return context;
}
