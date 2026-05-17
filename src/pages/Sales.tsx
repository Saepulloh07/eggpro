/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  ShoppingCart, 
  Plus, 
  Trash2, 
  DollarSign, 
  Tag, 
  History,
  Info,
  Layers,
  ChevronDown,
  Gift,
  X,
  Save
} from 'lucide-react';
import { ItemType, EggCategory } from '../types';
import { formatCurrency, getEggCategoryRange, cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import Swal from 'sweetalert2';

// Master prices are now loaded from global context.

import { useHouse } from '../HouseContext';
import { useGlobalData } from '../GlobalContext';

export default function Sales() {
  const { activeHouse } = useHouse();
  const { saveSale, salesLogs, productionLogs, inventory, updateInventory, farmSettings, accounts } = useGlobalData();
  const [activeCategory, setActiveCategory] = useState<string>(EggCategory.BM);
  const [quantity, setQuantity] = useState(0);
  const [isFree, setIsFree] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [buyerType, setBuyerType] = useState('REGULAR');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [isSaving, setIsSaving] = useState(false);


  // Load master prices from FarmSettings
  const masterPrices = farmSettings.masterPrices || [];
  const currentPrice = masterPrices.find(p => p.name === activeCategory || p.id === activeCategory)?.price || 0;

  // ── Egg Stock Lookup ─────────────────────────────────────────────────────────
  // Find the EGG_STOCK inventory item for the currently selected category
  const eggStockItem = inventory.find(
    i => i.type === ItemType.EGG_STOCK && i.eggCategory === activeCategory && i.houseId === activeHouse?.id
  );
  const availableStock = eggStockItem ? eggStockItem.quantity : (activeCategory !== 'NON_EGG' ? 0 : null);
  const isOverStock = availableStock !== null && quantity > availableStock;

  const totalPrice = isFree ? 0 : quantity * currentPrice;

  // ── Free Goods Limit Calculation ─────────────────────────────────────────────
  const freeGoodsLimitInfo = React.useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const monthlyProd = productionLogs
      .filter(log => {
        const d = new Date(log.date);
        return log.houseId === activeHouse?.id && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      })
      .reduce((sum, log) => sum + (log.totalButir ?? (log as any).totalKg ?? 0), 0);

    const monthlyFree = salesLogs
      .filter(sale => {
        const d = new Date(sale.date);
        return sale.houseId === activeHouse?.id && sale.isFree && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      })
      .reduce((sum, sale) => sum + sale.quantity, 0);

    const limit = (monthlyProd * (farmSettings.wasteFreePercentage || 0)) / 100;
    const remaining = Math.max(0, limit - monthlyFree);
    const isExceeded = isFree && (monthlyFree + quantity) > limit;

    return { monthlyProd, monthlyFree, limit, remaining, isExceeded };
  }, [productionLogs, salesLogs, activeHouse, farmSettings, isFree, quantity]);

  const handleCompleteTransaction = () => {
    if (quantity <= 0) {
      Swal.fire({ title: 'Input Invalid', text: 'Jumlah unit harus lebih dari 0.', icon: 'warning', confirmButtonColor: '#0f172a' });
      return;
    }
    if (isOverStock) {
      Swal.fire({
        title: 'Stok Tidak Cukup!',
        html: `<div class="text-sm"><p>Stok <b>${activeCategory}</b> tersedia: <b>${availableStock?.toLocaleString()} butir</b></p><p>Jumlah yang diinput: <b>${quantity.toLocaleString()} butir</b></p><p class="text-rose-600 mt-2 font-black uppercase tracking-widest italic">⚠ Melebihi stok tersedia (${availableStock?.toLocaleString()} butir)</p></div>`,
        icon: 'error',
        confirmButtonColor: '#0f172a',
      });
      return;
    }

    if (isFree && freeGoodsLimitInfo.isExceeded) {
      Swal.fire({
        title: 'Limit Free Goods Tercapai!',
        html: `
          <div class="text-left space-y-2 text-sm">
            <p>Alokasi gratis bulan ini telah mencapai batas <b>${farmSettings.wasteFreePercentage}%</b> dari total produksi.</p>
            <hr class="border-slate-100 my-2" />
            <p>Total Produksi (Bulan ini): <b>${freeGoodsLimitInfo.monthlyProd.toLocaleString()} butir</b></p>
            <p>Batas Alokasi Gratis: <b>${Math.floor(freeGoodsLimitInfo.limit).toLocaleString()} butir</b></p>
            <p>Telah Dialokasikan: <b>${freeGoodsLimitInfo.monthlyFree.toLocaleString()} butir</b></p>
            <p class="text-rose-600 font-bold mt-2 italic uppercase tracking-tighter">⚠ Tidak dapat menambah alokasi gratis lagi bulan ini.</p>
          </div>
        `,
        icon: 'error',
        confirmButtonColor: '#0f172a',
      });
      return;
    }

    Swal.fire({
      title: 'Selesaikan Transaksi?',
      html: `
        <div class="text-left space-y-2 text-sm">
          <p><b>Produk:</b> ${activeCategory.replace('_', ' ')}</p>
          <p><b>Jumlah:</b> ${quantity.toLocaleString()} Butir</p>
          <p><b>Total:</b> ${isFree ? 'FREE' : formatCurrency(totalPrice)}</p>
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#0f172a',
      cancelButtonColor: '#f1f5f9',
      confirmButtonText: 'Ya, Selesaikan',
      cancelButtonText: 'Batal',
      customClass: {
        cancelButton: 'text-slate-600'
      }
    }).then(async (result) => {
      if (result.isConfirmed) {
        setIsSaving(true);
        try {
          await saveSale({
              houseId: activeHouse?.id || '',
              date: new Date().toISOString().split('T')[0],
              category: activeCategory,
              quantity,
              price: currentPrice,
              total: totalPrice,
              isFree,
              customer: customerName.trim() || 'Umum'
          }, selectedAccountId);

          Swal.fire({ title: 'Transaksi Berhasil!', text: `Penjualan ${quantity.toLocaleString()} butir ${activeCategory} berhasil dicatat.`, icon: 'success', confirmButtonColor: '#0f172a' });
          setQuantity(0);
          setIsFree(false);
          setCustomerName('');
        } catch (err: any) {
          Swal.fire('Gagal', err.message || 'Gagal menyimpan.', 'error');
        } finally {
          setIsSaving(false);
        }
      }
    });
  };


  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-slate-900 uppercase tracking-tighter italic">Penjualan <span className="text-amber-500">{activeHouse?.name}</span></h1>
          <p className="text-slate-500 text-[10px] md:text-sm mt-1 uppercase font-bold tracking-widest opacity-70">Manajemen transaksi telur & harga master.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        <div className="lg:col-span-2 space-y-6 lg:space-y-8">
          <div className="bg-white p-4 lg:p-8 border border-slate-200 shadow-sm relative">
            <h3 className="font-bold text-xs lg:text-sm text-slate-700 mb-6 lg:mb-8 flex items-center uppercase tracking-widest">
                <ShoppingCart className="mr-2 text-amber-500" size={16} />
                Input Transaksi Baru
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-3">Pilih Kategori Produk</label>
                  <div className="grid grid-cols-2 gap-3">
                    {masterPrices.filter(p => p.id !== 'NON_EGG').map((p) => {
                      // Match by name (e.g. "Remban") instead of ID (e.g. "BM") to align with Production log & Inventory
                      const catStock = inventory.find(
                        i => i.type === ItemType.EGG_STOCK && i.eggCategory === p.name && i.houseId === activeHouse?.id
                      )?.quantity || 0;
                      return (
                        <button 
                          key={p.id}
                          onClick={() => setActiveCategory(p.name)}
                          className={cn(
                            "p-3 lg:p-4 rounded-sm border text-left transition-all relative overflow-hidden",
                            activeCategory === p.name 
                              ? "bg-slate-900 border-slate-900 text-white shadow-md shadow-slate-200" 
                              : (catStock > 0 ? "bg-slate-50 border-slate-100 text-slate-600 hover:bg-slate-100" : "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed grayscale")
                          )}
                        >
                          <div className="font-bold text-xs uppercase tracking-tight">{p.name}</div>
                          <div className={cn("text-[9px] uppercase font-bold opacity-60 italic", activeCategory === p.name ? "text-amber-500" : "text-slate-400")}>
                            {getEggCategoryRange(p.name as EggCategory)}
                          </div>
                          <div className={cn(
                            "absolute bottom-2 right-3 text-[10px] font-black italic",
                            catStock > 0 ? (activeCategory === p.name ? "text-white/40" : "text-slate-500") : "text-rose-600"
                          )}>
                            {catStock.toLocaleString()}
                          </div>
                        </button>
                      );
                    })}
                    <button 
                        onClick={() => setActiveCategory('NON_EGG')}
                        className={cn(
                          "p-3 lg:p-4 rounded-sm border text-left transition-all flex items-center space-x-2 bg-slate-50 border-slate-100 text-slate-600 hover:bg-slate-100",
                          activeCategory === 'NON_EGG' && "bg-slate-900 border-slate-900 text-white shadow-md shadow-slate-200"
                        )}
                    >
                        <Layers size={14} className={activeCategory === 'NON_EGG' ? "text-amber-500" : "text-slate-400"} />
                        <span className="font-bold text-xs tracking-tight uppercase">Limbah/Karung</span>
                    </button>
                  </div>
                </div>

                <div className="bg-slate-50 p-4 border border-slate-100 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <div className={cn("p-2 rounded-sm bg-white border border-slate-200 shadow-sm", isFree && "bg-slate-900 text-white")}>
                            <Gift size={16} />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-900">Alokasi Free (Warga)</p>
                            <p className={cn(
                                "text-[10px] font-medium italic",
                                freeGoodsLimitInfo.remaining > 0 ? "text-slate-400" : "text-rose-500"
                            )}>
                                Sisa Batas: {Math.floor(freeGoodsLimitInfo.remaining).toLocaleString()} butir
                            </p>
                        </div>

                    </div>
                    <button 
                        onClick={() => setIsFree(!isFree)}
                        className={cn(
                            "w-10 h-5 rounded-full relative transition-colors duration-200",
                            isFree ? "bg-amber-500" : "bg-slate-200"
                        )}
                    >
                        <div className={cn(
                            "absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform duration-200 shadow-sm",
                            isFree ? "translate-x-5" : "translate-x-0"
                        )} />
                    </button>
                </div>
              </div>

              <div className="space-y-4">
                {/* Quantity input with stock badge */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Jumlah (Butir)</label>
                    {availableStock !== null && (
                      <span className={cn('text-[9px] font-black uppercase tracking-widest px-2 py-0.5 border rounded-sm',
                        isOverStock ? 'bg-rose-50 text-rose-600 border-rose-200' : 'bg-emerald-50 text-emerald-600 border-emerald-200')}>
                        Stok: {availableStock.toLocaleString()} butir
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      placeholder="0"
                      value={quantity || ''}
                      onChange={(e) => setQuantity(Number(e.target.value))}
                      className={cn(
                        "w-full bg-slate-50 border rounded-sm px-4 lg:px-5 py-4 lg:py-5 text-xl lg:text-2xl font-black italic focus:outline-none transition-all font-mono shadow-inner",
                        isOverStock ? "border-rose-400 focus:border-rose-500 bg-rose-50" : "border-slate-200 focus:border-amber-500"
                      )}
                    />
                    <span className="absolute right-4 lg:right-6 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">butir</span>
                  </div>
                  {isOverStock && (
                    <p className="text-[10px] text-rose-600 font-bold mt-1 flex items-center gap-1">
                      ⚠ Melebihi stok tersedia ({availableStock?.toLocaleString()} butir)
                    </p>
                  )}
                </div>

                {/* Customer name */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Nama Pembeli</label>
                  <input
                    type="text"
                    placeholder="Opsional (misal: Pak Budi)"
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-sm px-4 py-3 text-sm font-medium focus:outline-none focus:border-amber-500 transition-all"
                  />
                </div>

                {!isFree && (
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Terima ke Rekening</label>
                    <select
                      required
                      value={selectedAccountId}
                      onChange={(e) => setSelectedAccountId(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-sm px-4 py-3 text-sm font-bold focus:outline-none focus:border-amber-500 transition-all"
                    >
                      <option value="">Pilih Rekening Penerima</option>
                      {accounts.filter(a => a.isCashOrBank).map(a => (
                        <option key={a.id} value={a.id}>{a.name} ({a.code})</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="bg-slate-900 p-5 text-white shadow-xl relative overflow-hidden border border-slate-800">
                    <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none transform translate-x-4 -translate-y-4">
                        <DollarSign size={60} lg:size={80} />
                    </div>
                    <div className="flex justify-between items-center mb-2 lg:mb-3">
                        <span className="text-slate-400 text-[9px] lg:text-[10px] font-bold uppercase tracking-[0.2em]">Kalkulasi Harga</span>
                        <div className="px-1.5 py-0.5 bg-slate-800 rounded-sm text-[7px] lg:text-[8px] font-bold uppercase border border-slate-700 tracking-tighter">Real-time Est.</div>
                    </div>
                    <div className="text-2xl lg:text-3xl font-black italic mb-1 lg:mb-2 tracking-tighter">
                        {isFree ? "GRATIS / FREE" : formatCurrency(totalPrice)}
                    </div>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest flex items-center">
                       <span className="mr-2">Rate /unit:</span>
                       <span className="text-amber-500 italic">{formatCurrency(currentPrice)}</span>
                    </p>
                </div>

                <button
                  onClick={handleCompleteTransaction}
                  disabled={isOverStock || isSaving}
                  className={cn(
                    "w-full rounded-sm py-5 font-bold text-[10px] uppercase tracking-[0.25em] shadow-xl active:scale-[0.98] transition-all flex items-center justify-center space-x-2 border group",
                    (isOverStock || isSaving)
                      ? "bg-slate-200 text-slate-400 border-slate-200 cursor-not-allowed"
                      : "bg-slate-900 text-white border-slate-800 hover:bg-slate-800"
                  )}
                >
                  <Plus size={16} className={cn("transition-colors", !isOverStock && "group-hover:text-amber-500", isSaving && "animate-pulse")} />
                  <span>{isSaving ? 'Memproses...' : isOverStock ? 'Stok Tidak Mencukupi' : 'Selesaikan Transaksi'}</span>
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 overflow-hidden shadow-sm">
            <div className="p-4 lg:p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h3 className="font-bold text-[9px] lg:text-[10px] uppercase tracking-widest text-slate-700">Histori Penjualan Terakhir</h3>
                <button className="text-slate-400 hover:text-slate-900"><History size={16} /></button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Tanggal</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Payload</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Volume</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-right">Subtotal</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {salesLogs.filter(s => s.houseId === activeHouse?.id).slice(-5).reverse().map((sale) => (
                    <tr key={sale.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-6 py-4 text-xs text-slate-500 font-medium">{new Date(sale.date).toLocaleDateString('id-ID')}</td>
                      <td className="px-6 py-4">
                        <div className="text-xs font-bold text-slate-800 uppercase tracking-tight">{sale.category}</div>
                        <div className="text-[10px] text-slate-400 font-medium lowercase italic">{sale.customer}</div>
                      </td>
                      <td className="px-6 py-4 text-xs font-bold text-slate-900">{sale.quantity.toLocaleString()} Butir</td>
                      <td className="px-6 py-4 text-xs font-bold text-slate-900 text-right italic">{sale.isFree ? 'FREE' : formatCurrency(sale.total)}</td>
                      <td className="px-6 py-4 text-center">
                        <span className="bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase px-2 py-1 rounded-sm border border-emerald-100">Paid</span>
                      </td>
                    </tr>
                  ))}
                  {salesLogs.length === 0 && (
                      <tr><td colSpan={5} className="px-6 py-8 text-center text-[10px] text-slate-400 font-bold uppercase">Belum ada histori penjualan</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Sidebar info */}
        <div className="space-y-6 lg:space-y-8">
            <div className="bg-slate-900 text-white p-6 lg:p-8 shadow-2xl relative overflow-hidden border border-slate-800">
                <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none transform translate-x-12 -translate-y-8">
                    <History size={160} />
                </div>
                <h3 className="text-amber-500 text-[10px] font-black uppercase tracking-[0.25em] mb-8">Financial Summary</h3>
                <div className="space-y-8">
                    {(() => {
                        const today = new Date().toISOString().split('T')[0];
                        const houseSales = salesLogs.filter(s => s.houseId === activeHouse?.id && s.date === today);
                        const totalSold = houseSales.reduce((acc, s) => acc + s.quantity, 0);
                        const totalIncome = houseSales.reduce((acc, s) => acc + s.total, 0);
                        
                        return (
                            <>
                                <div>
                                    <p className="text-3xl font-black italic tracking-tighter">{totalSold.toLocaleString()} Butir</p>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Total Terjual (Today)</p>
                                </div>
                                <div>
                                    <p className="text-3xl font-black italic text-slate-600 tracking-tighter">{farmSettings.wasteFreePercentage}%</p>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Target Waste & Free Goods</p>
                                </div>
                                <div className="pt-8 border-t border-slate-800">
                                    <p className="text-3xl font-black text-emerald-400 italic tracking-tighter">{formatCurrency(totalIncome)}</p>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Cashflow {activeHouse?.name} Today</p>
                                </div>
                            </>
                        );
                    })()}
                </div>
            </div>

            <div className="bg-white p-6 border border-slate-200 shadow-sm relative">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold text-xs uppercase tracking-widest text-slate-700">Master Price Index</h3>
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                </div>
                <div className="space-y-3">
                    {masterPrices.map((p) => (
                        <div key={p.id} className="flex justify-between items-center p-3 border border-slate-100 bg-slate-50/50 hover:bg-white transition-colors">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{p.name}</span>
                            <span className="text-xs font-black italic text-slate-800">{formatCurrency(p.price)}</span>
                        </div>
                    ))}
                </div>
                <p className="text-[9px] text-slate-400 mt-6 font-medium italic">* Terakhir diupdate: Konfigurasi Master</p>
            </div>
        </div>
      </div>
    </div>
  );
}
