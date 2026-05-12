import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  EggCategory,
  ItemType,
  MortalityCause,
  type InventoryItem,
  type MortalityRecord,
  type FlockAnalytics,
  type FarmSettings,
  DEFAULT_FARM_SETTINGS,
  type Asset,
  AssetCondition,
  AccountCategory,
  type Account,
  type JournalEntry,
  type JournalLine,
  StockMutationType,
  type StockMutation,
  type APARRecord,
  type OperationalExpense,
  type SinkingFundAllocation,
  SinkingFundType,
  PaymentStatus
} from './types';

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface ProductionLog {
  id: string;
  houseId: string;
  date: string;
  eggCount: number;
  feedConsumed: number;          // kg
  feedInventoryItemId: string;   // which inventory item was consumed
  mortality: number;
  mortalityCause?: MortalityCause;
  discardedEggs: number;
  breakdown: Record<string, number>; // EggCategory → butir
  totalButir: number;
  inputTime?: string;            // ISO datetime when record was submitted
  inputBy?: string;              // user name who submitted
}

export interface SalesLog {
  id: string;
  houseId: string;
  date: string;
  category: string;
  quantity: number;
  price: number;
  total: number;
  isFree: boolean;
  customer: string;
}

export interface FinancialTransaction {
  id: string;
  houseId?: string;
  date: string;
  description: string;
  qty: string;
  price: number;
  total: number;
  account: string;
  type: 'INCOME' | 'EXPENSE' | 'MODAL' | 'ASSET' | 'INTERNAL_TRANSFER';
  category?: string;
  journalId?: string; // Link to JournalEntry
  paymentStatus?: PaymentStatus;
}

// Re-export InventoryItem so consumers can import from GlobalContext
export type { InventoryItem };

const DEFAULT_ACCOUNTS: Account[] = [
  { id: 'acc-kas', code: '111', name: 'Kas Tunai', category: AccountCategory.ASSET, isCashOrBank: true },
  { id: 'acc-bca', code: '112', name: 'Bank BCA', category: AccountCategory.ASSET, isCashOrBank: true },
  { id: 'acc-mandiri', code: '113', name: 'Bank Mandiri', category: AccountCategory.ASSET, isCashOrBank: true },
  { id: 'acc-piutang', code: '114', name: 'Piutang Usaha', category: AccountCategory.ASSET },
  { id: 'acc-persediaan', code: '115', name: 'Persediaan Gudang', category: AccountCategory.ASSET },
  { id: 'acc-hutang', code: '211', name: 'Hutang Usaha', category: AccountCategory.LIABILITY },
  { id: 'acc-modal', code: '311', name: 'Modal Pemilik', category: AccountCategory.EQUITY },
  { id: 'acc-penjualan', code: '411', name: 'Pendapatan Penjualan', category: AccountCategory.REVENUE },
  { id: 'acc-pendapatan-lain', code: '412', name: 'Pendapatan Lain-lain', category: AccountCategory.REVENUE },
  { id: 'acc-beban-pakan', code: '511', name: 'Beban Pakan', category: AccountCategory.EXPENSE },
  { id: 'acc-beban-gaji', code: '512', name: 'Beban Gaji', category: AccountCategory.EXPENSE },
  { id: 'acc-beban-listrik', code: '513', name: 'Beban Listrik', category: AccountCategory.EXPENSE },
  { id: 'acc-beban-ops', code: '514', name: 'Beban Operasional Lainnya', category: AccountCategory.EXPENSE },
  { id: 'acc-sinking-fund', code: '312', name: 'Dana Cadangan (Sinking Fund)', category: AccountCategory.EQUITY },
  { id: 'acc-akum-penyusutan', code: '116', name: 'Akumulasi Penyusutan', category: AccountCategory.ASSET }, // Contra asset
  { id: 'acc-beban-penyusutan', code: '515', name: 'Beban Penyusutan', category: AccountCategory.EXPENSE },
];

// ─── Default Inventory Data ───────────────────────────────────────────────────

const DEFAULT_INVENTORY: InventoryItem[] = [
  // Raw Materials
  { id: 'inv-rm-1', name: 'Jagung Giling',        type: ItemType.RAW_MATERIAL,  quantity: 1500, unit: 'kg', reorderPoint: 200, lastPrice: 4500 },
  { id: 'inv-rm-2', name: 'Bekatul (Dedak)',       type: ItemType.RAW_MATERIAL,  quantity: 800,  unit: 'kg', reorderPoint: 150, lastPrice: 2800 },
  { id: 'inv-rm-3', name: 'Konsentrat Layer',      type: ItemType.RAW_MATERIAL,  quantity: 600,  unit: 'kg', reorderPoint: 250, lastPrice: 12000 },
  { id: 'inv-rm-4', name: 'Bungkil Kedelai (SBM)', type: ItemType.RAW_MATERIAL,  quantity: 400,  unit: 'kg', reorderPoint: 100, lastPrice: 9000 },
  // Finished Feed
  { id: 'inv-ff-1', name: 'Pakan Jadi Layer Mix',  type: ItemType.FINISHED_FEED, quantity: 0,    unit: 'kg', reorderPoint: 500, lastPrice: 0 },
  // Egg Stock — one per category
  { id: 'inv-egg-BM',       name: 'Stok Telur Remban',    type: ItemType.EGG_STOCK, quantity: 0, unit: 'butir', reorderPoint: 0, lastPrice: 0, eggCategory: EggCategory.BM },
  { id: 'inv-egg-KRC',      name: 'Stok Telur Bujang',    type: ItemType.EGG_STOCK, quantity: 0, unit: 'butir', reorderPoint: 0, lastPrice: 0, eggCategory: EggCategory.KRC },
  { id: 'inv-egg-KS',       name: 'Stok Telur KS',        type: ItemType.EGG_STOCK, quantity: 0, unit: 'butir', reorderPoint: 0, lastPrice: 0, eggCategory: EggCategory.KS },
  { id: 'inv-egg-PELOR',    name: 'Stok Telur Pelor',     type: ItemType.EGG_STOCK, quantity: 0, unit: 'butir', reorderPoint: 0, lastPrice: 0, eggCategory: EggCategory.PELOR },
  { id: 'inv-egg-RETAK',    name: 'Stok Telur Retak',     type: ItemType.EGG_STOCK, quantity: 0, unit: 'butir', reorderPoint: 0, lastPrice: 0, eggCategory: EggCategory.RETAK },
  { id: 'inv-egg-PECAH',    name: 'Stok Telur Pecah',     type: ItemType.EGG_STOCK, quantity: 0, unit: 'butir', reorderPoint: 0, lastPrice: 0, eggCategory: EggCategory.PECAH },
  { id: 'inv-egg-KRC_RETAK',name: 'Stok Telur Bujang Retak', type: ItemType.EGG_STOCK, quantity: 0, unit: 'butir', reorderPoint: 0, lastPrice: 0, eggCategory: EggCategory.KRC_RETAK },
  { id: 'inv-egg-KS_RETAK', name: 'Stok Telur KS Retak',  type: ItemType.EGG_STOCK, quantity: 0, unit: 'butir', reorderPoint: 0, lastPrice: 0, eggCategory: EggCategory.KS_RETAK },
  // Medicine
  { id: 'inv-med-1', name: 'Vitamin C',           type: ItemType.MEDICINE, quantity: 10,  unit: 'botol', reorderPoint: 2, lastPrice: 25000 },
  { id: 'inv-med-2', name: 'Vaksin Newcastle',    type: ItemType.VACCINE,  quantity: 5,   unit: 'vial',  reorderPoint: 1, lastPrice: 75000 },
];

const DEFAULT_RECIPES = [
  {
    id: 'rcp-1',
    name: 'Ransum Layer Umur 30–50 Minggu',
    targetFcr: 2.10,
    outputInventoryItemId: 'inv-ff-1',
    ingredients: [
      { inventoryItemId: 'inv-rm-1', percentage: 50 },
      { inventoryItemId: 'inv-rm-2', percentage: 18 },
      { inventoryItemId: 'inv-rm-3', percentage: 30 },
      { inventoryItemId: 'inv-rm-4', percentage: 2 },
    ],
  },
];

// ─── Context Type ─────────────────────────────────────────────────────────────

interface GlobalContextType {
  // State
  productionLogs: ProductionLog[];
  salesLogs: SalesLog[];
  transactions: FinancialTransaction[];
  inventory: InventoryItem[];
  mortalityRecords: MortalityRecord[];
  recipes: any[];
  accounts: Account[];
  journalEntries: JournalEntry[];
  journalLines: JournalLine[];
  stockMutations: StockMutation[];
  apArRecords: APARRecord[];
  operationalExpenses: OperationalExpense[];
  sinkingFundAllocations: SinkingFundAllocation[];

  // Actions
  saveProduction: (log: Omit<ProductionLog, 'id'>) => void;
  saveSale: (sale: Omit<SalesLog, 'id'>, targetAccountId?: string) => void;
  addTransaction: (tx: Omit<FinancialTransaction, 'id'>) => string;
  deleteTransaction: (id: string) => void;
  updateTransaction: (id: string, updates: Partial<FinancialTransaction>) => void;
  updateInventory: (id: string, delta: number) => void;
  addInventoryItem: (item: Omit<InventoryItem, 'id'>) => void;
  updateInventoryItem: (id: string, updates: Partial<InventoryItem>) => void;
  createStockMutation: (mutation: Omit<StockMutation, 'id' | 'totalCost'>) => void;
  addJournalEntry: (entry: Omit<JournalEntry, 'id'>, lines: Omit<JournalLine, 'id' | 'journalId'>[]) => string;
  addAPARRecord: (record: Omit<APARRecord, 'id' | 'createdAt'>) => void;
  updateAPARRecord: (id: string, paymentAmount: number, paymentAccountId?: string, notes?: string) => void;
  createOperationalExpense: (tx: Omit<FinancialTransaction, 'id' | 'type'>, accountId: string, paymentAccountId: string) => void;
  addOperationalExpenseRecord: (expense: Omit<OperationalExpense, 'id'>) => void;
  realizeSinkingFund: (amount: number, type: SinkingFundType, notes?: string) => void;
  addRecipe: (recipe: any) => void;
  updateRecipe: (id: string, updates: any) => void;
  deleteRecipe: (id: string) => void;
  getHDP: (houseId: string, date: string, currentCount: number) => number;
  getCumulativeFCR: (houseId: string) => number;
  getFeedIntakePerBird: (houseId: string, currentCount: number) => number;
  getFlockAnalytics: (houseId: string, currentCount: number) => FlockAnalytics;
  getAccountBalance: (accountId: string) => { debit: number; credit: number; balance: number };
  getTrialBalance: () => { accountId: string; name: string; code: string; category: AccountCategory; debit: number; credit: number }[];
  farmSettings: FarmSettings;
  saveFarmSettings: (settings: Partial<FarmSettings>) => void;
  addModalAwal: (amount: number, description?: string, houseId?: string, targetAccountId?: string) => void;
  assets: Asset[];
  addAsset: (asset: Omit<Asset, 'id' | 'maintenanceHistory'>) => void;
  updateAsset: (id: string, updates: Partial<Asset>) => void;
  updateAssetStatus: (id: string, status: AssetCondition, user: string, notes?: string) => void;
  addAccount: (account: Omit<Account, 'id'>) => void;
  updateAccount: (id: string, account: Partial<Account>) => void;
  deleteAccount: (id: string) => void;
}

const GlobalContext = createContext<GlobalContextType | undefined>(undefined);

// ─── Provider ─────────────────────────────────────────────────────────────────

export const GlobalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [productionLogs, setProductionLogs] = useState<ProductionLog[]>(() => {
    const s = localStorage.getItem('poultry_prod_logs');
    let loaded = s ? JSON.parse(s) : [];
    loaded = loaded.map((log: any) => {
       if (!log.breakdown) return log;
       const newBreakdown = { ...log.breakdown };
       if (newBreakdown['BM'] !== undefined) { newBreakdown['Remban'] = newBreakdown['BM']; delete newBreakdown['BM']; }
       if (newBreakdown['KRC'] !== undefined) { newBreakdown['Bujang'] = newBreakdown['KRC']; delete newBreakdown['KRC']; }
       if (newBreakdown['KRC Retak'] !== undefined) { newBreakdown['Bujang Retak'] = newBreakdown['KRC Retak']; delete newBreakdown['KRC Retak']; }
       if (newBreakdown['PELOR'] !== undefined) { newBreakdown['Pelor'] = newBreakdown['PELOR']; delete newBreakdown['PELOR']; }
       if (newBreakdown['RETAK'] !== undefined) { newBreakdown['Retak'] = newBreakdown['RETAK']; delete newBreakdown['RETAK']; }
       if (newBreakdown['PECAH'] !== undefined) { newBreakdown['Pecah'] = newBreakdown['PECAH']; delete newBreakdown['PECAH']; }
       return { ...log, breakdown: newBreakdown };
    });
    return loaded;
  });
  const [salesLogs, setSalesLogs] = useState<SalesLog[]>(() => {
    const s = localStorage.getItem('poultry_sales_logs');
    return s ? JSON.parse(s) : [];
  });
  const [transactions, setTransactions] = useState<FinancialTransaction[]>(() => {
    const s = localStorage.getItem('poultry_transactions');
    return s ? JSON.parse(s) : [
      { id: 'tx-init-1', date: '2026-03-01', description: 'Modal Awal', qty: '1', price: 250000000, total: 250000000, account: 'Mandiri', type: 'MODAL' },
    ];
  });
  const [inventory, setInventory] = useState<InventoryItem[]>(() => {
    const s = localStorage.getItem('poultry_inventory_v2');
    let loaded = s ? JSON.parse(s) : DEFAULT_INVENTORY;
    loaded = loaded.map((item: any) => {
       if (item.eggCategory === 'BM') return { ...item, eggCategory: 'Remban', name: item.name.replace('BM', 'Remban') };
       if (item.eggCategory === 'KRC') return { ...item, eggCategory: 'Bujang', name: item.name.replace('KRC', 'Bujang') };
       if (item.eggCategory === 'KRC Retak') return { ...item, eggCategory: 'Bujang Retak', name: item.name.replace('KRC', 'Bujang') };
       if (item.eggCategory === 'PELOR') return { ...item, eggCategory: 'Pelor' };
       if (item.eggCategory === 'RETAK') return { ...item, eggCategory: 'Retak' };
       if (item.eggCategory === 'PECAH') return { ...item, eggCategory: 'Pecah' };
       return item;
    });
    return loaded;
  });
  const [mortalityRecords, setMortalityRecords] = useState<MortalityRecord[]>(() => {
    const s = localStorage.getItem('poultry_mortality');
    return s ? JSON.parse(s) : [];
  });
  const [recipes, setRecipes] = useState<any[]>(() => {
    const s = localStorage.getItem('poultry_recipes');
    return s ? JSON.parse(s) : DEFAULT_RECIPES;
  });
  const [farmSettings, setFarmSettings] = useState<FarmSettings>(() => {
    const s = localStorage.getItem('poultry_farm_settings');
    return s ? { ...DEFAULT_FARM_SETTINGS, ...JSON.parse(s) } : DEFAULT_FARM_SETTINGS;
  });
  const [assets, setAssets] = useState<Asset[]>(() => {
    const s = localStorage.getItem('poultry_assets');
    return s ? JSON.parse(s) : [
      { id: 'ast-1', name: 'Mesin Giling Pakan', category: 'ALAT PRODUKSI', purchaseDate: '2025-01-10', purchasePrice: 12000000, expectedLifeYears: 5, condition: AssetCondition.BAIK, maintenanceHistory: [] },
      { id: 'ast-2', name: 'Bentor Pengangkut', category: 'KENDARAAN', purchaseDate: '2024-06-15', purchasePrice: 24500000, expectedLifeYears: 4, condition: AssetCondition.SERVIS, maintenanceHistory: [] },
      { id: 'ast-3', name: 'Timbangan Digital', category: 'ALAT PRODUKSI', purchaseDate: '2026-02-20', purchasePrice: 850000, expectedLifeYears: 2, condition: AssetCondition.BAIK, maintenanceHistory: [] },
      { id: 'ast-4', name: 'Pompa Air Jetpump', category: 'LAINNYA', purchaseDate: '2025-11-05', purchasePrice: 3200000, expectedLifeYears: 3, condition: AssetCondition.BAIK, maintenanceHistory: [] },
    ];
  });
  
  // Accounting and New Models
  const [accounts, setAccounts] = useState<Account[]>(() => {
    const s = localStorage.getItem('poultry_accounts');
    return s ? JSON.parse(s) : DEFAULT_ACCOUNTS;
  });
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>(() => {
    const s = localStorage.getItem('poultry_journals');
    return s ? JSON.parse(s) : [];
  });
  const [journalLines, setJournalLines] = useState<JournalLine[]>(() => {
    const s = localStorage.getItem('poultry_journal_lines');
    return s ? JSON.parse(s) : [];
  });
  const [stockMutations, setStockMutations] = useState<StockMutation[]>(() => {
    const s = localStorage.getItem('poultry_stock_mutations');
    return s ? JSON.parse(s) : [];
  });
  const [apArRecords, setApArRecords] = useState<APARRecord[]>(() => {
    const s = localStorage.getItem('poultry_apar');
    const loaded = s ? JSON.parse(s) : [];
    // Migration: ensure paymentHistory exists
    return loaded.map((r: any) => ({ paymentHistory: [], ...r }));
  });
  const [operationalExpenses, setOperationalExpenses] = useState<OperationalExpense[]>(() => {
    const s = localStorage.getItem('poultry_op_expenses');
    return s ? JSON.parse(s) : [];
  });
  const [sinkingFundAllocations, setSinkingFundAllocations] = useState<SinkingFundAllocation[]>(() => {
    const s = localStorage.getItem('poultry_sinking_fund');
    return s ? JSON.parse(s) : [];
  });

  useEffect(() => { localStorage.setItem('poultry_prod_logs', JSON.stringify(productionLogs)); }, [productionLogs]);
  useEffect(() => { localStorage.setItem('poultry_sales_logs', JSON.stringify(salesLogs)); }, [salesLogs]);
  useEffect(() => { localStorage.setItem('poultry_transactions', JSON.stringify(transactions)); }, [transactions]);
  useEffect(() => { localStorage.setItem('poultry_inventory_v2', JSON.stringify(inventory)); }, [inventory]);
  useEffect(() => { localStorage.setItem('poultry_mortality', JSON.stringify(mortalityRecords)); }, [mortalityRecords]);
  useEffect(() => { localStorage.setItem('poultry_recipes', JSON.stringify(recipes)); }, [recipes]);
  useEffect(() => { localStorage.setItem('poultry_farm_settings', JSON.stringify(farmSettings)); }, [farmSettings]);
  useEffect(() => { localStorage.setItem('poultry_assets', JSON.stringify(assets)); }, [assets]);
  useEffect(() => { localStorage.setItem('poultry_accounts', JSON.stringify(accounts)); }, [accounts]);
  useEffect(() => { localStorage.setItem('poultry_journals', JSON.stringify(journalEntries)); }, [journalEntries]);
  useEffect(() => { localStorage.setItem('poultry_journal_lines', JSON.stringify(journalLines)); }, [journalLines]);
  useEffect(() => { localStorage.setItem('poultry_stock_mutations', JSON.stringify(stockMutations)); }, [stockMutations]);
  useEffect(() => { localStorage.setItem('poultry_apar', JSON.stringify(apArRecords)); }, [apArRecords]);
  useEffect(() => { localStorage.setItem('poultry_op_expenses', JSON.stringify(operationalExpenses)); }, [operationalExpenses]);
  useEffect(() => { localStorage.setItem('poultry_sinking_fund', JSON.stringify(sinkingFundAllocations)); }, [sinkingFundAllocations]);

  // ─── Actions ───────────────────────────────────────────────────────────────

  const updateInventory = (id: string, delta: number) => {
    setInventory(prev => prev.map(item =>
      item.id === id ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item
    ));
  };

  const addInventoryItem = (itemData: Omit<InventoryItem, 'id'>) => {
    setInventory(prev => [...prev, { ...itemData, id: `inv-${Date.now()}` }]);
  };

  const updateInventoryItem = (id: string, updates: Partial<InventoryItem>) => {
    setInventory(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  };
  
  const createStockMutation = (mutation: Omit<StockMutation, 'id' | 'totalCost'>) => {
    setStockMutations(prev => [...prev, { ...mutation, id: `mut-${Date.now()}`, totalCost: mutation.quantity * mutation.unitCost }]);
  };
  
  // ─── Accounting Actions ──────────────────────────────────────────────────────
  const addJournalEntry = (entry: Omit<JournalEntry, 'id'>, lines: Omit<JournalLine, 'id' | 'journalId'>[]) => {
    const journalId = `jrn-${Date.now()}`;
    setJournalEntries(prev => [...prev, { ...entry, id: journalId }]);
    setJournalLines(prev => [
      ...prev,
      ...lines.map((line, idx) => ({ ...line, id: `jline-${Date.now()}-${idx}`, journalId }))
    ]);
    return journalId;
  };

  const addAPARRecord = (record: Omit<APARRecord, 'id' | 'createdAt'>) => {
    setApArRecords(prev => [...prev, { ...record, id: `apar-${Date.now()}`, createdAt: new Date().toISOString() }]);
  };

  const updateAPARRecord = (id: string, paymentAmount: number, paymentAccountId?: string, notes?: string) => {
    setApArRecords(prev => prev.map(r => {
      if (r.id === id) {
        const newRemaining = Math.max(0, r.remainingAmount - paymentAmount);
        const newStatus = newRemaining === 0 ? 'CLOSED' : 'PARTIAL';
        const paymentEntry = {
          id: `pay-${Date.now()}`,
          date: new Date().toISOString().split('T')[0],
          amount: paymentAmount,
          accountId: paymentAccountId || 'acc-kas',
          notes,
        };
        return {
          ...r,
          remainingAmount: newRemaining,
          status: newStatus,
          paymentHistory: [...(r.paymentHistory || []), paymentEntry],
        };
      }
      return r;
    }));
  };

  // Record a standalone operational expense with full journal entry
  const addOperationalExpenseRecord = (expense: Omit<OperationalExpense, 'id'>) => {
    const journalId = addJournalEntry(
      { date: expense.date, description: expense.description, reference: `OPS-${Date.now()}` },
      [
        { accountId: expense.accountId, debit: expense.amount, credit: 0 },
        { accountId: expense.paymentAccountId, debit: 0, credit: expense.amount },
      ]
    );
    const newExpense: OperationalExpense = { ...expense, id: `opex-${Date.now()}`, journalId };
    setOperationalExpenses(prev => [...prev, newExpense]);
    addTransaction({
      houseId: expense.houseId,
      date: expense.date,
      description: expense.description,
      qty: '1',
      price: expense.amount,
      total: expense.amount,
      account: accounts.find(a => a.id === expense.paymentAccountId)?.name || 'Kas',
      type: 'EXPENSE',
      category: expense.category,
      journalId,
    });
  };

  // Realize sinking fund allocation — moves retained earnings to reserve fund
  const realizeSinkingFund = (amount: number, type: SinkingFundType, notes?: string) => {
    const journalId = addJournalEntry(
      { date: new Date().toISOString().split('T')[0], description: `Penyisihan Sinking Fund: ${type}`, reference: `SF-${Date.now()}` },
      [
        { accountId: 'acc-modal', debit: amount, credit: 0 },
        { accountId: 'acc-sinking-fund', debit: 0, credit: amount },
      ]
    );
    const allocation: SinkingFundAllocation = {
      id: `sf-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      type,
      amount,
      notes,
      journalId,
    };
    setSinkingFundAllocations(prev => [...prev, allocation]);
  };

  // Compute debit/credit balance for a single account from journal lines
  const getAccountBalance = (accountId: string) => {
    const lines = journalLines.filter(l => l.accountId === accountId);
    const debit = lines.reduce((s, l) => s + l.debit, 0);
    const credit = lines.reduce((s, l) => s + l.credit, 0);
    const acc = accounts.find(a => a.id === accountId);
    // Assets/Expenses: normal debit balance. Liabilities/Equity/Revenue: normal credit balance.
    const isDebitNormal = acc?.category === AccountCategory.ASSET || acc?.category === AccountCategory.EXPENSE;
    const balance = isDebitNormal ? debit - credit : credit - debit;
    return { debit, credit, balance };
  };

  // Trial balance: aggregate all accounts
  const getTrialBalance = () => {
    return accounts.map(acc => {
      const { debit, credit } = getAccountBalance(acc.id);
      return { accountId: acc.id, name: acc.name, code: acc.code, category: acc.category, debit, credit };
    }).filter(row => row.debit > 0 || row.credit > 0);
  };

  const createOperationalExpense = (tx: Omit<FinancialTransaction, 'id' | 'type'>, accountId: string, paymentAccountId: string) => {
    const journalId = addJournalEntry(
      { date: tx.date, description: tx.description, reference: `TRX-OPS-${Date.now()}` },
      [
        { accountId, debit: tx.total, credit: 0 },
        { accountId: paymentAccountId, debit: 0, credit: tx.total }
      ]
    );
    addTransaction({ ...tx, type: 'EXPENSE', journalId, paymentStatus: PaymentStatus.LUNAS });
  };

  const addTransaction = (txData: Omit<FinancialTransaction, 'id'>): string => {
    const id = `tx-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    setTransactions(prev => [...prev, { ...txData, id }]);
    return id;
  };

  const deleteTransaction = (id: string) => {
    setTransactions(prev => prev.filter(tx => tx.id !== id));
  };


  const updateTransaction = (id: string, updates: Partial<FinancialTransaction>) => {
    setTransactions(prev => prev.map(tx => tx.id === id ? { ...tx, ...updates } : tx));
  };

  /** FIX #1 + #2 + #4: saveProduction now deducts feed, increments egg stock, and logs mortality */
  const saveProduction = (logData: Omit<ProductionLog, 'id'>) => {
    const newLog = { ...logData, id: `prod-${Date.now()}` };
    setProductionLogs(prev => [...prev, newLog]);

    // FIX #1: Deduct the selected feed inventory item
    if (logData.feedInventoryItemId && logData.feedConsumed > 0) {
      updateInventory(logData.feedInventoryItemId, -logData.feedConsumed);
      const item = inventory.find(i => i.id === logData.feedInventoryItemId);
      if (item) {
        const totalCost = logData.feedConsumed * item.lastPrice;
        createStockMutation({
          date: logData.date,
          itemId: item.id,
          type: StockMutationType.USAGE,
          quantity: logData.feedConsumed,
          unitCost: item.lastPrice,
          sourceLocation: logData.houseId,
          reference: `Prod Feed: ${newLog.id}`
        });

        // 1. Catat Hutang Kandang ke Pusat
        addAPARRecord({
          type: 'HUTANG',
          entityName: `Pusat (Internal)`,
          description: `Pemakaian Pakan Kandang ${logData.houseId}`,
          amount: totalCost,
          remainingAmount: totalCost,
          dueDate: new Date().toISOString().split('T')[0],
          status: 'OPEN',
          relatedTransactionId: newLog.id,
          paymentHistory: []
        });

        // 2. Catat Piutang Pusat dari Kandang
        addAPARRecord({
          type: 'PIUTANG',
          entityName: `Kandang ${logData.houseId} (Internal)`,
          description: `Pemakaian Pakan Kandang ${logData.houseId}`,
          amount: totalCost,
          remainingAmount: totalCost,
          dueDate: new Date().toISOString().split('T')[0],
          status: 'OPEN',
          relatedTransactionId: newLog.id,
          paymentHistory: []
        });

        // 3. Catat Biaya Operasional (Pakan) untuk Kandang
        addTransaction({
          houseId: logData.houseId,
          date: logData.date,
          description: `Biaya Pemakaian Pakan Produksi`,
          qty: `${logData.feedConsumed} ${item.unit}`,
          price: item.lastPrice,
          total: totalCost,
          account: 'Hutang Internal',
          type: 'EXPENSE',
          category: 'Pakan',
        });
      }
    }

    // FIX #2: Auto-increment each egg category stock (Scoped per house)
    Object.entries(logData.breakdown).forEach(([category, count]) => {
      // Do not add 'PECAH' and 'RETAK' to sellable stock if not desired, 
      // but according to previous logic they were added. We'll add them but keep track.
      // Or we can add them to warehouse 'CENTRAL' by default. Let's keep existing logic but add mutation.
      if (count > 0 && category !== EggCategory.PECAH) {
        setInventory(prev => {
          const existing = prev.find(item => item.type === ItemType.EGG_STOCK && item.eggCategory === category && item.houseId === logData.houseId);
          if (existing) {
            return prev.map(item => item.id === existing.id ? { ...item, quantity: item.quantity + count, houseId: logData.houseId } : item);
          } else {
            return [...prev, {
              id: `inv-egg-${logData.houseId}-${category}-${Date.now()}`,
              houseId: logData.houseId,
              name: `Stok Telur ${category}`,
              type: ItemType.EGG_STOCK,
              quantity: count,
              unit: 'butir',
              reorderPoint: 0,
              lastPrice: 0,
              eggCategory: category as EggCategory
            }];
          }
        });
        
        // Add production mutation
        setTimeout(() => {
            const currentInventory = JSON.parse(localStorage.getItem('poultry_inventory_v2') || '[]');
            const existingItem = currentInventory.find((item: any) => item.type === ItemType.EGG_STOCK && item.eggCategory === category && item.houseId === logData.houseId);
            if (existingItem) {
                createStockMutation({
                    date: logData.date,
                    itemId: existingItem.id,
                    type: StockMutationType.PRODUCTION,
                    quantity: count,
                    unitCost: 0, // Generated internally
                    sourceLocation: logData.houseId,
                    reference: `Prod: ${newLog.id}`
                });
            }
        }, 100);
      }
    });

    // FIX #4: Save mortality record if applicable
    if (logData.mortality > 0) {
      const mortalityRecord: MortalityRecord = {
        id: `mort-${Date.now()}`,
        houseId: logData.houseId,
        date: logData.date,
        count: logData.mortality,
        cause: logData.mortalityCause || MortalityCause.OTHER,
        productionLogId: newLog.id,
      };
      setMortalityRecords(prev => [...prev, mortalityRecord]);
    }
  };

  const saveSale = (saleData: Omit<SalesLog, 'id'>, targetAccountId?: string) => {
    const newSale = { ...saleData, id: `sale-${Date.now()}` };
    setSalesLogs(prev => [...prev, newSale]);

    // Always deduct from inventory for both paid and free sales
    setInventory(prev => prev.map(item => {
      if (item.type === ItemType.EGG_STOCK && item.eggCategory === saleData.category && item.houseId === saleData.houseId) {
        return { ...item, quantity: Math.max(0, item.quantity - saleData.quantity) };
      }
      return item;
    }));

    const selectedAcc = accounts.find(a => a.id === targetAccountId) || accounts.find(a => a.isCashOrBank) || accounts[0];

    const txId = addTransaction({
      houseId: saleData.houseId,
      date: saleData.date,
      description: saleData.isFree 
        ? `Alokasi Telur Gratis: ${saleData.category} - ${saleData.customer || 'Umum'}`
        : `Penjualan Telur: ${saleData.category} - ${saleData.customer || 'Umum'}`,
      qty: `${saleData.quantity} butir`,
      price: saleData.isFree ? 0 : saleData.price,
      total: saleData.isFree ? 0 : saleData.total,
      account: saleData.isFree ? 'Persediaan' : selectedAcc.name,
      type: 'INCOME',
      category: saleData.isFree ? 'Free Goods' : 'Penjualan'
    });

    // Create journal entry if it's a paid sale
    if (!saleData.isFree && saleData.total > 0) {
      const journalId = `j-${Date.now()}`;
      setJournalEntries(prev => [...prev, {
        id: journalId,
        date: saleData.date,
        description: `Penjualan Telur: ${saleData.category}`,
        reference: txId
      }]);

      setJournalLines(prev => [
        ...prev,
        { id: `jl-${Date.now()}-1`, journalId, accountId: selectedAcc.id, debit: saleData.total, credit: 0 },
        { id: `jl-${Date.now()}-2`, journalId, accountId: 'acc-penjualan', debit: 0, credit: saleData.total }
      ]);
    }
  };

  // Recipe CRUD
  const addRecipe = (r: any) => setRecipes(prev => [...prev, { ...r, id: `rcp-${Date.now()}` }]);
  const updateRecipe = (id: string, updates: any) => setRecipes(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
  const deleteRecipe = (id: string) => setRecipes(prev => prev.filter(r => r.id !== id));

  // ─── Computed Analytics ────────────────────────────────────────────────────

  /** HDP % for a specific house/date */
  const getHDP = (houseId: string, date: string, currentCount: number): number => {
    const log = productionLogs.find(p => p.houseId === houseId && p.date === date);
    if (!log || currentCount === 0) return 0;
    return (log.eggCount / currentCount) * 100;
  };

  /** Cumulative FCR = total feed consumed / total egg kg for a house */
  const getCumulativeFCR = (houseId: string): number => {
    const logs = productionLogs.filter(p => p.houseId === houseId);
    const totalFeed = logs.reduce((a, b) => a + b.feedConsumed, 0);
    const totalButir = logs.reduce((a, b) => a + b.totalButir, 0);
    if (totalButir === 0) return 0;
    return totalFeed / totalButir;
  };

  /** Average feed intake per bird per day (grams), based on most recent log */
  const getFeedIntakePerBird = (houseId: string, currentCount: number): number => {
    const logs = productionLogs.filter(p => p.houseId === houseId);
    if (logs.length === 0 || currentCount === 0) return 0;
    const lastLog = logs[logs.length - 1];
    return (lastLog.feedConsumed * 1000) / currentCount;
  };

  /** Full analytics bundle for a flock */
  const getFlockAnalytics = (houseId: string, currentCount: number): FlockAnalytics => {
    const logs = productionLogs.filter(p => p.houseId === houseId);
    const totalFeed = logs.reduce((a, b) => a + b.feedConsumed, 0);
    const totalButir = logs.reduce((a, b) => a + b.totalButir, 0);
    const cumulativeFCR = totalButir > 0 ? totalFeed / totalButir : 0;

    // Estimate feed cost from inventory lastPrice
    const totalFeedCost = logs.reduce((acc, log) => {
      const item = inventory.find(i => i.id === log.feedInventoryItemId);
      return acc + (item ? log.feedConsumed * item.lastPrice : 0);
    }, 0);

    const hppPerButir = totalButir > 0 ? totalFeedCost / totalButir : 0;

    const totalIncome = salesLogs
      .filter(s => s.houseId === houseId && !s.isFree)
      .reduce((a, b) => a + b.total, 0);
    const netPL = totalIncome - totalFeedCost;

    return {
      houseId,
      cumulativeFCR,
      feedIntakePerBirdGrams: getFeedIntakePerBird(houseId, currentCount),
      hppPerButir,
      totalButir,
      totalFeedCost,
      netPL,
    };
  };

  const saveFarmSettings = (settings: Partial<FarmSettings>) => {
    setFarmSettings(prev => ({ ...prev, ...settings }));
  };

  const addModalAwal = (amount: number, description = 'Modal Awal', houseId?: string, targetAccountId: string = 'acc-kas') => {
    const txId = `tx-${Date.now()}`;
    const targetAccount = accounts.find(a => a.id === targetAccountId) || accounts[0];
    
    // Create Journal Entry
    const journalId = addJournalEntry({
      date: new Date().toISOString().split('T')[0],
      reference: `MODAL-${Date.now()}`,
      description: `Suntikan Modal: ${description}`,
    }, [
      { accountId: targetAccount.id, debit: amount, credit: 0 },
      { accountId: 'acc-modal', debit: 0, credit: amount }
    ]);

    addTransaction({
      houseId,
      date: new Date().toISOString().split('T')[0],
      description,
      qty: '1',
      price: amount,
      total: amount,
      account: targetAccount.name,
      type: 'MODAL',
      journalId
    });
    saveFarmSettings({ initialCapital: farmSettings.initialCapital + amount });
  };

  const addAccount = (accountData: Omit<Account, 'id'>) => {
    setAccounts(prev => [...prev, { ...accountData, id: `acc-${Date.now()}` }]);
  };

  const updateAccount = (id: string, updates: Partial<Account>) => {
    setAccounts(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
  };

  const deleteAccount = (id: string) => {
    setAccounts(prev => prev.filter(a => a.id !== id));
  };

  const addAsset = (assetData: Omit<Asset, 'id' | 'maintenanceHistory'>) => {
    setAssets(prev => [...prev, { ...assetData, id: `ast-${Date.now()}`, maintenanceHistory: [] }]);
  };

  const updateAsset = (id: string, updates: Partial<Asset>) => {
    setAssets(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
  };

  const updateAssetStatus = (id: string, status: AssetCondition, user: string, notes?: string) => {
    setAssets(prev => prev.map(asset => {
      if (asset.id === id) {
        return {
          ...asset,
          condition: status,
          maintenanceHistory: [
            { date: new Date().toISOString(), status, user, notes },
            ...asset.maintenanceHistory
          ]
        };
      }
      return asset;
    }));
  };

  return (
    <GlobalContext.Provider value={{
      productionLogs, salesLogs, transactions, inventory, mortalityRecords, recipes,
      accounts, journalEntries, journalLines, stockMutations, apArRecords,
      operationalExpenses, sinkingFundAllocations,
      saveProduction, saveSale, addTransaction, updateTransaction, deleteTransaction,
      updateInventory, addInventoryItem, updateInventoryItem, createStockMutation,
      addJournalEntry, addAPARRecord, updateAPARRecord, createOperationalExpense,
      addOperationalExpenseRecord, realizeSinkingFund,
      getAccountBalance, getTrialBalance,
      addRecipe, updateRecipe, deleteRecipe,
      getHDP, getCumulativeFCR, getFeedIntakePerBird, getFlockAnalytics,
      farmSettings, saveFarmSettings, addModalAwal,
      assets, addAsset, updateAsset, updateAssetStatus,
      addAccount, updateAccount, deleteAccount,
    }}>
      {children}
    </GlobalContext.Provider>
  );
};

export const useGlobalData = () => {
  const ctx = useContext(GlobalContext);
  if (!ctx) throw new Error('useGlobalData must be used within a GlobalProvider');
  return ctx;
};
