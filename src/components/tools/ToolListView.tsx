import React, { useState, useEffect, useMemo } from 'react';
import type { Tool, ToolLoan } from '../../types';
import { useTheme } from '../../utils/themeContext';
import { useCompany } from '../../utils/companyContext';
import { useAuth } from '../../utils/authContext';
import { db } from '../../db/database';
import { exportToolsInventoryExcel } from '../../utils/excelExporter';
import { naturalLocationSort } from '../../utils/sortingUtils';
import { triggerCloudSync, notifyLocalMutation } from '../../utils/cloudSync';
import { PendingLoansView } from './PendingLoansView';
import { IncidentsView } from '../incidents/IncidentsView';
import { ImageViewerModal } from '../ImageViewerModal';
import { ToolKitManagerModal } from './ToolKitManagerModal';
import {
  Search,
  Plus,
  Wrench,
  FileSpreadsheet,
  Edit2,
  Trash2,
  ScanLine,
  ArrowRightLeft,
  RotateCcw,
  Clock,
  Camera,
  AlertTriangle,
  CheckCircle2,
  Briefcase,
  MapPin
} from 'lucide-react';

interface ToolListViewProps {
  onOpenNewTool: () => void;
  onEditTool: (tool: Tool) => void;
  onOpenLoan: (tool?: Tool) => void;
  onOpenReturn: (loan?: ToolLoan) => void;
  onOpenScanner?: () => void;
  refreshTrigger: number;
}

export const ToolListView: React.FC<ToolListViewProps> = ({
  onOpenNewTool,
  onEditTool,
  onOpenLoan,
  onOpenReturn,
  onOpenScanner,
  refreshTrigger
}) => {
  const { themeClasses } = useTheme();
  const { selectedCompanyId, selectedCompany, companies } = useCompany();
  const { isReadOnly } = useAuth();

  const [activeTab, setActiveTab] = useState<'catalog' | 'pending' | 'damaged' | 'damages'>('catalog');
  const [tools, setTools] = useState<Tool[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedLocationGroup, setSelectedLocationGroup] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [isKitsModalOpen, setIsKitsModalOpen] = useState(false);

  // Pagination for 10k tools
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  // Image Picker Modal state
  const [selectedToolForPhoto, setSelectedToolForPhoto] = useState<Tool | null>(null);

  useEffect(() => {
    loadTools();
  }, [refreshTrigger, selectedCompanyId]);

  const loadTools = async () => {
    const all = await db.tools.toArray();
    if (selectedCompanyId !== 'ALL') {
      const targetId = (selectedCompanyId || '').toLowerCase().trim();
      const filtered = all.filter(t => (t.companyId || '').toLowerCase().trim() === targetId);
      setTools(filtered.reverse());
    } else {
      setTools(all.reverse());
    }
  };

    const categories = useMemo(() => {
    const set = new Set<string>();
    tools.forEach((t) => {
      if (t.category) set.add(t.category);
    });
    return Array.from(set);
  }, [tools]);

  // Smart location grouping for tools (e.g. Módulo A, Gabinete 1, Pañol, etc.)
  const locationGroups = useMemo(() => {
    interface LocGroup {
      id: string;
      label: string;
      count: number;
      matcher: (loc: string) => boolean;
    }
    const groupsMap = new Map<string, LocGroup>();

    for (const t of tools) {
      const loc = (t.location || 'Sin Ubicación').trim();
      if (!loc) continue;

      let groupKey = '';
      let groupLabel = '';
      let matcher: (l: string) => boolean;

      const upper = loc.toUpperCase();

      // 1. Single letter + digits (e.g. A1, A34, B2, C-10) -> Módulo A, Módulo B
      const letterDigitMatch = upper.match(/^([A-Z])[-_\s]?\d+$/i);
      if (letterDigitMatch) {
        const letter = letterDigitMatch[1];
        groupKey = 'MOD_' + letter;
        groupLabel = 'Módulo ' + letter;
        matcher = (l: string) => {
          const u = (l || '').toUpperCase().trim();
          const m = u.match(/^([A-Z])[-_\s]?\d+$/i);
          return (m && m[1] === letter) || u.startsWith('MODULO ' + letter) || u.startsWith('MÓDULO ' + letter) || u.startsWith('ESTANTE ' + letter) || u.startsWith('PASILLO ' + letter) || u === letter;
        };
      }
      // 2. Prefixes like Modulo A, Pasillo B, Estante 1, Rack 2, Gabinete 3, Sector A, Pañol 1
      else if (/^(MODULO|MÓDULO|PASILLO|ESTANTE|RACK|GABINETE|SECTOR|PAÑOL|PANOL)\s+([A-Z0-9]+)/i.test(upper)) {
        const match = upper.match(/^(MODULO|MÓDULO|PASILLO|ESTANTE|RACK|GABINETE|SECTOR|PAÑOL|PANOL)\s+([A-Z0-9]+)/i)!;
        let prefixType = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase().replace('modulo', 'Módulo').replace('panol', 'Pañol');
        const prefixVal = match[2];
        groupKey = match[1].replace('MÓDULO', 'MODULO').replace('PAÑOL', 'PANOL') + '_' + prefixVal;
        groupLabel = prefixType + ' ' + prefixVal;
        matcher = (l: string) => {
          const u = (l || '').toUpperCase().trim();
          return u.startsWith(match[1] + ' ' + prefixVal) || u.startsWith(match[1].replace('Ó', 'O').replace('Ñ', 'N') + ' ' + prefixVal);
        };
      }
      // 3. Named location (e.g. Gabinete Principal, Pañol Central, Taller, etc.)
      else {
        groupKey = 'NAME_' + upper;
        groupLabel = loc;
        matcher = (l: string) => (l || '').toUpperCase().trim() === upper;
      }

      if (!groupsMap.has(groupKey)) {
        groupsMap.set(groupKey, {
          id: groupKey,
          label: groupLabel,
          count: 0,
          matcher
        });
      }
      groupsMap.get(groupKey)!.count++;
    }

    return Array.from(groupsMap.values()).sort((a, b) => a.label.localeCompare(b.label, 'es', { numeric: true }));
  }, [tools]);

  const filteredTools = useMemo(() => {
    const result = tools.filter((t) => {
      const matchSearch =
        searchTerm === '' ||
        t.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.brand && t.brand.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (t.model && t.model.toLowerCase().includes(searchTerm.toLowerCase())) ||
        t.location.toLowerCase().includes(searchTerm.toLowerCase());

      const matchCategory = selectedCategory === 'ALL' || t.category === selectedCategory;
      const matchStatus = selectedStatus === 'ALL' || t.status === selectedStatus;

      let matchLocation = true;
      if (selectedLocationGroup !== 'ALL') {
        const group = locationGroups.find(g => g.id === selectedLocationGroup);
        if (group && !group.matcher(t.location || '')) {
          matchLocation = false;
        }
      }

      return matchSearch && matchCategory && matchStatus && matchLocation;
    });

    if (selectedLocationGroup !== 'ALL') {
      return naturalLocationSort(result);
    }
    return result;
  }, [tools, searchTerm, selectedCategory, selectedStatus, selectedLocationGroup, locationGroups]);

  const totalPages = Math.ceil(filteredTools.length / pageSize);
  const paginatedTools = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredTools.slice(start, start + pageSize);
  }, [filteredTools, currentPage]);

  const handleExportExcel = () => {
    const compName = selectedCompanyId === 'ALL' ? 'Todas_las_Empresas' : selectedCompany?.name || 'Bodega';
    exportToolsInventoryExcel(filteredTools, compName);
  };

  const handleDelete = async (id?: number) => {
    if (!id || isReadOnly) return;
    if (confirm('¿Está seguro de eliminar esta herramienta del inventario?')) {
      await db.tools.delete(id);
      notifyLocalMutation();
      loadTools();
    }
  };

  const handleSavePhoto = async (newUrl: string) => {
    if (!selectedToolForPhoto?.id) return;
    await db.tools.update(selectedToolForPhoto.id, {
      imageUrl: newUrl,
      updatedAt: new Date().toISOString()
    });
    notifyLocalMutation();
    setSelectedToolForPhoto(null);
    loadTools();
  };

  return (
    <div className="space-y-4">
      {/* Top Header Card */}
      <div className={`p-4 rounded-2xl border ${themeClasses.border} ${themeClasses.card} flex flex-col md:flex-row justify-between items-start md:items-center gap-3 shadow-sm`}>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-black tracking-tight text-slate-100">
              Control de Herramientas y Pañol
            </h2>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-black ${themeClasses.badge}`}>
              {filteredTools.length.toLocaleString('es-CL')} Herramientas
            </span>
          </div>
          <p className={`text-xs ${themeClasses.textMuted}`}>
            Correlativos automáticos HERR-001 • Préstamos, responsables y devoluciones
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {!isReadOnly && (
            <>
              <button
                onClick={() => onOpenLoan()}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl ${themeClasses.accentBg} ${themeClasses.accentHover} shadow-md shadow-orange-500/20 transition active:scale-95`}
              >
                <ArrowRightLeft className="w-4 h-4" />
                <span>Prestar Herramienta</span>
              </button>

              <button
                onClick={() => onOpenReturn()}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 transition shadow-sm"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Devolver Herramienta</span>
              </button>

              <button
                onClick={() => setIsKitsModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 transition shadow-sm"
                title="Composición y armado de mochilas / kits de herramientas"
              >
                <Briefcase className="w-4 h-4 text-amber-400" />
                <span>🎒 Mochilas / Kits</span>
              </button>
            </>
          )}

          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-slate-700 bg-slate-800/60 hover:bg-slate-800 text-slate-300 transition"
            title="Exportar listado a Excel"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">Excel</span>
          </button>

          {!isReadOnly && (
            <button
              onClick={onOpenNewTool}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-black rounded-xl border border-orange-500/40 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 transition active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Nueva Herramienta</span>
            </button>
          )}
        </div>
      </div>

      {/* Sub Tabs: Catalog vs Pending Loans vs Damaged Tools vs Incidents Report */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-1">
        <button
          onClick={() => setActiveTab('catalog')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition ${
            activeTab === 'catalog'
              ? `${themeClasses.accentBg} ${themeClasses.accentHover} shadow-sm`
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Wrench className="w-4 h-4" />
          <span>Catálogo de Herramientas ({tools.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('pending')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition ${
            activeTab === 'pending'
              ? `${themeClasses.accentBg} ${themeClasses.accentHover} shadow-sm`
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Herramientas Pendientes de Devolución</span>
        </button>

        <button
          onClick={() => setActiveTab('damaged')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition ${
            activeTab === 'damaged'
              ? `${themeClasses.accentBg} ${themeClasses.accentHover} shadow-sm`
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <AlertTriangle className="w-4 h-4 text-red-400" />
          <span>Herramientas Dañadas ({tools.filter(t => t.status === 'DANADA').length})</span>
        </button>

        <button
          onClick={() => setActiveTab('damages')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition ${
            activeTab === 'damages'
              ? `${themeClasses.accentBg} ${themeClasses.accentHover} shadow-sm`
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <span>Reporte de Daños</span>
        </button>
      </div>

      {activeTab === 'damages' ? (
        <IncidentsView onOpenScanner={onOpenScanner} refreshTrigger={refreshTrigger} />
      ) : activeTab === 'damaged' ? (
        <div className="space-y-4">
          {/* Header */}
          <div className={`p-4 rounded-2xl border ${themeClasses.border} ${themeClasses.card} flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-sm`}>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base sm:text-lg text-slate-100">
                  Herramientas en Estado Dañado
                </h3>
                <span className="px-2 py-0.5 rounded-full text-xs font-black bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse">
                  {tools.filter(t => t.status === 'DANADA').length} Dañadas
                </span>
              </div>
              <p className={`text-xs ${themeClasses.textMuted}`}>
                Listado completo de herramientas averiadas o rotas en pañol (independiente de si cuentan con acta o reporte formal)
              </p>
            </div>
          </div>

          {/* Damaged List */}
          {tools.filter(t => t.status === 'DANADA').length === 0 ? (
            <div className={`p-12 rounded-2xl border ${themeClasses.border} ${themeClasses.card} text-center space-y-2`}>
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
              <h4 className="font-bold text-base text-slate-200">No hay herramientas registradas con daños</h4>
              <p className="text-xs text-slate-500">Todas las herramientas del pañol y catálogo se encuentran 100% operativas.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {tools.filter(t => t.status === 'DANADA').map((tool) => (
                <div
                  key={tool.id}
                  className="p-4 rounded-2xl border border-red-500/40 bg-red-500/5 hover:border-red-500/60 transition flex flex-col justify-between space-y-3 shadow-sm"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        {tool.imageUrl ? (
                          <img
                            src={tool.imageUrl}
                            alt={tool.name}
                            onClick={() => setSelectedToolForPhoto(tool)}
                            className="w-12 h-12 rounded-xl object-cover border border-red-500/40 cursor-pointer hover:opacity-80 transition shrink-0"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-red-500/20 text-red-400 border border-red-500/30 flex items-center justify-center shrink-0">
                            <AlertTriangle className="w-6 h-6" />
                          </div>
                        )}
                        <div>
                          <span className="font-mono text-xs font-black text-orange-400 block">{tool.code}</span>
                          <h4 className="font-bold text-sm text-slate-100 leading-snug">{tool.name}</h4>
                          <span className="text-[11px] text-slate-400">{tool.brand || 'Genérica'} {tool.model ? `• Mod: ${tool.model}` : ''}</span>
                        </div>
                      </div>

                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-black bg-red-500/20 text-red-300 border border-red-500/50 shadow-sm animate-pulse shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-ping" />
                        DAÑADA
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1 text-xs">
                      <span className="text-[11px] font-bold text-slate-400 block">Detalles de la Avería:</span>
                      <p className="text-red-300 font-medium text-xs">
                        {tool.conditionNotes || 'Herramienta reportada como dañada en pañol sin notas adicionales.'}
                      </p>
                      <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-800">
                        <span>Ubicación: {tool.location || 'Pañol Central'}</span>
                        <span>Categoría: {tool.category}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between gap-1.5 pt-2 border-t border-slate-800">
                    <button
                      onClick={async () => {
                        if (confirm(`¿Marcar la herramienta ${tool.code} - ${tool.name} como DISPONIBLE / REPARADA?`)) {
                          await db.tools.update(tool.id!, {
                            status: 'DISPONIBLE',
                            condition: 'BUENO',
                            conditionNotes: 'Reparada y verificada operativa',
                            updatedAt: new Date().toISOString()
                          });
                          loadTools();
                          triggerCloudSync();
                        }
                      }}
                      className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition active:scale-95"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Marcar Disponible</span>
                    </button>

                    <button
                      onClick={() => onEditTool(tool)}
                      className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 border border-slate-700 transition"
                      title="Editar herramienta"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : activeTab === 'pending' ? (
        <PendingLoansView onOpenReturn={onOpenReturn} refreshTrigger={refreshTrigger} />
      ) : (
        <>
          {/* Search & Filter Bar */}
          <div className={`p-4 rounded-2xl border ${themeClasses.border} ${themeClasses.card} space-y-3.5 shadow-sm`}>
            {/* Main 5-Column Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
              {/* Search Box */}
              <div className="relative sm:col-span-2 lg:col-span-2">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Buscar por código HERR, nombre, marca, modelo..."
                  className={`w-full pl-9 pr-10 py-2 text-xs sm:text-sm rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg}`}
                />
                {onOpenScanner && (
                  <button
                    type="button"
                    onClick={onOpenScanner}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-orange-400"
                    title="Escanear con la cámara"
                  >
                    <ScanLine className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Category Filter */}
              <div>
                <select
                  value={selectedCategory}
                  onChange={(e) => {
                    setSelectedCategory(e.target.value);
                    setCurrentPage(1);
                  }}
                  className={`w-full px-3 py-2 text-xs rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg}`}
                >
                  <option value="ALL">📁 Todas las Categorías</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {/* Smart Location Filter Menu */}
              <div>
                <select
                  value={selectedLocationGroup}
                  onChange={(e) => {
                    setSelectedLocationGroup(e.target.value);
                    setCurrentPage(1);
                  }}
                  className={`w-full px-3 py-2 text-xs font-bold rounded-xl border ${
                    selectedLocationGroup !== 'ALL'
                      ? 'border-orange-500 bg-orange-500/10 text-orange-300 ring-2 ring-orange-500/20'
                      : `${themeClasses.inputBorder} ${themeClasses.inputBg} text-slate-200`
                  } transition`}
                >
                  <option value="ALL">📍 Todas las Ubicaciones</option>
                  {locationGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      📍 {g.label} ({g.count})
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div>
                <select
                  value={selectedStatus}
                  onChange={(e) => {
                    setSelectedStatus(e.target.value);
                    setCurrentPage(1);
                  }}
                  className={`w-full px-3 py-2 text-xs rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg}`}
                >
                  <option value="ALL">⚡ Todos los Estados</option>
                  <option value="DISPONIBLE">🟢 DISPONIBLE</option>
                  <option value="PRESTADA">🟠 PRESTADA</option>
                  <option value="MANTENIMIENTO">🔵 EN MANTENCIÓN</option>
                  <option value="DANADA">🔴 DAÑADA</option>
                  <option value="PERDIDA">⚫ EXTRAVIADA</option>
                </select>
              </div>
            </div>

            {(searchTerm || selectedCategory !== 'ALL' || selectedStatus !== 'ALL' || selectedLocationGroup !== 'ALL') && (
              <div className="flex items-center justify-end pt-1 border-t border-slate-800/60">
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setSelectedCategory('ALL');
                    setSelectedStatus('ALL');
                    setSelectedLocationGroup('ALL');
                    setCurrentPage(1);
                  }}
                  className="text-xs font-bold text-orange-400 hover:underline px-2 py-0.5"
                >
                  Limpiar filtros
                </button>
              </div>
            )}
          </div>

          {/* Tools Table */}
          <div className={`rounded-2xl border ${themeClasses.border} ${themeClasses.card} overflow-hidden shadow-md`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">FOTO</th>
                    <th className="py-2.5 px-3">CÓDIGO HERR</th>
                    <th className="py-2.5 px-3">DESCRIPCIÓN</th>
                    <th className="py-2.5 px-3">CATEGORÍA / MARCA</th>
                    <th className="py-2.5 px-3 text-center">ESTADO PAÑOL</th>
                    <th className="py-2.5 px-3">UBICACIÓN</th>
                    <th className="py-2.5 px-3 text-right">ACCIONES</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {paginatedTools.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-500">
                        No se encontraron herramientas con los filtros seleccionados.
                      </td>
                    </tr>
                  ) : (
                    paginatedTools.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-800/20 transition group">
                        {/* Photo Thumbnail */}
                        <td className="py-2 px-3">
                          <div
                            onClick={() => {
                              if (t.imageUrl) {
                                setSelectedToolForPhoto(t);
                              } else if (!isReadOnly) {
                                onEditTool(t);
                              }
                            }}
                            className={`w-10 h-10 rounded-lg bg-slate-900 border border-slate-800 overflow-hidden relative group/img cursor-pointer flex items-center justify-center`}
                            title={t.imageUrl ? "Clic para ver fotografía ampliada" : "Sin foto (Clic para editar)"}
                          >
                            {t.imageUrl ? (
                              <img src={t.imageUrl} alt={t.name} className="w-full h-full object-cover group-hover/img:scale-110 transition" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-600 group-hover/img:text-orange-400 transition">
                                <Wrench className="w-4 h-4" />
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Code */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className="font-mono font-black text-orange-400 text-xs tracking-wider block">
                            {t.code}
                          </span>
                        </td>

                        {/* Name & Model */}
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-slate-100 text-xs sm:text-sm">{t.name}</div>
                          {t.model && <span className="text-[11px] text-slate-400 font-mono">Mod: {t.model}</span>}
                        </td>

                        {/* Category & Brand */}
                        <td className="py-2.5 px-3">
                          <div className="text-slate-200 font-medium">{t.category}</div>
                          <div className="text-[11px] text-slate-400">{t.brand || 'Genérica'}</div>
                        </td>

                        {/* Status Badge with Pulsing Warning */}
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                              t.status === 'DISPONIBLE'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : t.status === 'PRESTADA'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-sm animate-pulse'
                                : t.status === 'DANADA'
                                ? 'bg-red-500/20 text-red-300 border border-red-500/50 shadow-sm animate-pulse'
                                : 'bg-slate-800 text-slate-400 border border-slate-700'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                                t.status === 'DISPONIBLE'
                                  ? 'bg-emerald-400'
                                  : t.status === 'PRESTADA'
                                  ? 'bg-amber-400 animate-ping'
                                  : t.status === 'DANADA'
                                  ? 'bg-red-400 animate-ping'
                                  : 'bg-slate-400'
                              }`}
                            />
                            {t.status}
                          </span>
                        </td>

                        {/* Location */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className="px-2 py-1 rounded-lg bg-slate-900/60 border border-slate-800 text-slate-300 font-mono text-[11px]">
                            {t.location}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          {!isReadOnly ? (
                            <div className="flex items-center justify-end gap-1">
                              {t.status === 'DISPONIBLE' ? (
                                <button
                                  onClick={() => onOpenLoan(t)}
                                  className="p-1.5 rounded-lg bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 transition"
                                  title="Prestar herramienta"
                                >
                                  <ArrowRightLeft className="w-3.5 h-3.5" />
                                </button>
                              ) : (
                                <button
                                  onClick={() => onOpenReturn()}
                                  className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition"
                                  title="Devolver a pañol"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </button>
                              )}

                              <button
                                onClick={() => onEditTool(t)}
                                className="p-1.5 rounded-lg text-slate-300 hover:bg-slate-800 transition"
                                title="Editar herramienta"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDelete(t.id)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition"
                                title="Eliminar herramienta"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-500 font-medium italic">Solo lectura</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Bar */}
            {totalPages > 1 && (
              <div className="p-3 border-t border-slate-800 flex items-center justify-between text-xs bg-slate-900/40">
                <span className="text-slate-400">
                  Mostrando {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, filteredTools.length)} de {filteredTools.length} herramientas
                </span>
                <div className="flex items-center gap-1">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    className="px-3 py-1 rounded-lg bg-slate-800 disabled:opacity-40 hover:bg-slate-700 text-slate-300 transition"
                  >
                    Anterior
                  </button>
                  <span className="px-2 font-mono font-bold text-slate-300">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    className="px-3 py-1 rounded-lg bg-slate-800 disabled:opacity-40 hover:bg-slate-700 text-slate-300 transition"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Fullscreen Photo Viewer Modal */}
      {selectedToolForPhoto && selectedToolForPhoto.imageUrl && (
        <ImageViewerModal
          isOpen={Boolean(selectedToolForPhoto)}
          onClose={() => setSelectedToolForPhoto(null)}
          imageUrl={selectedToolForPhoto.imageUrl}
          title={selectedToolForPhoto.name}
          subtitle={`Código: ${selectedToolForPhoto.code} • Categoría: ${selectedToolForPhoto.category}`}
        />
      )}

      {/* Tool Kit / Mochila Manager Modal */}
      <ToolKitManagerModal
        isOpen={isKitsModalOpen}
        onClose={() => setIsKitsModalOpen(false)}
        onKitsUpdated={loadTools}
      />
    </div>
  );
};
