import React from 'react';
import { ReceptionGuide, DeliveryGuide, Company } from '../../types';
import { Download, Share2, Printer, CheckCircle2, Building2, Truck, FileText, Calendar, Hash } from 'lucide-react';

interface GuideDocumentVisualizerProps {
  guide: ReceptionGuide | DeliveryGuide;
  type: 'RECEPTION' | 'DELIVERY';
  company?: Company;
  onDownloadPDF?: () => void;
  onShareWhatsApp?: () => void;
  onPrint?: () => void;
}

export const GuideDocumentVisualizer: React.FC<GuideDocumentVisualizerProps> = ({
  guide,
  type,
  company,
  onDownloadPDF,
  onShareWhatsApp,
  onPrint
}) => {
  const isReception = type === 'RECEPTION';
  const recGuide = isReception ? (guide as ReceptionGuide) : null;
  const delGuide = !isReception ? (guide as DeliveryGuide) : null;

  const totalQuantity = guide.items.reduce((sum, it) => sum + (it.quantity || 0), 0);
  const totalValued = guide.items.reduce((sum, it) => {
    const p = (it as any).unitPrice || (it as any).price || 0;
    return sum + (p * (it.quantity || 0));
  }, 0);

  const compName = company?.name || guide.companyName || 'MARKET ALMACÉN SpA';
  const compRut = company?.rut || (delGuide?.companyRut) || '77.890.120-5';
  const compAddress = company?.address || 'Av. Providencia 1234, Santiago';
  const compActivity = company?.industry || 'Comercializadora y Distribuidora de Alimentos';
  const compPhone = company?.phone || '+56 9 8452 1190';

  const docTitle = isReception
    ? 'GUÍA DE RECEPCIÓN DE MERCADERÍA'
    : delGuide?.dispatchType === 'TRASPASO_SUCURSAL'
    ? 'GUÍA DE DESPACHO / TRASPASO SUCURSAL'
    : 'GUÍA DE DESPACHO / ENTREGA FACTURABLE';

  const formattedDate = new Date(guide.date || guide.createdAt || Date.now()).toLocaleString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4 pb-4">
      {/* Botones de acción superiores rápidos para móvil */}
      <div className="flex items-center justify-between gap-2 p-2 rounded-2xl bg-slate-800/80 border border-slate-700/80 text-xs">
        <span className="font-bold text-slate-300 text-xs pl-2 flex items-center gap-1.5">
          <FileText className="w-4 h-4 text-orange-400" />
          <span>Vista de Documento Oficial</span>
        </span>
        <div className="flex items-center gap-1.5">
          {onDownloadPDF && (
            <button
              onClick={onDownloadPDF}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-black shadow-sm active:scale-95 transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>PDF</span>
            </button>
          )}
          {onShareWhatsApp && (
            <button
              onClick={onShareWhatsApp}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black shadow-sm active:scale-95 transition"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </button>
          )}
          {onPrint && (
            <button
              onClick={onPrint}
              className="hidden sm:flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold active:scale-95 transition"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir</span>
            </button>
          )}
        </div>
      </div>

      {/* Hoja de la Guía Oficial (Estilo Papel Limpio de Alta Fidelidad) */}
      <div className="bg-white text-slate-900 rounded-3xl p-4 sm:p-7 shadow-2xl border border-slate-200 space-y-5">
        
        {/* Encabezado: Empresa vs Recuadro Oficial */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 border-b border-slate-200 pb-5">
          {/* Datos Empresa Emisora */}
          <div className="space-y-1 max-w-md">
            <div className="flex items-center gap-2">
              <span className="text-xl font-black tracking-tight text-slate-900 uppercase">
                {compName}
              </span>
            </div>
            <p className="text-xs font-bold text-slate-600">{compActivity}</p>
            <p className="text-xs text-slate-500">{compAddress}</p>
            <p className="text-xs text-slate-500">Teléfono: {compPhone}</p>
          </div>

          {/* Recuadro Rojo / Oficial SII */}
          <div className="w-full sm:w-72 border-2 border-red-600 rounded-2xl p-3 text-center bg-red-50/40 space-y-1 shrink-0">
            <p className="text-xs font-black text-red-700 tracking-wider">R.U.T.: {compRut}</p>
            <h2 className="text-xs font-black text-red-800 leading-tight uppercase">
              {docTitle}
            </h2>
            <p className="text-base font-mono font-black text-red-600 tracking-wider">
              Nº {guide.folio}
            </p>
            <p className="text-[10px] font-bold text-slate-500">S.I.I. - SANTIAGO CENTRO</p>
          </div>
        </div>

        {/* Metadatos: Fecha, Estado y Tipo */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-slate-50 p-3 rounded-2xl border border-slate-200 font-medium">
          <div>
            <span className="block text-[10px] font-black text-slate-400 uppercase">Fecha de Emisión</span>
            <span className="font-bold text-slate-800">{formattedDate}</span>
          </div>
          <div>
            <span className="block text-[10px] font-black text-slate-400 uppercase">Tipo Documento</span>
            <span className="font-black text-slate-800">
              {isReception ? 'Ingreso a Bodega' : delGuide?.dispatchType === 'TRASPASO_SUCURSAL' ? 'Traspaso Interno' : 'Venta Facturable'}
            </span>
          </div>
          <div>
            <span className="block text-[10px] font-black text-slate-400 uppercase">Estado Guía</span>
            <span className="inline-flex items-center gap-1 font-black text-emerald-700">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {guide.confirmed ? 'CONFIRMADA' : 'EMITIDA'}
            </span>
          </div>
          <div>
            <span className="block text-[10px] font-black text-slate-400 uppercase">Doc. Externo / Factura</span>
            <span className="font-mono font-bold text-slate-700">
              {guide.externalDocNumber || delGuide?.invoiceFolio || 'S/N'}
            </span>
          </div>
        </div>

        {/* Bloque Destinatario / Proveedor y Transporte */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Cuadro Izquierdo: Proveedor o Receptor */}
          <div className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-1.5 text-xs">
            <h4 className="font-black text-slate-800 flex items-center gap-1.5 pb-1 border-b border-slate-200">
              <Building2 className="w-3.5 h-3.5 text-blue-600" />
              <span>{isReception ? 'DATOS DEL PROVEEDOR / EMISOR' : 'DATOS DEL DESTINATARIO / CLIENTE'}</span>
            </h4>
            <div className="space-y-1">
              <p>
                <strong className="text-slate-500">Nombre / Razón Social: </strong>
                <span className="font-bold text-slate-900">
                  {isReception ? recGuide?.supplierOrCarrierName : delGuide?.recipientName}
                </span>
              </p>
              <p>
                <strong className="text-slate-500">R.U.T.: </strong>
                <span className="font-mono font-bold text-slate-800">
                  {isReception ? (recGuide?.supplierRut || 'No especificado') : (delGuide?.recipientRut || delGuide?.customerRut || 'No especificado')}
                </span>
              </p>
              <p>
                <strong className="text-slate-500">Teléfono de Contacto: </strong>
                <span className="font-bold text-slate-800">
                  {isReception ? (recGuide?.carrierPhone || 'No especificado') : (delGuide?.recipientPhone || 'No especificado')}
                </span>
              </p>
              {!isReception && delGuide?.worksiteOrReason && (
                <p>
                  <strong className="text-slate-500">Motivo / Obra: </strong>
                  <span className="font-bold text-slate-800">{delGuide.worksiteOrReason}</span>
                </p>
              )}
              {!isReception && delGuide?.destinationBranch && (
                <p>
                  <strong className="text-slate-500">Sucursal Destino: </strong>
                  <span className="font-bold text-blue-700">{delGuide.destinationBranch}</span>
                </p>
              )}
            </div>
          </div>

          {/* Cuadro Derecho: Transporte y Traslado */}
          <div className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-1.5 text-xs">
            <h4 className="font-black text-slate-800 flex items-center gap-1.5 pb-1 border-b border-slate-200">
              <Truck className="w-3.5 h-3.5 text-emerald-600" />
              <span>DATOS DE TRANSPORTE Y DESPACHO</span>
            </h4>
            <div className="space-y-1">
              <p>
                <strong className="text-slate-500">Patente Vehículo: </strong>
                <span className="font-mono font-black text-slate-900 uppercase">
                  {isReception ? (recGuide?.vehiclePlate || recGuide?.carrierVehiclePlate || 'No registrada') : (delGuide?.vehiclePlate || delGuide?.associatedVehiclePlate || 'No registrada')}
                </span>
              </p>
              <p>
                <strong className="text-slate-500">RUT Conductor / Transportista: </strong>
                <span className="font-mono font-bold text-slate-800">
                  {isReception ? (recGuide?.carrierRut || 'No especificado') : 'N/A'}
                </span>
              </p>
              <p>
                <strong className="text-slate-500">Folio Vinculado: </strong>
                <span className="font-mono text-slate-800">{guide.linkedFolio || 'Ninguno'}</span>
              </p>
              <p>
                <strong className="text-slate-500">Empresa Responsable: </strong>
                <span className="font-bold text-slate-800">{guide.companyName || compName}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Tabla Detallada de Mercadería / Ítems */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wide">
              Detalle de Productos ({guide.items.length} {guide.items.length === 1 ? 'ítem' : 'ítems'})
            </h4>
            <span className="text-[11px] font-black text-blue-600">
              Total Cantidad: {totalQuantity} {guide.items[0]?.unit || 'UN'}
            </span>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-black border-b border-slate-200 text-[11px]">
                  <th className="py-2.5 px-3 text-center w-10">#</th>
                  <th className="py-2.5 px-3">Código / SKU</th>
                  <th className="py-2.5 px-3">Descripción de Mercadería</th>
                  <th className="py-2.5 px-3 text-center">Cantidad</th>
                  <th className="py-2.5 px-3 text-center">Unidad</th>
                  <th className="py-2.5 px-3 text-right">P. Unitario ($)</th>
                  <th className="py-2.5 px-3 text-right">Subtotal ($)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                {guide.items.map((it, idx) => {
                  const unitP = (it as any).unitPrice || (it as any).price || 0;
                  const itemSubtotal = unitP * it.quantity;

                  return (
                    <tr key={idx} className="hover:bg-slate-50 transition">
                      <td className="py-2 px-3 text-center text-slate-400 font-bold text-[11px]">
                        {idx + 1}
                      </td>
                      <td className="py-2 px-3 font-mono font-bold text-slate-700">
                        {it.code}
                      </td>
                      <td className="py-2 px-3 font-black text-slate-900">
                        {it.name}
                        {it.brand && (
                          <span className="block text-[10px] font-medium text-slate-500">
                            Marca: {it.brand}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-center font-mono font-black text-blue-700 text-xs">
                        {it.quantity}
                      </td>
                      <td className="py-2 px-3 text-center font-bold text-slate-500 text-[11px]">
                        {it.unit || 'UN'}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-700">
                        {unitP > 0 ? `$${unitP.toLocaleString('es-CL')}` : '-'}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-black text-emerald-700">
                        {itemSubtotal > 0 ? `$${itemSubtotal.toLocaleString('es-CL')}` : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Resumen de Totales y Notas */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pt-2">
          {/* Notas y Observaciones */}
          <div className="flex-1 space-y-1 text-xs">
            <span className="font-black text-slate-700 uppercase text-[10px]">Observaciones / Comentarios</span>
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-600 min-h-[4rem]">
              {guide.notes || (guide as any).comments || 'Sin observaciones registradas para esta guía.'}
            </div>
          </div>

          {/* Cuadro de Totales */}
          <div className="w-full sm:w-64 p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs">
            <div className="flex justify-between font-bold text-slate-600">
              <span>Total Unidades:</span>
              <span className="font-mono text-slate-900">{totalQuantity}</span>
            </div>
            {totalValued > 0 && (
              <>
                <div className="flex justify-between font-bold text-slate-600">
                  <span>Subtotal Neto:</span>
                  <span className="font-mono text-slate-900">
                    $${Math.round(totalValued / 1.19).toLocaleString('es-CL')}
                  </span>
                </div>
                <div className="flex justify-between font-bold text-slate-600">
                  <span>IVA 19%:</span>
                  <span className="font-mono text-slate-900">
                    $${(totalValued - Math.round(totalValued / 1.19)).toLocaleString('es-CL')}
                  </span>
                </div>
                <div className="flex justify-between font-black text-sm text-emerald-700 pt-1 border-t border-slate-200">
                  <span>Total Final:</span>
                  <span className="font-mono">$${totalValued.toLocaleString('es-CL')}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Firmas y Recepción Conforme */}
        <div className="pt-3 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-3 rounded-2xl border border-dashed border-slate-300 text-center space-y-1">
            <p className="text-[10px] font-black text-slate-400 uppercase">Firma / Timbre Responsable Bodega</p>
            <p className="text-xs font-bold text-slate-800">MARKET ALMACÉN SpA</p>
            <span className="inline-block px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black">
              ✓ Recepción y Despacho Conforme
            </span>
          </div>

          <div className="p-3 rounded-2xl border border-dashed border-slate-300 text-center space-y-1">
            <p className="text-[10px] font-black text-slate-400 uppercase">Firma Receptor / Conductor</p>
            {guide.signatureData || (guide as any).recipientSignature ? (
              <img
                src={guide.signatureData || (guide as any).recipientSignature}
                alt="Firma Conductor"
                className="h-10 mx-auto object-contain"
              />
            ) : (
              <div className="h-10 flex items-center justify-center text-xs text-slate-400 italic">
                Firma física estampada en documento
              </div>
            )}
            <p className="text-xs font-bold text-slate-700">
              {isReception ? recGuide?.supplierOrCarrierName : delGuide?.recipientName}
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};
