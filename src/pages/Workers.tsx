import React, { useState } from 'react';
import {
    Users as UsersIcon,
    Plus,
    DollarSign,
    Award,
    ChevronRight,
    TrendingUp,
    Briefcase,
    Settings,
    Save,
    Shield,
    User as UserIcon,
    Wrench,
    Trash2
} from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';
import { motion } from 'motion/react';
import { UserRole, User } from '../types';
import Modal from '../components/Modal';
import Swal from 'sweetalert2';
import { useApp } from '../AppContext';
import { useGlobalData } from '../GlobalContext';
import { useHouse } from '../HouseContext';
import { generateSalarySlip } from '../lib/pdfGenerator';

export default function Workers() {
    const { user: currentUser, users, addUser, updateUser } = useApp();
    const { addTransaction, addJournalEntry, accounts } = useGlobalData();
    const { houses } = useHouse(); // Corrected hook


    const [isWorkerModalOpen, setIsWorkerModalOpen] = useState(false);
    const [isSalaryModalOpen, setIsSalaryModalOpen] = useState(false);
    const [selectedWorker, setSelectedWorker] = useState<User | null>(null);
    const [salaryItems, setSalaryItems] = useState<{ id: string, label: string, amount: number, type: 'ADDITION' | 'DEDUCTION' }[]>([]);

    const handleAddWorker = (e: React.FormEvent) => {
        e.preventDefault();
        const formData = new FormData(e.target as HTMLFormElement);
        const name = formData.get('name') as string;
        const role = formData.get('role') as UserRole;
        const salary = Number(formData.get('salary'));
        const email = formData.get('email') as string;

        if (!name || !email) return;

        addUser({
            name,
            username: email.split('@')[0],
            role,
            email,
            password: 'password123',
            salary,
            assignedHouses: []
        });

        Swal.fire({
            title: 'Berhasil!',
            text: 'Personel telah didaftarkan.',
            icon: 'success',
            confirmButtonColor: '#0f172a'
        });
        setIsWorkerModalOpen(false);
    };

    const handleUpdateSalary = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedWorker) return;

        const formData = new FormData(e.target as HTMLFormElement);
        const salary = Number(formData.get('salary'));

        updateUser(selectedWorker.id, { salary });

        Swal.fire({
            title: 'Berhasil!',
            text: 'Gaji pokok telah diperbarui.',
            icon: 'success',
            confirmButtonColor: '#0f172a'
        });
        setIsSalaryModalOpen(false);
    };

    const [selectedHouseId, setSelectedHouseId] = useState<string>('CENTRAL');

    const handleDownloadSlip = async () => {
        if (!selectedWorker) return;

        const baseSalary = selectedWorker.salary || 0;
        const mappedItems = salaryItems.map(item => ({
            label: item.type === 'DEDUCTION' ? `Potongan: ${item.label}` : item.label,
            amount: item.type === 'DEDUCTION' ? -item.amount : item.amount
        }));

        const additions = salaryItems.filter(i => i.type === 'ADDITION').reduce((acc, curr) => acc + curr.amount, 0);
        const deductions = salaryItems.filter(i => i.type === 'DEDUCTION').reduce((acc, curr) => acc + curr.amount, 0);
        const total = baseSalary + additions - deductions;

        try {
            // Record to financial report with Journal Entry
            const journalId = await addJournalEntry(
                { date: new Date().toISOString().split('T')[0], description: `Gaji: ${selectedWorker.name}`, reference: `PAY-${Date.now()}` },
                [
                    { accountId: 'acc-beban-gaji', debit: total, credit: 0, houseId: selectedHouseId },
                    { accountId: 'acc-kas', debit: 0, credit: total, houseId: selectedHouseId }
                ]
            );

            await addTransaction({
                houseId: selectedHouseId,
                date: new Date().toISOString().split('T')[0],
                description: `Gaji & Borongan: ${selectedWorker.name}`,
                qty: '1 Org',
                price: total,
                total: total,
                account: 'Kas',
                type: 'EXPENSE',
                category: 'Payroll',
                journalId
            });

            generateSalarySlip({
                workerName: selectedWorker.name,
                role: selectedWorker.role,
                baseSalary: baseSalary,
                boronganItems: mappedItems.filter(i => i.amount !== 0),
                totalSalary: total,
                date: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
            });

            Swal.fire('Berhasil', 'Gaji telah dicatat dan slip diunduh.', 'success');
        } catch (error: any) {
            Swal.fire('Gagal', error.message || 'Gagal menyimpan transaksi gaji', 'error');
        }
    };

    // Include both ADMIN and WORKER
    const displayedWorkers = users.filter(u => u.role === UserRole.ADMIN || u.role === UserRole.WORKER);

    const ROLE_ICON: Record<UserRole, any> = {
        [UserRole.SUPER_ADMIN]: Shield,
        [UserRole.ADMIN]: UserIcon,
        [UserRole.WORKER]: Wrench,
    };

    const totalMonthlyLiability = displayedWorkers.reduce((acc, w) => acc + (w.salary || 0), 0);

    return (
        <div className="space-y-8 pb-20">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight italic uppercase">Manpower & Payroll</h1>
                    <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Pengelolaan personil farm dan rincian kompensasi.</p>
                </div>
                {currentUser?.role === UserRole.SUPER_ADMIN && (
                    <button
                        onClick={() => setIsWorkerModalOpen(true)}
                        className="bg-slate-900 text-white px-6 py-3 rounded-sm text-[10px] font-bold uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg flex items-center space-x-2 border border-slate-800 group"
                    >
                        <Plus size={16} className="group-hover:text-amber-500 transition-colors" />
                        <span>Daftarkan Personel</span>
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white border border-slate-200 overflow-hidden shadow-sm">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <h3 className="font-bold text-[10px] uppercase tracking-widest text-slate-700 italic">Personnel Registry</h3>
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{displayedWorkers.length} Active Personnel</div>
                        </div>
                        <div className="divide-y divide-slate-50">
                            {displayedWorkers.map((worker) => {
                                const Icon = ROLE_ICON[worker.role] || UserIcon;
                                return (
                                    <div
                                        key={worker.id}
                                        className="p-6 hover:bg-slate-50 transition-colors group flex items-center justify-between cursor-pointer"
                                        onClick={() => {
                                            if (currentUser?.role === UserRole.SUPER_ADMIN) {
                                                setSelectedWorker(worker);
                                                setSalaryItems([
                                                    { id: 'default-1', label: 'Penjualan Pupuk', amount: 0, type: 'ADDITION' },
                                                    { id: 'default-2', label: 'Penjualan Karung', amount: 0, type: 'ADDITION' },
                                                    { id: 'default-3', label: 'Lain-lain / Bonus', amount: 0, type: 'ADDITION' }
                                                ]);
                                                setIsSalaryModalOpen(true);
                                            }
                                        }}
                                    >
                                        <div className="flex items-center space-x-4">
                                            <div className="w-12 h-12 rounded-sm bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-slate-900 group-hover:text-amber-500 transition-all border border-slate-200 group-hover:border-slate-800">
                                                <Icon size={20} />
                                            </div>
                                            <div className="min-w-0">
                                                <h4 className="font-bold text-slate-800 truncate uppercase tracking-tight italic">{worker.name}</h4>
                                                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-0.5">{worker.role.replace('_', ' ')}</p>
                                            </div>
                                        </div>

                                        <div className="flex items-center space-x-8 md:space-x-12">
                                            <div className="text-right">
                                                <p className="text-xs font-black text-slate-900 italic">{formatCurrency(worker.salary || 0)}</p>
                                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Monthly Salary</p>
                                            </div>

                                            <button className="text-slate-200 group-hover:text-amber-500 transition-colors">
                                                <ChevronRight size={18} />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <div className="space-y-8">
                    <div className="bg-slate-900 text-white p-8 shadow-2xl relative overflow-hidden border border-slate-800">
                        <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none transform translate-x-12 -translate-y-8">
                            <DollarSign size={160} />
                        </div>
                        <h3 className="text-amber-500 text-[10px] font-black uppercase tracking-[0.25em] mb-8">Monthly Salary Liability</h3>
                        <div className="space-y-6">
                            <div>
                                <p className="text-3xl font-black italic tracking-tighter text-white">
                                    {formatCurrency(totalMonthlyLiability)}
                                </p>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-6 italic">Total Pengeluaran Gaji Bulanan</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-6 border border-slate-200 border-l-4 border-l-amber-500 shadow-sm space-y-4">
                        <div className="flex items-center space-x-2 text-amber-500">
                            <TrendingUp size={14} />
                            <span className="text-[10px] font-black uppercase tracking-[0.25em]">Owner Insight</span>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed font-bold italic uppercase tracking-tight">
                            "Data personil kini mencakup Admin dan Anak Kandang. Klik pada nama personil untuk mengatur rincian gaji dan cetak slip gaji borongan."
                        </p>
                    </div>
                </div>
            </div>

            {/* Modal Tambah Personel */}
            <Modal
                isOpen={isWorkerModalOpen}
                onClose={() => setIsWorkerModalOpen(false)}
                title="Daftarkan Personel Baru"
            >
                <form onSubmit={handleAddWorker} className="space-y-6">
                    <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Nama Lengkap</label>
                        <input name="name" required type="text" placeholder="Ahmad Subarjo" className="w-full bg-slate-50 border border-slate-200 rounded-sm px-4 py-3 text-sm focus:outline-none focus:border-amber-500 font-bold" />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Email / Username</label>
                        <input name="email" required type="email" placeholder="ahmad@farm.com" className="w-full bg-slate-50 border border-slate-200 rounded-sm px-4 py-3 text-sm focus:outline-none focus:border-amber-500 font-bold" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Role / Jabatan</label>
                            <select name="role" className="w-full bg-slate-50 border border-slate-200 rounded-sm px-4 py-3 text-sm font-bold focus:outline-none focus:border-amber-500">
                                <option value={UserRole.WORKER}>PENGAWAS</option>
                                <option value={UserRole.ADMIN}>ADMIN GUDANG</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Gaji Pokok (IDR)</label>
                            <input name="salary" required type="number" defaultValue={3500000} className="w-full bg-slate-50 border border-slate-200 rounded-sm px-4 py-3 text-sm font-bold focus:outline-none focus:border-amber-500 font-mono" />
                        </div>
                    </div>
                    <button type="submit" className="w-full bg-slate-900 text-white py-4 rounded-sm font-bold text-[10px] uppercase tracking-[0.25em] hover:bg-slate-800 transition-all shadow-xl">
                        Daftarkan ke Sistem
                    </button>
                </form>
            </Modal>

            {/* Modal Update Gaji & Borongan */}
            <Modal
                isOpen={isSalaryModalOpen}
                onClose={() => setIsSalaryModalOpen(false)}
                title={`Rincian Gaji: ${selectedWorker?.name}`}
                className="max-w-xl"
            >
                <div className="space-y-8">
                    <form onSubmit={handleUpdateSalary} className="space-y-4">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-900 italic border-b border-slate-100 pb-2">Gaji Pokok Utama</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2 sm:col-span-1">
                                <label className="text-[9px] font-bold uppercase tracking-widest text-slate-400 block mb-1">Gaji Bulanan Tetap (IDR)</label>
                                <input name="salary" required type="number" defaultValue={selectedWorker?.salary} className="w-full bg-slate-50 border border-slate-200 rounded-sm px-4 py-3 text-sm font-bold focus:outline-none focus:border-amber-500 font-mono" />
                            </div>
                            <div className="col-span-2 sm:col-span-1">
                                <label className="text-[9px] font-bold uppercase tracking-widest text-slate-400 block mb-1">Bebankan ke Kandang</label>
                                <select
                                    value={selectedHouseId}
                                    onChange={(e) => setSelectedHouseId(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-sm px-4 py-3 text-sm font-bold focus:outline-none focus:border-amber-500"
                                >
                                    <option value="CENTRAL">Pusat / Shared</option>
                                    {houses.map(h => (
                                        <option key={h.id} value={h.id}>{h.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <button type="submit" className="w-full bg-slate-900 text-white py-3 rounded-sm hover:bg-slate-800 transition-all shadow-md flex items-center justify-center gap-2">
                            <Save size={18} /> Update Gaji Pokok
                        </button>

                    </form>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-900 italic">Uraian Tambahan & Potongan Gaji</h4>
                            <button
                                type="button"
                                onClick={() => setSalaryItems(prev => [...prev, { id: `item-${Date.now()}`, label: 'Uraian Baru', amount: 0, type: 'ADDITION' }])}
                                className="text-[9px] px-2 py-1 bg-slate-100 hover:bg-slate-200 font-bold uppercase"
                            >+ Tambah Uraian</button>
                        </div>

                        <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                            {salaryItems.map((item, index) => (
                                <div key={item.id} className="flex items-center gap-2 bg-slate-50 p-2 border border-slate-100">
                                    <select
                                        value={item.type}
                                        onChange={(e) => setSalaryItems(prev => prev.map(i => i.id === item.id ? { ...i, type: e.target.value as 'ADDITION' | 'DEDUCTION' } : i))}
                                        className="w-28 bg-white border border-slate-200 px-2 py-2 text-xs font-bold focus:outline-none"
                                    >
                                        <option value="ADDITION">Penambah (+)</option>
                                        <option value="DEDUCTION">Potongan (-)</option>
                                    </select>
                                    <input
                                        type="text"
                                        value={item.label}
                                        onChange={(e) => setSalaryItems(prev => prev.map(i => i.id === item.id ? { ...i, label: e.target.value } : i))}
                                        placeholder="Keterangan..."
                                        className="flex-1 bg-white border border-slate-200 px-3 py-2 text-xs font-bold focus:outline-none focus:border-amber-500"
                                    />
                                    <input
                                        type="number"
                                        value={item.amount === 0 ? '' : item.amount}
                                        onChange={(e) => setSalaryItems(prev => prev.map(i => i.id === item.id ? { ...i, amount: Number(e.target.value) } : i))}
                                        placeholder="Nominal Rp"
                                        className="w-32 bg-white border border-slate-200 px-3 py-2 text-xs font-bold focus:outline-none focus:border-amber-500"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setSalaryItems(prev => prev.filter(i => i.id !== item.id))}
                                        className="p-2 text-slate-300 hover:text-rose-500 transition-colors"
                                    ><Trash2 size={14} /></button>
                                </div>
                            ))}
                            {salaryItems.length === 0 && (
                                <p className="text-center text-xs text-slate-400 font-bold italic py-4">Belum ada rincian tambahan/potongan.</p>
                            )}
                        </div>
                    </div>

                    <div className="bg-slate-900 p-6 border border-slate-800 text-white">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-slate-500">Total Take Home Pay</p>
                                <p className="text-2xl font-black italic tracking-tighter text-amber-500">
                                    {formatCurrency((selectedWorker?.salary || 0) + salaryItems.filter(i => i.type === 'ADDITION').reduce((a, c) => a + c.amount, 0) - salaryItems.filter(i => i.type === 'DEDUCTION').reduce((a, c) => a + c.amount, 0))}
                                </p>
                            </div>
                            <DollarSign size={24} className="text-slate-700" />
                        </div>
                        <button
                            onClick={handleDownloadSlip}
                            className="w-full bg-white text-slate-900 py-4 rounded-sm font-bold text-[10px] uppercase tracking-[0.25em] hover:bg-slate-100 transition-all flex items-center justify-center gap-2"
                        >
                            <Save size={16} /> Generate & Download Slip Gaji (PDF)
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
