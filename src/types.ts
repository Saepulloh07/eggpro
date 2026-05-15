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

// NEW: Cause of death for mortality tracking
export enum MortalityCause {
  DISEASE = 'DISEASE',     // Penyakit
  CULLED = 'CULLED',       // Afkir (voluntary removal)
  OTHER = 'OTHER',         // Lainnya
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
  sourceLocation: 'CENTRAL' | string;
  targetLocation?: 'CENTRAL' | string;
  paidByHouseId?: 'CENTRAL' | string; // NEW: Siapa yang bayar
  usedByHouseId?: 'CENTRAL' | string; // NEW: Siapa yang pakai
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

// Payment history for AP/AR records
export interface PaymentHistoryEntry {
  id: string;
  date: string;
  amount: number;
  accountId: string; // which account was used to pay
  notes?: string;
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
  status: 'OPEN' | 'PARTIAL' | 'CLOSED';
  relatedTransactionId?: string;
  houseId?: string; // Tagging per house
  paymentHistory: PaymentHistoryEntry[];
  isInterHouse?: boolean;      // NEW: For inter-house debt
  fromHouseId?: string;
  toHouseId?: string;
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
  houseId?: string;              // optional – some items are farm-wide. If empty or 'CENTRAL', it's in Central Warehouse.
  name: string;
  type: ItemType;
  quantity: number;
  unit: string;
  reorderPoint: number;
  lastPrice: number;             // Represents average cost (Average Cost method)
  eggCategory?: EggCategory;     // For EGG_STOCK items — which egg category this represents
  paidByHouseId?: string;        // NEW: Who paid for this stock (to avoid circular AP/AR)
}

export interface Sale {
  id: string;
  houseId: string; // can be 'CENTRAL' for non-core
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
  percentage: number;
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
    { id: 'BM', name: 'Remban', price: 28500 },
    { id: 'KRC', name: 'Bujang', price: 27000 },
    { id: 'KRC_RETAK', name: 'Bujang Retak', price: 25000 },
    { id: 'KS', name: 'KS', price: 25000 },
    { id: 'KS_RETAK', name: 'KS Retak', price: 22000 },
    { id: 'PELOR', name: 'Pelor', price: 20000 },
    { id: 'RETAK', name: 'Retak', price: 15000 },
    { id: 'PECAH', name: 'Pecah', price: 5000 },
    { id: 'NON_EGG', name: 'Limbah/Karung', price: 5000 }
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
  abnormalEggTolerancePct: 2,
  sinkingFundDocPct: 10,
  sinkingFundHousePct: 5,
  sinkingFundReservePct: 5,
  lastClosingDate: '2020-01-01',
};

export const DEFAULT_ACCOUNTS: Account[] = [
  // ASSETS
  { id: 'acc-kas', code: '1101', name: 'Kas Utama (Farm)', category: AccountCategory.ASSET, isCashOrBank: true, isSystem: true },
  { id: 'acc-bank-bca', code: '1102', name: 'Bank BCA', category: AccountCategory.ASSET, isCashOrBank: true, isSystem: true },
  { id: 'acc-piutang-telur', code: '1103', name: 'Piutang Penjualan Telur', category: AccountCategory.ASSET, isSystem: true },
  { id: 'acc-piutang-antar', code: '1104', name: 'Piutang Antar Kandang', category: AccountCategory.ASSET, isSystem: true },
  { id: 'acc-persediaan-pakan', code: '1111', name: 'Persediaan Pakan', category: AccountCategory.ASSET, isSystem: true },
  { id: 'acc-persediaan-obat', code: '1112', name: 'Persediaan Obat & Vaksin', category: AccountCategory.ASSET, isSystem: true },
  { id: 'acc-telur-stock', code: '1113', name: 'Persediaan Stok Telur', category: AccountCategory.ASSET, isSystem: true },
  { id: 'acc-aset-kandang', code: '1201', name: 'Aset Kandang & Bangunan', category: AccountCategory.ASSET, isSystem: true },
  { id: 'acc-aset-peralatan', code: '1202', name: 'Aset Peralatan', category: AccountCategory.ASSET, isSystem: true },
  { id: 'acc-aset-ayam', code: '1203', name: 'Aset Ayam (Pullet)', category: AccountCategory.ASSET, isSystem: true },
  { id: 'acc-bank-cadangan', code: '1301', name: 'Bank (Dana Cadangan Peremajaan)', category: AccountCategory.ASSET, isSystem: true },

  // LIABILITIES
  { id: 'acc-hutang-pakan', code: '2101', name: 'Hutang Pakan', category: AccountCategory.LIABILITY, isSystem: true },
  { id: 'acc-hutang-doc', code: '2102', name: 'Hutang DOC', category: AccountCategory.LIABILITY, isSystem: true },
  { id: 'acc-hutang-antar', code: '2103', name: 'Hutang Antar Kandang', category: AccountCategory.LIABILITY, isSystem: true },
  { id: 'acc-hutang-dagang', code: '2104', name: 'Hutang Dagang Lainnya', category: AccountCategory.LIABILITY, isSystem: true },

  // EQUITY
  { id: 'acc-modal', code: '3101', name: 'Modal Pemilik', category: AccountCategory.EQUITY, isSystem: true },
  { id: 'acc-laba-ditahan', code: '3201', name: 'Laba Ditahan', category: AccountCategory.EQUITY, isSystem: true },
  { id: 'acc-cadangan-ekuitas', code: '3301', name: 'Cadangan Ekuitas (Sinking Fund)', category: AccountCategory.EQUITY, isSystem: true },

  // REVENUE
  { id: 'acc-penjualan-telur', code: '4101', name: 'Pendapatan Jual Telur', category: AccountCategory.REVENUE, isSystem: true },
  { id: 'acc-penjualan-afkir', code: '4102', name: 'Pendapatan Jual Ayam Afkir', category: AccountCategory.REVENUE, isSystem: true },
  { id: 'acc-penjualan-lain', code: '4103', name: 'Pendapatan Lain-lain', category: AccountCategory.REVENUE, isSystem: true },

  // EXPENSES
  { id: 'acc-beban-pakan', code: '5101', name: 'Beban Pakan (HPP)', category: AccountCategory.EXPENSE, isSystem: true },
  { id: 'acc-beban-obat', code: '5102', name: 'Beban Obat & Vaksin (HPP)', category: AccountCategory.EXPENSE, isSystem: true },
  { id: 'acc-beban-gaji', code: '5201', name: 'Beban Gaji & Upah', category: AccountCategory.EXPENSE, isSystem: true },
  { id: 'acc-beban-listrik', code: '5202', name: 'Beban Listrik & Air', category: AccountCategory.EXPENSE, isSystem: true },
  { id: 'acc-beban-penyisihan', code: '5301', name: 'Beban Penyisihan Dana Cadangan', category: AccountCategory.EXPENSE, isSystem: true },
  { id: 'acc-beban-penyusutan', code: '5401', name: 'Beban Penyusutan Aset', category: AccountCategory.EXPENSE, isSystem: true },
  { id: 'acc-beban-lain', code: '5999', name: 'Beban Operasional Lainnya', category: AccountCategory.EXPENSE, isSystem: true },
];