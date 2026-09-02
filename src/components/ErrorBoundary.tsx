import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught application error:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {}
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0f1117] text-white flex flex-col items-center justify-center p-4 font-sans">
          <div className="max-w-md w-full bg-slate-900 border-2 border-red-500/50 rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-4">
            <div className="w-16 h-16 bg-red-500/20 text-red-400 rounded-2xl flex items-center justify-center mx-auto text-3xl font-black">
              ⚠️
            </div>
            <div>
              <h1 className="text-xl font-black text-white">Market Almacén</h1>
              <p className="text-sm text-red-400 font-bold mt-1">
                {this.state.error?.message || 'Error inesperado al cargar la vista'}
              </p>
            </div>
            <p className="text-xs text-slate-400">
              Se detectó una inconsistencia en los datos temporales del navegador. Puedes recargar o restablecer los datos de sesión para volver a entrar.
            </p>
            <div className="flex flex-col gap-2.5 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-black rounded-xl transition cursor-pointer shadow-lg shadow-blue-600/30"
              >
                🔄 Recargar Aplicación
              </button>
              <button
                type="button"
                onClick={this.handleReset}
                className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 font-bold rounded-xl transition cursor-pointer text-xs border border-slate-700"
              >
                Limpiar Datos de Sesión y Reiniciar
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
