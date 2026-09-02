import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import type { Sale, CashClosing } from '../types';
import { getDteLabel, getPaymentMethodLabel, formatRut } from './salesPdfGenerator';

export function exportSalesLedgerExcel(sales: Sale[], companyName?: string, dateRangeText?: string): void {
  const wb = XLSX.utils.book_new();

  const dataRows = sales.map((s, idx) => ({
    'N°': idx + 1,
    'Folio': s.folio,
    'Fecha': s.date,
    'Hora': s.time || '',
    'Tipo Documento': getDteLabel(s.dteType),
    'Folio DTE': s.dteFolio || s.folio,
    'RUT Cliente': formatRut(s.customerRut),
    'Nombre Cliente / Razón Social': s.customerName || 'Consumidor Final',
    'Giro': s.customerBusiness || '',
    'Medio de Pago': getPaymentMethodLabel(s.paymentMethod),
    'Monto Neto ($)': s.subtotalNeto,
    'IVA 19% ($)': s.iva,
    'Total Venta ($)': s.total,
    'Estado SII': s.siiStatus,
    'Estado Venta': s.status,
    'Vendedor': s.sellerName || '',
    'Observaciones': s.notes || ''
  }));

  const ws = XLSX.utils.json_to_sheet(dataRows);

  // Column widths
  ws['!cols'] = [
    { wch: 5 },  // N
    { wch: 14 }, // Folio
    { wch: 12 }, // Fecha
    { wch: 10 }, // Hora
    { wch: 26 }, // Tipo DTE
    { wch: 14 }, // Folio DTE
    { wch: 14 }, // RUT
    { wch: 30 }, // Cliente
    { wch: 24 }, // Giro
    { wch: 24 }, // Pago
    { wch: 16 }, // Neto
    { wch: 14 }, // IVA
    { wch: 16 }, // Total
    { wch: 16 }, // SII
    { wch: 14 }, // Estado
    { wch: 20 }, // Vendedor
    { wch: 30 }  // Obs
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Libro de Ventas');

  const nowStr = new Date().toISOString().slice(0, 10);
  const fileName = `Libro_Ventas_${companyName ? companyName.replace(/\s+/g, '_') : 'General'}_${nowStr}.xlsx`;
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  saveAs(new Blob([wbout], { type: 'application/octet-stream' }), fileName);
}

export function exportCashClosingsExcel(closings: CashClosing[], companyName?: string): void {
  const wb = XLSX.utils.book_new();

  const dataRows = closings.map((c, idx) => ({
    'N°': idx + 1,
    'Folio Cierre': c.closingFolio,
    'Caja de Atención': c.cashRegisterName || 'Caja 1 - Principal',
    'Fecha': c.date,
    'Hora Apertura': c.openedAt,
    'Hora Cierre': c.closedAt,
    'Responsable': c.responsibleName,
    'Caja Inicial ($)': c.initialCash,
    'Cant. Ventas': c.salesCount,
    'Total Ventas ($)': c.totalSales,
    'Efectivo ($)': c.totalEfectivo,
    'Débito ($)': c.totalDebito,
    'Crédito ($)': c.totalCredito,
    'Transferencias ($)': c.totalTransferencia,
    'Efectivo Esperado ($)': c.expectedCash,
    'Efectivo Real ($)': c.actualCash,
    'Diferencia Cuadratura ($)': c.cashDifference,
    'Estado': c.status,
    'Notas': c.notes || ''
  }));

  const ws = XLSX.utils.json_to_sheet(dataRows);
  ws['!cols'] = [
    { wch: 5 }, { wch: 16 }, { wch: 12 }, { wch: 14 }, { wch: 14 },
    { wch: 22 }, { wch: 16 }, { wch: 12 }, { wch: 18 }, { wch: 16 },
    { wch: 16 }, { wch: 16 }, { wch: 18 }, { wch: 18 }, { wch: 16 },
    { wch: 20 }, { wch: 12 }, { wch: 30 }
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Cierres de Caja');

  const nowStr = new Date().toISOString().slice(0, 10);
  const fileName = `Cierres_Caja_${nowStr}.xlsx`;
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  saveAs(new Blob([wbout], { type: 'application/octet-stream' }), fileName);
}
