/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  TrendingUp, Skull, Package, Activity, AlertTriangle,
  ArrowUpRight, TrendingDown, Target, Egg, DollarSign,
  Syringe, CheckCircle2, BarChart3, Flame, Users
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { formatCurrency, cn } from '../lib/utils';
import { motion } from 'motion/react';
import { EggCategory, MutationType } from '../types';


import { useHouse } from '../HouseContext';
import { useFlock } from '../FlockContext';
import { useGlobalData } from '../GlobalContext';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getStrainStandardHDP(ageWeeks: number): number {
  if (ageWeeks < 18) return 0;
  if (ageWeeks < 22) return 50;
  if (ageWeeks < 26) return 80;
  if (ageWeeks < 30) return 92;
  if (ageWeeks < 50) return 94;
  if (ageWeeks < 65) return 88;
  return 78;
}

function getWeekAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

const DAY_LABELS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

// Helper to convert any date string (ISO or date-only) to YYYY-MM-DD local format
const toLocalYYYYMMDD = (dateVal: string | Date): string => {
  if (!dateVal) return '';
  if (typeof dateVal === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateVal)) {
    return dateVal;
  }
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// ─── Sub-components ───────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  trend?: 'up' | 'down' | 'neutral';
  trendLabel?: string;
  accentClass?: string;
  progress?: number;
}

function KpiCard({ label, value, sub, icon: Icon, trend, trendLabel, accentClass = 'bg-white', progress }: KpiCardProps) {
  return (
    <div className={cn('p-5 border border-slate-200 shadow-sm hover:shadow-md transition-all relative overflow-hidden', accentClass)}>

      {/* KONTEN TEKS & PROGRESS (Diatur ke z-10 agar berada di depan) */}
      <div className="relative z-10">
        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">{label}</p>
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-2xl font-black italic tracking-tight text-slate-900">{value}</p>
          {trend && (
            <span className={cn('text-[9px] font-bold flex items-center gap-0.5',
              trend === 'up' ? 'text-emerald-600' : trend === 'down' ? 'text-rose-600' : 'text-slate-400')}>
              {trend === 'up' ? <ArrowUpRight size={10} /> : trend === 'down' ? <TrendingDown size={10} /> : null}
              {trendLabel}
            </span>
          )}
        </div>
        {progress !== undefined ? (
          <div className="mt-3 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, progress)}%` }}
              transition={{ duration: 0.8 }} className="h-full bg-amber-500 rounded-full" />
          </div>
        ) : sub ? (
          <p className="text-[9px] text-slate-400 mt-1.5 font-medium">{sub}</p>
        ) : null}
      </div>

      {/* IKON BACKGROUND (Diatur ke z-0 dan diturunkan sedikit opacity-nya) */}
      {/* Posisi digeser sedikit ke pojok kanan bawah agar lebih pas sebagai watermark */}
      <Icon
        size={24}
        className="absolute -right-2 -bottom-2 lg:-right-4 lg:-bottom-4 text-slate-900 opacity-[0.03] lg:size-40 z-0 pointer-events-none"
      />
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { activeHouse } = useHouse();
  const { getActiveFlockByHouse, mutations } = useFlock();
  const { 
    productionLogs, salesLogs, inventory, mortalityRecords, 
    transactions, farmSettings, getFlockAnalytics 
  } = useGlobalData();


  const [chartPeriod, setChartPeriod] = useState<'HARIAN' | 'MINGGUAN' | 'BULANAN'>('HARIAN');

  const activeBatch = getActiveFlockByHouse(activeHouse?.id || '');
  const currentCount = activeBatch?.currentCount || 0;

  // ── Age Calculation ──────────────────────────────────────────────────────
  const ageWeeks = useMemo(() => {
    if (!activeBatch) return 0;
    const start = new Date(activeBatch.arrivalDate);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - start.getTime()) / 86400000);
    return Math.floor((diffDays + activeBatch.arrivalAgeWeeks * 7) / 7);
  }, [activeBatch]);

  // ── House Production Logs ────────────────────────────────────────────────
  const houseLogs = useMemo(() =>
    productionLogs.filter(p => p.houseId === activeHouse?.id)
      .sort((a, b) => a.date.localeCompare(b.date)),
    [productionLogs, activeHouse]);

  // ── Last N Days Chart Data ────────────────────────────────────────────────
  const chartData = useMemo(() => {
    let result = [];
    const now = new Date();

    if (chartPeriod === 'HARIAN') {
      const days = 14;
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const log = houseLogs.find(l => toLocalYYYYMMDD(l.date) === dateStr);
        
        // Calculate historical population accurately
        let historicalPop = activeBatch ? activeBatch.initialCount : currentCount;
        if (activeBatch) {
          const flockMutations = mutations.filter(m => 
            m.houseId === activeBatch.houseId && 
            toLocalYYYYMMDD(m.date) >= toLocalYYYYMMDD(activeBatch.arrivalDate) && 
            toLocalYYYYMMDD(m.date) <= dateStr
          );
          
          let mutationDelta = 0;
          flockMutations.forEach(m => {
            if (m.type === MutationType.ARRIVAL) {
              if (!(toLocalYYYYMMDD(m.date) === toLocalYYYYMMDD(activeBatch.arrivalDate) && m.count === activeBatch.initialCount)) {
                mutationDelta += m.count;
              }
            } else if (m.type === MutationType.MORTALITY || m.type === MutationType.CULLING || m.type === MutationType.TRANSFER) {
              mutationDelta -= m.count;
            }
          });

          const transferInMutations = mutations.filter(m => 
            m.targetHouseId === activeBatch.houseId && 
            m.type === MutationType.TRANSFER &&
            toLocalYYYYMMDD(m.date) >= toLocalYYYYMMDD(activeBatch.arrivalDate) && 
            toLocalYYYYMMDD(m.date) <= dateStr
          );
          transferInMutations.forEach(m => {
            mutationDelta += m.count;
          });

          historicalPop = Math.max(0, activeBatch.initialCount + mutationDelta);
        }

        const hdp = log && historicalPop > 0 ? (log.eggCount / historicalPop) * 100 : null;
        result.push({
          name: d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }),
          produksi: log ? (log.totalButir ?? 0) : 0,
          pakan: log ? log.feedConsumed : 0,
          hdp: hdp ? parseFloat(hdp.toFixed(1)) : null,
          standar: getStrainStandardHDP(Math.max(1, ageWeeks - Math.floor(i / 7))),
          mortalitas: log ? log.mortality : 0,
        });
      }
    } else if (chartPeriod === 'MINGGUAN') {
      const weeks = 8;
      for (let i = weeks - 1; i >= 0; i--) {
        const endD = new Date(now);
        endD.setDate(endD.getDate() - (i * 7));
        const startD = new Date(endD);
        startD.setDate(startD.getDate() - 6);
        const dateStr = endD.toISOString().split('T')[0];

        let totalProd = 0, totalPakan = 0, totalMortality = 0, totalEggCount = 0, logCount = 0;

        houseLogs.forEach(l => {
          const ld = new Date(toLocalYYYYMMDD(l.date));
          if (ld >= startD && ld <= endD) {
            totalProd += (l.totalButir ?? 0);
            totalPakan += l.feedConsumed;
            totalMortality += l.mortality;
            totalEggCount += l.eggCount;
            logCount++;
          }
        });

        // Calculate historical population for the end of this week
        let historicalPop = activeBatch ? activeBatch.initialCount : currentCount;
        if (activeBatch) {
          const flockMutations = mutations.filter(m => 
            m.houseId === activeBatch.houseId && 
            toLocalYYYYMMDD(m.date) >= toLocalYYYYMMDD(activeBatch.arrivalDate) && 
            toLocalYYYYMMDD(m.date) <= dateStr
          );
          
          let mutationDelta = 0;
          flockMutations.forEach(m => {
            if (m.type === MutationType.ARRIVAL) {
              if (!(toLocalYYYYMMDD(m.date) === toLocalYYYYMMDD(activeBatch.arrivalDate) && m.count === activeBatch.initialCount)) {
                mutationDelta += m.count;
              }
            } else if (m.type === MutationType.MORTALITY || m.type === MutationType.CULLING || m.type === MutationType.TRANSFER) {
              mutationDelta -= m.count;
            }
          });

          const transferInMutations = mutations.filter(m => 
            m.targetHouseId === activeBatch.houseId && 
            m.type === MutationType.TRANSFER &&
            toLocalYYYYMMDD(m.date) >= toLocalYYYYMMDD(activeBatch.arrivalDate) && 
            toLocalYYYYMMDD(m.date) <= dateStr
          );
          transferInMutations.forEach(m => {
            mutationDelta += m.count;
          });

          historicalPop = Math.max(0, activeBatch.initialCount + mutationDelta);
        }

        const avgHdp = logCount > 0 && historicalPop > 0 ? ((totalEggCount / logCount) / historicalPop) * 100 : null;

        result.push({
          name: `W${weeks - i}`,
          produksi: totalProd,
          pakan: totalPakan,
          hdp: avgHdp ? parseFloat(avgHdp.toFixed(1)) : null,
          standar: getStrainStandardHDP(Math.max(1, ageWeeks - i)),
          mortalitas: totalMortality,
        });
      }
    } else if (chartPeriod === 'BULANAN') {
      const months = 6;
      for (let i = months - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthStr = d.toISOString().slice(0, 7);

        const year = d.getFullYear();
        const month = d.getMonth() + 1;
        const lastDay = new Date(year, month, 0).getDate();
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

        let totalProd = 0, totalPakan = 0, totalMortality = 0, totalEggCount = 0, logCount = 0;

        houseLogs.forEach(l => {
          if (toLocalYYYYMMDD(l.date).startsWith(monthStr)) {
            totalProd += (l.totalButir ?? 0);
            totalPakan += l.feedConsumed;
            totalMortality += l.mortality;
            totalEggCount += l.eggCount;
            logCount++;
          }
        });

        // Calculate historical population for the end of this month
        let historicalPop = activeBatch ? activeBatch.initialCount : currentCount;
        if (activeBatch) {
          const flockMutations = mutations.filter(m => 
            m.houseId === activeBatch.houseId && 
            toLocalYYYYMMDD(m.date) >= toLocalYYYYMMDD(activeBatch.arrivalDate) && 
            toLocalYYYYMMDD(m.date) <= dateStr
          );
          
          let mutationDelta = 0;
          flockMutations.forEach(m => {
            if (m.type === MutationType.ARRIVAL) {
              if (!(toLocalYYYYMMDD(m.date) === toLocalYYYYMMDD(activeBatch.arrivalDate) && m.count === activeBatch.initialCount)) {
                mutationDelta += m.count;
              }
            } else if (m.type === MutationType.MORTALITY || m.type === MutationType.CULLING || m.type === MutationType.TRANSFER) {
              mutationDelta -= m.count;
            }
          });

          const transferInMutations = mutations.filter(m => 
            m.targetHouseId === activeBatch.houseId && 
            m.type === MutationType.TRANSFER &&
            toLocalYYYYMMDD(m.date) >= toLocalYYYYMMDD(activeBatch.arrivalDate) && 
            toLocalYYYYMMDD(m.date) <= dateStr
          );
          transferInMutations.forEach(m => {
            mutationDelta += m.count;
          });

          historicalPop = Math.max(0, activeBatch.initialCount + mutationDelta);
        }

        const avgHdp = logCount > 0 && historicalPop > 0 ? ((totalEggCount / logCount) / historicalPop) * 100 : null;

        result.push({
          name: d.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' }),
          produksi: totalProd,
          pakan: totalPakan,
          hdp: avgHdp ? parseFloat(avgHdp.toFixed(1)) : null,
          standar: getStrainStandardHDP(Math.max(1, ageWeeks - (i * 4))),
          mortalitas: totalMortality,
        });
      }
    }

    return result;
  }, [houseLogs, chartPeriod, currentCount, ageWeeks, mutations, activeBatch]);

  // ── Key Metrics ─────────────────────────────────────────────────────────────
  const lastLog = houseLogs.at(-1);
  const standardHDP = getStrainStandardHDP(ageWeeks);
  const todayHDP = lastLog && currentCount > 0 ? (lastLog.eggCount / currentCount) * 100 : 0;

  const totalFeed = houseLogs.reduce((a, b) => a + b.feedConsumed, 0);
  const totalEggWeightKg = houseLogs.reduce((a, b) => a + (b.eggWeight || (b.eggCount * 0.0625)), 0);
  const cumulativeFCR = totalEggWeightKg > 0 ? totalFeed / totalEggWeightKg : 0;

  const feedIntakePerBird = lastLog && currentCount > 0 ? (lastLog.feedConsumed * 1000) / currentCount : 0;

  const totalMortality = useMemo(() =>
    mutations.filter(m => m.houseId === activeHouse?.id && m.type === MutationType.MORTALITY).reduce((a, b) => a + b.count, 0),
    [mutations, activeHouse]);

  const mortalityPct = activeBatch && (activeBatch as any).initialCount > 0
    ? (totalMortality / (activeBatch as any).initialCount) * 100 : 0;

  // ── Population Trend ────────────────────────────────────────────────────────
  const lastMutation = mutations.filter(m => m.houseId === activeHouse?.id || m.targetHouseId === activeHouse?.id)[0];

  // ── Feed Stock Alert ────────────────────────────────────────────────────────
  const feedItems = inventory.filter(i => (i.type === 'FINISHED_FEED' || i.type === 'RAW_MATERIAL') && i.houseId === activeHouse?.id);
  const lowStockItems = feedItems.filter(i => i.quantity <= i.reorderPoint);

  // ── Financial Analytics (Centralized HPP & P&L) ──────────────────────────
  const analytics = useMemo(() => 
    getFlockAnalytics(activeHouse?.id || '', currentCount, activeBatch?.arrivalDate),
    [getFlockAnalytics, activeHouse, currentCount, activeBatch?.arrivalDate]
  );
  
  const netPL = analytics.netPL || 0;
  const totalRevenue = salesLogs
    .filter(s => s.houseId === activeHouse?.id && !s.isFree)
    .reduce((a, b) => a + b.total, 0);

  // ── Egg breakdown summary (last log) ──────────────────────────────────────
  const eggBreakdownData = lastLog && lastLog.breakdown ? [
    { name: 'Normal', value: (lastLog.breakdown[EggCategory.BM] || 0) + (lastLog.breakdown[EggCategory.KRC] || 0) + (lastLog.breakdown[EggCategory.KS] || 0) + (lastLog.breakdown[EggCategory.PELOR] || 0), fill: '#22c55e' },
    { name: 'Retak', value: (lastLog.breakdown[EggCategory.RETAK] || 0) + (lastLog.breakdown[EggCategory.KRC_RETAK] || 0) + (lastLog.breakdown[EggCategory.KS_RETAK] || 0), fill: '#f59e0b' },
    { name: 'Pecah', value: (lastLog.breakdown[EggCategory.PECAH] || 0), fill: '#ef4444' },
  ].filter(d => d.value > 0) : [];

  return (
    <div className="space-y-6 pb-12">
      {/* House Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-slate-900 uppercase tracking-tighter italic">
            Dashboard <span className="text-amber-500">{activeHouse?.name}</span>
          </h1>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
            {activeBatch
              ? `${activeBatch.strain} · Umur ${ageWeeks} Minggu · ${currentCount.toLocaleString()} Ekor`
              : 'Belum ada batch aktif'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {['HARIAN', 'MINGGUAN', 'BULANAN'].map(n => (
            <button key={n} onClick={() => setChartPeriod(n as any)}
              className={cn('px-3 py-1.5 text-[9px] font-black uppercase tracking-widest border transition-all',
                chartPeriod === n ? 'bg-slate-900 text-white border-slate-900' : 'text-slate-400 border-slate-200 hover:border-slate-400')}>
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <KpiCard
          label="Populasi Aktif"
          value={currentCount.toLocaleString()}
          sub={activeBatch ? `Dari ${activeBatch.initialCount.toLocaleString()} ekor` : 'N/A'}
          icon={Users}
          progress={activeBatch ? (currentCount / activeBatch.initialCount) * 100 : 0}
          trend={lastMutation ? (lastMutation.type === MutationType.ARRIVAL ? 'up' : 'down') : 'neutral'}
          trendLabel={lastMutation ? `${lastMutation.type.replace('_', ' ')}: ${lastMutation.count}` : 'Stabil'}
          accentClass="bg-white border-slate-200"
        />
        <KpiCard
          label="HDP Hari Ini"
          value={`${todayHDP.toFixed(1)}%`}
          sub={`Std ${ageWeeks}mg: ${standardHDP}%`}
          icon={Activity}
          progress={todayHDP}
          trend={todayHDP >= standardHDP ? 'up' : 'down'}
          trendLabel={todayHDP >= standardHDP ? 'Sesuai Standar' : `−${(standardHDP - todayHDP).toFixed(1)}%`}
          accentClass={todayHDP >= standardHDP ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}
        />
        <KpiCard
          label="FCR Kumulatif"
          value={cumulativeFCR.toFixed(2)}
          sub={`Target: < ${farmSettings.targetFCR.toFixed(2)}`}
          icon={TrendingUp}
          trend={cumulativeFCR < farmSettings.targetFCR ? 'up' : 'down'}
          trendLabel={cumulativeFCR < farmSettings.targetFCR ? 'Efisien' : 'Di atas target'}
        />
        <KpiCard
          label="Mortalitas Siklus"
          value={`${mortalityPct.toFixed(2)}%`}
          sub={`Batas: ${farmSettings.mortalityAlertThreshold}%/bln`}
          icon={Skull}
          trend={mortalityPct < farmSettings.mortalityAlertThreshold ? 'up' : 'down'}
          trendLabel={mortalityPct < farmSettings.mortalityAlertThreshold ? 'Aman' : 'Perhatian!'}
          accentClass={mortalityPct >= farmSettings.mortalityAlertThreshold ? 'bg-rose-50 border-rose-200' : 'bg-white border-slate-200'}
        />
      </div>


      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Main Chart — HDP Trend vs Standard */}
        <div className="lg:col-span-8 bg-white border border-slate-200 shadow-sm">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div>
              <h3 className="font-bold text-sm text-slate-700">Tren HDP vs Kurva Standar Strain</h3>
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">{chartPeriod} · {activeHouse?.name}</p>
            </div>
            <BarChart3 size={18} className="text-slate-300" />
          </div>
          <div className="p-4 h-[250px] lg:h-[300px]">
            {houseLogs.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradHDP" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8' }} dy={6} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8' }} domain={[0, 100]} unit="%" />
                  <Tooltip contentStyle={{ borderRadius: '4px', border: '1px solid #e2e8f0', fontSize: '11px' }} />
                  <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '8px' }} />
                  <Area type="monotone" dataKey="hdp" name="HDP Aktual (%)" stroke="#f59e0b" strokeWidth={2} fill="url(#gradHDP)" connectNulls dot={{ r: 3, fill: '#f59e0b' }} />
                  <Line type="monotone" dataKey="standar" name="Standar Strain (%)" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="6 3" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Belum ada data produksi untuk grafik</p>
              </div>
            )}
          </div>
        </div>

        {/* Smart Warning Panel */}
        <div className="lg:col-span-4 bg-slate-900 text-white border border-slate-800 shadow-xl p-6 relative overflow-hidden min-h-[300px]">
          <div className="absolute top-0 right-0 p-4 opacity-[0.06] pointer-events-none">
            <AlertTriangle size={80} />
          </div>
          <h3 className="text-amber-500 text-[9px] font-black uppercase tracking-[0.25em] mb-5 flex items-center gap-2">
            <Activity size={12} /> Smart Warning System
          </h3>
          <div className="space-y-5">
            {/* HDP Alert */}
            <div className="flex gap-3 items-start">
              <div className={cn('w-1.5 h-1.5 rounded-full mt-1.5 ring-4 shrink-0',
                todayHDP >= standardHDP ? 'bg-emerald-500 ring-emerald-500/20' : 'bg-rose-500 ring-rose-500/20')} />
              <div>
                <p className={cn('text-xs font-bold', todayHDP >= standardHDP ? 'text-emerald-400' : 'text-rose-400')}>
                  {todayHDP >= standardHDP ? '✓ HDP Sesuai Standar' : '⚠ HDP Di Bawah Standar'}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">
                  {lastLog
                    ? `Aktual: ${todayHDP.toFixed(1)}% vs Standar: ${standardHDP}% (Umur ${ageWeeks}mg)`
                    : 'Belum ada data produksi hari ini'}
                </p>
              </div>
            </div>

            {/* Stock Alert */}
            {lowStockItems.length > 0 ? (
              <div className="flex gap-3 items-start border-t border-slate-800 pt-5">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 ring-4 ring-amber-500/20 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-amber-400">⚠ Stok Pakan Menipis</p>
                  <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">
                    {lowStockItems.map(i => `${i.name}: ${i.quantity.toFixed(0)} ${i.unit}`).join(' · ')}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex gap-3 items-start border-t border-slate-800 pt-5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 ring-4 ring-emerald-500/20 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-emerald-400">✓ Stok Pakan Aman</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Semua bahan baku di atas reorder point</p>
                </div>
              </div>
            )}

            {/* FCR Alert */}
            <div className="flex gap-3 items-start border-t border-slate-800 pt-5">
              <div className={cn('w-1.5 h-1.5 rounded-full mt-1.5 ring-4 shrink-0',
                cumulativeFCR < farmSettings.targetFCR ? 'bg-emerald-500 ring-emerald-500/20' : 'bg-amber-500 ring-amber-500/20')} />
              <div>
                <p className={cn('text-xs font-bold', cumulativeFCR < farmSettings.targetFCR ? 'text-emerald-400' : 'text-amber-400')}>
                  FCR {cumulativeFCR > 0 ? cumulativeFCR.toFixed(2) : '-'} · {cumulativeFCR < farmSettings.targetFCR ? 'Efisien' : 'Di atas target'}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">Target ideal: &lt; {farmSettings.targetFCR.toFixed(2)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Feed vs Production Chart */}
        <div className="col-span-1 lg:col-span-5 bg-white border border-slate-200 shadow-sm">
          <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
            <h3 className="font-bold text-sm text-slate-700">Konsumsi Pakan vs Produksi Telur</h3>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">{chartPeriod}</p>
          </div>
          <div className="p-4 h-[220px]">
            {houseLogs.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 8, fill: '#94a3b8' }} dy={4} />
                  <YAxis yAxisId="left" orientation="left" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#f59e0b' }} />
                  <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#0f172a' }} />
                  <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '4px' }} />
                  <Legend wrapperStyle={{ fontSize: '10px' }} />
                  <Bar yAxisId="right" dataKey="pakan" name="Pakan (kg)" fill="#0f172a" radius={[2, 2, 0, 0]} />
                  <Bar yAxisId="left" dataKey="produksi" name="Telur (butir)" fill="#f59e0b" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center">
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Belum ada data</p>
              </div>
            )}
          </div>
        </div>

        {/* Mortality Trend Chart */}
        <div className="col-span-1 lg:col-span-4 bg-white border border-slate-200 shadow-sm">
          <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
            <h3 className="font-bold text-sm text-slate-700">Tren Mortalitas Harian</h3>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Ekor/hari</p>
          </div>
          <div className="p-4 h-[220px]">
            {houseLogs.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradMort" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 8, fill: '#94a3b8' }} dy={4} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8' }} />
                  <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '4px' }} />
                  <Area type="monotone" dataKey="mortalitas" name="Mortalitas (ekor)" stroke="#ef4444" strokeWidth={2} fill="url(#gradMort)" connectNulls dot={{ r: 3, fill: '#ef4444' }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center">
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Belum ada data</p>
              </div>
            )}
          </div>
        </div>

        {/* Egg Breakdown Today */}
        <div className="col-span-1 lg:col-span-3 space-y-4">
          <div className="bg-white border border-slate-200 p-5 shadow-sm">
            <h3 className="font-bold text-sm text-slate-700 mb-4 flex items-center gap-2">
              <Egg size={14} className="text-amber-500" /> Telur Hari Ini
            </h3>
            {lastLog && eggBreakdownData.length > 0 ? (
              <div className="space-y-3">
                {eggBreakdownData.map(item => (
                  <div key={item.name}>
                    <div className="flex justify-between text-[10px] font-bold mb-1">
                      <span className="text-slate-600">{item.name}</span>
                      <span style={{ color: item.fill }}>{item.value.toLocaleString()} butir</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(item.value / (lastLog.totalKg || 1)) * 100}%` }}
                        transition={{ duration: 0.7 }}
                        className="h-full rounded-full"
                        style={{ backgroundColor: item.fill }}
                      />
                    </div>
                  </div>
                ))}
                <div className="pt-2 border-t border-slate-100 flex justify-between">
                  <span className="text-[9px] text-slate-400 font-bold uppercase">Total</span>
                  <span className="text-[10px] font-black text-slate-900">{(lastLog.totalButir ?? 0).toLocaleString()} butir</span>
                </div>
              </div>
            ) : (
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest text-center py-4">Belum ada produksi hari ini</p>
            )}
          </div>

          {/* Population Summary */}
          <div className="bg-slate-900 border border-slate-800 p-5 text-white relative overflow-hidden">
            <h3 className="text-amber-500 text-[9px] font-black uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
              <Activity size={12} /> Ringkasan Populasi
            </h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[8px] text-slate-500 uppercase font-bold tracking-widest mb-1">DOC Masuk</p>
                  <p className="text-sm font-black text-emerald-400">
                    {mutations.filter(m => m.houseId === activeHouse?.id && m.type === MutationType.ARRIVAL).reduce((a, b) => a + b.count, 0).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-[8px] text-slate-500 uppercase font-bold tracking-widest mb-1">Mati/Afkir</p>
                  <p className="text-sm font-black text-rose-400">
                    {(totalMortality + mutations.filter(m => m.houseId === activeHouse?.id && m.type === MutationType.CULLING).reduce((a, b) => a + b.count, 0)).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800">
                <p className="text-[8px] text-slate-500 uppercase font-bold tracking-widest mb-2">Mutasi Terakhir</p>
                <div className="space-y-2">
                  {mutations.filter(m => m.houseId === activeHouse?.id || m.targetHouseId === activeHouse?.id).slice(0, 3).map(m => (
                    <div key={m.id} className="flex items-center justify-between text-[9px] bg-white/5 p-2 rounded-sm">
                      <span className="text-slate-400 font-bold uppercase">{m.type.replace('_', ' ')}</span>
                      <span className={cn('font-black italic', (m.type === MutationType.ARRIVAL || m.targetHouseId === activeHouse?.id) ? 'text-emerald-400' : 'text-rose-400')}>
                        {(m.type === MutationType.ARRIVAL || m.targetHouseId === activeHouse?.id) ? '+' : '-'}{m.count}
                      </span>
                    </div>
                  ))}
                  {mutations.length === 0 && <p className="text-[8px] text-slate-600 italic">Belum ada mutasi</p>}
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}