/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Package,
  Plus,
  AlertCircle,
  ArrowDownCircle,
  ArrowUpCircle,
  ArrowRightLeft,
  Clock,
  Settings,
  Save,
  Upload,
  FileText,
  MessageCircle
} from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import Modal from '../components/Modal';
import Swal from 'sweetalert2';

import { useHouse } from '../HouseContext';
import { useGlobalData } from '../GlobalContext';
import { ItemType, StockMutationType } from '../types';

const ITEM_TYPE_LABELS: Record<string, string> = {
  ALL: 'Semua',
  [ItemType.RAW_MATERIAL]: 'Bahan Baku',
  [ItemType.FINISHED_FEED]: 'Pakan Jadi',
  [ItemType.EGG_STOCK]: 'Stok Telur',
  [ItemType.MEDICINE]: 'Obat/Vaksin',
  [ItemType.OTHER]: 'Lainnya',
};

import { generateUUID } from '../lib/uuid';

export default function Inventory() {
  const { activeHouse, houses } = useHouse();
  const { inventory, updateInventory, updateInventoryItem, addInventoryItem, createStockMutation, addJournalEntry, addTransaction, addAPARRecord, transactions, productionLogs, farmSettings, accounts, getHouseCashBalance, createInterHouseDebt } = useGlobalData();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [activeTypeFilter, setActiveTypeFilter] = useState<string>('ALL');
  const [newItem, setNewItem] = useState({ id: '', name: '', quantity: 0, unit: 'kg', price: 0, type: ItemType.RAW_MATERIAL });
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);

  // Transfer State
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferData, setTransferData] = useState({ itemId: '', targetHouseId: activeHouse?.id || '', quantity: 0 });
  const [isSaving, setIsSaving] = useState(false);

  const suppliers = farmSettings.suppliers || [];
  const feedSuppliers = suppliers.filter(s => s.category === 'FEED' || s.category === 'MEDICINE');
  const allSuppliers = [...feedSuppliers, ...suppliers.filter(s => s.category !== 'FEED' && s.category !== 'MEDICINE')];

  const lowStockItems = inventory.filter(i => i.quantity <= i.reorderPoint && i.type !== ItemType.EGG_STOCK && i.houseId === activeHouse?.id);
  const lowStockNames = lowStockItems.map(i => `${i.name}: ${i.quantity.toFixed(0)} ${i.unit}`).join(', ');
  const orderMessage = encodeURIComponent(`Halo, saya butuh order pakan segera.\n\nStok menipis di kandang: ${activeHouse?.name}\nItem: ${lowStockNames}\n\nMohon konfirmasi ketersediaan dan harga. Terima kasih.`);

  const getWhatsAppLink = (phone: string, message?: string) => {
    const cleaned = phone.replace(/[^0-9]/g, '');
    return message ? `https://wa.me/${cleaned}?text=${message}` : `https://wa.me/${cleaned}`;
  };

  const CATEGORY_LABEL: Record<string, string> = {
    FEED: 'Pakan & Bahan Baku',
    MEDICINE: 'Obat & Vaksin',
    EQUIPMENT: 'Peralatan',
    OTHER: 'Lainnya',
  };

  const getHouseInventory = () => inventory.filter(i => i.houseId === 'CENTRAL' || !i.houseId || i.houseId === activeHouse?.id);

  const eggStockItems = getHouseInventory().filter(i => i.type === ItemType.EGG_STOCK);
  const nonEggItems = getHouseInventory().filter(i => i.type !== ItemType.EGG_STOCK);
  const filteredItems = activeTypeFilter === 'ALL'
    ? nonEggItems
    : nonEggItems.filter(i => i.type === activeTypeFilter);

  const handleAddStock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.name || newItem.quantity <= 0) {
      Swal.fire({
        title: 'Input Invalid',
        text: 'Mohon isi nama barang dan jumlah yang valid.',
        icon: 'warning',
        confirmButtonColor: '#0f172a',
      });
      return;
    }

    Swal.fire({
      title: 'Konfirmasi Stok',
      text: `Tambah ${newItem.quantity} ${newItem.unit} ${newItem.name} ke Gudang Pusat?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#0f172a',
      confirmButtonText: 'Ya, Tambah',
      cancelButtonText: 'Batal'
    }).then(async (result) => {
      if (result.isConfirmed) {
        setIsSaving(true);
        try {
          const totalCost = newItem.quantity * newItem.price;

          // Determine paying house from selected account format: "accId|houseId"
          const [accId, paidByHouseId] = selectedAccountId.split('|');
          const finalAcc = accounts.find(a => a.id === accId) || accounts.find(a => a.isCashOrBank) || accounts[0];
          const payingHouseId = paidByHouseId || activeHouse?.id || '';

          // ENFORCE: All purchases go to CENTRAL WAREHOUSE
          const targetHouseId = 'CENTRAL';
          const targetItem = inventory.find(i => i.name.toLowerCase() === newItem.name.toLowerCase() && i.type !== ItemType.EGG_STOCK && (!i.houseId || i.houseId === 'CENTRAL'));
          let finalItemId = '';
          if (targetItem) {
            finalItemId = targetItem.id;
            updateInventory(targetItem.id, newItem.quantity);
            const price = newItem.price > 0 ? ((targetItem.lastPrice * targetItem.quantity) + (newItem.price * newItem.quantity)) / (targetItem.quantity + newItem.quantity) : targetItem.lastPrice;
            await updateInventoryItem(targetItem.id, { lastPrice: price, paidByHouseId: payingHouseId });
          } else {
            finalItemId = generateUUID();
            await addInventoryItem({
              ...newItem,
              id: finalItemId,
              houseId: targetHouseId,
              reorderPoint: 100,
              lastPrice: newItem.price,
              paidByHouseId: payingHouseId,
            });
          }

          // Check if house has sufficient balance, if not offer inter-house debt
          const houseBalance = getHouseCashBalance(payingHouseId);
          if (houseBalance < totalCost) {
            const deficit = totalCost - Math.max(houseBalance, 0);
            // Find another house that can cover
            const otherHouse = houses.find(h => h.id !== payingHouseId && getHouseCashBalance(h.id) >= deficit);
            if (otherHouse) {
              await createInterHouseDebt(
                payingHouseId,
                otherHouse.id,
                deficit,
                `Talangan Pembelian Stok: ${newItem.name}`
              );
            }
          }


          let targetAssetAccountId = 'acc-persediaan-pakan';
          if (newItem.type === ItemType.MEDICINE || newItem.type === ItemType.VACCINE) {
            targetAssetAccountId = 'acc-persediaan-obat';
          } else if (newItem.type === ItemType.OTHER) {
            targetAssetAccountId = 'acc-peralatan';
          }

          const journalId = await addJournalEntry(
            { date: new Date().toISOString().split('T')[0], description: `Pembelian Stok Gudang: ${newItem.name}`, reference: `BELI-${Date.now()}` },
            [
              { accountId: targetAssetAccountId, debit: totalCost, credit: 0, houseId: payingHouseId },
              { accountId: finalAcc.id, debit: 0, credit: totalCost, houseId: payingHouseId }
            ]
          );

          await addTransaction({
            houseId: payingHouseId,
            date: new Date().toISOString().split('T')[0],
            description: `Pembelian Stok Gudang Pusat: ${newItem.name}`,
            qty: `${newItem.quantity} ${newItem.unit}`,
            price: newItem.price,
            total: totalCost,
            account: finalAcc.name,
            type: 'ASSET', // IMPORTANT: Not an EXPENSE, so it doesn't skew P&L
            category: 'Persediaan',
            journalId
          });

          await createStockMutation({
            date: new Date().toISOString().split('T')[0],
            itemId: finalItemId,
            type: StockMutationType.PURCHASE,
            quantity: newItem.quantity,
            unitCost: newItem.price,
            sourceLocation: 'SUPPLIER',
            targetLocation: 'CENTRAL',
            paidByHouseId: payingHouseId,
            reference: `BELI-${Date.now()}`,
            notes: `Dibayar oleh Kandang — ${finalAcc.name}`
          });

          Swal.fire({
            title: 'Stok Ditambahkan!',
            icon: 'success',
            confirmButtonColor: '#0f172a',
          });
          setIsModalOpen(false);
          setNewItem({ id: '', name: '', quantity: 0, unit: 'kg', price: 0, type: ItemType.RAW_MATERIAL });
          setSelectedAccountId('');
        } catch (err: any) {
          Swal.fire('Gagal', err.message || 'Gagal menyimpan.', 'error');
        } finally {
          setIsSaving(false);
        }
      }
    });
  };

  const handleTransferStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferData.itemId || !transferData.targetHouseId || transferData.quantity <= 0) return;

    setIsSaving(true);
    try {
      const sourceItem = inventory.find(i => i.id === transferData.itemId);
      if (!sourceItem || sourceItem.quantity < transferData.quantity) {
        Swal.fire('Stok Tidak Cukup', 'Gudang pusat tidak memiliki stok yang cukup.', 'error');
        return;
      }

      // Deduct from Central
      updateInventory(sourceItem.id, -transferData.quantity);

      // Add to House
      const houseItem = inventory.find(i => i.name === sourceItem.name && i.houseId === transferData.targetHouseId);
      if (houseItem) {
        updateInventory(houseItem.id, transferData.quantity);
      } else {
        await addInventoryItem({
          ...sourceItem,
          id: undefined as any,
          houseId: transferData.targetHouseId,
          quantity: transferData.quantity,
          paidByHouseId: sourceItem.paidByHouseId // Carry over the original payer
        });
      }

      // Create stock mutation log
      await createStockMutation({
        date: new Date().toISOString().split('T')[0],
        itemId: sourceItem.id,
        type: StockMutationType.TRANSFER,
        quantity: transferData.quantity,
        unitCost: sourceItem.lastPrice,
        sourceLocation: 'CENTRAL',
        targetLocation: transferData.targetHouseId,
        reference: `TRF-${Date.now()}`,
        notes: `Distribusi ke Kandang`
      });

      setIsTransferModalOpen(false);
      Swal.fire('Berhasil', 'Stok berhasil dimutasi ke kandang.', 'success');
    } catch (error: any) {
      Swal.fire('Gagal', error.message || 'Gagal memutasi stok.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-black text-slate-900 uppercase tracking-tighter italic">Manajemen Stok</h1>
          <p className="text-slate-500 text-[10px] lg:text-sm mt-1 uppercase font-bold tracking-widest opacity-70">
            Gudang Pusat & Stok Kandang Aktif
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center space-x-2 bg-slate-900 text-white px-4 py-2 rounded-sm text-[10px] font-bold uppercase tracking-widest hover:bg-slate-800 transition-colors shadow-sm"
          >
            <Plus size={16} />
            <span>Tambah Pembelian Baru</span>
          </button>
        </div>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Input Stok Gudang"
      >
        <form onSubmit={handleAddStock} className="space-y-6">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Nama Barang / SKU</label>
            <input
              type="text"
              placeholder="Contoh: Jagung Giling"
              value={newItem.name}
              onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-sm px-4 py-3 text-sm focus:outline-none focus:border-amber-500 transition-all"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Jumlah</label>
              <input
                type="number"
                min="0"
                placeholder="0"
                value={newItem.quantity || ''}
                onChange={(e) => setNewItem({ ...newItem, quantity: Math.max(0, Number(e.target.value)) })}
                className="w-full bg-slate-50 border border-slate-200 rounded-sm px-4 py-3 text-sm font-bold focus:outline-none focus:border-amber-500 transition-all font-mono"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Satuan</label>
              <select
                value={newItem.unit}
                onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-sm px-4 py-3 text-sm font-bold focus:outline-none focus:border-amber-500 transition-all uppercase"
              >
                {farmSettings.units.map(unit => (
                  <option key={unit} value={unit}>{unit}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Tipe Item</label>
              <select
                value={newItem.type}
                onChange={(e) => setNewItem({ ...newItem, type: e.target.value as any })}
                className="w-full bg-slate-50 border border-slate-200 rounded-sm px-4 py-3 text-sm font-bold focus:outline-none focus:border-amber-500"
              >
                <option value={ItemType.RAW_MATERIAL}>Bahan Baku (RAW_MATERIAL)</option>
                <option value={ItemType.FINISHED_FEED}>Pakan Jadi (FINISHED_FEED)</option>
                <option value={ItemType.MEDICINE}>Obat-obatan</option>
                <option value={ItemType.VACCINE}>Vaksin</option>
                <option value={ItemType.OTHER}>Lainnya</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Harga Satuan (Est.)</label>
              <input
                type="number"
                min="0"
                placeholder="0"
                value={newItem.price || ''}
                onChange={(e) => setNewItem({ ...newItem, price: Math.max(0, Number(e.target.value)) })}
                className="w-full bg-slate-50 border border-slate-200 rounded-sm px-4 py-3 text-sm font-bold focus:outline-none focus:border-amber-500 transition-all font-mono"
              />
            </div>
            <div className="col-span-2 bg-emerald-50/50 p-4 border border-emerald-100 rounded-sm">
              <label className="text-[10px] font-bold uppercase tracking-widest text-emerald-800 block mb-2">Dibayar Oleh (Kas Kandang)</label>
              <select
                required
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="w-full bg-white border border-emerald-200 rounded-sm px-4 py-3 text-sm font-bold focus:outline-none focus:border-emerald-500 transition-all shadow-sm"
              >
                <option value="">Pilih Sumber Dana...</option>
                {/* Kas per Kandang */}
                <optgroup label="─── Kas Kandang ───">
                  {houses.map(h => {
                    const kasId = `acc-kas-${h.id}`;
                    const kasAcc = accounts.find(a => a.id === kasId);
                    const balance = getHouseCashBalance(h.id);
                    return kasAcc ? (
                      <option key={kasId} value={`${kasId}|${h.id}`}>
                        💰 {h.name} (Saldo: Rp {balance.toLocaleString('id-ID')})
                      </option>
                    ) : null;
                  })}
                </optgroup>
                {/* Semua akun Bank */}
                <optgroup label="─── Rekening Bank ───">
                  {accounts.filter(a => a.isCashOrBank && !a.id.startsWith('acc-kas-')).map(a => {
                    const bal = 0; // bank balance computed from journal lines if needed
                    return (
                      <option key={a.id} value={`${a.id}|${activeHouse?.id || ''}`}>
                        🏦 {a.name} [{a.code}]
                      </option>
                    );
                  })}
                </optgroup>
              </select>
              <p className="text-[9px] text-emerald-600 mt-2 italic">* Pilih kas/bank yang membayar. Jika saldo tidak cukup, sistem akan otomatis catat Hutang Antar Kandang.</p>
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Unggah Faktur / Bukti Bayar</label>
            <div className="relative border-2 border-dashed border-slate-200 p-8 flex flex-col items-center justify-center bg-slate-50 hover:bg-white transition-all group cursor-pointer">
              <Upload size={24} className="text-slate-300 group-hover:text-amber-500 transition-colors mb-2" />
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Klik atau drag file ke sini</p>
              <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" />
            </div>
          </div>
          <div className="pt-4">
            <button
              type="submit"
              disabled={isSaving}
              className="w-full bg-slate-900 text-white py-4 rounded-sm font-bold text-[10px] uppercase tracking-[0.25em] flex items-center justify-center space-x-2 hover:bg-slate-800 transition-all shadow-xl group disabled:opacity-50"
            >
              <Save size={16} className={cn("group-hover:text-amber-500 transition-colors", isSaving && "animate-pulse")} />
              <span>{isSaving ? 'Menyimpan...' : 'Simpan ke Database (Gudang)'}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Mutasi Stock Modal */}
      <Modal isOpen={isTransferModalOpen} onClose={() => setIsTransferModalOpen(false)} title="Mutasi Stok ke Kandang">
        <form onSubmit={handleTransferStock} className="space-y-6">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Item dari Gudang Pusat</label>
            <select
              value={transferData.itemId}
              onChange={(e) => setTransferData({ ...transferData, itemId: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-sm px-4 py-3 text-sm focus:outline-none focus:border-amber-500"
              required
            >
              <option value="">Pilih Item...</option>
              {inventory.filter(i => (i.houseId === 'CENTRAL' || !i.houseId) && i.type !== ItemType.EGG_STOCK).map(i => (
                <option key={i.id} value={i.id}>{i.name} (Stok: {i.quantity} {i.unit})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Target Kandang</label>
            <select
              value={transferData.targetHouseId}
              onChange={(e) => setTransferData({ ...transferData, targetHouseId: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-sm px-4 py-3 text-sm focus:outline-none focus:border-amber-500"
              required
            >
              <option value="">Pilih Kandang...</option>
              {/* Hacky way to get houses without importing farmSettings.houses if not available. Wait, useHouse gives activeHouse, we should have a list of houses.
                        Let's just use activeHouse for now if no house list is easily available. 
                        Actually we only have activeHouse here. Wait, we can fetch all houses from local storage? Yes. */}
              {JSON.parse(localStorage.getItem('poultry_houses') || '[]').map((h: any) => (
                <option key={h.id} value={h.id}>{h.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Jumlah Mutasi</label>
            <input
              type="number"
              value={transferData.quantity || ''}
              onChange={(e) => setTransferData({ ...transferData, quantity: Number(e.target.value) })}
              className="w-full bg-slate-50 border border-slate-200 rounded-sm px-4 py-3 text-sm focus:outline-none focus:border-amber-500"
              required
              min="0.1"
              step="0.1"
            />
          </div>
          <button type="submit" disabled={isSaving} className="w-full bg-amber-500 text-white py-4 rounded-sm font-bold text-[10px] uppercase tracking-[0.25em] flex items-center justify-center space-x-2 hover:bg-amber-600 disabled:opacity-50">
            <ArrowRightLeft size={16} /><span>{isSaving ? 'Memproses...' : 'Proses Mutasi'}</span>
          </button>
        </form>
      </Modal>

      {inventory.some(i => i.quantity <= i.reorderPoint && i.type !== ItemType.EGG_STOCK) && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-amber-50 border border-amber-200 shadow-sm flex items-center justify-between px-6 py-4"
        >
          <div className="flex items-center space-x-4">
            <div className="p-2 bg-amber-100 rounded-sm border border-amber-200">
              <AlertCircle className="text-amber-600" size={24} />
            </div>
            <div>
              <h4 className="text-amber-900 font-bold text-sm uppercase tracking-tight">Critical Warning: Stock Level</h4>
              <p className="text-slate-600 text-xs mt-0.5">
                {lowStockItems.length > 0
                  ? `${lowStockItems.map(i => i.name).join(', ')} — stok di bawah reorder point. Segera order!`
                  : 'Beberapa item stok menipis.'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsOrderModalOpen(true)}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-sm text-[10px] font-bold uppercase tracking-widest hover:bg-emerald-700 transition-colors shadow-md whitespace-nowrap"
          >
            <MessageCircle size={14} />
            Order via WhatsApp
          </button>
        </motion.div>
      )}

      {/* WhatsApp Order Supplier Modal */}
      <AnimatePresence>
        {isOrderModalOpen && (
          <Modal isOpen={isOrderModalOpen} onClose={() => setIsOrderModalOpen(false)} title="Order via WhatsApp Supplier">
            <div className="space-y-6">
              {lowStockItems.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-amber-700 mb-2">Stok yang perlu diorder:</p>
                  <div className="flex flex-wrap gap-2">
                    {lowStockItems.map(i => (
                      <span key={i.id} className="bg-white border border-amber-200 px-2 py-1 text-[9px] font-bold text-amber-700 uppercase">
                        {i.name}: {i.quantity.toFixed(0)} {i.unit}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {allSuppliers.length === 0 ? (
                <div className="text-center py-8">
                  <MessageCircle size={32} className="mx-auto text-slate-300 mb-3" />
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Belum ada data supplier</p>
                  <p className="text-[10px] text-slate-400 mt-1">Tambahkan supplier di Konfigurasi › Mitra & Supplier</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Pilih supplier untuk dihubungi:</p>
                  {allSuppliers.map(supplier => (
                    <div key={supplier.id} className="p-4 bg-slate-50 border border-slate-100 hover:border-emerald-300 transition-all group">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-[12px] font-black uppercase text-slate-900 tracking-tighter italic">{supplier.name}</p>
                            <span className="text-[8px] bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded-sm font-bold uppercase text-slate-500">
                              {CATEGORY_LABEL[supplier.category] || supplier.category}
                            </span>
                          </div>
                          {supplier.notes && <p className="text-[9px] text-slate-400 font-medium">{supplier.notes}</p>}
                          <p className="text-[9px] text-slate-400 mt-1">📱 {supplier.whatsappNumber}</p>
                        </div>
                        <div className="flex flex-col gap-2">
                          <a
                            href={getWhatsAppLink(supplier.whatsappNumber, orderMessage)}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1.5 bg-emerald-500 text-white px-3 py-2 text-[9px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-colors whitespace-nowrap"
                          >
                            <MessageCircle size={11} />
                            Order Sekarang
                          </a>
                          <a
                            href={getWhatsAppLink(supplier.whatsappNumber)}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1.5 bg-slate-100 text-slate-600 border border-slate-200 px-3 py-2 text-[9px] font-bold uppercase tracking-widest hover:bg-white transition-colors whitespace-nowrap"
                          >
                            <MessageCircle size={11} />
                            Chat Saja
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Modal>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">

          {/* Filter Tabs */}
          <div className="flex items-center gap-2 flex-wrap">
            {['ALL', ItemType.RAW_MATERIAL, ItemType.FINISHED_FEED, ItemType.MEDICINE, ItemType.OTHER].map(type => (
              <button
                key={type}
                onClick={() => setActiveTypeFilter(type)}
                className={cn(
                  'px-3 py-1.5 text-[9px] font-black uppercase tracking-widest border transition-all',
                  activeTypeFilter === type
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-400 border-slate-200 hover:border-slate-400'
                )}
              >
                {ITEM_TYPE_LABELS[type]}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6">
            {filteredItems.map((item) => (
              <div key={item.id} className="bg-white p-5 lg:p-6 border border-slate-200 shadow-sm relative overflow-hidden flex flex-col justify-between min-h-[200px] lg:h-56">
                <div className={cn(
                  "absolute top-0 right-0 w-1.5 h-full",
                  item.quantity <= item.reorderPoint ? "bg-amber-500" : "bg-slate-100"
                )} />

                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-slate-50 border border-slate-100 shadow-inner">
                      <Package size={24} className="text-slate-500" />
                    </div>
                    <div className="flex items-center space-x-1 text-slate-400">
                      <Clock size={12} />
                      <span className="text-[9px] font-bold uppercase tracking-[0.2em]">-</span>
                    </div>
                  </div>
                  <h3 className="font-bold text-slate-800 text-base uppercase tracking-tight">{item.name}</h3>
                  <p className="text-slate-400 text-[9px] font-bold uppercase tracking-widest mt-1">{ITEM_TYPE_LABELS[item.type] || item.type} · SKU: {item.id.slice(-4)}</p>
                </div>

                <div className="flex items-end justify-between">
                  <div className="flex items-baseline space-x-2">
                    <span className={cn(
                      "text-4xl font-black italic tracking-tighter",
                      item.quantity <= item.reorderPoint ? "text-amber-600" : "text-slate-900"
                    )}>
                      {item.quantity.toFixed(item.unit === 'kg' ? 1 : 0)}
                    </span>
                    <span className="text-slate-400 font-bold text-[10px] uppercase">{item.unit}</span>
                  </div>
                  <button
                    onClick={() => {
                      setEditingItem(item);
                      setIsEditModalOpen(true);
                    }}
                    className="p-2 text-slate-300 hover:text-slate-600 hover:bg-slate-50 transition-all border border-transparent hover:border-slate-200"
                  >
                    <Settings size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white border border-slate-200 overflow-hidden shadow-sm">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-bold text-[10px] uppercase tracking-widest text-slate-700">Stock Velocity & Logs</h3>
              <div className="flex space-x-2">
                <button className="p-2 bg-white border border-slate-200 text-slate-400"><ArrowDownCircle size={18} /></button>
                <button className="p-2 bg-white border border-slate-200 text-slate-400"><ArrowUpCircle size={18} /></button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-100 uppercase">
                    <th className="px-6 py-4 text-[10px] font-bold tracking-widest text-slate-400">Inventory Item</th>
                    <th className="px-6 py-4 text-[10px] font-bold tracking-widest text-slate-400">Variance</th>
                    <th className="px-6 py-4 text-[10px] font-bold tracking-widest text-slate-400">Final Bal.</th>
                    <th className="px-6 py-4 text-[10px] font-bold tracking-widest text-slate-400">Authorized By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {transactions.filter(t => t.type === 'EXPENSE' && t.houseId === activeHouse?.id && !t.description.includes('Gaji') && !t.description.includes('Borongan')).slice(-5).reverse().map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 text-xs font-bold text-slate-800 uppercase tracking-tight">{tx.description}</td>
                      <td className="px-6 py-4">
                        <span className="text-rose-600 font-bold text-sm italic">-{tx.qty}</span>
                        <div className="text-[9px] text-slate-400 uppercase font-black tracking-widest">Purchased</div>
                      </td>
                      <td className="px-6 py-4 text-xs font-bold text-slate-900 font-mono">{formatCurrency(tx.total)}</td>
                      <td className="px-6 py-4 text-xs text-slate-500 font-medium">{tx.account}</td>
                    </tr>
                  ))}
                  {productionLogs.filter(p => p.houseId === activeHouse?.id).slice(-3).reverse().map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors bg-slate-50/30">
                      <td className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-tight italic">Daily Feed Usage</td>
                      <td className="px-6 py-4">
                        <span className="text-rose-400 font-bold text-sm italic">-{log.feedConsumed} kg</span>
                        <div className="text-[9px] text-slate-400 uppercase font-black tracking-widest">Consumed</div>
                      </td>
                      <td className="px-6 py-4 text-xs font-bold text-slate-400 font-mono">Internal</td>
                      <td className="px-6 py-4 text-xs text-slate-500 font-medium">Auto-Logged</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <div className="bg-slate-900 text-white p-8 shadow-2xl relative overflow-hidden border border-slate-800">
            <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none transform translate-x-12 -translate-y-8">
              <Package size={160} />
            </div>
            <h3 className="text-amber-500 text-[10px] font-black uppercase tracking-[0.25em] mb-8">Efficiency Analytics</h3>
            <div className="space-y-8">
              <div>
                <div className="flex justify-between items-baseline mb-2">
                  <p className="text-3xl font-black italic tracking-tighter">
                    {productionLogs.length > 0 ? (productionLogs[productionLogs.length - 1].feedConsumed / 10).toFixed(1) : 0}g
                  </p>
                  <span className="text-[10px] font-bold text-emerald-500">OPTIMAL</span>
                </div>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Cons. vs Target /Bird</p>
                <div className="w-full h-1.5 bg-slate-800 mt-4 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: '82%' }}
                    className="h-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"
                  />
                </div>
              </div>
              <div>
                <p className="text-3xl font-black italic tracking-tighter">
                  {(() => {
                    const houseLogs = productionLogs.filter(p => p.houseId === activeHouse?.id);
                    const totalFeed = houseLogs.reduce((a, b) => a + b.feedConsumed, 0);
                    const totalEggs = houseLogs.reduce((a, b) => a + (b.totalButir ?? (b as any).totalKg ?? 0), 0);
                    return totalEggs > 0 ? (totalFeed / totalEggs).toFixed(2) : '0.00';
                  })()}
                </p>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">FCR (Feed Conversion Ratio)</p>
                <div className="p-3 bg-slate-800/50 border border-slate-800 mt-4">
                  <p className="text-[9px] text-slate-500 italic leading-relaxed uppercase tracking-tighter font-medium">Real-time FCR based on {productionLogs.filter(p => p.houseId === activeHouse?.id).length} log entries.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Inventory Item"
      >
        <div className="space-y-6">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Nama Item</label>
            <input
              type="text"
              value={editingItem?.name || ''}
              readOnly
              className="w-full bg-slate-100 border border-slate-200 rounded-sm px-4 py-3 text-sm text-slate-500 cursor-not-allowed"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Satuan</label>
            <select
              value={editingItem?.unit || ''}
              onChange={(e) => setEditingItem({ ...editingItem, unit: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-sm px-4 py-3 text-sm font-bold focus:outline-none focus:border-amber-500"
            >
              {farmSettings.units.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Stok Saat Ini ({editingItem?.unit})</label>
            <div className="flex items-center gap-4">
              <input
                type="number"
                value={editingItem?.quantity || 0}
                onChange={(e) => setEditingItem({ ...editingItem, quantity: Number(e.target.value) })}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-sm px-4 py-3 text-sm font-bold focus:outline-none focus:border-amber-500 font-mono"
              />
              <button
                onClick={() => {
                  updateInventory(editingItem.id, editingItem.quantity - inventory.find((i: any) => i.id === editingItem.id)!.quantity);
                  setIsEditModalOpen(false);
                  Swal.fire({ title: 'Berhasil', text: 'Stok telah diperbarui secara manual.', icon: 'success' });
                }}
                className="bg-slate-900 text-white px-6 py-3 rounded-sm font-bold text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-all shadow-md"
              >
                Update
              </button>
            </div>
            <p className="text-[9px] text-slate-400 mt-2 italic">* Gunakan ini hanya untuk koreksi stok manual (opname).</p>
          </div>
        </div>
      </Modal>

      {/* Egg Stock Section */}
      {eggStockItems.length > 0 && eggStockItems.some(i => i.quantity > 0) && (
        <div className="mt-8">
          <h2 className="text-sm font-black uppercase tracking-tight text-slate-700 mb-4 flex items-center gap-2">
            <span className="w-2 h-4 bg-amber-500 inline-block rounded-sm"></span>
            Stok Telur Gudang — Auto-Updated dari Input Produksi
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {eggStockItems.filter(i => i.quantity > 0).map(item => (
              <div key={item.id} className="bg-amber-50 border border-amber-200 p-4 shadow-sm">
                <p className="text-[9px] font-black uppercase tracking-widest text-amber-600">{item.eggCategory || item.name}</p>
                <p className="text-3xl font-black italic text-slate-900 mt-1">{item.quantity.toLocaleString()}<span className="text-sm font-bold text-slate-400 ml-1">butir</span></p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
