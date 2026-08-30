import { useBodyScrollLock } from '../../utils/scrollLock';
import React, { useState, useEffect, useRef } from 'react';
import type { Tool, ToolStatus, ItemCondition, ItemCompleteness } from '../../types';
import { useTheme } from '../../utils/themeContext';
import { useCompany } from '../../utils/companyContext';
import { db } from '../../db/database';
import { getNextToolCode } from '../../utils/barcodeGenerator';
import { triggerCloudSync, notifyLocalMutation } from '../../utils/cloudSync';
import {
  X,
  ScanLine,
  Sparkles,
  Save,
  Wrench,
  Camera,
  Trash2
} from 'lucide-react';

interface ToolFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  toolToEdit?: Tool | null;
  onSaved: () => void;
  onOpenScanner?: () => void;
  initialBarcode?: string;
}

const TOOL_CATEGORIES = [
  'Herramientas Manuales',
  'Herramientas Neumáticas / Impacto',
  'Herramientas Eléctricas / Batería',
  'Medición, Torquímetros y Calibración',
  'Equipos Hidráulicos y Levante',
  'Herramientas de Corte y Desbaste',
  'Equipos de Soldadura',
  'Diagnóstico y Escáneres',
  'Herramientas Especiales Camiones',
  'Otras Herramientas'
];

export const ToolFormModal: React.FC<ToolFormModalProps> = ({
  isOpen,
  onClose,
  toolToEdit,
  onSaved,
  onOpenScanner,
  initialBarcode
}) => {
  useBodyScrollLock(Boolean(isOpen));
  const { themeClasses } = useTheme();
  const { companies, selectedCompanyId } = useCompany();

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [category, setCategory] = useState('Herramientas Manuales');
  const [companyId, setCompanyId] = useState(() => selectedCompanyId !== 'ALL' ? selectedCompanyId : (companies[0]?.id || ''));
  const [location, setLocation] = useState('');
  const [status, setStatus] = useState<ToolStatus>('DISPONIBLE');
  const [condition, setCondition] = useState<ItemCondition>('BUENO');
  const [completeness, setCompleteness] = useState<ItemCompleteness>('COMPLETO');
  const [conditionNotes, setConditionNotes] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const initCode = async () => {
      if (toolToEdit) {
        setCode(toolToEdit.code);
        setName(toolToEdit.name);
        setBrand(toolToEdit.brand || '');
        setModel(toolToEdit.model || '');
        setCategory(toolToEdit.category);
        setCompanyId(toolToEdit.companyId || companies[0]?.id || '');
        setLocation(toolToEdit.location || '');
        setStatus(toolToEdit.status);
        setCondition(toolToEdit.condition || 'BUENO');
        setCompleteness(toolToEdit.completeness || 'COMPLETO');
        setConditionNotes(toolToEdit.conditionNotes || '');
        setImageUrl(toolToEdit.imageUrl || '');
      } else {
        const nextCode = initialBarcode || await getNextToolCode();
        setCode(nextCode);
        setName('');
        setBrand('');
        setModel('');
        setCategory('Herramientas Manuales');
        setCompanyId(selectedCompanyId === 'ALL' ? (companies[0]?.id || '') : selectedCompanyId);
        setLocation('');
        setStatus('DISPONIBLE');
        setCondition('BUENO');
        setCompleteness('COMPLETO');
        setConditionNotes('');
        setImageUrl('');
      }
    };
    if (isOpen) {
      initCode();
    }
  }, [toolToEdit, isOpen, initialBarcode, selectedCompanyId]);

  const handleGenerateSequentialCode = async () => {
    const nextCode = await getNextToolCode();
    setCode(nextCode);
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setImageUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim()) {
      alert('Por favor complete los campos obligatorios (Código y Nombre).');
      return;
    }

    const now = new Date().toISOString();

    const toolData: Tool = {
      code: code.trim().toUpperCase(),
      name: name.trim().toUpperCase(),
      brand: brand.trim().toUpperCase() || undefined,
      model: model.trim().toUpperCase() || undefined,
      category,
      companyId: companyId || (companies[0]?.id || ''),
      location: location.trim().toUpperCase() || 'PAÑOL CENTRAL',
      status,
      condition,
      completeness,
      conditionNotes: conditionNotes.trim().toUpperCase() || undefined,
      imageUrl: imageUrl || undefined,
      createdAt: toolToEdit ? toolToEdit.createdAt : now,
      updatedAt: now
    };

    if (toolToEdit && toolToEdit.id) {
      await db.tools.update(toolToEdit.id, toolData);
    } else {
      const existing = await db.tools.where('code').equals(toolData.code).first();
      if (existing) {
        alert(`Ya existe una herramienta registrada con el código "${toolData.code}".`);
        return;
      }
      await db.tools.add(toolData);
    }

    onSaved();
    notifyLocalMutation();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className={`w-full max-w-2xl rounded-3xl border ${themeClasses.border} ${themeClasses.card} p-5 sm:p-6 shadow-2xl flex flex-col max-h-[92vh]`}>
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-700/60">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl ${themeClasses.badge}`}>
              <Wrench className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg leading-tight">
                {toolToEdit ? 'Editar Herramienta' : 'Registrar Nueva Herramienta en Pañol'}
              </h3>
              <p className={`text-xs ${themeClasses.textMuted}`}>
                Correlativo HERR automático • Control de préstamo y condición
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto pr-1 flex-1 space-y-4 my-3">
          {/* Photo Section */}
          <div className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center gap-4">
            <div className="relative group w-20 h-20 rounded-2xl overflow-hidden bg-slate-950 border border-slate-700 shrink-0 flex items-center justify-center">
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt={name || 'Foto Herramienta'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Wrench className="w-8 h-8 text-slate-600" />
              )}
            </div>

            <div className="space-y-1.5">
              <span className="text-xs font-bold text-slate-200 block">Fotografía de la Herramienta</span>
              <p className="text-[11px] text-slate-400">
                Tome una foto con la cámara o seleccione una imagen de su dispositivo.
              </p>
              <div className="flex items-center gap-2 pt-0.5">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleImageFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-orange-600/20 hover:bg-orange-600/30 text-orange-400 border border-orange-500/30 transition"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>{imageUrl ? 'Cambiar Foto' : 'Tomar / Subir Foto'}</span>
                </button>
                {imageUrl && (
                  <button
                    type="button"
                    onClick={() => setImageUrl('')}
                    className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg hover:bg-slate-800 transition"
                    title="Quitar foto"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Row 1: Code and Auto Correlative */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Código Herramienta (Correlativo HERR-XXX) *
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="Ej: HERR-001"
                  className={`flex-1 px-3 py-2 text-sm font-mono font-bold uppercase rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg}`}
                />
                <button
                  type="button"
                  onClick={handleGenerateSequentialCode}
                  className="px-3 py-2 text-xs font-bold rounded-xl bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 border border-orange-500/30 transition flex items-center gap-1 shrink-0"
                  title="Obtener siguiente correlativo disponible"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Siguiente HERR</span>
                </button>
                {onOpenScanner && (
                  <button
                    type="button"
                    onClick={onOpenScanner}
                    className="p-2 text-xs rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition shrink-0"
                    title="Escanear código de barra"
                  >
                    <ScanLine className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Empresa Dueña *</label>
              <select
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                className={`w-full px-3 py-2 text-xs rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg}`}
              >
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 2: Name */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              Nombre de la Herramienta o Equipo *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Llave de Impacto Neumática 1 pulgada / Gata Hidráulica 30 Ton"
              className={`w-full px-3 py-2 text-sm rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg}`}
            />
          </div>

          {/* Row 3: Brand & Model */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Marca</label>
              <input
                type="text"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="Ej: Makita, Milwaukee, Snap-on, Mega..."
                className={`w-full px-3 py-2 text-xs rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg}`}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Modelo / Serie</label>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="Ej: M18 FUEL / DTW1002Z..."
                className={`w-full px-3 py-2 text-xs rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg}`}
              />
            </div>
          </div>

          {/* Row 4: Category & Location */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Categoría de Herramienta *</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className={`w-full px-3 py-2 text-xs rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg}`}
              >
                {TOOL_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Ubicación en Pañol *</label>
              <input
                type="text"
                required
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Gabinete 1 - Nivel 2, Panel Central..."
                className={`w-full px-3 py-2 text-xs rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg}`}
              />
            </div>
          </div>

          {/* Row 5: Status, Condition, Completeness */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Disponibilidad *</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ToolStatus)}
                className={`w-full px-3 py-2 text-xs rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg}`}
              >
                <option value="DISPONIBLE">DISPONIBLE (En Pañol)</option>
                <option value="PRESTADA">PRESTADA (En Uso)</option>
                <option value="MANTENCION">EN MANTENCIÓN / CALIBRACIÓN</option>
                <option value="DANADA">DAÑADA</option>
                <option value="PERDIDA">PERDIDA / EXTRAVIADA</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Estado Físico *</label>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value as ItemCondition)}
                className={`w-full px-3 py-2 text-xs rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg}`}
              >
                <option value="EXCELENTE">EXCELENTE (Como nueva)</option>
                <option value="BUENO">BUENO (Operativo normal)</option>
                <option value="DESGASTE">CON DESGASTE (Funcional)</option>
                <option value="DANADO">DAÑADO / REVISIÓN</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Integridad *</label>
              <select
                value={completeness}
                onChange={(e) => setCompleteness(e.target.value as ItemCompleteness)}
                className={`w-full px-3 py-2 text-xs rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg}`}
              >
                <option value="COMPLETO">COMPLETO (Con accesorios)</option>
                <option value="INCOMPLETO">INCOMPLETO (Faltan piezas)</option>
              </select>
            </div>
          </div>

          {/* Condition Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              Observaciones de Desgaste o Detalles Físicos (Opcional):
            </label>
            <input
              type="text"
              value={conditionNotes}
              onChange={(e) => setConditionNotes(e.target.value)}
              placeholder="Ej: Con maletín original, falta dado 17mm, cable reparado..."
              className={`w-full px-3 py-2 text-xs rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg}`}
            />
          </div>

          {/* Footer Actions */}
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-700/50">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs rounded-xl border border-slate-600 hover:bg-slate-800 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className={`flex items-center gap-1.5 px-6 py-2 text-xs font-bold rounded-xl ${themeClasses.accentBg} ${themeClasses.accentHover} shadow-lg shadow-orange-500/20 transition`}
            >
              <Save className="w-4 h-4" />
              <span>{toolToEdit ? 'Actualizar Herramienta' : 'Guardar Herramienta'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
