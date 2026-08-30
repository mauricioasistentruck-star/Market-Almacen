import * as XLSX from 'xlsx';
import { downloadOrShareBlob } from './fileDownloader';
import type { ProductMovement, ToolLoan, Product, Tool, Incident, PurchaseRequest } from '../types';

export interface WorkshopConsumptionItem {
  id?: number;
  date: string;
  sourceType: 'MOVIMIENTO' | 'GUIA_ENTREGA';
  folioOrRef: string;
  vehiclePlate: string;
  productCode: string;
  productName: string;
  category?: string;
  brand?: string;
  quantity: number;
  unit: string;
  responsibleWorker: string;
  reasonOrNotes: string;
  companyName?: string;
}

function s2ab(s: string) {
  const buf = new ArrayBuffer(s.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i !== s.length; ++i) view[i] = s.charCodeAt(i) & 0xff;
  return buf;
}

async function exportWorkbook(wb: XLSX.WorkBook, filename: string) {
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'binary' });
  const blob = new Blob([s2ab(wbout)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  await downloadOrShareBlob(blob, filename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}

/**
 * Reporte Excel de Consumo Interno de Taller (Filtrable por Patente y Productos)
 */
export function exportWorkshopConsumptionExcel(
  items: WorkshopConsumptionItem[],
  filters: {
    selectedPlate?: string;
    companyName: string;
    startDate?: string;
    endDate?: string;
  }
) {
  const wb = XLSX.utils.book_new();

  let totalUnits = 0;
  const rows = items.map((item, idx) => {
    totalUnits += item.quantity;
    return {
      'N°': idx + 1,
      'Fecha': new Date(item.date).toLocaleDateString('es-CL'),
      'Hora': new Date(item.date).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }),
      'Tipo Origen': item.sourceType === 'GUIA_ENTREGA' ? 'Guía de Entrega' : 'Movimiento de Salida',
      'Folio / N° Ref': item.folioOrRef,
      'Patente Vehículo / Equipo': item.vehiclePlate ? item.vehiclePlate.toUpperCase() : 'TALLER GENERAL',
      'Código Producto': item.productCode,
      'Descripción del Producto': item.productName,
      'Categoría': item.category || 'Insumos / Repuestos',
      'Marca': item.brand || 'Genérica',
      'Cantidad Usada': item.quantity,
      'Unidad de Medida': item.unit,
      'Mecánico / Receptor': item.responsibleWorker || 'Taller Interno',
      'Motivo / Observaciones': item.reasonOrNotes || 'Consumo interno taller'
    };
  });

  // Fila de resumen total
  rows.push({
    'N°': '' as any,
    'Fecha': 'TOTAL CONSOLIDADO',
    'Hora': '',
    'Tipo Origen': '',
    'Folio / N° Ref': `${items.length} Registros`,
    'Patente Vehículo / Equipo': filters.selectedPlate ? `Patente: ${filters.selectedPlate.toUpperCase()}` : 'TODAS LAS PATENTES',
    'Código Producto': '',
    'Descripción del Producto': '',
    'Categoría': '',
    'Marca': 'SUMA TOTAL:',
    'Cantidad Usada': totalUnits,
    'Unidad de Medida': 'Unidades',
    'Mecánico / Receptor': '',
    'Motivo / Observaciones': `Reporte de consumo en taller generado para ${filters.companyName}`
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [
    { wch: 6 },  // N°
    { wch: 14 }, // Fecha
    { wch: 10 }, // Hora
    { wch: 18 }, // Tipo Origen
    { wch: 16 }, // Folio
    { wch: 22 }, // Patente
    { wch: 18 }, // Codigo
    { wch: 32 }, // Descripcion
    { wch: 20 }, // Categoria
    { wch: 16 }, // Marca
    { wch: 14 }, // Cantidad
    { wch: 16 }, // Unidad
    { wch: 24 }, // Responsable
    { wch: 30 }  // Observaciones
  ];

  const sheetName = filters.selectedPlate ? `Consumo_${filters.selectedPlate.substring(0, 15)}` : 'Consumo_Taller';
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  const cleanDate = new Date().toISOString().split('T')[0];
  const platePart = filters.selectedPlate ? `_${filters.selectedPlate.replace(/[^a-zA-Z0-9]/g, '')}` : '';
  const filename = `Reporte_Consumo_Taller_${filters.companyName.replace(/[^a-zA-Z0-9]/g, '_')}${platePart}_${cleanDate}.xlsx`;
  exportWorkbook(wb, filename);
}

/**
 * Combined 4-in-1 Consolidated Excel Report:
 * Sheet 1: Movimientos de Productos (Kardex)
 * Sheet 2: Consumo en Taller (Salidas por Patente / Equipo)
 * Sheet 3: Herramientas Pendientes de Devolución
 * Sheet 4: Registro de Daños y Pérdidas
 */
export function exportConsolidatedExcelReport(
  params: {
    movements: ProductMovement[];
    workshopConsumption: WorkshopConsumptionItem[];
    pendingLoans: ToolLoan[];
    incidents: Incident[];
    companyName: string;
    startDate?: string;
    endDate?: string;
  }
) {
  const { movements, workshopConsumption, pendingLoans, incidents, companyName, startDate, endDate } = params;
  const wb = XLSX.utils.book_new();

  // 1. Sheet: Movimientos de Productos (Kardex)
  const movRows = movements.map((m, idx) => ({
    'N°': idx + 1,
    'Fecha y Hora': new Date(m.date).toLocaleString('es-CL'),
    'Código Producto': m.productCode,
    'Descripción del Producto': m.productName,
    'Tipo Movimiento': m.type,
    'Cantidad': m.quantity,
    'Stock Anterior': m.previousStock,
    'Stock Resultante': m.newStock,
    'Motivo / Justificación': m.reason,
    'Responsable / Proveedor': m.workerOrSupplier || 'N/A',
    'Usuario Bodega': m.user || 'Mauricio Chamorro'
  }));
  const wsMov = XLSX.utils.json_to_sheet(movRows);
  XLSX.utils.book_append_sheet(wb, wsMov, 'Movimientos (Kardex)');

  // 2. Sheet: Consumo en Taller (Consumo Interno y Salidas a Vehículos)
  let totalWorkshopUnits = 0;
  const workshopRows = (workshopConsumption || []).map((item, idx) => {
    totalWorkshopUnits += item.quantity;
    return {
      'N°': idx + 1,
      'Fecha': new Date(item.date).toLocaleDateString('es-CL'),
      'Hora': new Date(item.date).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }),
      'Tipo Origen': item.sourceType === 'GUIA_ENTREGA' ? 'Guía de Entrega' : 'Movimiento de Salida',
      'Folio / N° Ref': item.folioOrRef,
      'Patente Vehículo / Equipo': item.vehiclePlate ? item.vehiclePlate.toUpperCase() : 'TALLER GENERAL',
      'Código Producto': item.productCode,
      'Descripción del Producto': item.productName,
      'Categoría': item.category || 'Insumos / Repuestos',
      'Marca': item.brand || 'Genérica',
      'Cantidad': item.quantity,
      'Unidad': item.unit,
      'Mecánico / Receptor': item.responsibleWorker || 'Taller Interno',
      'Motivo / Observaciones': item.reasonOrNotes || 'Consumo interno taller'
    };
  });
  if (workshopRows.length > 0) {
    workshopRows.push({
      'N°': '' as any,
      'Fecha': 'TOTAL CONSUMO',
      'Hora': '',
      'Tipo Origen': '',
      'Folio / N° Ref': `${workshopConsumption.length} Registros`,
      'Patente Vehículo / Equipo': 'TODAS LAS PATENTES',
      'Código Producto': '',
      'Descripción del Producto': '',
      'Categoría': '',
      'Marca': 'SUMA TOTAL:',
      'Cantidad': totalWorkshopUnits,
      'Unidad': 'Unidades',
      'Mecánico / Receptor': '',
      'Motivo / Observaciones': `Consumo consolidado en taller para ${companyName}`
    });
  }
  const wsWorkshop = XLSX.utils.json_to_sheet(workshopRows);
  XLSX.utils.book_append_sheet(wb, wsWorkshop, 'Consumo en Taller');

  // 3. Sheet: Herramientas Pendientes de Devolución
  const now = new Date().getTime();
  const loanRows = pendingLoans.map((l, idx) => {
    const deliveryMs = new Date(l.deliveryDate).getTime();
    const daysOut = Math.floor((now - deliveryMs) / (1000 * 3600 * 24));
    return {
      'N°': idx + 1,
      'Código Herramienta': l.toolCode,
      'Nombre de Herramienta': l.toolName,
      'Marca': l.toolBrand || 'Genérica',
      'Trabajador Responsable': l.workerName,
      'RUT / DNI': l.workerRut || 'No especificado',
      'Teléfono Celular': l.workerPhone || 'No especificado',
      'Cargo / Área': l.workerRole || 'Taller / Faena',
      'Fecha y Hora Entrega': new Date(l.deliveryDate).toLocaleString('es-CL'),
      'Fecha Prometida Devolución': l.expectedReturnDate ? new Date(l.expectedReturnDate).toLocaleDateString('es-CL') : 'Indefinida',
      'Días en Préstamo': daysOut,
      'Estado Alerta': daysOut > 3 ? 'ALERTA: PRÉSTAMO PROLONGADO' : 'DENTRO DE PLAZO',
      'Condición Inicial': l.deliveryCondition
    };
  });
  const wsLoans = XLSX.utils.json_to_sheet(loanRows);
  XLSX.utils.book_append_sheet(wb, wsLoans, 'Herramientas Pendientes');

  // 4. Sheet: Registro de Daños y Pérdidas
  const incRows = incidents.map((inc, idx) => ({
    'N°': idx + 1,
    'Fecha Incidente': new Date(inc.date).toLocaleDateString('es-CL'),
    'Folio Acta': inc.lossActFolio || `ACT-${String(idx + 1).padStart(5, '0')}`,
    'Tipo Incidente': inc.type === 'PERDIDA' ? 'PÉRDIDA / EXTRAVÍO' : 'DAÑO DE MATERIAL',
    'Tipo Ítem': inc.itemType,
    'Código': inc.itemCode,
    'Descripción del Ítem': inc.itemName,
    'Marca': inc.brand || '-',
    'Cantidad Afectada': inc.quantity,
    'Trabajador Responsable': inc.responsibleName,
    'RUT Responsable': inc.responsibleRut || 'No especificado',
    'Teléfono': inc.responsiblePhone || 'No especificado',
    'Lugar / Faena': inc.location,
    'Descripción de los Hechos': inc.description,
    'Costo Estimado (CLP)': inc.estimatedCost || 0,
    'Estado Resolución': inc.resolutionStatus,
    'Acta Firmada en Pantalla': inc.lossActSigned ? 'SÍ (Firma Digital)' : 'PENDIENTE'
  }));
  const wsInc = XLSX.utils.json_to_sheet(incRows);
  XLSX.utils.book_append_sheet(wb, wsInc, 'Daños y Pérdidas');

  const periodStr = startDate && endDate ? `_${startDate}_al_${endDate}` : '_Historial_Completo';
  const cleanComp = companyName.replace(/[^a-zA-Z0-9]/g, '_');
  exportWorkbook(wb, `Reporte_Consolidado_Bodega_${cleanComp}${periodStr}.xlsx`);
}

export function exportProductMovementsExcel(
  movements: ProductMovement[],
  companyName: string,
  startDate?: string,
  endDate?: string
) {
  const rows = movements.map((m, idx) => ({
    'N°': idx + 1,
    'Fecha y Hora': new Date(m.date).toLocaleString('es-CL'),
    'Código Producto': m.productCode,
    'Descripción del Producto': m.productName,
    'Tipo de Movimiento': m.type,
    'Cantidad': m.quantity,
    'Stock Anterior': m.previousStock,
    'Stock Resultante': m.newStock,
    'Motivo / Justificación': m.reason,
    'Responsable / Proveedor': m.workerOrSupplier || 'N/A',
    'Usuario Bodega': m.user || 'Mauricio Chamorro'
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Movimientos Productos');

  const periodStr = startDate && endDate ? `_${startDate}_al_${endDate}` : '_Historial_Completo';
  exportWorkbook(wb, `Reporte_Movimientos_Productos_${companyName.replace(/[^a-zA-Z0-9]/g, '_')}${periodStr}.xlsx`);
}

export function exportToolLoansExcel(
  loans: ToolLoan[],
  companyName: string,
  startDate?: string,
  endDate?: string
) {
  const rows = loans.map((l, idx) => ({
    'N°': idx + 1,
    'Código Herramienta': l.toolCode,
    'Descripción de la Herramienta': l.toolName,
    'Marca': l.toolBrand || 'Genérica',
    'Trabajador Receptor': l.workerName,
    'RUT / DNI': l.workerRut || 'N/A',
    'Teléfono': l.workerPhone || 'N/A',
    'Cargo / Área': l.workerRole || 'N/A',
    'Fecha y Hora de Entrega': new Date(l.deliveryDate).toLocaleString('es-CL'),
    'Fecha Estimada Devolución': l.expectedReturnDate ? new Date(l.expectedReturnDate).toLocaleDateString('es-CL') : 'No especificada',
    'Fecha y Hora de Devolución Real': l.returnDate ? new Date(l.returnDate).toLocaleString('es-CL') : 'PENDIENTE',
    'Estado del Préstamo': l.status,
    'Condición al Entregar': l.deliveryCondition,
    'Condición al Devolver': l.returnCondition || 'No devuelta aún',
    'Observaciones de Devolución': l.returnNotes || '-'
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Préstamos y Devoluciones');

  const periodStr = startDate && endDate ? `_${startDate}_al_${endDate}` : '_Historial_Completo';
  exportWorkbook(wb, `Reporte_Prestamos_Herramientas_${companyName.replace(/[^a-zA-Z0-9]/g, '_')}${periodStr}.xlsx`);
}

export function exportPendingLoansExcel(
  loans: ToolLoan[],
  companyName: string
) {
  const pending = loans.filter(l => l.status === 'ACTIVO' || l.status === 'ATRASADO');
  const now = new Date().getTime();

  const rows = pending.map((l, idx) => {
    const deliveryMs = new Date(l.deliveryDate).getTime();
    const daysOut = Math.floor((now - deliveryMs) / (1000 * 3600 * 24));
    return {
      'N°': idx + 1,
      'Código Herramienta': l.toolCode,
      'Nombre de Herramienta': l.toolName,
      'Marca': l.toolBrand || 'N/A',
      'En poder de (Trabajador)': l.workerName,
      'RUT': l.workerRut || 'N/A',
      'Teléfono': l.workerPhone || 'N/A',
      'Cargo': l.workerRole || 'N/A',
      'Fecha/Hora Entrega': new Date(l.deliveryDate).toLocaleString('es-CL'),
      'Fecha Prometida Devolución': l.expectedReturnDate ? new Date(l.expectedReturnDate).toLocaleDateString('es-CL') : 'Indefinida',
      'Días Transcurridos en Préstamo': daysOut,
      'Estado Alerta': daysOut > 3 ? 'ALERTA: PRÉSTAMO PROLONGADO' : 'DENTRO DE PLAZO'
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Herramientas Pendientes');

  const dateStr = new Date().toISOString().split('T')[0];
  exportWorkbook(wb, `Reporte_Herramientas_Pendientes_${companyName.replace(/[^a-zA-Z0-9]/g, '_')}_${dateStr}.xlsx`);
}

export function exportProductsInventoryExcel(
  products: Product[],
  companyName: string
) {
  const rows = products.map((p, idx) => ({
    'N°': idx + 1,
    'Código de Barra': p.code,
    'Nombre del Producto / Insumo': p.name,
    'Categoría': p.category,
    'Marca': p.brand || 'Genérica',
    'Cód. Ref Mann Filter': p.isFilter ? (p.mannFilterCode || '-') : 'N/A',
    'Stock Actual': p.stock,
    'Unidad de Medida': p.unit,
    'Stock Mínimo': p.minStock,
    'Ubicación en Bodega': p.location,
    'Estado / Condición': p.condition,
    'Integridad': p.completeness,
    'Detalle / Desgaste': p.conditionNotes || '-',
    'Nivel Crítico': p.stock <= p.minStock ? 'CRÍTICO' : 'NORMAL'
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Inventario Productos');

  const dateStr = new Date().toISOString().split('T')[0];
  exportWorkbook(wb, `Reporte_Inventario_Productos_${companyName.replace(/[^a-zA-Z0-9]/g, '_')}_${dateStr}.xlsx`);
}

export function exportToolsInventoryExcel(
  tools: Tool[],
  companyName: string
) {
  const rows = tools.map((t, idx) => ({
    'N°': idx + 1,
    'Código Herramienta (HERR)': t.code,
    'Nombre de la Herramienta': t.name,
    'Marca': t.brand || 'Genérica',
    'Modelo': t.model || '-',
    'Categoría': t.category,
    'Ubicación': t.location,
    'Disponibilidad Actual': t.status,
    'Estado Físico': t.condition,
    'Integridad': t.completeness,
    'Observaciones de Desgaste/Detalle': t.conditionNotes || '-'
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Inventario Herramientas');

  const dateStr = new Date().toISOString().split('T')[0];
  exportWorkbook(wb, `Reporte_Inventario_Herramientas_${companyName.replace(/[^a-zA-Z0-9]/g, '_')}_${dateStr}.xlsx`);
}

export function exportIncidentsExcel(
  incidents: Incident[],
  companyName: string,
  startDate?: string,
  endDate?: string
) {
  const rows = incidents.map((inc, idx) => ({
    'N°': idx + 1,
    'Fecha Incidente': new Date(inc.date).toLocaleDateString('es-CL'),
    'Tipo de Incidente': inc.type,
    'Tipo de Ítem': inc.itemType,
    'Código': inc.itemCode,
    'Descripción del Ítem': inc.itemName,
    'Marca': inc.brand || '-',
    'Cantidad': inc.quantity,
    'Responsable': inc.responsibleName,
    'RUT Responsable': inc.responsibleRut || 'No especificado',
    'Teléfono': inc.responsiblePhone || 'No especificado',
    'Lugar / Ubicación': inc.location,
    'Descripción del Hecho': inc.description,
    'Costo Estimado (CLP)': inc.estimatedCost || 0,
    'Estado de Resolución': inc.resolutionStatus,
    'Acta Firmada': inc.lossActSigned ? 'SÍ' : 'NO'
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Daños y Pérdidas');

  const periodStr = startDate && endDate ? `_${startDate}_al_${endDate}` : '_Historial_Completo';
  exportWorkbook(wb, `Reporte_Danos_y_Perdidas_${companyName.replace(/[^a-zA-Z0-9]/g, '_')}${periodStr}.xlsx`);
}

export function exportPurchaseRequestsExcel(
  requests: PurchaseRequest[],
  companyName: string,
  startDate?: string,
  endDate?: string
) {
  const rows = requests.map((r, idx) => ({
    'N°': idx + 1,
    'Fecha Solicitud': new Date(r.date).toLocaleDateString('es-CL'),
    'Solicitante': r.requesterName,
    'Insumo / Herramienta Requerida': r.itemName,
    'Categoría': r.category,
    'Cantidad': r.quantity,
    'Nivel de Prioridad': r.priority,
    'Justificación': r.justification,
    'Estado Solicitud': r.status,
    'Costo Estimado (CLP)': r.estimatedCost || 0
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Solicitudes de Compra');

  const periodStr = startDate && endDate ? `_${startDate}_al_${endDate}` : '_Historial_Completo';
  exportWorkbook(wb, `Reporte_Solicitudes_Compra_${companyName.replace(/[^a-zA-Z0-9]/g, '_')}${periodStr}.xlsx`);
}
