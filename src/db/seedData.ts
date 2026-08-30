import { db, cleanupOrphanedRecords, migrateFromLegacyDatabaseIfNeeded } from './database';
import type { Company, Product, Sale } from '../types';

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
    createdAt: new Date().toISOString()
  }
];

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
    category: 'Frutas y Verduras',
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

  // Comprobar si hay productos válidos con stock
  const countProducts = await db.products.count();
  if (countProducts === 0) {
    await db.products.bulkAdd(INITIAL_DEMO_PRODUCTS as any);
  }

  // Comprobar si hay ventas de prueba para el historial
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
