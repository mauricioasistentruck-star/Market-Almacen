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
  const emisorGiro = config?.giro || company?.industry || 'VENTA DE REPUESTOS Y SERVICIOS AUTOMOTRICES';
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

  // Línea divisoria
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.line(14, 42, pageWidth - 14, 42);

  // 3. Recuadro Datos del Cliente / Receptor
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, 45, pageWidth - 28, 26, 1.5, 1.5, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(14, 45, pageWidth - 28, 26, 1.5, 1.5, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);

  const leftCol = 18;
  const rightCol = pageWidth / 2 + 10;
  let clientY = 51;

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
    startY: 75,
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

  const finalY = (doc as any).lastAutoTable.finalY || 140;

  // 5. Timbre Electrónico TED (Izquierda abajo)
  drawSiiTedStamp(doc, 14, finalY + 8, 70, 32, sale, config);

  // 6. Recuadro de Totales (Derecha abajo)
  const totX = pageWidth - 84;
  const totY = finalY + 8;
  const totW = 70;
  const totH = 32;

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
  doc.line(totX + 4, totY + 18, totX + totW - 4, totY + 18);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('TOTAL:', totX + 4, totY + 26);
  doc.text(formatCLP(sale.total), totX + totW - 4, totY + 26, { align: 'right' });

  // Estado SII & Referencias
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Vendedor: ${sale.sellerName || 'Cajero Principal'} | Estado DTE: ${sale.siiStatus}`, 14, finalY + 45);

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
  const emisorGiro = config?.giro || company?.industry || 'VENTA DE REPUESTOS Y SERVICIOS';
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
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text('¡Gracias por su compra!', pageWidth / 2, curY, { align: 'center' });

  return doc;
}
