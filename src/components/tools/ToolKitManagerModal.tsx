import { useBodyScrollLock } from '../../utils/scrollLock';
import React, { useState, useEffect } from 'react';
import type { Tool, ToolKit } from '../../types';
import { useTheme } from '../../utils/themeContext';
import { useCompany } from '../../utils/companyContext';
import { useAuth } from '../../utils/authContext';
import { db } from '../../db/database';
import { triggerCloudSync } from '../../utils/cloudSync';
import {
  X,
  Briefcase,
  Plus,
  Edit2,
  Trash2,
  Check,
  Search,
  Wrench,
  Layers,
  Sparkles,
  Info
} from 'lucide-react';

interface ToolKitManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onKitsUpdated?: () => void;
}

export const ToolKitManagerModal: React.FC<ToolKitManagerModalProps> = ({
  isOpen,
  onClose,
  onKitsUpdated
}) => {
  useBodyScrollLock(Boolean(isOpen));
  const { themeClasses } = useTheme();
  const { selectedCompanyId } = useCompany();
  const { isReadOnly } = useAuth();

  const [kits, setKits] = useState<ToolKit[]>([]);
  const [allTools, setAllTools] = useState<Tool[]>([]);
  const [editingKit, setEditingKit] = useState<ToolKit | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Form State
  const [kitName, setKitName] = useState('');
  const [kitCode, setKitCode] = useState('');
  const [kitCategory, setKitCategory] = useState('Mochilas');
  const [kitDescription, setKitDescription] = useState('');
  const [selectedToolIds, setSelectedToolIds] = useState<number[]>([]);
  const [toolSearchQuery, setToolSearchQuery] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, selectedCompanyId]);

  const loadData = async () => {
    let ktList = await db.toolKits.toArray();
    let tlList = await db.tools.toArray();

    if (selectedCompanyId !== 'ALL') {
      ktList = ktList.filter(k => !k.companyId || k.companyId === selectedCompanyId || k.companyId === 'market-almacen');
      tlList = tlList.filter(t => !t.companyId || t.companyId === selectedCompanyId || t.companyId === 'market-almacen');
    }

    setKits(ktList);
    setAllTools(tlList);
  };

  const handleOpenCreateForm = () => {
    setEditingKit(null);
    setKitName('');
    setKitCode(`KIT-${String(kits.length + 1).padStart(3, '0')}`);
    setKitCategory('Mochilas');
    setKitDescription('');
    setSelectedToolIds([]);
    setToolSearchQuery('');
    setIsFormOpen(true);
  };

  const handleOpenEditForm = (kit: ToolKit) => {
    setEditingKit(kit);
    setKitName(kit.name);
    setKitCode(kit.code || '');
    setKitCategory(kit.category || 'Mochilas');
    setKitDescription(kit.description || '');
    setSelectedToolIds(kit.toolIds ? [...kit.toolIds] : []);
    setToolSearchQuery('');
    setIsFormOpen(true);
  };

  const toggleToolSelection = (toolId: number) => {
    setSelectedToolIds(prev =>
      prev.includes(toolId) ? prev.filter(id => id !== toolId) : [...prev, toolId]
    );
  };

  const handleSaveKit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kitName.trim()) {
      alert('Por favor ingrese el nombre del kit o mochila.');
      return;
    }

    if (selectedToolIds.length === 0) {
      alert('Por favor seleccione al menos 1 herramienta para incluir en este kit.');
      return;
    }

    const kitData: ToolKit = {
      name: kitName.trim(),
      code: kitCode.trim() || `KIT-${Date.now().toString().slice(-4)}`,
      category: kitCategory,
      description: kitDescription.trim(),
      toolIds: selectedToolIds,
      companyId: selectedCompanyId === 'ALL' ? 'market-almacen' : selectedCompanyId,
      createdAt: editingKit?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (editingKit?.id) {
      await db.toolKits.put({ ...kitData, id: editingKit.id });
    } else {
      await db.toolKits.add(kitData);
    }

    setIsFormOpen(false);
    loadData();
    if (onKitsUpdated) onKitsUpdated();
    triggerCloudSync();
  };

  const handleDeleteKit = async (id: number) => {
    if (isReadOnly) return;
    if (confirm('¿Desea eliminar esta composición de kit / mochila? (Las herramientas individuales no se borrarán)')) {
      await db.toolKits.delete(id);
      loadData();
      if (onKitsUpdated) onKitsUpdated();
      triggerCloudSync();
    }
  };

  if (!isOpen) return null;

  const filteredTools = allTools.filter(t => {
    const q = toolSearchQuery.toLowerCase();
    return (
      t.name.toLowerCase().includes(q) ||
      t.code.toLowerCase().includes(q) ||
      (t.brand && t.brand.toLowerCase().includes(q)) ||
      t.category.toLowerCase().includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className={`w-full max-w-3xl max-h-[90vh] flex flex-col rounded-3xl border ${themeClasses.border} ${themeClasses.card} shadow-2xl overflow-hidden`}>
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-orange-500/10 text-orange-400 border border-orange-500/20">
              <Briefcase className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base sm:text-lg text-slate-100">
                  Composición de Kits y Mochilas de Herramientas
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-orange-500/20 text-orange-400 border border-orange-500/30">
                  {kits.length} Kits
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Arme conjuntos de herramientas para prestarlas o entregarlas en 1 solo clic
              </p>
            </div>
          </div>

          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
          {!isFormOpen ? (
            <div className="space-y-4">
              {/* Top Controls */}
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-slate-300">
                  Seleccione un kit para ver o editar sus herramientas componentes, o cree uno nuevo.
                </p>
                {!isReadOnly && (
                  <button
                    onClick={handleOpenCreateForm}
                    className={`flex items-center gap-1.5 px-4 py-2 text-xs font-black rounded-xl ${themeClasses.accentBg} ${themeClasses.accentHover} shadow-md shadow-orange-500/20 transition active:scale-95 shrink-0`}
                  >
                    <Plus className="w-4 h-4" />
                    <span>Crear Nuevo Kit / Mochila</span>
                  </button>
                )}
              </div>

              {/* Kits List */}
              {kits.length === 0 ? (
                <div className="p-12 text-center rounded-2xl border border-slate-800 bg-slate-900/40 space-y-3">
                  <Briefcase className="w-12 h-12 text-slate-600 mx-auto" />
                  <h4 className="text-sm font-bold text-slate-300">No hay kits ni mochilas configuradas</h4>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Cree una mochila con varias herramientas (ej: Mochila Mecánica, Caja de Dados, Kit Eléctrico) para entregarlas todas juntas rápidamente.
                  </p>
                  {!isReadOnly && (
                    <button
                      onClick={handleOpenCreateForm}
                      className={`px-4 py-2 text-xs font-bold rounded-xl ${themeClasses.accentBg} ${themeClasses.accentHover}`}
                    >
                      Crear Primer Kit
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {kits.map((kit) => {
                    const kitTools = allTools.filter(t => t.id && kit.toolIds.includes(t.id));
                    return (
                      <div
                        key={kit.id}
                        className="p-4 rounded-2xl border border-slate-800 bg-slate-900/70 hover:border-orange-500/40 transition space-y-3 shadow-sm flex flex-col justify-between"
                      >
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-[10px] font-bold text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded border border-orange-500/20">
                                  {kit.code}
                                </span>
                                <h4 className="font-extrabold text-sm text-slate-100">{kit.name}</h4>
                              </div>
                              <span className="text-[10px] font-bold text-slate-400">{kit.category}</span>
                            </div>

                            <div className="flex items-center gap-1">
                              {!isReadOnly && (
                                <>
                                  <button
                                    onClick={() => handleOpenEditForm(kit)}
                                    className="p-1.5 text-slate-400 hover:text-orange-400 rounded-lg hover:bg-slate-800"
                                    title="Editar kit"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteKit(kit.id!)}
                                    className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg hover:bg-red-500/10"
                                    title="Eliminar kit"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>

                          {kit.description && (
                            <p className="text-xs text-slate-400 line-clamp-2">{kit.description}</p>
                          )}

                          {/* Tools Preview Tag list */}
                          <div className="pt-2 border-t border-slate-800">
                            <span className="text-[10px] font-black uppercase text-orange-400 block mb-1">
                              Herramientas Incluidas ({kitTools.length}):
                            </span>
                            <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                              {kitTools.map(t => (
                                <span
                                  key={t.id}
                                  className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700 flex items-center gap-1"
                                >
                                  <Wrench className="w-2.5 h-2.5 text-orange-400" />
                                  <span>{t.name}</span>
                                  <span className="font-mono text-slate-400 text-[9px]">({t.code})</span>
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* CREATE / EDIT KIT FORM */
            <form onSubmit={handleSaveKit} className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <h4 className="text-sm font-extrabold text-orange-400 flex items-center gap-1.5">
                  <Briefcase className="w-4 h-4" />
                  <span>{editingKit ? 'Modificar Kit / Mochila' : 'Configurar Nueva Mochila de Herramientas'}</span>
                </h4>
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="text-xs text-slate-400 hover:text-white underline"
                >
                  Volver a la lista
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-300 mb-1">Nombre del Kit / Mochila *:</label>
                  <input
                    type="text"
                    required
                    value={kitName}
                    onChange={(e) => setKitName(e.target.value)}
                    placeholder="Ej: Mochila de Mantención Terreno / Set de Llaves y Dados"
                    className={`w-full px-3 py-2 text-xs font-bold rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg}`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Código Identificador:</label>
                  <input
                    type="text"
                    value={kitCode}
                    onChange={(e) => setKitCode(e.target.value)}
                    placeholder="Ej: KIT-001"
                    className={`w-full px-3 py-2 text-xs font-mono font-bold rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg}`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Categoría / Tipo:</label>
                  <select
                    value={kitCategory}
                    onChange={(e) => setKitCategory(e.target.value)}
                    className={`w-full px-3 py-2 text-xs font-bold rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg}`}
                  >
                    <option value="Mochilas">🎒 Mochila de Herramientas</option>
                    <option value="Cajas">🧰 Caja Metálica / Plástica</option>
                    <option value="Sets">🔧 Set / Juego de Llaves</option>
                    <option value="Diagnostico">⚡ Maletín de Diagnóstico</option>
                    <option value="General">📦 General</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-300 mb-1">Descripción / Destino:</label>
                  <input
                    type="text"
                    value={kitDescription}
                    onChange={(e) => setKitDescription(e.target.value)}
                    placeholder="Ej: Conjunto para labores en terreno y reparaciones pesadas"
                    className={`w-full px-3 py-2 text-xs rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg}`}
                  />
                </div>
              </div>

              {/* TOOL SELECTOR */}
              <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-3">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <div>
                    <h5 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                      <Wrench className="w-4 h-4 text-orange-400" />
                      <span>Seleccionar Herramientas que Componen este Kit ({selectedToolIds.length} seleccionadas)</span>
                    </h5>
                    <p className="text-[11px] text-slate-400">
                      Marque todas las herramientas que van dentro de esta mochila o caja
                    </p>
                  </div>

                  <div className="relative w-full sm:w-60">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Buscar por nombre o código..."
                      value={toolSearchQuery}
                      onChange={(e) => setToolSearchQuery(e.target.value)}
                      className={`w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg}`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
                  {filteredTools.map((t) => {
                    const isSelected = selectedToolIds.includes(t.id!);
                    return (
                      <div
                        key={t.id}
                        onClick={() => toggleToolSelection(t.id!)}
                        className={`p-2.5 rounded-xl border cursor-pointer transition flex items-center justify-between gap-2 ${
                          isSelected
                            ? 'bg-orange-500/15 border-orange-500/60 text-white shadow-sm'
                            : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`w-4 h-4 rounded-md flex items-center justify-center border ${
                            isSelected ? 'bg-orange-500 border-orange-500 text-black' : 'border-slate-700'
                          }`}>
                            {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                          <div className="truncate">
                            <span className="font-bold text-xs block truncate">{t.name}</span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              Cód: {t.code} {t.brand ? `• ${t.brand}` : ''}
                            </span>
                          </div>
                        </div>

                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                          t.status === 'DISPONIBLE' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                        }`}>
                          {t.status}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2 text-xs font-black rounded-xl ${themeClasses.accentBg} ${themeClasses.accentHover} shadow-lg shadow-orange-500/20`}
                >
                  Guardar Kit / Mochila
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
