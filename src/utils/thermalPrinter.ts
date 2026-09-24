import type { Sale, Company, SiiConfig, Customer, CreditPayment } from '../types';
import { formatCLP, formatRut, getDteLabel, getPaymentMethodLabel } from './salesPdfGenerator';

export interface ThermalPrinterConfig {
  enabled: boolean;
  printerName: string;
  paperWidth: '80mm' | '58mm';
  autoPrintOnSale: boolean;
  autoCut: boolean;
  openDrawer: boolean;
  copies: number;
}

const STORAGE_KEY = 'pos_thermal_printer_config';

export function getThermalPrinterConfig(): ThermalPrinterConfig {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.warn('Error reading thermal printer config:', e);
  }
  return {
    enabled: true,
    printerName: 'Impresora Térmica 80mm',
    paperWidth: '80mm',
    autoPrintOnSale: true,
    autoCut: true,
    openDrawer: false,
    copies: 1
  };
}

export function saveThermalPrinterConfig(config: ThermalPrinterConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.error('Error saving thermal printer config:', e);
  }
}

/**
 * Genera el HTML exacto para impresión en rollo térmico de 80mm (o 58mm)
 */
export function generateThermalReceipt80mmHTML(
  sale: Sale,
  company?: Company,
  config?: SiiConfig
): string {
  const printerConfig = getThermalPrinterConfig();
  const widthMm = printerConfig.paperWidth === '58mm' ? '54mm' : '74mm';
  const totalWidth = printerConfig.paperWidth === '58mm' ? '58mm' : '80mm';

  const emisorNombre = (config?.razonSocial || company?.name || 'MARKET ALMACÉN SpA').toUpperCase();
  const emisorRut = formatRut(config?.rutEmisor || company?.rut || '77.890.120-5');
  const emisorGiro = config?.giro || company?.industry || 'Comercio, Almacén y Minimarket';
  const emisorDir = config?.direccionOrigen || company?.address || 'Av. Principal 1234';
  const emisorComuna = (config as any)?.comuna || (company as any)?.city || 'Santiago';

  const dteLabel = getDteLabel(sale.dteType);
  const payLabel = getPaymentMethodLabel(sale.paymentMethod);

  const subtotalNeto = sale.subtotalNeto || Math.round(sale.total / 1.19);
  const iva = sale.iva || (sale.total - subtotalNeto);

  const itemsHtml = sale.items
    .map(
      (item) => `
      <tr style="border-bottom: 1px dotted #ccc;">
        <td style="padding: 3px 0; font-weight: bold;">${item.productName || (item as any).name || 'Producto'}</td>
        <td style="text-align: center; padding: 3px 0;">${item.quantity}</td>
        <td style="text-align: right; padding: 3px 0; font-family: monospace; font-weight: bold;">${formatCLP(item.subtotal)}</td>
      </tr>
    `
    )
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Ticket ${sale.folio || 'Venta'}</title>
  <style>
    @page {
      size: ${totalWidth} auto;
      margin: 0;
    }
    @media print {
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        width: ${totalWidth} !important;
      }
      body {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, monospace;
      width: ${widthMm};
      margin: 0 auto;
      padding: 3mm 1.5mm 10mm 1.5mm;
      color: #000000;
      background: #ffffff;
      font-size: 11px;
      line-height: 1.25;
    }
    .center { text-align: center; }
    .right { text-align: right; }
    .bold { font-weight: bold; }
    .title { font-size: 14px; font-weight: 900; margin-bottom: 2px; }
    .line { border-top: 1px dashed #000; margin: 6px 0; }
    .double-line { border-top: 2px solid #000; margin: 6px 0; }
    .dte-box {
      border: 2px solid #000;
      padding: 4px 6px;
      margin: 6px 0;
      text-align: center;
      font-weight: bold;
    }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th { border-bottom: 1px solid #000; padding: 2px 0; font-size: 10px; font-weight: 900; }
    td { padding: 2.5px 0; }
    .totals-table td { padding: 1.5px 0; }
    .barcode-sim {
      font-family: 'Libre Barcode 128', 'Courier New', monospace;
      letter-spacing: 2px;
      font-size: 20px;
      font-weight: bold;
      text-align: center;
      margin: 8px 0 3px 0;
    }
  </style>
</head>
<body>
  <!-- Encabezado de la Empresa -->
  <div class="center" style="margin-bottom: 6px;">
    <div class="title">${emisorNombre}</div>
    <div class="bold" style="font-size: 11px;">RUT: ${emisorRut}</div>
    <div style="font-size: 10px;">${emisorGiro}</div>
    <div style="font-size: 10px;">${emisorDir}, ${emisorComuna}</div>
  </div>

  <div class="line"></div>

  <!-- Recuadro DTE Oficial SII -->
  <div class="dte-box">
    <div style="font-size: 11px;">R.U.T.: ${emisorRut}</div>
    <div style="font-size: 12px; margin: 1px 0;">${dteLabel}</div>
    <div style="font-size: 14px; font-weight: 900;">Nº ${sale.folio || 'S/F'}</div>
    <div style="font-size: 9px; margin-top: 1px;">S.I.I. - SANTIAGO CENTRO</div>
  </div>

  <div style="font-size: 10px; margin: 4px 0;">
    <div><strong>Fecha y Hora:</strong> ${sale.date} ${sale.time || ''}</div>
    <div><strong>Cajero/a:</strong> ${sale.sellerName || 'Caja Principal'}</div>
    <div><strong>Cliente:</strong> ${sale.customerName || 'Venta General'}</div>
    ${sale.customerRut ? `<div><strong>RUT Cliente:</strong> ${formatRut(sale.customerRut)}</div>` : ''}
    <div><strong>Medio de Pago:</strong> ${payLabel}</div>
  </div>

  <div class="double-line"></div>

  <!-- Detalle de Productos -->
  <table>
    <thead>
      <tr>
        <th style="text-align: left;">DESCRIPCIÓN</th>
        <th style="text-align: center; width: 35px;">CANT</th>
        <th style="text-align: right; width: 60px;">TOTAL</th>
      </tr>
    </thead>
    <tbody>
      ${itemsHtml}
    </tbody>
  </table>

  <div class="line"></div>

  <!-- Totales -->
  <table class="totals-table">
    <tbody>
      <tr>
        <td>Subtotal Neto:</td>
        <td class="right font-mono">${formatCLP(subtotalNeto)}</td>
      </tr>
      <tr>
        <td>19% I.V.A.:</td>
        <td class="right font-mono">${formatCLP(iva)}</td>
      </tr>
      ${
        sale.discountTotal && sale.discountTotal > 0
          ? `<tr>
        <td style="color: #000;">Descuento:</td>
        <td class="right font-mono">-${formatCLP(sale.discountTotal)}</td>
      </tr>`
          : ''
      }
      ${
        sale.paymentMethod === 'EFECTIVO' && sale.roundingDifference
          ? `<tr>
        <td>Redondeo Ley 20.956:</td>
        <td class="right font-mono">${sale.roundingDifference > 0 ? `+${sale.roundingDifference}` : sale.roundingDifference}</td>
      </tr>`
          : ''
      }
      <tr style="border-top: 1.5px solid #000; font-size: 14px;">
        <td class="bold" style="padding-top: 4px;">TOTAL A PAGAR:</td>
        <td class="right bold" style="padding-top: 4px; font-family: monospace; font-size: 15px;">
          ${formatCLP(sale.total)}
        </td>
      </tr>
      ${
        sale.paymentMethod === 'EFECTIVO' && sale.amountPaid !== undefined
          ? `
      <tr>
        <td style="font-size: 10px; padding-top: 3px;">Monto Recibido:</td>
        <td class="right font-mono" style="font-size: 10px; padding-top: 3px;">${formatCLP(sale.amountPaid)}</td>
      </tr>
      <tr>
        <td class="bold" style="font-size: 11px;">VUELTO:</td>
        <td class="right bold font-mono" style="font-size: 11px;">${formatCLP(sale.cashChange || 0)}</td>
      </tr>
      `
          : ''
      }
    </tbody>
  </table>

  <div class="line"></div>

  <!-- Timbre y Pie -->
  <div class="center" style="margin-top: 6px;">
    <div class="barcode-sim">||||||||||||||||||||||||||||||||||||||||</div>
    <div style="font-size: 8.5px; font-weight: bold;">
      ${sale.siiResolution || 'Res. Ex. SII Nº 80 de 2014'}
    </div>
    <div style="font-size: 8px; margin-top: 2px;">
      Verifique documento en www.sii.cl
    </div>
    <div style="font-size: 10px; font-weight: bold; margin-top: 8px;">
      ¡GRACIAS POR SU COMPRA!
    </div>
    <div style="font-size: 8.5px; color: #555; margin-top: 2px;">
      Sistema Market Almacén POS
    </div>
  </div>
</body>
</html>`;
}

/**
 * Imprime el ticket de venta directamente a la impresora térmica de 80mm
 * utilizando un iframe oculto en segundo plano SIN ABRIR NINGUNA VENTANA NI PESTAÑA.
 */
export function printThermalReceipt80mm(
  sale: Sale,
  company?: Company,
  config?: SiiConfig
): void {
  try {
    const html = generateThermalReceipt80mmHTML(sale, company, config);

    // Buscar o crear el iframe silencioso en el DOM
    let iframe = document.getElementById('silent-thermal-print-frame') as HTMLIFrameElement;
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'silent-thermal-print-frame';
      iframe.style.position = 'fixed';
      iframe.style.top = '-9999px';
      iframe.style.left = '-9999px';
      iframe.style.width = '1px';
      iframe.style.height = '1px';
      iframe.style.border = '0';
      iframe.style.opacity = '0.01';
      document.body.appendChild(iframe);
    }

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!doc) {
      console.error('No se pudo acceder al documento del iframe de impresión');
      return;
    }

    doc.open();
    doc.write(html);
    doc.close();

    // Disparar la impresión nativa sin abrir ventanas
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        console.warn('Error al disparar impresión en iframe térmico:', err);
      }
    }, 150);
  } catch (error) {
    console.error('Error en printThermalReceipt80mm:', error);
  }
}

/**
 * Imprime un ticket de prueba en 80mm para verificar la conexión con la impresora
 */
export function printTestThermalTicket80mm(company?: Company, config?: SiiConfig): void {
  const dummySale: Sale = {
    folio: 'TEST-000001',
    companyId: 'market-almacen',
    siiStatus: 'EMITIDO',
    createdAt: new Date().toISOString(),
    date: new Date().toISOString().split('T')[0],
    time: new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }),
    customerName: 'Cliente de Prueba',
    items: [
      {
        productId: 99991,
        productCode: 'PAN-001',
        productName: 'Pan Corriente Granel',
        quantity: 1,
        unitPrice: 1890,
        subtotal: 1890
      },
      {
        productId: 99992,
        productCode: 'BEB-001',
        productName: 'Bebida Coca-Cola 1.5L',
        quantity: 1,
        unitPrice: 1500,
        subtotal: 1500
      }
    ],
    subtotalNeto: 2849,
    iva: 541,
    total: 3390,
    paymentMethod: 'EFECTIVO',
    amountPaid: 5000,
    cashChange: 1610,
    dteType: 'BOLETA_ELECTRONICA',
    dteFolio: '1',
    sellerName: 'Cajero Principal',
    status: 'COMPLETADA'
  };

  printThermalReceipt80mm(dummySale, company, config);
}


/**
 * Imprime un ticket térmico de 80mm de Abono / Pago de Cuenta Fiado
 */
export function printCreditPaymentTicket80mm(
  payment: CreditPayment,
  customer: Customer,
  company?: Company
): void {
  const config = getThermalPrinterConfig();
  const widthMm = config.paperWidth === '58mm' ? 58 : 80;
  const is58 = widthMm === 58;

  const companyName = company?.name || 'ALMACÉN & MARKET';
  const companyRut = company?.rut || '';
  const companyAddress = company?.address || '';
  const companyPhone = company?.phone || '';

  const isFullyPaid = payment.remainingDebt <= 0;
  const dateFormatted = new Date(payment.date).toLocaleString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Comprobante de Abono - ${payment.receiptFolio || 'REC-001'}</title>
  <style>
    @page {
      size: ${widthMm}mm auto;
      margin: 0;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: 'Courier New', Courier, monospace, -apple-system, sans-serif;
      width: ${widthMm}mm;
      max-width: ${widthMm}mm;
      padding: 4mm 3mm;
      font-size: ${is58 ? '10px' : '11.5px'};
      line-height: 1.25;
      color: #000;
      background: #fff;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .bold { font-weight: bold; }
    .title { font-size: ${is58 ? '13px' : '15px'}; font-weight: 900; margin-bottom: 2px; }
    .subtitle { font-size: ${is58 ? '10px' : '11px'}; font-weight: bold; }
    .divider { border-top: 1px dashed #000; margin: 4px 0; }
    .double-divider { border-top: 2px solid #000; margin: 5px 0; }
    .row { display: flex; justify-content: space-between; margin: 2px 0; }
    .box {
      border: 1.5px solid #000;
      padding: 4px;
      margin: 5px 0;
      text-align: center;
      font-weight: 900;
    }
    .status-badge {
      display: block;
      padding: 3px 0;
      font-size: ${is58 ? '11px' : '13px'};
      font-weight: 900;
      text-align: center;
      border: 2px solid #000;
      margin: 6px 0;
    }
  </style>
</head>
<body>
  <!-- Encabezado del Local -->
  <div class="text-center">
    <div class="title">${companyName.toUpperCase()}</div>
    ${companyRut ? `<div class="subtitle">RUT: ${formatRut(companyRut)}</div>` : ''}
    ${companyAddress ? `<div>${companyAddress}</div>` : ''}
    ${companyPhone ? `<div>TEL: ${companyPhone}</div>` : ''}
  </div>

  <div class="double-divider"></div>

  <!-- Título del documento -->
  <div class="text-center">
    <div class="subtitle bold">COMPROBANTE DE PAGO DE CUENTA</div>
    <div class="bold" style="font-size: 13px;">(LIBRETA DE FIADOS)</div>
    <div style="font-size: 10px; margin-top: 2px;">FOLIO: ${payment.receiptFolio || 'REC-' + (payment.id || 1)}</div>
    <div style="font-size: 10px;">FECHA: ${dateFormatted}</div>
  </div>

  <div class="divider"></div>

  <!-- Datos del Cliente -->
  <div>
    <div class="row">
      <span class="bold">CLIENTE:</span>
      <span class="bold">${payment.customerName.toUpperCase()}</span>
    </div>
    ${payment.customerRut ? `
    <div class="row">
      <span>RUT:</span>
      <span>${formatRut(payment.customerRut)}</span>
    </div>` : ''}
    ${customer.phone ? `
    <div class="row">
      <span>TEL:</span>
      <span>${customer.phone}</span>
    </div>` : ''}
  </div>

  <div class="divider"></div>

  <!-- Detalle del Movimiento Financiero -->
  <div style="margin: 6px 0;">
    <div class="row">
      <span>Saldo Deuda Anterior:</span>
      <span class="bold">${formatCLP(payment.previousDebt)}</span>
    </div>
    
    <div class="row" style="font-size: ${is58 ? '11px' : '13px'}; margin: 4px 0;">
      <span class="bold">MONTO ABONADO/PAGADO:</span>
      <span class="bold">${formatCLP(payment.amount)}</span>
    </div>

    <div class="row">
      <span>Forma de Pago:</span>
      <span class="bold">${payment.paymentMethod}</span>
    </div>

    ${payment.notes ? `
    <div class="row" style="font-size: 10px;">
      <span>Observación:</span>
      <span>${payment.notes}</span>
    </div>` : ''}
  </div>

  <div class="double-divider"></div>

  <!-- Saldo Restante y Estado -->
  <div class="row" style="font-size: ${is58 ? '12px' : '14px'}; font-weight: 900;">
    <span>NUEVO SALDO PENDIENTE:</span>
    <span>${formatCLP(payment.remainingDebt)}</span>
  </div>

  <div class="status-badge">
    ${isFullyPaid ? '*** CUENTA AL DÍA (SALDO $0) ***' : '*** SALDO PENDIENTE POR COBRAR ***'}
  </div>

  ${customer.paymentDueDay ? `
  <div class="text-center" style="font-size: 10px; margin-top: 3px;">
    Fecha habitual de pago: Días ${customer.paymentDueDay} de cada mes
  </div>` : ''}

  <div class="divider"></div>

  <!-- Pie de Ticket -->
  <div class="text-center" style="margin-top: 6px;">
    ${payment.registeredBy ? `<div style="font-size: 10px;">Atendido por: ${payment.registeredBy}</div>` : ''}
    <div class="bold" style="margin-top: 4px;">¡Muchas Gracias por su Pago!</div>
    <div style="font-size: 9px; margin-top: 2px;">Conserve este comprobante para su respaldo</div>
  </div>

  <script>
    window.onload = function() {
      window.print();
      setTimeout(function() {
        window.close();
      }, 800);
    };
  </script>
</body>
</html>
`;

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (doc) {
    doc.open();
    doc.write(html);
    doc.close();

    setTimeout(() => {
      try {
        document.body.removeChild(iframe);
      } catch {}
    }, 4000);
  }
}
