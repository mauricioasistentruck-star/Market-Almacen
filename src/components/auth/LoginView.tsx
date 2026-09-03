import { ThemeSelectorMenu } from '../common/ThemeSelectorMenu';
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../utils/authContext';
import { useTheme } from '../../utils/themeContext';
import { pullAllFromCloud } from '../../utils/cloudSync';
import { Lock, User, Eye, EyeOff, AlertCircle, ArrowRight, KeyRound } from 'lucide-react';

export const LoginView: React.FC = () => {
  const { login } = useAuth();
  const { theme, toggleTheme, themeClasses } = useTheme();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Sincronizar usuarios y datos desde Supabase al abrir la pantalla de acceso
    pullAllFromCloud(true).catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsLoading(true);

    try {
      const res = await login(username, password);
      if (!res.success) {
        setErrorMessage(res.message || 'Error al iniciar sesión');
      }
    } catch {
      setErrorMessage('Ocurrió un error al verificar credenciales.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`min-h-screen ${themeClasses.bg} ${themeClasses.text} flex flex-col items-center justify-center p-4 selection:bg-orange-500 selection:text-white transition-colors duration-200`}>
      {/* Top Bar with Theme Toggle */}
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <ThemeSelectorMenu />
      </div>

      <div className="w-full max-w-md space-y-6">
        {/* Logo and Header */}
        <div className="text-center space-y-3">
          <div className="inline-block relative">
            <img
              src="/logo.png"
              alt="Market Almacén"
              className="w-24 h-24 sm:w-28 sm:h-28 mx-auto rounded-full object-cover shadow-2xl border-4 border-orange-500/80 p-1 bg-black/40"
              onError={(e) => {
                (e.target as any).style.display = 'none';
              }}
            />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-orange-500">
              MARKET ALMACÉN
            </h1>
            <p className="text-xs sm:text-sm font-semibold text-slate-400">
              Market Almacén — Sistema de Control de Inventario y Ventas
            </p>
          </div>
        </div>

        {/* Login Card */}
        <div className={`p-6 sm:p-8 rounded-3xl border ${themeClasses.border} ${themeClasses.card} shadow-2xl space-y-6 relative overflow-hidden backdrop-blur-md`}>
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-orange-500" />
              <h2 className="text-base font-bold text-slate-100">Acceso al Sistema</h2>
            </div>
            <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
              ● En Línea Cloud
            </span>
          </div>

          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Botón de Acceso Inmediato Directo para la Prueba de Estudio */}
          <div className="p-3.5 rounded-2xl border-2 border-emerald-500/50 bg-emerald-500/10 text-center space-y-2">
            <p className="text-xs font-black text-emerald-400">
              🧪 Modo Prueba de Estudio Activo
            </p>
            <button
              type="button"
              onClick={() => login('mauricio', '041118')}
              className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 cursor-pointer transition active:scale-95"
            >
              <span>🚀 Entrar a la Prueba de Estudio</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">Usuario</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Ingrese su usuario..."
                  className={`w-full pl-9 pr-3 py-2.5 text-xs sm:text-sm font-semibold rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} focus:outline-none focus:border-orange-500`}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">Contraseña</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={`w-full pl-9 pr-10 py-2.5 text-xs sm:text-sm font-semibold rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} focus:outline-none focus:border-orange-500`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className={`w-full py-3 text-xs sm:text-sm font-black rounded-xl ${themeClasses.accentBg} ${themeClasses.accentHover} shadow-lg shadow-orange-500/20 transition flex items-center justify-center gap-2 group active:scale-98 text-white`}
            >
              <span>{isLoading ? 'Verificando...' : 'Ingresar al Sistema'}</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
            </button>
          </form>
        </div>

        {/* Footer info */}
        <p className="text-center text-xs text-slate-500">
          Sistema de Gestión y Punto de Venta — Market Almacén 2026
        </p>
      </div>
    </div>
  );
};
