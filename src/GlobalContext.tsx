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

import { syncToDb, loadFromDbOrIndexedDB } from './syncUtils';

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

  // Actions
  addBiosecurityRecord: (record: Omit<BiosecurityRecord, 'id'>) => void;
  addBiosecurityRecordsBulk: (records: Omit<BiosecurityRecord, 'id'>[]) => void;
  updateBiosecurityRecord: (id: string, updates: Partial<BiosecurityRecord>) => void;
  deleteBiosecurityRecord: (id: string) => void;
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
  getHouseCashBalance: (houseId: string) => number;
  createInterHouseDebt: (fromHouseId: string, toHouseId: string, amount: number, description: string) => void;
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
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => { if (isInitialized) syncToDb('poultry_prod_logs', productionLogs); }, [productionLogs, isInitialized]);
  useEffect(() => { if (isInitialized) syncToDb('poultry_sales_logs', salesLogs); }, [salesLogs, isInitialized]);
  useEffect(() => { if (isInitialized) syncToDb('poultry_transactions', transactions); }, [transactions, isInitialized]);
  useEffect(() => { if (isInitialized) syncToDb('poultry_inventory_v2', inventory); }, [inventory, isInitialized]);
  useEffect(() => { if (isInitialized) syncToDb('poultry_mortality', mortalityRecords); }, [mortalityRecords, isInitialized]);
  useEffect(() => { if (isInitialized) syncToDb('poultry_recipes', recipes); }, [recipes, isInitialized]);
  useEffect(() => { if (isInitialized) syncToDb('poultry_farm_settings', farmSettings); }, [farmSettings, isInitialized]);
  useEffect(() => { if (isInitialized) syncToDb('poultry_assets', assets); }, [assets, isInitialized]);
  useEffect(() => { if (isInitialized) syncToDb('poultry_accounts', accounts); }, [accounts, isInitialized]);
  useEffect(() => { if (isInitialized) syncToDb('poultry_journals', journalEntries); }, [journalEntries, isInitialized]);
  useEffect(() => { if (isInitialized) syncToDb('poultry_journal_lines', journalLines); }, [journalLines, isInitialized]);
  useEffect(() => { if (isInitialized) syncToDb('poultry_stock_mutations', stockMutations); }, [stockMutations, isInitialized]);
  useEffect(() => { if (isInitialized) syncToDb('poultry_apar', apArRecords); }, [apArRecords, isInitialized]);
  useEffect(() => { if (isInitialized) syncToDb('poultry_op_expenses', operationalExpenses); }, [operationalExpenses, isInitialized]);
  useEffect(() => { if (isInitialized) syncToDb('poultry_sinking_fund', sinkingFundAllocations); }, [sinkingFundAllocations, isInitialized]);
  useEffect(() => { if (isInitialized) syncToDb('poultry_biosecurity', biosecurityRecords); }, [biosecurityRecords, isInitialized]);


  // Load from DB or IndexedDB on mount
  useEffect(() => {
    const init = async () => {
        await Promise.all([
            loadFromDbOrIndexedDB('poultry_prod_logs', setProductionLogs),
            loadFromDbOrIndexedDB('poultry_sales_logs', setSalesLogs),
            loadFromDbOrIndexedDB('poultry_transactions', setTransactions),
            loadFromDbOrIndexedDB('poultry_inventory_v2', setInventory),
            loadFromDbOrIndexedDB('poultry_mortality', setMortalityRecords),
            loadFromDbOrIndexedDB('poultry_recipes', setRecipes),
            loadFromDbOrIndexedDB('poultry_farm_settings', (data) => setFarmSettings({...DEFAULT_FARM_SETTINGS, ...data})),
            loadFromDbOrIndexedDB('poultry_assets', setAssets),
            loadFromDbOrIndexedDB('poultry_accounts', setAccounts),
            loadFromDbOrIndexedDB('poultry_journals', setJournalEntries),
            loadFromDbOrIndexedDB('poultry_journal_lines', setJournalLines),
            loadFromDbOrIndexedDB('poultry_stock_mutations', setStockMutations),
            loadFromDbOrIndexedDB('poultry_apar', setApArRecords),
            loadFromDbOrIndexedDB('poultry_op_expenses', setOperationalExpenses),
            loadFromDbOrIndexedDB('poultry_sinking_fund', setSinkingFundAllocations),
            loadFromDbOrIndexedDB('poultry_biosecurity', setBiosecurityRecords),
        ]);
        setIsInitialized(true);
    };
    init();
  }, []);



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
        { accountId: expense.accountId, debit: expense.amount, credit: 0, houseId: expense.houseId },
        { accountId: expense.paymentAccountId, debit: 0, credit: expense.amount, houseId: expense.houseId },
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
  const realizeSinkingFund = (amount: number, type: SinkingFundType, houseId?: string, notes?: string) => {
    const journalId = addJournalEntry(
      { date: new Date().toISOString().split('T')[0], description: `Penyisihan Sinking Fund: ${type}`, reference: `SF-${Date.now()}` },
      [
        { accountId: 'acc-modal', debit: amount, credit: 0, houseId },
        { accountId: 'acc-sinking-fund', debit: 0, credit: amount, houseId },
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

  const createOperationalExpense = (tx: Omit<FinancialTransaction, 'id' | 'type'>, accountId: string, paymentAccountId: string) => {
    const journalId = addJournalEntry(
      { date: tx.date, description: tx.description, reference: `TRX-OPS-${Date.now()}` },
      [
        { accountId, debit: tx.total, credit: 0, houseId: tx.houseId },
        { accountId: paymentAccountId, debit: 0, credit: tx.total, houseId: tx.houseId }
      ]
    );
    addTransaction({ ...tx, type: 'EXPENSE', journalId, paymentStatus: PaymentStatus.LUNAS });
  };

  const addTransaction = (txData: Omit<FinancialTransaction, 'id'>): string => {
    const id = `tx-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const newTx = { ...txData, id };
    setTransactions(prev => [...prev, newTx]);
    
    // Sync to backend asynchronously
    fetch('/api/finance/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newTx)
    }).catch(err => console.error("Failed to sync transaction:", err));
    
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
    
    // Sync to backend
    fetch('/api/production', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newLog)
    }).catch(err => console.error("Failed to sync production:", err));

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

        // 3. Catat Biaya Operasional (Pakan) untuk Kandang (Debit Beban Pakan, Credit Persediaan)
        const journalId = addJournalEntry(
          { date: logData.date, description: `Pemakaian Pakan Produksi: Kandang ${logData.houseId}`, reference: `PROD-FEED-${newLog.id}` },
          [
            { accountId: 'acc-beban-pakan', debit: totalCost, credit: 0, houseId: logData.houseId },
            { accountId: 'acc-persediaan', debit: 0, credit: totalCost, houseId: logData.houseId }
          ]
        );

        addTransaction({
          houseId: logData.houseId,
          date: logData.date,
          description: `Biaya Pemakaian Pakan Produksi`,
          qty: `${logData.feedConsumed} ${item.unit}`,
          price: item.lastPrice,
          total: totalCost,
          account: 'Persediaan',
          type: 'EXPENSE',
          category: 'Pakan',
          journalId
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

    // Use house-specific kas account, fallback to any cash account
    const selectedAcc = accounts.find(a => a.id === targetAccountId)
      || accounts.find(a => a.isCashOrBank && a.id === `acc-kas-${saleData.houseId}`)
      || accounts.find(a => a.isCashOrBank)
      || accounts[0];


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
        { id: `jl-${Date.now()}-1`, journalId, accountId: selectedAcc.id, debit: saleData.total, credit: 0, houseId: saleData.houseId },
        { id: `jl-${Date.now()}-2`, journalId, accountId: 'acc-penjualan-telur', debit: 0, credit: saleData.total, houseId: saleData.houseId }
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

  const addModalAwal = (amount: number, description = 'Modal Awal', houseId?: string, targetAccountId?: string) => {
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
   * Catat utang-piutang antar kandang.
   * fromHouseId = kandang yang "meminjam" (berhutang)
   * toHouseId   = kandang yang "menanggung" (berpiutang)
   */
  const createInterHouseDebt = (
    fromHouseId: string,
    toHouseId: string,
    amount: number,
    description: string
  ) => {
    const today = new Date().toISOString().split('T')[0];
    const baseId = `iht-${Date.now()}`;

    // Kandang fromHouse: HUTANG (liability increases)
    addAPARRecord({
      type: 'HUTANG',
      entityName: `Kandang — Internal Transfer`,
      description: `[Hutang Antar Kandang] ${description}`,
      amount,
      remainingAmount: amount,
      dueDate: today,
      status: 'OPEN',
      houseId: fromHouseId,
      isInterHouse: true,
      fromHouseId,
      toHouseId,
    } as any);

    // Kandang toHouse: PIUTANG (asset increases)
    addAPARRecord({
      type: 'PIUTANG',
      entityName: `Kandang — Internal Transfer`,
      description: `[Piutang Antar Kandang] ${description}`,
      amount,
      remainingAmount: amount,
      dueDate: today,
      status: 'OPEN',
      houseId: toHouseId,
      isInterHouse: true,
      fromHouseId,
      toHouseId,
    } as any);

    // Journal entry: Debit Piutang Antar Kandang (toHouse), Credit Hutang Antar Kandang (fromHouse)
    addJournalEntry({
      date: today,
      reference: baseId,
      description: `Transfer Internal: ${description}`,
    }, [
      { accountId: 'acc-piutang-antar', debit: amount, credit: 0, houseId: toHouseId },
      { accountId: 'acc-hutang-antar',  debit: 0, credit: amount, houseId: fromHouseId },
    ]);
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

  const addBiosecurityRecord = (data: Omit<BiosecurityRecord, 'id'>) => {
    setBiosecurityRecords(prev => [...prev, { ...data, id: `vax-${Date.now()}` }]);
  };

  const addBiosecurityRecordsBulk = (data: Omit<BiosecurityRecord, 'id'>[]) => {
    const timestamp = Date.now();
    const newRecords = data.map((d, index) => ({ ...d, id: `vax-${timestamp}-${index}` }));
    setBiosecurityRecords(prev => [...prev, ...newRecords]);
  };


  const updateBiosecurityRecord = (id: string, updates: Partial<BiosecurityRecord>) => {
    setBiosecurityRecords(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
  };

  const deleteBiosecurityRecord = (id: string) => {
    setBiosecurityRecords(prev => prev.filter(r => r.id !== id));
  };

  return (
    <GlobalContext.Provider value={{
      productionLogs, salesLogs, transactions, inventory, mortalityRecords, recipes,
      accounts, journalEntries, journalLines, stockMutations, apArRecords, biosecurityRecords,
      operationalExpenses, sinkingFundAllocations,
      addBiosecurityRecord, addBiosecurityRecordsBulk, updateBiosecurityRecord, deleteBiosecurityRecord,
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
      getHouseCashBalance, createInterHouseDebt,
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
