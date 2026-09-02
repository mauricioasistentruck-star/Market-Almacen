import { useBodyScrollLock } from '../../utils/scrollLock';
import React, { useState, useEffect, useRef } from 'react';
import type { Product } from '../../types';
import { useTheme } from '../../utils/themeContext';
import { useCompany } from '../../utils/companyContext';
import { db } from '../../db/database';
import JsBarcode from 'jsbarcode';
import jsPDF from 'jspdf';
import { X, Printer, Barcode, Search, CheckSquare, Square, Download, Settings2, Eye } from 'lucide-react';

interface BarcodePrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSelectedProduct?: Product | null;
}

export type LabelFormatType = 'SATO_50x30' | 'SATO_50x25' | 'SATO_38x25' | 'THERMAL_80MM' | 'SHEET_A4_24' | 'SHEET_A4_30';

interface SelectedProductItem {
  product: Product;
  quantity: number;
}

export const BarcodePrintModal: React.FC<BarcodePrintModalProps> = ({
  isOpen,
  onClose,
  initialSelectedProduct
}) => {
  useBodyScrollLock(Boolean(isOpen));
  const { themeClasses } = useTheme();
  const { selectedCompanyId, selectedCompany } = useCompany();

  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItems, setSelectedItems] = useState<Map<number, SelectedProductItem>>(new Map());
  const [format, setFormat] = useState<LabelFormatType>('SATO_50x30');

  // Label content customizers
  const [showPrice, setShowPrice] = useState(true);
  const [showName, setShowName] = useState(true);
  const [showBrand, setShowBrand] = useState(true);
  const [showCompany, setShowCompany] = useState(true);

  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadProducts();
    }
  }, [isOpen, selectedCompanyId]);

  const loadProducts = async () => {
    const all = await db.products.toArray();
    const filtered = selectedCompanyId !== 'ALL'
      ? all.filter(p => (p.companyId || '').toLowerCase() === (selectedCompanyId || '').toLowerCase())
      : all;
    setProducts(filtered);

    if (initialSelectedProduct && initialSelectedProduct.id) {
      const map = new Map<number, SelectedProductItem>();
      map.set(initialSelectedProduct.id, {
        product: initialSelectedProduct,
        quantity: Math.max(1, initialSelectedProduct.stock > 0 ? Math.min(initialSelectedProduct.stock, 50) : 1)
      });
      setSelectedItems(map);
    }
  };

  const filteredProducts = products.filter(p => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      p.code.toLowerCase().includes(q) ||
      (p.brand && p.brand.toLowerCase().includes(q))
    );
  });

  const toggleSelectProduct = (product: Product) => {
    if (!product.id) return;
    setSelectedItems(prev => {
      const next = new Map(prev);
      if (next.has(product.id!)) {
        next.delete(product.id!);
      } else {
        next.set(product.id!, {
          product,
          quantity: 1
        });
      }
      return next;
    });
  };

  const updateQuantity = (productId: number, qty: number) => {
    setSelectedItems(prev => {
      const next = new Map(prev);
      const item = next.get(productId);
      if (item) {
        next.set(productId, { ...item, quantity: Math.max(1, qty) });
      }
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelectedItems(prev => {
      const next = new Map(prev);
      filteredProducts.slice(0, 100).forEach(p => {
        if (p.id) {
          next.set(p.id, { product: p, quantity: 1 });
        }
      });
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedItems(new Map());
  };

  const matchQuantityToStock = () => {
    setSelectedItems(prev => {
      const next = new Map(prev);
      next.forEach((val, key) => {
        const stock = Math.max(1, Math.min(val.product.stock || 1, 100));
        next.set(key, { ...val, quantity: stock });
      });
      return next;
    });
  };

  const totalLabelsToPrint = Array.from(selectedItems.values()).reduce((acc, item) => acc + item.quantity, 0);

  const previewItem = selectedItems.size > 0
    ? Array.from(selectedItems.values())[0].product
    : products[0] || null;

  useEffect(() => {
    if (previewCanvasRef.current && previewItem) {
      try {
        JsBarcode(previewCanvasRef.current, previewItem.code || '780000000000', {
          format: 'CODE128',
          width: 1.5,
          height: 40,
          displayValue: true,
          fontSize: 11,
          fontOptions: 'bold',
          margin: 4
        });
      } catch (err) {
        console.error('Error generando preview barcode:', err);
      }
    }
  }, [previewItem, showPrice, showName, showBrand, showCompany, format]);

  const generateBarcodeDataUrl = (code: string): string => {
    const canvas = document.createElement('canvas');
    try {
      JsBarcode(canvas, code, {
        format: 'CODE128',
        width: 1.8,
        height: 48,
        displayValue: true,
        fontSize: 11,
        fontOptions: 'bold',
        margin: 4
      });
      return canvas.toDataURL('image/png');
    } catch {
      return '';
    }
  };

  const handlePrint = () => {
    if (selectedItems.size === 0) {
      alert('Seleccione al menos un producto para imprimir.');
      return;
    }

    const itemsToPrint: SelectedProductItem[] = Array.from(selectedItems.values());
    const companyName = selectedCompany?.tradeName || selectedCompany?.name || 'MARKET ALMACÉN';

    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) {
      alert('Por favor permita las ventanas emergentes (popups) para imprimir etiquetas.');
      return;
    }

    let cssStyles = '';
    let htmlContent = '';

    if (format === 'SATO_50x30' || format === 'SATO_50x25' || format === 'SATO_38x25') {
      const heightMm = format === 'SATO_50x30' ? '30mm' : '25mm';
      const widthMm = format === 'SATO_38x25' ? '38mm' : '50mm';

      cssStyles = `
        @page { size: ${widthMm} ${heightMm}; margin: 0; }
        body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #fff; }
        .label-page {
          width: ${widthMm};
          height: ${heightMm};
          page-break-after: always;
          box-sizing: border-box;
          padding: 1.5mm 2mm;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          text-align: center;
          overflow: hidden;
        }
        .comp-name { font-size: 7pt; font-weight: 800; text-transform: uppercase; color: #333; line-height: 1; margin-bottom: 0.5mm; }
        .prod-name { font-size: 8pt; font-weight: 900; color: #000; line-height: 1.1; max-height: 5.5mm; overflow: hidden; }
        .barcode-img { max-width: 96%; max-height: 12mm; margin: 0.5mm auto; display: block; object-fit: contain; }
        .footer-row { display: flex; justify-content: space-between; align-items: center; font-size: 7.5pt; font-weight: 700; line-height: 1; border-top: 0.5pt solid #ccc; padding-top: 0.5mm; }
        .price { font-size: 10pt; font-weight: 900; font-family: monospace; color: #000; }
      `;

      itemsToPrint.forEach(item => {
        const barcodeUrl = generateBarcodeDataUrl(item.product.code);
        for (let i = 0; i < item.quantity; i++) {
          htmlContent += `
            <div class="label-page">
              ${showCompany ? `<div class="comp-name">${companyName}</div>` : ''}
              ${showName ? `<div class="prod-name">${item.product.name}</div>` : ''}
              <img class="barcode-img" src="${barcodeUrl}" alt="${item.product.code}" />
              <div class="footer-row">
                <span>${showBrand && item.product.brand ? item.product.brand : ''}</span>
                ${showPrice ? `<span class="price">$${(item.product.price || 0).toLocaleString('es-CL')}</span>` : ''}
              </div>
            </div>
          `;
        }
      });
    } else {
      cssStyles = `
        @page { size: letter; margin: 8mm; }
        body { font-family: sans-serif; margin: 0; padding: 0; }
        .sheet-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2.5mm; }
        .label-card {
          border: 0.5pt dashed #bbb;
          padding: 2mm;
          text-align: center;
          height: 32mm;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }
        .comp-name { font-size: 7pt; font-weight: bold; color: #555; }
        .prod-name { font-size: 8.5pt; font-weight: 900; }
        .barcode-img { max-width: 90%; max-height: 13mm; margin: 0 auto; display: block; }
        .footer-row { display: flex; justify-content: space-between; align-items: baseline; font-size: 8pt; font-weight: bold; }
        .price { font-size: 11pt; font-weight: 900; font-family: monospace; }
      `;

      let cards = '';
      itemsToPrint.forEach(item => {
        const barcodeUrl = generateBarcodeDataUrl(item.product.code);
        for (let i = 0; i < item.quantity; i++) {
          cards += `
            <div class="label-card">
              ${showCompany ? `<div class="comp-name">${companyName}</div>` : ''}
              ${showName ? `<div class="prod-name">${item.product.name}</div>` : ''}
              <img class="barcode-img" src="${barcodeUrl}" alt="${item.product.code}" />
              <div class="footer-row">
                <span>${showBrand && item.product.brand ? item.product.brand : ''}</span>
                ${showPrice ? `<span class="price">$${(item.product.price || 0).toLocaleString('es-CL')}</span>` : ''}
              </div>
            </div>
          `;
        }
      });

      htmlContent = `<div class="sheet-grid">${cards}</div>`;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Impresión de Etiquetas - ${companyName}</title>
          <style>${cssStyles}</style>
        </head>
        <body>
          ${htmlContent}
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleExportPDF = () => {
    if (selectedItems.size === 0) {
      alert('Seleccione al menos un producto para exportar PDF.');
      return;
    }

    const doc = new jsPDF({
      orientation: 'p',
      unit: 'mm',
      format: 'letter'
    });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(`Etiquetas de Código de Barras - ${selectedCompany?.name || 'Bodega'}`, 14, 15);

    doc.save(`Etiquetas_Codigo_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className={`w-full max-w-6xl max-h-[94vh] rounded-3xl border-2 ${themeClasses.border} ${themeClasses.card} shadow-2xl flex flex-col overflow-hidden animate-scaleIn`}>
        
        {/* Header Amplio */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b-2 border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-white bg-blue-600 shadow-md shrink-0">
              <Barcode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
                <span>Generador e Impresor de Códigos de Barra</span>
                <span className="text-xs font-mono px-3 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 font-bold border border-blue-300 dark:border-blue-800">
                  SATO • Zebra • Térmica • Hoja Carta
                </span>
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Amplio 2 Columnas (60% Selección / 40% Configuración) */}
        <div className="p-5 grid grid-cols-1 lg:grid-cols-12 gap-5 overflow-y-auto">
          
          {/* Columna Izquierda: Modo Producto Único vs Selector General */}
          <div className="lg:col-span-7 space-y-3 flex flex-col justify-between">
            {initialSelectedProduct ? (
              /* MODO PRODUCTO ÚNICO: Muestra y crea el código solo para este producto específico */
              <div className={`p-4 sm:p-5 rounded-2xl border-2 ${themeClasses.border} ${themeClasses.cardSubtle} space-y-4 shadow-xs`}>
                <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
                  <Barcode className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  <h4 className="text-sm sm:text-base font-black text-slate-900 dark:text-slate-100">
                    Etiqueta de Código para este Producto
                  </h4>
                </div>

                <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                  <span className="font-mono text-xs font-black text-purple-600 dark:text-purple-400 block">
                    CÓDIGO / BARCODE: {initialSelectedProduct.code}
                  </span>
                  <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-slate-100">
                    {initialSelectedProduct.name}
                  </h3>
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-slate-500 font-bold">
                      Stock: <strong className="text-slate-800 dark:text-slate-200">{initialSelectedProduct.stock} {initialSelectedProduct.unit || 'UN'}</strong>
                    </span>
                    <span className="font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm">
                      ${(initialSelectedProduct.price || 0).toLocaleString('es-CL')}
                    </span>
                  </div>
                </div>

                {/* Copias para este producto */}
                <div className="p-3.5 rounded-xl bg-purple-50/70 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div>
                    <label className="text-xs font-black text-purple-950 dark:text-purple-200 block">
                      Copias de Etiqueta a Imprimir:
                    </label>
                    <span className="text-[11px] text-purple-700 dark:text-purple-300">
                      Define cuántas pegatinas deseas emitir
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      max="1000"
                      value={selectedItems.get(initialSelectedProduct.id!)?.quantity || 1}
                      onChange={(e) => initialSelectedProduct.id && updateQuantity(initialSelectedProduct.id, Number(e.target.value))}
                      className="w-20 px-2 py-1.5 text-center font-black font-mono text-sm rounded-xl border-2 border-purple-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs"
                    />
                    <button
                      type="button"
                      onClick={() => initialSelectedProduct.id && updateQuantity(initialSelectedProduct.id, Math.max(1, initialSelectedProduct.stock))}
                      className="px-2.5 py-1.5 text-xs font-black rounded-xl bg-purple-200 dark:bg-purple-900 text-purple-900 dark:text-purple-100 hover:bg-purple-300 transition cursor-pointer shadow-2xs active:scale-95"
                    >
                      Copiar Stock ({initialSelectedProduct.stock})
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* MODO GENERAL: Lista todos los productos cuando se abre desde el botón fuera de las tarjetas */
              <>
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <CheckSquare className="w-4 h-4 text-blue-600" />
                      <span>1. Seleccionar Productos ({selectedItems.size} seleccionados)</span>
                    </span>
                    <div className="flex items-center gap-2.5 text-xs">
                      <button type="button" onClick={selectAllFiltered} className="text-blue-600 dark:text-blue-400 font-black hover:underline cursor-pointer">Seleccionar Todos</button>
                      <span className="text-slate-400">•</span>
                      <button type="button" onClick={clearSelection} className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-bold cursor-pointer">Limpiar</button>
                    </div>
                  </div>

                  {/* Barra de Búsqueda */}
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Buscar por nombre, código o marca..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className={`w-full pl-10 pr-4 py-2 text-xs font-medium rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg}`}
                    />
                  </div>

                  {/* Tabla de Productos Amplia con nombres completos */}
                  <div className="rounded-2xl border-2 border-slate-200 dark:border-slate-800 overflow-hidden max-h-56 overflow-y-auto shadow-xs">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 dark:bg-slate-900 sticky top-0 font-black text-slate-800 dark:text-slate-200 z-10 border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="p-2.5 w-10 text-center">SEL.</th>
                          <th className="p-2.5">PRODUCTO</th>
                          <th className="p-2.5">CÓDIGO SKU</th>
                          <th className="p-2.5 text-right">PRECIO</th>
                          <th className="p-2.5 w-20 text-center">COPIAS</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {filteredProducts.map((p) => {
                          const isSelected = p.id ? selectedItems.has(p.id) : false;
                          const selectedItem = p.id ? selectedItems.get(p.id) : undefined;
                          return (
                            <tr
                              key={p.id}
                              onClick={() => toggleSelectProduct(p)}
                              className={`cursor-pointer transition hover:bg-blue-50/60 dark:hover:bg-slate-800/60 ${
                                isSelected ? 'bg-blue-500/10 font-bold' : ''
                              }`}
                            >
                              <td className="p-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleSelectProduct(p)}
                                  className="rounded text-blue-600 cursor-pointer w-4 h-4"
                                />
                              </td>
                              <td className="p-2.5">
                                <div className="text-slate-900 dark:text-slate-100 font-bold text-xs sm:text-sm leading-snug">{p.name}</div>
                                <div className="text-[11px] text-slate-500 font-semibold">{p.brand || 'Genérico'}</div>
                              </td>
                              <td className="p-2.5 font-mono text-orange-600 dark:text-orange-400 font-bold text-xs whitespace-nowrap">{p.code}</td>
                              <td className="p-2.5 text-right font-mono font-black text-emerald-700 dark:text-emerald-400 text-xs sm:text-sm">${(p.price || 0).toLocaleString('es-CL')}</td>
                              <td className="p-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                                {isSelected ? (
                                  <input
                                    type="number"
                                    min="1"
                                    value={selectedItem?.quantity || 1}
                                    onChange={(e) => p.id && updateQuantity(p.id, Number(e.target.value))}
                                    className="w-16 px-2 py-1 text-center font-black font-mono text-xs rounded-lg border-2 border-blue-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                                  />
                                ) : <span className="text-slate-400 text-xs">-</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 pt-1 text-xs">
                  <span className="font-bold text-slate-600 dark:text-slate-400">Total etiquetas a imprimir: <strong className="text-blue-600 dark:text-blue-400 text-sm font-black">{totalLabelsToPrint}</strong></span>
                  <button type="button" onClick={matchQuantityToStock} className="text-blue-600 dark:text-blue-400 font-black hover:underline cursor-pointer">Copiar stock como cantidad de etiquetas</button>
                </div>
              </>
            )}
          </div>

          {/* Columna Derecha: Configuración y Vista Previa Amplia (5 Cols) */}
          <div className="lg:col-span-5 space-y-3 flex flex-col justify-between">
            
            {/* 2. Formato de Impresora */}
            <div className={`p-3.5 rounded-2xl border-2 ${themeClasses.border} ${themeClasses.cardSubtle} space-y-2.5 shadow-xs`}>
              <div className="flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-blue-600" />
                <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-slate-100">2. Formato de Etiqueta</span>
              </div>
              
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as LabelFormatType)}
                className={`w-full px-3 py-2 text-xs font-bold rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} text-slate-900 dark:text-slate-100`}
              >
                <optgroup label="🏷️ Impresoras SATO / Zebra / Térmica">
                  <option value="SATO_50x30">SATO / Térmica 50 x 30 mm (Estándar Góndola)</option>
                  <option value="SATO_50x25">SATO / Térmica 50 x 25 mm (Compacta)</option>
                  <option value="SATO_38x25">SATO / Térmica 38 x 25 mm (Pequeña)</option>
                  <option value="THERMAL_80MM">Rollo Térmico 80 mm (Ticket Continuo)</option>
                </optgroup>
                <optgroup label="📄 Hoja Carta / A4 Adhesiva">
                  <option value="SHEET_A4_24">Pliego Carta / A4 (24 etiquetas por hoja)</option>
                  <option value="SHEET_A4_30">Pliego Carta / A4 (30 etiquetas por hoja)</option>
                </optgroup>
              </select>

              <div className="grid grid-cols-2 gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={showName} onChange={(e) => setShowName(e.target.checked)} className="rounded text-blue-600 w-4 h-4" /><span>Nombre</span></label>
                <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={showPrice} onChange={(e) => setShowPrice(e.target.checked)} className="rounded text-blue-600 w-4 h-4" /><span>Precio</span></label>
                <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={showBrand} onChange={(e) => setShowBrand(e.target.checked)} className="rounded text-blue-600 w-4 h-4" /><span>Marca</span></label>
                <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={showCompany} onChange={(e) => setShowCompany(e.target.checked)} className="rounded text-blue-600 w-4 h-4" /><span>Empresa</span></label>
              </div>
            </div>

            {/* Vista Previa en Vivo Amplia */}
            <div className={`p-3 rounded-2xl border-2 ${themeClasses.border} ${themeClasses.cardSubtle} text-center shadow-xs space-y-1`}>
              <span className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center justify-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-blue-600" />
                <span>Vista Previa en Vivo de la Etiqueta</span>
              </span>
              <div className="p-2.5 rounded-2xl bg-white border-2 border-slate-300 text-slate-950 shadow-md max-w-[240px] mx-auto space-y-1">
                {showCompany && <div className="text-[9px] font-black text-slate-600 uppercase truncate">{selectedCompany?.tradeName || selectedCompany?.name || 'MARKET ALMACÉN'}</div>}
                {showName && <div className="text-xs font-black text-slate-900 leading-tight truncate">{previewItem?.name || 'Producto'}</div>}
                <div className="flex justify-center py-0.5"><canvas ref={previewCanvasRef} className="max-w-full h-10 object-contain" /></div>
                <div className="flex items-center justify-between text-[10px] font-bold text-slate-800 pt-0.5 border-t border-slate-200">
                  {showBrand && previewItem?.brand ? <span className="text-slate-600 truncate">{previewItem.brand}</span> : <span />}
                  {showPrice && <span className="text-sm font-black font-mono text-slate-950">${(previewItem?.price || 1390).toLocaleString('es-CL')}</span>}
                </div>
              </div>
            </div>

            {/* Botones de Acción */}
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={handlePrint}
                disabled={selectedItems.size === 0}
                className={`py-2.5 px-4 rounded-xl text-xs font-black text-white flex items-center justify-center gap-2 shadow-md transition active:scale-95 ${
                  selectedItems.size > 0
                    ? 'bg-blue-600 hover:bg-blue-500 cursor-pointer shadow-blue-500/25'
                    : 'bg-slate-300 dark:bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir ({totalLabelsToPrint})</span>
              </button>

              <button
                type="button"
                onClick={handleExportPDF}
                disabled={selectedItems.size === 0}
                className="py-2.5 px-4 rounded-xl text-xs font-bold border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 flex items-center justify-center gap-2 transition cursor-pointer shadow-xs"
              >
                <Download className="w-4 h-4 text-emerald-600" />
                <span>Descargar PDF</span>
              </button>
            </div>

          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t-2 border-slate-200 dark:border-slate-800 flex justify-end bg-slate-100 dark:bg-slate-900/90 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 text-xs font-black rounded-xl bg-slate-800 hover:bg-slate-700 text-white transition cursor-pointer shadow-sm"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
};
