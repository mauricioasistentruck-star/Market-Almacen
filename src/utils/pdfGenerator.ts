import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ReceptionGuide, DeliveryGuide, Incident, Company, ProductMovement, ToolLoan, LogbookEntry, PurchaseRequest } from '../types';
import { MAURICIO_CHAMORRO_SIGNATURE_BASE64 } from './signatureAsset';

// Helper to load logo as base64 string
async function getLogoBase64(): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = '/logo.png';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width || 200;
      canvas.height = img.height || 200;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } else {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
  });
}

// -------------------------------------------------------------
// 1. GENERATE RECEPTION GUIDE PDF (With Optional Invoice Page 2)
// -------------------------------------------------------------
export async function generateReceptionGuidePDF(guide: ReceptionGuide, company?: Company): Promise<jsPDF> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  const logoBase64 = await getLogoBase64();
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'PNG', margin, 12, 22, 22);
    } catch {
      // ignore
    }
  }

  // Header Info
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(16, 185, 129);
  doc.text(company?.name || 'MARKET ALMACÉN SpA', 38, 17);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(70, 70, 70);
  doc.text(`RUT: ${company?.rut || '77.542.190-8'} | Giro: ${company?.industry || 'Venta de Alimentos y Abarrotes'}`, 38, 22);
  doc.text(`Dirección: ${company?.address || 'Av. Central 1234, Santiago'} | Fono: ${company?.phone || '+56 9 8452 1190'}`, 38, 27);

  // Title Box
  const titleBoxWidth = 64;
  const titleBoxX = pageWidth - margin - titleBoxWidth;
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.4);
  doc.rect(titleBoxX, 12, titleBoxWidth, 20);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(20, 20, 20);
  doc.text('GUÍA DE RECEPCIÓN', titleBoxX + titleBoxWidth / 2, 17, { align: 'center' });

  doc.setTextColor(16, 185, 129);
  doc.setFontSize(9);
  doc.text(`FOLIO: ${guide.folio}`, titleBoxX + titleBoxWidth / 2, 22, { align: 'center' });

  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'normal');
  doc.text(`Fecha: ${new Date(guide.date).toLocaleString('es-CL')}`, titleBoxX + titleBoxWidth / 2, 27, { align: 'center' });

  // Carrier / Supplier Box
  doc.setFillColor(248, 250, 252);
  doc.rect(margin, 36, contentWidth, 24, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.rect(margin, 36, contentWidth, 24, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text('DATOS DEL PROVEEDOR / TRANSPORTISTA:', margin + 4, 41);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(`Proveedor / Conductor: ${guide.supplierOrCarrierName}`, margin + 4, 46);
  doc.text(`RUT: ${guide.supplierRut || 'No especificado'}`, margin + 4, 51);
  doc.text(`Fono: ${guide.carrierPhone || 'No especificado'}`, margin + 4, 56);

  doc.text(`Patente Vehículo: ${guide.carrierVehiclePlate || 'No registrada'}`, margin + contentWidth / 2, 46);
  doc.text(`Doc. Tributario Ext.: ${guide.externalDocNumber || 'S/N'}`, margin + contentWidth / 2, 51);
  doc.text(`Empresa Receptora: ${guide.companyName}`, margin + contentWidth / 2, 56);

  // Table of Items
  const tableRows = guide.items.map((it, idx) => [
    (idx + 1).toString(),
    it.code,
    it.name,
    `${it.quantity} ${it.unit || 'UN'}`,
    it.brand || '-',
    it.isNewItem ? 'Nuevo Registro' : 'Existente'
  ]);

  autoTable(doc, {
    startY: 64,
    head: [['#', 'CÓDIGO', 'DESCRIPCIÓN DE MERCADERÍA / PRODUCTO', 'CANT.', 'MARCA', 'TIPO']],
    body: tableRows,
    theme: 'grid',
    styles: { fontSize: 7.5, cellPadding: 2 },
    headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 26, fontStyle: 'bold' },
      2: { cellWidth: 'auto' },
      3: { cellWidth: 24, halign: 'center' },
      4: { cellWidth: 28 },
      5: { cellWidth: 26, halign: 'center' }
    },
    margin: { left: margin, right: margin }
  });

  const finalY = (doc as any).lastAutoTable.finalY + 6;

  // Notes
  if (guide.notes) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text('OBSERVACIONES DE RECEPCIÓN:', margin, finalY);
    doc.setFont('helvetica', 'normal');
    doc.text(guide.notes, margin, finalY + 4, { maxWidth: contentWidth });
  }

  // Footer: Timbre y Firma
  const footerY = Math.max(finalY + 16, pageHeight - 38);

  // Timbre Digital Izquierda
  doc.setDrawColor(16, 185, 129);
  doc.setLineWidth(0.4);
  doc.rect(margin, footerY, 70, 18);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(16, 185, 129);
  doc.text('RECEPCIÓN CONFORME EN BODEGA', margin + 35, footerY + 6, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Folio: ${guide.folio} | Encargado: Mauricio Chamorro`, margin + 35, footerY + 11, { align: 'center' });
  doc.text('Firma Digital y Timbre Oficial OK', margin + 35, footerY + 15, { align: 'center' });

  // Firma Derecha
  doc.setDrawColor(203, 213, 225);
  doc.rect(pageWidth - margin - 70, footerY, 70, 18);
  if (guide.recipientSignature) {
    try {
      doc.addImage(guide.recipientSignature, 'PNG', pageWidth - margin - 65, footerY + 1, 60, 12);
    } catch {}
  }
  doc.setFontSize(6.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Firma / Receptor: ${guide.supplierOrCarrierName}`, pageWidth - margin - 35, footerY + 15, { align: 'center' });

  // =========================================================================
  // HOJA 2: FACTURA / DOCUMENTO TRIBUTARIO ADJUNTO A RECEPCIÓN (SI TIENE)
  // =========================================================================
  if (guide.externalDocNumber && guide.externalDocNumber !== 'S/N') {
    doc.addPage('letter', 'portrait');

    const invPageWidth = doc.internal.pageSize.getWidth();
    const invMargin = 14;
    const invContentWidth = invPageWidth - invMargin * 2;

    // Emisor Info
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text((guide.supplierOrCarrierName || 'PROVEEDOR REGISTRADO').toUpperCase(), invMargin, 18);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`RUT: ${guide.supplierRut || '76.999.888-K'}`, invMargin, 23);
    doc.text('GIRO: DISTRIBUCIÓN Y VENTA DE ALIMENTOS Y ABARROTES', invMargin, 27.5);

    // Recuadro Tributario Rojo SII
    const boxX = invPageWidth - 78;
    const boxY = 12;
    const boxW = 64;
    const boxH = 28;

    doc.setDrawColor(220, 38, 38);
    doc.setLineWidth(0.8);
    doc.rect(boxX, boxY, boxW, boxH, 'S');

    doc.setTextColor(220, 38, 38);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`R.U.T.: ${guide.supplierRut || '76.999.888-K'}`, boxX + boxW / 2, boxY + 7, { align: 'center' });

    doc.setFontSize(9.5);
    doc.text('FACTURA ELECTRÓNICA COMPRA', boxX + boxW / 2, boxY + 14, { align: 'center' });

    doc.setFontSize(11);
    doc.text(`N° ${guide.externalDocNumber}`, boxX + boxW / 2, boxY + 22, { align: 'center' });

    doc.setFontSize(7.5);
    doc.text('S.I.I. - DOCUMENTO DE INGRESO', boxX + boxW / 2, boxY + 26.5, { align: 'center' });

    // Datos de la Empresa Receptora
    doc.setFillColor(248, 250, 252);
    doc.rect(invMargin, 42, invContentWidth, 24, 'F');
    doc.setDrawColor(203, 213, 225);
    doc.rect(invMargin, 42, invContentWidth, 24, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text('DATOS DEL RECEPTOR (DESTINO DE COMPRA):', invMargin + 3, 47);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`SEÑOR(ES): ${company?.name || 'MARKET ALMACÉN SpA'}`, invMargin + 3, 52);
    doc.text(`R.U.T.: ${company?.rut || '77.542.190-8'}`, invMargin + 3, 57);
    doc.text(`DIRECCIÓN: ${company?.address || 'Av. Central 1234, Santiago'}`, invMargin + 3, 62);

    doc.text(`FECHA INGRESO: ${new Date(guide.date).toLocaleDateString('es-CL')}`, invMargin + invContentWidth / 2 + 10, 47);
    doc.text(`GUÍA RECEPCIÓN: ${guide.folio}`, invMargin + invContentWidth / 2 + 10, 52);

    // Tabla de Ítems
    const invRows = guide.items.map((it, idx) => [
      (idx + 1).toString(),
      it.code,
      it.name,
      `${it.quantity} ${it.unit || 'UN'}`,
      it.brand || '-',
      'INGRESADO OK'
    ]);

    autoTable(doc, {
      startY: 69,
      head: [['#', 'CÓDIGO', 'DESCRIPCIÓN DEL ÍTEM / PRODUCTO', 'CANTIDAD', 'MARCA', 'ESTADO']],
      body: invRows,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
      margin: { left: invMargin, right: invMargin }
    });
  }

  return doc;
}

// -------------------------------------------------------------
// 2. GENERATE DELIVERY GUIDE PDF (With Optional Invoice Page 2)
// -------------------------------------------------------------
export async function generateDeliveryGuidePDF(guide: DeliveryGuide, company?: Company): Promise<jsPDF> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  const logoBase64 = await getLogoBase64();
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'PNG', margin, 12, 22, 22);
    } catch {
      // ignore
    }
  }

  // Header Info
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(37, 99, 235);
  doc.text(company?.name || 'MARKET ALMACÉN SpA', 38, 17);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(70, 70, 70);
  doc.text(`RUT: ${company?.rut || '77.542.190-8'} | Giro: ${company?.industry || 'Venta de Alimentos y Abarrotes'}`, 38, 22);
  doc.text(`Dirección: ${company?.address || 'Av. Central 1234, Santiago'} | Fono: ${company?.phone || '+56 9 8452 1190'}`, 38, 27);

  // Title Box
  const titleBoxWidth = 64;
  const titleBoxX = pageWidth - margin - titleBoxWidth;
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.4);
  doc.rect(titleBoxX, 12, titleBoxWidth, 20);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(20, 20, 20);
  doc.text(guide.dispatchType === 'FACTURABLE_CLIENTE' ? 'GUÍA DESPACHO VENTA' : 'GUÍA DE TRASPASO', titleBoxX + titleBoxWidth / 2, 17, { align: 'center' });

  doc.setTextColor(37, 99, 235);
  doc.setFontSize(9);
  doc.text(`FOLIO: ${guide.folio}`, titleBoxX + titleBoxWidth / 2, 22, { align: 'center' });

  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'normal');
  doc.text(`Fecha: ${new Date(guide.date).toLocaleString('es-CL')}`, titleBoxX + titleBoxWidth / 2, 27, { align: 'center' });

  // Recipient Box
  doc.setFillColor(248, 250, 252);
  doc.rect(margin, 36, contentWidth, 24, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.rect(margin, 36, contentWidth, 24, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text('DATOS DEL DESTINATARIO / RECEPTOR:', margin + 4, 41);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(`Receptor / Cliente: ${guide.recipientName}`, margin + 4, 46);
  doc.text(`RUT: ${guide.recipientRut || 'No especificado'}`, margin + 4, 51);
  doc.text(`Teléfono: ${guide.recipientPhone || 'No especificado'}`, margin + 4, 56);

  doc.text(`Tipo: ${guide.dispatchType === 'FACTURABLE_CLIENTE' ? 'FACTURABLE (VENTA)' : 'TRASPASO SUCURSAL'}`, margin + contentWidth / 2, 46);
  doc.text(`Destino / Motivo: ${guide.destinationBranch || guide.worksiteOrReason || 'Despacho regular'}`, margin + contentWidth / 2, 51);
  if (guide.invoiceFolio) {
    doc.text(`Factura Asociada: ${guide.invoiceFolio}`, margin + contentWidth / 2, 56);
  }

  // Items Table
  const tableRows = guide.items.map((it, idx) => [
    (idx + 1).toString(),
    it.code,
    it.name,
    `${it.quantity} ${it.unit || 'UN'}`,
    it.brand || '-'
  ]);

  autoTable(doc, {
    startY: 64,
    head: [['#', 'CÓDIGO', 'DESCRIPCIÓN DE PRODUCTO ENTREGADO', 'CANTIDAD', 'MARCA']],
    body: tableRows,
    theme: 'grid',
    styles: { fontSize: 7.5, cellPadding: 2 },
    headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 26, fontStyle: 'bold' },
      2: { cellWidth: 'auto' },
      3: { cellWidth: 26, halign: 'center' },
      4: { cellWidth: 32 }
    },
    margin: { left: margin, right: margin }
  });

  const finalY = (doc as any).lastAutoTable.finalY + 6;

  // Notes
  if (guide.notes) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text('OBSERVACIONES DE DESPACHO:', margin, finalY);
    doc.setFont('helvetica', 'normal');
    doc.text(guide.notes, margin, finalY + 4, { maxWidth: contentWidth });
  }

  // Footer: Timbre y Firma
  const footerY = Math.max(finalY + 16, pageHeight - 38);

  // Timbre Digital Izquierda
  doc.setDrawColor(37, 99, 235);
  doc.setLineWidth(0.4);
  doc.rect(margin, footerY, 70, 18);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(37, 99, 235);
  doc.text('DESPACHO AUTORIZADO', margin + 35, footerY + 6, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Folio: ${guide.folio} | Encargado: Mauricio Chamorro`, margin + 35, footerY + 11, { align: 'center' });
  doc.text('Salida de Inventario Conforme', margin + 35, footerY + 15, { align: 'center' });

  // Firma Derecha
  doc.setDrawColor(203, 213, 225);
  doc.rect(pageWidth - margin - 70, footerY, 70, 18);
  if (guide.recipientSignature) {
    try {
      doc.addImage(guide.recipientSignature, 'PNG', pageWidth - margin - 65, footerY + 1, 60, 12);
    } catch {}
  }
  doc.setFontSize(6.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Firma / Receptor: ${guide.recipientName}`, pageWidth - margin - 35, footerY + 15, { align: 'center' });

  // =========================================================================
  // HOJA 2: FACTURA ELECTRÓNICA SII (SI ES FACTURABLE)
  // =========================================================================
  if (guide.dispatchType === 'FACTURABLE_CLIENTE' || guide.invoiceFolio) {
    doc.addPage('letter', 'portrait');

    const invPageWidth = doc.internal.pageSize.getWidth();
    const invMargin = 14;
    const invContentWidth = invPageWidth - invMargin * 2;

    // Emisor Info (Izquierda)
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text((company?.name || 'MARKET ALMACÉN SpA').toUpperCase(), invMargin, 18);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`GIRO: ${company?.industry || 'VENTA DE ALIMENTOS, BEBIDAS Y ABARROTES'}`, invMargin, 23);
    doc.text(`DIRECCIÓN: ${company?.address || 'Av. Central 1234, Santiago'}`, invMargin, 27.5);
    doc.text(`TELÉFONO: ${company?.phone || '+56 9 8452 1190'}`, invMargin, 32);

    // Recuadro Tributario Rojo SII (Derecha Superior)
    const boxX = invPageWidth - 78;
    const boxY = 12;
    const boxW = 64;
    const boxH = 28;

    doc.setDrawColor(220, 38, 38);
    doc.setLineWidth(0.8);
    doc.rect(boxX, boxY, boxW, boxH, 'S');

    doc.setTextColor(220, 38, 38);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`R.U.T.: ${company?.rut || '77.542.190-8'}`, boxX + boxW / 2, boxY + 7, { align: 'center' });

    doc.setFontSize(9.5);
    doc.text('FACTURA ELECTRÓNICA', boxX + boxW / 2, boxY + 14, { align: 'center' });

    doc.setFontSize(11);
    doc.text(`N° ${guide.invoiceFolio || 'FAC-1001'}`, boxX + boxW / 2, boxY + 22, { align: 'center' });

    doc.setFontSize(7.5);
    doc.text('S.I.I. - SANTIAGO CENTRO', boxX + boxW / 2, boxY + 26.5, { align: 'center' });

    // Datos del Receptor / Cliente
    doc.setFillColor(248, 250, 252);
    doc.rect(invMargin, 42, invContentWidth, 24, 'F');
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.rect(invMargin, 42, invContentWidth, 24, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text('DATOS DEL RECEPTOR / CLIENTE:', invMargin + 3, 47);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`SEÑOR(ES): ${guide.customerBusinessName || guide.recipientName || 'Cliente General'}`, invMargin + 3, 52);
    doc.text(`R.U.T.: ${guide.recipientRut || '76.123.456-7'}`, invMargin + 3, 57);
    doc.text(`GIRO: ${guide.customerActivity || 'Comercio General'}`, invMargin + 3, 62);

    doc.text(`FECHA EMISIÓN: ${new Date(guide.date).toLocaleDateString('es-CL')}`, invMargin + invContentWidth / 2 + 10, 47);
    doc.text(`GUÍA REFERENCIA: ${guide.folio}`, invMargin + invContentWidth / 2 + 10, 52);
    doc.text(`CONDICIÓN PAGO: AL DÍA / TRANSFERENCIA`, invMargin + invContentWidth / 2 + 10, 57);

    // Tabla de Ítems de la Factura
    const subtotalCalc = guide.items.reduce((acc, it) => acc + (it.price && it.price > 0 ? it.price * it.quantity : 5000 * it.quantity), 0);
    const netoCalc = Math.round(subtotalCalc / 1.19);
    const ivaCalc = subtotalCalc - netoCalc;

    const invRows = guide.items.map((it, idx) => {
      const uPrice = it.price && it.price > 0 ? it.price : 5000;
      const itSubtotal = uPrice * it.quantity;
      return [
        (idx + 1).toString(),
        it.code,
        it.name,
        `${it.quantity} ${it.unit || 'UN'}`,
        `$${uPrice.toLocaleString('es-CL')}`,
        `$${itSubtotal.toLocaleString('es-CL')}`
      ];
    });

    autoTable(doc, {
      startY: 69,
      head: [['#', 'CÓDIGO', 'DESCRIPCIÓN PRODUCTO / SERVICIO', 'CANT.', 'P. UNITARIO', 'TOTAL']],
      body: invRows,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 26, fontStyle: 'bold' },
        2: { cellWidth: 'auto' },
        3: { cellWidth: 22, halign: 'center' },
        4: { cellWidth: 25, halign: 'right' },
        5: { cellWidth: 28, halign: 'right', fontStyle: 'bold' }
      },
      margin: { left: invMargin, right: invMargin }
    });

    const invFinalY = (doc as any).lastAutoTable.finalY + 6;

    // Totals Box (Derecha)
    const totBoxW = 70;
    const totBoxX = invPageWidth - invMargin - totBoxW;
    doc.setFillColor(248, 250, 252);
    doc.rect(totBoxX, invFinalY, totBoxW, 26, 'F');
    doc.setDrawColor(203, 213, 225);
    doc.rect(totBoxX, invFinalY, totBoxW, 26, 'S');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);
    doc.text('MONTO NETO:', totBoxX + 4, invFinalY + 6);
    doc.text(`$${netoCalc.toLocaleString('es-CL')}`, totBoxX + totBoxW - 4, invFinalY + 6, { align: 'right' });

    doc.text('19% I.V.A.:', totBoxX + 4, invFinalY + 13);
    doc.text(`$${ivaCalc.toLocaleString('es-CL')}`, totBoxX + totBoxW - 4, invFinalY + 13, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text('TOTAL:', totBoxX + 4, invFinalY + 21);
    doc.text(`$${subtotalCalc.toLocaleString('es-CL')}`, totBoxX + totBoxW - 4, invFinalY + 21, { align: 'right' });

    // Timbre Electrónico SII (Izquierda Inferior)
    const timbreX = invMargin;
    const timbreY = invFinalY;
    const timbreW = 95;
    const timbreH = 26;

    doc.setDrawColor(220, 38, 38);
    doc.setLineWidth(0.5);
    doc.rect(timbreX, timbreY, timbreW, timbreH, 'S');

    doc.setTextColor(220, 38, 38);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text('Timbre Electrónico S.I.I.', timbreX + timbreW / 2, timbreY + 5, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.text('Res. 80 de 2014 - Verifique documento en www.sii.cl', timbreX + timbreW / 2, timbreY + 9, { align: 'center' });

    // Simulation of 2D PDF417 barcode
    doc.setFillColor(30, 41, 59);
    doc.rect(timbreX + 6, timbreY + 11, timbreW - 12, 11, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(5.5);
    doc.text(`DTE FOLIO ${guide.invoiceFolio || 'FAC-1001'} | GUÍA ${guide.folio} | FIRMA DIGITAL OK`, timbreX + timbreW / 2, timbreY + 17, { align: 'center' });
  }

  return doc;
}

export function downloadPDF(doc: jsPDF, filename: string): void {
  doc.save(filename);
}

export function printPDF(doc: jsPDF): void {
  doc.autoPrint();
  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  iframe.src = url;
  document.body.appendChild(iframe);
  iframe.onload = () => {
    iframe.contentWindow?.print();
  };
}

export async function sharePDFDocument(
  optionsOrDoc: any,
  filename?: string,
  title?: string
): Promise<boolean> {
  let doc: jsPDF;
  let fname: string;
  let docTitle: string;
  let phone: string | undefined;
  let msgText: string | undefined;

  if (optionsOrDoc && optionsOrDoc.doc) {
    doc = optionsOrDoc.doc;
    fname = optionsOrDoc.filename || 'documento.pdf';
    docTitle = optionsOrDoc.title || 'Documento Oficial';
    phone = optionsOrDoc.recipientPhone;
    msgText = optionsOrDoc.messageText;
  } else {
    doc = optionsOrDoc;
    fname = filename || 'documento.pdf';
    docTitle = title || 'Documento Oficial';
  }

  const blob = doc.output('blob');
  const file = new File([blob], fname, { type: 'application/pdf' });

  if (phone && phone.trim()) {
    shareViaWhatsApp(phone, msgText || `Adjunto documento oficial ${docTitle}`);
    return true;
  }

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        title: docTitle,
        text: msgText || `Adjunto documento oficial ${docTitle}`,
        files: [file]
      });
      return true;
    } catch {
      return false;
    }
  }

  downloadPDF(doc, fname);
  return true;
}


// -------------------------------------------------------------
// 3. GENERATE LOSS ACT PDF (Acta de Merma)
// -------------------------------------------------------------
export function generateLossActPDF(incident: any, company?: Company): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(220, 38, 38);
  doc.text((company?.name || 'MARKET ALMACÉN SpA').toUpperCase(), margin, 18);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(70, 70, 70);
  doc.text(`RUT: ${company?.rut || '77.542.190-8'} | ACTA OFICIAL DE MERMA / DEDICIÓN DE INVENTARIO`, margin, 23);

  doc.setFillColor(254, 242, 242);
  doc.rect(margin, 30, contentWidth, 24, 'F');
  doc.setDrawColor(252, 165, 165);
  doc.rect(margin, 30, contentWidth, 24, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(153, 27, 27);
  doc.text(`ACTA N°: ${incident.folio || incident.id || 'MERMA-01'}`, margin + 4, 37);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  doc.text(`Producto: ${incident.itemName || incident.productName || 'Ítem de Inventario'}`, margin + 4, 43);
  doc.text(`Motivo / Causa: ${incident.description || incident.reason || 'Vencimiento / Deterioro'}`, margin + 4, 49);

  return doc;
}

// -------------------------------------------------------------
// 4. GENERATE EXECUTIVE REPORT PDF
// -------------------------------------------------------------
export function generateExecutiveReportPDF(reportData: any, company?: Company): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter'
  });

  const margin = 14;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(30, 41, 59);
  doc.text((company?.name || 'MARKET ALMACÉN SpA').toUpperCase(), margin, 18);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('INFORME EJECUTIVO DE GESTIÓN Y EXISTENCIAS', margin, 24);

  return doc;
}

// -------------------------------------------------------------
// 5. SHARE VIA WHATSAPP HELPER
// -------------------------------------------------------------
export function shareViaWhatsApp(phone: string, text: string, docUrl?: string): void {
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  const fullText = docUrl ? `${text}\n\nVer documento: ${docUrl}` : text;
  const encoded = encodeURIComponent(fullText);
  window.open(`https://wa.me/${cleanPhone}?text=${encoded}`, '_blank');
}
