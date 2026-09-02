import type { WeighablePreset, CompanyServiceOption } from '../utils/rubroPresets';
export type ThemeMode = 'white' | 'dark-red' | 'blue-green';

export type UserRole = 'SUPERADMIN' | 'ADMIN' | 'VENTAS' | 'BODEGA' | 'CUSTOM';

export interface UserPermissions {
  pos: boolean;            // Terminal POS de ventas y cobros
  priceConsultant: boolean; // Consultor rápido de precios y stock
  inventory: boolean;      // Catálogo e inventario de productos
  productHistory: boolean; // Historial de movimientos / Kardex
  guides: boolean;         // Guías de despacho y recepción
  purchases: boolean;      // Solicitud de productos / compras
  mermas: boolean;         // Registro de mermas
  cashClosing: boolean;    // Cierre de caja (Z)
  reports: boolean;        // Informes y estadísticas
  suppliers: boolean;      // Proveedores
  customers: boolean;      // Clientes con factura
  inventoryTaking: boolean;// Toma de inventario física
  cafFolios: boolean;      // Sistema de Folios CAF (SII)
  cloudSync: boolean;      // Sincronización Nube Supabase
  backup: boolean;         // Copia de seguridad
  manageUsers: boolean;    // Gestión de usuarios y permisos
}

export const DEFAULT_PERMISSIONS_BY_ROLE: Record<UserRole, UserPermissions> = {
  SUPERADMIN: {
    pos: true,
    priceConsultant: true,
    inventory: true,
    productHistory: true,
    guides: true,
    purchases: true,
    mermas: true,
    cashClosing: true,
    reports: true,
    suppliers: true,
    customers: true,
    inventoryTaking: true,
    cafFolios: true,
    cloudSync: true,
    backup: true,
    manageUsers: true,
  },
  ADMIN: {
    pos: true,
    priceConsultant: true,
    inventory: true,
    productHistory: true,
    guides: true,
    purchases: true,
    mermas: true,
    cashClosing: true,
    reports: true,
    suppliers: true,
    customers: true,
    inventoryTaking: true,
    cafFolios: true,
    cloudSync: true,
    backup: true,
    manageUsers: true,
  },
  VENTAS: {
    pos: true,
    priceConsultant: true,
    inventory: false,
    productHistory: false,
    guides: false,
    purchases: true,
    mermas: true,
    cashClosing: true,
    reports: false,
    suppliers: false,
    customers: true,
    inventoryTaking: false,
    cafFolios: false,
    cloudSync: false,
    backup: false,
    manageUsers: false,
  },
  BODEGA: {
    pos: false,
    priceConsultant: true,
    inventory: true,
    productHistory: true,
    guides: true,
    purchases: true,
    mermas: true,
    cashClosing: false,
    reports: false,
    suppliers: true,
    customers: false,
    inventoryTaking: true,
    cafFolios: false,
    cloudSync: false,
    backup: false,
    manageUsers: false,
  },
  CUSTOM: {
    pos: true,
    priceConsultant: true,
    inventory: true,
    productHistory: true,
    guides: false,
    purchases: true,
    mermas: true,
    cashClosing: false,
    reports: false,
    suppliers: false,
    customers: false,
    inventoryTaking: false,
    cafFolios: false,
    cloudSync: false,
    backup: false,
    manageUsers: false,
  }
};

export function getUserPermissions(user: AppUser | null): UserPermissions {
  if (!user) return DEFAULT_PERMISSIONS_BY_ROLE.VENTAS;
  const role = user.role || 'VENTAS';
  const defaults = DEFAULT_PERMISSIONS_BY_ROLE[role] || DEFAULT_PERMISSIONS_BY_ROLE.VENTAS;
  if (!user.permissions) return defaults;
  return { ...defaults, ...user.permissions };
}

export interface AppUser {
  id?: number;
  username: string;
  password?: string;
  name: string;
  role: UserRole;
  companyId?: string; // Empresa a la que pertenece ('ALL' para Superadmin Mauricio)
  createdAt: string;
  permissions?: Partial<UserPermissions>;
  defaultModule?: string;
}

export interface Company {
  id: string;
  rut: string;
  name: string;
  tradeName?: string;
  industry?: string;
  rubroKey?: string;
  customCategories?: string[];
  customUnits?: string[];
  customWeighablePresets?: WeighablePreset[];
  customServices?: CompanyServiceOption[];
  phone?: string;
  address?: string;
  isNaturalPerson?: boolean;
  // Configuración de API SII y SimpleAPI exclusiva e independiente por empresa
  simpleApiKey?: string;
  siiAmbiente?: 'certificacion' | 'produccion';
  resolucionNumero?: string;
  resolucionFecha?: string;
  createdAt: string;
  updatedAt?: string;
}

export type ItemCondition = 'DISPONIBLE' | 'OFERTA' | 'LIQUIDACION' | 'POR_VENCER' | 'AGOTADO' | 'DANADO' | 'NUEVO' | 'EXCELENTE' | 'BUENO' | 'DESGASTE' | string;
export type ItemCompleteness = 'COMPLETO' | 'INCOMPLETO' | string;

export interface Product {
  id?: number;
  code: string;
  name: string;
  category: string;
  isFilter?: boolean;
  mannFilterCode?: string;
  brand?: string;
  companyId?: string;
  location: string;
  stock: number;
  minStock: number;
  unit: string;
  price?: number;
  costPrice?: number;
  expiryDate?: string; // Fecha de vencimiento (YYYY-MM-DD)
  offerPrice?: number; // Precio promocional / liquidación
  offerStockLimit?: number; // Cantidad de unidades destinadas a oferta (ej: 20)
  offerStockRemaining?: number; // Unidades restantes en oferta (ej: 20)
  offerLabel?: string; // Motivo o etiqueta de liquidación
  condition: ItemCondition;
  completeness: ItemCompleteness;
  conditionNotes?: string;
  imageUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export type ToolStatus = 'DISPONIBLE' | 'PRESTADA' | 'MANTENIMIENTO' | 'DANADA' | 'EXTRAVIADA' | 'DE_BAJA' | 'PERDIDA' | string;

export interface Tool {
  id?: number;
  code: string;
  name: string;
  brand?: string;
  model?: string;
  category: string;
  companyId?: string;
  location: string;
  status: ToolStatus;
  condition: ItemCondition;
  completeness: ItemCompleteness;
  conditionNotes?: string;
  imageUrl?: string;
  currentLoanId?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ToolKit {
  id?: number;
  code?: string;
  name: string;
  description?: string;
  category?: string;
  companyId?: string;
  toolIds?: number[];
  toolCodes?: string[];
  createdAt: string;
  updatedAt?: string;
}

export interface ToolLoan {
  id?: number;
  toolId: number;
  toolCode: string;
  toolName?: string;
  toolBrand?: string;
  workerName: string;
  workerRut?: string;
  workerPhone?: string;
  workerRole?: string;
  deliveryDate: string;
  returnDate?: string;
  expectedReturnDate?: string;
  responsibleName?: string;
  status: 'ACTIVO' | 'DEVUELTO' | 'ATRASADO' | string;
  conditionOnDelivery?: ItemCondition;
  conditionOnReturn?: ItemCondition;
  deliveryCondition?: ItemCondition | string;
  returnCondition?: ItemCondition | string;
  returnNotes?: string;
  receivedBy?: string;
  deliveredBy?: string;
  notes?: string;
  signature?: string;
  signatureData?: string;
  companyId?: string;
}

export interface ProductMovement {
  id?: number;
  productId: number;
  productCode: string;
  productName?: string;
  type: 'ENTRADA' | 'SALIDA' | 'AJUSTE';
  quantity: number;
  previousStock?: number;
  newStock?: number;
  user?: string;
  vehiclePlate?: string;
  reason: string;
  referenceDoc?: string;
  responsibleName?: string;
  workerOrSupplier?: string;
  date: string;
  companyId: string;
  notes?: string;
  createdAt?: string;
}

export interface DeliveryGuideItem {
  id?: number;
  code: string;
  name: string;
  quantity: number;
  unit: string;
  price?: number;
  unitPrice?: number;
  type?: 'PRODUCTO' | 'HERRAMIENTA' | string;
  productId?: number;
  brand?: string;
  condition?: string;
}

export interface DeliveryGuide {
  id?: number;
  folio: string;
  date: string;
  companyId: string;
  companyName?: string;
  companyRut?: string;
  dispatchType?: 'FACTURABLE_CLIENTE' | 'TRASPASO_SUCURSAL';
  invoiceFolio?: string;
  customerRut?: string;
  customerBusinessName?: string;
  customerActivity?: string;
  customerAddress?: string;
  recipientName: string;
  recipientRut?: string;
  recipientPhone?: string;
  worksiteOrReason?: string;
  destinationBranch?: string;
  vehiclePlate?: string;
  associatedVehiclePlate?: string;
  externalDocNumber?: string;
  comments?: string;
  notes?: string;
  linkedFolio?: string;
  warehouseStamp?: boolean | string;
  confirmed?: boolean;
  confirmedAt?: string;
  items: DeliveryGuideItem[];
  signatureDataUrl?: string;
  signatureData?: string;
  recipientSignature?: string;
  signerName?: string;
  signerRut?: string;
  status?: string;
  pdfUrl?: string;
  createdAt?: string;
}

export interface ReceptionGuideItem {
  code: string;
  name: string;
  category?: string;
  quantity: number;
  unit: string;
  price?: number;
  unitPrice?: number;
  type?: 'PRODUCTO' | 'HERRAMIENTA' | string;
  mannFilterCode?: string;
  brand?: string;
  condition?: ItemCondition | string;
  completeness?: ItemCompleteness | string;
  minStock?: number;
  location?: string;
  isNewProduct?: boolean;
  isNewItem?: boolean;
}

export interface ReceptionGuide {
  id?: number;
  folio: string;
  date: string;
  companyId: string;
  companyName?: string;
  supplierOrCarrierName: string;
  supplierRut?: string;
  carrierRut?: string;
  carrierPhone?: string;
  vehiclePlate?: string;
  carrierVehiclePlate?: string;
  externalDocNumber?: string;
  notes?: string;
  linkedFolio?: string;
  recipientSignature?: string;
  warehouseStamp?: boolean | string;
  confirmed?: boolean;
  confirmedAt?: string;
  invoiceScanImage?: string;
  invoiceDocName?: string;
  invoiceDocType?: string;
  items: ReceptionGuideItem[];
  signatureDataUrl?: string;
  signatureData?: string;
  signerName?: string;
  signerRut?: string;
  invoiceFolio?: string;
  pdfUrl?: string;
  createdAt?: string;
}

export interface LogbookDayEvent {
  id?: string;
  time?: string;
  type?: any;
  title?: string;
  description?: string;
  responsible?: string;
  author?: string;
}

export interface LogbookEntry {
  id?: number;
  date: string;
  dayName?: string;
  weekLabel: string;
  companyId: string;
  shift?: 'MANANA' | 'TARDE' | 'NOCHE' | 'COMPLETO' | string;
  responsibleName?: string;
  tasksPerformed?: string;
  incidentsReported?: string;
  pendingDeliveries?: string;
  observations?: string;
  dayEvents?: any;
  events?: string;
  workCompleted?: string;
  staffRequests?: string;
  importantNotes?: string;
  author?: string;
  createdAt: string;
  updatedAt?: string;
}

export type PriorityLevel = 'BAJA' | 'MEDIA' | 'ALTA' | 'URGENTE';
export type PurchaseStatus = 'PENDIENTE' | 'COTIZADO' | 'APROBADO' | 'RECHAZADO' | 'COMPRADO';

export interface PurchaseRequestItem {
  id?: string;
  name: string;
  productName?: string;
  quantity: number;
  unit?: string;
  urgencyReason?: string;
  currentStock?: number;
  minStock?: number;
  estimatedUnitPrice?: number;
  estimatedCost?: number;
}

export interface PurchaseRequest {
  id?: number;
  folio?: string;
  date: string;
  requesterName: string;
  department?: string;
  priority: PriorityLevel;
  status: PurchaseStatus;
  companyId?: string;
  notes?: string;
  totalEstimatedCost?: number;
  estimatedCost?: number;
  itemName?: string;
  category?: string;
  quantity?: number;
  justification?: string;
  items?: PurchaseRequestItem[];
  pdfUrl?: string;
  createdAt: string;
}

export type IncidentType = 'DANO_HERRAMIENTA' | 'EXTRAVIO_HERRAMIENTA' | 'DANO_PRODUCTO' | 'MERMA_BODEGA' | 'DANO' | 'PERDIDA' | 'MERMA' | 'OTRO' | string;

export interface Incident {
  id?: number;
  date: string;
  type: IncidentType;
  itemType: 'PRODUCTO' | 'HERRAMIENTA' | 'GENERAL';
  itemId?: number;
  itemCode: string;
  itemName: string;
  brand?: string;
  quantity?: number;
  costEstimated?: number;
  estimatedCost?: number;
  lossActFolio?: string;
  lossActSigned?: boolean;
  isWorkerAtFault?: boolean;
  faultType?: string;
  signatureData?: string;
  mermaReason?: 'VENCIMIENTO' | 'DANO_ROTURA' | 'DEFECTO_FABRICA' | 'MERMA_OPERACIONAL' | 'OTRO' | string;
  location: string;
  responsibleName: string;
  responsibleRut: string;
  responsiblePhone?: string;
  description: string;
  companyId?: string;
  photos?: string[];
  lossActPdfUrl?: string;
  resolutionStatus: 'PENDIENTE' | 'RESUELTO' | 'EN_REVISION' | 'ABIERTO' | string;
  resolutionNotes?: string;
  createdAt: string;
}

export type WorkerType = 'TRABAJADOR' | 'PROVEEDOR' | 'TRANSPORTISTA' | 'OTRO';

export interface Worker {
  id?: number;
  name: string;
  rut?: string;
  phone?: string;
  company?: string;
  role?: string;
  type: WorkerType;
  companyId?: string;
  createdAt: string;
}

export type PaymentMethod = 'EFECTIVO' | 'DEBITO' | 'CREDITO' | 'TRANSFERENCIA' | 'CHEQUE' | 'OTRO';

export type DTEType = 'BOLETA_ELECTRONICA' | 'FACTURA_ELECTRONICA' | 'BOLETA_EXENTA' | 'FACTURA_EXENTA' | 'TICKET_INTERNO';

export interface SaleItem {
  productId?: number;
  productCode: string;
  productName: string;
  quantity: number;
  unitPrice: number; // Precio con IVA incluido (o neto segun tipo)
  unitCost?: number;
  subtotal: number;
  discount?: number;
  unit?: string;
  isOffer?: boolean;
  originalPrice?: number;
  category?: string;
  isWeight?: boolean;
  weightUnit?: string;
}

export interface Sale {
  id?: number;
  folio: string;
  date: string;
  time?: string;
  companyId: string;
  companyName?: string;
  customerRut?: string;
  customerName?: string;
  customerBusiness?: string; // Giro
  customerAddress?: string;
  customerCity?: string;
  customerEmail?: string;
  customerPhone?: string;
  emailSentAt?: string;
  emailSentTo?: string;
  items: SaleItem[];
  subtotalNeto: number;
  iva: number;
  total: number;
  discountTotal?: number;
  paymentMethod: PaymentMethod;
  paymentReference?: string;
  amountPaid?: number;
  cashChange?: number;
  roundingDifference?: number;
  cashRoundedTotal?: number;
  dteType: DTEType;
  dteFolio?: string;
  siiStatus: 'EMITIDO' | 'ENVIADO_SII' | 'ACEPTADO_SII' | 'PENDIENTE' | 'SIMULADO' | 'RECHAZADO';
  siiTrackId?: string;
  siiTedTimbre?: string;
  siiResolution?: string;
  sellerName?: string;
  sellerUser?: string;
  status: 'COMPLETADA' | 'ANULADA';
  annulmentReason?: string;
  notes?: string;
  createdAt: string;
}

export interface SiiConfig {
  id?: number;
  companyId: string;
  rutEmisor: string;
  razonSocial: string;
  giro: string;
  acteco?: string;
  direccionOrigen: string;
  comunaOrigen: string;
  ciudadOrigen: string;
  telefono?: string;
  email?: string;
  environment: 'CERTIFICACION' | 'PRODUCCION';
  nextBoletaFolio: number;
  nextFacturaFolio: number;
  nextExentaFolio: number;
  resolucionNumero: string;
  resolucionFecha: string;
  apiToken?: string;
  apiEndpoint?: string;
  isAutoSendEnabled: boolean;
  updatedAt: string;
}

export interface CashClosing {
  id?: number;
  closingFolio: string;
  cashRegisterName?: string;
  cashRegisterNumber?: string;
  date: string;
  openedAt: string;
  closedAt: string;
  companyId: string;
  companyName?: string;
  responsibleName: string;
  initialCash: number;
  totalSales: number;
  salesCount: number;
  totalEfectivo: number;
  totalDebito: number;
  totalCredito: number;
  totalTransferencia: number;
  totalOtros: number;
  totalBoletas: number;
  totalFacturas: number;
  totalTickets: number;
  expectedCash: number;
  actualCash: number;
  cashDifference: number;
  notes?: string;
  status: 'CERRADA' | 'ABIERTA';
  createdAt: string;
}


export interface Supplier {
  id?: number;
  rut: string;
  name: string; // Razón Social o Nombre
  tradeName?: string; // Nombre Fantasía
  contactName?: string; // Contacto / Vendedor
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  industry?: string; // Giro
  paymentTerms?: string; // Ej: Contado, 30 días, 60 días
  notes?: string;
  companyId?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Customer {
  id?: number;
  rut: string;
  businessName: string; // Razón Social
  tradeName?: string; // Nombre Fantasía
  industry?: string; // Giro Comercial para Factura
  address?: string; // Dirección
  city?: string; // Comuna / Ciudad
  email?: string; // Email DTE
  phone?: string; // Teléfono
  contactName?: string; // Contacto
  companyId?: string;
  createdAt: string;
  updatedAt?: string;
}


export interface InventoryTakingSection {
  id: string;
  name: string; // ej: "Pasillo 1 - Abarrotes", "Estante 3 - Bebidas"
  zone?: string; // ej: "Sala de Ventas", "Bodega Trasera"
  teamName?: string; // ej: "Equipo A - Sala de Ventas"
  assignedWorkers: string[]; // Nombres de los trabajadores asignados
  status?: 'PENDIENTE' | 'EN_CONTEO' | 'COMPLETADO';
  companyId?: string;
  createdAt?: string;
}

export interface InventoryTakingCountItem {
  id?: number;
  sessionId?: string;
  sectionName: string;
  subLocation?: string; // ej: "Pasillo 1 - Estante 1", "Pasillo 1 - Estante 3"
  productCode: string;
  productName: string;
  category?: string;
  unit?: string;
  countedQuantity: number;
  systemStock?: number;
  workerName: string;
  countedAt: string;
  companyId?: string;
  notes?: string;
}

export interface InventoryTakingSession {
  id?: number;
  sessionCode: string;
  title: string;
  date: string;
  companyId?: string;
  status: 'ABIERTA' | 'CONSOLIDADA' | 'FINALIZADA';
  sections: InventoryTakingSection[];
  createdAt: string;
}
