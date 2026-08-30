import { useBodyScrollLock } from '../../utils/scrollLock';
import React, { useState } from 'react';
import { useCompany } from '../../utils/companyContext';
import { useAuth } from '../../utils/authContext';
import { useTheme } from '../../utils/themeContext';
import { X, Building2, Plus, User, Check, Trash2, Pencil, AlertTriangle } from 'lucide-react';
import { db, deleteCompanyWithCascade } from '../../db/database';
import { formatRut } from '../../utils/barcodeGenerator';
import { notifyLocalMutation } from '../../utils/cloudSync';
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

  if (!isOpen || !isSuperAdmin) return null;

  const openNewForm = () => {
    setEditingCompany(null);
    setRut('');
    setName('');
    setTradeName('');
    setIndustry('');
    setPhone('');
    setAddress('');
    setIsNaturalPerson(false);
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
    setIsAdding(true);
  };

  const handleCancelForm = () => {
    setIsAdding(false);
    setEditingCompany(null);
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
        phone: phone.trim(),
        address: address.trim(),
        isNaturalPerson,
        updatedAt: new Date().toISOString()
      };
      await db.companies.put(updated);
    } else {
      // Crear nueva empresa o persona
      const id = isNaturalPerson ? `pers-${Date.now()}` : `emp-${Date.now()}`;
      await db.companies.put({
        id,
        rut: formatRut(rut),
        name: name.trim().toUpperCase(),
        tradeName: tradeName.trim(),
        industry: industry.trim(),
        phone: phone.trim(),
        address: address.trim(),
        isNaturalPerson,
        createdAt: new Date().toISOString()
      });
      setSelectedCompanyId(id);
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className={`w-full max-w-2xl rounded-2xl border ${themeClasses.border} ${themeClasses.card} p-5 shadow-2xl flex flex-col max-h-[90vh]`}>
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-700/50">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-lg ${themeClasses.badge}`}>
              <Building2 className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">Registro de Empresas y Personas</h3>
              <p className={`text-xs ${themeClasses.textMuted}`}>Gestión de razones sociales y contratistas de bodega</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="my-4 overflow-y-auto space-y-4 pr-1 flex-1">
          {!isAdding ? (
            <div>
              <div className="flex justify-between items-center mb-3">
                <span className="text-xs font-semibold text-slate-400">
                  {companies.length} Entidades Registradas
                </span>
                <button
                  onClick={openNewForm}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl ${themeClasses.accentBg} ${themeClasses.accentHover} transition`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Inscribir Nueva Empresa / Persona
                </button>
              </div>

              <div className="space-y-2">
                {companies.map((c) => (
                  <div
                    key={c.id}
                    className={`p-3.5 rounded-xl border ${themeClasses.border} ${themeClasses.cardSubtle} flex flex-col sm:flex-row sm:items-center justify-between gap-3`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-xl shrink-0 ${c.isNaturalPerson ? 'bg-indigo-500/10 text-indigo-400' : 'bg-orange-500/10 text-orange-400'}`}>
                        {c.isNaturalPerson ? <User className="w-5 h-5" /> : <Building2 className="w-5 h-5" />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-sm text-slate-100">{c.name}</h4>
                          {c.isNaturalPerson && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-medium">
                              Persona Natural
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 flex-wrap">
                          <span>RUT: <strong className="text-slate-300">{c.rut}</strong></span>
                          {c.phone && <span>Tel: {c.phone}</span>}
                          {c.industry && <span>Giro: {c.industry}</span>}
                        </div>
                        {c.address && (
                          <p className="text-[11px] text-slate-500 mt-0.5 truncate">{c.address}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                      <button
                        onClick={() => {
                          setSelectedCompanyId(c.id);
                          onClose();
                        }}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                          selectedCompanyId === c.id
                            ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-500/30'
                            : 'bg-slate-700/60 hover:bg-slate-700 text-slate-200'
                        }`}
                      >
                        {selectedCompanyId === c.id ? 'Seleccionada' : 'Seleccionar'}
                      </button>

                      {/* Boton Modificar / Editar */}
                      <button
                        onClick={() => openEditForm(c)}
                        className="p-1.5 text-slate-400 hover:text-orange-400 hover:bg-orange-500/10 rounded-lg transition"
                        title="Modificar datos de la empresa"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>

                      {/* Boton Eliminar con Cascada */}
                      <button
                        onClick={() => handleDelete(c.id, c.name)}
                        disabled={isDeletingId === c.id}
                        className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition disabled:opacity-50"
                        title="Eliminar empresa y todos sus productos"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-3.5 bg-slate-900/60 p-4 rounded-xl border border-slate-700/50">
              <div className="flex justify-between items-center pb-2 border-b border-slate-700/50">
                <div className="flex items-center gap-2">
                  {editingCompany ? <Pencil className="w-4 h-4 text-orange-400" /> : <Plus className="w-4 h-4 text-orange-400" />}
                  <h4 className="font-bold text-sm text-orange-400">
                    {editingCompany ? 'Modificar Datos de la Empresa / Persona' : 'Nueva Razón Social o Persona'}
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={handleCancelForm}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
              </div>

              <div className="flex items-center gap-4 bg-slate-800/60 p-2.5 rounded-lg">
                <label className="text-xs font-medium text-slate-300">Tipo de Registro:</label>
                <div className="flex gap-4 text-xs">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      checked={!isNaturalPerson}
                      onChange={() => setIsNaturalPerson(false)}
                      className="accent-orange-500"
                    />
                    <span>Empresa / Razón Social</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      checked={isNaturalPerson}
                      onChange={() => setIsNaturalPerson(true)}
                      className="accent-orange-500"
                    />
                    <span>Persona Natural (Temporal)</span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    {isNaturalPerson ? 'Nombre Completo *' : 'Razón Social / Nombre Empresa *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={isNaturalPerson ? 'JUAN PÉREZ SOTO' : 'TRANSPORTES SANTA FE SpA'}
                    className={`w-full px-3 py-2 text-sm uppercase rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg}`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">RUT / DNI *</label>
                  <input
                    type="text"
                    required
                    value={rut}
                    onChange={(e) => setRut(e.target.value)}
                    placeholder="76.123.456-7"
                    className={`w-full px-3 py-2 text-sm rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg}`}
                  />
                </div>

                {!isNaturalPerson && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Nombre de Fantasía (Opcional)</label>
                      <input
                        type="text"
                        value={tradeName}
                        onChange={(e) => setTradeName(e.target.value)}
                        placeholder="Santa Fe Logistics"
                        className={`w-full px-3 py-2 text-sm rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg}`}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Giro / Actividad</label>
                      <input
                        type="text"
                        value={industry}
                        onChange={(e) => setIndustry(e.target.value)}
                        placeholder="Transporte y Maquinaria Pesada"
                        className={`w-full px-3 py-2 text-sm rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg}`}
                      />
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Teléfono de Contacto</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+56 9 1234 5678"
                    className={`w-full px-3 py-2 text-sm rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg}`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Dirección / Faena</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Av. Minería 1200"
                    className={`w-full px-3 py-2 text-sm rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg}`}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleCancelForm}
                  className="px-4 py-2 text-xs rounded-xl border border-slate-600 hover:bg-slate-800 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={`flex items-center gap-1.5 px-5 py-2 text-xs font-semibold rounded-xl ${themeClasses.accentBg} ${themeClasses.accentHover} transition text-white shadow-md`}
                >
                  <Check className="w-4 h-4" />
                  {editingCompany ? 'Guardar Cambios' : 'Guardar Registro'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center pt-3 border-t border-slate-700/50">
          <button
            onClick={() => {
              setSelectedCompanyId('ALL');
              onClose();
            }}
            className="text-xs text-orange-400 hover:underline font-semibold"
          >
            Ver Todas las Empresas (Modo Consolidado)
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium rounded-xl border border-slate-600 hover:bg-slate-800 transition"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
