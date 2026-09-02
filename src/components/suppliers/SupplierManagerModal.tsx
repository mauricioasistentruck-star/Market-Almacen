import { useBodyScrollLock } from '../../utils/scrollLock';
import React, { useState, useEffect, useMemo } from 'react';
import { useTheme } from '../../utils/themeContext';
import { useCompany } from '../../utils/companyContext';
import { db } from '../../db/database';
import { formatRut } from '../../utils/barcodeGenerator';
import { notifyLocalMutation } from '../../utils/cloudSync';
import type { Supplier } from '../../types';
import {
  X,
  Truck,
  Plus,
  Search,
  Pencil,
  Trash2,
  Check,
  Building2,
  Phone,
  Mail,
  MapPin,
  Calendar,
  CreditCard,
  FileText
} from 'lucide-react';

interface SupplierManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SupplierManagerModal: React.FC<SupplierManagerModalProps> = ({
  isOpen,
  onClose
}) => {
  useBodyScrollLock(Boolean(isOpen));
  const { themeClasses } = useTheme();
  const { selectedCompanyId, selectedCompany } = useCompany();

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  // Campos del Formulario
  const [rut, setRut] = useState('');
  const [name, setName] = useState('');
  const [tradeName, setTradeName] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [industry, setIndustry] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('Contado');
  const [notes, setNotes] = useState('');

  const loadSuppliers = async () => {
    try {
      const all = await db.suppliers.toArray();
      const filtered = all.filter(s => {
        if (!s.companyId || selectedCompanyId === 'ALL') return true;
        return s.companyId === selectedCompanyId;
      });
      setSuppliers(filtered);
    } catch (err) {
      console.error('Error al cargar proveedores:', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadSuppliers();
      setIsFormOpen(false);
      setEditingSupplier(null);
    }
  }, [isOpen, selectedCompanyId]);

  const openNewForm = () => {
    setEditingSupplier(null);
    setRut('');
    setName('');
    setTradeName('');
    setContactName('');
    setPhone('');
    setEmail('');
    setAddress('');
    setCity('');
    setIndustry('');
    setPaymentTerms('Contado');
    setNotes('');
    setIsFormOpen(true);
  };

  const openEditForm = (sup: Supplier) => {
    setEditingSupplier(sup);
    setRut(sup.rut || '');
    setName(sup.name || '');
    setTradeName(sup.tradeName || '');
    setContactName(sup.contactName || '');
    setPhone(sup.phone || '');
    setEmail(sup.email || '');
    setAddress(sup.address || '');
    setCity(sup.city || '');
    setIndustry(sup.industry || '');
    setPaymentTerms(sup.paymentTerms || 'Contado');
    setNotes(sup.notes || '');
    setIsFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !rut.trim()) {
      alert('Por favor ingrese al menos el RUT y la Razón Social del proveedor.');
      return;
    }

    const formattedRut = formatRut(rut.trim());

    if (editingSupplier && editingSupplier.id) {
      await db.suppliers.update(editingSupplier.id, {
        rut: formattedRut,
        name: name.trim().toUpperCase(),
        tradeName: tradeName.trim(),
        contactName: contactName.trim(),
        phone: phone.trim(),
        email: email.trim().toLowerCase(),
        address: address.trim(),
        city: city.trim(),
        industry: industry.trim(),
        paymentTerms,
        notes: notes.trim(),
        updatedAt: new Date().toISOString()
      });
    } else {
      const newSup: Supplier = {
        rut: formattedRut,
        name: name.trim().toUpperCase(),
        tradeName: tradeName.trim(),
        contactName: contactName.trim(),
        phone: phone.trim(),
        email: email.trim().toLowerCase(),
        address: address.trim(),
        city: city.trim(),
        industry: industry.trim(),
        paymentTerms,
        notes: notes.trim(),
        companyId: selectedCompanyId !== 'ALL' ? selectedCompanyId : undefined,
        createdAt: new Date().toISOString()
      };
      await db.suppliers.add(newSup);
    }

    notifyLocalMutation();
    await loadSuppliers();
    setIsFormOpen(false);
    setEditingSupplier(null);
  };

  const handleDelete = async (sup: Supplier) => {
    if (!sup.id) return;
    if (window.confirm(`¿Está seguro de eliminar al proveedor "${sup.name}"?`)) {
      await db.suppliers.delete(sup.id);
      notifyLocalMutation();
      await loadSuppliers();
    }
  };

  const filteredList = useMemo(() => {
    if (!searchTerm.trim()) return suppliers;
    const term = searchTerm.toLowerCase();
    return suppliers.filter(s =>
      s.rut.toLowerCase().includes(term) ||
      s.name.toLowerCase().includes(term) ||
      (s.tradeName && s.tradeName.toLowerCase().includes(term)) ||
      (s.contactName && s.contactName.toLowerCase().includes(term)) ||
      (s.industry && s.industry.toLowerCase().includes(term))
    );
  }, [suppliers, searchTerm]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className={`w-full max-w-3xl rounded-3xl border-2 ${themeClasses.border} ${themeClasses.card} p-4 sm:p-6 shadow-2xl flex flex-col max-h-[92vh] overflow-hidden`}>
        
        {/* Encabezado */}
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-700/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/15 text-amber-500 shadow-sm">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-base sm:text-lg leading-tight text-slate-900 dark:text-white">
                  Registro y Gestión de Proveedores
                </h3>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-300 font-extrabold border border-amber-500/30">
                  {selectedCompany?.name || 'Comercio'}
                </span>
              </div>
              <p className={`text-xs ${themeClasses.textMuted} font-bold`}>
                Distribuidores mayoristas, marcas y condiciones de compra
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

        {/* Contenido */}
        <div className="my-3.5 overflow-y-auto space-y-4 pr-1 flex-1">
          {!isFormOpen ? (
            <div>
              {/* Barra Superior: Búsqueda y Botón Nuevo */}
              <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2.5 mb-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar proveedor por RUT, Razón Social, Giro o Contacto..."
                    className="w-full pl-9 pr-3 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  />
                </div>
                <button
                  onClick={openNewForm}
                  className={`flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-black rounded-xl ${themeClasses.accentBg} ${themeClasses.accentHover} transition text-white shadow-md cursor-pointer shrink-0`}
                >
                  <Plus className="w-4 h-4" />
                  Inscribir Proveedor
                </button>
              </div>

              {/* Contador */}
              <div className="flex justify-between items-center text-xs font-bold text-slate-500 mb-2">
                <span>{filteredList.length} Proveedores Registrados</span>
              </div>

              {/* Listado de Tarjetas */}
              {filteredList.length > 0 ? (
                <div className="space-y-2.5">
                  {filteredList.map((sup) => (
                    <div
                      key={sup.id}
                      className={`p-3.5 rounded-2xl border ${themeClasses.border} ${themeClasses.cardSubtle} flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs hover:border-amber-500/40 transition`}
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500 shrink-0 mt-0.5">
                          <Building2 className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-black text-sm text-slate-900 dark:text-slate-100">{sup.name}</h4>
                            {sup.tradeName && (
                              <span className="text-xs text-slate-500 font-bold">({sup.tradeName})</span>
                            )}
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-extrabold">
                              {sup.paymentTerms || 'Contado'}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1 flex-wrap font-medium">
                            <span>RUT: <strong className="text-slate-700 dark:text-slate-200">{sup.rut}</strong></span>
                            {sup.industry && <span>Giro: <strong className="text-slate-700 dark:text-slate-200">{sup.industry}</strong></span>}
                            {sup.contactName && <span>Vendedor: {sup.contactName}</span>}
                            {sup.phone && <span>Tel: {sup.phone}</span>}
                            {sup.email && <span>Email: {sup.email}</span>}
                          </div>
                          {sup.address && (
                            <p className="text-[11px] text-slate-400 mt-0.5 truncate flex items-center gap-1">
                              <MapPin className="w-3 h-3 shrink-0" />
                              <span>{sup.address}{sup.city ? `, ${sup.city}` : ''}</span>
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                        <button
                          onClick={() => openEditForm(sup)}
                          className="p-2 text-slate-500 hover:text-amber-500 hover:bg-amber-500/10 rounded-xl transition cursor-pointer"
                          title="Modificar datos del proveedor"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(sup)}
                          className="p-2 text-slate-500 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition cursor-pointer"
                          title="Eliminar proveedor"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 text-slate-500">
                  <Truck className="w-10 h-10 mx-auto mb-2 opacity-30 text-amber-500" />
                  <p className="text-sm font-bold">No se encontraron proveedores registrados</p>
                  <p className="text-xs mt-1">Presione el botón "+ Inscribir Proveedor" para registrar su primer distribuidor mayorista.</p>
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-4 bg-slate-50 dark:bg-slate-900/80 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800">
              <div className="flex justify-between items-center pb-2.5 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <Truck className="w-4.5 h-4.5 text-amber-500" />
                  <h4 className="font-black text-sm sm:text-base text-slate-900 dark:text-white">
                    {editingSupplier ? 'Modificar Datos de Proveedor' : 'Inscripción de Nuevo Proveedor'}
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="text-xs font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                >
                  Cancelar
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-slate-800 dark:text-slate-200 mb-1">
                    RUT del Proveedor *
                  </label>
                  <input
                    type="text"
                    required
                    value={rut}
                    onChange={(e) => setRut(e.target.value)}
                    placeholder="Ej: 76.543.210-K"
                    className={`w-full px-3 py-2 text-xs font-bold rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-slate-900 dark:text-slate-100`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-800 dark:text-slate-200 mb-1">
                    Razón Social / Nombre Comercial *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ej: DISTRIBUIDORA CENTRAL LIMITADA"
                    className={`w-full px-3 py-2 text-xs font-bold uppercase rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-slate-900 dark:text-slate-100`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-800 dark:text-slate-200 mb-1">
                    Nombre de Fantasía
                  </label>
                  <input
                    type="text"
                    value={tradeName}
                    onChange={(e) => setTradeName(e.target.value)}
                    placeholder="Ej: Central Alimentos"
                    className={`w-full px-3 py-2 text-xs font-bold rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-slate-900 dark:text-slate-100`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-800 dark:text-slate-200 mb-1">
                    Giro Comercial
                  </label>
                  <input
                    type="text"
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    placeholder="Ej: Venta Mayorista de Abarrotes y Cecinas"
                    className={`w-full px-3 py-2 text-xs font-bold rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-slate-900 dark:text-slate-100`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-800 dark:text-slate-200 mb-1">
                    Vendedor / Contacto Comercial
                  </label>
                  <input
                    type="text"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="Ej: Carlos Muñoz (Ejecutivo)"
                    className={`w-full px-3 py-2 text-xs font-bold rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-slate-900 dark:text-slate-100`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-800 dark:text-slate-200 mb-1">
                    Teléfono / WhatsApp
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+56 9 8765 4321"
                    className={`w-full px-3 py-2 text-xs font-bold rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-slate-900 dark:text-slate-100`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-800 dark:text-slate-200 mb-1">
                    Correo Electrónico de Pedidos
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="pedidos@proveedor.cl"
                    className={`w-full px-3 py-2 text-xs font-bold rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-slate-900 dark:text-slate-100`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-800 dark:text-slate-200 mb-1">
                    Condiciones de Pago
                  </label>
                  <select
                    value={paymentTerms}
                    onChange={(e) => setPaymentTerms(e.target.value)}
                    className={`w-full px-3 py-2 text-xs font-bold rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-slate-900 dark:text-slate-100`}
                  >
                    <option value="Contado">Pago Contado / Contra Entrega</option>
                    <option value="15 días">Crédito 15 Días</option>
                    <option value="30 días">Crédito 30 Días</option>
                    <option value="45 días">Crédito 45 Días</option>
                    <option value="60 días">Crédito 60 Días</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-800 dark:text-slate-200 mb-1">
                    Dirección Casa Matriz / Bodega
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Av. Industrial 4500"
                    className={`w-full px-3 py-2 text-xs font-bold rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-slate-900 dark:text-slate-100`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-800 dark:text-slate-200 mb-1">
                    Comuna / Ciudad
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Santiago"
                    className={`w-full px-3 py-2 text-xs font-bold rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-slate-900 dark:text-slate-100`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-800 dark:text-slate-200 mb-1">
                  Notas u Observaciones Internas
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Días de despacho, monto mínimo de compra, etc."
                  className={`w-full px-3 py-2 text-xs font-medium rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-slate-900 dark:text-slate-100`}
                />
              </div>

              {/* Botones */}
              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={`flex items-center gap-1.5 px-5 py-2 text-xs font-black rounded-xl ${themeClasses.accentBg} ${themeClasses.accentHover} transition text-white shadow-md cursor-pointer`}
                >
                  <Check className="w-4 h-4" />
                  {editingSupplier ? 'Guardar Cambios' : 'Registrar Proveedor'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
