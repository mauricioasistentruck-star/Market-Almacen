import { useBodyScrollLock } from '../../utils/scrollLock';
import React, { useState, useEffect } from 'react';
import { useTheme } from '../../utils/themeContext';
import { useCompany } from '../../utils/companyContext';
import { db } from '../../db/database';
import type { Worker, WorkerType } from '../../types';
import { formatRut } from '../../utils/barcodeGenerator';
import { notifyLocalMutation } from '../../utils/cloudSync';
import {
  X, Plus, Pencil, Trash2, UserRound, Search, Phone, Building2, Briefcase, Check, AlertCircle
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const WORKER_TYPES: { value: WorkerType; label: string; color: string }[] = [
  { value: 'TRABAJADOR', label: 'Trabajador / Personal', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  { value: 'PROVEEDOR',  label: 'Proveedor / Contratista', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  { value: 'TRANSPORTISTA', label: 'Transportista / Chofer', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  { value: 'OTRO',       label: 'Otro',        color: 'bg-slate-500/20 text-slate-400 border-slate-500/30' },
];

const EMPTY: Omit<Worker, 'id' | 'createdAt'> = {
  name: '', rut: '', phone: '', company: '', role: '', type: 'TRABAJADOR', companyId: ''
};

export const WorkersModal: React.FC<Props> = ({ isOpen, onClose }) => {
  useBodyScrollLock(Boolean(isOpen));
  const { themeClasses } = useTheme();
  const { selectedCompanyId, companies } = useCompany();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<WorkerType | 'ALL'>('ALL');
  const [editing, setEditing] = useState<Worker | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });

  const currentCompany = companies.find(c => c.id === selectedCompanyId);
  const defaultCompanyId = selectedCompanyId === 'ALL' ? (companies[0]?.id || '') : selectedCompanyId;
  const defaultCompanyName = selectedCompanyId === 'ALL' ? (companies[0]?.name || '') : (currentCompany?.name || '');

  useEffect(() => { if (isOpen) load(); }, [isOpen]);

  const load = async () => {
    const all = await db.workers.toArray();
    setWorkers(all.sort((a, b) => a.name.localeCompare(b.name)));
  };

  const filtered = workers.filter(w => {
    const matchSearch = !search ||
      w.name.toLowerCase().includes(search.toLowerCase()) ||
      (w.rut && w.rut.toLowerCase().includes(search.toLowerCase())) ||
      (w.company && w.company.toLowerCase().includes(search.toLowerCase())) ||
      (w.role && w.role.toLowerCase().includes(search.toLowerCase()));
    const matchType = filterType === 'ALL' || w.type === filterType;
    return matchSearch && matchType;
  });

  const openNew = () => {
    setEditing(null);
    setForm({
      ...EMPTY,
      company: defaultCompanyName,
      companyId: defaultCompanyId
    });
    setIsFormOpen(true);
  };

  const openEdit = (w: Worker) => {
    setEditing(w);
    setForm({
      name: w.name,
      rut: w.rut || '',
      phone: w.phone || '',
      company: w.company || '',
      role: w.role || '',
      type: w.type,
      companyId: w.companyId || defaultCompanyId
    });
    setIsFormOpen(true);
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!form.name.trim()) {
      alert('El nombre de la persona es obligatorio.');
      return;
    }

    const data: Worker = {
      ...form,
      name: form.name.trim().toUpperCase(),
      rut: form.rut?.trim() ? formatRut(form.rut) : undefined,
      phone: form.phone?.trim() || undefined,
      company: form.company?.trim().toUpperCase() || undefined,
      role: form.role?.trim().toUpperCase() || undefined,
      companyId: form.companyId || defaultCompanyId,
      createdAt: editing?.createdAt || new Date().toISOString()
    };

    if (editing?.id) {
      await db.workers.update(editing.id, data);
    } else {
      await db.workers.add(data);
    }

    notifyLocalMutation();
    window.dispatchEvent(new CustomEvent('marketalmacen-data-updated'));
    setIsFormOpen(false);
    setEditing(null);
    await load();
  };

  const handleDelete = async (w: Worker) => {
    if (!window.confirm(`¿Está seguro de eliminar a "${w.name}" del registro de personal?`)) return;
    if (w.id) {
      await db.workers.delete(w.id);
      notifyLocalMutation();
      window.dispatchEvent(new CustomEvent('marketalmacen-data-updated'));
      await load();
    }
  };

  if (!isOpen) return null;

  const typeInfo = (t: WorkerType) => WORKER_TYPES.find(x => x.value === t);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className={`w-full max-w-3xl rounded-3xl border ${themeClasses.border} ${themeClasses.card} p-5 shadow-2xl flex flex-col max-h-[90vh]`}>
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-orange-500/20 text-orange-400 border border-orange-500/30">
              <UserRound className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-black text-base sm:text-lg text-slate-100">Personal y Trabajadores</h3>
              <p className="text-xs text-slate-400">Mecánicos, choferes, supervisores, contratistas y proveedores</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={openNew}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl ${themeClasses.accentBg} ${themeClasses.accentHover} text-white shadow-md transition`}
            >
              <Plus className="w-4 h-4" />
              <span>Registrar Personal</span>
            </button>
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 pt-3 shrink-0 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nombre, RUT, empresa o cargo..."
              className={`w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-slate-200`}
            />
          </div>
          <div className="flex gap-1 flex-wrap">
            {(['ALL', ...WORKER_TYPES.map(t => t.value)] as const).map(t => (
              <button
                key={t}
                onClick={() => setFilterType(t as any)}
                className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition ${
                  filterType === t ? 'bg-orange-600 border-orange-500 text-white' : 'border-slate-700 text-slate-400 hover:bg-slate-800'
                }`}
              >
                {t === 'ALL' ? 'Todos' : WORKER_TYPES.find(x => x.value === t)?.label.split('/')[0]}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="overflow-y-auto flex-1 mt-3 space-y-2 pr-1">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <UserRound className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-semibold">Sin personal registrado</p>
              <p className="text-xs mt-1">Haz clic en "Registrar Personal" para agregar mecánicos, choferes o proveedores.</p>
            </div>
          ) : (
            filtered.map(w => {
              const ti = typeInfo(w.type);
              return (
                <div
                  key={w.id}
                  className={`flex items-center gap-3 p-3.5 rounded-2xl border ${themeClasses.border} ${themeClasses.card} hover:border-slate-600 transition`}
                >
                  <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0">
                    <UserRound className="w-5 h-5 text-orange-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-slate-100 truncate">{w.name}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${ti?.color}`}>
                        {ti?.label}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                      {w.rut && <span className="text-xs text-slate-300 font-medium">RUT: <strong>{w.rut}</strong></span>}
                      {w.role && (
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <Briefcase className="w-3 h-3 text-orange-400" />{w.role}
                        </span>
                      )}
                      {w.company && (
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-cyan-400" />{w.company}
                        </span>
                      )}
                      {w.phone && (
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <Phone className="w-3 h-3 text-emerald-400" />{w.phone}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => openEdit(w)}
                      className="p-2 text-slate-400 hover:text-orange-400 hover:bg-orange-500/10 rounded-xl transition"
                      title="Modificar datos del trabajador"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(w)}
                      className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition"
                      title="Eliminar trabajador"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Form modal para Crear o Modificar */}
      {isFormOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <form
            onSubmit={handleSave}
            className={`w-full max-w-lg rounded-3xl border ${themeClasses.border} ${themeClasses.card} p-5 shadow-2xl space-y-4 animate-fadeIn`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-700/50">
              <div className="flex items-center gap-2">
                {editing ? <Pencil className="w-4 h-4 text-orange-400" /> : <Plus className="w-4 h-4 text-orange-400" />}
                <h3 className="text-base font-bold text-slate-100">
                  {editing ? 'Modificar Datos de Personal' : 'Registrar Nueva Persona'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => { setIsFormOpen(false); setEditing(null); }}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Nombre Completo *</label>
                <input
                  required
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value.toUpperCase() }))}
                  placeholder="JUAN PÉREZ ROJAS"
                  className={`w-full px-3.5 py-2 text-xs uppercase rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-slate-200`}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">RUT (Opcional)</label>
                  <input
                    value={form.rut || ''}
                    onChange={e => setForm(f => ({ ...f, rut: e.target.value }))}
                    placeholder="12.345.678-9"
                    className={`w-full px-3.5 py-2 text-xs rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-slate-200`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Teléfono</label>
                  <input
                    value={form.phone || ''}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="+56 9 1234 5678"
                    className={`w-full px-3.5 py-2 text-xs rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-slate-200`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Empresa Vinculada</label>
                  {companies.length > 0 ? (
                    <select
                      value={form.companyId || ''}
                      onChange={e => {
                        const cid = e.target.value;
                        const c = companies.find(x => x.id === cid);
                        setForm(f => ({
                          ...f,
                          companyId: cid,
                          company: c ? c.name : f.company
                        }));
                      }}
                      className={`w-full px-3 py-2 text-xs rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-slate-200 mb-1`}
                    >
                      <option value="">-- Seleccionar Empresa --</option>
                      {companies.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  ) : null}
                  <input
                    value={form.company || ''}
                    onChange={e => setForm(f => ({ ...f, company: e.target.value.toUpperCase() }))}
                    placeholder="O escribir nombre empresa..."
                    className={`w-full px-3.5 py-1.5 text-xs uppercase rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-slate-200`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Cargo / Especialidad</label>
                  <input
                    value={form.role || ''}
                    onChange={e => setForm(f => ({ ...f, role: e.target.value.toUpperCase() }))}
                    placeholder="EJ: MECÁNICO SENIOR, CHOFER"
                    className={`w-full px-3.5 py-2 text-xs uppercase rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-slate-200`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">Tipo de Personal</label>
                <div className="grid grid-cols-2 gap-2">
                  {WORKER_TYPES.map(t => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, type: t.value }))}
                      className={`px-3 py-2 rounded-xl text-xs font-bold border transition text-left ${
                        form.type === t.value
                          ? 'bg-orange-600 border-orange-500 text-white shadow-md'
                          : 'border-slate-700 bg-slate-800/60 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-3 border-t border-slate-700/50">
              <button
                type="button"
                onClick={() => { setIsFormOpen(false); setEditing(null); }}
                className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300 text-xs font-bold hover:bg-slate-800 transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className={`flex-1 py-2.5 rounded-xl ${themeClasses.accentBg} ${themeClasses.accentHover} text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-md`}
              >
                <Check className="w-4 h-4" />
                <span>{editing ? 'Guardar Cambios' : 'Registrar Persona'}</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
