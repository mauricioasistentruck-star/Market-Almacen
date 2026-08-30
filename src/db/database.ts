import Dexie, { type Table } from 'dexie';
import type {
  Product,
  Tool,
  ToolKit,
  ToolLoan,
  ProductMovement,
  Company,
  DeliveryGuide,
  ReceptionGuide,
  LogbookEntry,
  PurchaseRequest,
  Incident,
  AppUser,
  Worker,
  Sale,
  SiiConfig,
  CashClosing
} from '../types';

export class MarketAlmacenDatabase extends Dexie {
  products!: Table<Product, number>;
  tools!: Table<Tool, number>;
  toolKits!: Table<ToolKit, number>;
  toolLoans!: Table<ToolLoan, number>;
  productMovements!: Table<ProductMovement, number>;
  companies!: Table<Company, string>;
  deliveryGuides!: Table<DeliveryGuide, number>;
  receptionGuides!: Table<ReceptionGuide, number>;
  logbookEntries!: Table<LogbookEntry, number>;
  purchaseRequests!: Table<PurchaseRequest, number>;
  incidents!: Table<Incident, number>;
  users!: Table<AppUser, number>;
  workers!: Table<Worker, number>;
  sales!: Table<Sale, number>;
  siiConfigs!: Table<SiiConfig, number>;
  cashClosings!: Table<CashClosing, number>;

  constructor() {
    super('MarketAlmacenDB');
    this.version(1).stores({
      products: '++id, code, name, category, mannFilterCode, brand, companyId, location, stock, minStock, condition, completeness, createdAt',
      tools: '++id, code, name, brand, category, companyId, location, status, condition, completeness, createdAt',
      toolKits: '++id, code, name, category, companyId, createdAt',
      toolLoans: '++id, toolId, toolCode, workerName, workerRut, deliveryDate, returnDate, status, companyId',
      productMovements: '++id, productId, productCode, type, reason, workerOrSupplier, date, companyId',
      companies: 'id, rut, name, isNaturalPerson',
      deliveryGuides: '++id, folio, date, companyId, recipientName, recipientRut, vehiclePlate',
      receptionGuides: '++id, folio, date, companyId, supplierOrCarrierName, carrierRut, vehiclePlate',
      logbookEntries: '++id, date, weekLabel, companyId, createdAt',
      purchaseRequests: '++id, date, requesterName, priority, status, companyId',
      incidents: '++id, date, type, itemType, itemCode, responsibleName, responsibleRut, resolutionStatus, companyId',
      users: '++id, username, name, role, createdAt',
      workers: '++id, name, rut, type, companyId, createdAt',
      sales: '++id, folio, date, companyId, customerRut, customerName, paymentMethod, dteType, siiStatus, status, createdAt',
      siiConfigs: '++id, companyId, rutEmisor',
      cashClosings: '++id, closingFolio, date, companyId, responsibleName, status, createdAt'
    });
  }
}

export const db = new MarketAlmacenDatabase();

/**
 * Migración transparente: Si existe la base de datos anterior (AsistenTruckBodega2DB),
 * se copian todos los datos a MarketAlmacenDB sin perder ventas, boletas, cierres ni inventario.
 */
export async function migrateFromLegacyDatabaseIfNeeded() {
  try {
    const currentProductsCount = await db.products.count();
    const currentSalesCount = await db.sales.count();
    
    // Si la base actual ya tiene datos, no sobreescribir
    if (currentProductsCount > 0 || currentSalesCount > 0) {
      return;
    }

    if (typeof indexedDB !== 'undefined' && indexedDB.databases) {
      const dbs = await indexedDB.databases();
      const hasOldDb = dbs.some(d => d.name === 'AsistenTruckBodega2DB');
      if (!hasOldDb) return;
    }

    const oldDb = new Dexie('AsistenTruckBodega2DB');
    oldDb.version(5).stores({
      products: '++id, code, name, category, mannFilterCode, brand, companyId, location, stock, minStock, condition, completeness, createdAt',
      tools: '++id, code, name, brand, category, companyId, location, status, condition, completeness, createdAt',
      toolKits: '++id, code, name, category, companyId, createdAt',
      toolLoans: '++id, toolId, toolCode, workerName, workerRut, deliveryDate, returnDate, status, companyId',
      productMovements: '++id, productId, productCode, type, reason, workerOrSupplier, date, companyId',
      companies: 'id, rut, name, isNaturalPerson',
      deliveryGuides: '++id, folio, date, companyId, recipientName, recipientRut, vehiclePlate',
      receptionGuides: '++id, folio, date, companyId, supplierOrCarrierName, carrierRut, vehiclePlate',
      logbookEntries: '++id, date, weekLabel, companyId, createdAt',
      purchaseRequests: '++id, date, requesterName, priority, status, companyId',
      incidents: '++id, date, type, itemType, itemCode, responsibleName, responsibleRut, resolutionStatus, companyId',
      users: '++id, username, name, role, createdAt',
      workers: '++id, name, rut, type, companyId, createdAt',
      sales: '++id, folio, date, companyId, customerRut, customerName, paymentMethod, dteType, siiStatus, status, createdAt',
      siiConfigs: '++id, companyId, rutEmisor',
      cashClosings: '++id, closingFolio, date, companyId, responsibleName, status, createdAt'
    });

    await oldDb.open();
    
    const tables = [
      'companies', 'products', 'tools', 'toolKits', 'toolLoans',
      'productMovements', 'deliveryGuides', 'receptionGuides',
      'logbookEntries', 'purchaseRequests', 'incidents', 'users',
      'workers', 'sales', 'siiConfigs', 'cashClosings'
    ];

    for (const tbl of tables) {
      try {
        const oldTable = (oldDb as any)[tbl];
        const newTable = (db as any)[tbl];
        if (oldTable && newTable) {
          const records = await oldTable.toArray();
          if (records && records.length > 0) {
            // Reemplazar IDs de empresas antiguas para que coincidan con Market Almacén
            const cleanRecords = records.map((r: any) => {
              const item = { ...r };
              if (item.companyId === 'asistentruck' || item.companyId === 'botam') {
                item.companyId = 'market-almacen';
              }
              if (tbl === 'companies') {
                if (item.id === 'asistentruck' || item.id === 'botam') {
                  item.id = 'market-almacen';
                  item.name = 'MARKET ALMACÉN SpA';
                  item.tradeName = 'Market Almacén';
                  item.industry = 'Comercio, Almacén y Distribución General';
                }
              }
              return item;
            });
            await newTable.bulkPut(cleanRecords);
          }
        }
      } catch (err) {
        console.warn('Migración de tabla', tbl, err);
      }
    }
    oldDb.close();
    console.log('✅ Migración desde base de datos anterior completada exitosamente.');
  } catch (e) {
    console.warn('Nota sobre migración de base de datos:', e);
  }
}

/**
 * Elimina una empresa y en CASCADA todos los registros asociados
 */
export async function deleteCompanyWithCascade(companyId: string): Promise<{
  productsDeleted: number;
  toolsDeleted: number;
}> {
  let productsDeleted = 0;
  let toolsDeleted = 0;

  await db.transaction('rw', [
    db.products,
    db.tools,
    db.toolKits,
    db.toolLoans,
    db.productMovements,
    db.deliveryGuides,
    db.receptionGuides,
    db.logbookEntries,
    db.purchaseRequests,
    db.incidents,
    db.workers,
    db.companies,
    db.sales,
    db.siiConfigs,
    db.cashClosings
  ], async () => {
    const prods = await db.products.filter(p => p.companyId === companyId).toArray();
    productsDeleted = prods.length;
    if (prods.length > 0) {
      await db.products.bulkDelete(prods.map(p => p.id!).filter(Boolean));
    }

    const tls = await db.tools.filter(t => t.companyId === companyId).toArray();
    toolsDeleted = tls.length;
    if (tls.length > 0) {
      await db.tools.bulkDelete(tls.map(t => t.id!).filter(Boolean));
    }

    const kits = await db.toolKits.filter(k => k.companyId === companyId).toArray();
    if (kits.length > 0) {
      await db.toolKits.bulkDelete(kits.map(k => k.id!).filter(Boolean));
    }

    const loans = await db.toolLoans.filter(l => l.companyId === companyId).toArray();
    if (loans.length > 0) {
      await db.toolLoans.bulkDelete(loans.map(l => l.id!).filter(Boolean));
    }

    const movs = await db.productMovements.filter(m => m.companyId === companyId).toArray();
    if (movs.length > 0) {
      await db.productMovements.bulkDelete(movs.map(m => m.id!).filter(Boolean));
    }

    const delivs = await db.deliveryGuides.filter(g => g.companyId === companyId).toArray();
    if (delivs.length > 0) {
      await db.deliveryGuides.bulkDelete(delivs.map(g => g.id!).filter(Boolean));
    }

    const receps = await db.receptionGuides.filter(g => g.companyId === companyId).toArray();
    if (receps.length > 0) {
      await db.receptionGuides.bulkDelete(receps.map(g => g.id!).filter(Boolean));
    }

    const logs = await db.logbookEntries.filter(l => l.companyId === companyId).toArray();
    if (logs.length > 0) {
      await db.logbookEntries.bulkDelete(logs.map(l => l.id!).filter(Boolean));
    }

    const reqs = await db.purchaseRequests.filter(r => r.companyId === companyId).toArray();
    if (reqs.length > 0) {
      await db.purchaseRequests.bulkDelete(reqs.map(r => r.id!).filter(Boolean));
    }

    const incs = await db.incidents.filter(i => i.companyId === companyId).toArray();
    if (incs.length > 0) {
      await db.incidents.bulkDelete(incs.map(i => i.id!).filter(Boolean));
    }

    const wrks = await db.workers.filter(w => w.companyId === companyId).toArray();
    if (wrks.length > 0) {
      await db.workers.bulkDelete(wrks.map(w => w.id!).filter(Boolean));
    }

    const sls = await db.sales.filter(s => s.companyId === companyId).toArray();
    if (sls.length > 0) {
      await db.sales.bulkDelete(sls.map(s => s.id!).filter(Boolean));
    }

    const siic = await db.siiConfigs.filter(sc => sc.companyId === companyId).toArray();
    if (siic.length > 0) {
      await db.siiConfigs.bulkDelete(siic.map(sc => sc.id!).filter(Boolean));
    }

    const cash = await db.cashClosings.filter(cc => cc.companyId === companyId).toArray();
    if (cash.length > 0) {
      await db.cashClosings.bulkDelete(cash.map(cc => cc.id!).filter(Boolean));
    }

    await db.companies.delete(companyId);
  });

  return { productsDeleted, toolsDeleted };
}

/**
 * Limpia registros huérfanos cuya empresa ya no existe
 */
export async function cleanupOrphanedRecords(): Promise<number> {
  const allCompanies = await db.companies.toArray();
  const validCompanyIds = new Set(allCompanies.map(c => c.id));
  
  let cleanedCount = 0;

  await db.transaction('rw', [
    db.products,
    db.tools,
    db.toolKits,
    db.toolLoans,
    db.productMovements,
    db.deliveryGuides,
    db.receptionGuides,
    db.logbookEntries,
    db.purchaseRequests,
    db.incidents,
    db.workers,
    db.sales,
    db.cashClosings
  ], async () => {
    const orphanProducts = await db.products.filter(p => !validCompanyIds.has(p.companyId)).toArray();
    if (orphanProducts.length > 0) {
      await db.products.bulkDelete(orphanProducts.map(p => p.id!).filter(Boolean));
      cleanedCount += orphanProducts.length;
    }

    const orphanTools = await db.tools.filter(t => !validCompanyIds.has(t.companyId)).toArray();
    if (orphanTools.length > 0) {
      await db.tools.bulkDelete(orphanTools.map(t => t.id!).filter(Boolean));
      cleanedCount += orphanTools.length;
    }

    const orphanKits = await db.toolKits.filter(k => !validCompanyIds.has(k.companyId)).toArray();
    if (orphanKits.length > 0) {
      await db.toolKits.bulkDelete(orphanKits.map(k => k.id!).filter(Boolean));
      cleanedCount += orphanKits.length;
    }

    const orphanLoans = await db.toolLoans.filter(l => !validCompanyIds.has(l.companyId)).toArray();
    if (orphanLoans.length > 0) {
      await db.toolLoans.bulkDelete(orphanLoans.map(l => l.id!).filter(Boolean));
      cleanedCount += orphanLoans.length;
    }

    const orphanMovements = await db.productMovements.filter(m => !validCompanyIds.has(m.companyId)).toArray();
    if (orphanMovements.length > 0) {
      await db.productMovements.bulkDelete(orphanMovements.map(m => m.id!).filter(Boolean));
      cleanedCount += orphanMovements.length;
    }

    const orphanDelivery = await db.deliveryGuides.filter(g => !validCompanyIds.has(g.companyId)).toArray();
    if (orphanDelivery.length > 0) {
      await db.deliveryGuides.bulkDelete(orphanDelivery.map(g => g.id!).filter(Boolean));
      cleanedCount += orphanDelivery.length;
    }

    const orphanReception = await db.receptionGuides.filter(g => !validCompanyIds.has(g.companyId)).toArray();
    if (orphanReception.length > 0) {
      await db.receptionGuides.bulkDelete(orphanReception.map(g => g.id!).filter(Boolean));
      cleanedCount += orphanReception.length;
    }

    const orphanLogs = await db.logbookEntries.filter(l => !validCompanyIds.has(l.companyId)).toArray();
    if (orphanLogs.length > 0) {
      await db.logbookEntries.bulkDelete(orphanLogs.map(l => l.id!).filter(Boolean));
      cleanedCount += orphanLogs.length;
    }

    const orphanRequests = await db.purchaseRequests.filter(r => !validCompanyIds.has(r.companyId)).toArray();
    if (orphanRequests.length > 0) {
      await db.purchaseRequests.bulkDelete(orphanRequests.map(r => r.id!).filter(Boolean));
      cleanedCount += orphanRequests.length;
    }

    const orphanIncidents = await db.incidents.filter(i => !validCompanyIds.has(i.companyId)).toArray();
    if (orphanIncidents.length > 0) {
      await db.incidents.bulkDelete(orphanIncidents.map(i => i.id!).filter(Boolean));
      cleanedCount += orphanIncidents.length;
    }

    const orphanWorkers = await db.workers.filter(w => !validCompanyIds.has(w.companyId)).toArray();
    if (orphanWorkers.length > 0) {
      await db.workers.bulkDelete(orphanWorkers.map(w => w.id!).filter(Boolean));
      cleanedCount += orphanWorkers.length;
    }
  });

  return cleanedCount;
}

export async function clearProductsForCompany(companyId: string): Promise<number> {
  const prods = await db.products.filter(p => p.companyId === companyId).toArray();
  if (prods.length > 0) {
    await db.products.bulkDelete(prods.map(p => p.id!).filter(Boolean));
  }
  return prods.length;
}

export async function clearToolsForCompany(companyId: string): Promise<number> {
  const tls = await db.tools.filter(t => t.companyId === companyId).toArray();
  if (tls.length > 0) {
    await db.tools.bulkDelete(tls.map(t => t.id!).filter(Boolean));
  }
  return tls.length;
}
