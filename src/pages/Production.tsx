/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Egg, Save, History, Activity, TrendingUp, Flame, AlertTriangle, Clock, User as UserIcon, X } from 'lucide-react';
import { EggCategory, ItemType, MortalityCause } from '../types';
import { getEggCategoryRange, cn } from '../lib/utils';
import { motion } from 'motion/react';
import Swal from 'sweetalert2';

import { useHouse } from '../HouseContext';
import { useFlock } from '../FlockContext';
import { useGlobalData } from '../GlobalContext';
import { useApp } from '../AppContext';

// Strain HDP standard by age week (simplified ISA Brown / Lohmann)
function getStrainStandardHDP(ageWeeks: number): number {
  if (ageWeeks < 18) return 0;
  if (ageWeeks < 22) return 50;
  if (ageWeeks < 26) return 80;
  if (ageWeeks < 30) return 92;
  if (ageWeeks < 50) return 94;
  if (ageWeeks < 65) return 88;
  return 78;
}

const MORTALITY_CAUSE_LABELS: Record<MortalityCause, string> = {
  [MortalityCause.DISEASE]: 'Penyakit / Infeksi',
  [MortalityCause.CULLED]: 'Afkir (Dikeluarkan)',
  [MortalityCause.OTHER]: 'Lainnya',
};

export default function Production() {
  const { activeHouse } = useHouse();
  const { saveProduction, inventory, getCumulativeFCR, productionLogs, farmSettings, getHHP } = useGlobalData();
  const { updateFlock, getActiveFlockByHouse } = useFlock();
  const { user } = useApp();

  const [showHistory, setShowHistory] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const activeBatch = getActiveFlockByHouse(activeHouse?.id || '');

  // Form state
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [mortality, setMortality] = useState(0);
  const [mortalityCause, setMortalityCause] = useState<MortalityCause>(MortalityCause.DISEASE);
  const [feedConsumed, setFeedConsumed] = useState(0);
  const [feedInventoryItemId, setFeedInventoryItemId] = useState('');
  const [discardedEggs, setDiscardedEggs] = useState(0);

  const [breakdown, setBreakdown] = useState<Record<string, number>>({
    [EggCategory.BM]: 0, [EggCategory.KRC]: 0, [EggCategory.KS]: 0,
    [EggCategory.PELOR]: 0, [EggCategory.RETAK]: 0, [EggCategory.PECAH]: 0,
    [EggCategory.KRC_RETAK]: 0, [EggCategory.KS_RETAK]: 0,
  });
  const [actualEggWeight, setActualEggWeight] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleBreakdownChange = (cat: string, val: number) =>
    setBreakdown(prev => ({ ...prev, [cat]: Math.max(0, val) }));

  const totalBreakdownButir = useMemo(() =>
    Object.values(breakdown).reduce((a: number, b: unknown) => a + (b as number), 0), [breakdown]);

  const eggCount = totalBreakdownButir;
  const pecahCount = breakdown[EggCategory.PECAH] || 0;
  const retakCount = (breakdown[EggCategory.RETAK] || 0) + (breakdown[EggCategory.KRC_RETAK] || 0) + (breakdown[EggCategory.KS_RETAK] || 0);

  // 7-Day Rolling Average Egg Weight
  const rollingAvgWeight = useMemo(() => {
    const logs = productionLogs
      .filter(l => l.houseId === activeHouse?.id && l.eggCount > 0 && l.eggWeight > 0)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 7);
    
    if (logs.length === 0) return 0.0625; // default 62.5g
    const totalW = logs.reduce((acc, l) => acc + l.eggWeight, 0);
    const totalC = logs.reduce((acc, l) => acc + (l.totalButir || l.eggCount), 0);
    return totalC > 0 ? totalW / totalC : 0.0625;
  }, [productionLogs, activeHouse]);

  // Auto calculate weight in KG based on standard or 7-day rolling average
  const eggWeight = useMemo(() => {
    if (totalBreakdownButir > 0) {
       return totalBreakdownButir * rollingAvgWeight;
    }
    return 0;
  }, [totalBreakdownButir, rollingAvgWeight]);
  // Feed items from inventory
  const feedItems = useMemo(() =>
    inventory.filter(i => i.type === ItemType.FINISHED_FEED || i.type === ItemType.RAW_MATERIAL),
    [inventory]
  );

  // Set default feed item
  const selectedFeedItem = feedItems.find(i => i.id === feedInventoryItemId) || feedItems[0];

  // Age calculation
  const calculateAge = (arrivalDate: string, arrivalAgeWeeks: number, targetDate: string) => {
    if (!arrivalDate) return { weeks: 0, days: 0 };
    const start = new Date(arrivalDate);
    const end = new Date(targetDate);
    const diffDays = Math.floor((end.getTime() - start.getTime()) / 86400000);
    const totalDays = diffDays + arrivalAgeWeeks * 7;
    return { weeks: Math.floor(totalDays / 7), days: totalDays % 7 };
  };

  const age = useMemo(() => {
    if (!activeBatch) return { weeks: 0, days: 0 };
    return calculateAge(activeBatch.arrivalDate, activeBatch.arrivalAgeWeeks, date);
  }, [activeBatch, date]);

  // Abnormal Ratios
  const abnormalRatio = useMemo(() => {
    if (eggCount === 0) return 0;
    return ((pecahCount + retakCount + discardedEggs) / eggCount) * 100;
  }, [eggCount, pecahCount, retakCount, discardedEggs]);

  const isAbnormalHigh = abnormalRatio > (farmSettings.abnormalEggTolerancePct || 2);

  // Live FCR (Feed vs Egg Weight)
  const currentFCR = useMemo(() => {
    if (eggWeight > 0 && feedConsumed > 0)
      return (feedConsumed / eggWeight).toFixed(2);
    return '0.00';
  }, [feedConsumed, eggWeight]);

  // HDP calculation
  const hdp = useMemo(() => {
    if (!activeBatch || activeBatch.currentCount === 0 || eggCount === 0) return 0;
    return (eggCount / activeBatch.currentCount) * 100;
  }, [eggCount, activeBatch]);

  // HHP calculation
  const hhp = useMemo(() => {
    if (!activeBatch || activeBatch.initialCount === 0) return 0;
    // Current day's HHP portion + historical
    return getHHP(activeHouse?.id || '', activeBatch.initialCount, activeBatch.arrivalDate) + (eggCount / activeBatch.initialCount);
  }, [eggCount, activeBatch, activeHouse, getHHP]);


  const standardHDP = getStrainStandardHDP(age.weeks);

  // Cumulative FCR
  const cumulativeFCR = getCumulativeFCR(activeHouse?.id || '', activeBatch?.arrivalDate);

  // Feed intake per bird (grams)
  const feedIntakePerBird = useMemo(() => {
    if (!activeBatch || activeBatch.currentCount === 0 || feedConsumed === 0) return 0;
    return (feedConsumed * 1000) / activeBatch.currentCount;
  }, [feedConsumed, activeBatch]);

  const handleSave = () => {
    if (!eggCount || !feedConsumed || totalBreakdownButir === 0) {
      Swal.fire({ title: 'Data Tidak Lengkap', text: 'Isi total produksi, pakan, dan klasifikasi telur.', icon: 'warning', confirmButtonColor: '#0f172a' });
      return;
    }
    const effectiveFeedId = feedInventoryItemId || feedItems[0]?.id || '';
    const feedItem = inventory.find(i => i.id === effectiveFeedId);
    if (feedItem && feedItem.quantity < feedConsumed) {
      Swal.fire({ title: 'Stok Pakan Tidak Cukup!', text: `Stok ${feedItem.name}: ${feedItem.quantity} kg, dibutuhkan: ${feedConsumed} kg.`, icon: 'error', confirmButtonColor: '#0f172a' });
      return;
    }

    setIsSaving(true);
    Swal.fire({
      title: 'Simpan Produksi?',
      html: `
        <div class="text-left mt-4 text-sm space-y-1">
          <p>Umur Ayam: <b>${age.weeks}m ${age.days}h</b></p>
          <p>Pakan (${feedItem?.name || '-'}): <b>${feedConsumed} kg</b></p>
          <p>Total Telur: <b>${totalBreakdownButir.toLocaleString()} butir</b></p>
          <p>Berat Telur: <b>${(actualEggWeight || eggWeight).toFixed(2)} kg</b></p>
          <p>HDP: <b>${hdp.toFixed(1)}%</b> (Std: ${standardHDP}%)</p>
          <hr class="my-2"/>
          <p class="text-amber-600 font-bold text-base">FCR Hari Ini: ${(feedConsumed / (actualEggWeight || eggWeight || 1)).toFixed(2)}</p>
          ${mortality > 0 ? `<p class="text-rose-600 font-bold">Mortalitas: ${mortality} ekor (${MORTALITY_CAUSE_LABELS[mortalityCause]})</p>` : ''}
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#0f172a',
      cancelButtonColor: '#f1f5f9',
      confirmButtonText: 'Ya, Simpan',
      cancelButtonText: 'Batal',
    }).then(async result => {
      if (result.isConfirmed) {
        setIsSaving(true);
        try {
          await saveProduction({
            houseId: activeHouse?.id || '',
            date,
            eggCount,
            eggWeight: actualEggWeight || eggWeight,
            feedConsumed,
            feedInventoryItemId: effectiveFeedId,
            mortality,
            mortalityCause: mortality > 0 ? mortalityCause : undefined,
            discardedEggs,
            abnormalEggCount: pecahCount + retakCount + discardedEggs,
            breakdown,
            totalButir: totalBreakdownButir,
            inputTime: new Date().toISOString(),
            inputBy: user?.name || 'Sistem',
          });

          if (mortality > 0 && activeBatch) {
            updateFlock(activeBatch.id, { currentCount: activeBatch.currentCount - mortality });
            // Mortality threshold alert
            const threshold = farmSettings.mortalityAlertThreshold;
            const mortalityPct = (mortality / activeBatch.currentCount) * 100;
            if (mortalityPct > threshold) {
              Swal.fire({
                title: '⚠️ Mortalitas Melebihi Ambang Batas!',
                html: `<div class="text-sm"><p>Mortalitas hari ini: <b>${mortality} ekor (${mortalityPct.toFixed(2)}%)</b></p><p>Ambang batas normal: <b>${threshold}%</b></p><p class="text-red-500 font-bold mt-2">Segera periksa kondisi kandang dan konsultasikan ke dokter hewan!</p></div>`,
                icon: 'warning',
                confirmButtonColor: '#e11d48',
              });
            } else {
              Swal.fire({ title: 'Berhasil!', text: 'Data produksi harian disimpan & inventori diperbarui.', icon: 'success', confirmButtonColor: '#0f172a' });
            }
          } else {
            Swal.fire({ title: 'Berhasil!', text: 'Data produksi harian disimpan & inventori diperbarui.', icon: 'success', confirmButtonColor: '#0f172a' });
          }

          setMortality(0); setFeedConsumed(0); setDiscardedEggs(0); setActualEggWeight(null);
          setBreakdown({ [EggCategory.BM]: 0, [EggCategory.KRC]: 0, [EggCategory.KS]: 0, [EggCategory.PELOR]: 0, [EggCategory.RETAK]: 0, [EggCategory.PECAH]: 0, [EggCategory.KRC_RETAK]: 0, [EggCategory.KS_RETAK]: 0 });
        } catch (error: any) {
          Swal.fire({ title: 'Gagal', text: error.message || 'Terjadi kesalahan saat menyimpan data.', icon: 'error' });
        } finally {
          setIsSaving(false);
        }
      } else {
        setIsSaving(false);
      }
    });
  };

  const handleReset = () => {
    Swal.fire({ title: 'Reset Form?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#e11d48', confirmButtonText: 'Reset' })
      .then(r => { if (r.isConfirmed) { setMortality(0); setFeedConsumed(0); setDiscardedEggs(0); setBreakdown({ [EggCategory.BM]: 0, [EggCategory.KRC]: 0, [EggCategory.KS]: 0, [EggCategory.PELOR]: 0, [EggCategory.RETAK]: 0, [EggCategory.PECAH]: 0, [EggCategory.KRC_RETAK]: 0, [EggCategory.KS_RETAK]: 0 }); } });
  };

  const houseProdLogs = useMemo(() => productionLogs
    .filter(l => l.houseId === activeHouse?.id)
    .sort((a, b) => b.date.localeCompare(a.date)),
    [productionLogs, activeHouse]);

  const paginatedLogs = houseProdLogs.slice((historyPage - 1) * ITEMS_PER_PAGE, historyPage * ITEMS_PER_PAGE);
  const totalPages = Math.ceil(houseProdLogs.length / ITEMS_PER_PAGE) || 1;

  return (
    <div className="max-w-5xl mx-auto space-y-4 lg:space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-slate-900 uppercase tracking-tighter italic">
            Input Produksi <span className="text-amber-500">{activeHouse?.name}</span>
          </h1>
          <p className="text-slate-500 text-[10px] mt-1 uppercase font-bold tracking-widest">
            {activeBatch
              ? <><span className="text-slate-400">Strain: {activeBatch.strain}</span> · <span className="text-emerald-600 font-black">Umur: {age.weeks}m {age.days}h</span></>
              : <span className="text-rose-500">⚠ Belum ada batch aktif</span>}
          </p>
        </div>
        <button onClick={() => setShowHistory(true)} className="bg-white border border-slate-200 px-4 py-2 shadow-sm flex items-center gap-2 hover:bg-slate-50 transition-colors">
          <History size={15} className="text-slate-400" />
          <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Riwayat</span>
        </button>
      </div>

      {/* Riwayat Modal */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 lg:p-4">
          <div className="bg-white w-full h-full lg:max-w-5xl lg:h-auto lg:max-h-[85vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
              <div>
                <h3 className="font-black text-slate-900 uppercase tracking-tight text-sm">Riwayat Produksi Harian</h3>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{activeHouse?.name} · Semua Catatan</p>
              </div>
              <button onClick={() => setShowHistory(false)} className="p-2 hover:bg-slate-100 rounded-sm text-slate-400 hover:text-slate-900 transition-colors"><X size={18} /></button>
            </div>
            <div className="overflow-auto flex-1">
              <table className="w-full text-left text-[10px] min-w-max">
                <thead className="bg-slate-900 text-white sticky top-0">
                  <tr>
                    {['Tanggal', 'Jam Input', 'Diinput Oleh', 'Telur (butir)', 'Total (butir)', 'Pakan (kg)', 'FCR', 'Mati (ekor)', 'HDP %', 'Catatan'].map(h => (
                      <th key={h} className="px-3 py-3 font-bold uppercase tracking-widest whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedLogs.map((log, i) => {
                    const hdp = activeBatch && activeBatch.currentCount > 0
                      ? ((log.eggCount / activeBatch.currentCount) * 100).toFixed(1)
                      : '-';
                    const logTotalButir = log.totalButir ?? 0;
                    const logEggWeight = log.eggWeight || (logTotalButir * 0.0625);
                    const fcr = logEggWeight > 0 ? (log.feedConsumed / logEggWeight).toFixed(2) : '-';
                    return (
                      <tr key={log.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                        <td className="px-3 py-3 font-bold whitespace-nowrap">{new Date(log.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                        <td className="px-3 py-3 whitespace-nowrap flex items-center gap-1 text-slate-500">
                          <Clock size={10} />
                          {log.inputTime ? new Date(log.inputTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          <span className="flex items-center gap-1 text-slate-600 font-bold"><UserIcon size={10} />{log.inputBy || '-'}</span>
                        </td>
                        <td className="px-3 py-3 font-bold text-slate-900">{log.totalButir.toLocaleString()}</td>
                        <td className="px-3 py-3 font-bold text-emerald-600">{(log.eggWeight ?? 0).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg</td>
                        <td className="px-3 py-3">{log.feedConsumed}</td>
                        <td className="px-3 py-3 font-bold text-amber-600">{(log.feedConsumed / (log.eggWeight || 1)).toFixed(2)}</td>
                        <td className="px-3 py-3 font-bold text-rose-500">{log.mortality > 0 ? log.mortality : '-'}</td>
                        <td className="px-3 py-3 font-bold">{hdp}%</td>
                        <td className="px-3 py-3 text-slate-400">{log.mortalityCause ? MORTALITY_CAUSE_LABELS[log.mortalityCause] : '-'}</td>
                      </tr>
                    );
                  })}
                  {houseProdLogs.length === 0 && (
                    <tr><td colSpan={10} className="px-6 py-12 text-center text-slate-400 font-bold uppercase tracking-widest">Belum ada riwayat produksi</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
              <span className="text-[9px] text-slate-400 font-bold uppercase">Page {historyPage} of {totalPages} ({houseProdLogs.length} total)</span>
              <div className="flex gap-2">
                <button onClick={() => setHistoryPage(p => Math.max(1, p - 1))} disabled={historyPage === 1} className="px-3 py-1 bg-white border border-slate-200 text-slate-600 disabled:opacity-50 text-[10px] font-bold uppercase">Prev</button>
                <button onClick={() => setHistoryPage(p => Math.min(totalPages, p + 1))} disabled={historyPage >= totalPages} className="px-3 py-1 bg-white border border-slate-200 text-slate-600 disabled:opacity-50 text-[10px] font-bold uppercase">Next</button>
                <button onClick={() => setShowHistory(false)} className="px-4 py-1 ml-4 bg-slate-900 text-white text-[10px] font-bold uppercase tracking-widest hover:bg-slate-800 transition-colors">Tutup</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Analytics Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        {/* HDP */}
        <div className={cn(
          'p-4 border shadow-sm relative overflow-hidden',
          hdp >= standardHDP ? 'bg-emerald-50 border-emerald-200' : hdp > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200'
        )}>
          <TrendingUp size={40} className="absolute right-2 top-2 opacity-[0.07] hidden sm:block" />
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">HDP Hari Ini</p>
          <p className={cn('text-xl lg:text-2xl font-black italic', hdp >= standardHDP ? 'text-emerald-600' : 'text-amber-600')}>
            {hdp.toFixed(1)}%
          </p>
          <p className="text-[9px] text-slate-400 font-bold mt-1">Std: {standardHDP}%</p>
        </div>

        {/* HHP */}
        <div className={cn(
          'p-4 border shadow-sm relative overflow-hidden',
          hhp >= standardHDP ? 'bg-emerald-50 border-emerald-200' : hhp > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200'
        )}>
          <TrendingUp size={40} className="absolute right-2 top-2 opacity-[0.07] hidden sm:block" />
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">HHP Kumulatif</p>
          <p className={cn('text-xl lg:text-2xl font-black italic', hhp >= standardHDP ? 'text-emerald-600' : 'text-amber-600')}>
            {hhp.toFixed(2)}
          </p>
          <p className="text-[9px] text-slate-400 font-bold mt-1">Butir / Ekor (Awal)</p>
        </div>

        {/* FCR Live */}
        <div className="p-4 bg-slate-900 border border-slate-800 shadow-sm relative overflow-hidden">
          <Activity size={40} className="absolute right-2 top-2 opacity-[0.07] text-amber-500 hidden sm:block" />
          <p className="text-[9px] font-bold uppercase tracking-widest text-amber-500 mb-1">FCR Hari Ini</p>
          <p className="text-xl lg:text-2xl font-black italic text-white">{currentFCR}</p>
          <p className="text-[9px] text-slate-500 font-bold mt-1">Standar FCR: {farmSettings.targetFCR || 2.1}</p>
        </div>

        {/* Feed Intake per Bird */}
        <div className="p-4 bg-white border border-slate-200 shadow-sm relative overflow-hidden">
          <Flame size={40} className="absolute right-2 top-2 opacity-[0.05] hidden sm:block" />
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">Intake / Ekor</p>
          <p className="text-xl lg:text-2xl font-black italic text-slate-900">{feedIntakePerBird.toFixed(0)}<span className="text-sm font-bold text-slate-400 ml-1">g</span></p>
          <p className="text-[9px] text-slate-400 font-bold mt-1">Std layer: 110–120g</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
        {/* Left: Form Input */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white p-4 lg:p-6 border border-slate-200 shadow-sm space-y-4">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Tanggal</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-sm px-4 py-3 text-sm focus:outline-none focus:border-amber-500" />
            </div>

            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-sm">
              <label className="text-[10px] font-bold uppercase tracking-widest text-emerald-700 block mb-2">Berat Timbangan Riel (kg)</label>
              <input type="number" min="0" step="0.01" placeholder={eggWeight.toFixed(2)} value={actualEggWeight || ''} onChange={e => setActualEggWeight(Math.max(0, Number(e.target.value)))}
                className="w-full bg-white border border-emerald-300 rounded-sm px-4 py-3 text-sm font-black text-emerald-900 focus:outline-none focus:border-emerald-500" />
              <p className="text-[9px] text-emerald-600 mt-2 leading-relaxed italic">Biarkan kosong untuk menggunakan estimasi otomatis ({eggWeight.toFixed(2)} kg).</p>
            </div>

            {/* FIX #1: Feed Selector */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">
                Sumber Pakan <span className="text-rose-400">*</span>
              </label>
              <select
                value={feedInventoryItemId || feedItems[0]?.id || ''}
                onChange={e => setFeedInventoryItemId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-sm px-4 py-3 text-sm font-bold focus:outline-none focus:border-amber-500"
              >
                {feedItems.length === 0 && <option value="">-- Tidak ada pakan --</option>}
                {feedItems.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.quantity} {item.unit})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Pakan Konsumsi (kg)</label>
              <input type="number" min="0" placeholder="0.00" step="0.01" value={feedConsumed || ''} onChange={e => setFeedConsumed(Math.max(0, Number(e.target.value)))}
                className="w-full bg-slate-50 border border-slate-200 rounded-sm px-4 py-3 text-sm font-bold focus:outline-none focus:border-amber-500" />
            </div>

            {/* Mortalitas field removed from UI per requirement — still tracked internally */}

            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Telur Afkir/Dibuang</label>
              <input type="number" min="0" placeholder="0" value={discardedEggs || ''} onChange={e => setDiscardedEggs(Math.max(0, Number(e.target.value)))}
                className="w-full bg-slate-50 border border-slate-200 rounded-sm px-4 py-3 text-sm font-bold focus:outline-none focus:border-amber-500" />
            </div>
          </div>
        </div>

        {/* Right: Egg Classification */}
        <div className="lg:col-span-2">
          <div className="bg-white p-4 lg:p-8 border border-slate-200 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
              <Egg size={200} />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
              <div>
                <h3 className="font-black text-base text-slate-800 uppercase tracking-tighter italic">Input Klasifikasi Telur (Butir)</h3>
                <p className="text-[9px] text-emerald-600 font-bold uppercase tracking-widest mt-1">Masukkan jumlah butir untuk tiap kategori</p>
              </div>
              <div className="px-3 py-1 bg-amber-50 border border-amber-200 text-[10px] font-black text-amber-700 self-start sm:self-center">
                TOTAL: {totalBreakdownButir.toLocaleString()} BUTIR
              </div>
            </div>

            {isAbnormalHigh && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-rose-50 border border-rose-200 p-4 mb-6">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle size={16} className="text-rose-600" />
                  <h4 className="text-rose-800 font-bold text-sm uppercase tracking-tight">Peringatan: Abnormalitas Tinggi</h4>
                </div>
                <p className="text-rose-600 text-xs">
                  Tingkat telur pecah/abnormal mencapai <b>{abnormalRatio.toFixed(1)}%</b>.
                  Batas toleransi adalah <b>{farmSettings.abnormalEggTolerancePct || 2}%</b>.
                  Periksa nutrisi pakan atau stres pada ayam.
                </p>
              </motion.div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {Object.values(EggCategory).map(cat => (
                <div key={cat} className="space-y-1">
                  <div className="flex justify-between items-end">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">{cat}</span>
                  </div>
                  <div className="relative">
                      <input
                        type="number" min="0" placeholder="0" step="1"
                        value={breakdown[cat] || ''}
                        onChange={e => handleBreakdownChange(cat, Number(e.target.value))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-sm pl-4 pr-12 py-3 text-sm font-bold focus:outline-none focus:border-amber-500"
                      />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">butir</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 lg:mt-10 pt-6 border-t border-slate-100 flex items-center justify-end gap-3 lg:gap-4">
              <button disabled={isSaving} onClick={handleReset} className="px-4 lg:px-6 py-3 text-slate-400 font-bold text-[10px] lg:text-xs uppercase tracking-widest hover:text-slate-900 transition-colors">
                Reset
              </button>
              <button
                disabled={isSaving}
                onClick={handleSave}
                className="flex items-center gap-2 lg:gap-3 bg-slate-900 text-white px-6 lg:px-10 py-3 lg:py-4 rounded-sm font-bold text-[10px] lg:text-xs uppercase tracking-[0.2em] hover:bg-slate-800 transition-all shadow-xl disabled:opacity-50"
              >
                <Save size={16} />
                <span>{isSaving ? 'Menyimpan...' : 'Simpan Produksi'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}