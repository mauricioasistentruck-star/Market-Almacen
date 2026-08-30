import React, { useState, useEffect } from 'react';
import type { LogbookEntry, LogbookDayEvent, PurchaseRequest, PriorityLevel, PurchaseStatus } from '../../types';
import { useTheme } from '../../utils/themeContext';
import { useCompany } from '../../utils/companyContext';
import { useAuth } from '../../utils/authContext';
import { db } from '../../db/database';
import { exportPurchaseRequestsExcel } from '../../utils/excelExporter';
import { triggerCloudSync, notifyLocalMutation } from '../../utils/cloudSync';
import {
  BookOpen,
  ShoppingCart,
  Plus,
  Edit2,
  Trash2,
  Calendar,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Check,
  X,
  Clock,
  Briefcase,
  AlertTriangle,
  FileText,
  User,
  Layers,
  ArrowRightLeft
} from 'lucide-react';

interface LogbookViewProps {
  refreshTrigger: number;
}

export const LogbookView: React.FC<LogbookViewProps> = ({ refreshTrigger }) => {
  const { themeClasses } = useTheme();
  const { selectedCompanyId, selectedCompany, companies } = useCompany();
  const { currentUser, isReadOnly } = useAuth();

  const [activeTab, setActiveTab] = useState<'logbook' | 'purchases'>('logbook');

  // Logbook State
  const [logbooks, setLogbooks] = useState<LogbookEntry[]>([]);
  const [isAddingDayModal, setIsAddingDayModal] = useState(false);
  const [editingDayId, setEditingDayId] = useState<number | null>(null);

  // Move Single Event Modal State
  const [movingEvent, setMovingEvent] = useState<{ entryId: number; event: LogbookDayEvent; originDate: string } | null>(null);
  const [targetMoveDate, setTargetMoveDate] = useState<string>('');

  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [dayEventsList, setDayEventsList] = useState<LogbookDayEvent[]>([]);

  // Add Item to Day Form State
  const [itemTime, setItemTime] = useState(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  });
  const [itemType, setItemType] = useState<'TRABAJO' | 'ACONTECIMIENTO' | 'SOLICITUD' | 'OBSERVACION'>('TRABAJO');
  const [itemTitle, setItemTitle] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [itemResponsible, setItemResponsible] = useState('');

  // Purchase Requests State
  const [purchases, setPurchases] = useState<PurchaseRequest[]>([]);
  const [isAddingPurchase, setIsAddingPurchase] = useState(false);
  const [requesterName, setRequesterName] = useState('');
  const [itemName, setItemName] = useState('');
  const [category, setCategory] = useState('Insumos');
  const [quantity, setQuantity] = useState<number | string>(1);
  const [priority, setPriority] = useState<PriorityLevel>('MEDIA');
  const [justification, setJustification] = useState('');
  const [estimatedCost, setEstimatedCost] = useState(0);

  // Damaged Tools to Purchase Modal State
  const [isDamagedToolsModalOpen, setIsDamagedToolsModalOpen] = useState(false);
  const [damagedToolsList, setDamagedToolsList] = useState<any[]>([]);
  const [addedDamagedIds, setAddedDamagedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadData();
  }, [refreshTrigger, selectedCompanyId]);

  const sortLogbookEntries = (entries: LogbookEntry[]): LogbookEntry[] => {
    return entries
      .map(entry => ({
        ...entry,
        dayEvents: entry.dayEvents
          ? [...entry.dayEvents].sort((a, b) => (a.time || '').localeCompare(b.time || ''))
          : []
      }))
      .sort((a, b) => b.date.localeCompare(a.date)); // Fechas más recientes primero
  };

  const loadData = async () => {
    let logs: LogbookEntry[] = [];
    let purs: PurchaseRequest[] = [];

    if (selectedCompanyId !== 'ALL') {
      logs = await db.logbookEntries.where('companyId').equals(selectedCompanyId).toArray();
      purs = await db.purchaseRequests.where('companyId').equals(selectedCompanyId).reverse().toArray();
    } else {
      logs = await db.logbookEntries.toArray();
      purs = await db.purchaseRequests.toArray();
    }

    setLogbooks(sortLogbookEntries(logs));
    setPurchases(purs);
  };

  const getFormattedDayName = (dateStr: string) => {
    try {
      const parts = dateStr.split('-');
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
      return `${days[d.getDay()]} ${d.getDate()} de ${months[d.getMonth()]}, ${d.getFullYear()}`;
    } catch {
      return dateStr;
    }
  };

  const [editingEventId, setEditingEventId] = useState<string | null>(null);

  // Open Add / Edit Day Modal
  const handleOpenDayModal = (entry?: LogbookEntry, defaultDate?: string) => {
    if (entry) {
      setEditingDayId(entry.id || null);
      setSelectedDate(entry.date);
      
      // If entry has dayEvents, load them
      if (entry.dayEvents && entry.dayEvents.length > 0) {
        setDayEventsList([...entry.dayEvents]);
      } else {
        // Convert legacy fields into day events so they can be modified
        const recoveredEvents: LogbookDayEvent[] = [];
        if (entry.workCompleted && entry.workCompleted !== 'Trabajos rutinarios') {
          recoveredEvents.push({
            id: 'evt_' + Math.random().toString(36).substring(2, 9),
            time: '09:00',
            type: 'TRABAJO',
            title: 'Trabajo Realizado',
            description: entry.workCompleted,
            responsible: entry.author
          });
        }
        if (entry.events && entry.events !== 'Sin acontecimientos especiales') {
          recoveredEvents.push({
            id: 'evt_' + Math.random().toString(36).substring(2, 9),
            time: '11:00',
            type: 'ACONTECIMIENTO',
            title: 'Acontecimiento',
            description: entry.events,
            responsible: entry.author
          });
        }
        if (entry.staffRequests && entry.staffRequests !== 'Sin solicitudes registradas') {
          recoveredEvents.push({
            id: 'evt_' + Math.random().toString(36).substring(2, 9),
            time: '14:00',
            type: 'SOLICITUD',
            title: 'Solicitud Personal',
            description: entry.staffRequests,
            responsible: entry.author
          });
        }
        if (entry.importantNotes && entry.importantNotes !== 'Sin novedades') {
          recoveredEvents.push({
            id: 'evt_' + Math.random().toString(36).substring(2, 9),
            time: '17:00',
            type: 'OBSERVACION',
            title: 'Novedades / Observación',
            description: entry.importantNotes,
            responsible: entry.author
          });
        }
        setDayEventsList(recoveredEvents);
      }
    } else {
      setEditingDayId(null);
      setSelectedDate(defaultDate || selectedDate || new Date().toISOString().split('T')[0]);
      setDayEventsList([]);
    }
    resetItemForm();
    setIsAddingDayModal(true);
  };

  const resetItemForm = () => {
    const d = new Date();
    setItemTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
    setItemType('TRABAJO');
    setItemTitle('');
    setItemDescription('');
    setItemResponsible('');
    setEditingEventId(null);
  };

  const handleEditEvent = (evt: LogbookDayEvent) => {
    setItemTime(evt.time || '09:00');
    setItemType(evt.type);
    setItemTitle(evt.title);
    setItemDescription(evt.description || '');
    setItemResponsible(evt.responsible || '');
    setEditingEventId(evt.id);
  };

  const handleAddItemToDay = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemTitle.trim()) {
      alert('Por favor ingrese un título o descripción del acontecimiento / trabajo.');
      return;
    }

    if (editingEventId) {
      // Modificar evento existente
      setDayEventsList(prev => prev.map(it => it.id === editingEventId ? {
        ...it,
        time: itemTime || '09:00',
        type: itemType,
        title: itemTitle.trim(),
        description: itemDescription.trim(),
        responsible: itemResponsible.trim() || undefined
      } : it));
    } else {
      // Agregar nuevo evento
      const newItem: LogbookDayEvent = {
        id: 'evt_' + Math.random().toString(36).substring(2, 9),
        time: itemTime || '09:00',
        type: itemType,
        title: itemTitle.trim(),
        description: itemDescription.trim(),
        responsible: itemResponsible.trim() || undefined
      };
      setDayEventsList(prev => [...prev, newItem]);
    }
    resetItemForm();
  };

  const handleRemoveItemFromDay = (id: string) => {
    setDayEventsList(prev => prev.filter(it => it.id !== id));
    if (editingEventId === id) resetItemForm();
  };

  const handleOpenMoveModal = (entryId: number, originDate: string, event: LogbookDayEvent) => {
    setMovingEvent({ entryId, originDate, event });
    setTargetMoveDate(originDate);
  };

  const handleConfirmMoveEvent = async () => {
    if (!movingEvent || !targetMoveDate) return;
    const { entryId, event, originDate } = movingEvent;
    if (originDate === targetMoveDate) {
      setMovingEvent(null);
      return;
    }

    // 1. Remove event from origin entry
    const originEntry = await db.logbookEntries.get(entryId);
    if (originEntry) {
      const remainingEvents = (originEntry.dayEvents || []).filter(e => e.id !== event.id);
      
      const workItems = remainingEvents.filter(e => e.type === 'TRABAJO').map(e => `[${e.time}] ${e.title}: ${e.description}`).join('\n');
      const eventsItems = remainingEvents.filter(e => e.type === 'ACONTECIMIENTO').map(e => `[${e.time}] ${e.title}: ${e.description}`).join('\n');
      const requestItems = remainingEvents.filter(e => e.type === 'SOLICITUD').map(e => `[${e.time}] ${e.title}: ${e.description}`).join('\n');
      const noteItems = remainingEvents.filter(e => e.type === 'OBSERVACION').map(e => `[${e.time}] ${e.title}: ${e.description}`).join('\n');

      if (remainingEvents.length === 0) {
        // If no events left in origin day, remove or keep empty
        await db.logbookEntries.delete(entryId);
      } else {
        await db.logbookEntries.put({
          ...originEntry,
          dayEvents: remainingEvents,
          workCompleted: workItems || 'Trabajos rutinarios',
          events: eventsItems || 'Sin acontecimientos especiales',
          staffRequests: requestItems || 'Sin solicitudes registradas',
          importantNotes: noteItems || 'Sin novedades',
          updatedAt: new Date().toISOString()
        });
      }
    }

    // 2. Add event to target date entry
    const targetExisting = await db.logbookEntries.where('date').equals(targetMoveDate).first();
    const weekNumber = getWeekNumber(new Date(targetMoveDate));
    const year = new Date(targetMoveDate).getFullYear();
    const dayFormatted = getFormattedDayName(targetMoveDate);

    if (targetExisting) {
      const mergedEvents = [...(targetExisting.dayEvents || []), event];
      const workItems = mergedEvents.filter(e => e.type === 'TRABAJO').map(e => `[${e.time}] ${e.title}: ${e.description}`).join('\n');
      const eventsItems = mergedEvents.filter(e => e.type === 'ACONTECIMIENTO').map(e => `[${e.time}] ${e.title}: ${e.description}`).join('\n');
      const requestItems = mergedEvents.filter(e => e.type === 'SOLICITUD').map(e => `[${e.time}] ${e.title}: ${e.description}`).join('\n');
      const noteItems = mergedEvents.filter(e => e.type === 'OBSERVACION').map(e => `[${e.time}] ${e.title}: ${e.description}`).join('\n');

      await db.logbookEntries.put({
        ...targetExisting,
        dayEvents: mergedEvents,
        workCompleted: workItems || 'Trabajos rutinarios',
        events: eventsItems || 'Sin acontecimientos especiales',
        staffRequests: requestItems || 'Sin solicitudes registradas',
        importantNotes: noteItems || 'Sin novedades',
        updatedAt: new Date().toISOString()
      });
    } else {
      const singleEvents = [event];
      const workItems = singleEvents.filter(e => e.type === 'TRABAJO').map(e => `[${e.time}] ${e.title}: ${e.description}`).join('\n');
      const eventsItems = singleEvents.filter(e => e.type === 'ACONTECIMIENTO').map(e => `[${e.time}] ${e.title}: ${e.description}`).join('\n');
      const requestItems = singleEvents.filter(e => e.type === 'SOLICITUD').map(e => `[${e.time}] ${e.title}: ${e.description}`).join('\n');
      const noteItems = singleEvents.filter(e => e.type === 'OBSERVACION').map(e => `[${e.time}] ${e.title}: ${e.description}`).join('\n');

      await db.logbookEntries.add({
        date: targetMoveDate,
        weekLabel: `Semana ${weekNumber} - ${year}`,
        dayName: dayFormatted,
        events: eventsItems || 'Sin acontecimientos especiales',
        workCompleted: workItems || 'Trabajos rutinarios',
        staffRequests: requestItems || 'Sin solicitudes registradas',
        importantNotes: noteItems || 'Sin novedades',
        dayEvents: singleEvents,
        companyId: originEntry?.companyId || (selectedCompanyId === 'ALL' ? (companies[0]?.id || '') : selectedCompanyId),
        author: currentUser?.name || 'Encargado de Bodega',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }

    notifyLocalMutation();
    triggerCloudSync();
    await loadData();
    setMovingEvent(null);
  };

  const handleDeleteSingleEvent = async (entryId: number, eventId: string) => {
    if (!confirm('¿Está seguro de eliminar esta anotación de trabajo?')) return;
    const originEntry = await db.logbookEntries.get(entryId);
    if (!originEntry) return;

    const remainingEvents = (originEntry.dayEvents || []).filter(e => e.id !== eventId);
    const workItems = remainingEvents.filter(e => e.type === 'TRABAJO').map(e => `[${e.time}] ${e.title}: ${e.description}`).join('\n');
    const eventsItems = remainingEvents.filter(e => e.type === 'ACONTECIMIENTO').map(e => `[${e.time}] ${e.title}: ${e.description}`).join('\n');
    const requestItems = remainingEvents.filter(e => e.type === 'SOLICITUD').map(e => `[${e.time}] ${e.title}: ${e.description}`).join('\n');
    const noteItems = remainingEvents.filter(e => e.type === 'OBSERVACION').map(e => `[${e.time}] ${e.title}: ${e.description}`).join('\n');

    if (remainingEvents.length === 0) {
      await db.logbookEntries.delete(entryId);
    } else {
      await db.logbookEntries.put({
        ...originEntry,
        dayEvents: remainingEvents,
        workCompleted: workItems || 'Trabajos rutinarios',
        events: eventsItems || 'Sin acontecimientos especiales',
        staffRequests: requestItems || 'Sin solicitudes registradas',
        importantNotes: noteItems || 'Sin novedades',
        updatedAt: new Date().toISOString()
      });
    }

    notifyLocalMutation();
    triggerCloudSync();
    await loadData();
  };

  const handleEditSingleEvent = (entry: LogbookEntry, evt: LogbookDayEvent) => {
    handleOpenDayModal(entry);
    handleEditEvent(evt);
  };

  const handleSaveDayLog = async () => {
    if (!selectedDate) {
      alert('Por favor seleccione una fecha.');
      return;
    }

    if (dayEventsList.length === 0) {
      alert('Por favor agregue al menos un trabajo o acontecimiento relevante para este día.');
      return;
    }

    const weekNumber = getWeekNumber(new Date(selectedDate));
    const year = new Date(selectedDate).getFullYear();
    const dayFormatted = getFormattedDayName(selectedDate);

    // Build summary texts for backward compatibility
    const workItems = dayEventsList.filter(e => e.type === 'TRABAJO').map(e => `[${e.time}] ${e.title}: ${e.description}`).join('\n');
    const eventsItems = dayEventsList.filter(e => e.type === 'ACONTECIMIENTO').map(e => `[${e.time}] ${e.title}: ${e.description}`).join('\n');
    const requestItems = dayEventsList.filter(e => e.type === 'SOLICITUD').map(e => `[${e.time}] ${e.title}: ${e.description}`).join('\n');
    const noteItems = dayEventsList.filter(e => e.type === 'OBSERVACION').map(e => `[${e.time}] ${e.title}: ${e.description}`).join('\n');

    const entryData: LogbookEntry = {
      date: selectedDate,
      weekLabel: `Semana ${weekNumber} - ${year}`,
      dayName: dayFormatted,
      events: eventsItems || 'Sin acontecimientos especiales',
      workCompleted: workItems || 'Trabajos rutinarios',
      staffRequests: requestItems || 'Sin solicitudes registradas',
      importantNotes: noteItems || 'Sin novedades',
      dayEvents: dayEventsList,
      companyId: selectedCompanyId === 'ALL' ? (companies[0]?.id || '') : selectedCompanyId,
      author: currentUser?.name || 'Encargado de Bodega',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (editingDayId) {
      // Verificar si se cambió la fecha respecto a la original
      const originalEntry = await db.logbookEntries.get(editingDayId);
      if (originalEntry && originalEntry.date !== selectedDate) {
        // La fecha fue cambiada: comprobar si la nueva fecha ya tiene un registro
        const targetExisting = await db.logbookEntries.where('date').equals(selectedDate).first();
        if (targetExisting && targetExisting.id !== editingDayId) {
          const mergedEvents = [...(targetExisting.dayEvents || []), ...dayEventsList];
          await db.logbookEntries.put({
            ...entryData,
            dayEvents: mergedEvents,
            id: targetExisting.id
          });
          await db.logbookEntries.delete(editingDayId);
        } else {
          await db.logbookEntries.put({
            ...entryData,
            id: editingDayId
          });
        }
      } else {
        await db.logbookEntries.put({
          ...entryData,
          id: editingDayId
        });
      }
    } else {
      // Nuevo registro para la fecha elegida
      const existing = await db.logbookEntries.where('date').equals(selectedDate).first();
      if (existing) {
        const mergedEvents = [...(existing.dayEvents || []), ...dayEventsList];
        await db.logbookEntries.put({
          ...entryData,
          dayEvents: mergedEvents,
          id: existing.id
        });
      } else {
        await db.logbookEntries.add(entryData);
      }
    }

    setIsAddingDayModal(false);
    loadData();
    triggerCloudSync();
  };

  const handleDeleteDayLog = async (id: number) => {
    if (isReadOnly) return;
    if (confirm('¿Desea eliminar los registros de bitácora de este día?')) {
      await db.logbookEntries.delete(id);
      loadData();
      triggerCloudSync();
    }
  };

  // Purchase Requests Handlers
  const handleSavePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requesterName.trim() || !itemName.trim()) return;

    const newReq: PurchaseRequest = {
      date: new Date().toISOString().split('T')[0],
      requesterName: requesterName.trim(),
      itemName: itemName.trim(),
      category,
      quantity: Number(quantity) || 1,
      priority,
      justification: justification.trim(),
      status: 'PENDIENTE',
      estimatedCost: Number(estimatedCost) || 0,
      companyId: selectedCompanyId === 'ALL' ? (companies[0]?.id || '') : selectedCompanyId,
      createdAt: new Date().toISOString()
    };

    await db.purchaseRequests.add(newReq);
    setIsAddingPurchase(false);
    setRequesterName('');
    setItemName('');
    setJustification('');
    setQuantity(1);
    setEstimatedCost(0);
    loadData();
    triggerCloudSync();
  };

  const handleUpdatePurchaseStatus = async (id: number, newStatus: PurchaseStatus) => {
    await db.purchaseRequests.update(id, { status: newStatus });
    loadData();
    triggerCloudSync();
  };

  const handleDeletePurchase = async (id: number) => {
    if (isReadOnly) return;
    if (confirm('¿Desea eliminar esta solicitud de compra?')) {
      await db.purchaseRequests.delete(id);
      loadData();
      triggerCloudSync();
    }
  };

  const handleExportPurchasesExcel = () => {
    const compName = selectedCompanyId === 'ALL' ? 'Todas_las_Empresas' : selectedCompany?.name || 'Bodega';
    exportPurchaseRequestsExcel(purchases, compName);
  };

  const handleOpenDamagedToolsModal = async () => {
    let damaged: any[] = [];
    const tools = await db.tools.where('status').equals('DANADA').toArray();
    const incs = await db.incidents.toArray();

    tools.forEach(t => {
      damaged.push({
        id: `tool-${t.id}`,
        code: t.code,
        name: t.name,
        brand: t.brand || 'Genérica',
        category: t.category,
        reason: t.conditionNotes || 'Herramienta en estado DAÑADA',
        type: 'HERRAMIENTA'
      });
    });

    incs.forEach(inc => {
      if (inc.itemType === 'HERRAMIENTA' && !damaged.some(d => d.code === inc.itemCode)) {
        damaged.push({
          id: `inc-${inc.id}`,
          code: inc.itemCode,
          name: inc.itemName,
          brand: inc.brand || 'Genérica',
          category: 'Herramientas',
          reason: `Incidente: ${inc.description}`,
          type: 'INCIDENCIA'
        });
      }
    });

    setDamagedToolsList(damaged);
    setIsDamagedToolsModalOpen(true);
  };

  const handleImportDamagedTool = async (item: any) => {
    const newReq: PurchaseRequest = {
      date: new Date().toISOString().split('T')[0],
      requesterName: 'Mauricio Chamorro (Encargado Bodega)',
      itemName: `${item.name} (Cód: ${item.code})`,
      category: 'Herramientas',
      quantity: 1,
      priority: 'ALTA',
      justification: `Reposición por daño/rotura de herramienta: ${item.reason}`,
      status: 'PENDIENTE',
      estimatedCost: 0,
      companyId: selectedCompanyId === 'ALL' ? (companies[0]?.id || '') : selectedCompanyId,
      createdAt: new Date().toISOString()
    };

    await db.purchaseRequests.add(newReq);
    setAddedDamagedIds(prev => new Set(prev).add(item.id));
    loadData();
    triggerCloudSync();
  };

  function getWeekNumber(d: Date): number {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  }

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'TRABAJO':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">🛠️ Trabajo Realizado</span>;
      case 'ACONTECIMIENTO':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">⚡ Acontecimiento Relevante</span>;
      case 'SOLICITUD':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">📋 Solicitud Personal</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-700 text-slate-300">📌 Novedad / Obs.</span>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Header Card */}
      <div className={`p-4 rounded-2xl border ${themeClasses.border} ${themeClasses.card} flex flex-col md:flex-row justify-between items-start md:items-center gap-3 shadow-sm`}>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-black tracking-tight text-slate-100">
              Bitácora Diaria y Registro de Novedades
            </h2>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-black ${themeClasses.badge}`}>
              {logbooks.length} Días Registrados
            </span>
          </div>
          <p className={`text-xs ${themeClasses.textMuted}`}>
            Registro diario de trabajos y acontecimientos • Se compila automáticamente en el informe Word con fecha exacta
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {activeTab === 'logbook' && !isReadOnly && (
            <button
              onClick={() => handleOpenDayModal()}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-black rounded-xl ${themeClasses.accentBg} ${themeClasses.accentHover} shadow-md shadow-orange-500/20 transition active:scale-95`}
            >
              <Plus className="w-4 h-4" />
              <span>Anotar Trabajos del Día</span>
            </button>
          )}

          {activeTab === 'purchases' && (
            <>
              <button
                onClick={handleExportPurchasesExcel}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-slate-700 bg-slate-800/60 hover:bg-slate-800 text-slate-300 transition"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                <span className="hidden sm:inline">Excel</span>
              </button>
              {!isReadOnly && (
                <>
                  <button
                    onClick={handleOpenDamagedToolsModal}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 transition active:scale-95"
                    title="Importar herramientas dañadas para reponer"
                  >
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    <span>Reponer Herramientas Dañadas</span>
                  </button>
                  <button
                    onClick={() => setIsAddingPurchase(true)}
                    className={`flex items-center gap-1.5 px-4 py-2 text-xs font-black rounded-xl ${themeClasses.accentBg} ${themeClasses.accentHover} shadow-md shadow-orange-500/20 transition active:scale-95`}
                  >
                    <Plus className="w-4 h-4" />
                    <span>Nueva Solicitud</span>
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-1">
        <button
          onClick={() => setActiveTab('logbook')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition ${
            activeTab === 'logbook'
              ? `${themeClasses.accentBg} ${themeClasses.accentHover} shadow-sm`
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Bitácora Diaria ({logbooks.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('purchases')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition ${
            activeTab === 'purchases'
              ? `${themeClasses.accentBg} ${themeClasses.accentHover} shadow-sm`
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <ShoppingCart className="w-4 h-4" />
          <span>Solicitudes de Compra ({purchases.length})</span>
        </button>
      </div>

      {/* TAB 1: DAILY LOGBOOK ENTRIES */}
      {activeTab === 'logbook' && (
        <div className="space-y-4">
          {logbooks.length === 0 ? (
            <div className={`p-12 text-center rounded-2xl border ${themeClasses.border} ${themeClasses.card} space-y-3`}>
              <BookOpen className="w-12 h-12 text-slate-600 mx-auto" />
              <h4 className="text-base font-bold text-slate-300">No hay registros en la bitácora</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Comience a registrar los trabajos realizados, novedades operativas y acontecimientos día a día.
              </p>
              {!isReadOnly && (
                <button
                  onClick={() => handleOpenDayModal()}
                  className={`px-4 py-2 text-xs font-bold rounded-xl ${themeClasses.accentBg} ${themeClasses.accentHover}`}
                >
                  Registrar Primer Día
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {logbooks.map((entry) => {
                const eventsList = entry.dayEvents && entry.dayEvents.length > 0 ? entry.dayEvents : [];
                return (
                  <div
                    key={entry.id}
                    className={`p-4 sm:p-5 rounded-2xl border ${themeClasses.border} ${themeClasses.card} space-y-4 shadow-sm hover:border-slate-700 transition`}
                  >
                    {/* Day Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-orange-500/10 text-orange-400 border border-orange-500/20">
                          <Calendar className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-extrabold text-sm sm:text-base text-slate-100">
                            {entry.dayName || getFormattedDayName(entry.date)}
                          </h3>
                          <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                            <span>Fecha: {entry.date}</span>
                            <span>•</span>
                            <span className="text-orange-400 font-bold">{entry.weekLabel}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 self-end sm:self-auto">
                        {!isReadOnly && (
                          <>
                            <button
                              onClick={() => handleOpenDayModal(entry)}
                              className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition border border-slate-700"
                              title="Editar o agregar más tareas a este día"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                              <span>Agregar / Editar</span>
                            </button>
                            <button
                              onClick={() => handleDeleteDayLog(entry.id!)}
                              className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition"
                              title="Eliminar registro del día"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Events List for this Day */}
                    {eventsList.length > 0 ? (
                      <div className="space-y-2.5">
                        {eventsList.map((evt) => (
                          <div
                            key={evt.id}
                            className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col sm:flex-row sm:items-start justify-between gap-2.5"
                          >
                            <div className="space-y-1 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                {getTypeBadge(evt.type)}
                                <span className="font-mono font-bold text-xs text-orange-400">
                                  {evt.time || 'Horario n/a'}
                                </span>
                                <span className="font-bold text-xs text-slate-100">
                                  {evt.title}
                                </span>
                              </div>
                              {evt.description && (
                                <p className="text-xs text-slate-300 leading-relaxed pl-1 pt-0.5 whitespace-pre-wrap">
                                  {evt.description}
                                </p>
                              )}
                              {evt.responsible && (
                                <div className="flex items-center gap-1 text-[11px] text-slate-400 pt-0.5">
                                  <User className="w-3 h-3 text-slate-500" />
                                  <span>Responsable: <strong>{evt.responsible}</strong></span>
                                </div>
                              )}
                            </div>

                            {!isReadOnly && (
                              <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleOpenMoveModal(entry.id!, entry.date, evt)}
                                  className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg bg-orange-600/20 hover:bg-orange-600/30 text-orange-400 border border-orange-500/30 transition shadow-sm"
                                  title="Mover esta nota o trabajo a otra fecha"
                                >
                                  <Calendar className="w-3 h-3 text-orange-400" />
                                  <span>Mover de Día</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleEditSingleEvent(entry, evt)}
                                  className="p-1.5 text-slate-400 hover:text-slate-100 rounded-lg hover:bg-slate-800 transition"
                                  title="Editar contenido de este trabajo"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteSingleEvent(entry.id!, evt.id)}
                                  className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition"
                                  title="Eliminar este trabajo de este día"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      /* Legacy Fallback Display */
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                        {entry.workCompleted && (
                          <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-800 space-y-1">
                            <span className="font-bold text-blue-400 block">🛠️ Trabajos Realizados:</span>
                            <p className="text-slate-300 whitespace-pre-wrap">{entry.workCompleted}</p>
                          </div>
                        )}
                        {entry.events && (
                          <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-800 space-y-1">
                            <span className="font-bold text-amber-400 block">⚡ Acontecimientos:</span>
                            <p className="text-slate-300 whitespace-pre-wrap">{entry.events}</p>
                          </div>
                        )}
                        {entry.staffRequests && (
                          <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-800 space-y-1">
                            <span className="font-bold text-purple-400 block">📋 Solicitudes:</span>
                            <p className="text-slate-300 whitespace-pre-wrap">{entry.staffRequests}</p>
                          </div>
                        )}
                        {entry.importantNotes && (
                          <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-800 space-y-1">
                            <span className="font-bold text-slate-400 block">📌 Observaciones:</span>
                            <p className="text-slate-300 whitespace-pre-wrap">{entry.importantNotes}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PURCHASE REQUESTS */}
      {activeTab === 'purchases' && (
        <div className="space-y-4">
          <div className={`rounded-2xl border ${themeClasses.border} ${themeClasses.card} overflow-hidden shadow-md`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">FECHA</th>
                    <th className="py-2.5 px-3">SOLICITANTE</th>
                    <th className="py-2.5 px-3">ÍTEM / MATERIAL</th>
                    <th className="py-2.5 px-3 text-center">CANTIDAD</th>
                    <th className="py-2.5 px-3 text-center">PRIORIDAD</th>
                    <th className="py-2.5 px-3 text-center">ESTADO</th>
                    <th className="py-2.5 px-3">JUSTIFICACIÓN</th>
                    <th className="py-2.5 px-3 text-right">ACCIONES</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {purchases.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-500">
                        No hay solicitudes de compra registradas.
                      </td>
                    </tr>
                  ) : (
                    purchases.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-800/20 transition">
                        <td className="py-2.5 px-3 font-mono text-slate-300 whitespace-nowrap">{p.date}</td>
                        <td className="py-2.5 px-3 font-bold text-slate-200">{p.requesterName}</td>
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-slate-100">{p.itemName}</div>
                          <div className="text-[10px] text-slate-400">{p.category}</div>
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-orange-400">{p.quantity}</td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              p.priority === 'URGENTE'
                                ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                                : p.priority === 'ALTA'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {p.priority}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <select
                            disabled={isReadOnly}
                            value={p.status}
                            onChange={(e) => handleUpdatePurchaseStatus(p.id!, e.target.value as PurchaseStatus)}
                            className="text-[11px] font-bold rounded-lg px-2 py-1 bg-slate-900 border border-slate-700 text-slate-200"
                          >
                            <option value="PENDIENTE">🟡 PENDIENTE</option>
                            <option value="APROBADA">🔵 APROBADA</option>
                            <option value="COMPRADA">🟢 COMPRADA</option>
                            <option value="RECHAZADA">🔴 RECHAZADA</option>
                          </select>
                        </td>
                        <td className="py-2.5 px-3 text-slate-300 max-w-xs truncate">{p.justification || '-'}</td>
                        <td className="py-2.5 px-3 text-right">
                          {!isReadOnly && (
                            <button
                              onClick={() => handleDeletePurchase(p.id!)}
                              className="p-1 text-slate-400 hover:text-red-400"
                              title="Eliminar solicitud"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT DAY LOG (Interactive Day Organizer) */}
      {isAddingDayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className={`w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl border ${themeClasses.border} ${themeClasses.card} shadow-2xl overflow-hidden`}>
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-orange-500/10 text-orange-400 border border-orange-500/20">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base sm:text-lg text-slate-100">
                    {editingDayId ? 'Editar Bitácora del Día' : 'Nueva Bitácora Diaria'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Agregue los acontecimientos y trabajos realizados en la fecha indicada
                  </p>
                </div>
              </div>
              <button onClick={() => setIsAddingDayModal(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
              {/* Date Input */}
              <div className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-300">Fecha del Día de Trabajo:</label>
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
                      className="px-2 py-0.5 rounded-lg font-bold bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 border border-orange-500/30"
                    >
                      Hoy
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const y = new Date();
                        y.setDate(y.getDate() - 1);
                        setSelectedDate(y.toISOString().split('T')[0]);
                      }}
                      className="px-2 py-0.5 rounded-lg font-bold bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700"
                    >
                      Ayer
                    </button>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                  <input
                    type="date"
                    required
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className={`px-3 py-2 text-xs font-bold rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} focus:outline-none focus:border-orange-500`}
                  />
                  <span className="text-xs font-semibold text-orange-400 flex items-center gap-1">
                    <span>📅</span>
                    <span>{getFormattedDayName(selectedDate)}</span>
                  </span>
                </div>
              </div>

              {/* Form to Add / Edit Event to This Day */}
              <div className={`p-4 rounded-2xl border ${editingEventId ? 'border-orange-500 bg-orange-500/10' : 'border-orange-500/30 bg-orange-500/5'} space-y-3`}>
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-orange-400 flex items-center gap-1.5">
                    {editingEventId ? (
                      <>
                        <Edit2 className="w-4 h-4" />
                        <span>Modificar Tarea / Acontecimiento Seleccionado</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        <span>Agregar Acontecimiento / Trabajo a Este Día</span>
                      </>
                    )}
                  </h4>
                  {editingEventId && (
                    <button
                      type="button"
                      onClick={resetItemForm}
                      className="text-[11px] text-slate-400 hover:text-white underline font-semibold"
                    >
                      Cancelar edición
                    </button>
                  )}
                </div>

                <form onSubmit={handleAddItemToDay} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-300 mb-1">Hora / Momento:</label>
                      <input
                        type="time"
                        value={itemTime}
                        onChange={(e) => setItemTime(e.target.value)}
                        className={`w-full px-2.5 py-1.5 text-xs rounded-lg border ${themeClasses.inputBorder} ${themeClasses.inputBg}`}
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-300 mb-1">Tipo de Evento:</label>
                      <select
                        value={itemType}
                        onChange={(e) => setItemType(e.target.value as any)}
                        className={`w-full px-2.5 py-1.5 text-xs rounded-lg border ${themeClasses.inputBorder} ${themeClasses.inputBg}`}
                      >
                        <option value="TRABAJO">🛠️  Trabajo Realizado</option>
                        <option value="ACONTECIMIENTO">⚡ Acontecimiento Relevante</option>
                        <option value="SOLICITUD">📋 Solicitud Personal</option>
                        <option value="OBSERVACION">📌  Novedad / Observación</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-300 mb-1">Responsable / Encargado:</label>
                      <input
                        type="text"
                        value={itemResponsible}
                        onChange={(e) => setItemResponsible(e.target.value)}
                        placeholder="Ej: Mauricio Chamorro"
                        className={`w-full px-2.5 py-1.5 text-xs rounded-lg border ${themeClasses.inputBorder} ${themeClasses.inputBg}`}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">Título / Actividad *:</label>
                    <input
                      type="text"
                      required
                      value={itemTitle}
                      onChange={(e) => setItemTitle(e.target.value)}
                      placeholder="Ej: Mantenimiento y conteo de filtros Mann / Entrega de herramientas a camión #14"
                      className={`w-full px-3 py-1.5 text-xs rounded-lg border ${themeClasses.inputBorder} ${themeClasses.inputBg}`}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">Detalle / Circunstancias:</label>
                    <textarea
                      rows={2}
                      value={itemDescription}
                      onChange={(e) => setItemDescription(e.target.value)}
                      placeholder="Escriba los detalles relevantes de lo realizado..."
                      className={`w-full px-3 py-1.5 text-xs rounded-lg border ${themeClasses.inputBorder} ${themeClasses.inputBg}`}
                    />
                  </div>

                  <button
                    type="submit"
                    className={`w-full py-2 text-xs font-bold rounded-xl ${editingEventId ? 'bg-amber-500 hover:bg-amber-600 text-black shadow-lg shadow-amber-500/20' : 'bg-orange-600 hover:bg-orange-700 text-white'} transition flex items-center justify-center gap-1.5`}
                  >
                    {editingEventId ? (
                      <>
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Guardar Modificación de Tarea</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5" />
                        <span>Añadir Tarea al Día</span>
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* Items List Added for This Day */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300">
                    Tareas y Acontecimientos de la Fecha ({dayEventsList.length})
                  </span>
                </div>

                {dayEventsList.length === 0 ? (
                  <div className="p-4 rounded-xl border border-dashed border-slate-700 text-center text-xs text-slate-500">
                    No ha agregado eventos para esta fecha todavía. Ingrese una tarea arriba.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {dayEventsList.map((evt, idx) => (
                      <div
                        key={evt.id || idx}
                        className={`p-3 rounded-xl border flex items-start justify-between gap-2 transition ${
                          editingEventId === evt.id
                            ? 'bg-orange-500/20 border-orange-500 shadow-md'
                            : 'bg-slate-900/60 border-slate-800'
                        }`}
                      >
                        <div className="space-y-1 text-xs flex-1">
                          <div className="flex items-center gap-2">
                            {getTypeBadge(evt.type)}
                            <span className="font-mono text-orange-400 font-bold">{evt.time}</span>
                            <span className="font-bold text-slate-200">{evt.title}</span>
                          </div>
                          {evt.description && (
                            <p className="text-slate-300 text-[11px] pl-1 whitespace-pre-wrap">{evt.description}</p>
                          )}
                          {evt.responsible && (
                            <span className="text-[10px] text-slate-400 block pl-1">
                              Resp: {evt.responsible}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleEditEvent(evt)}
                            className="p-1 text-slate-400 hover:text-orange-400 hover:bg-slate-800 rounded transition"
                            title="Editar esta tarea"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveItemFromDay(evt.id)}
                            className="p-1 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded transition"
                            title="Quitar tarea"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="p-4 border-t border-slate-800 flex items-center justify-end gap-2 bg-slate-900/40">
              <button
                type="button"
                onClick={() => setIsAddingDayModal(false)}
                className="px-4 py-2 text-xs rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveDayLog}
                disabled={dayEventsList.length === 0}
                className={`flex items-center gap-1.5 px-6 py-2 text-xs font-bold rounded-xl transition ${
                  dayEventsList.length > 0
                    ? `${themeClasses.accentBg} ${themeClasses.accentHover} shadow-md shadow-orange-500/20`
                    : 'bg-slate-700 text-slate-400 cursor-not-allowed'
                }`}
              >
                <Check className="w-4 h-4" />
                <span>Guardar Bitácora del Día</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD PURCHASE REQUEST */}
      {isAddingPurchase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md">
          <div className={`w-full max-w-lg rounded-3xl border ${themeClasses.border} ${themeClasses.card} shadow-2xl p-5 space-y-4`}>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-orange-500" />
                Nueva Solicitud de Compra
              </h3>
              <button onClick={() => setIsAddingPurchase(false)} className="p-1 text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePurchase} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Nombre Solicitante *</label>
                <input
                  type="text"
                  required
                  value={requesterName}
                  onChange={(e) => setRequesterName(e.target.value)}
                  placeholder="Ej: Marcelo Rojas (Taller)"
                  className={`w-full px-3 py-2 text-xs rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg}`}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Ítem / Producto *</label>
                  <input
                    type="text"
                    required
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    placeholder="Ej: Aceite Sintético 15W40"
                    className={`w-full px-3 py-2 text-xs rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg}`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Cantidad *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={quantity}
                    onChange={(e) => { const v = e.target.value; setQuantity(v === "" ? "" : Math.max(1, parseInt(v) || 1)); }} onBlur={(e) => { if (!e.target.value || Number(e.target.value) < 1) setQuantity(1); }}
                    className={`w-full px-3 py-2 text-xs rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg}`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Categoría</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className={`w-full px-3 py-2 text-xs rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg}`}
                  >
                    <option value="Insumos">Insumos</option>
                    <option value="Filtros">Filtros</option>
                    <option value="Herramientas">Herramientas</option>
                    <option value="Seguridad EPP">Seguridad EPP</option>
                    <option value="Repuestos">Repuestos</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Prioridad</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as PriorityLevel)}
                    className={`w-full px-3 py-2 text-xs rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg}`}
                  >
                    <option value="BAJA">🟢 BAJA</option>
                    <option value="MEDIA">🟡 MEDIA</option>
                    <option value="ALTA">🟠 ALTA</option>
                    <option value="URGENTE">🔴 URGENTE</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Justificación / Motivo</label>
                <textarea
                  rows={2}
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  placeholder="Ej: Stock crítico para cambio de aceite programado este fin de semana..."
                  className={`w-full px-3 py-2 text-xs rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg}`}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddingPurchase(false)}
                  className="px-4 py-2 text-xs rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2 text-xs font-bold rounded-xl ${themeClasses.accentBg} ${themeClasses.accentHover}`}
                >
                  Guardar Solicitud
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* MODAL: IMPORT DAMAGED TOOLS TO PURCHASES */}
      {isDamagedToolsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className={`w-full max-w-2xl rounded-3xl border ${themeClasses.border} ${themeClasses.card} shadow-2xl flex flex-col max-h-[90vh] overflow-hidden`}>
            {/* Header */}
            <div className="p-4 sm:p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base text-slate-100">
                    Herramientas Dañadas para Reposición
                  </h3>
                  <p className="text-xs text-slate-400">
                    Seleccione una a una las herramientas que desea incluir en la lista de solicitudes de compra
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsDamagedToolsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* List */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-3 flex-1">
              {damagedToolsList.length === 0 ? (
                <div className="p-8 text-center text-slate-400 space-y-2">
                  <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
                  <p className="font-bold text-sm text-slate-200">No hay herramientas registradas con daños</p>
                  <p className="text-xs text-slate-500">Todas las herramientas se encuentran en estado operativo.</p>
                </div>
              ) : (
                damagedToolsList.map((item) => {
                  const isAdded = addedDamagedIds.has(item.id);
                  return (
                    <div
                      key={item.id}
                      className={`p-3.5 rounded-2xl border ${
                        isAdded ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-slate-800 bg-slate-900/60'
                      } flex items-center justify-between gap-3 transition`}
                    >
                      <div className="space-y-1 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-orange-400">{item.code}</span>
                          <span className="font-bold text-slate-100 text-sm">{item.name}</span>
                          {item.brand && <span className="text-[11px] text-slate-400">({item.brand})</span>}
                        </div>
                        <p className="text-[11px] text-amber-300/80">{item.reason}</p>
                      </div>

                      <div>
                        {isAdded ? (
                          <span className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            <Check className="w-3.5 h-3.5" />
                            <span>Agregada</span>
                          </span>
                        ) : (
                          <button
                            onClick={() => handleImportDamagedTool(item)}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-xl bg-orange-600 hover:bg-orange-500 text-white shadow transition active:scale-95"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Agregar a Compras</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setIsDamagedToolsModalOpen(false)}
                className="px-5 py-2 text-xs font-bold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: MOVE SINGLE EVENT TO ANOTHER DATE */}
      {movingEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className={`w-full max-w-md rounded-3xl border ${themeClasses.border} ${themeClasses.card} shadow-2xl overflow-hidden`}>
            <div className="p-4 sm:p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-orange-500/20 text-orange-400 border border-orange-500/30">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base text-slate-100">
                    Mover Trabajo a Otra Fecha
                  </h3>
                  <p className="text-xs text-slate-400">
                    Cambie la fecha de esta nota sin afectar los demás trabajos
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMovingEvent(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Event preview */}
              <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-orange-400">[{movingEvent.event.time}]</span>
                  <span className="font-bold text-xs text-slate-100">{movingEvent.event.title}</span>
                </div>
                {movingEvent.event.description && (
                  <p className="text-xs text-slate-300 line-clamp-2">{movingEvent.event.description}</p>
                )}
                <div className="text-[11px] text-slate-400 font-mono">
                  Fecha actual: <span className="text-slate-200 font-bold">{movingEvent.originDate}</span>
                </div>
              </div>

              {/* Target date selector */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Seleccione la Nueva Fecha Destino:
                </label>
                <input
                  type="date"
                  value={targetMoveDate}
                  onChange={(e) => setTargetMoveDate(e.target.value)}
                  className={`w-full px-3.5 py-2.5 text-xs font-bold rounded-xl border ${themeClasses.inputBorder} ${themeClasses.inputBg} focus:outline-none focus:border-orange-500`}
                />
              </div>
            </div>

            <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setMovingEvent(null)}
                className="px-4 py-2 text-xs rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmMoveEvent}
                className={`flex items-center gap-1.5 px-5 py-2 text-xs font-bold rounded-xl ${themeClasses.accentBg} ${themeClasses.accentHover} shadow-md`}
              >
                <Check className="w-4 h-4" />
                <span>Confirmar y Mover</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

