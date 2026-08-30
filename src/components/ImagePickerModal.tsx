import React, { useState } from 'react';
import { useTheme } from '../utils/themeContext';
import { getSuggestedImages, type SuggestedImage } from '../utils/imageFetcher';
import { X, Image as ImageIcon, Search, Upload, Check, Trash2, Camera, Globe } from 'lucide-react';

interface ImagePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentImage?: string;
  itemName: string;
  category: string;
  onSelectImage: (imageUrl: string) => void;
}

export const ImagePickerModal: React.FC<ImagePickerModalProps> = ({
  isOpen,
  onClose,
  currentImage,
  itemName,
  category,
  onSelectImage
}) => {
  const { themeClasses } = useTheme();
  const [searchQuery, setSearchQuery] = useState(itemName || category);
  const [customUrl, setCustomUrl] = useState('');
  const [activeTab, setActiveTab] = useState<'suggestions' | 'url' | 'upload'>('suggestions');

  if (!isOpen) return null;

  const suggestions = getSuggestedImages(searchQuery, category);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        if (reader.result) {
          onSelectImage(reader.result.toString());
          onClose();
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm">
      <div className={`w-full max-w-2xl rounded-2xl border ${themeClasses.border} ${themeClasses.card} p-5 shadow-2xl flex flex-col max-h-[92vh]`}>
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-700/50">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-lg ${themeClasses.badge}`}>
              <ImageIcon className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">Foto del Artículo</h3>
              <p className={`text-xs ${themeClasses.textMuted}`}>Seleccionar o cambiar imagen de internet / cámara para: <span className="font-bold text-orange-400">{itemName}</span></p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 my-3 border-b border-slate-800 pb-2">
          <button
            type="button"
            onClick={() => setActiveTab('suggestions')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition ${
              activeTab === 'suggestions'
                ? `${themeClasses.accentBg}`
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Globe className="w-4 h-4" />
            <span>Fotos de Internet</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition ${
              activeTab === 'upload'
                ? `${themeClasses.accentBg}`
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>Subir Archivo / Cámara</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('url')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition ${
              activeTab === 'url'
                ? `${themeClasses.accentBg}`
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Search className="w-4 h-4" />
            <span>Enlace URL</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="overflow-y-auto pr-1 flex-1 space-y-3">
          {activeTab === 'suggestions' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {suggestions.map((s, idx) => (
                  <div
                    key={idx}
                    onClick={() => {
                      onSelectImage(s.url);
                      onClose();
                    }}
                    className={`group relative rounded-xl overflow-hidden border-2 cursor-pointer transition hover:scale-[1.02] shadow-sm ${
                      currentImage === s.url
                        ? 'border-orange-500 ring-2 ring-orange-500'
                        : 'border-slate-700 hover:border-orange-400'
                    }`}
                  >
                    <img
                      src={s.url}
                      alt={s.title}
                      className="w-full h-28 object-cover group-hover:brightness-110 transition"
                      loading="lazy"
                    />
                    <div className="p-1.5 bg-slate-900/90 backdrop-blur-sm text-[10px] font-semibold text-slate-200 truncate">
                      {s.title}
                    </div>
                    {currentImage === s.url && (
                      <div className="absolute top-1.5 right-1.5 bg-orange-500 text-slate-950 p-1 rounded-full shadow">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'upload' && (
            <div className="p-8 rounded-2xl border-2 border-dashed border-slate-700 bg-slate-900/40 text-center space-y-3">
              <Camera className="w-12 h-12 text-orange-400 mx-auto" />
              <div>
                <h4 className="font-bold text-sm text-slate-200">Tomar foto con la cámara o subir archivo</h4>
                <p className="text-xs text-slate-400">Formatos soportados: JPG, PNG, WEBP</p>
              </div>
              <label className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold cursor-pointer shadow-lg shadow-orange-600/20 transition">
                <Upload className="w-4 h-4" />
                <span>Seleccionar Imagen</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          )}

          {activeTab === 'url' && (
            <div className="space-y-3 p-4 rounded-xl bg-slate-900/40 border border-slate-800">
              <label className="block text-xs font-semibold text-slate-300">Pegar Enlace Directo de Imagen (URL Web):</label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  placeholder="https://ejemplo.com/foto-producto.jpg"
                  className={`flex-1 px-3 py-2 text-xs rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg}`}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (customUrl.trim()) {
                      onSelectImage(customUrl.trim());
                      onClose();
                    }
                  }}
                  disabled={!customUrl.trim()}
                  className={`px-4 py-2 text-xs font-bold rounded-xl ${themeClasses.accentBg} ${themeClasses.accentHover} disabled:opacity-40`}
                >
                  Aplicar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center pt-3 border-t border-slate-700/50">
          {currentImage ? (
            <button
              type="button"
              onClick={() => {
                onSelectImage('');
                onClose();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Quitar Foto Actual</span>
            </button>
          ) : (
            <span />
          )}

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs rounded-xl border border-slate-600 hover:bg-slate-800 transition"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
