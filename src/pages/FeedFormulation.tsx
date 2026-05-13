/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Beaker, Settings, CheckCircle2, AlertCircle, Save, Plus, Trash2, Edit2, ChevronLeft } from 'lucide-react';
import Swal from 'sweetalert2';
import { cn } from '../lib/utils';
import Modal from '../components/Modal';
import { useGlobalData } from '../GlobalContext';
import { useHouse } from '../HouseContext';
import { FeedRecipe, RecipeIngredient, ItemType } from '../types';

export default function FeedFormulation() {
    const { activeHouse } = useHouse();
    const { inventory, updateInventory, recipes, addRecipe, updateRecipe, deleteRecipe } = useGlobalData();
    const [selectedRecipeId, setSelectedRecipeId] = useState(recipes.length > 0 ? recipes[0].id : '');
    const [targetProductionKg, setTargetProductionKg] = useState<number>(1000);
    const [outputItemId, setOutputItemId] = useState('');

    // Modal States
    const [isMasterModalOpen, setIsMasterModalOpen] = useState(false);
    const [isEditingFormOpen, setIsEditingFormOpen] = useState(false);
    const [currentEditingRecipe, setCurrentEditingRecipe] = useState<FeedRecipe | null>(null);

    // Finished feed items for output selector
    const finishedFeedItems = useMemo(() =>
        inventory.filter(i => i.type === ItemType.FINISHED_FEED && (!i.houseId || i.houseId === activeHouse?.id)), [inventory, activeHouse]);

    // Raw materials only for ingredient dropdown
    const rawMaterialItems = useMemo(() =>
        inventory.filter(i => i.type === ItemType.RAW_MATERIAL && (!i.houseId || i.houseId === activeHouse?.id)), [inventory, activeHouse]);

    const activeRecipe = useMemo(() =>
        recipes.find(r => r.id === selectedRecipeId) || recipes[0],
        [selectedRecipeId, recipes]);

    const formulationDetails = useMemo(() => {
        if (!activeRecipe || !targetProductionKg) return [];

        let ingredients = activeRecipe.ingredients;
        if (typeof ingredients === 'string') {
            try {
                ingredients = JSON.parse(ingredients);
            } catch (e) {
                console.error("Failed to parse ingredients string:", e);
                return [];
            }
        }

        if (!Array.isArray(ingredients)) return [];

        return ingredients.map((ing: any) => {
            const neededKg = (ing.percentage / 100) * targetProductionKg;
            const inventoryItem = inventory.find(item => item.id === ing.inventoryItemId);
            const currentStock = inventoryItem ? inventoryItem.quantity : 0;
            const isEnough = currentStock >= neededKg;

            return {
                inventoryItemId: ing.inventoryItemId,
                percentage: ing.percentage,
                name: inventoryItem?.name || `Unknown (${ing.inventoryItemId})`,
                neededKg,
                currentStock,
                isEnough
            };
        });
    }, [activeRecipe, targetProductionKg, inventory]);

    const canProcess = formulationDetails.length > 0 && formulationDetails.every(d => d.isEnough) && targetProductionKg > 0;

    const handleProcessMixing = () => {
        if (!canProcess) {
            Swal.fire({
                title: 'Stok Tidak Mencukupi!',
                text: 'Beberapa bahan baku kurang untuk memenuhi target produksi ini.',
                icon: 'error',
                confirmButtonColor: '#0f172a'
            });
            return;
        }

        Swal.fire({
            title: 'Proses Giling Pakan?',
            html: `
        <div class="text-left text-sm mt-4">
          <p>Resep: <b>${activeRecipe?.name}</b></p>
          <p>Total Output Pakan Jadi: <b>${targetProductionKg} kg</b></p>
          <hr class="my-3"/>
          <p class="text-xs text-slate-500">Sistem akan otomatis memotong stok raw material dan menambah stok pakan jadi.</p>
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
                // FIX #3: Identify output FINISHED_FEED item by ItemType, not name
                const effectiveOutputId = outputItemId || activeRecipe?.outputInventoryItemId || finishedFeedItems[0]?.id;

                // 1. Deduct raw material stocks
                formulationDetails.forEach(detail => {
                    updateInventory(detail.inventoryItemId, -detail.neededKg);
                });

                // 2. Increment the FINISHED_FEED item
                if (effectiveOutputId) {
                    updateInventory(effectiveOutputId, targetProductionKg);
                }

                Swal.fire({
                    title: 'Berhasil Memproses!',
                    text: `Stok pakan jadi telah ditambahkan sebanyak ${targetProductionKg} kg.`,
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
                {/* Kolom Kiri: Input & Pilihan Resep */}
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

                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Target Produksi (Kg)</label>
                            <div className="relative">
                                <input
                                    type="number"
                                    value={targetProductionKg}
                                    onChange={(e) => setTargetProductionKg(Number(e.target.value))}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-sm px-4 py-3 text-lg font-black text-slate-900 focus:outline-none focus:border-amber-500"
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 uppercase">Kilogram</span>
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Output: Pakan Jadi Layer Mix</label>
                            <select
                                value={outputItemId || activeRecipe?.outputInventoryItemId || finishedFeedItems[0]?.id || ''}
                                onChange={(e) => setOutputItemId(e.target.value)}
                                className="w-full bg-emerald-50 border border-emerald-200 rounded-sm px-4 py-3 text-sm font-bold text-emerald-800 focus:outline-none focus:border-emerald-400"
                            >
                                {finishedFeedItems.length === 0 && <option value="">-- Tidak ada item FINISHED_FEED --</option>}
                                {finishedFeedItems.map(item => (
                                    <option key={item.id} value={item.id}>{item.name} ({item.quantity} {item.unit})</option>
                                ))}
                            </select>
                        </div>

                        <div className="bg-slate-50 p-4 border border-dashed border-slate-300 rounded-sm">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Estimasi Target FCR</span>
                                <span className="font-black text-emerald-600">{(activeRecipe?.targetFcr || 0).toFixed(2)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Kolom Kanan: Rincian Kebutuhan & Validasi Stok */}
                <div className="lg:col-span-2">
                    <div className="bg-white border border-slate-200 shadow-sm">
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                            <h3 className="font-bold text-sm text-slate-800 uppercase tracking-wide flex items-center gap-2">
                                <Beaker size={16} className="text-amber-500" /> Rincian Bahan Baku (BOM)
                            </h3>
                            <span className="text-[10px] bg-white border border-slate-200 px-2 py-1 rounded font-bold text-slate-500">Total: 100%</span>
                        </div>

                        <div className="p-0">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-white text-[10px] uppercase tracking-widest text-slate-400 border-b border-slate-100">
                                        <th className="px-6 py-4 font-bold">Bahan Baku</th>
                                        <th className="px-6 py-4 font-bold text-right">%</th>
                                        <th className="px-6 py-4 font-bold text-right">Kebutuhan (Kg)</th>
                                        <th className="px-6 py-4 font-bold text-right">Stok Gudang</th>
                                        <th className="px-6 py-4 font-bold text-center">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm">
                                    {formulationDetails.map((detail, idx) => (
                                        <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                                            <td className="px-6 py-4 font-medium text-slate-700">{detail.name}</td>
                                            <td className="px-6 py-4 text-right text-slate-500">{detail.percentage}%</td>
                                            <td className="px-6 py-4 text-right font-bold text-slate-900">{detail.neededKg.toFixed(1)}</td>
                                            <td className="px-6 py-4 text-right">
                                                <span className={cn(
                                                    "font-medium",
                                                    detail.isEnough ? "text-slate-600" : "text-rose-600"
                                                )}>
                                                    {detail.currentStock.toFixed(1)}
                                                </span>
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
                            </table>
                        </div>

                        <div className="p-6 bg-slate-900 flex items-center justify-between">
                            <div>
                                {!canProcess && (
                                    <p className="text-[10px] text-rose-400 uppercase tracking-widest font-bold flex items-center gap-1">
                                        <AlertCircle size={12} /> Stok tidak mencukupi untuk proses produksi
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
                                <span>Proses Giling</span>
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
                            {recipes.map(recipe => (
                                <div key={recipe.id} className="group bg-slate-50 border border-slate-200 p-4 flex items-center justify-between hover:border-amber-500 transition-colors">
                                    <div>
                                        <h4 className="font-bold text-sm text-slate-800 uppercase italic tracking-tight">{recipe.name}</h4>
                                        <div className="flex items-center gap-4 mt-1">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase">FCR: {(recipe.targetFcr || 0).toFixed(2)}</span>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase">{recipe.ingredients.length} Bahan</span>
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
                                                    if (result.isConfirmed) {
                                                        deleteRecipe(recipe.id);
                                                    }
                                                });
                                            }}
                                            className="p-2 text-slate-400 hover:text-rose-600 transition-colors"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))}
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
    const [ingredients, setIngredients] = useState<RecipeIngredient[]>(recipe?.ingredients || [
        { inventoryItemId: inventory[0]?.id || '', percentage: 0 }
    ]);

    const totalPercentage = ingredients.reduce((sum, ing) => sum + ing.percentage, 0);

    const handleAddIngredient = () => {
        setIngredients([...ingredients, { inventoryItemId: inventory[0]?.id || '', percentage: 0 }]);
    };

    const handleRemoveIngredient = (index: number) => {
        setIngredients(ingredients.filter((_, i) => i !== index));
    };

    const handleIngredientChange = (index: number, field: keyof RecipeIngredient, value: any) => {
        const newIngredients = [...ingredients];
        newIngredients[index] = { ...newIngredients[index], [field]: value };
        setIngredients(newIngredients);
    };

    const handleSave = () => {
        if (!name || targetFcr <= 0 || ingredients.length === 0) {
            Swal.fire('Error', 'Mohon lengkapi semua data', 'error');
            return;
        }

        if (totalPercentage !== 100) {
            Swal.fire('Error', 'Total persentase harus 100%', 'error');
            return;
        }

        onSave({
            id: recipe?.id || '',
            name,
            targetFcr,
            ingredients
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
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Komposisi Bahan</label>
                    <span className={cn(
                        "text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded",
                        totalPercentage === 100 ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                    )}>
                        Total: {totalPercentage}%
                    </span>
                </div>

                <div className="space-y-2">
                    {ingredients.map((ing, idx) => (
                        <div key={idx} className="flex gap-2">
                            <select
                                value={ing.inventoryItemId}
                                onChange={(e) => handleIngredientChange(idx, 'inventoryItemId', e.target.value)}
                                className="flex-1 bg-slate-50 border border-slate-200 rounded-sm px-3 py-2 text-sm font-medium text-slate-700 focus:outline-none focus:border-amber-500"
                            >
                                {inventory.map(item => (
                                    <option key={item.id} value={item.id}>{item.name}</option>
                                ))}
                            </select>
                            <div className="relative w-24">
                                <input
                                    type="number"
                                    value={ing.percentage}
                                    onChange={(e) => handleIngredientChange(idx, 'percentage', Number(e.target.value))}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-sm px-3 py-2 text-sm font-bold text-slate-800 focus:outline-none focus:border-amber-500 text-right pr-6"
                                />
                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">%</span>
                            </div>
                            <button
                                onClick={() => handleRemoveIngredient(idx)}
                                className="p-2 text-slate-300 hover:text-rose-500 transition-colors"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    ))}
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