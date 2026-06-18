/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Users, Plus, ArrowRightLeft, Skull, ShoppingCart,
  Calendar, Trash2, Search, TrendingUp, TrendingDown,
  History, Info, ChevronRight, Download, Wheat
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Swal from 'sweetalert2';
import { cn } from '../lib/utils';
import Modal from '../components/Modal';
import { useHouse } from '../HouseContext';
import { useFlock } from '../FlockContext';
import { useGlobalData } from '../GlobalContext';
import { MutationType, type PopulationMutation, StockMutationType, ItemType } from '../types';

const ITEMS_PER_PAGE = 10;

const MUTATION_TYPE_CONFIG = {
  [MutationType.ARRIVAL]: {
    label: 'DOC Masuk',
    icon: Plus,
    color: 'text-emerald-600 bg-emerald-50 border-emerald-200',
    desc: 'Penambahan populasi dari pembelian DOC baru.'
  },
  [MutationType.MORTALITY]: {
    label: 'Mortalitas',
    icon: Skull,
    color: 'text-rose-600 bg-rose-50 border-rose-200',
    desc: 'Pengurangan populasi karena kematian ayam.'
  },
  [MutationType.CULLING]: {
    label: 'Afkir',
    icon: ShoppingCart,
    color: 'text-amber-600 bg-amber-50 border-amber-200',
    desc: 'Pengurangan populasi karena penjualan ayam afkir.'
  },
};

export default function Population() {
  const { activeHouse, houses } = useHouse();
  const { flocks, mutations, addMutation, deleteMutation, getActiveFlockByHouse } = useFlock();
  const { inventory, updateInventory, createStockMutation, addTransaction, addJournalEntry } = useGlobalData();
  const activeFlock = getActiveFlockByHouse(activeHouse?.id || '');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<MutationType | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const [isPulletModalOpen, setIsPulletModalOpen] = useState(false);
  const [pulletForm, setPulletForm] = useState({
    date: new Date().toISOString().split('T')[0],
    feedItemId: '',
    count: 0,
    notes: ''
  });

  // Filter feed items for active house warehouse
  const feedItems = useMemo(() =>
    inventory.filter(i => (i.type === ItemType.FINISHED_FEED || i.type === ItemType.RAW_MATERIAL) && i.houseId === activeHouse?.id),
    [inventory, activeHouse]
  );

  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    count: 0,
    targetHouseId: '',
    pricePerBird: 0,
    notes: '',
  });

  const houseMutations = mutations.filter(m => m.houseId === activeHouse?.id || m.targetHouseId === activeHouse?.id);
  const totalPages = Math.ceil(houseMutations.length / ITEMS_PER_PAGE);
  const paginatedMutations = houseMutations.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // Stats calculation
  const totalArrival = mutations.filter(m => m.houseId === activeHouse?.id && m.type === MutationType.ARRIVAL).reduce((a, b) => a + b.count, 0);
  const totalMortality = mutations.filter(m => m.houseId === activeHouse?.id && m.type === MutationType.MORTALITY).reduce((a, b) => a + b.count, 0);
  const totalCulling = mutations.filter(m => m.houseId === activeHouse?.id && m.type === MutationType.CULLING).reduce((a, b) => a + b.count, 0);
  const totalTransferOut = mutations.filter(m => m.houseId === activeHouse?.id && m.type === MutationType.TRANSFER).reduce((a, b) => a + b.count, 0);
  const totalTransferIn = mutations.filter(m => m.targetHouseId === activeHouse?.id && m.type === MutationType.TRANSFER).reduce((a, b) => a + b.count, 0);

  const openModal = (type: MutationType) => {
    setSelectedType(type);
    setForm({
      date: new Date().toISOString().split('T')[0],
      count: 0,
      targetHouseId: '',
      pricePerBird: 0,
      notes: '',
    });
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!selectedType || form.count <= 0) {
      Swal.fire('Error', 'Jumlah harus lebih dari 0', 'error');
      return;
    }

    if (selectedType === MutationType.TRANSFER && !form.targetHouseId) {
      Swal.fire('Error', 'Pilih kandang tujuan', 'error');
      return;
    }

    addMutation({
      houseId: activeHouse?.id || '',
      type: selectedType,
      date: form.date,
      count: Number(form.count),
      targetHouseId: form.targetHouseId,
      pricePerBird: form.pricePerBird,
      totalPrice: form.pricePerBird * form.count,
      notes: form.notes,
    });

    setIsModalOpen(false);
    Swal.fire({ title: 'Tersimpan!', icon: 'success', timer: 1500, showConfirmButton: false });
  };

  const handleSavePulletFeed = async () => { // Tambahkan async
    const feedItem = inventory.find(i => i.id === pulletForm.feedItemId);
    if (!feedItem) {
      Swal.fire({ title: 'Data Tidak Lengkap', text: 'Silakan pilih jenis pakan terlebih dahulu.', icon: 'warning', confirmButtonColor: '#0f172a' });
      return;
    }
    if (pulletForm.count <= 0) {
      Swal.fire({ title: 'Jumlah Tidak Valid', text: 'Jumlah pakan yang diberikan harus lebih dari 0 kg.', icon: 'warning', confirmButtonColor: '#0f172a' });
      return;
    }
    if (feedItem.quantity < pulletForm.count) {
      Swal.fire({
        title: 'Stok Tidak Cukup!',
        text: `Stok ${feedItem.name} saat ini hanya ${feedItem.quantity} kg, dibutuhkan ${pulletForm.count} kg.`,
        icon: 'error',
        confirmButtonColor: '#0f172a'
      });
      return;
    }

    const refId = `PULLET-FEED-${Date.now()}`;
    const totalCost = pulletForm.count * (feedItem.lastPrice || 0);

    // 1. Process deduction and stock mutation record (Logika Lama)
    updateInventory(feedItem.id, -pulletForm.count);
    createStockMutation({
      date: pulletForm.date,
      itemId: feedItem.id,
      type: StockMutationType.USAGE,
      quantity: pulletForm.count,
      unitCost: feedItem.lastPrice || 0,
      sourceLocation: activeHouse?.id || '',
      reference: refId,
      notes: `Pemberian Pakan Pullet: ${pulletForm.notes || '-'}`
    });

    // 2. LOGIKA BARU: Catat ke Modul Akuntansi & Keuangan
    try {
      // Jurnal Akuntansi (Double-Entry: Beban Bertambah, Persediaan Berkurang)
      const journalId = await addJournalEntry(
        {
          date: pulletForm.date,
          description: `Pemakaian Pakan Pullet: ${feedItem.name} (${pulletForm.count} kg)`,
          reference: refId
        },
        [
          { accountId: 'acc-beban-pakan', debit: totalCost, credit: 0, houseId: activeHouse?.id },
          { accountId: 'acc-persediaan-pakan', debit: 0, credit: totalCost, houseId: activeHouse?.id }
        ]
      );

      // Transaksi Buku Kas (Supaya muncul di tabel Pengeluaran Bahan)
      await addTransaction({
        houseId: activeHouse?.id,
        date: pulletForm.date,
        description: `Pemakaian Pakan Pullet: ${feedItem.name}`,
        qty: `${pulletForm.count} kg`,
        price: feedItem.lastPrice || 0,
        total: totalCost,
        account: 'Persediaan', // Menggunakan akun persediaan karena tidak memotong kas baru
        type: 'EXPENSE',
        category: 'Pemakaian Pakan', // Kategori agar masuk report Laba-Rugi
        journalId
      });
    } catch (error) {
      console.error("Gagal mencatat transaksi keuangan pakan pullet", error);
    }

    setIsPulletModalOpen(false);
    Swal.fire({
      title: 'Berhasil!',
      text: `Pemberian pakan ${feedItem.name} sebanyak ${pulletForm.count} kg berhasil dicatat di stok dan jurnal keuangan.`,
      icon: 'success',
      confirmButtonColor: '#0f172a'
    });
  };

  const handleDelete = (id: string) => {
    Swal.fire({
      title: 'Hapus Mutasi?',
      text: 'Data populasi akan dikembalikan ke kondisi sebelumnya.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#e11d48',
      confirmButtonText: 'Hapus'
    }).then(result => {
      if (result.isConfirmed) deleteMutation(id);
    });
  };

  return (
    <div className="space-y-6 pb-20 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-slate-900 uppercase tracking-tighter italic">
            Manajemen Populasi <span className="text-amber-500">{activeHouse?.name}</span>
          </h1>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
            {activeFlock ? `${activeFlock.strain} · Populasi Saat Ini: ${activeFlock.currentCount.toLocaleString()} ekor` : 'Tidak ada flock aktif'}
          </p>
        </div>
        <div className="flex gap-2">
          <button className="border border-slate-200 bg-white text-slate-600 px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:border-slate-400 transition-all flex items-center gap-2">
            <Download size={14} /> Export Laporan
          </button>
        </div>
      </div>

      {/* Action Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
        {Object.entries(MUTATION_TYPE_CONFIG).map(([type, config]) => {
          const Icon = config.icon;
          return (
            <button key={type} onClick={() => openModal(type as MutationType)}
              className="group bg-white border border-slate-200 p-4 hover:border-slate-900 transition-all text-left relative overflow-hidden">
              <div className={cn('w-10 h-10 rounded-sm flex items-center justify-center mb-3 transition-colors', config.color)}>
                <Icon size={20} />
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-slate-900">{config.label}</p>
              <p className="text-[8px] text-slate-400 mt-1 font-bold leading-tight">{config.desc}</p>
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Plus size={12} className="text-slate-300" />
              </div>
            </button>
          );
        })}

        {/* 5th Card: Pemberian Pakan Pullet */}
        <button
          onClick={() => {
            setPulletForm({
              date: new Date().toISOString().split('T')[0],
              feedItemId: feedItems[0]?.id || '',
              count: 0,
              notes: ''
            });
            setIsPulletModalOpen(true);
          }}
          className="group bg-white border border-slate-200 p-4 hover:border-slate-900 transition-all text-left relative overflow-hidden"
        >
          <div className="w-10 h-10 rounded-sm flex items-center justify-center mb-3 bg-amber-50 border-amber-200 text-amber-600 transition-colors group-hover:bg-amber-900 group-hover:text-amber-300">
            <Wheat size={20} />
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-slate-900">Pakan Pullet</p>
          <p className="text-[8px] text-slate-400 mt-1 font-bold leading-tight">Pemberian pakan pullet harian yang memotong stok gudang.</p>
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <Plus size={12} className="text-slate-300" />
          </div>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Mutation History */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white border border-slate-200 overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 flex items-center gap-2">
                <History size={14} className="text-amber-500" /> Riwayat Mutasi
              </h3>
              <div className="relative">
                <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="text" placeholder="Cari..." className="pl-8 pr-4 py-1.5 bg-slate-50 border border-slate-200 text-[10px] focus:outline-none focus:border-amber-500 rounded-sm" />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-3 text-[9px] font-black uppercase tracking-widest text-slate-500">Tanggal</th>
                    <th className="px-6 py-3 text-[9px] font-black uppercase tracking-widest text-slate-500">Tipe</th>
                    <th className="px-6 py-3 text-[9px] font-black uppercase tracking-widest text-slate-500">Jumlah</th>
                    <th className="px-6 py-3 text-[9px] font-black uppercase tracking-widest text-slate-500">Keterangan</th>
                    <th className="px-6 py-3 text-[9px] font-black uppercase tracking-widest text-slate-500 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {paginatedMutations.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-[10px] text-slate-400 font-bold uppercase tracking-widest">Belum ada riwayat mutasi</td>
                    </tr>
                  ) : (
                    paginatedMutations.map(mut => {
                      const config = MUTATION_TYPE_CONFIG[mut.type];
                      const Icon = config.icon;
                      const isIncoming = mut.type === MutationType.ARRIVAL || (mut.type === MutationType.TRANSFER && mut.targetHouseId === activeHouse?.id);

                      return (
                        <tr key={mut.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap text-[10px] font-bold text-slate-600">{new Date(mut.date).toLocaleDateString('id-ID')}</td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <div className={cn('p-1 rounded-sm shrink-0', config.color)}>
                                <Icon size={12} />
                              </div>
                              <span className="text-[10px] font-black uppercase tracking-tight text-slate-900 italic">{config.label}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              {isIncoming ? <TrendingUp size={12} className="text-emerald-500" /> : <TrendingDown size={12} className="text-rose-500" />}
                              <span className={cn('text-[11px] font-black italic', isIncoming ? 'text-emerald-600' : 'text-rose-600')}>
                                {isIncoming ? '+' : '-'}{mut.count.toLocaleString()}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="text-[10px] text-slate-600 font-medium line-clamp-1">{mut.notes || '-'}</span>
                              {mut.type === MutationType.TRANSFER && (
                                <span className="text-[8px] text-slate-400 font-bold uppercase tracking-tight">
                                  {mut.houseId === activeHouse?.id ? `Ke: ${houses.find(h => h.id === mut.targetHouseId)?.name}` : `Dari: ${houses.find(h => h.id === mut.houseId)?.name}`}
                                </span>
                              )}
                              {mut.totalPrice && mut.totalPrice > 0 && (
                                <span className="text-[8px] text-amber-600 font-bold uppercase tracking-tight">Total: Rp{mut.totalPrice.toLocaleString()}</span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button onClick={() => handleDelete(mut.id)} className="text-slate-300 hover:text-rose-500 p-1.5 transition-colors">
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-center gap-4">
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                  className="p-1.5 border border-slate-200 bg-white text-slate-400 hover:text-slate-600 disabled:opacity-50">
                  <ChevronRight size={14} className="rotate-180" />
                </button>
                <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Halaman {currentPage} dari {totalPages}</span>
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                  className="p-1.5 border border-slate-200 bg-white text-slate-400 hover:text-slate-600 disabled:opacity-50">
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Summary */}
        <div className="space-y-4">
          <div className="bg-slate-900 text-white p-6 rounded-sm relative overflow-hidden">
            <div className="relative z-10">
              <h3 className="text-amber-500 text-[10px] font-black uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                <Info size={12} /> Ikhtisar Populasi
              </h3>
              <div className="space-y-4">
                <div>
                  <p className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">Total DOC Masuk</p>
                  <p className="text-2xl font-black italic text-emerald-400">{totalArrival.toLocaleString()} <span className="text-xs italic text-slate-500">ekor</span></p>
                </div>
                <div className="grid grid-cols-2 gap-4 border-t border-slate-800 pt-4">
                  <div>
                    <p className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">Mortalitas</p>
                    <p className="text-lg font-black text-rose-400">{totalMortality.toLocaleString()} <span className="text-[10px] text-slate-600">ekor</span></p>
                  </div>
                  <div>
                    <p className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">Afkir</p>
                    <p className="text-lg font-black text-amber-400">{totalCulling.toLocaleString()} <span className="text-[10px] text-slate-600">ekor</span></p>
                  </div>
                </div>
                <div className="border-t border-slate-800 pt-4">
                  <p className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">Mutasi (Net)</p>
                  <p className="text-lg font-black text-blue-400">{(totalTransferIn - totalTransferOut).toLocaleString()} <span className="text-[10px] text-slate-600">ekor</span></p>
                </div>
              </div>
            </div>
            <Users size={80} className="absolute -bottom-4 -right-4 text-white/5" />
          </div>

          <div className="bg-white border border-slate-200 p-5 shadow-sm">
            <h3 className="font-bold text-sm text-slate-700 mb-4">Informasi Penting</h3>
            <ul className="space-y-3">
              <li className="flex items-start gap-2 text-[10px] text-slate-500">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                <span>
                  Setiap mutasi <b>DOC Masuk</b> dan <b>Afkir</b> akan tercatat otomatis di modul keuangan.
                </span>
              </li>
              <li className="flex items-start gap-2 text-[10px] text-slate-500">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                <span>
                  Mutasi kandang hanya bisa dilakukan ke kandang yang memiliki <b>Flock Aktif</b>.
                </span>
              </li>
              <li className="flex items-start gap-2 text-[10px] text-slate-500">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                <span>
                  Gunakan fitur mortalitas di modul <b>Produksi Harian</b> untuk pencatatan harian yang lebih praktis.
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Mutation Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={selectedType ? MUTATION_TYPE_CONFIG[selectedType].label : 'Mutasi Populasi'}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Tanggal</label>
              <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 px-3 py-2 text-sm font-bold focus:outline-none focus:border-amber-500" />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Jumlah (Ekor)</label>
              <input type="number" value={form.count || ''} onChange={e => setForm({ ...form, count: Number(e.target.value) })}
                className="w-full bg-slate-50 border border-slate-200 px-3 py-2 text-sm font-bold focus:outline-none focus:border-amber-500" />
            </div>
          </div>

          {(selectedType === MutationType.ARRIVAL || selectedType === MutationType.CULLING) && (
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Harga Per Ekor (Rp)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">Rp</span>
                <input type="number" value={form.pricePerBird || ''} onChange={e => setForm({ ...form, pricePerBird: Number(e.target.value) })}
                  className="w-full bg-slate-50 border border-slate-200 pl-10 pr-3 py-2 text-sm font-bold focus:outline-none focus:border-amber-500" />
              </div>
              <p className="text-[9px] text-slate-400 mt-1 font-bold italic">Total Transaksi: Rp{(form.count * form.pricePerBird).toLocaleString()}</p>
            </div>
          )}

          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Catatan</label>
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3}
              placeholder="Tambahkan keterangan mutasi..."
              className="w-full bg-slate-50 border border-slate-200 px-3 py-2 text-sm font-medium focus:outline-none focus:border-amber-500 resize-none" />
          </div>

          <button onClick={handleSave}
            className="w-full bg-slate-900 text-white py-3 font-black text-[10px] uppercase tracking-[0.2em] hover:bg-slate-800 transition-all flex items-center justify-center gap-2">
            Simpan Mutasi
          </button>
        </div>
      </Modal>

      {/* Pullet Feed Modal */}
      <Modal
        isOpen={isPulletModalOpen}
        onClose={() => setIsPulletModalOpen(false)}
        title="Catat Pemberian Pakan Pullet"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Tanggal</label>
              <input type="date" value={pulletForm.date} onChange={e => setPulletForm({ ...pulletForm, date: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 px-3 py-2 text-sm font-bold focus:outline-none focus:border-amber-500" />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Jumlah (Kg)</label>
              <input type="number" value={pulletForm.count || ''} onChange={e => setPulletForm({ ...pulletForm, count: Number(e.target.value) })}
                className="w-full bg-slate-50 border border-slate-200 px-3 py-2 text-sm font-bold focus:outline-none focus:border-amber-500" />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Pilih Pakan Gudang</label>
            <select value={pulletForm.feedItemId} onChange={e => setPulletForm({ ...pulletForm, feedItemId: e.target.value })}
              className="w-full bg-amber-50 border border-amber-200 px-3 py-2 text-sm font-bold text-amber-900 focus:outline-none focus:border-amber-500">
              <option value="">Pilih Jenis Pakan...</option>
              {feedItems.map(item => (
                <option key={item.id} value={item.id}>{item.name} (Stok: {item.quantity} {item.unit})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Catatan</label>
            <textarea value={pulletForm.notes} onChange={e => setPulletForm({ ...pulletForm, notes: e.target.value })} rows={3}
              placeholder="Cth: Pemberian pakan grower/pullet pagi hari..."
              className="w-full bg-slate-50 border border-slate-200 px-3 py-2 text-sm font-medium focus:outline-none focus:border-amber-500 resize-none" />
          </div>

          <button onClick={handleSavePulletFeed}
            className="w-full bg-slate-900 text-white py-3 font-black text-[10px] uppercase tracking-[0.2em] hover:bg-slate-800 transition-all flex items-center justify-center gap-2">
            Simpan Pemberian Pakan
          </button>
        </div>
      </Modal>
    </div>
  );
}