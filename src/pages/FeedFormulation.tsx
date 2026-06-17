/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * FeedFormulation.tsx
 */

import React, { useState, useMemo } from 'react';
import { Beaker, Settings, CheckCircle2, AlertCircle, Save, Plus, Trash2, Edit2, ChevronLeft, Scale } from 'lucide-react';
import Swal from 'sweetalert2';
import { cn } from '../lib/utils';
import Modal from '../components/Modal';
import { useGlobalData } from '../GlobalContext';
import { useHouse } from '../HouseContext';
import { FeedRecipe, RecipeIngredient, ItemType, StockMutationType } from '../types';

export default function FeedFormulation() {
    const { activeHouse } = useHouse();
    const {
        inventory,
        updateInventory,
        updateInventoryItem,
        addInventoryItem,
        createStockMutation,
        recipes,
        addRecipe,
        updateRecipe,
        deleteRecipe
    } = useGlobalData();

    const [selectedRecipeId, setSelectedRecipeId] = useState(recipes.length > 0 ? recipes[0].id : '');
    const [outputItemId, setOutputItemId] = useState('');

    // Modal States
    const [isMasterModalOpen, setIsMasterModalOpen] = useState(false);
    const [isEditingFormOpen, setIsEditingFormOpen] = useState(false);
    const [currentEditingRecipe, setCurrentEditingRecipe] = useState<FeedRecipe | null>(null);

    // Finished feed items
    const finishedFeedItems = useMemo(() =>
        inventory.filter(i => i.type === ItemType.FINISHED_FEED && i.houseId === activeHouse?.id), [inventory, activeHouse]);

    // Raw materials only
    const rawMaterialItems = useMemo(() =>
        inventory.filter(i => i.type === ItemType.RAW_MATERIAL && (!i.houseId || i.houseId === activeHouse?.id)), [inventory, activeHouse]);

    const activeRecipe = useMemo(() =>
        recipes.find(r => r.id === selectedRecipeId) || recipes[0],
        [selectedRecipeId, recipes]);

    // Auto-create finished feed item for the active recipe if missing
    React.useEffect(() => {
        if (!activeRecipe) return;
        const customName = `Pakan Jadi - ${activeRecipe.name}`;
        const existingItem = inventory.find(i => i.name === customName && i.type === ItemType.FINISHED_FEED && i.houseId === (activeHouse?.id || ''));
        if (!existingItem) {
            addInventoryItem({
                name: customName,
                type: ItemType.FINISHED_FEED,
                quantity: 0,
                unit: 'kg',
                reorderPoint: 500,
                lastPrice: 0,
                houseId: activeHouse?.id || ''
            });
        } else {
            setOutputItemId(existingItem.id);
        }
    }, [activeRecipe, inventory, activeHouse, addInventoryItem]);

    // Parse ingredients safely (handle legacy percentage-based or already-kg-based)
    const parseIngredients = (raw: any): RecipeIngredient[] => {
        let ingredients = raw;
        if (typeof ingredients === 'string') {
            try { ingredients = JSON.parse(ingredients); } catch { return []; }
        }
        if (!Array.isArray(ingredients)) return [];
        return ingredients;
    };

    // Formulation details — now based directly on amountKg from recipe
    const formulationDetails = useMemo(() => {
        if (!activeRecipe) return [];
        const ingredients = parseIngredients(activeRecipe.ingredients);

        return ingredients.map((ing: RecipeIngredient) => {
            // Support both new (amountKg) and legacy (percentage) format
            const neededKg = (ing as any).amountKg ?? (ing as any).percentage ?? 0;
            const inventoryItem = inventory.find(item => item.id === ing.inventoryItemId);
            const currentStock = inventoryItem ? inventoryItem.quantity : 0;
            const isEnough = currentStock >= neededKg;

            return {
                inventoryItemId: ing.inventoryItemId,
                neededKg,
                name: inventoryItem?.name || `Unknown (${ing.inventoryItemId})`,
                unit: inventoryItem?.unit || 'kg',
                lastPrice: inventoryItem?.lastPrice || 0,
                currentStock,
                isEnough
            };
        });
    }, [activeRecipe, inventory]);

    // Total output kg = sum of all ingredient kg in recipe
    const totalOutputKg = formulationDetails.reduce((sum, d) => sum + d.neededKg, 0);

    // Total estimated cost
    const totalIngredientCost = formulationDetails.reduce((acc, d) => acc + d.neededKg * d.lastPrice, 0);
    const unitCostPerKg = totalOutputKg > 0 ? totalIngredientCost / totalOutputKg : 0;

    const canProcess = formulationDetails.length > 0 && formulationDetails.every(d => d.isEnough) && totalOutputKg > 0;

    const handleProcessMixing = () => {
        if (!canProcess) {
            Swal.fire({
                title: 'Stok Tidak Mencukupi!',
                text: 'Beberapa bahan baku kurang untuk memenuhi resep ini.',
                icon: 'error',
                confirmButtonColor: '#0f172a'
            });
            return;
        }

        Swal.fire({
            title: 'Proses Giling Pakan?',
            html: `
        <div class="text-left text-sm mt-4 space-y-2">
          <p>Resep: <b>${activeRecipe?.name}</b></p>
          <p>Total Output Pakan Jadi: <b>${totalOutputKg.toLocaleString('id-ID')} kg</b></p>
          <p>Estimasi HPP: <b>Rp ${Math.round(unitCostPerKg).toLocaleString('id-ID')}/kg</b></p>
          <hr class="my-3"/>
          <p class="text-xs text-slate-500">Stok bahan baku akan dipotong sesuai jumlah kg di resep dan stok pakan jadi akan bertambah.</p>
        </div>
      `,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#0f172a',
            cancelButtonColor: '#f1f5f9',
            confirmButtonText: 'Ya, Proses Giling',
            cancelButtonText: 'Batal',
        }).then((result) => {
            if (result.isConfirmed) {
                const effectiveOutputId = outputItemId || activeRecipe?.outputInventoryItemId || finishedFeedItems[0]?.id;
                const today = new Date().toISOString().split('T')[0];
                const millingRef = `MILLING-${Date.now()}`;

                // 1. Deduct each raw material by its exact kg in the recipe
                formulationDetails.forEach(detail => {
                    updateInventory(detail.inventoryItemId, -detail.neededKg);
                    createStockMutation({
                        date: today,
                        itemId: detail.inventoryItemId,
                        type: StockMutationType.USAGE,
                        quantity: detail.neededKg,
                        unitCost: detail.lastPrice,
                        sourceLocation: activeHouse?.id || '',
                        reference: `${millingRef}-USAGE`,
                        notes: `Bahan untuk Giling: ${activeRecipe?.name} (${detail.neededKg} kg)`
                    });
                });

                // 2. Add finished feed stock
                if (effectiveOutputId) {
                    updateInventory(effectiveOutputId, totalOutputKg);
                    updateInventoryItem(effectiveOutputId, { lastPrice: unitCostPerKg });

                    createStockMutation({
                        date: today,
                        itemId: effectiveOutputId,
                        type: StockMutationType.PRODUCTION,
                        quantity: totalOutputKg,
                        unitCost: unitCostPerKg,
                        sourceLocation: activeHouse?.id || '',
                        reference: `${millingRef}-OUT`,
                        notes: `Hasil Giling: ${activeRecipe?.name}`
                    });
                }

                Swal.fire({
                    title: 'Berhasil Diproses!',
                    html: `Pakan jadi bertambah <b>${totalOutputKg.toLocaleString('id-ID')} kg</b>.<br/>HPP: <b>Rp ${Math.round(unitCostPerKg).toLocaleString('id-ID')}/kg</b>`,
                    icon: 'success',
                    confirmButtonColor: '#0f172a',
                });
            }
        });
    };

    return (
        <div className="max-w-5xl mx-auto space-y-8 pb-20">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl md:text-2xl font-black text-slate-900 uppercase tracking-tighter italic">Formulasi Ransum Pakan</h1>
                    <p className="text-slate-500 text-[10px] md:text-sm mt-1 uppercase font-bold tracking-widest opacity-70">Manajemen Self-Mixing & Potong Stok Otomatis</p>
                </div>
                <button
                    onClick={() => setIsMasterModalOpen(true)}
                    className="bg-slate-900 text-white px-4 py-2 shadow-sm flex items-center space-x-2 hover:bg-slate-800 transition-colors"
                >
                    <Settings size={16} className="text-amber-500" />
                    <span className="text-xs font-bold uppercase tracking-wider">Master Resep</span>
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Kolom Kiri */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white p-6 border border-slate-200 shadow-sm space-y-6">
                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Pilih Resep Pakan</label>
                            <select
                                value={selectedRecipeId}
                                onChange={(e) => setSelectedRecipeId(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-sm px-4 py-3 text-sm font-bold text-slate-800 focus:outline-none focus:border-amber-500"
                            >
                                {recipes.map(r => (
                                    <option key={r.id} value={r.id}>{r.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Output item selector */}
                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Output: Pakan Jadi</label>
                            <select
                                value={outputItemId}
                                onChange={(e) => setOutputItemId(e.target.value)}
                                className="w-full bg-emerald-50 border border-emerald-200 rounded-sm px-4 py-3 text-sm font-bold text-emerald-800 focus:outline-none focus:border-emerald-400"
                            >
                                {finishedFeedItems.length === 0 && <option value="">-- Tidak ada item FINISHED_FEED --</option>}
                                {finishedFeedItems.map(item => (
                                    <option key={item.id} value={item.id}>{item.name} ({item.quantity.toLocaleString('id-ID')} kg)</option>
                                ))}
                            </select>
                        </div>

                        {/* Summary card */}
                        <div className="bg-slate-900 p-4 space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1">
                                    <Scale size={11} className="text-amber-400" /> Total Output Resep
                                </span>
                                <span className="font-black text-amber-400 text-sm">{totalOutputKg.toLocaleString('id-ID')} kg</span>
                            </div>
                            <div className="flex items-center justify-between border-t border-slate-700 pt-2">
                                <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Estimasi HPP/kg</span>
                                <span className="font-black text-emerald-400 text-sm">Rp {Math.round(unitCostPerKg).toLocaleString('id-ID')}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Total Biaya Bahan</span>
                                <span className="font-black text-white text-sm">Rp {Math.round(totalIngredientCost).toLocaleString('id-ID')}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Target FCR</span>
                                <span className="font-black text-slate-300">{(activeRecipe?.targetFcr || 0).toFixed(2)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Kolom Kanan: BOM Table */}
                <div className="lg:col-span-2">
                    <div className="bg-white border border-slate-200 shadow-sm">
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                            <h3 className="font-bold text-sm text-slate-800 uppercase tracking-wide flex items-center gap-2">
                                <Beaker size={16} className="text-amber-500" /> Rincian Bahan Baku (BOM)
                            </h3>
                            <span className="text-[10px] bg-white border border-slate-200 px-2 py-1 rounded font-bold text-slate-500">
                                {formulationDetails.length} bahan · {totalOutputKg.toLocaleString('id-ID')} kg total
                            </span>
                        </div>

                        <div className="p-0">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-white text-[10px] uppercase tracking-widest text-slate-400 border-b border-slate-100">
                                        <th className="px-6 py-4 font-bold">Bahan Baku</th>
                                        <th className="px-6 py-4 font-bold text-right">Kebutuhan (Kg)</th>
                                        <th className="px-6 py-4 font-bold text-right">Stok Gudang</th>
                                        <th className="px-6 py-4 font-bold text-right">Harga/kg</th>
                                        <th className="px-6 py-4 font-bold text-center">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm">
                                    {formulationDetails.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-10 text-center text-slate-400 text-[10px] font-bold uppercase">
                                                Belum ada bahan baku di resep ini. Klik Master Resep untuk menambahkan.
                                            </td>
                                        </tr>
                                    ) : formulationDetails.map((detail, idx) => (
                                        <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                                            <td className="px-6 py-4 font-medium text-slate-700">{detail.name}</td>
                                            <td className="px-6 py-4 text-right font-black text-slate-900">
                                                {detail.neededKg.toLocaleString('id-ID', { maximumFractionDigits: 2 })}
                                                <span className="text-slate-400 font-normal ml-1 text-xs">kg</span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <span className={cn(
                                                    "font-medium",
                                                    detail.isEnough ? "text-slate-600" : "text-rose-600 font-bold"
                                                )}>
                                                    {detail.currentStock.toLocaleString('id-ID', { maximumFractionDigits: 2 })}
                                                    {!detail.isEnough && (
                                                        <span className="ml-1 text-[9px] bg-rose-50 text-rose-500 border border-rose-200 px-1 rounded">
                                                            kurang {(detail.neededKg - detail.currentStock).toLocaleString('id-ID', { maximumFractionDigits: 2 })} kg
                                                        </span>
                                                    )}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right text-slate-500 text-xs font-mono">
                                                {detail.lastPrice > 0 ? `Rp ${detail.lastPrice.toLocaleString('id-ID')}` : '–'}
                                            </td>
                                            <td className="px-6 py-4 flex justify-center">
                                                {detail.isEnough ? (
                                                    <CheckCircle2 size={18} className="text-emerald-500" />
                                                ) : (
                                                    <AlertCircle size={18} className="text-rose-500" />
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                {formulationDetails.length > 0 && (
                                    <tfoot>
                                        <tr className="bg-slate-50 border-t border-slate-200 text-[10px] font-black uppercase text-slate-600">
                                            <td className="px-6 py-3">Total</td>
                                            <td className="px-6 py-3 text-right text-slate-900">{totalOutputKg.toLocaleString('id-ID')} kg</td>
                                            <td className="px-6 py-3"></td>
                                            <td className="px-6 py-3 text-right text-slate-500">Rp {Math.round(totalIngredientCost).toLocaleString('id-ID')}</td>
                                            <td></td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>

                        <div className="p-6 bg-slate-900 flex items-center justify-between">
                            <div>
                                {!canProcess && formulationDetails.length > 0 && (
                                    <p className="text-[10px] text-rose-400 uppercase tracking-widest font-bold flex items-center gap-1">
                                        <AlertCircle size={12} /> Stok tidak mencukupi untuk proses produksi
                                    </p>
                                )}
                                {!canProcess && formulationDetails.length === 0 && (
                                    <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">
                                        Pilih resep yang memiliki bahan baku
                                    </p>
                                )}
                                {canProcess && (
                                    <p className="text-[10px] text-emerald-400 uppercase tracking-widest font-bold flex items-center gap-1">
                                        <CheckCircle2 size={12} /> Semua bahan baku siap digiling
                                    </p>
                                )}
                            </div>
                            <button
                                onClick={handleProcessMixing}
                                disabled={!canProcess}
                                className={cn(
                                    "px-8 py-4 rounded-sm font-bold text-[10px] uppercase tracking-[0.2em] flex items-center space-x-2 transition-all shadow-md",
                                    canProcess
                                        ? "bg-amber-500 text-slate-900 hover:bg-amber-400"
                                        : "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700"
                                )}
                            >
                                <Save size={16} />
                                <span>Proses Giling ({totalOutputKg.toLocaleString('id-ID')} kg)</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Master Recipe Modal */}
            <Modal
                isOpen={isMasterModalOpen}
                onClose={() => {
                    setIsMasterModalOpen(false);
                    setIsEditingFormOpen(false);
                }}
                title={isEditingFormOpen ? (currentEditingRecipe ? 'Edit Master Resep' : 'Tambah Master Resep') : 'Kelola Master Resep'}
                className="max-w-2xl"
            >
                {!isEditingFormOpen ? (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Daftar Resep Template</p>
                            <button
                                onClick={() => {
                                    setCurrentEditingRecipe(null);
                                    setIsEditingFormOpen(true);
                                }}
                                className="flex items-center gap-2 bg-amber-500 text-slate-900 px-4 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-amber-400 transition-colors"
                            >
                                <Plus size={14} /> Tambah Resep
                            </button>
                        </div>

                        <div className="grid gap-3">
                            {recipes.map(recipe => {
                                const ings = parseIngredients(recipe.ingredients);
                                const totalKg = ings.reduce((s: number, i: any) => s + ((i.amountKg ?? i.percentage) || 0), 0);
                                return (
                                    <div key={recipe.id} className="group bg-slate-50 border border-slate-200 p-4 flex items-center justify-between hover:border-amber-500 transition-colors">
                                        <div>
                                            <h4 className="font-bold text-sm text-slate-800 uppercase italic tracking-tight">{recipe.name}</h4>
                                            <div className="flex items-center gap-4 mt-1">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase">FCR: {(recipe.targetFcr || 0).toFixed(2)}</span>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase">{ings.length} Bahan</span>
                                                <span className="text-[10px] font-bold text-amber-600 uppercase">{totalKg.toLocaleString('id-ID')} kg/batch</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => {
                                                    setCurrentEditingRecipe(recipe);
                                                    setIsEditingFormOpen(true);
                                                }}
                                                className="p-2 text-slate-400 hover:text-amber-600 transition-colors"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button
                                                onClick={() => {
                                                    Swal.fire({
                                                        title: 'Hapus Resep?',
                                                        text: "Resep ini akan dihapus dari master.",
                                                        icon: 'warning',
                                                        showCancelButton: true,
                                                        confirmButtonColor: '#e11d48',
                                                        cancelButtonColor: '#f1f5f9',
                                                        confirmButtonText: 'Ya, Hapus',
                                                        cancelButtonText: 'Batal'
                                                    }).then((result) => {
                                                        if (result.isConfirmed) deleteRecipe(recipe.id);
                                                    });
                                                }}
                                                className="p-2 text-slate-400 hover:text-rose-600 transition-colors"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    <RecipeForm
                        recipe={currentEditingRecipe}
                        onSave={(updatedRecipe) => {
                            if (currentEditingRecipe) {
                                updateRecipe(currentEditingRecipe.id, updatedRecipe);
                            } else {
                                addRecipe(updatedRecipe);
                            }
                            setIsEditingFormOpen(false);
                        }}
                        onCancel={() => setIsEditingFormOpen(false)}
                    />
                )}
            </Modal>
        </div>
    );
}

interface RecipeFormProps {
    recipe: FeedRecipe | null;
    onSave: (recipe: FeedRecipe) => void;
    onCancel: () => void;
}

function RecipeForm({ recipe, onSave, onCancel }: RecipeFormProps) {
    const { inventory } = useGlobalData();
    const [name, setName] = useState(recipe?.name || '');
    const [targetFcr, setTargetFcr] = useState(recipe?.targetFcr || 0);
    const rawMaterials = inventory.filter(i => i.type === ItemType.RAW_MATERIAL);

    // Migrate legacy percentage-based ingredients to amountKg on load
    const migrateIngredients = (ings: any[]): Array<{ inventoryItemId: string; amountKg: number }> => {
        return ings.map(ing => ({
            inventoryItemId: ing.inventoryItemId || '',
            // If legacy: keep percentage value as-is (user will correct it)
            // If new: use amountKg
            amountKg: ing.amountKg ?? ing.percentage ?? 0
        }));
    };

    const rawIngredients = (() => {
        let ings = recipe?.ingredients || [];
        if (typeof ings === 'string') { try { ings = JSON.parse(ings); } catch { ings = []; } }
        if (!Array.isArray(ings) || ings.length === 0) return [{ inventoryItemId: rawMaterials[0]?.id || '', amountKg: 0 }];
        return migrateIngredients(ings);
    })();

    const [ingredients, setIngredients] = useState<Array<{ inventoryItemId: string; amountKg: number }>>(rawIngredients);

    const totalKg = ingredients.reduce((sum, ing) => sum + (ing.amountKg || 0), 0);

    const handleAddIngredient = () => {
        setIngredients([...ingredients, { inventoryItemId: rawMaterials[0]?.id || '', amountKg: 0 }]);
    };

    const handleRemoveIngredient = (index: number) => {
        setIngredients(ingredients.filter((_, i) => i !== index));
    };

    const handleIngredientChange = (index: number, field: 'inventoryItemId' | 'amountKg', value: any) => {
        const newIngredients = [...ingredients];
        newIngredients[index] = { ...newIngredients[index], [field]: field === 'amountKg' ? Number(value) : value };
        setIngredients(newIngredients);
    };

    const handleSave = () => {
        if (!name || targetFcr <= 0 || ingredients.length === 0) {
            Swal.fire('Error', 'Mohon lengkapi semua data resep', 'error');
            return;
        }
        if (totalKg <= 0) {
            Swal.fire('Error', 'Total kebutuhan bahan harus lebih dari 0 kg', 'error');
            return;
        }
        if (ingredients.some(i => !i.inventoryItemId || i.amountKg <= 0)) {
            Swal.fire('Error', 'Semua bahan harus dipilih dan jumlah kg harus lebih dari 0', 'error');
            return;
        }

        // Save with amountKg field (new format)
        onSave({
            id: recipe?.id || '',
            name,
            targetFcr,
            ingredients: ingredients as any
        });
    };

    return (
        <div className="space-y-6">
            <button
                onClick={onCancel}
                className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors"
            >
                <ChevronLeft size={14} /> Kembali ke Daftar
            </button>

            <div className="p-3 bg-amber-50 border border-amber-100 rounded-sm">
                <p className="text-[10px] font-bold text-amber-700 leading-relaxed">
                    Masukkan jumlah bahan dalam <span className="font-black">kilogram (kg) per batch giling</span>.
                    Saat proses giling dijalankan, stok gudang akan dipotong sesuai angka ini secara langsung.
                </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 sm:col-span-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Nama Resep</label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Contoh: Ransum Layer Umur 20-30 Minggu"
                        className="w-full bg-slate-50 border border-slate-200 rounded-sm px-4 py-2 text-sm font-bold text-slate-800 focus:outline-none focus:border-amber-500"
                    />
                </div>
                <div className="col-span-2 sm:col-span-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Target FCR</label>
                    <input
                        type="number"
                        step="0.01"
                        value={targetFcr}
                        onChange={(e) => setTargetFcr(Number(e.target.value))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-sm px-4 py-2 text-sm font-bold text-slate-800 focus:outline-none focus:border-amber-500"
                    />
                </div>
            </div>

            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Komposisi Bahan (Kg per Batch)</label>
                    <span className={cn(
                        "text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded",
                        totalKg > 0 ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                    )}>
                        Total: {totalKg.toLocaleString('id-ID')} kg
                    </span>
                </div>

                {/* Header */}
                <div className="grid grid-cols-[1fr_140px_36px] gap-2 px-1">
                    <span className="text-[9px] font-bold uppercase text-slate-400 tracking-widest">Bahan Baku</span>
                    <span className="text-[9px] font-bold uppercase text-slate-400 tracking-widest text-right">Jumlah (Kg)</span>
                    <span></span>
                </div>

                <div className="space-y-2">
                    {ingredients.map((ing, idx) => {
                        const item = inventory.find(i => i.id === ing.inventoryItemId);
                        return (
                            <div key={idx} className="grid grid-cols-[1fr_140px_36px] gap-2 items-center">
                                <select
                                    value={ing.inventoryItemId}
                                    onChange={(e) => handleIngredientChange(idx, 'inventoryItemId', e.target.value)}
                                    className="bg-slate-50 border border-slate-200 rounded-sm px-3 py-2 text-sm font-medium text-slate-700 focus:outline-none focus:border-amber-500"
                                >
                                    {rawMaterials.map(item => (
                                        <option key={item.id} value={item.id}>
                                            {item.name} (stok: {item.quantity.toLocaleString('id-ID')} {item.unit})
                                        </option>
                                    ))}
                                </select>
                                <div className="relative">
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.5"
                                        value={ing.amountKg}
                                        onChange={(e) => handleIngredientChange(idx, 'amountKg', e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-sm px-3 py-2 text-sm font-black text-slate-900 focus:outline-none focus:border-amber-500 text-right pr-8"
                                    />
                                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">kg</span>
                                </div>
                                <button
                                    onClick={() => handleRemoveIngredient(idx)}
                                    className="p-2 text-slate-300 hover:text-rose-500 transition-colors"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        );
                    })}
                </div>

                <button
                    onClick={handleAddIngredient}
                    className="w-full py-2 border border-dashed border-slate-300 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 hover:border-amber-500 hover:text-amber-500 transition-all flex items-center justify-center gap-2"
                >
                    <Plus size={14} /> Tambah Bahan Baku
                </button>
            </div>

            <div className="pt-4 flex gap-3">
                <button
                    onClick={handleSave}
                    className="flex-1 bg-slate-900 text-white py-3 text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-colors shadow-lg"
                >
                    Simpan Master Resep
                </button>
            </div>
        </div>
    );
}