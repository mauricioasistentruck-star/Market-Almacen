import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Cloud, CloudOff, RefreshCw, CheckCircle2, AlertCircle,
  ExternalLink, Key, Globe, Trash2, X, ShieldCheck
} from 'lucide-react';
import {
  getCustomCloudCredentials,
  setCustomCloudCredentials,
  clearCloudCredentials,
  isCloudConfigured,
  testCloudConnection,
  subscribeCloudSync,
  pullAllFromCloud,
  pushAllToCloud,
  type CloudSyncStatus
} from '../../utils/cloudSync';

interface CloudConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CloudConfigModal: React.FC<CloudConfigModalProps> = ({ isOpen, onClose }) => {
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [syncStatus, setSyncStatus] = useState<CloudSyncStatus>({
    isOnline: true,
    isSyncing: false,
    lastSync: null,
    mode: 'local'
  });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [syncingManual, setSyncingManual] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const creds = getCustomCloudCredentials();
      setUrl(creds.url || '');
      setKey(creds.key || '');
      setTestResult(null);
      setSaveSuccess(false);
    }
  }, [isOpen]);

  useEffect(() => {
    const unsub = subscribeCloudSync((st) => setSyncStatus(st));
    return () => unsub();
  }, []);

  if (!isOpen) return null;

  const configured = isCloudConfigured();

  const handleTest = async () => {
    if (!url.trim() || !key.trim()) {
      setTestResult({
        success: false,
        message: 'Debes completar la URL del proyecto y la anon key de Supabase.'
      });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await testCloudConnection(url, key);
      setTestResult(res);
    } catch (e: any) {
      setTestResult({
        success: false,
        message: e?.message || 'Error al intentar conectar.'
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    if (!url.trim() || !key.trim()) {
      alert('Por favor ingresa la URL y la API Key de tu nuevo proyecto Supabase.');
      return;
    }
    setCustomCloudCredentials(url, key);
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
    }, 3000);
  };

  const handleClear = () => {
    if (confirm('¿Deseas desconectar la nube de Supabase? Los datos continuarán en este dispositivo en modo local.')) {
      clearCloudCredentials();
      setUrl('');
      setKey('');
      setTestResult(null);
    }
  };

  const handleManualSyncNow = async () => {
    setSyncingManual(true);
    try {
      await pullAllFromCloud();
      await pushAllToCloud();
    } finally {
      setSyncingManual(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-xl w-full p-5 sm:p-7 shadow-2xl space-y-5 my-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-white shadow-md">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">
                Sincronización en la Nube
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Conexión con Supabase para sincronizar Web y APK
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Estado actual */}
        <div className="p-4 rounded-2xl border bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/80 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-3 h-3 rounded-full shrink-0 ${
              configured ? (syncStatus.error ? 'bg-red-500 animate-pulse' : 'bg-emerald-500 shadow-sm shadow-emerald-500/50') : 'bg-amber-500'
            }`} />
            <div className="min-w-0">
              <p className="text-xs font-black text-slate-800 dark:text-slate-200 truncate">
                {configured
                  ? (syncStatus.isSyncing ? 'Sincronizando datos con la nube...' : syncStatus.error ? 'Error de sincronización' : 'Conectado a Supabase')
                  : 'Nube no configurada (Modo Local)'}
              </p>
              <p className="text-[11px] text-slate-500 truncate">
                {configured
                  ? (syncStatus.lastSync ? `Última sincronización: ${syncStatus.lastSync.toLocaleTimeString()}` : 'En espera de sincronización')
                  : 'Ingresa las credenciales de tu proyecto de Supabase abajo'}
              </p>
            </div>
          </div>

          {configured && (
            <button
              onClick={handleManualSyncNow}
              disabled={syncStatus.isSyncing || syncingManual}
              className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black transition flex items-center gap-1.5 shrink-0 shadow-sm disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncStatus.isSyncing || syncingManual ? 'animate-spin' : ''}`} />
              <span>Sincronizar</span>
            </button>
          )}
        </div>

        {/* Formulario de credenciales */}
        <div className="space-y-3.5">
          <div>
            <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-blue-500" />
              <span>Project URL de Supabase</span>
            </label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://tu-id-proyecto.supabase.co"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-mono text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-inner"
            />
          </div>

          <div>
            <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-amber-500" />
              <span>API Key Anónima (anon / public)</span>
            </label>
            <textarea
              rows={2}
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="sb_publishable_... o eyJhbGciOiJIUzI1NiIsInR5cCI6..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-mono text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-inner resize-none"
            />
          </div>
        </div>

        {/* Mensaje de prueba / guardado */}
        {testResult && (
          <div className={`p-3 rounded-xl border text-xs font-bold flex items-start gap-2.5 ${
            testResult.success
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
              : 'bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800 text-red-800 dark:text-red-200'
          }`}>
            {testResult.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            )}
            <div>
              <p className="font-black">{testResult.success ? 'Conexión Exitosa' : 'Aviso de Conexión'}</p>
              <p className="font-normal text-[11px] mt-0.5">{testResult.message}</p>
            </div>
          </div>
        )}

        {saveSuccess && (
          <div className="p-3 rounded-xl border bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-black flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>¡Credenciales guardadas! Iniciando sincronización en tiempo real...</span>
          </div>
        )}

        {/* Acciones */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            {configured && (
              <button
                type="button"
                onClick={handleClear}
                className="px-3 py-2 rounded-xl text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 text-xs font-bold transition flex items-center gap-1.5"
                title="Desconectar Nube"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Desconectar</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={handleTest}
              disabled={testing}
              className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 transition flex items-center gap-1.5 disabled:opacity-50"
            >
              {testing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />}
              <span>Probar Conexión</span>
            </button>

            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition flex items-center gap-1.5 shadow-md shadow-emerald-600/20"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Guardar y Conectar</span>
            </button>
          </div>
        </div>

        {/* Guía rápida */}
        <div className="p-3.5 rounded-2xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/50 text-[11px] text-slate-600 dark:text-slate-300 space-y-1.5">
          <p className="font-black text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
            <ExternalLink className="w-3 h-3" />
            <span>¿Cómo obtener estos datos en tu nueva cuenta de Supabase?</span>
          </p>
          <ol className="list-decimal pl-4 space-y-1 font-medium text-[10.5px]">
            <li>Crea un proyecto en <a href="https://supabase.com" target="_blank" rel="noreferrer" className="text-blue-600 underline font-bold">supabase.com</a>.</li>
            <li>En <strong>SQL Editor</strong>, copia y ejecuta el archivo <code className="font-mono bg-blue-100 dark:bg-blue-900/50 px-1 py-0.5 rounded">supabase_setup.sql</code> ubicado en la carpeta del proyecto.</li>
            <li>En <strong>Project Settings → API</strong> copia la <strong>Project URL</strong> y la <strong>anon key</strong> y pégalas aquí.</li>
          </ol>
        </div>

      </div>
    </div>,
    document.body
  );
};
