import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  WidthType,
  ShadingType
} from 'docx';
import { downloadOrShareBlob } from './fileDownloader';
import type { LogbookEntry, ProductMovement, ToolLoan, Incident, PurchaseRequest } from '../types';

interface WordReportParams {
  startDate: string;
  endDate: string;
  companyName: string;
  companyRut?: string;
  logbooks: LogbookEntry[];
  movements: ProductMovement[];
  loans: ToolLoan[];
  pendingLoans: ToolLoan[];
  incidents: Incident[];
  purchaseRequests: PurchaseRequest[];
}

export async function generateWordReport(params: WordReportParams) {
  const {
    startDate,
    endDate,
    companyName,
    companyRut,
    logbooks,
    movements,
    loans,
    pendingLoans,
    incidents,
    purchaseRequests
  } = params;

  const startFormatted = new Date(startDate + 'T00:00:00').toLocaleDateString('es-CL');
  const endFormatted = new Date(endDate + 'T23:59:59').toLocaleDateString('es-CL');
  const todayFormatted = new Date().toLocaleDateString('es-CL');

  // Stats calculation
  const totalEntries = movements.filter(m => m.type === 'ENTRADA').reduce((acc, curr) => acc + curr.quantity, 0);
  const totalExits = movements.filter(m => m.type === 'SALIDA').reduce((acc, curr) => acc + curr.quantity, 0);
  const loansInPeriod = loans.length;
  const returnedInPeriod = loans.filter(l => l.status === 'DEVUELTO').length;
  const damagedInPeriod = incidents.filter(i => i.type === 'DANO').length;
  const lostInPeriod = incidents.filter(i => i.type === 'PERDIDA').length;

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440, // 1 inch
              bottom: 1440,
              left: 1440,
              right: 1440
            }
          }
        },
        children: [
          // Institutional Header
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: 'MARKET ALMACÉN SpA',
                bold: true,
                size: 30,
                color: 'EA580C' // Orange
              })
            ]
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: `RUT: ${companyRut || '77.542.190-8'} | GESTIÓN INTEGRAL DE BODEGA Y HERRAMIENTAS`,
                size: 18,
                color: '64748B'
              })
            ]
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 300 },
            children: [
              new TextRun({
                text: `INFORME EJECUTIVO DE GESTIÓN Y NOVEDADES`,
                bold: true,
                size: 24,
                color: '0F172A'
              })
            ]
          }),

          // Metadata Table
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    shading: { fill: 'F1F5F9', type: ShadingType.CLEAR },
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({ text: 'EMPRESA / RAZÓN SOCIAL: ', bold: true }),
                          new TextRun(companyName)
                        ]
                      }),
                      new Paragraph({
                        children: [
                          new TextRun({ text: 'PERÍODO EVALUADO: ', bold: true }),
                          new TextRun(`Desde el ${startFormatted} hasta el ${endFormatted}`)
                        ]
                      })
                    ]
                  }),
                  new TableCell({
                    shading: { fill: 'F1F5F9', type: ShadingType.CLEAR },
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({ text: 'FECHA DE EMISIÓN: ', bold: true }),
                          new TextRun(todayFormatted)
                        ]
                      }),
                      new Paragraph({
                        children: [
                          new TextRun({ text: 'ESTADO DE BODEGA: ', bold: true }),
                          new TextRun('OPERATIVA Y REGISTRADA')
                        ]
                      })
                    ]
                  })
                ]
              })
            ]
          }),

          new Paragraph({ spacing: { before: 300 } }),

          // Section 1: Bitácora Diaria y Novedades
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [
              new TextRun({
                text: '1. BITÁCORA DETALLADA DE TRABAJOS Y ACONTECIMIENTOS POR DÍA',
                bold: true,
                color: 'EA580C'
              })
            ]
          }),

          ...(logbooks.length > 0
            ? logbooks.flatMap((lb) => {
                const dayHeader = new Paragraph({
                  spacing: { before: 200, after: 80 },
                  children: [
                    new TextRun({
                      text: `📅 Fecha: ${lb.dayName || lb.date} (${lb.weekLabel || 'Semana'}):`,
                      bold: true,
                      size: 22,
                      color: '0F172A'
                    })
                  ]
                });

                if (lb.dayEvents && lb.dayEvents.length > 0) {
                  const eventParagraphs = lb.dayEvents.map(evt => {
                    const typeLabel =
                      evt.type === 'TRABAJO'
                        ? '[TRABAJO REALIZADO]'
                        : evt.type === 'ACONTECIMIENTO'
                        ? '[ACONTECIMIENTO RELEVANTE]'
                        : evt.type === 'SOLICITUD'
                        ? '[SOLICITUD PERSONAL]'
                        : '[NOVEDAD / OBS.]';

                    return new Paragraph({
                      spacing: { after: 100 },
                      children: [
                        new TextRun({ text: `  • ${evt.time ? `[${evt.time}] ` : ''}${typeLabel} `, bold: true, color: 'EA580C' }),
                        new TextRun({ text: `${evt.title}: `, bold: true }),
                        new TextRun(evt.description || 'Completado conforme.'),
                        ...(evt.responsible ? [new TextRun({ text: ` (Responsable: ${evt.responsible})`, italics: true, color: '64748B' })] : [])
                      ]
                    });
                  });

                  return [dayHeader, ...eventParagraphs];
                }

                // Fallback for legacy summary text
                return [
                  dayHeader,
                  new Paragraph({
                    children: [
                      new TextRun({ text: '  • Acontecimientos Relevantes: ', bold: true }),
                      new TextRun(lb.events || 'Sin novedades registradas.')
                    ]
                  }),
                  new Paragraph({
                    children: [
                      new TextRun({ text: '  • Trabajos Realizados: ', bold: true }),
                      new TextRun(lb.workCompleted || 'Labores ordinarias de bodega.')
                    ]
                  }),
                  new Paragraph({
                    children: [
                      new TextRun({ text: '  • Solicitudes: ', bold: true }),
                      new TextRun(lb.staffRequests || 'Sin requerimientos especiales.')
                    ]
                  }),
                  new Paragraph({
                    spacing: { after: 150 },
                    children: [
                      new TextRun({ text: '  • Observaciones: ', bold: true }),
                      new TextRun(lb.importantNotes || 'Ninguno.')
                    ]
                  })
                ];
              })
            : [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: 'No se ingresaron registros específicos en la bitácora para el rango de fechas seleccionado.',
                      italics: true
                    })
                  ]
                })
              ]),

          // Section 2: Resumen Cuantitativo
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 300 },
            children: [
              new TextRun({
                text: '2. RESUMEN ESTADÍSTICO DE OPERACIONES (PERÍODO)',
                bold: true,
                color: 'EA580C'
              })
            ]
          }),

          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    shading: { fill: 'EA580C', type: ShadingType.CLEAR },
                    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'MÉTRICA DE CONTROL', bold: true, color: 'FFFFFF' })] })]
                  }),
                  new TableCell({
                    shading: { fill: 'EA580C', type: ShadingType.CLEAR },
                    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'CANTIDAD REGISTRADA', bold: true, color: 'FFFFFF' })] })]
                  }),
                  new TableCell({
                    shading: { fill: 'EA580C', type: ShadingType.CLEAR },
                    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'OBSERVACIÓN', bold: true, color: 'FFFFFF' })] })]
                  })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph('Entradas de Productos / Insumos')] }),
                  new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, text: `${totalEntries} unidades` })] }),
                  new TableCell({ children: [new Paragraph('Ingresos por compras o reposiciones')] })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph('Salidas de Productos / Despachos')] }),
                  new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, text: `${totalExits} unidades` })] }),
                  new TableCell({ children: [new Paragraph('Consumo en faena y entregas')] })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph('Total Préstamos de Herramientas')] }),
                  new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, text: `${loansInPeriod} préstamos` })] }),
                  new TableCell({ children: [new Paragraph('Entregas realizadas a mecánicos')] })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph('Devoluciones Conformes')] }),
                  new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, text: `${returnedInPeriod} devueltas` })] }),
                  new TableCell({ children: [new Paragraph('Herramientas reintegradas a bodega')] })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph('Herramientas Pendientes de Entrega')] }),
                  new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, text: `${pendingLoans.length} activas` })] }),
                  new TableCell({ children: [new Paragraph('Actualmente en poder del personal')] })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph('Incidentes de Daños y Pérdidas')] }),
                  new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, text: `${damagedInPeriod} daños / ${lostInPeriod} pérdidas` })] }),
                  new TableCell({ children: [new Paragraph('Con actas de responsabilidad emitidas')] })
                ]
              })
            ]
          }),

          // Section 3: Herramientas Pendientes
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 300 },
            children: [
              new TextRun({
                text: '3. DETALLE DE HERRAMIENTAS PENDIENTES DE DEVOLUCIÓN',
                bold: true,
                color: 'EA580C'
              })
            ]
          }),

          pendingLoans.length > 0
            ? new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: [
                  new TableRow({
                    children: [
                      new TableCell({ shading: { fill: '0F172A', type: ShadingType.CLEAR }, children: [new Paragraph({ children: [new TextRun({ text: 'CÓDIGO', bold: true, color: 'FFFFFF' })] })] }),
                      new TableCell({ shading: { fill: '0F172A', type: ShadingType.CLEAR }, children: [new Paragraph({ children: [new TextRun({ text: 'HERRAMIENTA', bold: true, color: 'FFFFFF' })] })] }),
                      new TableCell({ shading: { fill: '0F172A', type: ShadingType.CLEAR }, children: [new Paragraph({ children: [new TextRun({ text: 'TRABAJADOR RESPONSABLE', bold: true, color: 'FFFFFF' })] })] }),
                      new TableCell({ shading: { fill: '0F172A', type: ShadingType.CLEAR }, children: [new Paragraph({ children: [new TextRun({ text: 'FECHA ENTREGA', bold: true, color: 'FFFFFF' })] })] })
                    ]
                  }),
                  ...pendingLoans.map(p => new TableRow({
                    children: [
                      new TableCell({ children: [new Paragraph(p.toolCode)] }),
                      new TableCell({ children: [new Paragraph(p.toolName)] }),
                      new TableCell({ children: [new Paragraph(`${p.workerName} (${p.workerRut})`)] }),
                      new TableCell({ children: [new Paragraph(new Date(p.deliveryDate).toLocaleDateString('es-CL'))] })
                    ]
                  }))
                ]
              })
            : new Paragraph({
                children: [
                  new TextRun({ text: 'No hay herramientas pendientes de devolución.', italics: true })
                ]
              }),

          // Section 4: Solicitudes de Compra Prioritarias
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 300 },
            children: [
              new TextRun({
                text: '4. SOLICITUDES DE COMPRA E INSUMOS PROPUESTOS',
                bold: true,
                color: 'EA580C'
              })
            ]
          }),

          purchaseRequests.length > 0
            ? new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: [
                  new TableRow({
                    children: [
                      new TableCell({ shading: { fill: '0F172A', type: ShadingType.CLEAR }, children: [new Paragraph({ children: [new TextRun({ text: 'FECHA', bold: true, color: 'FFFFFF' })] })] }),
                      new TableCell({ shading: { fill: '0F172A', type: ShadingType.CLEAR }, children: [new Paragraph({ children: [new TextRun({ text: 'ÍTEM / INSUMO', bold: true, color: 'FFFFFF' })] })] }),
                      new TableCell({ shading: { fill: '0F172A', type: ShadingType.CLEAR }, children: [new Paragraph({ children: [new TextRun({ text: 'CANT.', bold: true, color: 'FFFFFF' })] })] }),
                      new TableCell({ shading: { fill: '0F172A', type: ShadingType.CLEAR }, children: [new Paragraph({ children: [new TextRun({ text: 'PRIORIDAD', bold: true, color: 'FFFFFF' })] })] }),
                      new TableCell({ shading: { fill: '0F172A', type: ShadingType.CLEAR }, children: [new Paragraph({ children: [new TextRun({ text: 'JUSTIFICACIÓN', bold: true, color: 'FFFFFF' })] })] })
                    ]
                  }),
                  ...purchaseRequests.map(r => new TableRow({
                    children: [
                      new TableCell({ children: [new Paragraph(new Date(r.date).toLocaleDateString('es-CL'))] }),
                      new TableCell({ children: [new Paragraph(r.itemName)] }),
                      new TableCell({ children: [new Paragraph(String(r.quantity))] }),
                      new TableCell({ children: [new Paragraph(r.priority)] }),
                      new TableCell({ children: [new Paragraph(r.justification)] })
                    ]
                  }))
                ]
              })
            : new Paragraph({
                children: [
                  new TextRun({ text: 'No se registran solicitudes de compra en el período.', italics: true })
                ]
              }),

          // Signatures Section
          new Paragraph({ spacing: { before: 600 } }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.NONE },
              left: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
              insideHorizontal: { style: BorderStyle.NONE },
              insideVertical: { style: BorderStyle.NONE }
            },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    children: [
                      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun('___________________________________')] }),
                      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'ENCARGADO DE BODEGA', bold: true })] }),
                      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun('Control y Despacho')] })
                    ]
                  }),
                  new TableCell({
                    children: [
                      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun('___________________________________')] }),
                      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'SUPERVISIÓN / JEFATURA', bold: true })] }),
                      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun('Operaciones y Mantenimiento')] })
                    ]
                  })
                ]
              })
            ]
          })
        ]
      }
    ]
  });

  const blob = await Packer.toBlob(doc);
  const periodStr = `${startDate}_al_${endDate}`;
  await downloadOrShareBlob(blob, `Informe_Gestion_Bodega_${companyName.replace(/[^a-zA-Z0-9]/g, '_')}_${periodStr}.docx`, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
}
