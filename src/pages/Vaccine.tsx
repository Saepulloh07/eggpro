/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Syringe, Plus, Calendar, CheckCircle2, Clock, AlertTriangle,
  Trash2, Edit2, Activity, Shield, ChevronRight, Heart
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Swal from 'sweetalert2';
import { cn } from '../lib/utils';
import Modal from '../components/Modal';
import { useHouse } from '../HouseContext';
import { useFlock } from '../FlockContext';
import { useGlobalData } from '../GlobalContext';
import { BiosecurityRecord } from '../types';

// ─── Types ─────────────────────────────────────────────────────────────────────

type VaccineType = 'VAKSIN' | 'VITAMIN' | 'OBAT' | 'BIOSEKURITI';
type VaccineStatus = 'SCHEDULED' | 'DONE' | 'MISSED';
type VaccineRoute = 'Air Minum' | 'Suntik' | 'Tetes Mata' | 'Spray' | 'Oral';

// Use BiosecurityRecord from ../types


const getDOCAge = (arrivalDate: string, arrivalAgeWeeks: number) => {
  if (!arrivalDate) return 0;
  const arrival = new Date(arrivalDate);
  const today = new Date();
  const diffTime = today.getTime() - arrival.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays + (arrivalAgeWeeks * 7));
};

const TYPE_COLOR: Record<VaccineType, string> = {
  VAKSIN:      'bg-indigo-100 text-indigo-700 border-indigo-200',
  VITAMIN:     'bg-emerald-100 text-emerald-700 border-emerald-200',
  OBAT:        'bg-rose-100 text-rose-700 border-rose-200',
  BIOSEKURITI: 'bg-amber-100 text-amber-700 border-amber-200',
};


const TREATMENT_TEMPLATES = {
  OBAT_CACING: {
    name: 'Obat Cacing',
    dosagePerBird: 375,
    unit: 'mg',
    type: 'OBAT' as VaccineType,
    route: 'Oral' as VaccineRoute,
  },
  ANTISEPTIK: {
    name: 'Semprot Antiseptik',
    dosagePerBird: 35,
    unit: 'ml',
    type: 'BIOSEKURITI' as VaccineType,
    route: 'Spray' as VaccineRoute,
  },
  GUREM: {
    name: 'Semprot Gurem',
    type: 'BIOSEKURITI' as VaccineType,
    route: 'Spray' as VaccineRoute,
    composition: [
      { name: 'Mipcinta', amount: 200, unit: 'mg' },
      { name: 'Dalmat', amount: 2, unit: 'ml' },
      { name: 'Autan', amount: 1, unit: 'ml' },
      { name: 'Kututox (Oral)', amount: 0.1, unit: 'ml' },
    ]
  }
};


const STATUS_COLOR: Record<VaccineStatus, string> = {
  SCHEDULED: 'text-amber-600 bg-amber-50 border-amber-200',
  DONE:      'text-emerald-600 bg-emerald-50 border-emerald-200',
  MISSED:    'text-rose-600 bg-rose-50 border-rose-200',
};

const STATUS_LABEL: Record<VaccineStatus, string> = {
  SCHEDULED: 'Terjadwal',
  DONE:      'Selesai',
  MISSED:    'Terlewat',
};

const STORAGE_KEY = 'poultry_vaccine_records';

// ─── Default Schedule ───────────────────────────────────────────────────────────

const DEFAULT_SCHEDULE: Omit<BiosecurityRecord, 'id' | 'houseId'>[] = [
  { date: '', type: 'VAKSIN', name: 'ND-IB (Ma5+Clone 30) Live', route: 'Air Minum', dosage: '1 dosis/ekor', ageWeekTarget: 4, notes: 'Puasa air 2 jam sebelum pemberian', status: 'SCHEDULED' },
  { date: '', type: 'VAKSIN', name: 'Gumboro Intermediate', route: 'Air Minum', dosage: '1 dosis/ekor', ageWeekTarget: 10, notes: 'Pastikan kandang sejuk', status: 'SCHEDULED' },
  { date: '', type: 'VAKSIN', name: 'ND-IB Killed (H120)', route: 'Suntik', dosage: '0.5 ml/ekor', ageWeekTarget: 16, notes: 'Suntik subkutan di leher', status: 'SCHEDULED' },
  { date: '', type: 'VAKSIN', name: 'ND-IB Live Booster', route: 'Air Minum', dosage: '1 dosis/ekor', ageWeekTarget: 32, notes: 'Booster produksi', status: 'SCHEDULED' },
  { date: '', type: 'VITAMIN', name: 'Elektrolit + Multivitamin', route: 'Air Minum', dosage: '1g/liter air', ageWeekTarget: 20, notes: 'Selama 3 hari berturut-turut', status: 'SCHEDULED' },
];

// ─── Component ─────────────────────────────────────────────────────────────────

const EMPTY_FORM: Omit<BiosecurityRecord, 'id' | 'houseId'> = {
  date: new Date().toISOString().split('T')[0],
  type: 'VAKSIN',
  name: '',
  route: 'Air Minum',
  dosage: '',
  ageWeekTarget: 0,
  ageDayTarget: 0,
  notes: '',
  status: 'SCHEDULED',
};

const ITEMS_PER_PAGE = 5;

export default function Vaccine() {
  const { activeHouse } = useHouse();
  const { getActiveFlockByHouse } = useFlock();
  const { biosecurityRecords, addBiosecurityRecord, addBiosecurityRecordsBulk, updateBiosecurityRecord, deleteBiosecurityRecord } = useGlobalData();

  
  const activeBatch = getActiveFlockByHouse(activeHouse?.id || '');
  const docAge = activeBatch ? getDOCAge(activeBatch.arrivalDate, activeBatch.arrivalAgeWeeks) : 0;

  const records = biosecurityRecords;


  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<BiosecurityRecord | null>(null);
  const [form, setForm] = useState<Omit<BiosecurityRecord, 'id' | 'houseId'>>(EMPTY_FORM as any);
  const [activeFilter, setActiveFilter] = useState<VaccineStatus | 'ALL'>('ALL');

  const [currentPage, setCurrentPage] = useState(1);

  const houseRecords = records.filter(r => r.houseId === activeHouse?.id);

  const sortedRecords = [...houseRecords].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const filteredRecords = activeFilter === 'ALL'
    ? sortedRecords
    : sortedRecords.filter(r => r.status === activeFilter);

  // Pagination Logic
  const totalPages = Math.ceil(filteredRecords.length / ITEMS_PER_PAGE);
  const paginatedRecords = filteredRecords.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeFilter]);

  // Stats
  const doneCount = houseRecords.filter(r => r.status === 'DONE').length;
  const scheduledCount = houseRecords.filter(r => r.status === 'SCHEDULED').length;
  const missedCount = houseRecords.filter(r => r.status === 'MISSED').length;

  // Upcoming (next 7 days)
  const today = new Date();
  const upcomingRecords = houseRecords.filter(r => {
    if (r.status !== 'SCHEDULED' || !r.date) return false;
    const d = new Date(r.date);
    const diff = (d.getTime() - today.getTime()) / 86400000;
    return diff >= 0 && diff <= 7;
  });

  const openAddModal = () => {
    setEditingRecord(null);
    setForm({ ...EMPTY_FORM, date: new Date().toISOString().split('T')[0] });
    setIsModalOpen(true);
  };

  const openEditModal = (rec: BiosecurityRecord) => {
    setEditingRecord(rec);
    const { id, houseId, ...rest } = rec;
    setForm(rest as any);
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!form.name || !form.date) {
      Swal.fire({ title: 'Data Tidak Lengkap', text: 'Nama vaksin dan tanggal wajib diisi.', icon: 'warning', confirmButtonColor: '#0f172a' });
      return;
    }
    if (editingRecord) {
      updateBiosecurityRecord(editingRecord.id, form as any);
    } else {
      addBiosecurityRecord({ ...form, houseId: activeHouse?.id || '' } as any);
    }
    setIsModalOpen(false);
    Swal.fire({ title: 'Tersimpan!', icon: 'success', confirmButtonColor: '#0f172a', timer: 1500, showConfirmButton: false });
  };

  const handleStatusChange = (id: string, status: VaccineStatus) => {
    updateBiosecurityRecord(id, { status } as any);
  };

  const handleDelete = (id: string) => {
    Swal.fire({
      title: 'Hapus Jadwal?', icon: 'warning', showCancelButton: true,
      confirmButtonColor: '#e11d48', confirmButtonText: 'Hapus', cancelButtonText: 'Batal'
    }).then(r => { if (r.isConfirmed) deleteBiosecurityRecord(id); });
  };

  const loadDefaultSchedule = () => {
    if (!activeHouse) return;
    const bulkData = DEFAULT_SCHEDULE.map(d => ({ ...d, houseId: activeHouse.id }));
    addBiosecurityRecordsBulk(bulkData as any);
    Swal.fire({ title: 'Jadwal Standar Dimuat!', text: 'Jadwal vaksin default berhasil ditambahkan.', icon: 'success', confirmButtonColor: '#0f172a' });
  };

  return (
    <div className="space-y-6 pb-20 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-slate-900 uppercase tracking-tighter italic">
            Vaksinasi & Biosekuriti <span className="text-amber-500">{activeHouse?.name}</span>
          </h1>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
            {activeBatch ? `Strain: ${activeBatch.strain} · Populasi: ${activeBatch.currentCount.toLocaleString()} ekor · DOC: ${docAge} Hari` : 'Belum ada batch aktif'}
          </p>
        </div>
        <div className="flex gap-2">
          {houseRecords.length === 0 && (
            <button onClick={loadDefaultSchedule} className="border border-slate-200 bg-white text-slate-600 px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:border-amber-400 transition-all flex items-center gap-2">
              <Calendar size={14} /> Muat Jadwal Standar
            </button>
          )}
          <button onClick={openAddModal} className="bg-slate-900 text-white px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center gap-2 shadow-sm">
            <Plus size={14} /> Tambah Jadwal
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Selesai', val: doneCount, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
          { label: 'Terjadwal', val: scheduledCount, icon: Calendar, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
          { label: 'Terlewat', val: missedCount, icon: AlertTriangle, color: 'text-rose-600', bg: 'bg-rose-50 border-rose-200' },
          { label: 'Akan Datang (7hr)', val: upcomingRecords.length, icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' },
        ].map(stat => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className={cn('p-4 border shadow-sm', stat.bg)}>
              <div className="flex items-center gap-2 mb-1">
                <Icon size={14} className={stat.color} />
                <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500">{stat.label}</span>
              </div>
              <p className={cn('text-3xl font-black italic', stat.color)}>{stat.val}</p>
            </div>
          );
        })}
      </div>

      {/* Upcoming Alert */}
      {upcomingRecords.length > 0 && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-blue-50 border border-blue-200 p-4 flex items-center gap-4">
          <div className="p-2 bg-blue-100 border border-blue-200 rounded-sm shrink-0">
            <Syringe size={20} className="text-blue-600" />
          </div>
          <div>
            <p className="text-xs font-bold text-blue-900 uppercase tracking-wide">Jadwal Mendekat (7 Hari Ke Depan)</p>
            <p className="text-[10px] text-blue-700 mt-0.5">{upcomingRecords.map(r => r.name).join(' · ')}</p>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Records List */}
        <div className="lg:col-span-2 space-y-4">
          {/* Filter Tabs */}
          <div className="flex items-center gap-2">
            {(['ALL', 'SCHEDULED', 'DONE', 'MISSED'] as const).map(f => (
              <button key={f} onClick={() => setActiveFilter(f)}
                className={cn('px-3 py-1.5 text-[9px] font-black uppercase tracking-widest border transition-all',
                  activeFilter === f ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-400 border-slate-200 hover:border-slate-400')}>
                {f === 'ALL' ? 'Semua' : STATUS_LABEL[f]}
              </button>
            ))}
          </div>

          {paginatedRecords.length === 0 ? (
            <div className="bg-white border border-dashed border-slate-200 p-16 text-center">
              <Shield size={32} className="text-slate-200 mx-auto mb-3" />
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Belum ada jadwal</p>
            </div>
          ) : (
            <div className="space-y-4">
              {activeFilter === 'DONE' ? (
                <div className="bg-white border border-slate-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-slate-500">Tanggal</th>
                          <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-slate-500">Program</th>
                          <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-slate-500">Target</th>
                          <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-slate-500">Rute/Dosis</th>
                          <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-slate-500">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {paginatedRecords.map(rec => (
                          <tr key={rec.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-4 whitespace-nowrap">
                              <span className="text-[10px] font-bold text-slate-700">{new Date(rec.date).toLocaleDateString('id-ID')}</span>
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex flex-col">
                                <span className="text-xs font-black text-slate-900 uppercase tracking-tight">{rec.name}</span>
                                <span className={cn('text-[8px] font-bold uppercase tracking-widest w-fit mt-1 px-1 border rounded-[2px]', TYPE_COLOR[rec.type])}>{rec.type}</span>
                              </div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <span className="text-[10px] text-slate-500 font-bold">
                                {rec.ageDayTarget ? `${rec.ageDayTarget} Hari` : `${rec.ageWeekTarget} Minggu`}
                              </span>
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex flex-col gap-0.5">
                                <span className="text-[10px] text-slate-600 font-bold">{rec.route}</span>
                                <span className="text-[10px] text-slate-400 italic">{rec.dosage}</span>
                              </div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-right">
                              <div className="flex items-center gap-1 justify-end">
                                <button onClick={() => openEditModal(rec)} className="text-slate-300 hover:text-slate-600 p-1">
                                  <Edit2 size={14} />
                                </button>
                                <button onClick={() => handleDelete(rec.id)} className="text-slate-300 hover:text-rose-500 p-1">
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {paginatedRecords.map(rec => (
                    <motion.div key={rec.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      className="bg-white border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-2">
                            <span className={cn('text-[9px] font-black uppercase tracking-widest px-2 py-0.5 border rounded-sm', TYPE_COLOR[rec.type])}>{rec.type}</span>
                            <span className={cn('text-[9px] font-black uppercase tracking-widest px-2 py-0.5 border rounded-sm', STATUS_COLOR[rec.status])}>{STATUS_LABEL[rec.status]}</span>
                            <span className="text-[9px] font-bold text-slate-400">
                              Target: {rec.ageDayTarget ? `${rec.ageDayTarget} Hari` : `${rec.ageWeekTarget} Minggu`}
                            </span>
                          </div>
                          <h3 className="font-black text-sm text-slate-900 uppercase tracking-tight italic">{rec.name}</h3>
                          <div className="flex items-center gap-4 mt-1 flex-wrap">
                            <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1"><Calendar size={10} />{rec.date ? new Date(rec.date).toLocaleDateString('id-ID') : '-'}</span>
                            <span className="text-[10px] text-slate-400 font-medium">Rute: <b className="text-slate-600">{rec.route}</b></span>
                            <span className="text-[10px] text-slate-400 font-medium">Dosis: <b className="text-slate-600">{rec.dosage}</b></span>
                          </div>
                          {rec.composition && rec.composition.length > 0 && (
                            <div className="mt-2 grid grid-cols-2 gap-2 bg-slate-50 p-2 border border-slate-100">
                              {rec.composition.map((c, idx) => (
                                <div key={idx} className="flex justify-between text-[9px] font-bold uppercase tracking-tight">
                                  <span className="text-slate-500">{c.name}</span>
                                  <span className="text-slate-900">{c.amount.toLocaleString()} {c.unit}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {rec.notes && <p className="text-[10px] text-slate-400 italic mt-2 leading-relaxed">{rec.notes}</p>}
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {rec.status === 'SCHEDULED' && (
                            <button onClick={() => handleStatusChange(rec.id, 'DONE')}
                              className="text-emerald-500 hover:text-emerald-700 p-1.5 hover:bg-emerald-50 rounded-sm transition-colors" title="Tandai Selesai">
                              <CheckCircle2 size={16} />
                            </button>
                          )}
                          <button onClick={() => openEditModal(rec)} className="text-slate-300 hover:text-slate-600 p-1.5 hover:bg-slate-50 rounded-sm transition-colors">
                            <Edit2 size={15} />
                          </button>
                          <button onClick={() => handleDelete(rec.id)} className="text-slate-300 hover:text-rose-500 p-1.5 hover:bg-rose-50 rounded-sm transition-colors">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-4">
                  <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                    className="p-2 border border-slate-200 bg-white text-slate-400 hover:text-slate-600 disabled:opacity-50">
                    <ChevronRight size={14} className="rotate-180" />
                  </button>
                  <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest mx-4">Halaman {currentPage} dari {totalPages}</span>
                  <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                    className="p-2 border border-slate-200 bg-white text-slate-400 hover:text-slate-600 disabled:opacity-50">
                    <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Health Notes Sidebar */}
        <div className="space-y-4">
          {/* Health Summary */}
          <div className="bg-slate-900 text-white p-6 border border-slate-800">
            <h3 className="text-amber-500 text-[10px] font-black uppercase tracking-[0.25em] mb-4 flex items-center gap-2">
              <Heart size={12} /> Status Kesehatan Flock
            </h3>
            <div className="space-y-4">
              <div>
                <p className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">Vaksinasi Selesai</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-black italic text-emerald-400">{doneCount}</span>
                  <span className="text-xs text-slate-400">dari {houseRecords.length} program</span>
                </div>
                {houseRecords.length > 0 && (
                  <div className="w-full h-1.5 bg-slate-800 mt-2 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(doneCount / houseRecords.length) * 100}%` }}
                      className="h-full bg-emerald-500"
                    />
                  </div>
                )}
              </div>
              <div className="border-t border-slate-800 pt-4">
                <p className="text-[9px] text-slate-500 uppercase tracking-widest font-bold mb-2">Program Terakhir Selesai</p>
                {houseRecords.filter(r => r.status === 'DONE').slice(-1).map(r => (
                  <div key={r.id}>
                    <p className="text-xs font-bold text-white">{r.name}</p>
                    <p className="text-[9px] text-slate-400 mt-0.5">{r.date ? new Date(r.date).toLocaleDateString('id-ID') : '-'} · {r.route}</p>
                  </div>
                ))}
                {houseRecords.filter(r => r.status === 'DONE').length === 0 && (
                  <p className="text-[9px] text-slate-500 italic">Belum ada program selesai</p>
                )}
              </div>
            </div>
          </div>

          {/* Standard Vaccine Guide */}
          <div className="bg-white border border-slate-200 p-5">
            <h3 className="font-bold text-sm text-slate-700 mb-4 flex items-center gap-2"><Shield size={14} className="text-amber-500" /> Program Spesifik & DOC</h3>
            <div className="space-y-4">
              <div className="border-l-2 border-rose-500 pl-3">
                <p className="text-[10px] font-black text-rose-600 uppercase tracking-tight">Obat Cacing (375mg/ekor)</p>
                <p className="text-[9px] text-slate-500 mt-1">Jadwal: DOC 90, 150, 210. Seterusnya kelipatan 2 bulan.</p>
              </div>
              <div className="border-l-2 border-emerald-500 pl-3">
                <p className="text-[10px] font-black text-emerald-600 uppercase tracking-tight">Semprot Antiseptik (35ml/ekor)</p>
                <p className="text-[9px] text-slate-500 mt-1">1-60 Hari: Min. 3x.<br/>61+ Hari: Min. 2x/Minggu.</p>
              </div>
              <div className="border-l-2 border-amber-500 pl-3">
                <p className="text-[10px] font-black text-amber-600 uppercase tracking-tight">Semprot Gurem (Mandatory)</p>
                <p className="text-[9px] text-slate-500 mt-1">Jadwal: DOC 120 Hari (Wajib). Seterusnya sesuai kondisi.</p>
              </div>
              <div className="border-t border-slate-100 pt-3">
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mb-2">Vaksin Standar</p>
                {[
                  { week: '4 mg', name: 'ND-IB Live' },
                  { week: '10 mg', name: 'Gumboro' },
                  { week: '16 mg', name: 'ND-IB Killed' },
                  { week: '32 mg', name: 'Booster ND-IB' },
                ].map(item => (
                  <div key={item.week} className="flex items-center justify-between mb-1">
                    <span className="text-[9px] font-bold text-slate-600 uppercase">{item.week}</span>
                    <span className="text-[9px] text-slate-400">{item.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Add/Edit Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingRecord ? 'Edit Jadwal' : 'Tambah Jadwal Vaksin / Kesehatan'}>
        <div className="space-y-5">
          {!editingRecord && (
            <div className="bg-slate-50 p-4 border border-slate-200">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Gunakan Template</label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {Object.entries(TREATMENT_TEMPLATES).map(([key, template]) => (
                  <button
                    key={key}
                    onClick={() => {
                      const count = activeBatch?.currentCount || 0;
                      let dosage = '';
                      let composition = undefined;
                      
                      if ('dosagePerBird' in template) {
                        dosage = `${(template.dosagePerBird * count).toLocaleString()} ${template.unit} (Total)`;
                      } else if ('composition' in template) {
                        composition = template.composition.map(c => ({
                          ...c,
                          amount: c.amount * count
                        }));
                        dosage = 'Lihat Komposisi';
                      }

                      setForm(f => ({
                        ...f,
                        name: template.name,
                        type: template.type,
                        route: template.route,
                        dosage,
                        composition,
                        notes: `Kebutuhan untuk ${count.toLocaleString()} ekor ayam.`
                      }));
                    }}
                    className="px-3 py-2 bg-white border border-slate-200 text-[10px] font-black uppercase tracking-tight text-slate-600 hover:border-amber-500 hover:text-amber-600 transition-all text-center"
                  >
                    {template.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Tipe</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as VaccineType }))}
                className="w-full bg-slate-50 border border-slate-200 rounded-sm px-3 py-2.5 text-sm font-bold focus:outline-none focus:border-amber-500">
                <option value="VAKSIN">Vaksinasi</option>
                <option value="VITAMIN">Vitamin / Suplemen</option>
                <option value="OBAT">Pengobatan</option>
                <option value="BIOSEKURITI">Biosekuriti</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as VaccineStatus }))}
                className="w-full bg-slate-50 border border-slate-200 rounded-sm px-3 py-2.5 text-sm font-bold focus:outline-none focus:border-amber-500">
                <option value="SCHEDULED">Terjadwal</option>
                <option value="DONE">Selesai</option>
                <option value="MISSED">Terlewat</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Nama Vaksin / Program</label>
            <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Contoh: ND-IB Ma5+Clone 30"
              className="w-full bg-slate-50 border border-slate-200 rounded-sm px-4 py-2.5 text-sm font-medium focus:outline-none focus:border-amber-500" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Tanggal</label>
              <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className="w-full bg-slate-50 border border-slate-200 rounded-sm px-4 py-2.5 text-sm font-medium focus:outline-none focus:border-amber-500" />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Target DOC (Hari)</label>
              <input type="number" value={form.ageDayTarget || ''} onChange={e => setForm(f => ({ ...f, ageDayTarget: Number(e.target.value) }))}
                className="w-full bg-slate-50 border border-slate-200 rounded-sm px-4 py-2.5 text-sm font-bold focus:outline-none focus:border-amber-500" />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Target (Minggu)</label>
              <input type="number" value={form.ageWeekTarget || ''} onChange={e => setForm(f => ({ ...f, ageWeekTarget: Number(e.target.value) }))}
                className="w-full bg-slate-50 border border-slate-200 rounded-sm px-4 py-2.5 text-sm font-bold focus:outline-none focus:border-amber-500" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Rute Pemberian</label>
              <select value={form.route} onChange={e => setForm(f => ({ ...f, route: e.target.value as VaccineRoute }))}
                className="w-full bg-slate-50 border border-slate-200 rounded-sm px-3 py-2.5 text-sm font-bold focus:outline-none focus:border-amber-500">
                {['Air Minum', 'Suntik', 'Tetes Mata', 'Spray', 'Oral'].map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Dosis Total</label>
              <input type="text" value={form.dosage} onChange={e => setForm(f => ({ ...f, dosage: e.target.value }))}
                placeholder="Contoh: 1.500 ml (Total)"
                className="w-full bg-slate-50 border border-slate-200 rounded-sm px-4 py-2.5 text-sm font-medium focus:outline-none focus:border-amber-500" />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Catatan / Keterangan</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3}
              placeholder="Contoh: Puasa air 2 jam sebelum pemberian..."
              className="w-full bg-slate-50 border border-slate-200 rounded-sm px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500 resize-none" />
          </div>

          <button onClick={handleSave} className="w-full bg-slate-900 text-white py-3.5 font-bold text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-colors flex items-center justify-center gap-2">
            <Syringe size={14} className="text-amber-500" /> Simpan Data
          </button>
        </div>
      </Modal>

    </div>
  );
}
