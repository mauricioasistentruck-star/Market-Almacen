import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { useTheme } from '../../utils/themeContext';
import { useCompany } from '../../utils/companyContext';
import { useAuth } from '../../utils/authContext';
import { db } from '../../db/database';
import { BarcodeScannerModal } from '../BarcodeScannerModal';
import { useBodyScrollLock } from '../../utils/scrollLock';
import type { InventoryTakingSection, InventoryTakingCountItem, Product, Worker, ProductMovement } from '../../types';
import {
  ClipboardCheck,
  Camera,
  Search,
  Plus,
  Trash2,
  Download,
  Users,
  Layers,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  X,
  PlusCircle,
  MinusCircle,
  RefreshCw,
  Clock,
  UserCheck,
  ArrowRight,
  Edit3,
  Save,
  Printer,
  FileText,
  AlertCircle,
  MapPin,
  CheckSquare,
  Square,
  TrendingUp,
  Percent
} from 'lucide-react';

interface InventoryTakingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface StockChangeItem {
  productId?: number;
  code: string;
  name: string;
  category: string;
  previousStock: number;
  countedStock: number;
  difference: number;
  status: 'FALTANTE / MERMA' | 'SOBRANTE' | 'CORREGIDO';
  sections: string;
  workers: string;
  isCorrected?: boolean;
  correctionReason?: string;
}

interface RepeatedNotice {
  code: string;
  name: string;
  location: string;
  existingQty: number;
  worker: string;
  item: InventoryTakingCountItem;
}

export const InventoryTakingModal: React.FC<InventoryTakingModalProps> = ({
  isOpen,
  onClose
}) => {
  useBodyScrollLock(Boolean(isOpen));
  const { themeClasses } = useTheme();
  const { selectedCompanyId, selectedCompany } = useCompany();
  const { currentUser, isAdmin, isSuperAdmin } = useAuth();

  const isManager = isAdmin || isSuperAdmin;

  // Participación del Admin en el conteo
  const [adminParticipatesInCount, setAdminParticipatesInCount] = useState(false);

  // Pestañas:
  // Para Admin: 'teams' (por defecto), 'counting' (si participa), 'consolidate', 'changes'
  // Para Personal: 'counting' (única opción)
  const [activeTab, setActiveTab] = useState<'teams' | 'counting' | 'consolidate' | 'changes'>('teams');

  // Datos base
  const [catalogProducts, setCatalogProducts] = useState<Product[]>([]);
  const [sections, setSections] = useState<InventoryTakingSection[]>([]);
  const [workersList, setWorkersList] = useState<Worker[]>([]);
  const [allCountedItems, setAllCountedItems] = useState<InventoryTakingCountItem[]>([]);

  // Pestaña Conteo: Sección y Estante
  const [currentSectionName, setCurrentSectionName] = useState<string>('Pasillo 1 - Abarrotes y Conservas');
  const [currentSubLocation, setCurrentSubLocation] = useState<string>('Estante 1');
  const [scannedCodeInput, setScannedCodeInput] = useState('');
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  // Alerta de producto repetido en el mismo pasillo / estante + modal de edición directa
  const [repeatedProductNotice, setRepeatedProductNotice] = useState<RepeatedNotice | null>(null);
  const [inlineEditingItem, setInlineEditingItem] = useState<InventoryTakingCountItem | null>(null);
  const [inlineEditingQty, setInlineEditingQty] = useState<string>('');

  // Filtro de búsqueda en la tabla inferior de productos contados
  const [historySearchTerm, setHistorySearchTerm] = useState('');

  // Pestaña Equipos y Secciones (Admin)
  const [newSectionName, setNewSectionName] = useState('');
  const [newSectionZone, setNewSectionZone] = useState('Sala de Ventas');
  const [newSectionTeam, setNewSectionTeam] = useState('Equipo 1 - Sala de Ventas');
  const [newWorkerAssignment, setNewWorkerAssignment] = useState('');

  // Edición de Sección (Admin)
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editSecName, setEditSecName] = useState('');
  const [editSecZone, setEditSecZone] = useState('');
  const [editSecTeam, setEditSecTeam] = useState('');

  // Pestaña Consolidación y Sobrescritura (Admin)
  const [stockChangesReport, setStockChangesReport] = useState<StockChangeItem[] | null>(null);
  const [isApplyingStock, setIsApplyingStock] = useState(false);

  // Modal de corrección de supervisor tras sobrescribir
  const [editingItem, setEditingItem] = useState<StockChangeItem | null>(null);
  const [correctedQtyInput, setCorrectedQtyInput] = useState<string>('');
  const [correctionReasonInput, setCorrectionReasonInput] = useState<string>('');

  const todayStr = new Date().toISOString().slice(0, 10);
  const workerName = currentUser?.name || currentUser?.username || 'Personal de Turno';

  // Cargar datos
  const loadInitialData = async () => {
    try {
      // 1. Cargar productos
      const allProds = await db.products.toArray();
      const filteredProds = allProds.filter(p => !p.companyId || selectedCompanyId === 'ALL' || p.companyId === selectedCompanyId);
      setCatalogProducts(filteredProds);

      // 2. Cargar secciones
      const allSecs = await db.inventorySections.toArray();
      const filteredSecs = allSecs.filter(s => !s.companyId || selectedCompanyId === 'ALL' || s.companyId === selectedCompanyId);
      
      if (filteredSecs.length === 0) {
        const defaultSecs: InventoryTakingSection[] = [
          { id: 'sec-1', name: 'Pasillo 1 - Abarrotes y Conservas', zone: 'Sala de Ventas', teamName: 'Equipo 1', assignedWorkers: ['Juan Pérez'], status: 'EN_CONTEO', companyId: selectedCompanyId },
          { id: 'sec-2', name: 'Pasillo 2 - Bebidas y Licores', zone: 'Sala de Ventas', teamName: 'Equipo 1', assignedWorkers: ['Carlos Soto'], status: 'PENDIENTE', companyId: selectedCompanyId },
          { id: 'sec-3', name: 'Vitrina 1 - Cecinas y Fiambrería', zone: 'Fiambrería', teamName: 'Equipo 2', assignedWorkers: ['María González'], status: 'PENDIENTE', companyId: selectedCompanyId },
          { id: 'sec-4', name: 'Bodega Trasera - Pallets y Cajas', zone: 'Bodega Principal', teamName: 'Equipo Bodega', assignedWorkers: ['Pedro Ramos'], status: 'PENDIENTE', companyId: selectedCompanyId }
        ];
        for (const ds of defaultSecs) {
          await db.inventorySections.put(ds);
        }
        setSections(defaultSecs);
        setCurrentSectionName(defaultSecs[0].name);
      } else {
        setSections(filteredSecs);
        setCurrentSectionName(filteredSecs[0].name);
      }

      // 3. Cargar trabajadores
      const workers = await db.workers.toArray();
      setWorkersList(workers);

      // 4. Cargar conteos de la empresa
      const allCounts = await db.inventoryCounts.toArray();
      const myCounts = allCounts.filter(c => !c.companyId || selectedCompanyId === 'ALL' || c.companyId === selectedCompanyId);
      setAllCountedItems(myCounts);

      // Configurar pestaña inicial según rol
      if (isManager) {
        setActiveTab('teams');
      } else {
        setActiveTab('counting');
      }

    } catch (err) {
      console.error('Error cargando datos de toma de inventario:', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadInitialData();
      setStockChangesReport(null);
      setEditingItem(null);
      setNotification(null);
      setRepeatedProductNotice(null);
      setEditingSectionId(null);
      setInlineEditingItem(null);
    }
  }, [isOpen, selectedCompanyId]);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => {
      setNotification(null);
    }, 3200);
  };

  // Ubicación compuesta para el registro (ej: "Pasillo 1 - Abarrotes y Conservas - Estante 1")
  const fullLocationString = useMemo(() => {
    if (!currentSubLocation.trim()) return currentSectionName;
    return `${currentSectionName} - ${currentSubLocation.trim()}`;
  }, [currentSectionName, currentSubLocation]);

  // ----------------------------------------------------
  // MANEJO DE CONTEO Y ESCANEO EN TIEMPO REAL
  // ----------------------------------------------------
  const handleAddProductByCode = async (codeStr: string, qtyToAdd = 1) => {
    const clean = codeStr.trim();
    if (!clean) return;

    // Buscar en catálogo
    const matched = catalogProducts.find(p => p.code.toLowerCase() === clean.toLowerCase() || (p.mannFilterCode && p.mannFilterCode.toLowerCase() === clean.toLowerCase()));
    const prodName = matched ? matched.name : `Producto Código [${clean}]`;
    const prodCat = matched ? matched.category : 'General';
    const sysStock = matched ? (matched.stock || 0) : 0;

    // REGLA SOLICITADA: La alerta se debe generar cuando se cuente un producto repetido
    // en el MISMO pasillo o estante previamente registrado
    const existingInSameLocation = allCountedItems.find(it =>
      it.productCode.toLowerCase() === clean.toLowerCase() &&
      (it.subLocation || it.sectionName) === fullLocationString
    );

    let updatedList: InventoryTakingCountItem[] = [];

    if (existingInSameLocation) {
      // Activar alerta destacada de producto repetido en el mismo estante con opción de editar
      setRepeatedProductNotice({
        code: clean,
        name: prodName,
        location: fullLocationString,
        existingQty: existingInSameLocation.countedQuantity,
        worker: existingInSameLocation.workerName,
        item: existingInSameLocation
      });

      // Sumar la cantidad adicional
      const nextQty = existingInSameLocation.countedQuantity + qtyToAdd;
      updatedList = allCountedItems.map(it => it === existingInSameLocation ? {
        ...it,
        countedQuantity: nextQty,
        countedAt: new Date().toISOString()
      } : it);

      if (existingInSameLocation.id) {
        await db.inventoryCounts.update(existingInSameLocation.id, {
          countedQuantity: nextQty,
          countedAt: new Date().toISOString()
        });
      }

      showNotification(`⚠️ Repetido en este estante: ${prodName} (Ahora: ${nextQty} un.)`);
    } else {
      setRepeatedProductNotice(null);

      const newItem: InventoryTakingCountItem = {
        sectionName: currentSectionName,
        subLocation: fullLocationString,
        productCode: clean,
        productName: prodName,
        category: prodCat,
        countedQuantity: qtyToAdd,
        systemStock: sysStock,
        workerName,
        countedAt: new Date().toISOString(),
        companyId: selectedCompanyId !== 'ALL' ? selectedCompanyId : undefined
      };
      const newId = await db.inventoryCounts.add(newItem);
      newItem.id = newId;
      updatedList = [newItem, ...allCountedItems];

      showNotification(`✓ Contado: ${prodName} (+${qtyToAdd}) en ${fullLocationString}`);
    }

    setAllCountedItems(updatedList);
    setScannedCodeInput('');
  };

  // Guardar edición directa de cantidad (por si se equivocó al ingresar cantidades)
  const handleSaveInlineQuantity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inlineEditingItem) return;

    const newQty = parseFloat(inlineEditingQty);
    if (isNaN(newQty) || newQty < 0) {
      alert('Por favor ingrese una cantidad válida.');
      return;
    }

    if (newQty === 0) {
      handleDeleteItem(inlineEditingItem);
      setInlineEditingItem(null);
      setRepeatedProductNotice(null);
      return;
    }

    const updated = allCountedItems.map(it => it === inlineEditingItem ? {
      ...it,
      countedQuantity: newQty,
      countedAt: new Date().toISOString()
    } : it);

    setAllCountedItems(updated);

    if (inlineEditingItem.id) {
      await db.inventoryCounts.update(inlineEditingItem.id, {
        countedQuantity: newQty,
        countedAt: new Date().toISOString()
      });
    }

    // Actualizar también la alerta si corresponde al mismo ítem
    if (repeatedProductNotice && repeatedProductNotice.item.id === inlineEditingItem.id) {
      setRepeatedProductNotice({
        ...repeatedProductNotice,
        existingQty: newQty
      });
    }

    showNotification(`✓ Cantidad corregida a ${newQty} un. para ${inlineEditingItem.productName}`);
    setInlineEditingItem(null);
  };

  const handleUpdateItemQty = async (item: InventoryTakingCountItem, newQty: number) => {
    if (newQty <= 0) {
      handleDeleteItem(item);
      return;
    }
    const updated = allCountedItems.map(it => it === item ? { ...it, countedQuantity: newQty, countedAt: new Date().toISOString() } : it);
    setAllCountedItems(updated);
    if (item.id) {
      await db.inventoryCounts.update(item.id, { countedQuantity: newQty, countedAt: new Date().toISOString() });
    }
  };

  const handleDeleteItem = async (item: InventoryTakingCountItem) => {
    if (item.id) {
      await db.inventoryCounts.delete(item.id);
    }
    setAllCountedItems(allCountedItems.filter(it => it !== item));
    if (repeatedProductNotice && repeatedProductNotice.item.id === item.id) {
      setRepeatedProductNotice(null);
    }
  };

  // ----------------------------------------------------
  // GESTIÓN DE EQUIPOS Y SECCIONES (ADMIN)
  // ----------------------------------------------------
  const handleCreateSection = async () => {
    if (!newSectionName.trim()) {
      alert('Por favor ingrese el nombre del pasillo o sección.');
      return;
    }
    const newSec: InventoryTakingSection = {
      id: `sec-${Date.now()}`,
      name: newSectionName.trim(),
      zone: newSectionZone.trim() || 'Sala de Ventas',
      teamName: newSectionTeam.trim() || 'Equipo 1',
      assignedWorkers: newWorkerAssignment.trim() ? [newWorkerAssignment.trim()] : [],
      status: 'PENDIENTE',
      companyId: selectedCompanyId !== 'ALL' ? selectedCompanyId : undefined,
      createdAt: new Date().toISOString()
    };
    await db.inventorySections.put(newSec);
    setSections([...sections, newSec]);
    setNewSectionName('');
    setNewWorkerAssignment('');
    showNotification(`✓ Sección creada: ${newSec.name}`);
  };

  const handleStartEditingSection = (sec: InventoryTakingSection) => {
    setEditingSectionId(sec.id);
    setEditSecName(sec.name);
    setEditSecZone(sec.zone || 'Sala de Ventas');
    setEditSecTeam(sec.teamName || 'Equipo 1');
  };

  const handleSaveEditedSection = async (secId: string) => {
    if (!editSecName.trim()) return;
    const sec = sections.find(s => s.id === secId);
    if (!sec) return;

    const oldName = sec.name;
    const updatedSec: InventoryTakingSection = {
      ...sec,
      name: editSecName.trim(),
      zone: editSecZone.trim(),
      teamName: editSecTeam.trim()
    };

    await db.inventorySections.put(updatedSec);
    setSections(sections.map(s => s.id === secId ? updatedSec : s));

    // Si cambió el nombre, actualizar en los conteos existentes
    if (oldName !== updatedSec.name) {
      const countsToUpdate = allCountedItems.filter(c => c.sectionName === oldName);
      for (const count of countsToUpdate) {
        if (count.id) {
          const newSub = count.subLocation ? count.subLocation.replace(oldName, updatedSec.name) : updatedSec.name;
          await db.inventoryCounts.update(count.id, { sectionName: updatedSec.name, subLocation: newSub });
        }
      }
      setAllCountedItems(prev => prev.map(c => c.sectionName === oldName ? { ...c, sectionName: updatedSec.name } : c));
    }

    setEditingSectionId(null);
    showNotification(`✓ Pasillo actualizado: ${updatedSec.name}`);
  };

  const handleDeleteSection = async (secId: string) => {
    const sec = sections.find(s => s.id === secId);
    if (!sec) return;

    if (window.confirm(`¿Seguro que desea borrar el pasillo "${sec.name}"? Los conteos registrados en esta sección se mantendrán en el consolidado.`)) {
      await db.inventorySections.delete(secId);
      setSections(sections.filter(s => s.id !== secId));
      showNotification(`✓ Pasillo "${sec.name}" eliminado`);
    }
  };

  const handleAddWorkerToSection = async (secId: string, workerToAdd: string) => {
    if (!workerToAdd.trim()) return;
    const sec = sections.find(s => s.id === secId);
    if (!sec) return;

    if (sec.assignedWorkers.includes(workerToAdd.trim())) {
      alert(`El trabajador "${workerToAdd}" ya está asignado a esta sección.`);
      return;
    }

    const updatedSec: InventoryTakingSection = {
      ...sec,
      assignedWorkers: [...sec.assignedWorkers, workerToAdd.trim()]
    };

    await db.inventorySections.put(updatedSec);
    setSections(sections.map(s => s.id === secId ? updatedSec : s));
    showNotification(`✓ ${workerToAdd} asignado a ${sec.name}`);
  };

  const handleRemoveWorkerFromSection = async (secId: string, workerToRemove: string) => {
    const sec = sections.find(s => s.id === secId);
    if (!sec) return;

    const updatedSec: InventoryTakingSection = {
      ...sec,
      assignedWorkers: sec.assignedWorkers.filter(w => w !== workerToRemove)
    };

    await db.inventorySections.put(updatedSec);
    setSections(sections.map(s => s.id === secId ? updatedSec : s));
    showNotification(`✓ ${workerToRemove} desasignado`);
  };

  // ----------------------------------------------------
  // CONSOLIDACIÓN EN TIEMPO REAL PARA EL ADMIN
  // ----------------------------------------------------
  const consolidationData = useMemo(() => {
    if (allCountedItems.length === 0) return null;

    const consolidationMap: Record<string, {
      code: string;
      name: string;
      category: string;
      totalCounted: number;
      locationsFound: Record<string, number>;
      workers: Set<string>;
    }> = {};

    allCountedItems.forEach(item => {
      const code = item.productCode.trim();
      const codeKey = code.toLowerCase();
      const qty = item.countedQuantity || 0;
      const loc = item.subLocation || item.sectionName || 'General';

      if (!consolidationMap[codeKey]) {
        const inCat = catalogProducts.find(p => p.code.toLowerCase() === codeKey);
        consolidationMap[codeKey] = {
          code,
          name: (inCat && inCat.name) ? inCat.name : item.productName,
          category: (inCat && inCat.category) ? inCat.category : (item.category || 'General'),
          totalCounted: 0,
          locationsFound: {},
          workers: new Set<string>()
        };
      }

      consolidationMap[codeKey].totalCounted += qty;
      consolidationMap[codeKey].locationsFound[loc] = (consolidationMap[codeKey].locationsFound[loc] || 0) + qty;
      if (item.workerName) consolidationMap[codeKey].workers.add(item.workerName);
    });

    let mermasCount = 0;
    let sobrantesCount = 0;
    let totalFisicoSum = 0;

    const items = Object.values(consolidationMap).map((item, idx) => {
      const inCat = catalogProducts.find(p => p.code.toLowerCase() === item.code.toLowerCase());
      const stockTeorico = inCat ? (inCat.stock || 0) : 0;
      const diferencia = item.totalCounted - stockTeorico;

      if (diferencia < 0) mermasCount++;
      else if (diferencia > 0) sobrantesCount++;

      totalFisicoSum += item.totalCounted;

      const ubicacionesDetalle = Object.entries(item.locationsFound)
        .map(([locName, locQty]) => `${locName} (${locQty} un.)`)
        .join(', ');

      const trabajadoresDetalle = Array.from(item.workers).join(', ');

      return {
        'N°': idx + 1,
        'Código de Barra': item.code,
        'Nombre del Producto': item.name,
        'Categoría': item.category,
        'CANTIDAD TOTAL CONTADA': item.totalCounted,
        'Stock Teórico en Sistema': stockTeorico,
        'Diferencia (+/-)': diferencia,
        'Estado': diferencia === 0 ? 'CUADRADO' : diferencia < 0 ? 'FALTANTE / MERMA' : 'SOBRANTE',
        'Ubicaciones donde se encontró': ubicacionesDetalle,
        'Personal Responsable': trabajadoresDetalle
      };
    });

    return {
      uniqueProducts: Object.keys(consolidationMap).length,
      totalUnits: totalFisicoSum,
      totalMermas: mermasCount,
      totalSobrantes: sobrantesCount,
      items
    };
  }, [allCountedItems, catalogProducts]);

  // PORCENTAJE DE AVANCE EN TIEMPO REAL (ADMIN)
  const progressStats = useMemo(() => {
    const totalRegistered = catalogProducts.length;
    const uniqueCounted = consolidationData ? consolidationData.uniqueProducts : 0;
    const percentage = totalRegistered > 0 ? Math.min(100, (uniqueCounted / totalRegistered) * 100) : 0;
    return {
      totalRegistered,
      uniqueCounted,
      percentage: percentage.toFixed(1),
      numericPercent: percentage
    };
  }, [catalogProducts.length, consolidationData]);

  // ----------------------------------------------------
  // EXCEL CONSOLIDADO EN TIEMPO REAL CON HOJAS POR TRABAJADOR Y ESTANTES
  // ----------------------------------------------------
  const handleDownloadConsolidatedExcel = () => {
    if (!consolidationData || consolidationData.items.length === 0) {
      alert('No hay conteos registrados para generar el Excel consolidado.');
      return;
    }

    const wb = XLSX.utils.book_new();

    // 1. HOJA PRINCIPAL: CONSOLIDADO GENERAL MAESTRO
    const wsGeneral = XLSX.utils.json_to_sheet(consolidationData.items);
    XLSX.utils.book_append_sheet(wb, wsGeneral, 'Consolidado_General');

    // 2. HOJAS INDIVIDUALES POR CADA PERSONA A CARGO (AUDITORÍA DE RESPONSABILIDADES)
    const distinctWorkers = Array.from(new Set(allCountedItems.map(it => it.workerName).filter(Boolean)));

    distinctWorkers.forEach((wName) => {
      const itemsOfWorker = allCountedItems.filter(it => it.workerName === wName);
      if (itemsOfWorker.length > 0) {
        const rowsWorker = itemsOfWorker.map((it, idx) => ({
          'N°': idx + 1,
          'Persona a Cargo': it.workerName,
          'Pasillo / Sección': it.sectionName,
          'Estante / Sub-Ubicación': it.subLocation || it.sectionName,
          'Código de Barra': it.productCode,
          'Nombre del Producto': it.productName,
          'Categoría': it.category || 'General',
          'Cantidad Contada': it.countedQuantity,
          'Fecha y Hora Conteo': new Date(it.countedAt).toLocaleString('es-CL')
        }));

        const wsWorker = XLSX.utils.json_to_sheet(rowsWorker);
        // Sanitizar nombre de hoja para Excel (máximo 31 caracteres, caracteres válidos)
        let sheetTitle = `Conteo_${wName.replace(/[\/\\\?\*\]\[:]/g, '_').replace(/\s+/g, '_')}`;
        if (sheetTitle.length > 31) sheetTitle = sheetTitle.substring(0, 31);

        XLSX.utils.book_append_sheet(wb, wsWorker, sheetTitle);
      }
    });

    // 3. HOJA DE DESGLOSE POR PASILLO Y ESTANTE
    const rowsLocations = allCountedItems.map((it, idx) => ({
      'N°': idx + 1,
      'Pasillo / Sección': it.sectionName,
      'Estante / Sub-Ubicación': it.subLocation || it.sectionName,
      'Persona Responsable': it.workerName,
      'Código de Barra': it.productCode,
      'Nombre del Producto': it.productName,
      'Categoría': it.category || 'General',
      'Cantidad Contada': it.countedQuantity,
      'Fecha y Hora': new Date(it.countedAt).toLocaleString('es-CL')
    }));
    const wsLocations = XLSX.utils.json_to_sheet(rowsLocations);
    XLSX.utils.book_append_sheet(wb, wsLocations, 'Detalle_Estantes_Pasillos');

    const cleanCompany = (selectedCompany?.name || 'Local').replace(/[^a-zA-Z0-9]/g, '_');
    const fileName = `Inventario_Consolidado_Multiojas_${cleanCompany}_${todayStr}.xlsx`;
    XLSX.writeFile(wb, fileName);

    showNotification(`📥 Archivo ${fileName} descargado con hojas individuales por trabajador.`);
  };

  // ----------------------------------------------------
  // SOBRESCRITURA DE INVENTARIO EN SISTEMA (ADMIN)
  // ----------------------------------------------------
  const handleOverwriteStock = async () => {
    if (!consolidationData || consolidationData.items.length === 0) {
      alert('No hay datos consolidados para sobrescribir en el inventario.');
      return;
    }

    const confirmMsg = `⚠️ ATENCIÓN ADMINISTRADOR:\n\n` +
      `Se van a SOBRESCRIBIR las existencias de ${consolidationData.uniqueProducts} productos en el sistema con un total de ${consolidationData.totalUnits} unidades contadas físicamente.\n\n` +
      `Las cantidades anteriores serán REEMPLAZADAS directamente por lo contado físicamente (NO SE SUMAN).\n\n` +
      `¿Desea proceder con la actualización de stock en la base de datos?`;

    if (!window.confirm(confirmMsg)) return;

    setIsApplyingStock(true);

    try {
      const changesReport: StockChangeItem[] = [];

      for (const row of consolidationData.items) {
        const code = row['Código de Barra'];
        const countedQty = row['CANTIDAD TOTAL CONTADA'];
        const inCat = catalogProducts.find(p => p.code.toLowerCase() === code.toLowerCase());

        if (inCat && inCat.id) {
          const previousStock = inCat.stock || 0;
          const diff = countedQty - previousStock;

          // Sobrescribir directamente en la base de datos
          await db.products.update(inCat.id, {
            stock: countedQty
          });

          // Registrar movimiento de auditoría
          if (diff !== 0) {
            const movement: ProductMovement = {
              productId: inCat.id,
              productCode: inCat.code,
              productName: inCat.name,
              type: 'AJUSTE',
              quantity: Math.abs(diff),
              reason: `Toma de Inventario Física: Sobrescritura de stock anterior (${previousStock}) por nuevo conteo (${countedQty})`,
              date: new Date().toISOString(),
              companyId: selectedCompanyId !== 'ALL' ? selectedCompanyId : undefined
            };
            await db.productMovements.add(movement);

            changesReport.push({
              productId: inCat.id,
              code: inCat.code,
              name: inCat.name,
              category: inCat.category || 'General',
              previousStock,
              countedStock: countedQty,
              difference: diff,
              status: diff < 0 ? 'FALTANTE / MERMA' : 'SOBRANTE',
              sections: row['Ubicaciones donde se encontró'],
              workers: row['Personal Responsable']
            });
          }
        }
      }

      // Recargar catálogo actualizado
      const reloaded = await db.products.toArray();
      setCatalogProducts(reloaded.filter(p => !p.companyId || selectedCompanyId === 'ALL' || p.companyId === selectedCompanyId));

      setStockChangesReport(changesReport);
      setActiveTab('changes');
      setIsApplyingStock(false);

      alert(`✅ Inventario sobrescrito con éxito!\n\nSe actualizaron las cantidades en la base de datos.\nSe encontraron ${changesReport.length} productos con cambio de stock para su revisión inmediata.`);
    } catch (err: any) {
      console.error('Error sobrescribiendo inventario:', err);
      alert('Error al sobrescribir inventario: ' + err.message);
      setIsApplyingStock(false);
    }
  };

  // Guardar corrección individual de stock por el supervisor
  const handleSaveCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem || !editingItem.productId) return;

    const newQty = parseFloat(correctedQtyInput);
    if (isNaN(newQty) || newQty < 0) {
      alert('Por favor ingrese una cantidad válida (mayor o igual a 0).');
      return;
    }

    try {
      await db.products.update(editingItem.productId, {
        stock: newQty
      });

      const movement: ProductMovement = {
        productId: editingItem.productId,
        productCode: editingItem.code,
        productName: editingItem.name,
        type: 'AJUSTE',
        quantity: Math.abs(newQty - editingItem.previousStock),
        reason: `Corrección Supervisor en Toma de Inventario: ${correctionReasonInput.trim() || 'Ajuste revisado por jefatura'} (de ${editingItem.countedStock} a ${newQty})`,
        date: new Date().toISOString(),
        companyId: selectedCompanyId !== 'ALL' ? selectedCompanyId : undefined
      };
      await db.productMovements.add(movement);

      if (stockChangesReport) {
        const updatedReport = stockChangesReport.map(item => {
          if (item.code === editingItem.code) {
            return {
              ...item,
              countedStock: newQty,
              difference: newQty - item.previousStock,
              status: 'CORREGIDO' as const,
              isCorrected: true,
              correctionReason: correctionReasonInput.trim() || 'Corregido por supervisor'
            };
          }
          return item;
        });
        setStockChangesReport(updatedReport);
      }

      setEditingItem(null);
      showNotification(`✓ Stock de "${editingItem.name}" corregido a ${newQty} unidades.`);
    } catch (err: any) {
      alert('Error al guardar corrección: ' + err.message);
    }
  };

  // Exportar Excel de cambios de stock
  const handleExportStockChangesExcel = () => {
    if (!stockChangesReport || stockChangesReport.length === 0) return;

    const dataRows = stockChangesReport.map((it, idx) => ({
      'N°': idx + 1,
      'Código de Barra': it.code,
      'Nombre del Producto': it.name,
      'Categoría': it.category,
      'Stock Anterior en Sistema': it.previousStock,
      'Nuevo Stock Sobrescrito': it.countedStock,
      'Diferencia (+/-)': it.difference,
      'Estado': it.isCorrected ? '✓ CORREGIDO POR SUPERVISOR' : it.status,
      'Personal que Contó': it.workers,
      'Secciones / Estantes': it.sections,
      'Motivo Corrección': it.correctionReason || 'N/A'
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(dataRows);
    XLSX.utils.book_append_sheet(wb, ws, 'Cambios_Stock');

    const fileName = `Informe_Cambios_Stock_Inventario_${todayStr}.xlsx`;
    XLSX.writeFile(wb, fileName);
    showNotification(`📥 Archivo ${fileName} descargado con éxito.`);
  };

  // Filtrado de productos contados en la tabla inferior
  const filteredCountedItems = useMemo(() => {
    if (!historySearchTerm.trim()) return allCountedItems;
    const term = historySearchTerm.toLowerCase();
    return allCountedItems.filter(it =>
      it.productCode.toLowerCase().includes(term) ||
      it.productName.toLowerCase().includes(term) ||
      (it.subLocation || it.sectionName).toLowerCase().includes(term) ||
      it.workerName.toLowerCase().includes(term)
    );
  }, [allCountedItems, historySearchTerm]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className={`w-full max-w-5xl rounded-3xl border-2 ${themeClasses.border} ${themeClasses.card} shadow-2xl flex flex-col max-h-[95vh] overflow-hidden`}>
        
        {/* ENCABEZADO */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/40 bg-slate-100 dark:bg-slate-900 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-blue-600 text-white shadow-md">
              <ClipboardCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-black text-base sm:text-lg text-slate-900 dark:text-white">
                  Toma de Inventario Física del Local
                </h3>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-300 font-extrabold border border-blue-500/30">
                  {selectedCompany?.name || 'Local'}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-bold flex items-center gap-1.5 mt-0.5">
                <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
                <span>Registrando como: <strong className="text-slate-800 dark:text-slate-200">{workerName}</strong></span>
                <span>• Rol: <strong>{(isAdmin || isSuperAdmin) ? 'Administrador' : 'Personal de Ventas'}</strong></span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* BARRA DE AVANCE EN TIEMPO REAL EXCLUSIVA PARA EL ADMINISTRADOR */}
        {isManager && (
          <div className="px-5 py-2.5 bg-gradient-to-r from-blue-900/90 to-indigo-900/90 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-blue-700/50 shadow-inner shrink-0">
            <div className="flex items-center gap-2.5">
              <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0" />
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <span className="font-bold text-blue-200">Avance de Inventario en Tiempo Real:</span>
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-black border border-emerald-500/40 text-xs">
                  {progressStats.percentage}% de Catálogo
                </span>
                <span className="text-[11px] text-blue-200">
                  ({progressStats.uniqueCounted} de {progressStats.totalRegistered} productos registrados contados)
                </span>
              </div>
            </div>

            {/* Barra Visual de Progreso */}
            <div className="flex items-center gap-2 w-full sm:w-64 shrink-0">
              <div className="flex-1 h-2.5 rounded-full bg-blue-950/80 border border-blue-600/40 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-400 to-teal-300 transition-all duration-500 rounded-full"
                  style={{ width: `${progressStats.numericPercent}%` }}
                />
              </div>
              <span className="text-[11px] font-black text-emerald-300 w-10 text-right">
                {progressStats.percentage}%
              </span>
            </div>
          </div>
        )}

        {/* PESTAÑAS DE NAVEGACIÓN */}
        {isManager ? (
          <div className="flex items-center gap-1 px-5 pt-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 shrink-0 overflow-x-auto">
            {/* 1. Equipos y Secciones (Menú principal para Admin) */}
            <button
              type="button"
              onClick={() => setActiveTab('teams')}
              className={`px-4 py-2.5 text-xs font-black rounded-t-xl transition flex items-center gap-2 border-b-2 cursor-pointer shrink-0 ${
                activeTab === 'teams'
                  ? 'border-purple-600 text-purple-600 dark:text-purple-400 bg-white dark:bg-slate-800/80 shadow-xs'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>👥 Equipos y Secciones</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-bold">
                {sections.length}
              </span>
            </button>

            {/* 2. Conteo de Sección (Visible para Admin solo si participa en el conteo) */}
            {adminParticipatesInCount && (
              <button
                type="button"
                onClick={() => setActiveTab('counting')}
                className={`px-4 py-2.5 text-xs font-black rounded-t-xl transition flex items-center gap-2 border-b-2 cursor-pointer shrink-0 ${
                  activeTab === 'counting'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-800/80 shadow-xs'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>📝 Conteo de Sección</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold">
                  {allCountedItems.filter(it => it.workerName === workerName).length} ítems
                </span>
              </button>
            )}

            {/* 3. Consolidar y Sobrescribir (Admin) */}
            <button
              type="button"
              onClick={() => setActiveTab('consolidate')}
              className={`px-4 py-2.5 text-xs font-black rounded-t-xl transition flex items-center gap-2 border-b-2 cursor-pointer shrink-0 ${
                activeTab === 'consolidate'
                  ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 bg-white dark:bg-slate-800/80 shadow-xs'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>📊 Consolidar y Sobrescribir</span>
              {allCountedItems.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold">
                  {allCountedItems.length} registrados
                </span>
              )}
            </button>

            {/* 4. Cambios de Stock */}
            {stockChangesReport && stockChangesReport.length > 0 && (
              <button
                type="button"
                onClick={() => setActiveTab('changes')}
                className={`px-4 py-2.5 text-xs font-black rounded-t-xl transition flex items-center gap-2 border-b-2 cursor-pointer shrink-0 ${
                  activeTab === 'changes'
                    ? 'border-red-600 text-red-600 dark:text-red-400 bg-white dark:bg-slate-800/80 shadow-xs'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <AlertCircle className="w-4 h-4 text-red-500" />
                <span>📋 Cambios de Stock ({stockChangesReport.length})</span>
              </button>
            )}
          </div>
        ) : (
          <div className="px-5 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-blue-50/40 dark:bg-blue-950/20 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-black text-blue-700 dark:text-blue-300">
              <Layers className="w-4 h-4" />
              <span>📝 Mi Conteo de Sección</span>
            </div>
            <span className="text-xs font-bold text-slate-500">
              Personal Asignado: <strong className="text-slate-800 dark:text-slate-200">{workerName}</strong>
            </span>
          </div>
        )}

        {/* NOTIFICACIÓN FLOTANTE */}
        {notification && (
          <div className="mx-5 mt-2 p-2 rounded-xl bg-emerald-600 text-white text-xs font-bold flex items-center gap-2 animate-fadeIn shadow-md shrink-0">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{notification}</span>
          </div>
        )}

        {/* CONTENIDO DE LAS PESTAÑAS */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          
          {/* ======================================================== */}
          {/* PESTAÑA 1 (ADMIN): EQUIPOS Y SECCIONES (MENÚ PRINCIPAL) */}
          {/* ======================================================== */}
          {activeTab === 'teams' && isManager && (
            <div className="space-y-4">
              
              {/* Opción de Participación del Admin en el Conteo */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 border border-blue-200 dark:border-blue-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                <div>
                  <h4 className="font-black text-sm text-blue-950 dark:text-blue-200 flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-blue-600" />
                    <span>Participación del Administrador en la Toma de Inventario</span>
                  </h4>
                  <p className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">
                    {adminParticipatesInCount
                      ? '✓ Usted está participando activamente en el conteo físico. Tiene habilitada la pestaña "Conteo de Sección".'
                      : 'Si desea salir a contar junto al personal, actívelo para asignarse un pasillo o estante.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const nextState = !adminParticipatesInCount;
                    setAdminParticipatesInCount(nextState);
                    if (nextState) {
                      showNotification('✓ Pestaña "Conteo de Sección" habilitada para el Administrador.');
                    }
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-2 shadow-xs shrink-0 ${
                    adminParticipatesInCount
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 border border-blue-300 dark:border-blue-700 hover:bg-blue-50'
                  }`}
                >
                  {adminParticipatesInCount ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                  <span>{adminParticipatesInCount ? 'Participando en Conteo (Activo)' : '+ Participar en Conteo'}</span>
                </button>
              </div>

              {/* Formulario Crear Nueva Sección / Pasillo con Equipo y Personal */}
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3 shadow-xs">
                <h5 className="font-black text-xs uppercase text-slate-500 tracking-wider">
                  + Crear Nuevo Pasillo / Sección y Asignar Personal:
                </h5>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">Nombre del Pasillo / Estante *</label>
                    <input
                      type="text"
                      value={newSectionName}
                      onChange={(e) => setNewSectionName(e.target.value)}
                      placeholder="Ej: Pasillo 3 - Lácteos"
                      className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">Zona del Local</label>
                    <input
                      type="text"
                      value={newSectionZone}
                      onChange={(e) => setNewSectionZone(e.target.value)}
                      placeholder="Ej: Sala de Ventas, Altillo"
                      className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">Equipo de Trabajo</label>
                    <input
                      type="text"
                      value={newSectionTeam}
                      onChange={(e) => setNewSectionTeam(e.target.value)}
                      placeholder="Ej: Equipo 1, Equipo Mañana"
                      className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none"
                    />
                  </div>

                  <div className="flex flex-col justify-end">
                    <button
                      type="button"
                      onClick={handleCreateSection}
                      className="w-full px-4 py-2 text-xs font-black rounded-xl bg-purple-600 hover:bg-purple-700 text-white transition cursor-pointer flex items-center justify-center gap-1.5 shadow-md active:scale-95"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Crear Pasillo</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Listado de Pasillos y Secciones Generados (Con Editar, Borrar y Asignar) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="font-black text-xs uppercase text-slate-500 tracking-wider">
                    Pasillos y Secciones del Local ({sections.length}):
                  </h5>
                  <span className="text-[11px] font-bold text-slate-400">
                    Edite el nombre, borre pasillos o asigne trabajadores para esta tarea
                  </span>
                </div>

                <div className="space-y-2.5">
                  {sections.map((sec) => {
                    const isEditing = editingSectionId === sec.id;
                    const itemsInSec = allCountedItems.filter(it => it.sectionName === sec.name);
                    const totalUnits = itemsInSec.reduce((acc, it) => acc + it.countedQuantity, 0);

                    if (isEditing) {
                      return (
                        <div key={sec.id} className="p-4 rounded-2xl border-2 border-purple-500 bg-purple-50/20 dark:bg-purple-950/20 space-y-3">
                          <h6 className="font-black text-xs text-purple-900 dark:text-purple-300">Editar Información del Pasillo:</h6>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Nombre:</label>
                              <input
                                type="text"
                                value={editSecName}
                                onChange={(e) => setEditSecName(e.target.value)}
                                className="w-full px-3 py-1.5 text-xs font-bold rounded-xl border border-purple-400 bg-white dark:bg-slate-900"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Zona:</label>
                              <input
                                type="text"
                                value={editSecZone}
                                onChange={(e) => setEditSecZone(e.target.value)}
                                className="w-full px-3 py-1.5 text-xs font-bold rounded-xl border border-purple-400 bg-white dark:bg-slate-900"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Equipo:</label>
                              <input
                                type="text"
                                value={editSecTeam}
                                onChange={(e) => setEditSecTeam(e.target.value)}
                                className="w-full px-3 py-1.5 text-xs font-bold rounded-xl border border-purple-400 bg-white dark:bg-slate-900"
                              />
                            </div>
                          </div>
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingSectionId(null)}
                              className="px-3 py-1 text-xs font-bold text-slate-600 hover:text-slate-900"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSaveEditedSection(sec.id)}
                              className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center gap-1"
                            >
                              <Save className="w-3.5 h-3.5" />
                              <span>Guardar Cambios</span>
                            </button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={sec.id}
                        className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs hover:border-slate-300 transition"
                      >
                        <div className="space-y-1.5 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h5 className="font-black text-sm text-slate-900 dark:text-white">{sec.name}</h5>
                            {sec.zone && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold">
                                {sec.zone}
                              </span>
                            )}
                            {sec.teamName && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-extrabold border border-purple-300 dark:border-purple-800">
                                👥 {sec.teamName}
                              </span>
                            )}
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                              itemsInSec.length > 0 ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                            }`}>
                              {itemsInSec.length > 0 ? 'EN PROCESO' : 'PENDIENTE'}
                            </span>
                          </div>

                          {/* Personal Asignado a esta sección */}
                          <div className="flex items-center gap-1.5 flex-wrap text-xs">
                            <span className="text-[11px] font-bold text-slate-500">Personal asignado:</span>
                            {sec.assignedWorkers && sec.assignedWorkers.length > 0 ? (
                              sec.assignedWorkers.map((wName) => (
                                <span
                                  key={wName}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold text-[11px] border border-blue-200 dark:border-blue-800"
                                >
                                  <span>👤 {wName}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveWorkerFromSection(sec.id, wName)}
                                    className="hover:text-red-500 ml-0.5 cursor-pointer"
                                    title="Quitar trabajador"
                                  >
                                    ×
                                  </button>
                                </span>
                              ))
                            ) : (
                              <span className="text-slate-400 italic text-[11px]">Sin personal asignado aún</span>
                            )}

                            {/* Selector rápido para añadir trabajador registrado */}
                            <select
                              onChange={(e) => {
                                if (e.target.value) {
                                  handleAddWorkerToSection(sec.id, e.target.value);
                                  e.target.value = '';
                                }
                              }}
                              defaultValue=""
                              className="text-[11px] px-2 py-0.5 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
                            >
                              <option value="" disabled>+ Asignar Trabajador...</option>
                              {workersList.map(w => (
                                <option key={w.id} value={w.name}>{w.name} ({w.role})</option>
                              ))}
                              <option value={workerName}>Yo ({workerName})</option>
                            </select>
                          </div>
                        </div>

                        {/* Botones de acción por pasillo */}
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="text-right mr-2 hidden sm:block">
                            <span className="text-[10px] uppercase text-slate-400 block font-bold">Conteo:</span>
                            <span className="font-black text-blue-600 dark:text-blue-400 text-xs">{itemsInSec.length} prods ({totalUnits} un.)</span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleStartEditingSection(sec)}
                            className="p-2 rounded-xl text-slate-500 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/50 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                            title="Editar nombre o zona del pasillo"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteSection(sec.id)}
                            className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                            title="Borrar pasillo"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setCurrentSectionName(sec.name);
                              setAdminParticipatesInCount(true);
                              setActiveTab('counting');
                            }}
                            className="px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-xs font-black hover:bg-blue-100 transition cursor-pointer"
                          >
                            Contar Aquí →
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          )}

          {/* ======================================================== */}
          {/* PESTAÑA: MI CONTEO DE SECCIÓN (PERSONAL / ADMIN)         */}
          {/* ======================================================== */}
          {activeTab === 'counting' && (!isManager || adminParticipatesInCount) && (
            <div className="space-y-4">
              
              {/* Barra de Selección de Sección y Estante Específico (Sin botón de descargar Excel) */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3 shadow-xs">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                  
                  {/* Selector de Pasillo / Sección Asignada */}
                  <div className="sm:col-span-7">
                    <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1 uppercase tracking-wider">
                      PASILLO O SECCIÓN ASIGNADA A CONTAR:
                    </label>
                    <select
                      value={currentSectionName}
                      onChange={(e) => setCurrentSectionName(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-black rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {sections.map((s) => (
                        <option key={s.id} value={s.name}>
                          {s.name} {s.zone ? `(${s.zone})` : ''} {s.teamName ? `— 👥 ${s.teamName}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Subdivisión de Estante / Lugar Específico Contado */}
                  <div className="sm:col-span-5">
                    <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1 uppercase tracking-wider">
                      ESTANTE O LUGAR ESPECÍFICO (SUBDIVISIÓN):
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={currentSubLocation}
                        onChange={(e) => setCurrentSubLocation(e.target.value)}
                        placeholder="Ej: Estante 1, Estante 3, Cabecera..."
                        className="w-full px-3 py-2 text-xs font-black rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                </div>

                {/* Título Oficial del Lugar Contado */}
                <div className="p-2.5 rounded-xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-blue-600 shrink-0" />
                    <span className="font-bold text-slate-600 dark:text-slate-300">Ubicación de Conteo Activa:</span>
                    <strong className="text-blue-700 dark:text-blue-300 text-xs font-black">{fullLocationString}</strong>
                  </div>
                  <span className="text-[11px] font-bold text-slate-500">
                    Responsable: <strong className="text-slate-800 dark:text-slate-200">{workerName}</strong>
                  </span>
                </div>
              </div>

              {/* Área de Pistoleo y Lector por Cámara */}
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border-2 border-dashed border-blue-400/80 dark:border-blue-600/60 space-y-3">
                <div className="flex flex-col sm:flex-row items-center gap-2.5">
                  <div className="relative flex-1 w-full">
                    <input
                      type="text"
                      value={scannedCodeInput}
                      onChange={(e) => setScannedCodeInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddProductByCode(scannedCodeInput, 1);
                        }
                      }}
                      placeholder="Pistolee código de barra láser o escriba código aquí..."
                      className="w-full px-4 py-2.5 text-xs sm:text-sm font-bold font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      autoFocus
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => handleAddProductByCode(scannedCodeInput, 1)}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-black text-xs transition cursor-pointer shadow-md shrink-0 flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>+ Sumar 1</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsCameraOpen(true)}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 active:scale-95 text-white font-black text-xs transition cursor-pointer shadow-md shrink-0 flex items-center justify-center gap-1.5"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Escanear con Cámara</span>
                  </button>
                </div>

                <p className="text-[11px] text-slate-500 font-bold flex items-center gap-1.5">
                  <span>💡 Pistolear o escanear el mismo código incrementa las cantidades en este estante.</span>
                </p>

                {/* ALERTA: PRODUCTO REPETIDO EN EL MISMO PASILLO / ESTANTE CON OPCIÓN DE EDITAR CANTIDADES */}
                {repeatedProductNotice && (
                  <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border-2 border-amber-500 text-amber-950 dark:text-amber-100 text-xs font-bold animate-fadeIn space-y-2 shadow-sm">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 font-black text-amber-800 dark:text-amber-300">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>⚠️ PRODUCTO REPETIDO EN ESTE MISMO PASILLO O ESTANTE</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setInlineEditingItem(repeatedProductNotice.item);
                          setInlineEditingQty(repeatedProductNotice.existingQty.toString());
                        }}
                        className="px-3 py-1 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white rounded-xl font-black text-xs transition flex items-center gap-1 cursor-pointer shadow-xs"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>✏️ Corregir / Editar Cantidad de este Estante</span>
                      </button>
                    </div>

                    <p className="text-amber-900 dark:text-amber-200">
                      El producto <strong>{repeatedProductNotice.name}</strong> [{repeatedProductNotice.code}] ya contaba con <strong>{repeatedProductNotice.existingQty} unidades registradas</strong> previamente en esta misma ubicación (<strong>{repeatedProductNotice.location}</strong>).
                    </p>
                    <p className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">
                      Si el trabajador contó por error o digitó mal la cantidad, presione el botón <strong>"Corregir / Editar Cantidad"</strong> para sobrescribir directamente el número correcto en vez de sumar duplicados.
                    </p>
                  </div>
                )}
              </div>

              {/* ========================================================================= */}
              {/* CUADRO INFERIOR: HISTORIAL DE PRODUCTOS YA CONTADOS CON SU UBICACIÓN      */}
              {/* ========================================================================= */}
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
                      <ClipboardCheck className="w-4 h-4 text-blue-600" />
                      <span>Productos Ya Contados en el Local ({allCountedItems.length} registros)</span>
                    </h4>
                    <p className="text-xs text-slate-500 font-medium">
                      Registro en tiempo real con su respectiva ubicación. Si un producto aparece repetido, puede editarlo directamente.
                    </p>
                  </div>

                  {/* Buscador Rápido en el Historial */}
                  <div className="relative w-full sm:w-64">
                    <input
                      type="text"
                      value={historySearchTerm}
                      onChange={(e) => setHistorySearchTerm(e.target.value)}
                      placeholder="Buscar producto o estante..."
                      className="w-full pl-8 pr-3 py-1.5 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none"
                    />
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                {filteredCountedItems.length === 0 ? (
                  <div className="p-8 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
                    <Layers className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto" />
                    <p className="text-xs font-bold text-slate-500">No hay productos contados todavía en esta búsqueda.</p>
                    <p className="text-[11px] text-slate-400">Pistolee un código con el lector o escanee con la cámara para comenzar.</p>
                  </div>
                ) : (
                  <div className="max-h-72 overflow-y-auto pr-1 space-y-1.5 scrollbar-thin">
                    {filteredCountedItems.map((item, idx) => {
                      const isCurrentLocation = (item.subLocation || item.sectionName) === fullLocationString;
                      return (
                        <div
                          key={item.id || idx}
                          className={`p-2.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition text-xs ${
                            isCurrentLocation
                              ? 'border-blue-300 dark:border-blue-800 bg-blue-50/40 dark:bg-blue-950/20'
                              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60'
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono font-black text-blue-600 dark:text-blue-400">{item.productCode}</span>
                              <span className="font-black text-slate-900 dark:text-white truncate">{item.productName}</span>
                              <span className="text-[10px] px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-extrabold">
                                📍 {item.subLocation || item.sectionName}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              Contado por: <strong className="text-slate-700 dark:text-slate-300">{item.workerName}</strong> • {new Date(item.countedAt).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                              <button
                                type="button"
                                onClick={() => handleUpdateItemQty(item, item.countedQuantity - 1)}
                                className="p-1 text-slate-600 hover:text-red-600 transition cursor-pointer"
                                title="Restar 1"
                              >
                                <MinusCircle className="w-3.5 h-3.5" />
                              </button>
                              <span className="px-2 font-black font-mono text-xs">{item.countedQuantity}</span>
                              <button
                                type="button"
                                onClick={() => handleUpdateItemQty(item, item.countedQuantity + 1)}
                                className="p-1 text-slate-600 hover:text-emerald-600 transition cursor-pointer"
                                title="Sumar 1"
                              >
                                <PlusCircle className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {/* Botón directo de editar cantidad por si se equivocaron */}
                            <button
                              type="button"
                              onClick={() => {
                                setInlineEditingItem(item);
                                setInlineEditingQty(item.countedQuantity.toString());
                              }}
                              className="p-1.5 text-slate-500 hover:text-blue-600 transition cursor-pointer"
                              title="Editar cantidad exacta de este registro"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteItem(item)}
                              className="p-1.5 text-slate-400 hover:text-red-600 transition cursor-pointer"
                              title="Eliminar conteo"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>
          )}

          {/* ======================================================== */}
          {/* PESTAÑA 3 (ADMIN): CONSOLIDAR Y SOBRESCRIBIR             */}
          {/* ======================================================== */}
          {activeTab === 'consolidate' && isManager && (
            <div className="space-y-4">
              
              {/* Tarjeta de Resumen en Tiempo Real */}
              <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="font-black text-sm text-emerald-950 dark:text-emerald-200 flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                      <span>Consolidación en Tiempo Real de Todo el Personal</span>
                    </h4>
                    <p className="text-xs text-emerald-800 dark:text-emerald-300 mt-0.5">
                      Todo lo contado por los trabajadores en los distintos pasillos se suma de forma automática sin duplicar artículos.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleDownloadConsolidatedExcel}
                      disabled={!consolidationData || consolidationData.items.length === 0}
                      className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs transition cursor-pointer flex items-center gap-2 shadow-md disabled:opacity-50"
                    >
                      <Download className="w-4 h-4" />
                      <span>Descargar Excel con Hojas por Responsable</span>
                    </button>
                  </div>
                </div>

                {consolidationData && (
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
                    <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">% Avance Catálogo</span>
                      <span className="text-lg font-black text-blue-600 dark:text-blue-400">{progressStats.percentage}%</span>
                    </div>
                    <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Productos Únicos</span>
                      <span className="text-lg font-black text-slate-900 dark:text-white">{consolidationData.uniqueProducts}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Unidades Físicas</span>
                      <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">{consolidationData.totalUnits} un.</span>
                    </div>
                    <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Faltantes / Mermas</span>
                      <span className="text-lg font-black text-red-600 dark:text-red-400">{consolidationData.totalMermas} prods</span>
                    </div>
                    <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Sobrantes</span>
                      <span className="text-lg font-black text-amber-600 dark:text-amber-400">{consolidationData.totalSobrantes} prods</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Botón de Sobrescritura en Sistema */}
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
                <div>
                  <h5 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-orange-600" />
                    <span>Subir y Sobrescribir Inventario en Sistema</span>
                  </h5>
                  <p className="text-xs text-slate-500 mt-1 max-w-xl">
                    Reemplaza el stock anterior con las cantidades contadas (<strong>NO SE SUMA</strong>, sino que sobreescribe todo). Al terminar, genera automáticamente el informe de discrepancias para auditar y corregir.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleOverwriteStock}
                  disabled={isApplyingStock || !consolidationData || consolidationData.items.length === 0}
                  className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black text-xs sm:text-sm shadow-lg shadow-orange-500/20 transition cursor-pointer flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${isApplyingStock ? 'animate-spin' : ''}`} />
                  <span>{isApplyingStock ? 'Sobrescribiendo Sistema...' : '🔄 Sobrescribir Inventario en Sistema'}</span>
                </button>
              </div>

              {/* Vista Previa del Consolidado */}
              {consolidationData && (
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                  <h5 className="font-black text-xs uppercase text-slate-500 tracking-wider">
                    Detalle de Productos Consolidados en el Local ({consolidationData.items.length}):
                  </h5>
                  <div className="max-h-80 overflow-y-auto pr-1 space-y-1.5 scrollbar-thin">
                    {consolidationData.items.map((row, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-black text-blue-600 dark:text-blue-400">{row['Código de Barra']}</span>
                            <span className="font-black text-slate-900 dark:text-white truncate">{row['Nombre del Producto']}</span>
                          </div>
                          <p className="text-[11px] text-slate-400 truncate mt-0.5">
                            Ubicaciones: {row['Ubicaciones donde se encontró']} • Responsables: {row['Personal Responsable']}
                          </p>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <span className="text-[10px] text-slate-400 block font-bold">Total Físico:</span>
                            <span className="font-black text-emerald-600 dark:text-emerald-400 text-xs">{row['CANTIDAD TOTAL CONTADA']} un.</span>
                          </div>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                            row['Estado'] === 'CUADRADO' ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700' :
                            row['Estado'] === 'SOBRANTE' ? 'bg-amber-100 dark:bg-amber-950 text-amber-700' :
                            'bg-red-100 dark:bg-red-950 text-red-700'
                          }`}>
                            {row['Estado']}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}

          {/* ======================================================== */}
          {/* PESTAÑA 4: INFORME DE CAMBIOS DE STOCK Y CORRECCIÓN      */}
          {/* ======================================================== */}
          {activeTab === 'changes' && stockChangesReport && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                <div>
                  <h4 className="font-black text-sm text-blue-950 dark:text-blue-200 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-blue-600" />
                    <span>Informe Exclusivo de Productos con Cambio de Stock ({stockChangesReport.length} discrepancias)</span>
                  </h4>
                  <p className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">
                    Revise si las cantidades corresponden o si hubo error del trabajador. Puede editar y corregir cualquier producto de inmediato.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleExportStockChangesExcel}
                    className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs transition cursor-pointer flex items-center gap-1.5 shadow-md"
                  >
                    <Download className="w-4 h-4" />
                    <span>Descargar Excel</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-black text-xs transition cursor-pointer flex items-center gap-1.5 shadow-md"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Imprimir</span>
                  </button>
                </div>
              </div>

              {/* Lista de Discrepancias con Botón Editar / Corregir */}
              <div className="space-y-2">
                {stockChangesReport.map((item, idx) => (
                  <div
                    key={idx}
                    className={`p-3.5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition ${
                      item.isCorrected
                        ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20'
                        : item.difference < 0
                        ? 'border-red-200 dark:border-red-900/50 bg-white dark:bg-slate-900'
                        : 'border-amber-200 dark:border-amber-900/50 bg-white dark:bg-slate-900'
                    }`}
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-black text-blue-600 dark:text-blue-400 text-xs">{item.code}</span>
                        <span className="font-black text-slate-900 dark:text-white text-xs">{item.name}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                          item.isCorrected
                            ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200'
                            : item.difference < 0
                            ? 'bg-red-100 dark:bg-red-950 text-red-700'
                            : 'bg-amber-100 dark:bg-amber-950 text-amber-700'
                        }`}>
                          {item.isCorrected ? '✓ CORREGIDO POR SUPERVISOR' : item.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Contado por: <strong className="text-slate-700 dark:text-slate-300">{item.workers}</strong> • En: <span className="font-semibold">{item.sections}</span>
                      </p>
                      {item.correctionReason && (
                        <p className="text-[10px] text-emerald-700 dark:text-emerald-400 italic">
                          Motivo: {item.correctionReason}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block font-bold">Stock Anterior vs Nuevo:</span>
                        <span className="text-xs font-black text-slate-600 dark:text-slate-300">{item.previousStock} un. → </span>
                        <span className="text-xs font-black text-blue-600 dark:text-blue-400">{item.countedStock} un. </span>
                        <span className={`text-xs font-black ${item.difference < 0 ? 'text-red-600' : 'text-amber-600'}`}>
                          ({item.difference > 0 ? `+${item.difference}` : item.difference})
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setEditingItem(item);
                          setCorrectedQtyInput(item.countedStock.toString());
                          setCorrectionReasonInput('');
                        }}
                        className="px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-xs font-bold hover:bg-blue-100 transition cursor-pointer flex items-center gap-1"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Editar / Corregir</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* MODAL / DIÁLOGO DE EDICIÓN RÁPIDA DE CANTIDAD POR EQUIVOCACIÓN (TRABAJADOR / PERSONAL) */}
      {inlineEditingItem && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border-2 border-amber-500 rounded-3xl p-5 shadow-2xl space-y-4 animate-scaleIn">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-amber-600" />
                <h4 className="font-black text-sm text-slate-900 dark:text-white">Corregir Cantidad de Conteo</h4>
              </div>
              <button
                type="button"
                onClick={() => setInlineEditingItem(null)}
                className="text-slate-400 hover:text-slate-800 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 space-y-1 text-xs">
              <p className="font-black text-slate-900 dark:text-white truncate">{inlineEditingItem.productName}</p>
              <p className="text-slate-500 font-mono text-[11px]">Código: {inlineEditingItem.productCode}</p>
              <p className="text-slate-500">Ubicación / Estante: <strong>{inlineEditingItem.subLocation || inlineEditingItem.sectionName}</strong></p>
              <p className="text-slate-500">Cantidad actual registrada: <strong>{inlineEditingItem.countedQuantity} un.</strong></p>
            </div>

            <form onSubmit={handleSaveInlineQuantity} className="space-y-3">
              <div>
                <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1">
                  Cantidad Correcta Contada Físicamente *
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  required
                  value={inlineEditingQty}
                  onChange={(e) => setInlineEditingQty(e.target.value)}
                  className="w-full px-3.5 py-2 text-base font-black font-mono rounded-xl border border-amber-500 bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  autoFocus
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  💡 Si ingresa 0, el registro se eliminará de este estante.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setInlineEditingItem(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-black rounded-xl bg-amber-600 hover:bg-amber-700 text-white shadow-md transition flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  <span>Guardar Cantidad Corregida</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE EDICIÓN Y CORRECCIÓN DE SUPERVISOR TRAS SOBRESCRIBIR */}
      {editingItem && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border-2 border-blue-500 rounded-3xl p-5 shadow-2xl space-y-4 animate-scaleIn">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-blue-600" />
                <h4 className="font-black text-sm text-slate-900 dark:text-white">Corregir Conteo de Inventario</h4>
              </div>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="text-slate-400 hover:text-slate-800 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 space-y-1 text-xs">
              <p className="font-black text-slate-900 dark:text-white truncate">{editingItem.name}</p>
              <p className="text-slate-500 font-mono text-[11px]">Código: {editingItem.code}</p>
              <p className="text-slate-500">Contado por: <strong>{editingItem.workers}</strong> en <strong>{editingItem.sections}</strong></p>
              <p className="text-slate-500">Stock anterior en sistema: <strong>{editingItem.previousStock} un.</strong></p>
            </div>

            <form onSubmit={handleSaveCorrection} className="space-y-3">
              <div>
                <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1">
                  Nueva Cantidad Revisada / Corregida por Administrador *
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  required
                  value={correctedQtyInput}
                  onChange={(e) => setCorrectedQtyInput(e.target.value)}
                  className="w-full px-3.5 py-2 text-base font-black font-mono rounded-xl border border-blue-400 bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1">
                  Motivo de la Corrección (Auditoría):
                </label>
                <input
                  type="text"
                  value={correctionReasonInput}
                  onChange={(e) => setCorrectionReasonInput(e.target.value)}
                  placeholder="Ej: El trabajador contó 5 paquetes en vez de 60 unidades..."
                  className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-black rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-md transition flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  <span>Guardar y Actualizar Stock</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL ESCANEO CON CÁMARA */}
      {isCameraOpen && (
        <BarcodeScannerModal
          isOpen={isCameraOpen}
          onClose={() => setIsCameraOpen(false)}
          onScan={(code) => {
            setIsCameraOpen(false);
            handleAddProductByCode(code, 1);
          }}
        />
      )}

    </div>
  );
};
