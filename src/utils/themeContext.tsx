import React, { createContext, useContext, useEffect, useState } from 'react';
import type { ThemeMode } from '../types';

export interface ThemeOption {
  id: ThemeMode;
  name: string;
  subtitle: string;
  accentColor: string;
  bgPreview: string;
  borderColor: string;
}

export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'white',
    name: 'Tema Blanco',
    subtitle: 'Principal (Tonos Azules)',
    accentColor: '#2563eb', // Blue 600
    bgPreview: '#ffffff',
    borderColor: '#3b82f6'
  },
  {
    id: 'dark-red',
    name: 'Tema Negro',
    subtitle: 'Oscuro (Tonos Rojos)',
    accentColor: '#ef4444', // Red 500
    bgPreview: '#090a0f',
    borderColor: '#ef4444'
  },
  {
    id: 'blue-green',
    name: 'Tema Azul',
    subtitle: 'Océano (Tonos Verdes)',
    accentColor: '#10b981', // Emerald 500
    bgPreview: '#081026',
    borderColor: '#10b981'
  }
];

interface ThemeContextType {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  themeClasses: {
    bg: string;
    card: string;
    cardSubtle: string;
    border: string;
    text: string;
    textMuted: string;
    accent: string;
    accentHover: string;
    accentBg: string;
    badge: string;
    inputBg: string;
    inputBorder: string;
  };
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('marketalmacen_theme') as ThemeMode;
      if (saved === 'white' || saved === 'dark-red' || saved === 'blue-green') {
        return saved;
      }
      if (saved === ('dark-orange' as any) || saved === ('dark' as any)) return 'dark-red';
      if (saved === ('blue' as any)) return 'blue-green';
    }
    // TEMA BLANCO COMO PRINCIPAL / POR DEFECTO
    return 'white';
  });

  useEffect(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('marketalmacen_theme', theme);
    }
    const root = document.documentElement;
    root.classList.remove('theme-white', 'theme-dark-red', 'theme-blue-green', 'theme-dark-orange', 'theme-blue', 'dark');
    if (theme !== 'white') {
      root.classList.add('dark');
    }
    root.classList.add(`theme-${theme}`);

    if (theme === 'white') {
      document.body.className = 'bg-slate-100 text-slate-900 antialiased font-sans';
    } else if (theme === 'dark-red') {
      document.body.className = 'bg-[#090a0f] text-slate-100 antialiased font-sans';
    } else if (theme === 'blue-green') {
      document.body.className = 'bg-[#081026] text-slate-100 antialiased font-sans';
    }
  }, [theme]);

  const setTheme = (newTheme: ThemeMode) => {
    setThemeState(newTheme);
  };

  const toggleTheme = () => {
    if (theme === 'white') setTheme('dark-red');
    else if (theme === 'dark-red') setTheme('blue-green');
    else setTheme('white');
  };

  const getThemeClasses = () => {
    switch (theme) {
      case 'white':
        // TEMA BLANCO CON TONOS AZULES (PRINCIPAL)
        return {
          bg: 'bg-slate-100',
          card: 'bg-white shadow-sm text-slate-900 border-slate-200',
          cardSubtle: 'bg-slate-50 border-slate-200 text-slate-800',
          border: 'border-slate-200',
          text: 'text-slate-900 font-semibold',
          textMuted: 'text-slate-600 font-medium',
          accent: 'text-blue-600 font-bold',
          accentHover: 'hover:bg-blue-700 hover:text-white',
          accentBg: 'bg-blue-600 text-white font-bold',
          badge: 'bg-blue-50 text-blue-800 border-blue-200 font-bold',
          inputBg: 'bg-white text-slate-900 font-medium placeholder:text-slate-400',
          inputBorder: 'border-slate-300 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20'
        };

      case 'dark-red':
        // TEMA NEGRO CON TONOS ROJOS
        return {
          bg: 'bg-[#090a0f]',
          card: 'bg-[#12141c] shadow-lg text-slate-100 border-zinc-800',
          cardSubtle: 'bg-[#0d0f16] border-zinc-800 text-slate-200',
          border: 'border-zinc-800',
          text: 'text-slate-100 font-medium',
          textMuted: 'text-slate-400 font-normal',
          accent: 'text-red-500 font-bold',
          accentHover: 'hover:bg-red-700 hover:text-white',
          accentBg: 'bg-red-600 text-white font-bold',
          badge: 'bg-red-950/40 text-red-400 border-red-500/30 font-bold',
          inputBg: 'bg-[#0c0e14] text-slate-100 font-medium placeholder:text-slate-500',
          inputBorder: 'border-zinc-700 focus:border-red-500 focus:ring-2 focus:ring-red-500/20'
        };

      case 'blue-green':
      default:
        // TEMA AZUL CON TONOS VERDES
        return {
          bg: 'bg-[#081026]',
          card: 'bg-[#0d1b3d] shadow-lg text-slate-100 border-[#1c3366]',
          cardSubtle: 'bg-[#09142f] border-[#1c3366] text-slate-200',
          border: 'border-[#1c3366]',
          text: 'text-slate-100 font-medium',
          textMuted: 'text-slate-400 font-normal',
          accent: 'text-emerald-400 font-bold',
          accentHover: 'hover:bg-emerald-700 hover:text-white',
          accentBg: 'bg-emerald-600 text-white font-bold',
          badge: 'bg-emerald-950/40 text-emerald-300 border-emerald-500/30 font-bold',
          inputBg: 'bg-[#09142f] text-slate-100 font-medium placeholder:text-slate-500',
          inputBorder: 'border-[#1c3366] focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20'
        };
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, themeClasses: getThemeClasses() }}>
      {children}
    </ThemeContext.Provider>
  );
};

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
