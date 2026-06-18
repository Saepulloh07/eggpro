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
  type BiosecurityRecord,
  type OperationalExpense,
  type SinkingFundAllocation,
  SinkingFundType,
  PaymentStatus,
  DEFAULT_ACCOUNTS,
  type APARPayment,
  type CostAllocation,
  type BankReconciliation
} from './types';
import { generateUUID } from './lib/uuid';
import Swal from 'sweetalert2';

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface ProductionLog {
  id: string;
  houseId: string;
  date: string;
  eggCount: number;
  eggWeight?: number;            // kg
  abnormalEggCount?: number;     // butir
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
  paymentMethod?: 'CASH' | 'PIUTANG';
  dueDate?: string;
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

import { syncToDb, syncRecord, deleteRecord, loadFromDbOrIndexedDB } from './syncUtils';

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
  biosecurityRecords: BiosecurityRecord[];
  operationalExpenses: OperationalExpense[];
  sinkingFundAllocations: SinkingFundAllocation[];
  aparPayments: APARPayment[];
  costAllocations: CostAllocation[];
  bankReconciliations: BankReconciliation[];
  addCostAllocation: (allocation: Omit<CostAllocation, 'id'>) => Promise<void>;
  addBankReconciliation: (reconciliation: Omit<BankReconciliation, 'id'>) => Promise<void>;

  // Actions
  addBiosecurityRecord: (record: Omit<BiosecurityRecord, 'id'>) => void;
  addBiosecurityRecordsBulk: (records: Omit<BiosecurityRecord, 'id'>[]) => void;
  updateBiosecurityRecord: (id: string, updates: Partial<BiosecurityRecord>) => void;
  deleteBiosecurityRecord: (id: string) => void;
  saveProduction: (log: Omit<ProductionLog, 'id'>) => Promise<void>;
  updateProductionLog: (id: string, updates: Partial<ProductionLog>) => Promise<void>;
  saveSale: (sale: Omit<SalesLog, 'id'>, targetAccountId?: string) => Promise<void>;
  addTransaction: (tx: Omit<FinancialTransaction, 'id'>) => Promise<string>;
  deleteTransaction: (id: string) => Promise<void>;
  updateTransaction: (id: string, updates: Partial<FinancialTransaction>) => Promise<void>;
  updateInventory: (id: string, delta: number) => boolean;
  addInventoryItem: (item: Omit<InventoryItem, 'id'>) => Promise<string>;
  updateInventoryItem: (id: string, updates: Partial<InventoryItem>) => Promise<void>;
  createStockMutation: (mutation: Omit<StockMutation, 'id' | 'totalCost'>) => Promise<void>;
  addJournalEntry: (entry: Omit<JournalEntry, 'id'>, lines: Omit<JournalLine, 'id' | 'journalId'>[]) => Promise<string>;
  addAPARRecord: (record: Omit<APARRecord, 'id' | 'createdAt'>) => Promise<void>;
  updateAPARRecord: (id: string, paymentAmount: number, paymentAccountId?: string, notes?: string) => Promise<void>;
  createOperationalExpense: (tx: Omit<FinancialTransaction, 'id' | 'type'>, accountId: string, paymentAccountId: string) => Promise<void>;
  addOperationalExpenseRecord: (expense: Omit<OperationalExpense, 'id'>) => Promise<void>;
  realizeSinkingFund: (amount: number, type: SinkingFundType, notes?: string) => Promise<void>;
  addRecipe: (recipe: any) => Promise<void>;
  updateRecipe: (id: string, updates: any) => Promise<void>;
  deleteRecipe: (id: string) => Promise<void>;
  getHDP: (houseId: string, date: string, currentCount: number) => number;
  getHHP: (houseId: string, initialCount: number, arrivalDate?: string) => number;
  getCumulativeFCR: (houseId: string, arrivalDate?: string) => number;
  getFeedIntakePerBird: (houseId: string, currentCount: number) => number;
  getFlockAnalytics: (houseId: string, currentCount: number, arrivalDate?: string) => FlockAnalytics;
  getAccountBalance: (accountId: string) => { debit: number; credit: number; balance: number };
  getTrialBalance: () => { accountId: string; name: string; code: string; category: AccountCategory; debit: number; credit: number }[];
  farmSettings: FarmSettings;
  saveFarmSettings: (settings: Partial<FarmSettings>) => Promise<void>;
  addModalAwal: (amount: number, description?: string, houseId?: string, targetAccountId?: string) => Promise<void>;
  assets: Asset[];
  addAsset: (asset: Omit<Asset, 'id' | 'maintenanceHistory'>) => Promise<void>;
  updateAsset: (id: string, updates: Partial<Asset>) => void;
  updateAssetStatus: (id: string, status: AssetCondition, user: string, notes?: string) => Promise<void>;
  addAccount: (account: Omit<Account, 'id'>) => void;
  updateAccount: (id: string, account: Partial<Account>) => void;
  deleteAccount: (id: string) => void;
  getHouseCashBalance: (houseId: string) => number;
  addInterHouseTransaction: (fromHouseId: string, toHouseId: string, amount: number, description: string) => Promise<void>;
  addTransferKas: (fromAccountId: string, toAccountId: string, amount: number, date: string, notes: string) => Promise<void>;
  closeMonth: (yearMonth: string, inputBy: string) => Promise<void>;
  refreshData: () => Promise<void>;
  createInterHouseDebt: (debtorHouseId: string, creditorHouseId: string, amount: number, description: string) => Promise<void>;
  suppliers: any[];
  addSupplier: (supplierData: any) => Promise<void>;
  updateSupplier: (id: string, supplierData: any) => Promise<void>;
  deleteSupplier: (id: string) => Promise<void>;
}

const GlobalContext = createContext<GlobalContextType | undefined>(undefined);

// ─── Provider ─────────────────────────────────────────────────────────────────

export const GlobalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [productionLogs, setProductionLogs] = useState<ProductionLog[]>([]);
  const [salesLogs, setSalesLogs] = useState<SalesLog[]>([]);
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [mortalityRecords, setMortalityRecords] = useState<MortalityRecord[]>([]);
  const [recipes, setRecipes] = useState<any[]>([]);
  const [farmSettings, setFarmSettings] = useState<FarmSettings>(DEFAULT_FARM_SETTINGS);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [journalLines, setJournalLines] = useState<JournalLine[]>([]);
  const [stockMutations, setStockMutations] = useState<StockMutation[]>([]);
  const [apArRecords, setApArRecords] = useState<APARRecord[]>([]);
  const [operationalExpenses, setOperationalExpenses] = useState<OperationalExpense[]>([]);
  const [sinkingFundAllocations, setSinkingFundAllocations] = useState<SinkingFundAllocation[]>([]);
  const [biosecurityRecords, setBiosecurityRecords] = useState<BiosecurityRecord[]>([]);
  const [aparPayments, setAparPayments] = useState<APARPayment[]>([]);
  const [costAllocations, setCostAllocations] = useState<CostAllocation[]>([]);
  const [bankReconciliations, setBankReconciliations] = useState<BankReconciliation[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);


  // Removed dangerous useEffect full-syncs to prevent race conditions.
  // We now use incremental sync (syncRecord) within each action.


  const refreshData = async () => {
    await Promise.all([
      loadFromDbOrIndexedDB('poultry_prod_logs', setProductionLogs),
      loadFromDbOrIndexedDB('poultry_sales_logs', setSalesLogs),
      loadFromDbOrIndexedDB('poultry_transactions', setTransactions),
      loadFromDbOrIndexedDB('poultry_inventory_v2', setInventory),
      loadFromDbOrIndexedDB('poultry_mortality', setMortalityRecords),
      loadFromDbOrIndexedDB('poultry_recipes', setRecipes),
      loadFromDbOrIndexedDB('poultry_farm_settings', (data) => setFarmSettings({ ...DEFAULT_FARM_SETTINGS, ...data })),
      loadFromDbOrIndexedDB('poultry_assets', setAssets),
      loadFromDbOrIndexedDB('poultry_accounts', (data) => {
        if (!data || data.length === 0) {
          setAccounts(DEFAULT_ACCOUNTS);
        } else {
          setAccounts(data);
        }
      }),
      loadFromDbOrIndexedDB('poultry_journals', setJournalEntries),
      loadFromDbOrIndexedDB('poultry_journal_lines', setJournalLines),
      loadFromDbOrIndexedDB('poultry_stock_mutations', setStockMutations),
      loadFromDbOrIndexedDB('poultry_apar', setApArRecords),
      loadFromDbOrIndexedDB('poultry_op_expenses', setOperationalExpenses),
      loadFromDbOrIndexedDB('poultry_sinking_fund', setSinkingFundAllocations),
      loadFromDbOrIndexedDB('poultry_biosecurity', setBiosecurityRecords),
      loadFromDbOrIndexedDB('poultry_apar_payments', setAparPayments),
      loadFromDbOrIndexedDB('poultry_cost_allocations', setCostAllocations),
      loadFromDbOrIndexedDB('poultry_bank_reconciliations', setBankReconciliations),
      loadFromDbOrIndexedDB('poultry_suppliers', setSuppliers),
    ]);
  };

  // Load from DB or IndexedDB on mount
  useEffect(() => {
    const init = async () => {
      await refreshData();
      setIsInitialized(true);
    };
    init();
  }, []);



  // ─── Security Helpers ──────────────────────────────────────────────────────
  const isLocked = (date: string) => {
    if (!farmSettings.lastClosingDate) return false;
    return new Date(date) <= new Date(farmSettings.lastClosingDate);
  };

  const checkLockAndSwal = (date: string) => {
    if (isLocked(date)) {
      Swal.fire({
        title: 'Data Terkunci!',
        text: `Periode ini sudah ditutup (Closing Date: ${farmSettings.lastClosingDate}). Data tidak dapat diubah.`,
        icon: 'error',
        confirmButtonColor: '#0f172a'
      });
      return true;
    }
    return false;
  };

  // ─── Actions ───────────────────────────────────────────────────────────────

  const updateInventory = (id: string, delta: number): boolean => {
    let success = false;
    let itemToSync: InventoryItem | undefined;

    setInventory(prev => {
      const next = prev.map(item => {
        if (item.id === id) {
          const newQty = item.quantity + delta;
          if (newQty < 0) {
            console.error(`[Inventory] Insufficient stock for ${item.name}. Required: ${Math.abs(delta)}, Available: ${item.quantity}`);
            return item;
          }
          const updated = { ...item, quantity: newQty };
          itemToSync = updated;
          success = true;
          return updated;
        }
        return item;
      });
      return next;
    });

    // Sync ke DB setelah state update — mencegah stok "reset" saat refresh
    if (itemToSync) {
      syncRecord('poultry_inventory_v2', itemToSync);
    }

    return success;
  };

  // NEW: Professional Inventory Purchase with Moving Average logic
  const addInventoryItem = async (itemData: Omit<InventoryItem, 'id'>): Promise<string> => {
    // Cek item yang sama sudah ada di house yang sama
    const existing = inventory.find(i =>
      i.name.toLowerCase() === itemData.name.toLowerCase() &&
      i.houseId === itemData.houseId &&
      i.type !== ItemType.EGG_STOCK
    );

    if (existing) {
      // Sudah ada: update quantity + hitung harga rata-rata (Moving Average Cost)
      const addQty = itemData.quantity || 0;
      const newQty = existing.quantity + addQty;
      const newPrice = itemData.lastPrice > 0 && addQty > 0
        ? ((existing.lastPrice * existing.quantity) + (itemData.lastPrice * addQty)) / newQty
        : existing.lastPrice;

      const updated: InventoryItem = { ...existing, quantity: newQty, lastPrice: newPrice };
      setInventory(prev => prev.map(i => i.id === existing.id ? updated : i));
      await syncRecord('poultry_inventory_v2', updated);
      return existing.id;
    }

    // Item baru
    const id = generateUUID();
    const newItem: InventoryItem = { ...itemData, id };
    setInventory(prev => [...prev, newItem]);
    await syncRecord('poultry_inventory_v2', newItem);
    return id;
  };

  const updateInventoryItem = (id: string, updates: Partial<InventoryItem>) => {
    setInventory(prev => prev.map(item => {
      if (item.id === id) {
        const updated = { ...item, ...updates };
        syncRecord('poultry_inventory_v2', updated);
        return updated;
      }
      return item;
    }));
  };

  const createInterHouseDebt = async (
    debtorHouseId: string,
    creditorHouseId: string,
    amount: number,
    description: string
  ): Promise<void> => {
    const today = new Date().toISOString().split('T')[0];
    const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const id = generateUUID();
    const aparRecord: APARRecord = {
      id,
      type: 'HUTANG',
      entityName: 'Inter-House Loan',
      description,
      amount,
      remainingAmount: amount,
      dueDate,
      createdAt: new Date().toISOString(),
      status: 'OPEN',
      houseId: debtorHouseId,
      isInterHouse: true,
      fromHouseId: debtorHouseId,
      toHouseId: creditorHouseId,
    };

    setApArRecords(prev => [...prev, aparRecord]);
    syncRecord('poultry_apar', aparRecord);

    addJournalEntry(
      { date: today, reference: `IHD-${id.slice(-6)}`, description: `Talangan: ${description}` },
      [
        { accountId: 'acc-piutang-antar', debit: amount, credit: 0, houseId: creditorHouseId },
        { accountId: 'acc-hutang-antar', debit: 0, credit: amount, houseId: debtorHouseId },
      ]
    );
  };

  const createStockMutation = (mutation: Omit<StockMutation, 'id' | 'totalCost'>) => {
    const id = generateUUID();
    const newMutation = { ...mutation, id, totalCost: mutation.quantity * (mutation.unitCost || 0) };
    setStockMutations(prev => [...prev, newMutation]);
    syncRecord('poultry_stock_mutations', newMutation);
  };

  // ─── Accounting Actions ──────────────────────────────────────────────────────
  const addJournalEntry = (entry: Omit<JournalEntry, 'id'>, lines: Omit<JournalLine, 'id' | 'journalId'>[]) => {
    const journalId = generateUUID();
    const newEntry = { ...entry, id: journalId };
    setJournalEntries(prev => [...prev, newEntry]);
    syncRecord('poultry_journals', newEntry);

    const newLines = lines.map(line => ({ ...line, id: generateUUID(), journalId }));
    setJournalLines(prev => [...prev, ...newLines]);
    newLines.forEach(line => syncRecord('poultry_journal_lines', line));

    return journalId;
  };

  // ── addAPARRecord (CREATE) ────────────────────────────────────────────────
  const addAPARRecord = async (record: {
    type: 'HUTANG' | 'PIUTANG';
    houseId?: string;
    entityName: string;
    description?: string;
    amount: number;
    remainingAmount: number;
    dueDate?: string;
    status: string;
  } | Omit<APARRecord, 'id' | 'createdAt'>) => {
    const apiUrl = import.meta.env.VITE_API_URL || '';
    const res = await fetch(`${apiUrl}/api/apar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Gagal menyimpan AP/AR');
    }
    const data = await res.json();
    await refreshData();
    return data;
  };

  // ── updateAPARRecord (PAY / CICIL) ───────────────────────────────────────
  const updateAPARRecord = async (
    id: string,
    amount: number,
    accountId: string,
    notes?: string,
    reference?: string
  ) => {
    const apiUrl = import.meta.env.VITE_API_URL || '';
    const res = await fetch(`${apiUrl}/api/apar/${id}/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, accountId, notes, reference }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Gagal mencatat pembayaran');
    }
    const data = await res.json();
    await refreshData();
    return data;
  };

  // ── Supplier CRUD ─────────────────────────────────────────────────────────
  const addSupplier = async (supplierData: {
    name: string;
    category: string;
    whatsappNumber: string;
    notes?: string;
  }) => {
    const apiUrl = import.meta.env.VITE_API_URL || '';
    const res = await fetch(`${apiUrl}/api/suppliers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(supplierData),
    });
    if (!res.ok) throw new Error('Gagal menyimpan supplier');
    await refreshData();
  };

  const updateSupplier = async (id: string, supplierData: any) => {
    const apiUrl = import.meta.env.VITE_API_URL || '';
    const res = await fetch(`${apiUrl}/api/suppliers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(supplierData),
    });
    if (!res.ok) throw new Error('Gagal memperbarui supplier');
    await refreshData();
  };

  const deleteSupplier = async (id: string) => {
    const apiUrl = import.meta.env.VITE_API_URL || '';
    await fetch(`${apiUrl}/api/suppliers/${id}`, { method: 'DELETE' });
    await refreshData();
  };

  // Record a standalone operational expense with full journal entry
  const addOperationalExpenseRecord = async (expense: Omit<OperationalExpense, 'id'>) => {
    const journalId = addJournalEntry(
      { date: expense.date, description: expense.description, reference: `OPS-${Date.now()}` },
      [
        { accountId: expense.accountId, debit: expense.amount, credit: 0, houseId: expense.houseId },
        { accountId: expense.paymentAccountId, debit: 0, credit: expense.amount, houseId: expense.houseId },
      ]
    );
    const newExpense: OperationalExpense = { ...expense, id: generateUUID(), journalId };
    setOperationalExpenses(prev => [...prev, newExpense]);
    syncRecord('poultry_op_expenses', newExpense);

    const expenseAcc = accounts.find(a => a.id === expense.accountId);
    await addTransaction({
      houseId: expense.houseId,
      date: expense.date,
      description: expense.description,
      qty: '1',
      price: expense.amount,
      total: expense.amount,
      account: expenseAcc?.name || 'Beban Operasional',
      type: 'EXPENSE',
      category: expense.category,
      journalId,
    });
  };

  // Realize sinking fund allocation — moves retained earnings to reserve fund
  // Updated: Treated as an appropriation of profit (expense-like)
  const realizeSinkingFund = async (amount: number, type: SinkingFundType, houseId?: string, notes?: string) => {
    const today = new Date().toISOString().split('T')[0];
    const journalId = addJournalEntry(
      { date: today, description: `Alokasi Dana Peremajaan: ${type}`, reference: `SF-${Date.now()}` },
      [
        { accountId: 'acc-beban-penyisihan', debit: amount, credit: 0, houseId },
        { accountId: 'acc-kas', debit: 0, credit: amount, houseId },
        { accountId: 'acc-bank-cadangan', debit: amount, credit: 0, houseId },
        { accountId: 'acc-cadangan-ekuitas', debit: 0, credit: amount, houseId },
      ]
    );

    await addTransaction({
      houseId,
      date: today,
      description: `[ALOKASI DANA] ${type} - ${notes || 'Penyisihan Keuntungan'}`,
      qty: '1',
      price: amount,
      total: amount,
      account: 'Kas -> Cadangan',
      type: 'EXPENSE',
      category: 'Pelunasan',
      journalId
    });

    const allocation: SinkingFundAllocation = {
      id: generateUUID(),
      date: today,
      type,
      amount,
      notes,
      journalId,
    };
    setSinkingFundAllocations(prev => [...prev, allocation]);
    syncRecord('poultry_sinking_fund', allocation);
  };

  // Compute debit/credit balance for a single account from journal lines
  const getAccountBalance = (accountId: string, houseId?: string) => {
    const lines = journalLines.filter(l => l.accountId === accountId && (!houseId || l.houseId === houseId));
    const debit = lines.reduce((s, l) => s + l.debit, 0);
    const credit = lines.reduce((s, l) => s + l.credit, 0);
    const acc = accounts.find(a => a.id === accountId);
    // Assets/Expenses: normal debit balance. Liabilities/Equity/Revenue: normal credit balance.
    const isDebitNormal = acc?.category === AccountCategory.ASSET || acc?.category === AccountCategory.EXPENSE;
    const balance = isDebitNormal ? debit - credit : credit - debit;
    return { debit, credit, balance };
  };

  // Trial balance: aggregate all accounts
  const getTrialBalance = (houseId?: string) => {
    return accounts.map(acc => {
      const { debit, credit } = getAccountBalance(acc.id, houseId);
      return { accountId: acc.id, name: acc.name, code: acc.code, category: acc.category, debit, credit };
    }).filter(row => row.debit > 0 || row.credit > 0);
  };

  const createOperationalExpense = async (tx: Omit<FinancialTransaction, 'id' | 'type'>, accountId: string, paymentAccountId: string) => {
    if (checkLockAndSwal(tx.date)) return;
    const journalId = addJournalEntry(
      { date: tx.date, description: tx.description, reference: `TRX-OPS-${Date.now()}` },
      [
        { accountId, debit: tx.total, credit: 0, houseId: tx.houseId },
        { accountId: paymentAccountId, debit: 0, credit: tx.total, houseId: tx.houseId }
      ]
    );
    const expenseAcc = accounts.find(a => a.id === accountId);
    await addTransaction({ ...tx, account: expenseAcc?.name || tx.account, type: 'EXPENSE', journalId, paymentStatus: PaymentStatus.LUNAS });
  };

  const addTransaction = async (txData: Omit<FinancialTransaction, 'id'>): Promise<string> => {
    if (checkLockAndSwal(txData.date)) return '';
    try {
      const isInventoryPurchase = txData.type === 'EXPENSE' && (txData.category === 'Persediaan' || txData.category === 'Pakan' || txData.category === 'Obat');
      const apiUrl = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${apiUrl}/api/transaction/expense`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txData, isInventoryPurchase })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      await refreshData();
      return data.id;
    } catch (e: any) {
      console.error(e);
      throw e;
    }
  };

  const deleteTransaction = async (id: string) => {
    const tx = transactions.find(t => t.id === id);
    if (!tx) return;
    if (checkLockAndSwal(tx.date)) return;

    try {
      const apiUrl = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${apiUrl}/api/transaction/cancel/${id}`, { method: 'POST' });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      await refreshData();
    } catch (e: any) {
      console.error(e);
      throw e;
    }
  };


  const updateTransaction = async (id: string, updates: Partial<FinancialTransaction>) => {
    const tx = transactions.find(t => t.id === id);
    if (tx && checkLockAndSwal(tx.date)) return;
    setTransactions(prev => prev.map(tx => {
      if (tx.id === id) {
        const updated = { ...tx, ...updates };
        syncRecord('poultry_transactions', updated);
        return updated;
      }
      return tx;
    }));
  };

  /** FIX #1 + #2 + #4: saveProduction now uses API Backend */
  const saveProduction = async (logData: Omit<ProductionLog, 'id'>) => {
    if (checkLockAndSwal(logData.date)) return;
    try {
      const apiUrl = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${apiUrl}/api/transaction/production`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...logData, inputBy: 'System' })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      await refreshData();
    } catch (e: any) {
      console.error(e);
      throw e;
    }
  };

  const updateProductionLog = async (id: string, updates: Partial<ProductionLog>) => {
    const log = productionLogs.find(l => l.id === id);
    if (log && checkLockAndSwal(log.date)) return;
    setProductionLogs(prev => prev.map(l => {
      if (l.id === id) {
        const updated = { ...l, ...updates };
        syncRecord('poultry_prod_logs', updated);
        return updated;
      }
      return l;
    }));
  };

  const saveSale = async (saleData: Omit<SalesLog, 'id'>, targetAccountId?: string) => {
    if (checkLockAndSwal(saleData.date)) return;
    const newSale = { ...saleData, id: generateUUID() };
    setSalesLogs(prev => [...prev, newSale]);
    syncRecord('poultry_sales_logs', newSale);

    let itemCost = 1500; // fallback estimated HPP

    // Always deduct from inventory for both paid and free sales
    setInventory(prev => prev.map(item => {
      const isEggMatch = item.type === ItemType.EGG_STOCK && item.eggCategory === saleData.category;
      const isNonEggMatch = item.type !== ItemType.EGG_STOCK && item.name === saleData.category;

      if ((isEggMatch || isNonEggMatch) && item.houseId === saleData.houseId) {
        itemCost = item.lastPrice || 1500;
        const updated = { ...item, quantity: Math.max(0, item.quantity - saleData.quantity) };
        syncRecord('poultry_inventory_v2', updated);
        return updated;
      }
      return item;
    }));

    // Use house-specific kas account, fallback to any cash account
    const selectedAcc = accounts.find(a => a.id === targetAccountId)
      || accounts.find(a => a.isCashOrBank && a.id === `acc-kas-${saleData.houseId}`)
      || accounts.find(a => a.isCashOrBank)
      || accounts[0];


    let txId = '';

    // PENANGANAN JIKA PEMBAYARAN ADALAH CASH (LUNAS) ATAU FREE
    if (saleData.paymentMethod !== 'PIUTANG') {
      txId = await addTransaction({
        houseId: saleData.houseId,
        date: saleData.date,
        description: saleData.isFree
          ? `Alokasi Telur Gratis: ${saleData.category} - ${saleData.customer || 'Umum'}`
          : `Penjualan Telur: ${saleData.category} - ${saleData.customer || 'Umum'}`,
        qty: `${saleData.quantity} butir`,
        price: saleData.isFree ? 0 : saleData.price,
        total: saleData.isFree ? 0 : saleData.total,
        account: saleData.isFree ? 'Pemberian Gratis' : 'Pendapatan Jual Telur',
        type: 'INCOME',
        category: saleData.isFree ? 'Free Goods' : 'Penjualan'
      });
    } else {
      // PENANGANAN JIKA PEMBAYARAN ADALAH PIUTANG
      // Tidak mencatat ke addTransaction (Buku Kas) karena uang belum masuk
      // Sebaliknya, kita mencatatnya di AP/AR (Hutang & Piutang)

      const aparId = generateUUID();
      const aparRecord: APARRecord = {
        id: aparId,
        type: 'PIUTANG',
        entityName: saleData.customer || 'Pelanggan Umum',
        description: `Penjualan (Tempo): ${saleData.category} (${saleData.quantity} qty)`,
        amount: saleData.total,
        remainingAmount: saleData.total,
        dueDate: saleData.dueDate, // Tanggal yang dikirim dari Sales.tsx
        status: 'OPEN',
        houseId: saleData.houseId,
        createdAt: new Date().toISOString()
      };

      setApArRecords(prev => [...prev, aparRecord]);
      syncRecord('poultry_apar', aparRecord);

      txId = `PIUTANG-${aparId.slice(-6)}`;
    }

    // Create journal entry
    const isAfkir = saleData.category.toLowerCase().includes('afkir');
    const isLimbah = saleData.category.toLowerCase().includes('limbah') || saleData.category.toLowerCase().includes('kotoran');
    const revenueAccount = isAfkir ? 'acc-penjualan-afkir' : isLimbah ? 'acc-penjualan-kotoran' : 'acc-penjualan-telur';

    if (!saleData.isFree && saleData.total > 0) {
      // Jika Piutang, Debit-nya adalah akun Piutang Usaha, bukan Akun Kas (selectedAcc)
      const debitAccountId = saleData.paymentMethod === 'PIUTANG'
        ? 'acc-piutang-usaha' // Pastikan kode akun ini ada/sesuai dengan daftar akun Anda, biasanya 'acc-piutang-usaha' atau akun piutang default lainnya
        : selectedAcc.id;

      addJournalEntry(
        {
          date: saleData.date,
          description: saleData.paymentMethod === 'PIUTANG'
            ? `Penjualan Tempo ${saleData.category} (${saleData.customer})`
            : `Penjualan ${saleData.category}`,
          reference: txId
        },
        [
          { accountId: debitAccountId, debit: saleData.total, credit: 0, houseId: saleData.houseId },
          { accountId: revenueAccount, debit: 0, credit: saleData.total, houseId: saleData.houseId }
        ]
      );
    } else if (saleData.isFree && saleData.quantity > 0) {
      const freeCost = saleData.quantity * itemCost;
      addJournalEntry(
        {
          date: saleData.date,
          description: `Alokasi Gratis: ${saleData.category} (${saleData.quantity} qty)`,
          reference: txId
        },
        [
          { accountId: 'acc-beban-promosi', debit: freeCost, credit: 0, houseId: saleData.houseId },
          { accountId: 'acc-persediaan-telur', debit: 0, credit: freeCost, houseId: saleData.houseId }
        ]
      );
    }
  };

  // Recipe CRUD
  const addRecipe = (r: any) => {
    const newRecipe = { ...r, id: generateUUID() };
    setRecipes(prev => [...prev, newRecipe]);
    syncRecord('poultry_recipes', newRecipe);
  };
  const updateRecipe = (id: string, updates: any) => {
    setRecipes(prev => prev.map(r => {
      if (r.id === id) {
        const updated = { ...r, ...updates };
        syncRecord('poultry_recipes', updated);
        return updated;
      }
      return r;
    }));
  };
  const deleteRecipe = (id: string) => {
    setRecipes(prev => prev.filter(r => r.id !== id));
    deleteRecord('poultry_recipes', id);
  };

  // Helper to convert any date string (ISO or date-only) to YYYY-MM-DD local format
  const toLocalYYYYMMDD = (dateVal: string | Date): string => {
    if (!dateVal) return '';
    if (typeof dateVal === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateVal)) {
      return dateVal;
    }
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // ─── Computed Analytics ────────────────────────────────────────────────────

  /** HDP % for a specific house/date */
  const getHDP = (houseId: string, date: string, currentCount: number): number => {
    const targetDateStr = toLocalYYYYMMDD(date);
    const log = productionLogs.find(p => p.houseId === houseId && toLocalYYYYMMDD(p.date) === targetDateStr);
    if (!log || currentCount === 0) return 0;
    return (log.eggCount / currentCount) * 100;
  };

  /** HHP (Hen Housed Production) */
  const getHHP = (houseId: string, initialCount: number, arrivalDate?: string): number => {
    const arrivalDateStr = arrivalDate ? toLocalYYYYMMDD(arrivalDate) : '';
    const logs = productionLogs.filter(p => p.houseId === houseId && (!arrivalDateStr || toLocalYYYYMMDD(p.date) >= arrivalDateStr));
    if (logs.length === 0 || initialCount === 0) return 0;
    const totalEggs = logs.reduce((sum, log) => sum + log.eggCount, 0);
    return totalEggs / initialCount;
  };

  /** Cumulative FCR = total feed consumed / total egg kg for a house */
  const getCumulativeFCR = (houseId: string, arrivalDate?: string): number => {
    const arrivalDateStr = arrivalDate ? toLocalYYYYMMDD(arrivalDate) : '';
    const logs = productionLogs.filter(p => p.houseId === houseId && (!arrivalDateStr || toLocalYYYYMMDD(p.date) >= arrivalDateStr));
    const totalFeed = logs.reduce((a, b) => a + b.feedConsumed, 0);
    // Estimate egg mass if eggWeight is missing (assume 62.5g or 0.0625kg per egg)
    const totalKg = logs.reduce((a, b) => a + (b.eggWeight || (b.eggCount * 0.0625)), 0);
    if (totalKg === 0) return 0;
    return totalFeed / totalKg;
  };

  /** Average feed intake per bird per day (grams), based on most recent log */
  const getFeedIntakePerBird = (houseId: string, currentCount: number): number => {
    const logs = productionLogs.filter(p => p.houseId === houseId);
    if (logs.length === 0 || currentCount === 0) return 0;
    const lastLog = logs[logs.length - 1];
    return (lastLog.feedConsumed * 1000) / currentCount;
  };

  /** Full analytics bundle for a flock */
  const getFlockAnalytics = (houseId: string, currentCount: number, arrivalDate?: string): FlockAnalytics => {
    const arrivalDateStr = arrivalDate ? toLocalYYYYMMDD(arrivalDate) : '';
    const logs = productionLogs.filter(p => p.houseId === houseId && (!arrivalDateStr || toLocalYYYYMMDD(p.date) >= arrivalDateStr));
    const totalFeed = logs.reduce((a, b) => a + b.feedConsumed, 0);
    const totalButir = logs.reduce((a, b) => a + b.totalButir, 0);
    // Estimate egg mass if missing
    const totalKg = logs.reduce((a, b) => a + (b.eggWeight || (b.eggCount * 0.0625)), 0);
    const cumulativeFCR = totalKg > 0 ? totalFeed / totalKg : 0;

    // 1. Feed Cost (Consumed Feed * Unit Price)
    const totalFeedCost = logs.reduce((acc, log) => {
      const mutation = stockMutations.find(m => m.reference === `Prod Feed: ${log.id}`);
      if (mutation && mutation.totalCost > 0) {
        return acc + mutation.totalCost;
      }
      const item = inventory.find(i => i.id === log.feedInventoryItemId);
      return acc + (item ? log.feedConsumed * (item.lastPrice || 0) : 0);
    }, 0);

    // 2. Operational Expenses (Labor, Utilities, Medication) from Transactions
    const houseOpEx = transactions.filter(t => {
      if (t.houseId !== houseId || t.type !== 'EXPENSE') return false;
      const account = accounts.find(a => a.id === t.account || a.name === t.account);
      // We exclude assets (Capex) and Inventory purchases (DM) to get OpEx
      // Inventory is handled separately as "Consumed Feed"
      return account &&
        account.category === 'EXPENSE' &&
        t.category !== 'Persediaan' &&
        t.category !== 'Pelunasan';
    });
    const totalOtherDirectCosts = houseOpEx.reduce((acc, t) => acc + t.total, 0);

    // 3. Depreciation Reserves (Sinking Fund)
    const houseSinkingFund = sinkingFundAllocations.filter(a => (a as any).houseId === houseId);
    const totalSinkingFund = houseSinkingFund.reduce((acc, a) => acc + a.amount, 0);

    // Total HPP = Feed + OpEx + Depreciation
    const totalProductionCost = totalFeedCost + totalOtherDirectCosts + totalSinkingFund;
    const hppPerButir = totalButir > 0 ? totalProductionCost / totalButir : 0;
    const hppPerKg = totalKg > 0 ? totalProductionCost / totalKg : 0;

    const totalIncome = salesLogs
      .filter(s => s.houseId === houseId && !s.isFree)
      .reduce((a, b) => a + b.total, 0);
    const netPL = totalIncome - totalProductionCost;

    return {
      houseId,
      cumulativeFCR,
      feedIntakePerBirdGrams: getFeedIntakePerBird(houseId, currentCount),
      hppPerButir,
      hppPerKg,
      totalButir,
      totalKg,
      totalFeedCost: totalProductionCost,
      netPL,
    };
  };

  const saveFarmSettings = async (settings: Partial<FarmSettings>) => {
    setFarmSettings(prev => {
      const merged = { ...prev, ...settings };
      syncRecord('poultry_farm_settings', { id: 'singleton', ...merged });
      return merged;
    });
  };

  const addModalAwal = async (amount: number, description = 'Modal Awal', houseId?: string, targetAccountId?: string) => {
    const txId = `tx-${Date.now()}`;
    // Prefer house-specific kas account
    const kasAccountId = targetAccountId
      || (houseId ? `acc-kas-${houseId}` : null)
      || accounts.find(a => a.isCashOrBank)?.id
      || 'acc-bank-bca';
    const targetAccount = accounts.find(a => a.id === kasAccountId) || accounts.find(a => a.isCashOrBank) || accounts[0];

    const journalId = addJournalEntry({
      date: new Date().toISOString().split('T')[0],
      reference: `MODAL-${Date.now()}`,
      description: `Suntikan Modal: ${description}`,
    }, [
      { accountId: targetAccount.id, debit: amount, credit: 0, houseId },
      { accountId: 'acc-modal', debit: 0, credit: amount, houseId }
    ]);

    await addTransaction({
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
    await saveFarmSettings({ initialCapital: farmSettings.initialCapital + amount });
  };

  /**
   * Hitung saldo kas untuk kandang tertentu.
   * Menjumlahkan semua debit-kredit pada akun Kas Kandang [houseId].
   */
  const getHouseCashBalance = (houseId: string): number => {
    const kasAccountId = `acc-kas-${houseId}`;
    const debit = journalLines
      .filter(l => l.accountId === kasAccountId)
      .reduce((sum, l) => sum + (l.debit || 0), 0);
    const credit = journalLines
      .filter(l => l.accountId === kasAccountId)
      .reduce((sum, l) => sum + (l.credit || 0), 0);
    return debit - credit;
  };

  /**
   * Catat due to / due from antar kandang (Jurnal Internal).
   */
  const addInterHouseTransaction = async (
    fromHouseId: string,
    toHouseId: string,
    amount: number,
    description: string
  ) => {
    const today = new Date().toISOString().split('T')[0];
    const baseId = `iht-${Date.now()}`;

    // Journal entry: Debit Piutang Antar Kandang (toHouse), Credit Hutang Antar Kandang (fromHouse)
    addJournalEntry({
      date: today,
      reference: baseId,
      description: `Transfer Internal: ${description}`,
    }, [
      { accountId: 'acc-piutang-antar', debit: amount, credit: 0, houseId: toHouseId },
      { accountId: 'acc-hutang-antar', debit: 0, credit: amount, houseId: fromHouseId },
    ]);
  };

  /**
   * Transfer Saldo Kas / Bank
   */
  const addTransferKas = async (fromAccountId: string, toAccountId: string, amount: number, date: string, notes: string) => {
    const journalId = addJournalEntry({
      date,
      reference: `TRF-${Date.now()}`,
      description: `Transfer Kas: ${notes}`,
    }, [
      { accountId: toAccountId, debit: amount, credit: 0 },
      { accountId: fromAccountId, debit: 0, credit: amount }
    ]);

    await addTransaction({
      date,
      description: `[TRANSFER] ${accounts.find(a => a.id === fromAccountId)?.name} -> ${accounts.find(a => a.id === toAccountId)?.name} - ${notes}`,
      qty: '1',
      price: amount,
      total: amount,
      account: accounts.find(a => a.id === fromAccountId)?.name || 'Transfer',
      type: 'INTERNAL_TRANSFER' as any,
      category: 'Transfer Kas',
      journalId
    });
  };

  const closeMonth = async (yearMonth: string, inputBy: string) => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || '';
      const response = await fetch(`${apiUrl}/api/transaction/closing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ yearMonth, inputBy })
      });
      if (!response.ok) throw new Error('Gagal melakukan closing bulan');
      const resData = await response.json();
      if (!resData.success) throw new Error(resData.error || 'Gagal melakukan closing bulan');
      await refreshData();
      return resData;
    } catch (error) {
      console.error('Tutup buku error:', error);
      throw error;
    }
  };


  const addAccount = (accountData: Omit<Account, 'id'>) => {
    const id = generateUUID();
    const newAccount = { ...accountData, id };
    setAccounts(prev => [...prev, newAccount]);
    syncRecord('poultry_accounts', newAccount);
  };

  const updateAccount = (id: string, updates: Partial<Account>) => {
    setAccounts(prev => prev.map(a => {
      if (a.id === id) {
        const updated = { ...a, ...updates };
        syncRecord('poultry_accounts', updated);
        return updated;
      }
      return a;
    }));
  };

  const deleteAccount = (id: string) => {
    setAccounts(prev => prev.filter(a => a.id !== id));
  };

  const addAsset = async (assetData: Omit<Asset, 'id' | 'maintenanceHistory'>) => {
    const id = generateUUID();
    const newAsset: Asset = { ...assetData, id, maintenanceHistory: [] };

    // Simpan ke backend dulu
    const apiUrl = import.meta.env.VITE_API_URL || '';
    const res = await fetch(`${apiUrl}/api/assets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newAsset)
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(`Gagal menyimpan aset: ${errData.error || res.statusText}`);
    }

    // Baru update state lokal
    setAssets(prev => [...prev, newAsset]);
    syncRecord('poultry_assets', newAsset); // tetap untuk cache offline
  };

  const addCostAllocation = async (allocationData: Omit<CostAllocation, 'id'>) => {
    const id = generateUUID();
    const newAllocation = { ...allocationData, id };
    setCostAllocations(prev => [...prev, newAllocation]);
    await syncRecord('poultry_cost_allocations', newAllocation);
  };

  const addBankReconciliation = async (reconciliationData: Omit<BankReconciliation, 'id'>) => {
    const id = generateUUID();
    const newRecon = { ...reconciliationData, id };
    setBankReconciliations(prev => [...prev, newRecon]);
    await syncRecord('poultry_bank_reconciliations', newRecon);
  };

  const updateAsset = (id: string, updates: Partial<Asset>) => {
    setAssets(prev => prev.map(a => {
      if (a.id === id) {
        const updated = { ...a, ...updates };
        syncRecord('poultry_assets', updated);
        return updated;
      }
      return a;
    }));
  };

  const updateAssetStatus = async (id: string, status: AssetCondition, user: string, notes?: string) => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${apiUrl}/api/assets/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, user, notes })
      });
      if (!res.ok) throw new Error('Gagal mengupdate status aset');

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
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  const addBiosecurityRecord = (data: Omit<BiosecurityRecord, 'id'>) => {
    const newRecord = { ...data, id: `vax-${Date.now()}` };
    setBiosecurityRecords(prev => [...prev, newRecord]);
    syncRecord('poultry_biosecurity', newRecord);
  };

  const addBiosecurityRecordsBulk = (data: Omit<BiosecurityRecord, 'id'>[]) => {
    const timestamp = Date.now();
    const newRecords = data.map((d, index) => ({ ...d, id: `vax-${timestamp}-${index}` }));
    setBiosecurityRecords(prev => [...prev, ...newRecords]);
    newRecords.forEach(r => syncRecord('poultry_biosecurity', r));
  };


  const updateBiosecurityRecord = (id: string, updates: Partial<BiosecurityRecord>) => {
    setBiosecurityRecords(prev => {
      const updated = prev.map(r => r.id === id ? { ...r, ...updates } : r);
      const target = updated.find(r => r.id === id);
      if (target) syncRecord('poultry_biosecurity', target);
      return updated;
    });
  };

  const deleteBiosecurityRecord = (id: string) => {
    setBiosecurityRecords(prev => prev.filter(r => r.id !== id));
    deleteRecord('poultry_biosecurity', id);
  };

  return (
    <GlobalContext.Provider value={{
      productionLogs, salesLogs, transactions, inventory, mortalityRecords, recipes,
      accounts, journalEntries, journalLines, stockMutations, apArRecords, biosecurityRecords,
      operationalExpenses, sinkingFundAllocations, aparPayments, costAllocations, bankReconciliations,
      addBiosecurityRecord, addBiosecurityRecordsBulk, updateBiosecurityRecord, deleteBiosecurityRecord,
      saveProduction, updateProductionLog, saveSale, addTransaction, updateTransaction, deleteTransaction,
      updateInventory, addInventoryItem, updateInventoryItem, createStockMutation,
      addJournalEntry, addAPARRecord, updateAPARRecord, createOperationalExpense,
      addOperationalExpenseRecord, realizeSinkingFund,
      getAccountBalance, getTrialBalance,
      addRecipe, updateRecipe, deleteRecipe,
      getHDP, getHHP, getCumulativeFCR, getFeedIntakePerBird, getFlockAnalytics,
      farmSettings, saveFarmSettings, addModalAwal,
      assets, addAsset, updateAsset, updateAssetStatus,
      addAccount, updateAccount, deleteAccount,
      getHouseCashBalance, addInterHouseTransaction, addTransferKas, closeMonth, refreshData,
      addCostAllocation, addBankReconciliation, createInterHouseDebt,
      suppliers, addSupplier, updateSupplier, deleteSupplier
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