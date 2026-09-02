import { useBodyScrollLock } from '../../utils/scrollLock';
import React, { useState } from 'react';
import { useCompany } from '../../utils/companyContext';
import { useAuth } from '../../utils/authContext';
import { useTheme } from '../../utils/themeContext';
import {
  X,
  Building2,
  Plus,
  User,
  Check,
  Trash2,
  Pencil,
  Sparkles,
  Tag,
  Briefcase,
  Layers,
  Scale
} from 'lucide-react';
import { db, deleteCompanyWithCascade } from '../../db/database';
import { formatRut } from '../../utils/barcodeGenerator';
import { notifyLocalMutation } from '../../utils/cloudSync';
import { getAllRubros, getRubroPreset, type CompanyServiceOption, type WeighablePreset } from '../../utils/rubroPresets';
import type { Company } from '../../types';

interface CompanyManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CompanyManagerModal: React.FC<CompanyManagerModalProps> = ({ isOpen, onClose }) => {
  useBodyScrollLock(Boolean(isOpen));
  const { companies, reloadCompanies, selectedCompanyId, setSelectedCompanyId } = useCompany();
  const { isSuperAdmin } = useAuth();
  const { themeClasses } = useTheme();

  const [isAdding, setIsAdding] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);

  const [rut, setRut] = useState('');
  const [name, setName] = useState('');
  const [tradeName, setTradeName] = useState('');
  const [industry, setIndustry] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [isNaturalPerson, setIsNaturalPerson] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [simpleApiKey, setSimpleApiKey] = useState('');
  const [siiAmbiente, setSiiAmbiente] = useState<'certificacion' | 'produccion'>('certificacion');
  const [resolucionNumero, setResolucionNumero] = useState('80');
  const [resolucionFecha, setResolucionFecha] = useState('2014-08-22');

  // Rubro y personalización contextual
  const [rubroKey, setRubroKey] = useState('almacen');
  const [categories, setCategories] = useState<string[]>([]);
  const [units, setUnits] = useState<string[]>([]);
  const [weighablePresets, setWeighablePresets] = useState<WeighablePreset[]>([]);
  const [services, setServices] = useState<CompanyServiceOption[]>([]);

  // Nuevas entradas personalizadas
  const [newCatInput, setNewCatInput] = useState('');
  const [newServiceName, setNewServiceName] = useState('');
  const [newServiceDesc, setNewServiceDesc] = useState('');

  if (!isOpen || !isSuperAdmin) return null;

  const handleSelectRubro = (key: string, forceReset = false) => {
    setRubroKey(key);
    const preset = getRubroPreset(key);
    if (!industry || forceReset || industry.trim() === '') {
      setIndustry(preset.name);
    }
    if (categories.length === 0 || forceReset) {
      setCategories([...preset.categories]);
    }
    if (units.length === 0 || forceReset) {
      setUnits([...preset.units]);
    }
    if (weighablePresets.length === 0 || forceReset) {
      setWeighablePresets([...preset.weighablePresets]);
    }
    if (services.length === 0 || forceReset) {
      setServices([...preset.serviceOptions]);
    }
  };

  const openNewForm = () => {
    setEditingCompany(null);
    setRut('');
    setName('');
    setTradeName('');
    setPhone('');
    setAddress('');
    setIsNaturalPerson(false);
    setSimpleApiKey('');
    setSiiAmbiente('certificacion');
    setResolucionNumero('80');
    setResolucionFecha('2014-08-22');

    // Cargar perfil por defecto de Almacén
    const preset = getRubroPreset('almacen');
    setRubroKey('almacen');
    setIndustry(preset.name);
    setCategories([...preset.categories]);
    setUnits([...preset.units]);
    setWeighablePresets([...preset.weighablePresets]);
    setServices([...preset.serviceOptions]);

    setNewCatInput('');
    setNewServiceName('');
    setNewServiceDesc('');
    setIsAdding(true);
  };

  const openEditForm = (c: Company) => {
    setEditingCompany(c);
    setRut(c.rut || '');
    setName(c.name || '');
    setTradeName(c.tradeName || '');
    setIndustry(c.industry || '');
    setPhone(c.phone || '');
    setAddress(c.address || '');
    setIsNaturalPerson(!!c.isNaturalPerson);

    const key = c.rubroKey || 'almacen';
    setRubroKey(key);
    const preset = getRubroPreset(key);

    setCategories(c.customCategories && c.customCategories.length > 0 ? [...c.customCategories] : [...preset.categories]);
    setUnits(c.customUnits && c.customUnits.length > 0 ? [...c.customUnits] : [...preset.units]);
    setWeighablePresets(c.customWeighablePresets && c.customWeighablePresets.length > 0 ? [...c.customWeighablePresets] : [...preset.weighablePresets]);
    setServices(c.customServices && c.customServices.length > 0 ? [...c.customServices] : [...preset.serviceOptions]);

    setNewCatInput('');
    setNewServiceName('');
    setNewServiceDesc('');
    setIsAdding(true);
  };

  const handleCancelForm = () => {
    setIsAdding(false);
    setEditingCompany(null);
  };

  const handleAddCategory = () => {
    if (!newCatInput.trim()) return;
    const cat = newCatInput.trim();
    if (!categories.includes(cat)) {
      setCategories([...categories, cat]);
    }
    setNewCatInput('');
  };

  const handleRemoveCategory = (catToRemove: string) => {
    setCategories(categories.filter(c => c !== catToRemove));
  };

  const handleToggleService = (serviceId: string) => {
    setServices(services.map(s => s.id === serviceId ? { ...s, active: !s.active } : s));
  };

  const handleAddCustomService = () => {
    if (!newServiceName.trim()) return;
    const newS: CompanyServiceOption = {
      id: 'custom_' + Date.now(),
      name: newServiceName.trim(),
      description: newServiceDesc.trim() || 'Servicio personalizado para clientes',
      icon: '✨',
      active: true
    };
    setServices([...services, newS]);
    setNewServiceName('');
    setNewServiceDesc('');
  };

  const handleRemoveService = (serviceId: string) => {
    setServices(services.filter(s => s.id !== serviceId));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !rut.trim()) return;

    if (editingCompany) {
      // Modificar datos existentes
      const updated: Company = {
        ...editingCompany,
        rut: formatRut(rut),
        name: name.trim().toUpperCase(),
        tradeName: tradeName.trim(),
        industry: industry.trim(),
        rubroKey,
        customCategories: categories,
        customUnits: units,
        customWeighablePresets: weighablePresets,
        customServices: services,
        phone: phone.trim(),
        address: address.trim(),
        isNaturalPerson,
        simpleApiKey: simpleApiKey.trim(),
        siiAmbiente,
        resolucionNumero: resolucionNumero.trim(),
        resolucionFecha: resolucionFecha.trim(),
        updatedAt: new Date().toISOString()
      };
      await db.companies.put(updated);
    } else {
      // Nuevo registro
      const newCompany: Company = {
        id: 'comp_' + Date.now(),
        rut: formatRut(rut),
        name: name.trim().toUpperCase(),
        tradeName: tradeName.trim(),
        industry: industry.trim(),
        rubroKey,
        customCategories: categories,
        customUnits: units,
        customWeighablePresets: weighablePresets,
        customServices: services,
        phone: phone.trim(),
        address: address.trim(),
        isNaturalPerson,
        simpleApiKey: simpleApiKey.trim(),
        siiAmbiente,
        resolucionNumero: resolucionNumero.trim(),
        resolucionFecha: resolucionFecha.trim(),
        createdAt: new Date().toISOString()
      };
      await db.companies.add(newCompany);
    }

    notifyLocalMutation();
    window.dispatchEvent(new CustomEvent('marketalmacen-data-updated'));
    await reloadCompanies();
    setIsAdding(false);
    setEditingCompany(null);
  };

  const handleDelete = async (id: string, companyName: string) => {
    const prodsCount = await db.products.filter(p => p.companyId === id).count();
    const toolsCount = await db.tools.filter(t => t.companyId === id).count();

    const confirmMsg = `¿Está seguro de ELIMINAR a "${companyName}"?\n\n` +
      `⚠️ BORRADO EN CASCADA TOTAL:\n` +
      `- Se eliminarán permanentemente sus ${prodsCount} producto(s).\n` +
      `- Se eliminarán permanentemente sus ${toolsCount} herramienta(s).\n` +
      `- Se borrarán todas sus guías, bitácoras y trabajadores asociados.\n\n` +
      `Esta acción es definitiva y no se puede deshacer.`;

    if (window.confirm(confirmMsg)) {
      setIsDeletingId(id);
      try {
        await deleteCompanyWithCascade(id);
        notifyLocalMutation();
        window.dispatchEvent(new CustomEvent('marketalmacen-data-updated'));
        await reloadCompanies();
        if (selectedCompanyId === id) {
          setSelectedCompanyId('ALL');
        }
      } catch (err) {
        console.error('Error al eliminar empresa en cascada:', err);
        alert('Ocurrió un error al eliminar la empresa y sus datos.');
      } finally {
        setIsDeletingId(null);
      }
    }
  };

  const rubrosList = getAllRubros();
  const currentRubroDef = getRubroPreset(rubroKey);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className={`w-full max-w-3xl rounded-3xl border ${themeClasses.border} ${themeClasses.card} p-4 sm:p-6 shadow-2xl flex flex-col max-h-[92vh] overflow-hidden`}>
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-700/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-2xl ${themeClasses.badge} shadow-sm`}>
              <Building2 className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <h3 className="font-black text-base sm:text-lg leading-tight text-slate-900 dark:text-white">
                Registro y Configuración de Empresas por Giro
              </h3>
              <p className={`text-xs ${themeClasses.textMuted} font-bold`}>
                Personalice categorías, unidades, venta a granel y servicios comerciales por local
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="my-3.5 overflow-y-auto space-y-4 pr-1 flex-1">
          {!isAdding ? (
            <div>
              <div className="flex justify-between items-center mb-3">
                <span className="text-xs font-black text-slate-500 dark:text-slate-400">
                  {companies.length} Entidades Registradas
                </span>
                <button
                  onClick={openNewForm}
                  className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-black rounded-xl ${themeClasses.accentBg} ${themeClasses.accentHover} transition text-white shadow-md cursor-pointer`}
                >
                  <Plus className="w-4 h-4" />
                  Inscribir Nueva Empresa por Giro
                </button>
              </div>

              <div className="space-y-2.5">
                {companies.map((c) => {
                  const rubro = getRubroPreset(c.rubroKey);
                  return (
                    <div
                      key={c.id}
                      className={`p-4 rounded-2xl border ${themeClasses.border} ${themeClasses.cardSubtle} flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs hover:border-orange-500/40 transition`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-3 rounded-2xl shrink-0 ${c.isNaturalPerson ? 'bg-indigo-500/15 text-indigo-400' : 'bg-orange-500/15 text-orange-400'}`}>
                          <span className="text-xl">{rubro.icon}</span>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-black text-sm text-slate-900 dark:text-slate-100">{c.name}</h4>
                            <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-orange-500/15 text-orange-600 dark:text-orange-300 font-extrabold border border-orange-500/30">
                              {rubro.icon} {rubro.name}
                            </span>
                            {c.isNaturalPerson && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-medium">
                                Persona Natural
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1 flex-wrap font-medium">
                            <span>RUT: <strong className="text-slate-700 dark:text-slate-200">{c.rut}</strong></span>
                            {c.phone && <span>Tel: {c.phone}</span>}
                            <span>Giro: <strong className="text-slate-700 dark:text-slate-200">{c.industry || rubro.name}</strong></span>
                            {c.customServices && c.customServices.length > 0 && (
                              <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                                ✨ {c.customServices.filter(s => s.active).length} Servicios Activos
                              </span>
                            )}
                          </div>
                          {c.address && (
                            <p className="text-[11px] text-slate-400 mt-0.5 truncate">{c.address}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                        <button
                          onClick={() => {
                            setSelectedCompanyId(c.id);
                            onClose();
                          }}
                          className={`px-3.5 py-1.5 text-xs font-black rounded-xl transition cursor-pointer ${
                            selectedCompanyId === c.id
                              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/30'
                              : 'bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200'
                          }`}
                        >
                          {selectedCompanyId === c.id ? '✓ Activa' : 'Seleccionar'}
                        </button>

                        <button
                          onClick={() => openEditForm(c)}
                          className="p-2 text-slate-500 hover:text-orange-500 hover:bg-orange-500/10 rounded-xl transition cursor-pointer"
                          title="Modificar datos y rubro de la empresa"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => handleDelete(c.id, c.name)}
                          disabled={isDeletingId === c.id}
                          className="p-2 text-slate-500 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition disabled:opacity-50 cursor-pointer"
                          title="Eliminar empresa y todos sus datos"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-4 bg-slate-50 dark:bg-slate-900/80 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800">
              <div className="flex justify-between items-center pb-2.5 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <Briefcase className="w-4.5 h-4.5 text-orange-500" />
                  <h4 className="font-black text-sm sm:text-base text-slate-900 dark:text-white">
                    {editingCompany ? 'Modificar Empresa y Giro Comercial' : 'Inscripción de Nueva Empresa por Giro'}
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={handleCancelForm}
                  className="text-xs font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                >
                  Cancelar
                </button>
              </div>

              {/* 1. SELECCIÓN VISUAL DE GIRO COMERCIAL */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <span>1. Seleccione el Giro / Rubro Principal del Negocio *</span>
                    <span className="text-[10px] text-orange-600 font-bold">(Adapta productos, granel y servicios)</span>
                  </label>
                  {editingCompany && (
                    <button
                      type="button"
                      onClick={() => handleSelectRubro(rubroKey, true)}
                      className="text-[10px] font-bold text-blue-600 hover:underline cursor-pointer"
                      title="Restablece las categorías y unidades a las sugeridas por este rubro"
                    >
                      ↺ Recargar Valores por Defecto
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {rubrosList.map((r) => {
                    const isSelected = rubroKey === r.key;
                    return (
                      <button
                        key={r.key}
                        type="button"
                        onClick={() => handleSelectRubro(r.key, !editingCompany)}
                        className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer ${
                          isSelected
                            ? 'border-orange-500 bg-orange-500/10 shadow-sm ring-1 ring-orange-500'
                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 hover:border-slate-400'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{r.icon}</span>
                          <span className="text-xs font-black leading-tight text-slate-900 dark:text-slate-100">
                            {r.name}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                          {r.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. DATOS GENERALES */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-xs font-black text-slate-800 dark:text-slate-200 mb-1">
                    Razón Social / Nombre Comercial *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ej: FERRETERÍA CENTRAL SpA"
                    className={`w-full px-3 py-2 text-xs font-bold rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-slate-900 dark:text-slate-100`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-800 dark:text-slate-200 mb-1">
                    RUT Emisor *
                  </label>
                  <input
                    type="text"
                    required
                    value={rut}
                    onChange={(e) => setRut(e.target.value)}
                    placeholder="Ej: 76.852.140-5"
                    className={`w-full px-3 py-2 text-xs font-bold rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-slate-900 dark:text-slate-100`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-800 dark:text-slate-200 mb-1">
                    Giro Comercial Específico (SII)
                  </label>
                  <input
                    type="text"
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    placeholder={currentRubroDef.name}
                    className={`w-full px-3 py-2 text-xs font-bold rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-slate-900 dark:text-slate-100`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-800 dark:text-slate-200 mb-1">
                    Dirección Casa Matriz / Local
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Ej: Av. Comercio 450, Santiago"
                    className={`w-full px-3 py-2 text-xs font-bold rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-slate-900 dark:text-slate-100`}
                  />
                </div>
              </div>

              {/* 3. CONFIGURACIÓN DE VENTA POR PESO / GRANEL / METROS DE ESTE RUBRO */}
              <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-800/70 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center gap-2">
                  <Scale className="w-4 h-4 text-emerald-500" />
                  <h5 className="text-xs font-black text-slate-900 dark:text-slate-100">
                    Artículos de Venta Fraccionada para {currentRubroDef.name}
                  </h5>
                </div>
                <p className="text-[11px] text-slate-500">
                  Al presionar el botón <code>{currentRubroDef.saleButtonLabel}</code> en el POS, los vendedores verán estas variedades:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {weighablePresets.map((wp) => (
                    <span
                      key={wp.id}
                      className="px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-black border border-emerald-500/30 flex items-center gap-1.5"
                    >
                      <span>{wp.icon}</span>
                      <span>{wp.name}</span>
                      <span className="opacity-60 text-[10px]">({wp.unitLabel})</span>
                    </span>
                  ))}
                </div>
              </div>

              {/* 4. GESTIÓN DE SERVICIOS Y OPCIONES DE VENTA ADICIONALES */}
              <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-800/70 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <h5 className="text-xs font-black text-slate-900 dark:text-slate-100">
                      Opciones de Ventas y Servicios Autorizados para este Negocio
                    </h5>
                  </div>
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-extrabold">
                    Facultad del SuperAdmin
                  </span>
                </div>

                <div className="space-y-2">
                  {services.map((srv) => (
                    <div
                      key={srv.id}
                      className="flex items-center justify-between p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-base">{srv.icon || '✨'}</span>
                        <div>
                          <p className="text-xs font-black text-slate-900 dark:text-slate-100">{srv.name}</p>
                          {srv.description && (
                            <p className="text-[10px] text-slate-500">{srv.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggleService(srv.id)}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-black cursor-pointer transition ${
                            srv.active
                              ? 'bg-emerald-500 text-white'
                              : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {srv.active ? 'Habilitado' : 'Desactivado'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveService(srv.id)}
                          className="text-slate-400 hover:text-red-500 p-1 cursor-pointer"
                          title="Eliminar este servicio"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Agregar Nuevo Servicio Personalizado */}
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700/60 flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={newServiceName}
                    onChange={(e) => setNewServiceName(e.target.value)}
                    placeholder="Ej: Corte de Fierro a Medida, Bastas, Despacho a Obra..."
                    className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold"
                  />
                  <input
                    type="text"
                    value={newServiceDesc}
                    onChange={(e) => setNewServiceDesc(e.target.value)}
                    placeholder="Descripción breve..."
                    className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-medium"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomService}
                    className="px-3 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-black shrink-0 transition flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Agregar Servicio</span>
                  </button>
                </div>
              </div>

              {/* 5. CATEGORÍAS DISPONIBLES EN INVENTARIO */}
              <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-800/70 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-blue-500" />
                  <h5 className="text-xs font-black text-slate-900 dark:text-slate-100">
                    Familias y Categorías de Inventario para {currentRubroDef.name}
                  </h5>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1">
                  {categories.map((cat) => (
                    <span
                      key={cat}
                      className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold border border-slate-200 dark:border-slate-700 flex items-center gap-1.5"
                    >
                      <Tag className="w-3 h-3 text-blue-500" />
                      <span>{cat}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveCategory(cat)}
                        className="text-slate-400 hover:text-red-500 ml-0.5 cursor-pointer"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2 pt-1">
                  <input
                    type="text"
                    value={newCatInput}
                    onChange={(e) => setNewCatInput(e.target.value)}
                    placeholder="Nueva categoría o familia..."
                    className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCategory();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleAddCategory}
                    className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-black cursor-pointer"
                  >
                    + Añadir
                  </button>
                </div>
              </div>

              {/* Botones de Acción */}
              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={handleCancelForm}
                  className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={`flex items-center gap-1.5 px-5 py-2 text-xs font-black rounded-xl ${themeClasses.accentBg} ${themeClasses.accentHover} transition text-white shadow-md cursor-pointer`}
                >
                  <Check className="w-4 h-4" />
                  {editingCompany ? 'Guardar Cambios de Empresa' : 'Registrar Empresa con este Giro'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
