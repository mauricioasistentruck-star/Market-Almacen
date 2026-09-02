import React, { useState, useEffect } from 'react';
import { useTheme } from '../../utils/themeContext';
import { useCompany } from '../../utils/companyContext';
import { useAuth } from '../../utils/authContext';
import { db } from '../../db/database';
import type { Sale, CashClosing } from '../../types';
import { formatCLP } from '../../utils/salesPdfGenerator';
import { exportCashClosingsExcel } from '../../utils/salesExcelExporter';
import { useBodyScrollLock } from '../../utils/scrollLock';
import {
  Calculator,
  Printer,
  Banknote,
  CreditCard,
  Building,
  FileSpreadsheet,
  X,
  CheckCircle2,
  Lock,
  Calendar,
  User
} from 'lucide-react';

interface CashClosingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CashClosingModal: React.FC<CashClosingModalProps> = ({ isOpen, onClose }) => {
  useBodyScrollLock(Boolean(isOpen));
  const { themeClasses } = useTheme();
  const { selectedCompanyId, selectedCompany } = useCompany();
  const { currentUser } = useAuth();

  const [todaySales, setTodaySales] = useState<Sale[]>([]);
  const [initialCash, setInitialCash] = useState<number>(50000);
  const [actualCash, setActualCash] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [cashRegisterName, setCashRegisterName] = useState<string>(() => localStorage.getItem('pos_active_cash_register') || 'Caja 1 - Principal');
  const [isSaved, setIsSaved] = useState(false);

  const todayStr = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (isOpen) {
      loadTodaySales();
    }
  }, [isOpen, selectedCompanyId]);

  const loadTodaySales = async () => {
    const all = await db.sales.toArray();
    const filtered = all.filter(s => {
      const matchComp = selectedCompanyId === 'ALL' || s.companyId === selectedCompanyId;
      const matchDate = s.date === todayStr;
      const matchActive = s.status !== 'ANULADA';
      return matchComp && matchDate && matchActive;
    });

    setTodaySales(filtered);

    // Calcular efectivo acumulado en ventas
    const efectivoSum = filtered
      .filter(s => s.paymentMethod === 'EFECTIVO')
      .reduce((acc, s) => acc + s.total, 0);

    setActualCash(initialCash + efectivoSum);
  };

  const totalSales = todaySales.reduce((acc, s) => acc + s.total, 0);
  const salesCount = todaySales.length;

  const totalEfectivo = todaySales
    .filter(s => s.paymentMethod === 'EFECTIVO')
    .reduce((acc, s) => acc + s.total, 0);

  const totalDebito = todaySales
    .filter(s => s.paymentMethod === 'DEBITO')
    .reduce((acc, s) => acc + s.total, 0);

  const totalCredito = todaySales
    .filter(s => s.paymentMethod === 'CREDITO')
    .reduce((acc, s) => acc + s.total, 0);

  const totalTransferencia = todaySales
    .filter(s => s.paymentMethod === 'TRANSFERENCIA')
    .reduce((acc, s) => acc + s.total, 0);

  const totalOtros = todaySales
    .filter(s => s.paymentMethod === 'CHEQUE' || s.paymentMethod === 'OTRO')
    .reduce((acc, s) => acc + s.total, 0);

  const totalBoletas = todaySales.filter(s => s.dteType.startsWith('BOLETA')).reduce((acc, s) => acc + s.total, 0);
  const totalFacturas = todaySales.filter(s => s.dteType.startsWith('FACTURA')).reduce((acc, s) => acc + s.total, 0);
  const totalTickets = todaySales.filter(s => s.dteType === 'TICKET_INTERNO').reduce((acc, s) => acc + s.total, 0);

  const expectedCashInDrawer = initialCash + totalEfectivo;
  const cashDifference = actualCash - expectedCashInDrawer;

  
  const handlePrintClosingTicket = () => {
    const printWindow = window.open('', '_blank', 'width=380,height=600');
    if (!printWindow) return;

    const companyName = selectedCompany?.name || 'MARKET ALMACÉN';
    const nowTime = new Date().toLocaleTimeString('es-CL');
    const diffStatus = cashDifference === 0 ? 'CUADRADA (SIN DIFERENCIAS)' : cashDifference > 0 ? `SOBRANTE: +${formatCLP(cashDifference)}` : `FALTANTE: -${formatCLP(Math.abs(cashDifference))}`;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Ticket Cierre Z - ${cashRegisterName}</title>
        <style>
          @page { size: 80mm auto; margin: 2mm; }
          body {
            font-family: 'Courier New', Courier, monospace;
            font-size: 11px;
            color: #000;
            width: 74mm;
            margin: 0 auto;
            padding: 4px;
          }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .title { font-size: 14px; font-weight: bold; margin-bottom: 2px; }
          .line { border-bottom: 1px dashed #000; margin: 5px 0; }
          .double-line { border-bottom: 2px solid #000; margin: 6px 0; }
          .row { display: flex; justify-content: space-between; margin: 2px 0; }
          .badge { background: #000; color: #fff; padding: 2px 4px; font-weight: bold; display: inline-block; }
          .footer { margin-top: 15px; text-align: center; font-size: 10px; }
          .signature-box { margin-top: 25px; border-top: 1px solid #000; text-align: center; padding-top: 4px; }
        </style>
      </head>
      <body>
        <div class="center bold title">${companyName.toUpperCase()}</div>
        <div class="center bold">ARQUEO Y CIERRE DE CAJA (TURNO Z)</div>
        <div class="center line"></div>
        <div class="center"><span class="badge">🏛️ ${cashRegisterName.toUpperCase()}</span></div>
        <div class="line"></div>
        <div class="row"><span>FECHA:</span><span class="bold">${todayStr}</span></div>
        <div class="row"><span>HORA CIERRE:</span><span>${nowTime}</span></div>
        <div class="row"><span>RESPONSABLE:</span><span class="bold">${(currentUser?.name || 'Cajero').toUpperCase()}</span></div>
        <div class="row"><span>FOLIO CIERRE:</span><span class="bold">Z-${(cashRegisterName || 'Caja1').replace(/[^a-zA-Z0-9]/g, '').toUpperCase()}</span></div>
        <div class="line"></div>
        <div class="row"><span>Fondo Inicial Caja:</span><span>${formatCLP(initialCash)}</span></div>
        <div class="row"><span>Total Ventas Efectivo:</span><span>${formatCLP(totalEfectivo)}</span></div>
        <div class="row"><span>Total Débito (Redcompra):</span><span>${formatCLP(totalDebito)}</span></div>
        <div class="row"><span>Total Crédito:</span><span>${formatCLP(totalCredito)}</span></div>
        <div class="row"><span>Total Transferencias:</span><span>${formatCLP(totalTransferencia)}</span></div>
        <div class="double-line"></div>
        <div class="row bold" style="font-size: 12px;"><span>TOTAL TURNO (${salesCount} vtas):</span><span>${formatCLP(totalSales)}</span></div>
        <div class="double-line"></div>
        <div class="row bold"><span>EFECTIVO ESPERADO:</span><span>${formatCLP(expectedCashInDrawer)}</span></div>
        <div class="row bold"><span>EFECTIVO REAL CONTADO:</span><span>${formatCLP(actualCash)}</span></div>
        <div class="row bold" style="font-size: 12px; margin-top: 4px;"><span>ESTADO CUADRATURA:</span><span>${diffStatus}</span></div>
        <div class="line"></div>
        <div class="footer">Documento de control interno de turno.<br>Conserve este ticket junto a la recaudación.</div>
        <div class="signature-box">
          Firma Cajero / Responsable Turno
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 400);
  };

  const handleSaveClosing = async () => {
    const newClosing: CashClosing = {
      closingFolio: `Z-${(cashRegisterName || 'Caja1').replace(/[^a-zA-Z0-9]/g, '').toUpperCase()}-${todayStr.replace(/-/g, '')}-${Date.now().toString().slice(-4)}`,
      cashRegisterName: cashRegisterName.trim(),
      date: todayStr,
      companyId: selectedCompanyId || 'ALL',
      companyName: selectedCompany?.name || 'General',
      openedAt: '08:30:00',
      closedAt: new Date().toTimeString().slice(0, 8),
      responsibleName: currentUser?.name || 'Encargado de Caja',
      initialCash,
      totalSales,
      salesCount,
      totalEfectivo,
      totalDebito,
      totalCredito,
      totalTransferencia,
      totalOtros,
      totalBoletas,
      totalFacturas,
      totalTickets,
      expectedCash: expectedCashInDrawer,
      actualCash,
      cashDifference,
      notes: notes.trim() || undefined,
      status: 'CERRADA',
      createdAt: new Date().toISOString()
    };

    await db.cashClosings.add(newClosing);
    setIsSaved(true);
    setTimeout(() => {
      onClose();
      setIsSaved(false);
    }, 1200);
  };

  const handleExportClosing = () => {
    const dummyClosing: CashClosing = {
      closingFolio: `Z-${todayStr.replace(/-/g, '')}`,
      date: todayStr,
      companyId: selectedCompanyId || 'ALL',
      companyName: selectedCompany?.name || 'General',
      openedAt: '08:30:00',
      closedAt: new Date().toTimeString().slice(0, 8),
      responsibleName: currentUser?.name || 'Encargado de Caja',
      initialCash,
      totalSales,
      salesCount,
      totalEfectivo,
      totalDebito,
      totalCredito,
      totalTransferencia,
      totalOtros,
      totalBoletas,
      totalFacturas,
      totalTickets,
      expectedCash: expectedCashInDrawer,
      actualCash,
      cashDifference,
      notes: notes.trim() || undefined,
      status: 'CERRADA',
      createdAt: new Date().toISOString()
    };

    exportCashClosingsExcel([dummyClosing], selectedCompany?.name || 'Bodega');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 lg:p-8 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className={`w-full max-w-6xl max-h-[94vh] rounded-3xl border-2 ${themeClasses.border} ${themeClasses.card} shadow-2xl flex flex-col overflow-hidden animate-scaleIn`}>
        
        {/* Header Amplio, Grande y con Alto Contraste */}
        <div className="flex items-center justify-between px-7 py-4 border-b-2 border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white bg-amber-600 shadow-md shrink-0">
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-black text-slate-950 dark:text-slate-100 flex items-center gap-2">
                  <span>Cierre y Arqueo Diario de Caja (Turno Z)</span>
                </h2>
                <div className="flex items-center gap-1.5 bg-amber-100 dark:bg-amber-950/70 border-2 border-amber-400/80 px-2.5 py-0.5 rounded-xl">
                  <span className="text-[10px] font-black text-amber-800 dark:text-amber-300 uppercase">Caja:</span>
                  <input
                    type="text"
                    list="cashRegisterOptionsList"
                    value={cashRegisterName}
                    onChange={(e) => {
                      setCashRegisterName(e.target.value);
                      localStorage.setItem('pos_active_cash_register', e.target.value);
                    }}
                    placeholder="Caja 1 - Principal"
                    className="text-xs font-black bg-transparent border-none text-amber-950 dark:text-amber-100 focus:outline-none w-36"
                  />
                  <datalist id="cashRegisterOptionsList">
                    <option value="Caja 1 - Principal" />
                    <option value="Caja 2 - Mostrador" />
                    <option value="Caja 3 - Pasillo / Balanza" />
                    <option value="Caja 4 - Rápida Express" />
                  </datalist>
                </div>
              </div>
              <p className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-3.5 mt-0.5 flex-wrap">
                <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4 text-blue-600" /> Fecha: <strong className="text-slate-950 dark:text-white font-mono">{todayStr}</strong></span>
                <span>•</span>
                <span className="flex items-center gap-1.5"><User className="w-4 h-4 text-amber-600" /> Responsable: <strong className="text-slate-950 dark:text-white">{currentUser?.name || 'Mauricio Chamorro (Encargado)'}</strong></span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2.5 rounded-2xl text-slate-600 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Cuerpo Ampliado (max-w-6xl) en 2 Columnas de Alto Contraste (Sin Scroll) */}
        <div className="p-6 lg:p-7 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-y-auto">
          
          {/* Columna Izquierda (6 Cols): Resumen y Desglose por Medio de Pago */}
          <div className="lg:col-span-6 space-y-4 flex flex-col justify-between">
            
            {/* 3 Tarjetas de Resumen Ampliadas con Letras Claras y Marcadas */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border-2 border-amber-300 dark:border-amber-700 shadow-xs">
                <span className="text-[11px] font-black text-amber-900 dark:text-amber-300 uppercase tracking-wider block">Total Ventas</span>
                <p className="text-lg sm:text-xl font-black text-amber-700 dark:text-amber-400 font-mono mt-1">{formatCLP(totalSales)}</p>
                <p className="text-xs font-extrabold text-amber-800 dark:text-amber-200 mt-0.5">{salesCount} emitidas</p>
              </div>

              <div className="p-3.5 sm:p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border-2 border-emerald-300 dark:border-emerald-700 shadow-xs">
                <span className="text-[11px] font-black text-emerald-900 dark:text-emerald-300 uppercase tracking-wider block">Efectivo</span>
                <p className="text-lg sm:text-xl font-black text-emerald-700 dark:text-emerald-400 font-mono mt-1">{formatCLP(totalEfectivo)}</p>
                <p className="text-xs font-extrabold text-emerald-800 dark:text-emerald-200 mt-0.5">Gaveta</p>
              </div>

              <div className="p-3.5 sm:p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/50 border-2 border-blue-300 dark:border-blue-700 shadow-xs">
                <span className="text-[11px] font-black text-blue-900 dark:text-blue-300 uppercase tracking-wider block">Tarjetas</span>
                <p className="text-lg sm:text-xl font-black text-blue-700 dark:text-blue-400 font-mono mt-1">{formatCLP(totalDebito + totalCredito + totalTransferencia)}</p>
                <p className="text-xs font-extrabold text-blue-800 dark:text-blue-200 mt-0.5">POS / Banco</p>
              </div>
            </div>

            {/* Desglose Detallado por Medio de Pago con Letras Fuertes y Mayor Espacio */}
            <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border-2 border-slate-200 dark:border-slate-700 space-y-2.5 text-xs sm:text-sm shadow-xs">
              <span className="text-xs sm:text-sm font-black uppercase text-slate-900 dark:text-slate-100 tracking-wider block border-b-2 border-slate-200 dark:border-slate-700 pb-1.5">
                Desglose Detallado por Medio de Pago
              </span>
              <div className="space-y-2 pt-1">
                <div className="flex justify-between items-center text-slate-900 dark:text-slate-100 font-bold">
                  <span className="flex items-center gap-2 text-xs sm:text-sm"><Banknote className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" /> Efectivo en Caja:</span>
                  <span className="font-mono font-black text-emerald-700 dark:text-emerald-400 text-sm sm:text-base">{formatCLP(totalEfectivo)}</span>
                </div>
                <div className="flex justify-between items-center text-slate-900 dark:text-slate-100 font-bold">
                  <span className="flex items-center gap-2 text-xs sm:text-sm"><CreditCard className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-600" /> Tarjeta Débito (Redcompra):</span>
                  <span className="font-mono font-black text-cyan-700 dark:text-cyan-400 text-sm sm:text-base">{formatCLP(totalDebito)}</span>
                </div>
                <div className="flex justify-between items-center text-slate-900 dark:text-slate-100 font-bold">
                  <span className="flex items-center gap-2 text-xs sm:text-sm"><CreditCard className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600" /> Tarjeta Crédito:</span>
                  <span className="font-mono font-black text-indigo-700 dark:text-indigo-400 text-sm sm:text-base">{formatCLP(totalCredito)}</span>
                </div>
                <div className="flex justify-between items-center text-slate-900 dark:text-slate-100 font-bold">
                  <span className="flex items-center gap-2 text-xs sm:text-sm"><Building className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600" /> Transferencia Bancaria:</span>
                  <span className="font-mono font-black text-amber-700 dark:text-amber-400 text-sm sm:text-base">{formatCLP(totalTransferencia)}</span>
                </div>
              </div>
            </div>

          </div>

          {/* Columna Derecha (6 Cols): Arqueo, Cuadratura y Observaciones */}
          <div className="lg:col-span-6 space-y-4 flex flex-col justify-between">
            
            {/* Cuadratura y Arqueo de Efectivo Ampliada */}
            <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border-2 border-slate-200 dark:border-slate-700 space-y-3 shadow-xs">
              <span className="text-xs sm:text-sm font-black uppercase text-slate-900 dark:text-slate-100 tracking-wider flex items-center gap-2 border-b-2 border-slate-200 dark:border-slate-700 pb-1.5">
                <Calculator className="w-5 h-5 text-orange-600" />
                <span>Cuadratura y Arqueo de Efectivo en Gaveta</span>
              </span>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-slate-800 dark:text-slate-200 mb-1.5">Fondo Inicial de Caja ($)</label>
                  <input
                    type="number"
                    value={initialCash}
                    onChange={(e) => setInitialCash(parseInt(e.target.value) || 0)}
                    className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 text-slate-950 dark:text-slate-100 font-mono font-black text-sm sm:text-base focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-800 dark:text-slate-200 mb-1.5">Efectivo Real Contado ($)</label>
                  <input
                    type="number"
                    value={actualCash}
                    onChange={(e) => setActualCash(parseInt(e.target.value) || 0)}
                    className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border-2 border-emerald-500 text-emerald-700 dark:text-emerald-400 font-mono font-black text-sm sm:text-base focus:border-emerald-600 focus:outline-none"
                  />
                </div>
              </div>

              {/* Resultado de cuadratura con Colores Fuertes y Mayor Tamaño */}
              <div className={`p-3 rounded-xl border-2 flex items-center justify-between ${
                cashDifference === 0
                  ? 'bg-emerald-100 border-emerald-400 text-emerald-950 dark:bg-emerald-950/70 dark:border-emerald-600 dark:text-emerald-200'
                  : cashDifference > 0
                  ? 'bg-blue-100 border-blue-400 text-blue-950 dark:bg-blue-950/70 dark:border-blue-600 dark:text-blue-200'
                  : 'bg-red-100 border-red-400 text-red-950 dark:bg-red-950/70 dark:border-red-600 dark:text-red-200'
              }`}>
                <span className="text-xs sm:text-sm font-black">
                  {cashDifference === 0 ? '✓ Caja Cuadrada Perfectamente' : cashDifference > 0 ? 'Sobrante en Gaveta:' : 'Faltante en Gaveta:'}
                </span>
                <span className="text-sm sm:text-base font-black font-mono">
                  {cashDifference > 0 ? `+${formatCLP(cashDifference)}` : formatCLP(cashDifference)}
                </span>
              </div>
            </div>

            {/* Observaciones del Cierre */}
            <div className="space-y-1.5">
              <label className="block text-xs font-black text-slate-800 dark:text-slate-200">Observaciones del Cierre de Caja</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Comentarios adicionales sobre el turno, incidencias o gaveta..."
                className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 text-slate-950 dark:text-slate-100 text-xs sm:text-sm font-bold focus:outline-none focus:border-amber-500"
              />
            </div>

          </div>

        </div>

        {/* Footer Actions con Botones Claros, Grandes y Accesibles */}
        <div className="px-7 py-4 border-t-2 border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-100 dark:bg-slate-900/90 shrink-0">
          <button
            type="button"
            onClick={handleExportClosing}
            className="px-4 sm:px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-black bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-2 border-emerald-400 dark:border-emerald-600 transition flex items-center gap-2 shadow-xs cursor-pointer active:scale-95"
          >
            <FileSpreadsheet className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600 dark:text-emerald-400" />
            <span>Exportar Cierre a Excel</span>
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 sm:px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-black text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSaveClosing}
              disabled={isSaved}
              className="px-5 sm:px-6 py-2.5 rounded-2xl text-xs sm:text-sm font-black bg-amber-600 hover:bg-amber-500 text-white shadow-md shadow-amber-600/30 transition flex items-center gap-2 active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {isSaved ? (
                <>
                  <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span>¡Cierre Guardado!</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span>Cerrar Caja Diaria</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
