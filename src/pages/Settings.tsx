import React, { useState, useMemo } from 'react';
import { 
  ShieldCheck, 
  RotateCcw, 
  Smartphone,
  ChevronRight,
  Database,
  Home,
  Plus,
  Calendar, 
  Hash, 
  User as UserIcon, 
  Trash2, 
  Edit2, 
  CheckCircle2,
  Layout as LayoutIcon,
  Save,
  Shield,
  Search,
  CreditCard,
  BookOpen,
  Download
} from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { UserRole, User, PoultryHouse, FlockBatch, Account, AccountCategory } from '../types';
import Swal from 'sweetalert2';
import { useHouse } from '../HouseContext';
import { useApp } from '../AppContext';
import { useFlock } from '../FlockContext';
import Modal from '../components/Modal';
import { useGlobalData } from '../GlobalContext';

export default function Settings() {
  const [activeSection, setActiveSection] = useState('HOUSES');
  const { houses, addHouse, updateHouse, deleteHouse, selectedHouseId } = useHouse();
  const { users, addUser, updateUser, deleteUser, sidebarPermissions, updatePermissions } = useApp();
  const { flocks, addFlock, updateFlock, deleteFlock } = useFlock();
  const { farmSettings, saveFarmSettings, accounts, addAccount, updateAccount, deleteAccount } = useGlobalData();
  
  // --- House Management State ---
  const [isHouseModalOpen, setIsHouseModalOpen] = useState(false);
  const [editingHouse, setEditingHouse] = useState<PoultryHouse | null>(null);

  // --- Profile Farm State ---
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // --- Flock Management State ---
  const [isFlockModalOpen, setIsFlockModalOpen] = useState(false);
  const [editingFlock, setEditingFlock] = useState<FlockBatch | null>(null);

  // --- Security State ---
  const [selectedRoleForSecurity, setSelectedRoleForSecurity] = useState<UserRole>(UserRole.ADMIN);

  // --- Master Price State ---
  const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);
  const [editingPrice, setEditingPrice] = useState<{id: string, name: string, price: number} | null>(null);

  // --- Supplier State ---
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<any | null>(null);

  // --- Accounts State ---
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [newAccountCategory, setNewAccountCategory] = useState<AccountCategory>(AccountCategory.ASSET);

  // --- Auto COA Code Generator ---
  const COA_PREFIX: Record<AccountCategory, number> = {
    [AccountCategory.ASSET]: 100,
    [AccountCategory.LIABILITY]: 200,
    [AccountCategory.EQUITY]: 300,
    [AccountCategory.REVENUE]: 400,
    [AccountCategory.EXPENSE]: 500,
  };

  const generateNextCOACode = (category: AccountCategory): string => {
    const prefix = COA_PREFIX[category];
    const existing = accounts
      .filter(a => {
        const num = parseInt(a.code);
        return num >= prefix && num < prefix + 100;
      })
      .map(a => parseInt(a.code))
      .sort((a, b) => a - b);
    // Find next gap starting from prefix+1
    let next = prefix + 1;
    for (const code of existing) {
      if (code === next) next++;
      else break;
    }
    return String(next);
  };

  const autoCode = editingAccount ? editingAccount.code : generateNextCOACode(newAccountCategory);

  // --- Targets & Tolerances Local State (for explicit Save) ---
  const [targetForm, setTargetForm] = React.useState({
    globalTargetHDP: farmSettings.globalTargetHDP,
    targetFCR: farmSettings.targetFCR,
    mortalityAlertThreshold: farmSettings.mortalityAlertThreshold,
    lowHDPAlertThreshold: farmSettings.lowHDPAlertThreshold,
    stdFeedIntake: farmSettings.stdFeedIntake,
    wasteFreePercentage: farmSettings.wasteFreePercentage,
    workerEggAllowancePerDay: farmSettings.workerEggAllowancePerDay ?? 5,
  });
  const [targetSaved, setTargetSaved] = React.useState(false);

  const handleSaveTargets = () => {
    saveFarmSettings(targetForm);
    setTargetSaved(true);
    setTimeout(() => setTargetSaved(false), 2500);
    Swal.fire({ title: 'Target Disimpan!', text: 'Standar operasional telah diperbarui dan berlaku di seluruh halaman.', icon: 'success', confirmButtonColor: '#0f172a', timer: 2000, showConfirmButton: false });
  };

  const sections = [
    { id: 'HOUSES', label: 'Manajemen Kandang', icon: Home },
    { id: 'FLOCKS', label: 'Manajemen Batch/Flock', icon: Hash },
    { id: 'PROFILE', label: 'Profil Farm (User)', icon: Smartphone },
    { id: 'SECURITY', label: 'Keamanan & Role', icon: ShieldCheck },
    { id: 'MASTER', label: 'Master Data & Standar', icon: Database },
    { id: 'ACCOUNTING', label: 'Rekening & Akuntansi', icon: CreditCard },
    { id: 'SUPPLIER', label: 'Mitra & Supplier', icon: LayoutIcon },
    { id: 'DATA', label: 'Backup & Arsip', icon: RotateCcw },
  ];

  const calculateHouseStatus = (house: PoultryHouse) => {
    if (!house.purchaseDate || !house.purchasePrice) return 'Kondisi Prima (Baru)';
    
    const purchaseDate = new Date(house.purchaseDate);
    const now = new Date();
    const ageMonths = (now.getFullYear() - purchaseDate.getFullYear()) * 12 + (now.getMonth() - purchaseDate.getMonth());
    
    if (ageMonths < 12) return 'Sangat Baik (Siklus Awal)';
    if (ageMonths < 60) return 'Baik (Penyusutan Normal)';
    if (ageMonths < 100) return 'Perlu Perawatan (Menjelang Afkir)';
    return 'Afkir / Perlu Renovasi Total';
  };

  const calculateCurrentAge = (arrivalDate: string, arrivalAgeWeeks: number) => {
    const start = new Date(arrivalDate);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    const totalDays = diffDays + (arrivalAgeWeeks * 7);
    const weeks = Math.floor(totalDays / 7);
    const days = totalDays % 7;
    
    return { weeks, days };
  };

  const handleSaveHouse = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const name = formData.get('name') as string;
    const capacity = Number(formData.get('capacity'));
    const managerId = formData.get('managerId') as string;
    const area = Number(formData.get('area'));
    const purchaseDate = formData.get('purchaseDate') as string;
    const purchasePrice = Number(formData.get('purchasePrice'));

    if (editingHouse) {
      updateHouse(editingHouse.id, { name, capacity, area, managerId, purchaseDate, purchasePrice });
    } else {
      addHouse(name, capacity, area, managerId, purchaseDate, purchasePrice);
    }
    
    Swal.fire({ title: 'Berhasil!', text: 'Data kandang telah disimpan.', icon: 'success', confirmButtonColor: '#0f172a' });
    setIsHouseModalOpen(false);
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const name = formData.get('name') as string;
    const email = formData.get('email') as string;
    const username = formData.get('username') as string;
    const password = formData.get('password') as string;
    const role = formData.get('role') as UserRole;
    const salary = Number(formData.get('salary'));

    if (editingUser) {
      updateUser(editingUser.id, { name, email, username, password, role, salary });
    } else {
      addUser({ name, email, username, password, role, salary, assignedHouses: [] });
    }

    Swal.fire({ title: 'Berhasil!', text: 'Data pengguna telah disimpan.', icon: 'success', confirmButtonColor: '#0f172a' });
    setIsUserModalOpen(false);
  };

  const handleSaveSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const name = formData.get('name') as string;
    const whatsappNumber = formData.get('whatsappNumber') as string;
    const category = formData.get('category') as string;
    const notes = formData.get('notes') as string;

    const suppliers = farmSettings.suppliers || [];
    if (editingSupplier) {
      saveFarmSettings({ suppliers: suppliers.map(s => s.id === editingSupplier.id ? { ...s, name, whatsappNumber, category, notes } : s) });
    } else {
      saveFarmSettings({ suppliers: [...suppliers, { id: `sup-${Date.now()}`, name, whatsappNumber, category, notes }] });
    }
    Swal.fire({ title: 'Berhasil!', text: 'Data supplier telah disimpan.', icon: 'success', confirmButtonColor: '#0f172a' });
    setIsSupplierModalOpen(false);
  };

  const handleSaveAccount = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const code = formData.get('code') as string;
    const name = formData.get('name') as string;
    const category = formData.get('category') as AccountCategory;
    const isCashOrBank = formData.get('isCashOrBank') === 'on';

    if (editingAccount) {
      updateAccount(editingAccount.id, { code, name, category, isCashOrBank });
    } else {
      addAccount({ code, name, category, isCashOrBank });
    }
    Swal.fire({ title: 'Berhasil!', text: 'Data rekening telah disimpan.', icon: 'success', confirmButtonColor: '#0f172a' });
    setIsAccountModalOpen(false);
    setNewAccountCategory(AccountCategory.ASSET);
  };

  const handleSavePrice = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const name = formData.get('name') as string;
    const price = Number(formData.get('price'));

    const masterPrices = farmSettings.masterPrices || [];
    if (editingPrice) {
      saveFarmSettings({ masterPrices: masterPrices.map(p => p.id === editingPrice.id ? { ...p, name, price } : p) });
    } else {
      saveFarmSettings({ masterPrices: [...masterPrices, { id: `cat-${Date.now()}`, name, price }] });
    }
    Swal.fire({ title: 'Berhasil!', text: 'Harga master telah disimpan.', icon: 'success', confirmButtonColor: '#0f172a' });
    setIsPriceModalOpen(false);
  };

  const ALL_SIDEBAR_ITEMS = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'production', label: 'Produksi Harian' },
    { id: 'feedFormulation', label: 'Formulasi Pakan' },
    { id: 'vaccine', label: 'Vaksin & Biosekuriti' },
    { id: 'sales', label: 'Penjualan Telur' },
    { id: 'inventory', label: 'Stok Gudang' },
    { id: 'finance', label: 'Keuangan & Aset' },
    { id: 'workers', label: 'SDM & Payroll' },
    { id: 'settings', label: 'Konfigurasi' },
  ];

  const houseFlocks = flocks.filter(f => f.houseId === selectedHouseId);

  return (
    <div className="space-y-8 pb-20">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight italic uppercase">Farm System configuration</h1>
        <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Kelola infrastruktur, keamanan, dan profil personil farm.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1 border-r border-slate-100 pr-4 space-y-1.5">
            {sections.map((section) => (
                <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={cn(
                        "w-full flex items-center justify-between p-4 rounded-sm transition-all",
                        activeSection === section.id 
                            ? "bg-slate-900 text-white shadow-xl shadow-slate-200" 
                            : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                    )}
                >
                    <div className="flex items-center space-x-3">
                        <section.icon size={18} className={activeSection === section.id ? "text-amber-500" : "text-slate-400"} />
                        <span className="text-[10px] font-bold uppercase tracking-widest">{section.label}</span>
                    </div>
                </button>
            ))}
        </div>

        <div className="lg:col-span-3">
            <AnimatePresence mode="wait">
                {activeSection === 'HOUSES' && (
                    <motion.div
                        initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
                        key="houses" className="space-y-8"
                    >
                        <div className="bg-white p-8 border border-slate-200 shadow-sm relative">
                            <div className="flex items-center justify-between mb-8">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900 uppercase tracking-tight italic">House Management</h3>
                                    <p className="text-xs text-slate-500 mt-1 uppercase font-bold italic tracking-tighter opacity-70">Konfigurasi infrastruktur kandang dan status penyusutan.</p>
                                </div>
                                <button 
                                    onClick={() => { setEditingHouse(null); setIsHouseModalOpen(true); }}
                                    className="bg-slate-900 text-white p-3 rounded-full hover:bg-slate-800 transition-all shadow-lg"
                                >
                                    <Plus size={20} />
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {houses.map((house) => {
                                  const manager = users.find(u => u.id === house.managerId);
                                  const status = calculateHouseStatus(house);
                                  return (
                                    <div 
                                      key={house.id} 
                                      onClick={() => { setEditingHouse(house); setIsHouseModalOpen(true); }}
                                      className="p-6 bg-slate-50 border border-slate-100 hover:border-amber-500 transition-all group cursor-pointer relative"
                                    >
                                        <div className="flex items-center space-x-4">
                                            <div className="w-12 h-12 bg-white border border-slate-200 rounded-sm flex items-center justify-center text-slate-400 group-hover:bg-slate-900 group-hover:text-amber-500 transition-all">
                                                <Home size={24} />
                                            </div>
                                            <div>
                                                <p className="text-[12px] font-black uppercase text-slate-900 tracking-tighter italic">{house.name}</p>
                                                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">PJ: {manager?.name || 'Belum diatur'} | {house.area || 0} m²</p>
                                            </div>
                                        </div>
                                        <div className="mt-4 pt-4 border-t border-slate-200 flex justify-between items-end">
                                          <div>
                                            <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest mb-1">Status Kondisi</p>
                                            <p className={cn("text-[9px] font-black uppercase italic", status.includes('Afkir') ? 'text-rose-600' : status.includes('Perlu') ? 'text-amber-600' : 'text-emerald-600')}>
                                              {status}
                                            </p>
                                          </div>
                                          <div className="flex space-x-2">
                                            <div className="p-1.5 bg-white border border-slate-200 text-slate-400 group-hover:text-slate-900"><Edit2 size={12} /></div>
                                            <div onClick={(e) => { e.stopPropagation(); deleteHouse(house.id); }} className="p-1.5 bg-white border border-slate-200 text-slate-400 hover:text-rose-600"><Trash2 size={12} /></div>
                                          </div>
                                        </div>
                                    </div>
                                  );
                                })}
                            </div>
                        </div>

                        <Modal isOpen={isHouseModalOpen} onClose={() => setIsHouseModalOpen(false)} title={editingHouse ? `Edit: ${editingHouse.name}` : "Tambah Kandang Baru"}>
                            <form onSubmit={handleSaveHouse} className="space-y-6">
                              <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Nama Kandang</label>
                                  <input name="name" required defaultValue={editingHouse?.name} className="w-full bg-slate-50 border border-slate-200 rounded-sm px-4 py-3 text-sm font-bold focus:outline-none focus:border-amber-500" />
                                </div>
                                <div className="col-span-1">
                                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Kapasitas (Ekor)</label>
                                  <input name="capacity" type="number" defaultValue={editingHouse?.capacity || 5000} className="w-full bg-slate-50 border border-slate-200 rounded-sm px-4 py-3 text-sm font-bold focus:outline-none focus:border-amber-500" />
                                </div>
                                <div className="col-span-1">
                                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Luas Kandang (m²)</label>
                                  <input name="area" type="number" defaultValue={editingHouse?.area || 0} className="w-full bg-slate-50 border border-slate-200 rounded-sm px-4 py-3 text-sm font-bold focus:outline-none focus:border-amber-500" />
                                </div>
                                <div className="col-span-1">
                                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Penanggungjawab</label>
                                  <select name="managerId" defaultValue={editingHouse?.managerId} className="w-full bg-slate-50 border border-slate-200 rounded-sm px-4 py-3 text-sm font-bold focus:outline-none focus:border-amber-500">
                                    <option value="">Pilih Personel</option>
                                    {users.filter(u => u.role !== UserRole.SUPER_ADMIN).map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
                                  </select>
                                </div>
                                <div className="col-span-1">
                                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Tanggal Pembelian/Bangun</label>
                                  <input name="purchaseDate" type="date" defaultValue={editingHouse?.purchaseDate} className="w-full bg-slate-50 border border-slate-200 rounded-sm px-4 py-3 text-sm font-bold focus:outline-none focus:border-amber-500" />
                                </div>
                                <div className="col-span-1">
                                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Nilai Aset (IDR)</label>
                                  <input name="purchasePrice" type="number" defaultValue={editingHouse?.purchasePrice || 0} className="w-full bg-slate-50 border border-slate-200 rounded-sm px-4 py-3 text-sm font-bold focus:outline-none focus:border-amber-500" />
                                </div>
                              </div>
                              <button type="submit" className="w-full bg-slate-900 text-white py-4 rounded-sm font-bold text-[10px] uppercase tracking-[0.2em] hover:bg-slate-800 transition-all shadow-xl flex items-center justify-center gap-2">
                                <Save size={14} /> Simpan Data Kandang
                              </button>
                            </form>
                        </Modal>
                    </motion.div>
                )}

                {activeSection === 'PROFILE' && (
                    <motion.div
                        initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
                        key="profile" className="space-y-8"
                    >
                        <div className="bg-white p-8 border border-slate-200 shadow-sm">
                            <div className="flex items-center justify-between mb-8">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900 uppercase tracking-tight italic">User Profile Management</h3>
                                    <p className="text-xs text-slate-500 mt-1 uppercase font-bold italic tracking-tighter opacity-70">Kelola kredensial dan hak akses personil farm.</p>
                                </div>
                                <button 
                                    onClick={() => { setEditingUser(null); setIsUserModalOpen(true); }}
                                    className="bg-slate-900 text-white p-3 rounded-full hover:bg-slate-800 transition-all shadow-lg"
                                >
                                    <Plus size={20} />
                                </button>
                            </div>

                            <div className="divide-y divide-slate-100 border border-slate-100">
                              {users.map(u => (
                                <div key={u.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-all group">
                                  <div className="flex items-center space-x-4">
                                    <div className="w-10 h-10 bg-slate-100 rounded-sm flex items-center justify-center text-slate-400 group-hover:bg-slate-900 group-hover:text-white transition-all">
                                      <UserIcon size={18} />
                                    </div>
                                    <div>
                                      <p className="text-[11px] font-black uppercase text-slate-900 italic">{u.name}</p>
                                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{u.role} · @{u.username}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <button onClick={() => { setEditingUser(u); setIsUserModalOpen(true); }} className="p-2 text-slate-400 hover:text-slate-900"><Edit2 size={16} /></button>
                                    {u.role !== UserRole.SUPER_ADMIN && (
                                      <button onClick={() => deleteUser(u.id)} className="p-2 text-slate-400 hover:text-rose-600"><Trash2 size={16} /></button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                        </div>

                        <Modal isOpen={isUserModalOpen} onClose={() => setIsUserModalOpen(false)} title={editingUser ? `Edit User: ${editingUser.name}` : "Tambah User Baru"}>
                            <form onSubmit={handleSaveUser} className="space-y-6">
                              <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Nama Lengkap</label>
                                  <input name="name" required defaultValue={editingUser?.name} className="w-full bg-slate-50 border border-slate-200 rounded-sm px-4 py-3 text-sm font-bold focus:outline-none focus:border-amber-500" />
                                </div>
                                <div className="col-span-1">
                                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Username</label>
                                  <input name="username" required defaultValue={editingUser?.username} className="w-full bg-slate-50 border border-slate-200 rounded-sm px-4 py-3 text-sm font-bold focus:outline-none focus:border-amber-500" />
                                </div>
                                <div className="col-span-1">
                                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Password</label>
                                  <input name="password" required type="text" defaultValue={editingUser?.password} className="w-full bg-slate-50 border border-slate-200 rounded-sm px-4 py-3 text-sm font-bold focus:outline-none focus:border-amber-500" />
                                </div>
                                <div className="col-span-2">
                                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Email Address</label>
                                  <input name="email" required type="email" defaultValue={editingUser?.email} className="w-full bg-slate-50 border border-slate-200 rounded-sm px-4 py-3 text-sm font-bold focus:outline-none focus:border-amber-500" />
                                </div>
                                <div className="col-span-1">
                                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Role</label>
                                  <select name="role" defaultValue={editingUser?.role} className="w-full bg-slate-50 border border-slate-200 rounded-sm px-4 py-3 text-sm font-bold focus:outline-none focus:border-amber-500">
                                    <option value={UserRole.ADMIN}>ADMIN</option>
                                    <option value={UserRole.WORKER}>WORKER</option>
                                    <option value={UserRole.SUPER_ADMIN}>SUPER_ADMIN (OWNER)</option>
                                  </select>
                                </div>
                                <div className="col-span-1">
                                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Gaji Pokok (IDR)</label>
                                  <input name="salary" type="number" defaultValue={editingUser?.salary || 0} className="w-full bg-slate-50 border border-slate-200 rounded-sm px-4 py-3 text-sm font-bold focus:outline-none focus:border-amber-500" />
                                </div>
                              </div>
                              <button type="submit" className="w-full bg-slate-900 text-white py-4 rounded-sm font-bold text-[10px] uppercase tracking-[0.2em] hover:bg-slate-800 transition-all shadow-xl">
                                Simpan Profil User
                              </button>
                            </form>
                        </Modal>
                    </motion.div>
                )}

                {activeSection === 'SECURITY' && (
                    <motion.div
                        initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
                        key="security" className="space-y-8"
                    >
                        <div className="bg-white p-8 border border-slate-200 shadow-sm">
                            <h3 className="text-lg font-bold text-slate-900 uppercase tracking-tight italic mb-8">RBAC Sidebar permissions</h3>
                            
                            <div className="flex gap-4 mb-8">
                              {[UserRole.ADMIN, UserRole.WORKER].map(role => (
                                <button 
                                  key={role}
                                  onClick={() => setSelectedRoleForSecurity(role)}
                                  className={cn(
                                    "px-6 py-3 text-[10px] font-bold uppercase tracking-[0.2em] border transition-all",
                                    selectedRoleForSecurity === role ? "bg-slate-900 text-white border-slate-900 shadow-md" : "bg-white text-slate-400 border-slate-200 hover:border-slate-400"
                                  )}
                                >
                                  {role.replace('_', ' ')} Access
                                </button>
                              ))}
                            </div>

                            <div className="bg-slate-50 border border-slate-100 p-6">
                              <p className="text-[10px] font-black uppercase text-slate-900 mb-6 italic flex items-center gap-2">
                                <LayoutIcon size={14} /> Sidebar Navigation Access for {selectedRoleForSecurity}
                              </p>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {ALL_SIDEBAR_ITEMS.map(item => {
                                  const isChecked = sidebarPermissions[selectedRoleForSecurity]?.includes(item.id);
                                  return (
                                    <label 
                                      key={item.id}
                                      className={cn(
                                        "flex items-center space-x-3 p-3 border transition-all cursor-pointer",
                                        isChecked ? "bg-white border-amber-500 ring-1 ring-amber-500/10 shadow-sm" : "bg-slate-100/50 border-slate-200 grayscale opacity-60"
                                      )}
                                    >
                                      <div className={cn(
                                        "w-5 h-5 rounded-sm border flex items-center justify-center transition-all",
                                        isChecked ? "bg-amber-500 border-amber-600" : "bg-white border-slate-300"
                                      )}>
                                        {isChecked && <CheckCircle2 size={12} className="text-white" />}
                                        <input 
                                          type="checkbox" 
                                          className="hidden" 
                                          checked={isChecked}
                                          onChange={() => {
                                            const current = sidebarPermissions[selectedRoleForSecurity] || [];
                                            const next = isChecked ? current.filter(id => id !== item.id) : [...current, item.id];
                                            updatePermissions(selectedRoleForSecurity, next);
                                          }}
                                        />
                                      </div>
                                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-700">{item.label}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                        </div>
                    </motion.div>
                )}

                {activeSection === 'DATA' && (
                    <motion.div 
                        initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
                        key="data" className="space-y-8"
                    >
                        <div className="bg-white p-8 border border-slate-200 shadow-sm space-y-8 relative overflow-hidden">
                            <div className="flex items-center space-x-6">
                                <div className="p-4 bg-slate-50 border border-slate-100 text-slate-500">
                                    <RotateCcw size={32} strokeWidth={1.5} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900 uppercase tracking-tight italic">Registry Integrity & Backup</h3>
                                    <p className="text-xs text-slate-500 mt-1 uppercase font-bold italic tracking-tighter opacity-70">Archive snapshot of production cycle (24 Months Cycle).</p>
                                </div>
                            </div>
                            
                            <div className="p-6 bg-slate-50 border border-slate-100 flex items-center justify-between shadow-inner">
                                <div className="flex items-center space-x-4">
                                    <Database size={20} className="text-amber-600" />
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-900 uppercase tracking-widest">Main Archive Node</p>
                                        <p className="text-[9px] text-slate-400 font-black italic uppercase tracking-tighter">Last Snapshot: 1 hour ago</p>
                                    </div>
                                </div>
                                <button className="bg-slate-900 text-white px-6 py-3 rounded-sm text-[10px] font-bold uppercase tracking-widest hover:bg-slate-800 shadow-md border border-slate-800 transition-colors">Export SQL/CSV</button>
                            </div>
                        </div>
                    </motion.div>
                )}

                {activeSection === 'FLOCKS' && (
                    <motion.div
                        initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
                        key="flocks" className="space-y-8"
                    >
                        <div className="bg-white p-8 border border-slate-200 shadow-sm relative">
                            <div className="flex items-center justify-between mb-8">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900 uppercase tracking-tight italic">Flock & Cycle Control</h3>
                                    <p className="text-xs text-slate-500 mt-1 uppercase font-bold italic tracking-tighter opacity-70">Kelola batch ayam, umur, dan populasi aktif.</p>
                                </div>
                                <button 
                                    onClick={() => { setEditingFlock(null); setIsFlockModalOpen(true); }}
                                    className="bg-slate-900 text-white p-3 rounded-full hover:bg-slate-800 transition-all shadow-lg"
                                >
                                    <Plus size={20} />
                                </button>
                            </div>

                            <div className="space-y-4">
                                {houseFlocks.length === 0 && (
                                    <div className="text-center py-12 bg-slate-50 border border-dashed border-slate-200">
                                        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Belum ada batch di kandang ini</p>
                                    </div>
                                )}
                                {houseFlocks.map((flock) => {
                                    const age = calculateCurrentAge(flock.arrivalDate, flock.arrivalAgeWeeks);
                                    return (
                                        <div key={flock.id} className={cn(
                                            "p-6 border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 group",
                                            flock.isActive ? "bg-white border-amber-500 shadow-md ring-1 ring-amber-500/10" : "bg-slate-50 border-slate-100 opacity-70"
                                        )}>
                                            <div className="flex items-center space-x-4">
                                                <div className={cn(
                                                    "w-12 h-12 rounded-sm flex flex-col items-center justify-center font-black italic",
                                                    flock.isActive ? "bg-amber-500 text-slate-900" : "bg-slate-200 text-slate-400"
                                                )}>
                                                    <span className="text-sm leading-none">{age.weeks}</span>
                                                    <span className="text-[7px] uppercase tracking-tighter">Minggu</span>
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-[11px] font-black uppercase text-slate-900 tracking-tighter">{flock.strain}</p>
                                                        {flock.isActive && <span className="text-[7px] bg-emerald-500 text-white px-1.5 py-0.5 rounded-full font-black uppercase tracking-widest">Aktif</span>}
                                                    </div>
                                                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                                                        Datang: {new Date(flock.arrivalDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })} | Populasi: {flock.currentCount} Ekor
                                                    </p>
                                                </div>
                                            </div>
                                            
                                            <div className="flex items-center gap-2">
                                                <div className="text-right mr-4 hidden md:block">
                                                    <p className="text-[10px] font-black text-slate-900 uppercase tracking-tighter italic">{age.weeks} Minggu {age.days} Hari</p>
                                                    <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">Umur Saat Ini</p>
                                                </div>
                                                <button onClick={() => { setEditingFlock(flock); setIsFlockModalOpen(true); }} className="p-2 text-slate-400 hover:text-slate-900 transition-colors"><Edit2 size={16} /></button>
                                                <button onClick={() => {
                                                    Swal.fire({
                                                        title: 'Hapus Batch?',
                                                        text: 'Seluruh data batch ini akan dihapus permanen.',
                                                        icon: 'warning',
                                                        showCancelButton: true,
                                                        confirmButtonColor: '#e11d48',
                                                        confirmButtonText: 'Ya, Hapus',
                                                        cancelButtonText: 'Batal'
                                                    }).then(result => { if (result.isConfirmed) deleteFlock(flock.id); });
                                                }} className="p-2 text-slate-400 hover:text-rose-600 transition-colors"><Trash2 size={16} /></button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <Modal isOpen={isFlockModalOpen} onClose={() => setIsFlockModalOpen(false)} title={editingFlock ? "Edit Batch/Flock" : "Tambah Batch Baru"}>
                            <FlockForm 
                                houseId={selectedHouseId}
                                flock={editingFlock}
                                onSave={(data) => {
                                    if (editingFlock) {
                                        updateFlock(editingFlock.id, data);
                                    } else {
                                        addFlock(data);
                                    }
                                    setIsFlockModalOpen(false);
                                }}
                            />
                        </Modal>
                    </motion.div>
                )}
                {activeSection === 'MASTER' && (
                    <motion.div
                        initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
                        key="master" className="space-y-8"
                    >
                        <div className="bg-white p-8 border border-slate-200 shadow-sm">
                            <h3 className="text-lg font-bold text-slate-900 uppercase tracking-tight italic mb-8">Master Data & Standar Operasional</h3>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                                {/* Production Targets */}
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-600 flex items-center gap-2">
                                            <Shield size={14} /> Target & Batas Toleransi
                                        </h4>
                                        <button
                                            onClick={handleSaveTargets}
                                            className={cn(
                                                "flex items-center gap-2 px-4 py-2 text-[9px] font-black uppercase tracking-[0.15em] transition-all shadow-sm border",
                                                targetSaved
                                                    ? "bg-emerald-500 text-white border-emerald-600"
                                                    : "bg-slate-900 text-white border-slate-800 hover:bg-slate-700"
                                            )}
                                        >
                                            <Save size={11} />
                                            {targetSaved ? 'Tersimpan ✓' : 'Simpan'}
                                        </button>
                                    </div>
                                    <p className="text-[9px] text-slate-400 font-medium italic leading-relaxed -mt-4">
                                        Nilai di bawah berlaku secara global di Dashboard, Produksi, dan Laporan.
                                    </p>
                                    <div className="space-y-5">
                                        <div className="bg-slate-50 border border-slate-100 p-4 space-y-1">
                                            <div className="flex items-center justify-between">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-700">Target HDP Global (%)</label>
                                                <span className="text-[9px] text-amber-600 font-black">{targetForm.globalTargetHDP}%</span>
                                            </div>
                                            <p className="text-[9px] text-slate-400 mb-2">Persentase Hen-Day Production minimum yang diharapkan. Biasanya 80–95%.</p>
                                            <input 
                                                type="range"
                                                min={50} max={100} step={1}
                                                value={targetForm.globalTargetHDP}
                                                onChange={(e) => setTargetForm(prev => ({ ...prev, globalTargetHDP: Number(e.target.value) }))}
                                                className="w-full accent-amber-500"
                                            />
                                            <div className="flex justify-between text-[8px] text-slate-400 font-bold">
                                                <span>50%</span><span>75%</span><span>100%</span>
                                            </div>
                                        </div>
                                        <div className="bg-slate-50 border border-slate-100 p-4 space-y-1">
                                            <div className="flex items-center justify-between">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-700">Alert HDP Turun (%)</label>
                                                <span className="text-[9px] text-rose-500 font-black">−{targetForm.lowHDPAlertThreshold}%</span>
                                            </div>
                                            <p className="text-[9px] text-slate-400 mb-2">Sistem memperingatkan jika HDP turun lebih dari nilai ini di bawah kurva standar strain.</p>
                                            <input
                                                type="range"
                                                min={1} max={20} step={1}
                                                value={targetForm.lowHDPAlertThreshold}
                                                onChange={(e) => setTargetForm(prev => ({ ...prev, lowHDPAlertThreshold: Number(e.target.value) }))}
                                                className="w-full accent-rose-500"
                                            />
                                            <div className="flex justify-between text-[8px] text-slate-400 font-bold">
                                                <span>1%</span><span>10%</span><span>20%</span>
                                            </div>
                                        </div>
                                        <div className="bg-slate-50 border border-slate-100 p-4 space-y-1">
                                            <div className="flex items-center justify-between">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-700">Target FCR</label>
                                                <span className="text-[9px] text-blue-600 font-black">{targetForm.targetFCR.toFixed(2)}</span>
                                            </div>
                                            <p className="text-[9px] text-slate-400 mb-2">Feed Conversion Ratio ideal. Layer petelur biasanya 1.9–2.3. Makin rendah makin efisien.</p>
                                            <input
                                                type="number" step="0.01" min={1} max={5}
                                                value={targetForm.targetFCR}
                                                onChange={(e) => setTargetForm(prev => ({ ...prev, targetFCR: Number(e.target.value) }))}
                                                className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-sm font-bold focus:border-amber-500 outline-none"
                                            />
                                        </div>
                                        <div className="bg-slate-50 border border-slate-100 p-4 space-y-1">
                                            <div className="flex items-center justify-between">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-700">Batas Mortalitas / Bulan (%)</label>
                                                <span className="text-[9px] text-rose-500 font-black">{targetForm.mortalityAlertThreshold}%</span>
                                            </div>
                                            <p className="text-[9px] text-slate-400 mb-2">Alert mortalitas jika melebihi batas ini per bulan. Standar aman: 0.5% – 1%/bulan.</p>
                                            <input
                                                type="range"
                                                min={0.1} max={5} step={0.1}
                                                value={targetForm.mortalityAlertThreshold}
                                                onChange={(e) => setTargetForm(prev => ({ ...prev, mortalityAlertThreshold: Number(e.target.value) }))}
                                                className="w-full accent-rose-500"
                                            />
                                            <div className="flex justify-between text-[8px] text-slate-400 font-bold">
                                                <span>0.1%</span><span>2.5%</span><span>5%</span>
                                            </div>
                                        </div>
                                        <div className="bg-slate-50 border border-slate-100 p-4 space-y-1">
                                            <div className="flex items-center justify-between">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-700">Std. Intake Pakan (g/ekor/hari)</label>
                                                <span className="text-[9px] text-emerald-600 font-black">{targetForm.stdFeedIntake}g</span>
                                            </div>
                                            <p className="text-[9px] text-slate-400 mb-2">Konsumsi pakan standar per ekor. Layer biasanya 100–130 g/ekor/hari.</p>
                                            <input
                                                type="number" min={80} max={200}
                                                value={targetForm.stdFeedIntake}
                                                onChange={(e) => setTargetForm(prev => ({ ...prev, stdFeedIntake: Number(e.target.value) }))}
                                                className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-sm font-bold focus:border-amber-500 outline-none"
                                            />
                                        </div>
                                        <div className="bg-slate-50 border border-slate-100 p-4 space-y-1">
                                            <div className="flex items-center justify-between">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-700">Batas Waste & Free Goods (%)</label>
                                                <span className="text-[9px] text-amber-600 font-black">{targetForm.wasteFreePercentage}%</span>
                                            </div>
                                            <p className="text-[9px] text-slate-400 mb-2">Persentase maksimum produksi yang boleh dijadikan barang rusak atau diberikan gratis.</p>
                                            <input
                                                type="range"
                                                min={0} max={10} step={0.5}
                                                value={targetForm.wasteFreePercentage}
                                                onChange={(e) => setTargetForm(prev => ({ ...prev, wasteFreePercentage: Number(e.target.value) }))}
                                                className="w-full accent-amber-500"
                                            />
                                            <div className="flex justify-between text-[8px] text-slate-400 font-bold">
                                                <span>0%</span><span>5%</span><span>10%</span>
                                            </div>
                                        </div>
                                        <div className="bg-slate-50 border border-slate-100 p-4 space-y-1">
                                            <div className="flex items-center justify-between">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-700">Ambang Batas Telur Karyawan (butir/hari)</label>
                                                <span className="text-[9px] text-emerald-600 font-black">{targetForm.workerEggAllowancePerDay} butir</span>
                                            </div>
                                            <p className="text-[9px] text-slate-400 mb-2">Jumlah telur yang otomatis dikurangi dari stok gudang per hari sebagai jatah karyawan. Sistem akan memotong dari stok yang ada secara otomatis. Default: 5 butir/hari.</p>
                                            <input
                                                type="range"
                                                min={0} max={20} step={1}
                                                value={targetForm.workerEggAllowancePerDay}
                                                onChange={(e) => setTargetForm(prev => ({ ...prev, workerEggAllowancePerDay: Number(e.target.value) }))}
                                                className="w-full accent-emerald-500"
                                            />
                                            <div className="flex justify-between text-[8px] text-slate-400 font-bold">
                                                <span>0 butir</span><span>10 butir</span><span>20 butir</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* List Management */}
                                <div className="space-y-8">
                                    {/* Strains */}
                                    <div className="space-y-4">
                                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-900 flex items-center justify-between">
                                            <span>Daftar Strain Ayam</span>
                                            <button 
                                                onClick={() => {
                                                    Swal.fire({
                                                        title: 'Tambah Strain',
                                                        input: 'text',
                                                        inputPlaceholder: 'Masukkan nama strain...',
                                                        showCancelButton: true,
                                                        confirmButtonColor: '#0f172a',
                                                    }).then(result => {
                                                        if (result.isConfirmed && result.value) {
                                                            saveFarmSettings({ strains: [...farmSettings.strains, result.value] });
                                                        }
                                                    });
                                                }}
                                                className="p-1 hover:text-amber-500 transition-colors"
                                            ><Plus size={14} /></button>
                                        </h4>
                                        <div className="flex flex-wrap gap-2">
                                            {farmSettings.strains.map(s => (
                                                <div key={s} className="flex items-center gap-2 bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-sm group">
                                                    <span className="text-[10px] font-bold text-slate-600">{s}</span>
                                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                                        <button 
                                                            onClick={() => {
                                                                Swal.fire({
                                                                    title: 'Edit Strain',
                                                                    input: 'text',
                                                                    inputValue: s,
                                                                    showCancelButton: true,
                                                                    confirmButtonColor: '#0f172a',
                                                                }).then(result => {
                                                                    if (result.isConfirmed && result.value) {
                                                                        saveFarmSettings({ strains: farmSettings.strains.map(i => i === s ? result.value : i) });
                                                                    }
                                                                });
                                                            }}
                                                            className="text-slate-300 hover:text-amber-500"
                                                        ><Edit2 size={10} /></button>
                                                        <button 
                                                            onClick={() => saveFarmSettings({ strains: farmSettings.strains.filter(i => i !== s) })}
                                                            className="text-slate-300 hover:text-rose-500"
                                                        ><Trash2 size={10} /></button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Units */}
                                    <div className="space-y-4">
                                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-900 flex items-center justify-between">
                                            <span>Daftar Satuan (Units)</span>
                                            <button 
                                                onClick={() => {
                                                    Swal.fire({
                                                        title: 'Tambah Satuan',
                                                        input: 'text',
                                                        inputPlaceholder: 'kg, liter, ml, dll...',
                                                        showCancelButton: true,
                                                        confirmButtonColor: '#0f172a',
                                                    }).then(result => {
                                                        if (result.isConfirmed && result.value) {
                                                            saveFarmSettings({ units: [...farmSettings.units, result.value] });
                                                        }
                                                    });
                                                }}
                                                className="p-1 hover:text-amber-500 transition-colors"
                                            ><Plus size={14} /></button>
                                        </h4>
                                        <div className="flex flex-wrap gap-2">
                                            {farmSettings.units.map(u => (
                                                <div key={u} className="flex items-center gap-2 bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-sm group">
                                                    <span className="text-[10px] font-bold text-slate-600">{u}</span>
                                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                                        <button 
                                                            onClick={() => {
                                                                Swal.fire({
                                                                    title: 'Edit Satuan',
                                                                    input: 'text',
                                                                    inputValue: u,
                                                                    showCancelButton: true,
                                                                    confirmButtonColor: '#0f172a',
                                                                }).then(result => {
                                                                    if (result.isConfirmed && result.value) {
                                                                        saveFarmSettings({ units: farmSettings.units.map(i => i === u ? result.value : i) });
                                                                    }
                                                                });
                                                            }}
                                                            className="text-slate-300 hover:text-amber-500"
                                                        ><Edit2 size={10} /></button>
                                                        <button 
                                                            onClick={() => saveFarmSettings({ units: farmSettings.units.filter(i => i !== u) })}
                                                            className="text-slate-300 hover:text-rose-500"
                                                        ><Trash2 size={10} /></button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="mt-12 space-y-4 border-t border-slate-100 pt-8">
                                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-900 flex items-center justify-between">
                                    <span>Master Harga Produk</span>
                                    <button 
                                        onClick={() => { setEditingPrice(null); setIsPriceModalOpen(true); }}
                                        className="p-1 hover:text-amber-500 transition-colors"
                                    ><Plus size={14} /></button>
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {(farmSettings.masterPrices || []).map(p => (
                                        <div key={p.id} className="bg-slate-50 border border-slate-100 p-4 flex items-center justify-between group">
                                            <div>
                                                <p className="text-xs font-bold text-slate-900 uppercase">{p.name}</p>
                                                <p className="text-[10px] text-amber-500 font-bold italic mt-1">{formatCurrency(p.price)}</p>
                                            </div>
                                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                                <button onClick={() => { setEditingPrice(p); setIsPriceModalOpen(true); }} className="text-slate-400 hover:text-amber-500"><Edit2 size={12} /></button>
                                                <button onClick={() => saveFarmSettings({ masterPrices: farmSettings.masterPrices.filter(x => x.id !== p.id) })} className="text-slate-400 hover:text-rose-500"><Trash2 size={12} /></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            
                            {/* NEW: Master Penyusutan */}
                            <div className="mt-12 space-y-4 border-t border-slate-100 pt-8">
                                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-900 flex items-center justify-between">
                                    <span>Master Penyusutan (Depresiasi)</span>
                                    <button 
                                        onClick={() => {
                                            Swal.fire({
                                                title: 'Simpan Master Penyusutan?',
                                                text: 'Perubahan ini akan mempengaruhi laporan aset dan nilai buku.',
                                                icon: 'warning',
                                                showCancelButton: true,
                                                confirmButtonColor: '#0f172a'
                                            }).then((res) => {
                                                if (res.isConfirmed) {
                                                    Swal.fire({ title: 'Berhasil!', text: 'Master penyusutan tersimpan.', icon: 'success', confirmButtonColor: '#0f172a' });
                                                }
                                            });
                                        }}
                                        className="text-[9px] px-3 py-1 bg-amber-50 text-amber-600 font-bold uppercase hover:bg-amber-100 transition-colors"
                                    >Simpan Perubahan</button>
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="bg-slate-50 p-4 border border-slate-100 space-y-4">
                                        <h5 className="font-bold text-xs uppercase tracking-tight">Kandang & Bangunan</h5>
                                        <div>
                                            <label className="text-[9px] font-bold uppercase tracking-widest text-slate-400 block mb-1">Nilai Beli/Awal (Rp)</label>
                                            <input type="number" defaultValue={farmSettings.cageValueTotal} onChange={(e) => saveFarmSettings({ cageValueTotal: Number(e.target.value) })} className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-xs font-bold focus:border-amber-500 outline-none" />
                                        </div>
                                        <div>
                                            <label className="text-[9px] font-bold uppercase tracking-widest text-slate-400 block mb-1">Nilai Sisa/Afkir (Rp)</label>
                                            <input type="number" defaultValue={farmSettings.cageSalvageValue || 0} onChange={(e) => saveFarmSettings({ cageSalvageValue: Number(e.target.value) })} className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-xs font-bold focus:border-amber-500 outline-none" />
                                        </div>
                                        <div>
                                            <label className="text-[9px] font-bold uppercase tracking-widest text-slate-400 block mb-1">Umur Ekonomis (Thn)</label>
                                            <input type="number" defaultValue={farmSettings.cageLifeYears} onChange={(e) => saveFarmSettings({ cageLifeYears: Number(e.target.value) })} className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-xs font-bold focus:border-amber-500 outline-none" />
                                        </div>
                                    </div>
                                    <div className="bg-slate-50 p-4 border border-slate-100 space-y-4">
                                        <h5 className="font-bold text-xs uppercase tracking-tight">Peralatan</h5>
                                        <div>
                                            <label className="text-[9px] font-bold uppercase tracking-widest text-slate-400 block mb-1">Nilai Beli/Awal (Rp)</label>
                                            <input type="number" defaultValue={farmSettings.equipmentValueTotal} onChange={(e) => saveFarmSettings({ equipmentValueTotal: Number(e.target.value) })} className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-xs font-bold focus:border-amber-500 outline-none" />
                                        </div>
                                        <div>
                                            <label className="text-[9px] font-bold uppercase tracking-widest text-slate-400 block mb-1">Nilai Sisa/Afkir (Rp)</label>
                                            <input type="number" defaultValue={farmSettings.equipmentSalvageValue || 0} onChange={(e) => saveFarmSettings({ equipmentSalvageValue: Number(e.target.value) })} className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-xs font-bold focus:border-amber-500 outline-none" />
                                        </div>
                                        <div>
                                            <label className="text-[9px] font-bold uppercase tracking-widest text-slate-400 block mb-1">Umur Ekonomis (Thn)</label>
                                            <input type="number" defaultValue={farmSettings.equipmentLifeYears} onChange={(e) => saveFarmSettings({ equipmentLifeYears: Number(e.target.value) })} className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-xs font-bold focus:border-amber-500 outline-none" />
                                        </div>
                                    </div>
                                    <div className="bg-slate-50 p-4 border border-slate-100 space-y-4">
                                        <h5 className="font-bold text-xs uppercase tracking-tight">Ayam Pullet (Flock)</h5>
                                        <div>
                                            <label className="text-[9px] font-bold uppercase tracking-widest text-slate-400 block mb-1">Nilai Beli/Awal (Rp)</label>
                                            <input type="number" defaultValue={farmSettings.layerValueTotal || 100000000} onChange={(e) => saveFarmSettings({ layerValueTotal: Number(e.target.value) })} className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-xs font-bold focus:border-amber-500 outline-none" />
                                        </div>
                                        <div>
                                            <label className="text-[9px] font-bold uppercase tracking-widest text-slate-400 block mb-1">Nilai Sisa/Afkir (Rp)</label>
                                            <input type="number" defaultValue={farmSettings.layerSalvageValue || 0} onChange={(e) => saveFarmSettings({ layerSalvageValue: Number(e.target.value) })} className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-xs font-bold focus:border-amber-500 outline-none" />
                                        </div>
                                        <div>
                                            <label className="text-[9px] font-bold uppercase tracking-widest text-slate-400 block mb-1">Umur Ekonomis (Thn)</label>
                                            <input type="number" defaultValue={farmSettings.layerLifeYears || 2} onChange={(e) => saveFarmSettings({ layerLifeYears: Number(e.target.value) })} className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-xs font-bold focus:border-amber-500 outline-none" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <Modal isOpen={isPriceModalOpen} onClose={() => setIsPriceModalOpen(false)} title={editingPrice ? "Edit Kategori & Harga" : "Tambah Kategori Harga"}>
                            <form onSubmit={handleSavePrice} className="space-y-6">
                                <div>
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Nama Kategori</label>
                                    <input name="name" required defaultValue={editingPrice?.name} className="w-full bg-slate-50 border border-slate-200 rounded-sm px-4 py-3 text-sm font-bold focus:outline-none focus:border-amber-500" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Harga / Unit (Rp)</label>
                                    <input name="price" type="number" required defaultValue={editingPrice?.price} className="w-full bg-slate-50 border border-slate-200 rounded-sm px-4 py-3 text-sm font-bold focus:outline-none focus:border-amber-500" />
                                </div>
                                <button type="submit" className="w-full bg-slate-900 text-white py-4 rounded-sm font-bold text-[10px] uppercase tracking-[0.2em] shadow-xl">
                                    Simpan Harga
                                </button>
                            </form>
                        </Modal>
                    </motion.div>
                )}

                {activeSection === 'ACCOUNTING' && (
                    <motion.div
                        initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
                        key="accounting" className="space-y-8"
                    >
                        <div className="bg-white p-8 border border-slate-200 shadow-sm relative">
                            <div className="flex items-center justify-between mb-8">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900 uppercase tracking-tight italic">Manajemen Rekening & Akun</h3>
                                    <p className="text-xs text-slate-500 mt-1 uppercase font-bold italic tracking-tighter opacity-70">Kelola daftar rekening bank, kas, dan akun lainnya.</p>
                                </div>
                                <button 
                                    onClick={() => { setEditingAccount(null); setNewAccountCategory(AccountCategory.ASSET); setIsAccountModalOpen(true); }}
                                    className="bg-slate-900 text-white p-3 rounded-full hover:bg-slate-800 transition-all shadow-lg"
                                >
                                    <Plus size={20} />
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {accounts.map((acc) => (
                                    <div key={acc.id} className="p-6 bg-slate-50 border border-slate-100 hover:border-amber-500 transition-all group relative">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center space-x-3">
                                                <div className="w-10 h-10 bg-white border border-slate-200 rounded-sm flex items-center justify-center text-slate-400 group-hover:bg-slate-900 group-hover:text-amber-500 transition-all">
                                                    <CreditCard size={18} />
                                                </div>
                                                <div>
                                                    <p className="text-[12px] font-black uppercase text-slate-900 tracking-tighter italic">{acc.name}</p>
                                                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Kode: {acc.code} · {acc.category}</p>
                                                </div>
                                            </div>
                                            <div className="flex space-x-2">
                                                <button onClick={() => { setEditingAccount(acc); setIsAccountModalOpen(true); }} className="p-1.5 bg-white border border-slate-200 text-slate-400 group-hover:text-amber-500"><Edit2 size={12} /></button>
                                                <button onClick={() => {
                                                    Swal.fire({
                                                        title: 'Hapus Rekening?',
                                                        text: 'Aksi ini tidak dapat dibatalkan.',
                                                        icon: 'warning',
                                                        showCancelButton: true,
                                                        confirmButtonColor: '#e11d48'
                                                    }).then(res => { if (res.isConfirmed) deleteAccount(acc.id); });
                                                }} className="p-1.5 bg-white border border-slate-200 text-slate-400 hover:text-rose-600"><Trash2 size={12} /></button>
                                            </div>
                                        </div>
                                        {acc.isCashOrBank && (
                                            <span className="text-[8px] bg-emerald-100 text-emerald-700 px-2 py-1 uppercase font-bold tracking-widest rounded-sm">Kas & Bank (Bisa dipilih saat transaksi)</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <Modal isOpen={isAccountModalOpen} onClose={() => setIsAccountModalOpen(false)} title={editingAccount ? `Edit Akun: ${editingAccount.name}` : "Tambah Akun / Rekening Baru"}>
                            <form onSubmit={handleSaveAccount} className="space-y-6">
                                {/* Category Selector — Controls auto code */}
                                <div>
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Kategori Akun</label>
                                    <select
                                        name="category"
                                        value={editingAccount?.category || newAccountCategory}
                                        onChange={(e) => {
                                            const cat = e.target.value as AccountCategory;
                                            if (!editingAccount) setNewAccountCategory(cat);
                                        }}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-sm px-4 py-3 text-sm font-bold focus:outline-none focus:border-amber-500"
                                    >
                                        <option value={AccountCategory.ASSET}>1xx — ASSET (Harta / Kas / Bank)</option>
                                        <option value={AccountCategory.LIABILITY}>2xx — LIABILITY (Hutang / Kewajiban)</option>
                                        <option value={AccountCategory.EQUITY}>3xx — EQUITY (Modal / Dana Cadangan)</option>
                                        <option value={AccountCategory.REVENUE}>4xx — REVENUE (Pendapatan)</option>
                                        <option value={AccountCategory.EXPENSE}>5xx — EXPENSE (Beban / Biaya)</option>
                                    </select>
                                </div>
                                {/* Auto COA Code Display */}
                                <div>
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Kode Akun COA (Otomatis)</label>
                                    <div className="relative">
                                        <input
                                            name="code"
                                            required
                                            value={autoCode}
                                            readOnly={!editingAccount}
                                            onChange={() => {}}
                                            className="w-full bg-amber-50 border-2 border-amber-300 rounded-sm px-4 py-3 text-sm font-black text-amber-800 focus:outline-none font-mono tracking-widest"
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] text-amber-500 font-black uppercase tracking-widest">
                                            {editingAccount ? 'Dapat diubah' : 'Auto-generate'}
                                        </span>
                                    </div>
                                    <p className="text-[9px] text-slate-400 mt-1">Kode dibuat otomatis berdasarkan urutan standar COA peternakan. ASSET=1xx, LIAB=2xx, EQ=3xx, REV=4xx, EXP=5xx.</p>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Nama Akun / Rekening</label>
                                    <input name="name" required defaultValue={editingAccount?.name} placeholder="Cth: Bank BRI, Kas Admin, Beban Vaksin" className="w-full bg-slate-50 border border-slate-200 rounded-sm px-4 py-3 text-sm font-bold focus:outline-none focus:border-amber-500" />
                                </div>
                                <div>
                                    <label className="flex items-center space-x-3 p-4 border border-slate-200 rounded-sm cursor-pointer hover:bg-slate-50">
                                        <input name="isCashOrBank" type="checkbox" defaultChecked={editingAccount?.isCashOrBank} className="w-4 h-4 text-amber-500 rounded border-slate-300 focus:ring-amber-500" />
                                        <div>
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-900">Gunakan sebagai Metode Pembayaran</p>
                                            <p className="text-[9px] text-slate-400">Centang jika ini adalah Kas Tunai atau Rekening Bank untuk transaksi.</p>
                                        </div>
                                    </label>
                                </div>
                                <button type="submit" className="w-full bg-slate-900 text-white py-4 rounded-sm font-bold text-[10px] uppercase tracking-[0.2em] shadow-xl">
                                    Simpan Akun
                                </button>
                            </form>
                        </Modal>
                    </motion.div>
                )}

                {activeSection === 'SUPPLIER' && (
                    <motion.div
                        initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
                        key="supplier" className="space-y-8"
                    >
                        <div className="bg-white p-8 border border-slate-200 shadow-sm relative">
                            <div className="flex items-center justify-between mb-8">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900 uppercase tracking-tight italic">Manajemen Mitra & Supplier</h3>
                                    <p className="text-xs text-slate-500 mt-1 uppercase font-bold italic tracking-tighter opacity-70">Integrasi WhatsApp untuk pemesanan pakan & gudang.</p>
                                </div>
                                <button 
                                    onClick={() => { setEditingSupplier(null); setIsSupplierModalOpen(true); }}
                                    className="bg-slate-900 text-white p-3 rounded-full hover:bg-slate-800 transition-all shadow-lg"
                                >
                                    <Plus size={20} />
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {(farmSettings.suppliers || []).map((supplier) => (
                                    <div key={supplier.id} className="p-6 bg-slate-50 border border-slate-100 hover:border-amber-500 transition-all group relative">
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <p className="text-[12px] font-black uppercase text-slate-900 tracking-tighter italic">{supplier.name}</p>
                                                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{supplier.category}</p>
                                            </div>
                                            <div className="flex space-x-2">
                                                <button onClick={() => { setEditingSupplier(supplier); setIsSupplierModalOpen(true); }} className="p-1.5 bg-white border border-slate-200 text-slate-400 group-hover:text-amber-500"><Edit2 size={12} /></button>
                                                <button onClick={() => saveFarmSettings({ suppliers: farmSettings.suppliers.filter(s => s.id !== supplier.id) })} className="p-1.5 bg-white border border-slate-200 text-slate-400 hover:text-rose-600"><Trash2 size={12} /></button>
                                            </div>
                                        </div>
                                        <p className="text-[10px] text-slate-500 font-bold mb-4">{supplier.notes}</p>
                                        <a href={`https://wa.me/${supplier.whatsappNumber.replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer" className="inline-flex items-center space-x-2 bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-sm border border-emerald-100 text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500 hover:text-white transition-colors">
                                            <span>Chat WhatsApp</span>
                                            <ChevronRight size={12} />
                                        </a>
                                    </div>
                                ))}
                                {(farmSettings.suppliers || []).length === 0 && (
                                    <div className="col-span-2 text-center py-12 bg-slate-50 border border-dashed border-slate-200">
                                        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Belum ada data supplier</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <Modal isOpen={isSupplierModalOpen} onClose={() => setIsSupplierModalOpen(false)} title={editingSupplier ? `Edit Supplier: ${editingSupplier.name}` : "Tambah Supplier Baru"}>
                            <form onSubmit={handleSaveSupplier} className="space-y-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2">
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Nama Perusahaan / Personal</label>
                                        <input name="name" required defaultValue={editingSupplier?.name} className="w-full bg-slate-50 border border-slate-200 rounded-sm px-4 py-3 text-sm font-bold focus:outline-none focus:border-amber-500" />
                                    </div>
                                    <div className="col-span-1">
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">No. WhatsApp</label>
                                        <input name="whatsappNumber" required placeholder="628123456789" defaultValue={editingSupplier?.whatsappNumber} className="w-full bg-slate-50 border border-slate-200 rounded-sm px-4 py-3 text-sm font-bold focus:outline-none focus:border-amber-500" />
                                    </div>
                                    <div className="col-span-1">
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Kategori Supplier</label>
                                        <select name="category" defaultValue={editingSupplier?.category || 'FEED'} className="w-full bg-slate-50 border border-slate-200 rounded-sm px-4 py-3 text-sm font-bold focus:outline-none focus:border-amber-500">
                                            <option value="FEED">Pakan & Bahan Baku</option>
                                            <option value="MEDICINE">Obat & Vaksin</option>
                                            <option value="EQUIPMENT">Peralatan</option>
                                            <option value="OTHER">Lainnya</option>
                                        </select>
                                    </div>
                                    <div className="col-span-2">
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Catatan Tambahan</label>
                                        <textarea name="notes" defaultValue={editingSupplier?.notes} className="w-full bg-slate-50 border border-slate-200 rounded-sm px-4 py-3 text-sm font-bold focus:outline-none focus:border-amber-500 h-24" />
                                    </div>
                                </div>
                                <button type="submit" className="w-full bg-slate-900 text-white py-4 rounded-sm font-bold text-[10px] uppercase tracking-[0.2em] shadow-xl">
                                    Simpan Supplier
                                </button>
                            </form>
                        </Modal>
                    </motion.div>
                )}

                {activeSection === 'DATA' && (
                    <motion.div
                        initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
                        key="data" className="space-y-8"
                    >
                        <div className="bg-white p-8 border border-slate-200 shadow-sm">
                            <h3 className="text-lg font-bold text-slate-900 uppercase tracking-tight italic mb-2">Backup & Arsip Data</h3>
                            <p className="text-xs text-slate-500 uppercase font-bold italic tracking-tighter opacity-70 mb-8">Ekspor data Anda untuk cadangan atau analisis eksternal.</p>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="p-6 bg-slate-50 border border-slate-100 space-y-4">
                                    <div className="flex items-center space-x-3">
                                        <div className="p-2 bg-white border border-slate-200 rounded-sm text-slate-400">
                                            <Download size={20} />
                                        </div>
                                        <div>
                                            <p className="text-[12px] font-black uppercase text-slate-900 tracking-tighter italic">Ekspor Backup (JSON)</p>
                                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Format data mentah untuk sistem.</p>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => {
                                            const data = {
                                                productionLogs: JSON.parse(localStorage.getItem('poultry_prod_logs') || '[]'),
                                                salesLogs: JSON.parse(localStorage.getItem('poultry_sales_logs') || '[]'),
                                                transactions: JSON.parse(localStorage.getItem('poultry_transactions') || '[]'),
                                                inventory: JSON.parse(localStorage.getItem('poultry_inventory_v2') || '[]'),
                                                accounts: JSON.parse(localStorage.getItem('poultry_accounts') || '[]'),
                                                journals: JSON.parse(localStorage.getItem('poultry_journals') || '[]'),
                                                journalLines: JSON.parse(localStorage.getItem('poultry_journal_lines') || '[]')
                                            };
                                            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                                            const url = URL.createObjectURL(blob);
                                            const a = document.createElement('a');
                                            a.href = url;
                                            a.download = `backup_farm_${new Date().toISOString().slice(0,10)}.json`;
                                            a.click();
                                        }}
                                        className="w-full bg-slate-900 text-white py-3 rounded-sm font-bold text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-all"
                                    >
                                        Download Backup
                                    </button>
                                </div>

                                <div className="p-6 bg-rose-50 border border-rose-100 space-y-4">
                                    <div className="flex items-center space-x-3">
                                        <div className="p-2 bg-white border border-rose-200 rounded-sm text-rose-400">
                                            <RotateCcw size={20} />
                                        </div>
                                        <div>
                                            <p className="text-[12px] font-black uppercase text-rose-900 tracking-tighter italic">Reset Semua Data</p>
                                            <p className="text-[9px] text-rose-400 font-bold uppercase tracking-widest mt-0.5">Hapus seluruh data permanen.</p>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => {
                                            Swal.fire({
                                                title: 'Hapus Semua Data?',
                                                text: 'Seluruh histori transaksi, produksi, dan inventaris akan dihapus permanen!',
                                                icon: 'warning',
                                                showCancelButton: true,
                                                confirmButtonColor: '#e11d48',
                                                confirmButtonText: 'Ya, Hapus Semua'
                                            }).then(res => {
                                                if (res.isConfirmed) {
                                                    localStorage.clear();
                                                    window.location.reload();
                                                }
                                            });
                                        }}
                                        className="w-full bg-rose-600 text-white py-3 rounded-sm font-bold text-[10px] uppercase tracking-widest hover:bg-rose-700 transition-all"
                                    >
                                        Hapus Permanen
                                    </button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

interface FlockFormProps {
    houseId: string;
    flock: FlockBatch | null;
    onSave: (data: Omit<FlockBatch, 'id'>) => void;
}

function FlockForm({ houseId, flock, onSave }: FlockFormProps) {
    const { farmSettings } = useGlobalData();
    const [strain, setStrain] = useState(flock?.strain || '');
    const [arrivalDate, setArrivalDate] = useState(flock?.arrivalDate || new Date().toISOString().split('T')[0]);
    const [arrivalAgeWeeks, setArrivalAgeWeeks] = useState(flock?.arrivalAgeWeeks || 0);
    const [initialCount, setInitialCount] = useState(flock?.initialCount || 0);
    const [isActive, setIsActive] = useState(flock?.isActive ?? true);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({
            houseId,
            strain,
            arrivalDate,
            arrivalAgeWeeks,
            initialCount,
            currentCount: flock?.currentCount || initialCount,
            isActive
        });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Strain / Jenis Ayam</label>
                    <select
                        required value={strain} onChange={(e) => setStrain(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-sm px-4 py-3 text-sm font-bold text-slate-800 focus:outline-none focus:border-amber-500"
                    >
                        <option value="">Pilih Strain</option>
                        {farmSettings.strains.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
                <div className="col-span-2 sm:col-span-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Tanggal Datang</label>
                    <div className="relative">
                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            type="date" required value={arrivalDate} onChange={(e) => setArrivalDate(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-sm pl-12 pr-4 py-3 text-sm font-bold text-slate-800 focus:outline-none focus:border-amber-500"
                        />
                    </div>
                </div>
                <div className="col-span-2 sm:col-span-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Umur Saat Datang (Mg)</label>
                    <input
                        type="number" required min="0" value={arrivalAgeWeeks} onChange={(e) => setArrivalAgeWeeks(Number(e.target.value))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-sm px-4 py-3 text-sm font-bold text-slate-800 focus:outline-none focus:border-amber-500"
                    />
                </div>
                <div className="col-span-2 sm:col-span-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Populasi Awal (Ekor)</label>
                    <div className="relative">
                        <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            type="number" required min="1" value={initialCount} onChange={(e) => setInitialCount(Number(e.target.value))}
                            className="w-full bg-slate-50 border border-slate-200 rounded-sm pl-12 pr-4 py-3 text-sm font-bold text-slate-800 focus:outline-none focus:border-amber-500"
                        />
                    </div>
                </div>
                <div className="col-span-2 sm:col-span-1 flex items-end">
                    <label className="flex items-center space-x-3 cursor-pointer p-3 bg-slate-50 border border-slate-100 w-full hover:bg-slate-100 transition-colors">
                        <div className={cn(
                            "w-5 h-5 rounded-sm border flex items-center justify-center transition-all",
                            isActive ? "bg-amber-500 border-amber-600 shadow-inner" : "bg-white border-slate-200"
                        )}>
                            {isActive && <CheckCircle2 size={14} className="text-white" />}
                            <input type="checkbox" className="hidden" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-600">Batch Aktif</span>
                    </label>
                </div>
            </div>
            <button type="submit" className="w-full bg-slate-900 text-white py-4 rounded-sm font-bold text-[10px] uppercase tracking-[0.2em] hover:bg-slate-800 transition-all shadow-lg">
                Simpan Konfigurasi Batch
            </button>
        </form>
    );
}

