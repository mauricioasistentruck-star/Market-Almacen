import React, { useState, useRef, useEffect } from 'react';
import { useTheme, THEME_OPTIONS, type ThemeOption } from '../../utils/themeContext';
import type { ThemeMode } from '../../types';
import { Palette, Check, Sun, Moon, Waves } from 'lucide-react';

interface ThemeSelectorMenuProps {
  buttonClassName?: string;
  align?: 'left' | 'right';
  showLabel?: boolean;
}

export const ThemeSelectorMenu: React.FC<ThemeSelectorMenuProps> = ({
  buttonClassName,
  align = 'right',
  showLabel = true
}) => {
  const { theme, setTheme, themeClasses } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const currentOption = THEME_OPTIONS.find(o => o.id === theme) || THEME_OPTIONS[0];

  const getThemeIcon = (id: ThemeMode) => {
    switch (id) {
      case 'white':
        return <Sun className="w-4 h-4 text-blue-600" />;
      case 'dark-red':
        return <Moon className="w-4 h-4 text-red-500" />;
      case 'blue-green':
        return <Waves className="w-4 h-4 text-emerald-400" />;
    }
  };

  const isDark = theme !== 'white';

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={buttonClassName || `px-3 py-1.5 rounded-xl border ${themeClasses.border} ${themeClasses.cardSubtle} hover:scale-[1.02] active:scale-95 transition flex items-center gap-2 text-xs font-bold shadow-sm`}
        title="Seleccionar tema visual"
      >
        <Palette className={`w-4 h-4 shrink-0 ${theme === 'white' ? 'text-blue-600' : theme === 'dark-red' ? 'text-red-500' : 'text-emerald-400'}`} />
        {showLabel && (
          <span className={`hidden sm:inline ${theme === 'white' ? 'text-slate-800' : 'text-slate-200'}`}>
            {currentOption.name}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} mt-2 w-72 rounded-2xl border ${themeClasses.border} ${themeClasses.card} shadow-2xl p-2.5 z-50 animate-fadeIn backdrop-blur-xl space-y-1.5`}
        >
          <div className={`px-2 py-1.5 border-b ${theme === 'white' ? 'border-slate-200 text-slate-600' : 'border-slate-800 text-slate-400'} flex items-center justify-between`}>
            <span className="text-[11px] font-black uppercase tracking-wider">
              Elegir Tema Visual
            </span>
            <Palette className="w-3.5 h-3.5 opacity-70" />
          </div>

          <div className="space-y-1 pt-1">
            {THEME_OPTIONS.map((opt: ThemeOption) => {
              const isSelected = theme === opt.id;
              
              let itemClasses = '';
              let titleClass = '';
              let subClass = '';
              let checkBg = '';

              if (theme === 'white') {
                titleClass = 'text-slate-900 font-bold';
                subClass = 'text-slate-600 font-medium';
                checkBg = 'bg-blue-600 text-white';
                itemClasses = isSelected
                  ? 'border-blue-500 bg-blue-50 shadow-sm'
                  : 'border-transparent hover:bg-slate-100';
              } else if (theme === 'dark-red') {
                titleClass = 'text-slate-100 font-bold';
                subClass = 'text-slate-400 font-normal';
                checkBg = 'bg-red-600 text-white';
                itemClasses = isSelected
                  ? 'border-red-500 bg-red-950/40 shadow-sm'
                  : 'border-transparent hover:bg-zinc-800/60';
              } else {
                // blue-green
                titleClass = 'text-slate-100 font-bold';
                subClass = 'text-slate-300 font-normal';
                checkBg = 'bg-emerald-600 text-white';
                itemClasses = isSelected
                  ? 'border-emerald-500 bg-emerald-950/40 shadow-sm'
                  : 'border-transparent hover:bg-[#122247]';
              }

              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setTheme(opt.id);
                    setIsOpen(false);
                  }}
                  className={`w-full p-2.5 rounded-xl text-left flex items-center justify-between border transition-all duration-150 ${itemClasses}`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shadow-inner border shrink-0 ${
                        theme === 'white' ? 'border-slate-300' : 'border-slate-700'
                      }`}
                      style={{ backgroundColor: opt.bgPreview }}
                    >
                      {getThemeIcon(opt.id)}
                    </div>
                    <div>
                      <p className={`text-xs leading-tight ${titleClass}`}>
                        {opt.name}
                      </p>
                      <p className={`text-[10px] ${subClass}`}>
                        {opt.subtitle}
                      </p>
                    </div>
                  </div>

                  {isSelected && (
                    <div className={`p-1 rounded-full shadow ${checkBg}`}>
                      <Check className="w-3.5 h-3.5" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
