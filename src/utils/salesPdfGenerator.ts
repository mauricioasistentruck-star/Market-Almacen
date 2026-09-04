import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Sale, Company, SiiConfig } from '../types';

// Formateador de moneda chilena
export function formatCLP(amount: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0
  }).format(Math.round(amount || 0));
}

export function formatRut(rutStr?: string): string {
  if (!rutStr) return '';
  const clean = rutStr.replace(/[^0-9kK]/g, '').toUpperCase();
  if (clean.length < 2) return clean;
  const dv = clean.slice(-1);
  const num = clean.slice(0, -1);
  return `${num.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}-${dv}`;
}

export function getDteLabel(dteType: string): string {
  switch (dteType) {
    case 'BOLETA_ELECTRONICA': return 'BOLETA ELECTRÓNICA';
    case 'FACTURA_ELECTRONICA': return 'FACTURA ELECTRÓNICA';
    case 'BOLETA_EXENTA': return 'BOLETA EXENTA ELECTRÓNICA';
    case 'FACTURA_EXENTA': return 'FACTURA EXENTA ELECTRÓNICA';
    case 'TICKET_INTERNO': return 'COMPROBANTE DE VENTA INTERNO';
    default: return 'DOCUMENTO DE VENTA';
  }
}

export function getPaymentMethodLabel(method: string): string {
  switch (method) {
    case 'EFECTIVO': return 'Efectivo';
    case 'DEBITO': return 'Tarjeta Débito (Redcompra)';
    case 'CREDITO': return 'Tarjeta Crédito';
    case 'TRANSFERENCIA': return 'Transferencia Bancaria';
    case 'CHEQUE': return 'Cheque';
    default: return 'Otro Medio de Pago';
  }
}

/**
 * Dibuja el Timbre Electrónico DTE (TED) reglamentario del SII
 */
function drawSiiTedStamp(doc: jsPDF, x: number, y: number, width: number, height: number, sale: Sale, config?: SiiConfig) {
  doc.setDrawColor(220, 38, 38); // Rojo SII
  doc.setLineWidth(0.6);
  doc.roundedRect(x, y, width, height, 2, 2, 'S');

  // Encabezado TED
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(x + 0.5, y + 0.5, width - 1, 6, 1, 1, 'F');
  doc.setTextColor(185, 28, 28);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('Timbre Electrónico SII', x + width / 2, y + 4.5, { align: 'center' });

  // Contenido central / barras simuladas de timbre bidimensional PDF417
  doc.setTextColor(30, 41, 59);
  doc.setFont('courier', 'bold');
  doc.setFontSize(6.5);
  const resNum = config?.resolucionNumero || '80';
  const resYear = config?.resolucionFecha ? config.resolucionFecha.slice(0, 4) : '2014';
  doc.text(`Res. Ex. SII N° ${resNum} de ${resYear}`, x + width / 2, y + 10, { align: 'center' });

  // Dibujar patrón de código PDF417 / Matriz de seguridad DTE
  doc.setFillColor(15, 23, 42);
  const barStartY = y + 12;
  const barH = 10;
  const barW = width - 8;
  const barStartX = x + 4;
  
  // Dibujar franjas representativas del timbre electrónico cifrado
  const seed = (sale.folio || '12345').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  for (let i = 0; i < barW; i += 1.5) {
    const isBar = ((i * 7 + seed) % 5) !== 0;
    if (isBar) {
      doc.rect(barStartX + i, barStartY, 0.9, barH, 'F');
    }
  }

  // Pie del timbre
  doc.setTextColor(71, 85, 105);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.text('Verifique documento: www.sii.cl', x + width / 2, y + height - 2, { align: 'center' });
}

/**
 * Genera PDF en Formato Carta / A4 para Boletas y Facturas Electrónicas
 */
export function generateSaleInvoicePDF(sale: Sale, company?: Company, config?: SiiConfig): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const emisorRut = formatRut(config?.rutEmisor || company?.rut || '76.123.456-7');
  const emisorNombre = (config?.razonSocial || company?.name || 'MARKET ALMACÉN SpA').toUpperCase();
  const emisorGiro = config?.giro || company?.industry || 'VENTA AL POR MENOR EN ALMACENES Y MINIMARKET';
  const emisorDir = config?.direccionOrigen || company?.address || 'Av. Principal 1234';
  const emisorComuna = config?.comunaOrigen || 'Santiago';
  const emisorCiudad = config?.ciudadOrigen || 'Santiago';

  // 1. Datos Emisor (Izquierda)
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(emisorNombre, 14, 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`GIRO: ${emisorGiro}`, 14, 23);
  doc.text(`DIRECCIÓN: ${emisorDir}, ${emisorComuna} - ${emisorCiudad}`, 14, 27.5);
  if (config?.telefono || company?.phone) {
    doc.text(`TELÉFONO: ${config?.telefono || company?.phone}`, 14, 32);
  }
  if (config?.email) {
    doc.text(`EMAIL: ${config.email}`, 14, 36.5);
  }

  // 2. Recuadro Tributario Rojo SII (Derecha Superior)
  const boxX = pageWidth - 78;
  const boxY = 12;
  const boxW = 64;
  const boxH = 28;

  doc.setDrawColor(220, 38, 38);
  doc.setLineWidth(0.8);
  doc.rect(boxX, boxY, boxW, boxH, 'S');

  doc.setTextColor(220, 38, 38);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(`R.U.T.: ${emisorRut}`, boxX + boxW / 2, boxY + 7, { align: 'center' });

  doc.setFontSize(9.5);
  doc.text(getDteLabel(sale.dteType), boxX + boxW / 2, boxY + 14, { align: 'center' });

  doc.setFontSize(11);
  doc.text(`N° ${sale.dteFolio || sale.folio}`, boxX + boxW / 2, boxY + 22, { align: 'center' });

  doc.setFontSize(7.5);
  doc.text(`S.I.I. - SANTIAGO ORIENTE`, boxX + boxW / 2, boxY + 26.5, { align: 'center' });

  // Recuadro Timbre ANULADO en DTE si la venta está anulada
  if (sale.status === 'ANULADA') {
    const stampW = 94;
    const stampH = 13;
    const stampX = (pageWidth - stampW) / 2;
    const stampY = 41;

    doc.setDrawColor(220, 38, 38);
    doc.setLineWidth(1.2);
    doc.setFillColor(254, 242, 242);
    doc.roundedRect(stampX, stampY, stampW, stampH, 2, 2, 'FD');

    doc.setTextColor(220, 38, 38);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text('ANULADO', stampX + stampW / 2, stampY + 6.5, { align: 'center' });

    doc.setFontSize(7.5);
    doc.text('DOCUMENTO ANULADO EN SISTEMA - SIN VALOR TRIBUTARIO', stampX + stampW / 2, stampY + 10.5, { align: 'center' });
  }

  // Línea divisoria
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.line(14, sale.status === 'ANULADA' ? 56 : 42, pageWidth - 14, sale.status === 'ANULADA' ? 56 : 42);

  // 3. Recuadro Datos del Cliente / Receptor
  const clientBoxY = sale.status === 'ANULADA' ? 58 : 45;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, clientBoxY, pageWidth - 28, 26, 1.5, 1.5, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(14, clientBoxY, pageWidth - 28, 26, 1.5, 1.5, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);

  const leftCol = 18;
  const rightCol = pageWidth / 2 + 10;
  let clientY = clientBoxY + 6;

  doc.text('SEÑOR(ES):', leftCol, clientY);
  doc.setFont('helvetica', 'normal');
  doc.text(sale.customerName || 'CLIENTE GENERAL / CONSUMIDOR FINAL', leftCol + 22, clientY);

  doc.setFont('helvetica', 'bold');
  doc.text('R.U.T.:', rightCol, clientY);
  doc.setFont('helvetica', 'normal');
  doc.text(formatRut(sale.customerRut || '66.666.666-6'), rightCol + 14, clientY);

  clientY += 6;
  doc.setFont('helvetica', 'bold');
  doc.text('GIRO:', leftCol, clientY);
  doc.setFont('helvetica', 'normal');
  doc.text(sale.customerBusiness || 'PARTICULAR / COMERCIAL', leftCol + 22, clientY);

  doc.setFont('helvetica', 'bold');
  doc.text('FECHA:', rightCol, clientY);
  doc.setFont('helvetica', 'normal');
  doc.text(`${sale.date} ${sale.time || ''}`, rightCol + 14, clientY);

  clientY += 6;
  doc.setFont('helvetica', 'bold');
  doc.text('DIRECCIÓN:', leftCol, clientY);
  doc.setFont('helvetica', 'normal');
  doc.text(`${sale.customerAddress || 'DIRECCIÓN LOCAL'}${sale.customerCity ? ` - ${sale.customerCity}` : ''}`, leftCol + 22, clientY);

  doc.setFont('helvetica', 'bold');
  doc.text('MEDIO PAGO:', rightCol, clientY);
  doc.setFont('helvetica', 'normal');
  doc.text(getPaymentMethodLabel(sale.paymentMethod), rightCol + 24, clientY);

  // 4. Tabla de Ítems
  const tableData = sale.items.map((item, index) => [
    (index + 1).toString(),
    item.productCode || '---',
    item.productName,
    (item.quantity < 1 || !Number.isInteger(item.quantity) ? `${item.quantity.toFixed(3)} ${item.unit || 'Kg'}` : `${item.quantity} ${item.unit || 'UN'}`),
    formatCLP(item.unitPrice),
    formatCLP(item.subtotal)
  ]);

  autoTable(doc, {
    startY: sale.status === 'ANULADA' ? 88 : 75,
    head: [['#', 'Código', 'Descripción del Producto', 'Cant.', 'Precio Unit.', 'Subtotal']],
    body: tableData,
    theme: 'striped',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'left'
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [51, 65, 85]
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 28 },
      2: { cellWidth: 'auto' },
      3: { cellWidth: 16, halign: 'center' },
      4: { cellWidth: 26, halign: 'right' },
      5: { cellWidth: 28, halign: 'right', fontStyle: 'bold' }
    },
    margin: { left: 14, right: 14 }
  });

  const pageHeight = doc.internal.pageSize.getHeight();
  const finalY = (doc as any).lastAutoTable.finalY || 140;

  // 5 y 6. Pie de Página DTE Oficial SII (Fijado abajo en la hoja carta)
  const totH = 34;
  const totW = 74;
  const tedW = 74;
  const tedH = 34;
  const bottomMargin = 16;
  const fixedFooterY = pageHeight - totH - bottomMargin;

  // Si la tabla es muy larga y colisiona con el pie de página, agregar página o desplazar
  let footerY = fixedFooterY;
  if (finalY + 8 > fixedFooterY) {
    if (finalY + 8 + totH + bottomMargin > pageHeight) {
      doc.addPage();
      footerY = fixedFooterY;
    } else {
      footerY = finalY + 8;
    }
  }

  // 5. Timbre Electrónico TED (Izquierda pie de página)
  drawSiiTedStamp(doc, 14, footerY, tedW, tedH, sale, config);

  // 6. Recuadro de Totales (Derecha pie de página)
  const totX = pageWidth - 14 - totW;
  const totY = footerY;

  doc.setFillColor(248, 250, 252);
  doc.roundedRect(totX, totY, totW, totH, 1.5, 1.5, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(totX, totY, totW, totH, 1.5, 1.5, 'S');

  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);

  // MONTO NETO
  doc.text('MONTO NETO:', totX + 4, totY + 7);
  doc.text(formatCLP(sale.subtotalNeto), totX + totW - 4, totY + 7, { align: 'right' });

  // 19% I.V.A.
  doc.text('19% I.V.A.:', totX + 4, totY + 14);
  doc.text(formatCLP(sale.iva), totX + totW - 4, totY + 14, { align: 'right' });

  // TOTAL
  doc.setDrawColor(203, 213, 225);
  doc.line(totX + 4, totY + 19, totX + totW - 4, totY + 19);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('TOTAL:', totX + 4, totY + 28);
  doc.text(formatCLP(sale.total), totX + totW - 4, totY + 28, { align: 'right' });

  // Timbre central grande ANULADO en DTE
  if (sale.status === 'ANULADA') {
    const midX = pageWidth / 2;
    const midY = pageHeight / 2 - 5;
    const stampBoxW = 110;
    const stampBoxH = 26;

    doc.saveGraphicsState();
    doc.setDrawColor(220, 38, 38);
    doc.setLineWidth(1.8);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(midX - stampBoxW / 2, midY - stampBoxH / 2, stampBoxW, stampBoxH, 3, 3, 'FD');

    doc.setTextColor(220, 38, 38);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(28);
    doc.text('ANULADO', midX, midY + 4, { align: 'center' });

    doc.setFontSize(8.5);
    doc.text('DOCUMENTO SIN VALOR LEGAL NI TRIBUTARIO', midX, midY + 9.5, { align: 'center' });
    doc.restoreGraphicsState();
  }

  // Estado SII & Referencias
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Vendedor: ${sale.sellerName || 'Cajero Principal'} | Estado DTE: ${sale.siiStatus} | Timbre Electrónico SII Res. Ex. N° ${config?.resolucionNumero || '80'}`, 14, footerY + totH + 7);

  return doc;
}

/**
 * Genera PDF en Formato Ticket Térmico POS (80mm) para Boletas y Tickets
 */
export function generateSaleThermalTicketPDF(sale: Sale, company?: Company, config?: SiiConfig): jsPDF {
  // Altura dinámica según la cantidad de productos
  const estimatedHeight = Math.max(160, 100 + sale.items.length * 8);

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [80, estimatedHeight]
  });

  const pageWidth = 80;
  const emisorRut = formatRut(config?.rutEmisor || company?.rut || '76.123.456-7');
  const emisorNombre = (config?.razonSocial || company?.name || 'MARKET ALMACÉN SpA').toUpperCase();
  const emisorGiro = config?.giro || company?.industry || 'VENTA AL POR MENOR EN ALMACENES Y MINIMARKET';
  const emisorDir = config?.direccionOrigen || company?.address || 'Av. Principal 1234';

  let curY = 8;

  // Encabezado
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text(emisorNombre, pageWidth / 2, curY, { align: 'center' });

  curY += 4.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105);
  doc.text(`RUT: ${emisorRut}`, pageWidth / 2, curY, { align: 'center' });

  curY += 3.5;
  doc.text(emisorGiro, pageWidth / 2, curY, { align: 'center' });

  curY += 3.5;
  doc.text(emisorDir, pageWidth / 2, curY, { align: 'center' });

  // Recuadro DTE
  curY += 5;
  doc.setDrawColor(220, 38, 38);
  doc.setLineWidth(0.5);
  doc.rect(8, curY, 64, 14, 'S');

  doc.setTextColor(220, 38, 38);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(getDteLabel(sale.dteType), pageWidth / 2, curY + 5, { align: 'center' });

  doc.setFontSize(9);
  doc.text(`N° ${sale.dteFolio || sale.folio}`, pageWidth / 2, curY + 10, { align: 'center' });

  curY += 17;

  // TIMBRE ROJO DE ANULADO EN TICKET
  if (sale.status === 'ANULADA') {
    doc.setDrawColor(220, 38, 38);
    doc.setLineWidth(0.8);
    doc.setFillColor(254, 242, 242);
    doc.rect(6, curY, 68, 12, 'FD');

    doc.setTextColor(220, 38, 38);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('ANULADO', 40, curY + 6, { align: 'center' });

    doc.setFontSize(6.5);
    doc.text('DOCUMENTO ANULADO - SIN VALOR', 40, curY + 10, { align: 'center' });

    curY += 15;
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(30, 41, 59);
  doc.text(`Fecha: ${sale.date} ${sale.time || ''}`, 6, curY);
  doc.text(`Atendió: ${sale.sellerName || 'Caja 1'}`, pageWidth - 6, curY, { align: 'right' });

  if (sale.customerName) {
    curY += 3.5;
    doc.text(`Cliente: ${sale.customerName} (${formatRut(sale.customerRut)})`, 6, curY);
  }

  curY += 3;
  doc.setDrawColor(203, 213, 225);
  doc.line(6, curY, pageWidth - 6, curY);

  // Lista de Ítems
  curY += 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('CANT  DESCRIPCIÓN', 6, curY);
  doc.text('TOTAL', pageWidth - 6, curY, { align: 'right' });

  curY += 2;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);

  sale.items.forEach(item => {
    curY += 3.8;
    const nameLine = item.productName.length > 24 ? item.productName.slice(0, 24) + '...' : item.productName;
    const qtyStr = (item.quantity < 1 || !Number.isInteger(item.quantity)) ? item.quantity.toFixed(3) : item.quantity;
    doc.text(`${qtyStr}x ${nameLine}`, 6, curY);
    doc.text(formatCLP(item.subtotal), pageWidth - 6, curY, { align: 'right' });
  });

  curY += 4;
  doc.line(6, curY, pageWidth - 6, curY);

  // Totales
  curY += 4;
  doc.setFontSize(7.5);
  doc.text('NETO:', 6, curY);
  doc.text(formatCLP(sale.subtotalNeto), pageWidth - 6, curY, { align: 'right' });

  curY += 3.5;
  doc.text('IVA 19%:', 6, curY);
  doc.text(formatCLP(sale.iva), pageWidth - 6, curY, { align: 'right' });

  curY += 4.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text('TOTAL:', 6, curY);
  doc.text(formatCLP(sale.total), pageWidth - 6, curY, { align: 'right' });

  // Pago
  curY += 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.text(`Medio de Pago: ${getPaymentMethodLabel(sale.paymentMethod)}`, 6, curY);

  if (sale.paymentMethod === 'EFECTIVO' && sale.amountPaid) {
    curY += 3.5;
    doc.text(`Efectivo Recibido: ${formatCLP(sale.amountPaid)}`, 6, curY);
    curY += 3.2;
    doc.setFont('helvetica', 'bold');
    doc.text(`Vuelto: ${formatCLP(sale.cashChange || 0)}`, 6, curY);
  }

  // Timbre SII para ticket
  curY += 5;
  drawSiiTedStamp(doc, 10, curY, 60, 24, sale, config);

  curY += 28;
  if (sale.status === 'ANULADA') {
    doc.setTextColor(220, 38, 38);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text('*** DOCUMENTO ANULADO ***', pageWidth / 2, curY, { align: 'center' });
  } else {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text('¡Gracias por su compra!', pageWidth / 2, curY, { align: 'center' });
  }

  return doc;
}


// ============================================================================
// INFORME EJECUTIVO DE VENTAS Y RENDIMIENTO COMERCIAL (PDF CUADRADO PROLIJO)
// ============================================================================

export interface SalesReportData {
  sales: Sale[];
  company?: Company | null;
  periodLabel: string;
  startDate?: string;
  endDate?: string;
}

export function generateSalesReportPDF(data: SalesReportData): jsPDF {
  const { sales, company, periodLabel } = data;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const pageWidth = doc.internal.pageSize.getWidth(); // 215.9 mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 279.4 mm
  const marginX = 14;
  const contentWidth = pageWidth - (marginX * 2); // 187.9 mm

  const activeSales = sales.filter(s => s.status !== 'ANULADA');
  const canceledSales = sales.filter(s => s.status === 'ANULADA');

  const totalSalesCount = activeSales.length;
  const totalRevenue = activeSales.reduce((acc, s) => acc + (s.total || 0), 0);
  const totalNeto = activeSales.reduce((acc, s) => acc + (s.subtotalNeto || 0), 0);
  const totalIva = activeSales.reduce((acc, s) => acc + (s.iva || 0), 0);
  const avgTicket = totalSalesCount > 0 ? Math.round(totalRevenue / totalSalesCount) : 0;

  // 1. Agrupación por Métodos de Pago
  const paymentStats: { [key: string]: { count: number; total: number } } = {
    'EFECTIVO': { count: 0, total: 0 },
    'DEBITO': { count: 0, total: 0 },
    'CREDITO': { count: 0, total: 0 },
    'TRANSFERENCIA': { count: 0, total: 0 },
    'OTRO': { count: 0, total: 0 }
  };

  activeSales.forEach(s => {
    const m = s.paymentMethod || 'OTRO';
    if (paymentStats[m]) {
      paymentStats[m].count += 1;
      paymentStats[m].total += (s.total || 0);
    } else {
      paymentStats['OTRO'].count += 1;
      paymentStats['OTRO'].total += (s.total || 0);
    }
  });

  // 2. Agrupación por Días (Evolución y Top de Ventas Semanal)
  const dayStatsMap: { [dateStr: string]: { dateStr: string; dayName: string; count: number; total: number } } = {};
  const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

  activeSales.forEach(s => {
    try {
      const d = new Date(s.createdAt);
      const dateKey = d.toISOString().split('T')[0];
      const dayName = dayNames[d.getDay()] || 'N/A';
      if (!dayStatsMap[dateKey]) {
        dayStatsMap[dateKey] = { dateStr: dateKey, dayName, count: 0, total: 0 };
      }
      dayStatsMap[dateKey].count += 1;
      dayStatsMap[dateKey].total += (s.total || 0);
    } catch {
      // Ignorar fechas erróneas
    }
  });

  const dayStatsList = Object.values(dayStatsMap).sort((a, b) => a.dateStr.localeCompare(b.dateStr));
  let peakDay: { dayName: string; dateStr: string; total: number } | null = null;
  dayStatsList.forEach(d => {
    if (!peakDay || d.total > peakDay.total) {
      peakDay = { dayName: d.dayName, dateStr: d.dateStr, total: d.total };
    }
  });

  // 3. Top Productos Más Vendidos
  const productMap: { [key: string]: { code: string; name: string; category: string; quantity: number; total: number } } = {};
  activeSales.forEach(s => {
    if (s.items && Array.isArray(s.items)) {
      s.items.forEach(item => {
        const key = item.productId ? String(item.productId) : item.productName;
        if (!productMap[key]) {
          productMap[key] = {
            code: item.productCode || 'S/C',
            name: item.productName || 'Sin Nombre',
            category: (item as any).category || 'General',
            quantity: 0,
            total: 0
          };
        }
        productMap[key].quantity += (item.quantity || 0);
        productMap[key].total += (item.subtotal || 0);
      });
    }
  });

  const topProducts = Object.values(productMap)
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 10);

  // -------------------------------------------------------------
  // DIBUJAR CABECERA EJECUTIVA Y LOGO / TITULAR
  // -------------------------------------------------------------
  let curY = marginX;

  // Franja superior de marca
  doc.setFillColor(37, 99, 235); // Royal Blue Primary
  doc.rect(marginX, curY, contentWidth, 3, 'F');
  curY += 8;

  // Encabezado Empresa y Documento
  doc.setTextColor(15, 23, 42); // Slate-900
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(company?.name || 'MARKET ALMACÉN', marginX, curY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(37, 99, 235);
  doc.text('INFORME EJECUTIVO DE VENTAS', pageWidth - marginX, curY, { align: 'right' });

  curY += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);

  const rutStr = company?.rut ? `RUT: ${formatRut(company.rut)}` : 'RUT: 76.543.210-K';
  const giroStr = company?.industry || company?.tradeName || 'Minimarket, Abarrotes y Venta de Alimentos al por Menor';
  doc.text(rutStr + ' • ' + giroStr, marginX, curY);

  const nowStr = new Intl.DateTimeFormat('es-CL', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Santiago'
  }).format(new Date());

  doc.text(`Emisión: ${nowStr}`, pageWidth - marginX, curY, { align: 'right' });

  curY += 4.5;
  const addressStr = company?.address ? company.address : 'Casa Matriz / Sala de Ventas';
  doc.text(addressStr, marginX, curY);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`Período Analizado: ${periodLabel}`, pageWidth - marginX, curY, { align: 'right' });

  curY += 6;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(marginX, curY, pageWidth - marginX, curY);
  curY += 5;

  // -------------------------------------------------------------
  // TARJETAS RESUMEN DE INDICADORES (KPIs)
  // -------------------------------------------------------------
  const kpiCount = 4;
  const gap = 3.5;
  const cardW = (contentWidth - (gap * (kpiCount - 1))) / kpiCount;
  const cardH = 17;

  const kpiData = [
    { label: 'TOTAL RECAUDADO', value: formatCLP(totalRevenue), color: [16, 185, 129], bg: [236, 253, 245] },
    { label: 'VENTAS NETAS', value: formatCLP(totalNeto), color: [59, 130, 246], bg: [239, 246, 255] },
    { label: 'IVA 19% RECAUDADO', value: formatCLP(totalIva), color: [139, 92, 246], bg: [245, 243, 255] },
    { label: 'TICKET PROMEDIO', value: formatCLP(avgTicket), color: [245, 158, 11], bg: [254, 243, 199] },
  ];

  kpiData.forEach((kpi, idx) => {
    const kpiX = marginX + (idx * (cardW + gap));
    doc.setFillColor(kpi.bg[0], kpi.bg[1], kpi.bg[2]);
    doc.roundedRect(kpiX, curY, cardW, cardH, 2, 2, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(kpiX, curY, cardW, cardH, 2, 2, 'S');

    // Título de tarjeta
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(71, 85, 105);
    doc.text(kpi.label, kpiX + (cardW / 2), curY + 5.5, { align: 'center' });

    // Monto destacado
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(kpi.color[0], kpi.color[1], kpi.color[2]);
    doc.text(kpi.value, kpiX + (cardW / 2), curY + 12.5, { align: 'center' });
  });

  curY += cardH + 7;

  // -------------------------------------------------------------
  // TABLA 1: DESGLOSE POR TIPO DE COMPROBANTE Y DOCUMENTO (DTE)
  // -------------------------------------------------------------
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('1. DESGLOSE POR TIPO DE COMPROBANTE Y DOCUMENTOS EMITIDOS (DTE)', marginX, curY);
  curY += 2;

  const boletasSales = activeSales.filter(s => s.dteType && s.dteType.toUpperCase().includes('BOLETA'));
  const facturasSales = activeSales.filter(s => s.dteType && s.dteType.toUpperCase().includes('FACTURA'));
  const internasSales = activeSales.filter(s => !s.dteType || (!s.dteType.toUpperCase().includes('BOLETA') && !s.dteType.toUpperCase().includes('FACTURA')));

  const dteRows = [
    [
      'Boletas Electrónicas (DTE 39)',
      String(boletasSales.length),
      formatCLP(boletasSales.reduce((acc, s) => acc + (s.subtotalNeto || 0), 0)),
      formatCLP(boletasSales.reduce((acc, s) => acc + (s.iva || 0), 0)),
      formatCLP(boletasSales.reduce((acc, s) => acc + (s.total || 0), 0)),
      totalRevenue > 0 ? `${Math.round((boletasSales.reduce((acc, s) => acc + (s.total || 0), 0) / totalRevenue) * 100)}%` : '0%'
    ],
    [
      'Facturas Electrónicas (DTE 33)',
      String(facturasSales.length),
      formatCLP(facturasSales.reduce((acc, s) => acc + (s.subtotalNeto || 0), 0)),
      formatCLP(facturasSales.reduce((acc, s) => acc + (s.iva || 0), 0)),
      formatCLP(facturasSales.reduce((acc, s) => acc + (s.total || 0), 0)),
      totalRevenue > 0 ? `${Math.round((facturasSales.reduce((acc, s) => acc + (s.total || 0), 0) / totalRevenue) * 100)}%` : '0%'
    ],
    [
      'Comprobantes de Venta Interna',
      String(internasSales.length),
      formatCLP(internasSales.reduce((acc, s) => acc + (s.subtotalNeto || 0), 0)),
      formatCLP(internasSales.reduce((acc, s) => acc + (s.iva || 0), 0)),
      formatCLP(internasSales.reduce((acc, s) => acc + (s.total || 0), 0)),
      totalRevenue > 0 ? `${Math.round((internasSales.reduce((acc, s) => acc + (s.total || 0), 0) / totalRevenue) * 100)}%` : '0%'
    ],
    [
      'TOTAL CONSOLIDADO',
      String(totalSalesCount),
      formatCLP(totalNeto),
      formatCLP(totalIva),
      formatCLP(totalRevenue),
      '100%'
    ]
  ];

  autoTable(doc, {
    startY: curY,
    head: [['Tipo de Comprobante / DTE', 'Cant.', 'Neto ($)', 'IVA 19% ($)', 'Total Recaudado ($)', '% Part.']],
    body: dteRows,
    theme: 'grid',
    margin: { left: marginX, right: marginX },
    tableWidth: contentWidth,
    styles: {
      font: 'helvetica',
      fontSize: 7.5,
      cellPadding: 1.8,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.2
    },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center'
    },
    columnStyles: {
      0: { halign: 'left', fontStyle: 'bold' },
      1: { halign: 'center', fontStyle: 'bold' },
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right', fontStyle: 'bold' },
      5: { halign: 'center' }
    }
  });

  curY = (doc as any).lastAutoTable.finalY + 6;

  // -------------------------------------------------------------
  // TABLA 2: DESGLOSE POR MEDIO DE PAGO
  // -------------------------------------------------------------
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('2. DESGLOSE FINANCIERO POR FORMA DE PAGO', marginX, curY);
  curY += 2;

  const paymentRows = [
    ['Efectivo', paymentStats['EFECTIVO'].count, formatCLP(paymentStats['EFECTIVO'].total), totalRevenue > 0 ? `${Math.round((paymentStats['EFECTIVO'].total / totalRevenue) * 100)}%` : '0%'],
    ['Tarjeta Débito (Redcompra)', paymentStats['DEBITO'].count, formatCLP(paymentStats['DEBITO'].total), totalRevenue > 0 ? `${Math.round((paymentStats['DEBITO'].total / totalRevenue) * 100)}%` : '0%'],
    ['Tarjeta Crédito', paymentStats['CREDITO'].count, formatCLP(paymentStats['CREDITO'].total), totalRevenue > 0 ? `${Math.round((paymentStats['CREDITO'].total / totalRevenue) * 100)}%` : '0%'],
    ['Transferencia Bancaria', paymentStats['TRANSFERENCIA'].count, formatCLP(paymentStats['TRANSFERENCIA'].total), totalRevenue > 0 ? `${Math.round((paymentStats['TRANSFERENCIA'].total / totalRevenue) * 100)}%` : '0%'],
  ];

    // Fila Total
  paymentRows.push([
    'TOTAL GENERAL',
    totalSalesCount,
    formatCLP(totalRevenue),
    '100%'
  ]);

  autoTable(doc, {
    startY: curY,
    head: [['Forma de Pago', 'Transacciones', 'Monto Recaudado', 'Participación']],
    body: paymentRows,
    theme: 'grid',
    margin: { left: marginX, right: marginX },
    tableWidth: contentWidth,
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: 2,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.2
    },
    headStyles: {
      fillColor: [37, 99, 235],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center'
    },
    columnStyles: {
      0: { halign: 'left', fontStyle: 'bold' },
      1: { halign: 'center' },
      2: { halign: 'right', fontStyle: 'bold' },
      3: { halign: 'center' }
    },
    didParseCell: (hookData) => {
      // Destacar la fila de totales
      if (hookData.section === 'body' && hookData.row.index === paymentRows.length - 1) {
        hookData.cell.styles.fontStyle = 'bold';
        hookData.cell.styles.fillColor = [241, 245, 249];
        hookData.cell.styles.textColor = [15, 23, 42];
      }
    }
  });

  curY = (doc as any).lastAutoTable.finalY + 7;

  // -------------------------------------------------------------
  // TABLA 2: TOP DE VENTAS POR DÍA / EVOLUCIÓN SEMANAL
  // -------------------------------------------------------------
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('2. TOP DE VENTAS POR DÍA (DISTRIBUCIÓN TEMPORAL)', marginX, curY);

  if (peakDay && (peakDay as any).total > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(16, 185, 129);
    doc.text(`★ Día Récord: ${(peakDay as any).dayName} (${formatCLP((peakDay as any).total)})`, pageWidth - marginX, curY, { align: 'right' });
  }

  curY += 2;

  const weeklyRows = dayStatsList.map(d => [
    d.dayName,
    d.dateStr,
    d.count,
    formatCLP(d.total),
    totalRevenue > 0 ? `${Math.round((d.total / totalRevenue) * 100)}%` : '0%',
    d.dateStr === peakDay?.dateStr ? '★ Mayor Venta' : 'Normal'
  ]);

  if (weeklyRows.length === 0) {
    weeklyRows.push(['Sin registros en el período', '-', 0, '$0', '0%', '-']);
  }

  autoTable(doc, {
    startY: curY,
    head: [['Día', 'Fecha', 'Ventas', 'Total del Día', '% del Período', 'Rendimiento']],
    body: weeklyRows,
    theme: 'grid',
    margin: { left: marginX, right: marginX },
    tableWidth: contentWidth,
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: 2,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.2
    },
    headStyles: {
      fillColor: [79, 70, 229], // Indigo
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center'
    },
    columnStyles: {
      0: { halign: 'left', fontStyle: 'bold' },
      1: { halign: 'center' },
      2: { halign: 'center' },
      3: { halign: 'right', fontStyle: 'bold' },
      4: { halign: 'center' },
      5: { halign: 'center' }
    },
    didParseCell: (hookData) => {
      if (hookData.section === 'body' && hookData.cell.text[0]?.includes('★')) {
        hookData.cell.styles.textColor = [16, 185, 129];
        hookData.cell.styles.fontStyle = 'bold';
      }
    }
  });

  curY = (doc as any).lastAutoTable.finalY + 7;

  // Comprobar si hay espacio suficiente para la siguiente tabla o pasar de página
  if (curY > pageHeight - 65) {
    doc.addPage();
    curY = marginX;
  }

  // -------------------------------------------------------------
  // TABLA 3: TOP PRODUCTOS MÁS VENDIDOS
  // -------------------------------------------------------------
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('3. TOP PRODUCTOS MÁS VENDIDOS (RANKING DE DEMANDA)', marginX, curY);
  curY += 2;

  const topProductRows = topProducts.map((p, idx) => [
    `#${idx + 1}`,
    p.code,
    p.name,
    p.category,
    p.quantity % 1 !== 0 ? `${p.quantity.toFixed(3)} Kg` : `${p.quantity} Un`,
    formatCLP(p.total),
    totalRevenue > 0 ? `${Math.round((p.total / totalRevenue) * 100)}%` : '0%'
  ]);

  if (topProductRows.length === 0) {
    topProductRows.push(['-', '-', 'Sin movimientos registrados', '-', '0', '$0', '0%']);
  }

  autoTable(doc, {
    startY: curY,
    head: [['Rank', 'Código / SKU', 'Descripción del Producto', 'Familia', 'Cantidad', 'Total ($)', '% Ventas']],
    body: topProductRows,
    theme: 'grid',
    margin: { left: marginX, right: marginX },
    tableWidth: contentWidth,
    styles: {
      font: 'helvetica',
      fontSize: 7.8,
      cellPadding: 2,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.2
    },
    headStyles: {
      fillColor: [15, 23, 42], // Slate dark
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center'
    },
    columnStyles: {
      0: { halign: 'center', fontStyle: 'bold' },
      1: { halign: 'center', font: 'courier' },
      2: { halign: 'left', fontStyle: 'bold' },
      3: { halign: 'left' },
      4: { halign: 'center', fontStyle: 'bold' },
      5: { halign: 'right', fontStyle: 'bold' },
      6: { halign: 'center' }
    }
  });

  // -------------------------------------------------------------
  // PIE DE PÁGINA CUADRADO CON NUMERACIÓN (Página X de Y)
  // -------------------------------------------------------------
  const totalPages = (doc.internal as any).getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.4);
    doc.line(marginX, pageHeight - 12, pageWidth - marginX, pageHeight - 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text('Market Almacén — Sistema Integral de Inventario, POS y Facturación SII', marginX, pageHeight - 8);
    doc.text(`Página ${i} de ${totalPages}`, pageWidth - marginX, pageHeight - 8, { align: 'right' });
  }

  return doc;
}
