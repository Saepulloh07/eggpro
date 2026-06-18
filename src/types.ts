/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  WORKER = 'WORKER',
}

export enum EggCategory {
  BM = 'Remban',
  KRC = 'Bujang',
  KRC_RETAK = 'Bujang Retak',
  KS = 'KS',
  KS_RETAK = 'KS Retak',
  PELOR = 'Pelor',
  RETAK = 'Retak',
  PECAH = 'Pecah',
}

export enum MortalityCause {
  DISEASE = 'DISEASE',
  CULLED = 'CULLED',
  OTHER = 'OTHER',
}

// ACCOUNTING TYPES
export enum AccountCategory {
  ASSET = 'ASSET',
  LIABILITY = 'LIABILITY',
  EQUITY = 'EQUITY',
  REVENUE = 'REVENUE',
  EXPENSE = 'EXPENSE'
}

// NORMAL BALANCE direction (DEBIT = increases with debit, CREDIT = increases with credit)
export enum NormalBalance {
  DEBIT = 'DEBIT',
  CREDIT = 'CREDIT'
}

export interface Account {
  id: string;
  code: string;
  name: string;
  category: AccountCategory;
  normalBalance?: NormalBalance; // auto-derived from category if not set
  isCashOrBank?: boolean;
  parentId?: string;   // for hierarchical COA (sub-accounts)
  isSystem?: boolean;  // protected system accounts, cannot be deleted
}

export interface JournalEntry {
  id: string;
  date: string;
  reference: string;
  description: string;
}

export interface JournalLine {
  id: string;
  journalId: string;
  accountId: string;
  debit: number;
  credit: number;
  houseId?: string;
}

// WAREHOUSE TYPES
export enum StockMutationType {
  PURCHASE = 'PURCHASE',
  USAGE = 'USAGE',
  TRANSFER = 'TRANSFER',
  ADJUSTMENT = 'ADJUSTMENT',
  PRODUCTION = 'PRODUCTION',
  SALE = 'SALE',
  RETURN = 'RETURN',
}

export interface StockMutation {
  id: string;
  date: string;
  itemId: string;
  type: StockMutationType;
  quantity: number;
  unitCost: number;
  totalCost: number;
  sourceLocation: string;
  targetLocation?: string;
  paidByHouseId?: string; // Siapa yang bayar
  usedByHouseId?: string; // Siapa yang pakai
  reference: string;
  notes?: string;
}

export enum PaymentMethod {
  CASH = 'CASH',
  BANK_TRANSFER = 'BANK_TRANSFER',
  HUTANG = 'HUTANG', // AP
  PIUTANG = 'PIUTANG' // AR
}

export enum PaymentStatus {
  LUNAS = 'LUNAS',
  HUTANG = 'HUTANG',
  PIUTANG = 'PIUTANG'
}

export interface APARPayment {
  id: string;
  aparRecordId: string;
  date: string;
  amount: number;
  accountId: string; // kas/bank
  reference: string;
  notes?: string;
  createdBy?: string;
}

export interface APARRecord {
  id: string;
  type: 'HUTANG' | 'PIUTANG'; // AP | AR
  entityName: string; // Supplier / Customer
  description?: string;
  amount: number;
  remainingAmount: number;
  dueDate: string;
  createdAt: string;
  status: 'OPEN' | 'PARTIAL' | 'CLOSED' | 'OVERDUE' | 'CANCELLED' | 'WRITE_OFF';
  relatedTransactionId?: string;
  houseId?: string; // Tagging per house
  isInterHouse?: boolean;      // NEW: For inter-house debt
  fromHouseId?: string;
  toHouseId?: string;
}

export interface CostAllocation {
  id: string;
  date: string;
  description: string;
  totalAmount: number;
  metric: 'POPULATION' | 'FEED_CONSUMPTION' | 'EGG_PRODUCTION' | 'AREA' | 'MANUAL';
  allocations: Record<string, number>; // houseId -> amount
  journalId?: string;
}

export interface BankReconciliation {
  id: string;
  accountId: string;
  date: string;
  systemBalance: number;
  bankBalance: number;
  difference: number;
  status: 'DRAFT' | 'COMPLETED';
  notes?: string;
}

// Operational Expense (non-inventory daily expenses)
export enum ExpenseCategory {
  LISTRIK = 'Listrik',
  AIR = 'Air / PDAM',
  BBM = 'BBM / Transportasi',
  WIFI = 'Internet / WiFi',
  ATK = 'Alat Tulis',
  KONSUMSI = 'Konsumsi / Tamu',
  TENAGA_KERJA = 'Tenaga Kerja',
  SEWA = 'Sewa / Kontrak',
  LAINNYA = 'Lain-lain',
}

export interface OperationalExpense {
  id: string;
  houseId?: string;
  date: string;
  category: ExpenseCategory | string;
  description: string;
  amount: number;
  accountId: string;       // akun beban yang didebit
  paymentAccountId: string; // akun kas/bank yang dikredit
  receiptUrl?: string;     // foto nota (base64 or URL)
  journalId?: string;
}

// Sinking Fund
export enum SinkingFundType {
  DOC = 'DOC Baru',
  RENOVATION = 'Peremajaan Kandang',
  RESERVE = 'Dana Cadangan',
}

export interface SinkingFundAllocation {
  id: string;
  date: string;
  type: SinkingFundType;
  amount: number;
  notes?: string;
  journalId?: string;
}

export interface PoultryHouse {
  id: string;
  name: string;
  location?: string;
  capacity: number;           // jumlah ayam maksimum
  area?: number;              // NEW: luas kandang dalam m2
  description?: string;
  managerId?: string;         // NEW: Penanggungjawab
  purchaseDate?: string;      // NEW: For depreciation calculation
  purchasePrice?: number;     // NEW: For depreciation calculation
  workerCount?: number;       // NEW: Number of workers for auto egg allowance
}

export interface Supplier {
  id: string;
  name: string;
  whatsappNumber: string;
  category: string;
  notes?: string;
}

export interface MasterPrice {
  id: string;
  name: string;
  price: number;
  type?: 'telur' | 'non-egg';
  unit?: string;
}

export enum ItemType {
  RAW_MATERIAL = 'RAW_MATERIAL',     // Jagung, Katul, Bungkil
  FINISHED_FEED = 'FINISHED_FEED',   // Pakan Jadi hasil mixing
  EGG_STOCK = 'EGG_STOCK',          // Stok telur per kategori (BM, KRC, etc.)
  MEDICINE = 'MEDICINE',
  VACCINE = 'VACCINE',
  NON_CORE = 'NON_CORE',             // Karung, Kotoran, Afkir, Jagung (for sale)
  OTHER = 'OTHER'
}

export enum ItemCategory {
  INVENTORY = 'INVENTORY',
  EXPENSE = 'EXPENSE',
  ASSET = 'ASSET'
}

export interface User {
  id: string;
  name: string;
  username: string;             // NEW: Username
  role: UserRole;
  email: string;
  password?: string;            // plain-text for mock auth
  assignedHouses?: string[];    // WORKER only — which houses they can access
  salary?: number;              // NEW: Penggajian
}

export interface DailyProduction {
  id: string;
  houseId: string;
  date: string;
  eggCount: number;
  eggWeight: number;
  abnormalEggCount?: number;       // Telur pecah/abnormal
  categoryBreakdown: Record<EggCategory, number>;
  feedConsumed: number;
  feedInventoryItemId: string;     // NEW: which inventory feed item was consumed
  fcr: number;
  mortality: number;
  mortalityCause?: MortalityCause; // NEW: why did the birds die
  notes?: string;
  workerId: string;
}

export interface InventoryItem {
  id: string;
  houseId: string;               // Required - all items must belong to a specific house.
  name: string;
  type: ItemType;
  itemCategory?: ItemCategory;   // NEW: Classification for accounting routing
  quantity: number;
  unit: string;
  reorderPoint: number;
  lastPrice: number;             // Represents average cost (Average Cost method)
  eggCategory?: EggCategory;     // For EGG_STOCK items — which egg category this represents
  paidByHouseId?: string;        // NEW: Who paid for this stock (to avoid circular AP/AR)
}

export interface Sale {
  id: string;
  houseId: string;
  date: string;
  category: EggCategory | 'NON_EGG' | 'NON_CORE';
  quantity: number;
  pricePerUnit: number;
  totalPrice: number;
  buyerName?: string;
  isFree?: boolean;
}

export enum AssetCondition {
  BAIK = 'BAIK',
  SERVIS = 'SERVIS',
  RUSAK = 'RUSAK'
}

export interface MaintenanceRecord {
  date: string;
  status: AssetCondition;
  user: string;
  notes?: string;
}

export interface Asset {
  id: string;
  houseId: string;
  name: string;
  category: 'ALAT PRODUKSI' | 'KENDARAAN' | 'BANGUNAN' | 'LAINNYA';
  quantity: number; // NEW: Jumlah barang
  purchaseDate: string;
  purchasePrice: number;
  expectedLifeYears: number;
  salvageValue?: number; // NEW: Nilai sisa / residu
  condition: AssetCondition;
  maintenanceHistory: MaintenanceRecord[];
}

export interface FinancialRecord {
  id: string;
  houseId: string;
  date: string;
  type: 'INCOME' | 'EXPENSE';
  category: string;
  amount: number;
  description: string;
  invoiceUrl?: string;
}

// Flock / Batch tracking
export interface FlockBatch {
  id: string;
  houseId: string;
  strain: string;
  arrivalDate: string;
  arrivalAgeWeeks: number;
  initialCount: number;
  currentCount: number;
  isActive: boolean;
  targetHDP?: number;        // % target Hen-Day Production
  initialCapital?: number;   // modal awal (bibit + biaya DOC)
  docPrice?: number;         // harga DOC per ekor
  notes?: string;
}

// Biosecurity & health records
export interface BiosecurityRecord {
  id: string;
  houseId: string;
  date: string;
  type: 'VAKSIN' | 'VITAMIN' | 'OBAT' | 'BIOSEKURITI' | 'SYMPTOM';
  name: string;
  route?: string;
  dosage?: string;
  ageWeekTarget?: number;
  ageDayTarget?: number;
  notes?: string;
  status: 'SCHEDULED' | 'DONE' | 'MISSED';
  symptomsBefore?: string;
  symptomsAfter?: string;
  composition?: any;
}

// NEW: Mortality Record — links a production day's death to a cause
export interface MortalityRecord {
  id: string;
  houseId: string;
  date: string;
  count: number;
  cause: MortalityCause;
  productionLogId?: string;
  notes?: string;
}

export enum MutationType {
  ARRIVAL = 'ARRIVAL',       // DOC Masuk
  TRANSFER = 'TRANSFER',     // Mutasi Kandang
  MORTALITY = 'MORTALITY',   // Mortalitas
  CULLING = 'CULLING',       // Afkir
}

export interface PopulationMutation {
  id: string;
  houseId: string;
  targetHouseId?: string;    // For TRANSFER
  date: string;
  type: MutationType;
  count: number;
  pricePerBird?: number;     // For ARRIVAL (purchase) or CULLING (sale)
  totalPrice?: number;
  notes?: string;
  transactionId?: string;    // Linked financial record
}

// Feed Recipe (Formulasi Ransum)
export interface RecipeIngredient {
  inventoryItemId: string;
  amountKg: number;        // kg per batch giling
  percentage?: number;     // @deprecated, untuk data lama
}

export interface FeedRecipe {
  id: string;
  name: string;
  targetFcr: number;
  outputInventoryItemId?: string;  // NEW: which FINISHED_FEED item this recipe produces
  ingredients: RecipeIngredient[];
}

// Analytics computed types
export interface HDPStats {
  date: string;
  hdp: number;           // Hen-Day Production percentage
  standardHDP: number;   // Strain standard for this age
  ageWeeks: number;
}

export interface FlockAnalytics {
  houseId: string;
  cumulativeFCR: number;
  feedIntakePerBirdGrams: number;
  hppPerButir: number;          // Harga Pokok Produksi per butir telur
  hppPerKg: number;             // Harga Pokok Produksi per kg telur
  totalButir: number;
  totalKg: number;
  totalFeedCost: number;
  netPL?: number;              // SUPER_ADMIN only
}

// Farm-wide operational settings & alert thresholds
export interface FarmSettings {
  // Production targets
  globalTargetHDP: number;           // default % HDP target (e.g. 90)
  mortalityAlertThreshold: number;   // % per month (e.g. 0.5)
  lowHDPAlertThreshold: number;      // % below standard before alert (e.g. 5)
  targetFCR: number;                 // Feed Conversion Ratio Target
  stdFeedIntake: number;             // Standard feed intake per layer (e.g. 115g)

  // Master Data
  strains: string[];                 // Isa Brown, Lohmann, etc.
  units: string[];                   // kg, liter, ml, etc.
  wasteFreePercentage: number;       // Target/Limit for Waste & Free Goods
  masterPrices: MasterPrice[];       // NEW: Dynamic master prices
  suppliers: Supplier[];             // NEW: Suppliers data

  // Capital
  initialCapital: number;            // global modal awal farm
  // Depreciation
  cageValueTotal: number;            // nilai kandang
  cageLifeYears: number;
  cageSalvageValue: number;          // nilai sisa kandang
  equipmentValueTotal: number;       // nilai peralatan
  equipmentLifeYears: number;
  equipmentSalvageValue: number;     // nilai sisa peralatan
  layerValueTotal: number;           // nilai ayam (pullet)
  layerLifeYears: number;            // umur ekonomis ayam (dalam tahun atau bulan)
  layerSalvageValue: number;         // nilai sisa/afkir ayam

  // NEW FEATURES
  workerEggAllowancePerDay: number;  // default 5
  workerEggAllowanceCategory?: EggCategory; // NEW: Kategori jatah telur
  abnormalEggTolerancePct: number;   // default 2%
  sinkingFundDocPct: number;         // Sinking fund untuk DOC (%)
  sinkingFundHousePct: number;       // Sinking fund untuk Peremajaan (%)
  sinkingFundReservePct: number;     // Sinking fund untuk Dana Cadangan (%)
  lastClosingDate?: string;          // NEW: Date before which data cannot be edited (Lock Period)
}

export const DEFAULT_FARM_SETTINGS: FarmSettings = {
  globalTargetHDP: 90,
  mortalityAlertThreshold: 0.5,
  lowHDPAlertThreshold: 5,
  targetFCR: 2.1,
  stdFeedIntake: 115,
  strains: ['Isa Brown', 'Lohmann', 'Hy-Line', 'Hisex'],
  units: ['kg', 'liter', 'ml', 'papan', 'butir', 'sak'],
  wasteFreePercentage: 3,
  masterPrices: [
    { id: 'BM', name: 'Remban', price: 28500, type: 'telur', unit: 'butir' },
    { id: 'KRC', name: 'Bujang', price: 27000, type: 'telur', unit: 'butir' },
    { id: 'KRC_RETAK', name: 'Bujang Retak', price: 25000, type: 'telur', unit: 'butir' },
    { id: 'KS', name: 'KS', price: 25000, type: 'telur', unit: 'butir' },
    { id: 'KS_RETAK', name: 'KS Retak', price: 22000, type: 'telur', unit: 'butir' },
    { id: 'PELOR', name: 'Pelor', price: 20000, type: 'telur', unit: 'butir' },
    { id: 'RETAK', name: 'Retak', price: 15000, type: 'telur', unit: 'butir' },
    { id: 'PECAH', name: 'Pecah', price: 5000, type: 'telur', unit: 'butir' },
    { id: 'NON_EGG', name: 'Limbah/Karung', price: 5000, type: 'non-egg', unit: 'sak' }
  ],
  suppliers: [],
  initialCapital: 0,
  cageValueTotal: 500000000,
  cageLifeYears: 10,
  cageSalvageValue: 50000000,
  equipmentValueTotal: 50000000,
  equipmentLifeYears: 5,
  equipmentSalvageValue: 5000000,
  layerValueTotal: 100000000,
  layerLifeYears: 2,
  layerSalvageValue: 20000000,
  workerEggAllowancePerDay: 5,
  workerEggAllowanceCategory: EggCategory.BM, // Default to BM (Remban)
  abnormalEggTolerancePct: 2,
  sinkingFundDocPct: 10,
  sinkingFundHousePct: 5,
  sinkingFundReservePct: 5,
  lastClosingDate: '2020-01-01',
};

export const DEFAULT_ACCOUNTS: Account[] = [
  // ── ASET LANCAR (1-1xxx) ──
  { id: 'acc-kas', code: '1-1100', name: 'Kas Utama (Farm)', category: AccountCategory.ASSET, isCashOrBank: true, isSystem: true },
  { id: 'acc-bank-bca', code: '1-1110', name: 'Bank BCA', category: AccountCategory.ASSET, isCashOrBank: true, isSystem: true },
  { id: 'acc-bank-mandiri', code: '1-1111', name: 'Bank Mandiri', category: AccountCategory.ASSET, isCashOrBank: true, isSystem: true },
  { id: 'acc-piutang-usaha', code: '1-1201', name: 'Piutang Usaha (Telur)', category: AccountCategory.ASSET, isCashOrBank: false, isSystem: true },
  { id: 'acc-piutang-antar', code: '1-1202', name: 'Piutang Antar Kandang', category: AccountCategory.ASSET, isCashOrBank: false, isSystem: true },
  { id: 'acc-persediaan-pakan', code: '1-1301', name: 'Persediaan Pakan (Gudang)', category: AccountCategory.ASSET, isCashOrBank: false, isSystem: true },
  { id: 'acc-persediaan-obat', code: '1-1302', name: 'Persediaan Obat & Vaksin', category: AccountCategory.ASSET, isCashOrBank: false, isSystem: true },
  { id: 'acc-persediaan-telur', code: '1-1303', name: 'Persediaan Telur', category: AccountCategory.ASSET, isCashOrBank: false, isSystem: true },
  // ── ASET TETAP (1-2xxx) ──
  { id: 'acc-bangunan', code: '1-2100', name: 'Bangunan Kandang', category: AccountCategory.ASSET, isCashOrBank: false, isSystem: true },
  { id: 'acc-akum-bangunan', code: '1-2101', name: 'Akm. Penyusutan Bangunan', category: AccountCategory.ASSET, isCashOrBank: false, isSystem: true },
  { id: 'acc-peralatan', code: '1-2200', name: 'Peralatan Kandang', category: AccountCategory.ASSET, isCashOrBank: false, isSystem: true },
  { id: 'acc-akum-peralatan', code: '1-2201', name: 'Akm. Penyusutan Peralatan', category: AccountCategory.ASSET, isCashOrBank: false, isSystem: true },
  { id: 'acc-kendaraan', code: '1-2300', name: 'Kendaraan', category: AccountCategory.ASSET, isCashOrBank: false, isSystem: true },
  { id: 'acc-akum-kendaraan', code: '1-2301', name: 'Akm. Penyusutan Kendaraan', category: AccountCategory.ASSET, isCashOrBank: false, isSystem: true },
  { id: 'acc-ternak', code: '1-2400', name: 'Ternak (Ayam Layer)', category: AccountCategory.ASSET, isCashOrBank: false, isSystem: true },
  { id: 'acc-akum-ternak', code: '1-2401', name: 'Akm. Penyusutan Ternak', category: AccountCategory.ASSET, isCashOrBank: false, isSystem: true },
  // ── LIABILITAS (2-1xxx) ──
  { id: 'acc-hutang-usaha', code: '2-1100', name: 'Hutang Usaha', category: AccountCategory.LIABILITY, isCashOrBank: false, isSystem: true },
  { id: 'acc-hutang-antar', code: '2-1200', name: 'Hutang Antar Kandang', category: AccountCategory.LIABILITY, isCashOrBank: false, isSystem: true },
  { id: 'acc-hutang-gaji', code: '2-1300', name: 'Hutang Gaji', category: AccountCategory.LIABILITY, isCashOrBank: false, isSystem: true },
  { id: 'acc-hutang-bank', code: '2-2100', name: 'Hutang Bank', category: AccountCategory.LIABILITY, isCashOrBank: false, isSystem: true },
  // ── EKUITAS (3-1xxx) ──
  { id: 'acc-modal', code: '3-1000', name: 'Modal Pemilik', category: AccountCategory.EQUITY, isCashOrBank: false, isSystem: true },
  { id: 'acc-laba-ditahan', code: '3-1100', name: 'Laba Ditahan', category: AccountCategory.EQUITY, isCashOrBank: false, isSystem: true },
  { id: 'acc-sinking-doc', code: '3-1201', name: 'Sinking Fund — DOC Baru', category: AccountCategory.EQUITY, isCashOrBank: false, isSystem: true },
  { id: 'acc-sinking-kandang', code: '3-1202', name: 'Sinking Fund — Peremajaan', category: AccountCategory.EQUITY, isCashOrBank: false, isSystem: true },
  { id: 'acc-sinking-cadangan', code: '3-1203', name: 'Dana Cadangan Umum', category: AccountCategory.EQUITY, isCashOrBank: false, isSystem: true },
  // ── PENDAPATAN (4-1xxx) ──
  { id: 'acc-penjualan-telur', code: '4-1000', name: 'Pendapatan Penjualan Telur', category: AccountCategory.REVENUE, isCashOrBank: false, isSystem: true },
  { id: 'acc-penjualan-afkir', code: '4-2001', name: 'Penjualan Ayam Afkir', category: AccountCategory.REVENUE, isCashOrBank: false, isSystem: true },
  { id: 'acc-penjualan-kotoran', code: '4-2002', name: 'Penjualan Kotoran Ayam', category: AccountCategory.REVENUE, isCashOrBank: false, isSystem: true },
  { id: 'acc-pendapatan-writeoff', code: '4-3000', name: 'Pendapatan Penghapusan Hutang', category: AccountCategory.REVENUE, isCashOrBank: false, isSystem: true },
  { id: 'acc-pendapatan-lain', code: '4-2999', name: 'Pendapatan Lain-lain', category: AccountCategory.REVENUE, isCashOrBank: false, isSystem: true },
  // ── BEBAN POKOK PRODUKSI (5-1xxx) ──
  { id: 'acc-beban-pakan', code: '5-1000', name: 'Beban Pakan', category: AccountCategory.EXPENSE, isCashOrBank: false, isSystem: true },
  { id: 'acc-beban-doc', code: '5-2000', name: 'Beban DOC & Bibit', category: AccountCategory.EXPENSE, isCashOrBank: false, isSystem: true },
  { id: 'acc-beban-susut-ternak', code: '5-3000', name: 'Beban Penyusutan Ternak', category: AccountCategory.EXPENSE, isCashOrBank: false, isSystem: true },
  { id: 'acc-beban-vaksin', code: '5-4000', name: 'Beban Obat & Vaksin', category: AccountCategory.EXPENSE, isCashOrBank: false, isSystem: true },
  // ── BEBAN OPERASIONAL (6-1xxx) ──
  { id: 'acc-beban-gaji', code: '6-1000', name: 'Beban Gaji & Upah', category: AccountCategory.EXPENSE, isCashOrBank: false, isSystem: true },
  { id: 'acc-beban-listrik', code: '6-2000', name: 'Beban Listrik & Air', category: AccountCategory.EXPENSE, isCashOrBank: false, isSystem: true },
  { id: 'acc-beban-perawatan', code: '6-3000', name: 'Beban Perawatan & Perbaikan', category: AccountCategory.EXPENSE, isCashOrBank: false, isSystem: true },
  { id: 'acc-beban-transport', code: '6-4000', name: 'Beban Transportasi', category: AccountCategory.EXPENSE, isCashOrBank: false, isSystem: true },
  { id: 'acc-beban-susut-bangunan', code: '6-5001', name: 'Beban Penyusutan Kandang', category: AccountCategory.EXPENSE, isCashOrBank: false, isSystem: true },
  { id: 'acc-beban-susut-alat', code: '6-5002', name: 'Beban Penyusutan Peralatan', category: AccountCategory.EXPENSE, isCashOrBank: false, isSystem: true },
  { id: 'acc-beban-admin', code: '6-6000', name: 'Beban Administrasi', category: AccountCategory.EXPENSE, isCashOrBank: false, isSystem: true },
  { id: 'acc-beban-lain', code: '6-7000', name: 'Beban Lain-lain', category: AccountCategory.EXPENSE, isCashOrBank: false, isSystem: true },
  { id: 'acc-beban-writeoff', code: '6-8000', name: 'Beban Penghapusan Piutang', category: AccountCategory.EXPENSE, isCashOrBank: false, isSystem: true },
  { id: 'acc-beban-promosi', code: '6-9000', name: 'Beban Promosi / CSR', category: AccountCategory.EXPENSE, isCashOrBank: false, isSystem: true },
];