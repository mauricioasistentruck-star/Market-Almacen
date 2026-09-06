import { db, cleanupOrphanedRecords, migrateFromLegacyDatabaseIfNeeded } from './database';
import type { Company, Product, Sale, ReceptionGuide, DeliveryGuide, PurchaseRequest, Incident, ProductMovement } from '../types';

export const INITIAL_COMPANIES: Company[] = [
  {
    id: 'market-almacen',
    rut: '77.890.120-5',
    name: 'MARKET ALMACÉN SpA',
    tradeName: 'Market Almacén',
    industry: 'Comercio, Almacén y Distribución General',
    phone: '+56 9 8452 1190',
    address: 'Av. Principal 1000, Bodega Central',
    isNaturalPerson: false,
    rubroKey: 'almacen',
    createdAt: new Date().toISOString()
  }
];

// Fechas dinámicas para productos vencidos y por vencer
const getRelativeDateStr = (daysOffset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  return d.toISOString().split('T')[0];
};

export const INITIAL_DEMO_PRODUCTS: Omit<Product, 'id'>[] = [
  {
    companyId: 'market-almacen',
    code: '7801610001234',
    name: 'Bebida Coca-Cola Original 1.5 L',
    category: 'Bebidas y Licores',
    brand: 'Coca-Cola',
    stock: 48,
    minStock: 12,
    unit: 'Unidades',
    condition: 'NUEVO',
    completeness: 'COMPLETO',
    location: 'Pasillo 1 - Estante A',
    costPrice: 1250,
    price: 1990,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    companyId: 'market-almacen',
    code: 'PAN-HALLULLA-01',
    name: 'Pan Hallulla Especial Tradicional',
    category: 'Panadería y Pastelería',
    brand: 'Panadería Central',
    stock: 35,
    minStock: 10,
    unit: 'Kg',
    condition: 'NUEVO',
    completeness: 'COMPLETO',
    location: 'Mesón Panadería',
    costPrice: 1100,
    price: 1890,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    companyId: 'market-almacen',
    code: '7802900001456',
    name: 'Leche Entera Natural Colun 1 Litro',
    category: 'Lácteos y Fiambrería',
    brand: 'Colun',
    stock: 60,
    minStock: 15,
    unit: 'Unidades',
    condition: 'NUEVO',
    completeness: 'COMPLETO',
    location: 'Cámara Lácteos - Estante 2',
    costPrice: 780,
    price: 1190,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    companyId: 'market-almacen',
    code: 'QUESO-GAUDA-KG',
    name: 'Queso Gauda Laminado Calo',
    category: 'Lácteos y Fiambrería',
    brand: 'Calo',
    stock: 18,
    minStock: 5,
    unit: 'Kg',
    condition: 'NUEVO',
    completeness: 'COMPLETO',
    location: 'Vitrina Fiambrería',
    costPrice: 5800,
    price: 8490,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    companyId: 'market-almacen',
    code: '7801890003412',
    name: 'Aceite Vegetal Chef 900 ml',
    category: 'Abarrotes',
    brand: 'Chef',
    stock: 40,
    minStock: 10,
    unit: 'Unidades',
    condition: 'NUEVO',
    completeness: 'COMPLETO',
    location: 'Pasillo 2 - Estante B',
    costPrice: 1350,
    price: 1990,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    companyId: 'market-almacen',
    code: '7801234005678',
    name: 'Arroz Grado 1 Tucapel 1 Kg',
    category: 'Abarrotes',
    brand: 'Tucapel',
    stock: 55,
    minStock: 15,
    unit: 'Unidades',
    condition: 'NUEVO',
    completeness: 'COMPLETO',
    location: 'Pasillo 2 - Estante A',
    costPrice: 1150,
    price: 1690,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    companyId: 'market-almacen',
    code: 'JAMON-PRAGA-KG',
    name: 'Jamón Colonial Praga Artesanal',
    category: 'Lácteos y Fiambrería',
    brand: 'Llanquihue',
    stock: 14,
    minStock: 4,
    unit: 'Kg',
    condition: 'NUEVO',
    completeness: 'COMPLETO',
    location: 'Vitrina Fiambrería',
    costPrice: 6900,
    price: 9990,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    companyId: 'market-almacen',
    code: 'VERD-TOMATE-KG',
    name: 'Tomates Larga Vida Granel Selección',
    category: 'Verduras',
    brand: 'Agrícola San Pedro',
    stock: 42,
    minStock: 10,
    unit: 'Kg',
    condition: 'NUEVO',
    completeness: 'COMPLETO',
    location: 'Isla Frutas y Verduras',
    costPrice: 850,
    price: 1490,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    companyId: 'market-almacen',
    code: '7805678001234',
    name: 'Detergente Líquido Omo Matic 1 Litro',
    category: 'Limpieza y Aseo',
    brand: 'Omo',
    stock: 32,
    minStock: 8,
    unit: 'Unidades',
    condition: 'NUEVO',
    completeness: 'COMPLETO',
    location: 'Pasillo 4 - Estante C',
    costPrice: 2800,
    price: 3990,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  // --- PRODUCTOS VENCIDOS DE EJEMPLO (ALERTA ROJA) ---
  {
    companyId: 'market-almacen',
    code: '7802900008812',
    name: 'Yogurt Batido Colun Frutilla 120g',
    category: 'Lácteos y Fiambrería',
    brand: 'Colun',
    stock: 8,
    minStock: 10,
    unit: 'Unidades',
    condition: 'BUENO',
    completeness: 'COMPLETO',
    location: 'Cámara Lácteos - Bandeja 1',
    costPrice: 260,
    price: 450,
    expiryDate: getRelativeDateStr(-3), // Venció hace 3 días
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    companyId: 'market-almacen',
    code: 'PAN-MOLDE-INT',
    name: 'Pan de Molde Artesanal Integral 500g',
    category: 'Panadería y Pastelería',
    brand: 'Panadería Central',
    stock: 5,
    minStock: 6,
    unit: 'Unidades',
    condition: 'BUENO',
    completeness: 'COMPLETO',
    location: 'Mesón Panadería',
    costPrice: 1200,
    price: 2190,
    expiryDate: getRelativeDateStr(-1), // Venció ayer
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  // --- PRODUCTOS POR VENCER DE EJEMPLO (ALERTA AMARILLA) ---
  {
    companyId: 'market-almacen',
    code: '7802900009945',
    name: 'Quesillo Fresco Artesanal Colun 320g',
    category: 'Lácteos y Fiambrería',
    brand: 'Colun',
    stock: 12,
    minStock: 6,
    unit: 'Unidades',
    condition: 'NUEVO',
    completeness: 'COMPLETO',
    location: 'Cámara Frío Lácteos',
    costPrice: 1450,
    price: 2490,
    expiryDate: getRelativeDateStr(4), // Vence en 4 días
    offerPrice: 1890,
    offerStockLimit: 12,
    offerStockRemaining: 12,
    offerLabel: 'Liquidación Próximo a Vencer',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    companyId: 'market-almacen',
    code: '7801620005541',
    name: 'Crema de Leche Nestlé 200 ml',
    category: 'Lácteos y Fiambrería',
    brand: 'Nestlé',
    stock: 16,
    minStock: 8,
    unit: 'Unidades',
    condition: 'NUEVO',
    completeness: 'COMPLETO',
    location: 'Pasillo 3 - Estante A',
    costPrice: 790,
    price: 1290,
    expiryDate: getRelativeDateStr(12), // Vence en 12 días
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    companyId: 'market-almacen',
    code: '7803500002123',
    name: 'Vienesas Tradicionales San Jorge Pack 5',
    category: 'Lácteos y Fiambrería',
    brand: 'San Jorge',
    stock: 10,
    minStock: 5,
    unit: 'Unidades',
    condition: 'NUEVO',
    completeness: 'COMPLETO',
    location: 'Vitrina Cecinas',
    costPrice: 950,
    price: 1650,
    expiryDate: getRelativeDateStr(18), // Vence en 18 días
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

export async function initDatabaseIfEmpty() {
  await migrateFromLegacyDatabaseIfNeeded();

  if (typeof localStorage !== 'undefined') {
    const oldUser = localStorage.getItem('asistentruck_logged_user');
    if (oldUser && !localStorage.getItem('marketalmacen_logged_user')) {
      localStorage.setItem('marketalmacen_logged_user', oldUser);
    }
    const oldComp = localStorage.getItem('asistentruck_selected_company');
    if (oldComp && !localStorage.getItem('marketalmacen_selected_company')) {
      localStorage.setItem('marketalmacen_selected_company', oldComp === 'asistentruck' || oldComp === 'botam' ? 'market-almacen' : oldComp);
    }
    const oldTheme = localStorage.getItem('asistentruck_theme');
    if (oldTheme && !localStorage.getItem('marketalmacen_theme')) {
      localStorage.setItem('marketalmacen_theme', oldTheme);
    }
  }

  const countCompanies = await db.companies.count();
  if (countCompanies === 0) {
    await db.companies.put(INITIAL_COMPANIES[0]);
  }

  // 1. Productos
    // Limpiar categorías obsoletas de talleres (Filtros y Repuestos)
  const legacyCatProds = await db.products
    .filter(p => p.category === 'Filtros y Repuestos' || p.category === 'Filtros' || p.category === 'Repuestos')
    .toArray();
  for (const prod of legacyCatProds) {
    await db.products.update(prod.id!, { category: 'Abarrotes' });
  }

  const countProducts = await db.products.count();
  if (countProducts === 0) {
    await db.products.bulkAdd(INITIAL_DEMO_PRODUCTS as any);
  }

  // 2. Ventas de prueba
  const countSales = await db.sales.count();
  if (countSales === 0) {
    const demoSales: Sale[] = [
      {
        id: 1001,
        companyId: 'market-almacen',
        folio: '1001',
        date: new Date().toISOString().split('T')[0],
        dteType: 'BOLETA_ELECTRONICA',
        sellerName: 'Mauricio Chamorro',
        customerName: 'Cliente General',
        paymentMethod: 'EFECTIVO',
        items: [
          {
            productId: 1,
            productCode: '7801610001234',
            productName: 'Bebida Coca-Cola Original 1.5 L',
            quantity: 2,
            unitPrice: 1990,
            subtotal: 3980
          }
        ],
        subtotalNeto: 3345,
        iva: 635,
        total: 3980,
        siiStatus: 'ACEPTADO_SII',
        status: 'COMPLETADA',
        createdAt: new Date(Date.now() - 3600000).toISOString()
      },
      {
        id: 1002,
        companyId: 'market-almacen',
        folio: '1002',
        date: new Date().toISOString().split('T')[0],
        dteType: 'BOLETA_ELECTRONICA',
        sellerName: 'Mauricio Chamorro',
        customerName: 'Camila Morales',
        paymentMethod: 'DEBITO',
        items: [
          {
            productId: 3,
            productCode: '7802900001456',
            productName: 'Leche Entera Natural Colun 1 Litro',
            quantity: 3,
            unitPrice: 1190,
            subtotal: 3570
          }
        ],
        subtotalNeto: 3000,
        iva: 570,
        total: 3570,
        siiStatus: 'ACEPTADO_SII',
        status: 'COMPLETADA',
        createdAt: new Date(Date.now() - 1800000).toISOString()
      }
    ];
    await db.sales.bulkPut(demoSales);
  }

  // 3. Guías de Recepción de Mercadería de Proveedores (GR)
  const countReception = await db.receptionGuides.count();
  if (countReception === 0) {
    const demoReceptions: ReceptionGuide[] = [
      {
        id: 1,
        folio: 'GR-2026-001',
        date: getRelativeDateStr(-2),
        companyId: 'market-almacen',
        companyName: 'MARKET ALMACÉN SpA',
        supplierOrCarrierName: 'Compañía de Cervecerías Unidas S.A. (CCU)',
        supplierRut: '96.789.000-3',
        carrierRut: '14.238.910-4',
        vehiclePlate: 'KJ-88-21',
        externalDocNumber: 'FAC-892144',
        notes: 'Recepción conforme de pedido de bebidas y aguas semanales. Pallet en óptimo estado y temperatura.',
        confirmed: true,
        confirmedAt: new Date(Date.now() - 172800000).toISOString(),
        signerName: 'Mauricio Chamorro',
        signerRut: '16.890.123-4',
        items: [
          {
            code: '7801610001234',
            name: 'Bebida Coca-Cola Original 1.5 L',
            category: 'Bebidas y Licores',
            quantity: 48,
            unit: 'Unidades',
            unitPrice: 1250,
            location: 'Pasillo 1 - Estante A'
          },
          {
            code: '7801610005511',
            name: 'Agua Mineral Cachantún con Gas 1.5 L',
            category: 'Bebidas y Licores',
            quantity: 24,
            unit: 'Unidades',
            unitPrice: 650,
            location: 'Pasillo 1 - Estante B'
          }
        ],
        createdAt: new Date(Date.now() - 172800000).toISOString()
      },
      {
        id: 2,
        folio: 'GR-2026-002',
        date: getRelativeDateStr(-1),
        companyId: 'market-almacen',
        companyName: 'MARKET ALMACÉN SpA',
        supplierOrCarrierName: 'Cooperativa Agrícola y Lechera de La Unión (COLUN)',
        supplierRut: '81.234.567-8',
        carrierRut: '12.871.439-K',
        vehiclePlate: 'PW-44-12',
        externalDocNumber: 'COL-772190',
        notes: 'Ingreso directo a cámara de frío. Lotes y fechas de vencimiento auditadas y conformes.',
        confirmed: true,
        confirmedAt: new Date(Date.now() - 86400000).toISOString(),
        signerName: 'Encargado de Bodega',
        signerRut: '15.421.330-8',
        items: [
          {
            code: '7802900001456',
            name: 'Leche Entera Natural Colun 1 Litro',
            category: 'Lácteos y Fiambrería',
            quantity: 60,
            unit: 'Unidades',
            unitPrice: 780,
            location: 'Cámara Lácteos - Estante 2'
          },
          {
            code: 'QUESO-GAUDA-KG',
            name: 'Queso Gauda Laminado Calo',
            category: 'Lácteos y Fiambrería',
            quantity: 15,
            unit: 'Kg',
            unitPrice: 5800,
            location: 'Vitrina Fiambrería'
          }
        ],
        createdAt: new Date(Date.now() - 86400000).toISOString()
      }
    ];
    await db.receptionGuides.bulkPut(demoReceptions);
  }

  // 4. Guías de Despacho / Entrega (GD)
  const countDelivery = await db.deliveryGuides.count();
  if (countDelivery === 0) {
    const demoDeliveries: DeliveryGuide[] = [
      {
        id: 1,
        folio: 'GD-2026-001',
        date: getRelativeDateStr(-1),
        companyId: 'market-almacen',
        companyName: 'MARKET ALMACÉN SpA',
        companyRut: '77.890.120-5',
        dispatchType: 'FACTURABLE_CLIENTE',
        customerRut: '76.452.890-K',
        customerBusinessName: 'Casino & Eventos San Andrés Ltda.',
        customerActivity: 'Servicios de Alimentación y Banquetería',
        customerAddress: 'Camino Las Parcelas 450, Talagante',
        recipientName: 'Juan Pablo Vargas (Chofer Repartidor)',
        recipientRut: '15.987.654-3',
        recipientPhone: '+56 9 7712 3344',
        vehiclePlate: 'HJ-33-90',
        associatedVehiclePlate: 'HJ-33-90',
        invoiceFolio: 'FAC-1045',
        worksiteOrReason: 'Despacho de insumos semanales para servicio de alimentación institucional.',
        confirmed: true,
        confirmedAt: new Date(Date.now() - 86400000).toISOString(),
        signerName: 'Mauricio Chamorro',
        signerRut: '16.890.123-4',
        status: 'EMITIDA',
        items: [
          {
            code: 'PAN-HALLULLA-01',
            name: 'Pan Hallulla Especial Tradicional',
            quantity: 25,
            unit: 'Kg',
            unitPrice: 1890
          },
          {
            code: 'VERD-TOMATE-KG',
            name: 'Tomates Larga Vida Granel Selección',
            quantity: 15,
            unit: 'Kg',
            unitPrice: 1490
          },
          {
            code: '7801890003412',
            name: 'Aceite Vegetal Chef 900 ml',
            quantity: 12,
            unit: 'Unidades',
            unitPrice: 1990
          }
        ],
        createdAt: new Date(Date.now() - 86400000).toISOString()
      },
      {
        id: 2,
        folio: 'GD-2026-002',
        date: getRelativeDateStr(0),
        companyId: 'market-almacen',
        companyName: 'MARKET ALMACÉN SpA',
        companyRut: '77.890.120-5',
        dispatchType: 'TRASPASO_SUCURSAL',
        destinationBranch: 'Sucursal Centro - Local 2 (Av. Libertador 450)',
        recipientName: 'Gonzalo Pardo (Encargado Local 2)',
        recipientRut: '13.442.119-2',
        recipientPhone: '+56 9 9944 5566',
        vehiclePlate: 'LL-21-99',
        worksiteOrReason: 'Traspaso de mercadería para reabastecimiento de stock entre locales.',
        confirmed: true,
        confirmedAt: new Date().toISOString(),
        signerName: 'Mauricio Chamorro',
        signerRut: '16.890.123-4',
        status: 'EMITIDA',
        items: [
          {
            code: '7801234005678',
            name: 'Arroz Grado 1 Tucapel 1 Kg',
            quantity: 20,
            unit: 'Unidades',
            unitPrice: 1690
          },
          {
            code: '7805678001234',
            name: 'Detergente Líquido Omo Matic 1 Litro',
            quantity: 10,
            unit: 'Unidades',
            unitPrice: 3990
          },
          {
            code: '7802900001456',
            name: 'Leche Entera Natural Colun 1 Litro',
            quantity: 18,
            unit: 'Unidades',
            unitPrice: 1190
          }
        ],
        createdAt: new Date().toISOString()
      }
    ];
    await db.deliveryGuides.bulkPut(demoDeliveries);
  }

  // 5. Solicitudes y Órdenes de Compra (Compras)
  const countPurchases = await db.purchaseRequests.count();
  if (countPurchases === 0) {
    const demoPurchases: PurchaseRequest[] = [
      {
        id: 1,
        folio: 'OC-2026-001',
        date: getRelativeDateStr(-3),
        requesterName: 'Mauricio Chamorro',
        department: 'Bodega y Abastecimiento',
        priority: 'ALTA',
        status: 'APROBADO',
        companyId: 'market-almacen',
        notes: 'Distribuidora Mayorista CCU - Reposición de fin de mes de bebidas y aguas minerales.',
        totalEstimatedCost: 185000,
        estimatedCost: 185000,
        itemName: 'Bebidas Coca-Cola, Fanta, Sprite y Aguas Cachantún',
        category: 'Bebidas y Licores',
        quantity: 120,
        justification: 'Alta rotación durante fines de semana y quiebre previsto de stock.',
        items: [
          { name: 'Bebida Coca-Cola 1.5 L', quantity: 60, unit: 'Unidades', estimatedUnitPrice: 1250, estimatedCost: 75000 },
          { name: 'Bebida Fanta Naranja 1.5 L', quantity: 30, unit: 'Unidades', estimatedUnitPrice: 1200, estimatedCost: 36000 },
          { name: 'Agua Mineral Cachantún 1.5 L', quantity: 30, unit: 'Unidades', estimatedUnitPrice: 650, estimatedCost: 19500 }
        ],
        createdAt: new Date(Date.now() - 259200000).toISOString()
      },
      {
        id: 2,
        folio: 'OC-2026-002',
        date: getRelativeDateStr(-2),
        requesterName: 'Mauricio Chamorro',
        department: 'Fiambrería y Lácteos',
        priority: 'MEDIA',
        status: 'COMPRADO',
        companyId: 'market-almacen',
        notes: 'Lácteos Colun y Cecinas Llanquihue - Pedido de fiambres y quesos.',
        totalEstimatedCost: 142500,
        estimatedCost: 142500,
        itemName: 'Queso Gauda, Jamón Colonial y Mantequilla',
        category: 'Lácteos y Fiambrería',
        quantity: 45,
        justification: 'Abastecimiento vitrina refrigerada.',
        items: [
          { name: 'Queso Gauda Laminado Calo', quantity: 15, unit: 'Kg', estimatedUnitPrice: 5800, estimatedCost: 87000 },
          { name: 'Jamón Colonial Praga Artesanal', quantity: 8, unit: 'Kg', estimatedUnitPrice: 6900, estimatedCost: 55200 }
        ],
        createdAt: new Date(Date.now() - 172800000).toISOString()
      },
      {
        id: 3,
        folio: 'OC-2026-003',
        date: getRelativeDateStr(0),
        requesterName: 'Cajero de Turno',
        department: 'Panadería y Abarrotes',
        priority: 'URGENTE',
        status: 'PENDIENTE',
        companyId: 'market-almacen',
        notes: 'Molino San Cristóbal - Harina y levadura para producción diaria.',
        totalEstimatedCost: 78900,
        estimatedCost: 78900,
        itemName: 'Harina Flor Selecta 25 Kg y Levadura Instantánea',
        category: 'Panadería y Pastelería',
        quantity: 5,
        justification: 'Insumos agotándose para elaboración de Pan Hallulla de mañana.',
        items: [
          { name: 'Harina Flor Panadera 25 Kg', quantity: 4, unit: 'Sacos', estimatedUnitPrice: 16500, estimatedCost: 66000 },
          { name: 'Levadura Instantánea Collico 500g', quantity: 6, unit: 'Unidades', estimatedUnitPrice: 2150, estimatedCost: 12900 }
        ],
        createdAt: new Date().toISOString()
      }
    ];
    await db.purchaseRequests.bulkPut(demoPurchases);
  }

  // 6. Registro de Mermas de Bodega (Incidents)
  const countMermas = await db.incidents.count();
  if (countMermas === 0) {
    const demoMermas: Incident[] = [
      {
        id: 1,
        date: getRelativeDateStr(-4),
        type: 'MERMA_BODEGA',
        itemType: 'PRODUCTO',
        itemCode: '7801610001234',
        itemName: 'Bebida Coca-Cola Original 1.5 L',
        quantity: 2,
        costEstimated: 2500,
        mermaReason: 'DANO_ROTURA',
        location: 'Pasillo 1 - Estante A',
        responsibleName: 'Mauricio Chamorro',
        responsibleRut: '16.890.123-4',
        description: 'Rotura accidental de envases plásticos al descargar pallet en pasillo central.',
        companyId: 'market-almacen',
        resolutionStatus: 'RESUELTO',
        createdAt: new Date(Date.now() - 345600000).toISOString()
      },
      {
        id: 2,
        date: getRelativeDateStr(-2),
        type: 'MERMA_BODEGA',
        itemType: 'PRODUCTO',
        itemCode: '7802900001456',
        itemName: 'Leche Entera Natural Colun 1 Litro',
        quantity: 3,
        costEstimated: 2340,
        mermaReason: 'DEFECTO_FABRICA',
        location: 'Cámara Lácteos - Estante 2',
        responsibleName: 'Encargado de Bodega',
        responsibleRut: '15.421.330-8',
        description: 'Falla en sellado de boquilla tetrapak detectada durante la revisión de recepción.',
        companyId: 'market-almacen',
        resolutionStatus: 'RESUELTO',
        createdAt: new Date(Date.now() - 172800000).toISOString()
      },
      {
        id: 3,
        date: getRelativeDateStr(-1),
        type: 'MERMA_BODEGA',
        itemType: 'PRODUCTO',
        itemCode: 'VERD-TOMATE-KG',
        itemName: 'Tomates Larga Vida Granel Selección',
        quantity: 4,
        costEstimated: 3400,
        mermaReason: 'MERMA_OPERACIONAL',
        location: 'Isla Frutas y Verduras',
        responsibleName: 'Sección Verdulería',
        responsibleRut: '11.111.111-1',
        description: 'Descarte de merma vegetal por sobremaduración normal posterior al fin de semana.',
        companyId: 'market-almacen',
        resolutionStatus: 'RESUELTO',
        createdAt: new Date(Date.now() - 86400000).toISOString()
      }
    ];
    await db.incidents.bulkPut(demoMermas);
  }

  // 6. Movimientos Históricos de Stock (Kardex)
  const countMovements = await db.productMovements.count();
  if (countMovements === 0) {
    const demoMovements: ProductMovement[] = [
      {
        id: 1,
        productId: 1,
        productCode: '7801610001234',
        productName: 'Bebida Coca-Cola Original 1.5 L',
        type: 'ENTRADA',
        quantity: 50,
        previousStock: 0,
        newStock: 50,
        reason: 'Ingreso inicial por Recepción de Compra Factura #84920',
        referenceDoc: 'FAC-PROV-84920',
        responsibleName: 'Distribuidora Andina S.A.',
        user: 'Mauricio Chamorro (Administrador)',
        date: new Date(Date.now() - 3 * 86400000).toISOString(),
        companyId: 'market-almacen'
      },
      {
        id: 2,
        productId: 1,
        productCode: '7801610001234',
        productName: 'Bebida Coca-Cola Original 1.5 L',
        type: 'SALIDA',
        quantity: 2,
        previousStock: 50,
        newStock: 48,
        reason: 'Venta en mostrador Boleta Electrónica #1001',
        referenceDoc: 'BOL-1001',
        responsibleName: 'Caja 1 - Principal',
        user: 'Mauricio Chamorro',
        date: new Date(Date.now() - 86400000).toISOString(),
        companyId: 'market-almacen'
      },
      {
        id: 3,
        productId: 3,
        productCode: '7802900001456',
        productName: 'Leche Entera Natural Colun 1 Litro',
        type: 'ENTRADA',
        quantity: 65,
        previousStock: 0,
        newStock: 65,
        reason: 'Recepción de mercadería fresca Factura #44120',
        referenceDoc: 'FAC-COLUN-44120',
        responsibleName: 'Cooperativa Colun',
        user: 'Mauricio Chamorro (Administrador)',
        date: new Date(Date.now() - 2 * 86400000).toISOString(),
        companyId: 'market-almacen'
      },
      {
        id: 4,
        productId: 3,
        productCode: '7802900001456',
        productName: 'Leche Entera Natural Colun 1 Litro',
        type: 'SALIDA',
        quantity: 3,
        previousStock: 65,
        newStock: 62,
        reason: 'Venta en mostrador Boleta Electrónica #1002',
        referenceDoc: 'BOL-1002',
        responsibleName: 'Caja 1 - Principal',
        user: 'Mauricio Chamorro',
        date: new Date(Date.now() - 43200000).toISOString(),
        companyId: 'market-almacen'
      },
      {
        id: 5,
        productId: 3,
        productCode: '7802900001456',
        productName: 'Leche Entera Natural Colun 1 Litro',
        type: 'AJUSTE',
        quantity: 2,
        previousStock: 62,
        newStock: 60,
        reason: 'Baja por caja dañada en estante (Acta Merma #1)',
        referenceDoc: 'MERMA-001',
        responsibleName: 'Sección Lácteos',
        user: 'Mauricio Chamorro (Administrador)',
        date: new Date(Date.now() - 10800000).toISOString(),
        companyId: 'market-almacen'
      },
      {
        id: 6,
        productId: 2,
        productCode: '7801890003412',
        productName: 'Aceite Vegetal Chef 900 ml',
        type: 'ENTRADA',
        quantity: 40,
        previousStock: 0,
        newStock: 40,
        reason: 'Ingreso mercadería abarrotes Factura #1293',
        referenceDoc: 'FAC-1293',
        responsibleName: 'Alimentos del Sur',
        user: 'Mauricio Chamorro (Administrador)',
        date: new Date(Date.now() - 2 * 86400000).toISOString(),
        companyId: 'market-almacen'
      },
      {
        id: 7,
        productId: 5,
        productCode: 'PAN-HALLULLA-01',
        productName: 'Pan Hallulla Especial Tradicional',
        type: 'ENTRADA',
        quantity: 30,
        previousStock: 0,
        newStock: 30,
        reason: 'Producción / Horneado mañana panadería',
        referenceDoc: 'HORNEO-01',
        responsibleName: 'Maestro Panadero',
        user: 'Mauricio Chamorro',
        date: new Date().toISOString(),
        companyId: 'market-almacen'
      }
    ];
    await db.productMovements.bulkPut(demoMovements);
  }

  await cleanupOrphanedRecords();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('marketalmacen-data-updated'));
  }
}

export async function generateMassiveDataset(
  productsCount = 1000,
  toolsCount = 1000,
  onProgress?: (msg: string, pct: number) => void
) {
  if (onProgress) onProgress('Completado', 100);
}
