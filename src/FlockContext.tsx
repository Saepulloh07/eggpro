import React, { createContext, useContext, useState, useEffect } from 'react';
import { FlockBatch, PopulationMutation, MutationType, MortalityCause } from './types';
import { useGlobalData } from './GlobalContext';
import { syncToDb, syncRecord, deleteRecord, loadFromDbOrIndexedDB } from './syncUtils';

interface FlockContextType {
  flocks: FlockBatch[];
  mutations: PopulationMutation[];
  addFlock: (flock: Omit<FlockBatch, 'id'>) => void;
  updateFlock: (id: string, updates: Partial<FlockBatch>) => void;
  deleteFlock: (id: string) => void;
  getActiveFlockByHouse: (houseId: string) => FlockBatch | undefined;
  addMutation: (mutation: Omit<PopulationMutation, 'id'>) => Promise<void>;
  deleteMutation: (id: string) => Promise<void>;
}


const FlockContext = createContext<FlockContextType | undefined>(undefined);

export const FlockProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { addTransaction, deleteTransaction, addJournalEntry, accounts } = useGlobalData();
  const [flocks, setFlocks] = useState<FlockBatch[]>([]);
  const [mutations, setMutations] = useState<PopulationMutation[]>([]);

  useEffect(() => {
    loadFromDbOrIndexedDB('poultry_flocks', setFlocks);
    loadFromDbOrIndexedDB('poultry_mutations', setMutations);
  }, []);

  const generateUUID = () => {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
      try {
        return window.crypto.randomUUID();
      } catch (e) {}
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  const addFlock = (flockData: Omit<FlockBatch, 'id'>) => {
    const id = generateUUID();
    const newFlock: FlockBatch = { ...flockData, id };

    if (newFlock.isActive) {
      setFlocks(prev => {
        const updated = prev.map(f => {
          if (f.houseId === newFlock.houseId && f.isActive) {
            const deactivated = { ...f, isActive: false };
            syncRecord('poultry_flocks', deactivated);
            return deactivated;
          }
          return f;
        }).concat(newFlock);
        syncRecord('poultry_flocks', newFlock);
        return updated;
      });
    } else {
      setFlocks(prev => [...prev, newFlock]);
      syncRecord('poultry_flocks', newFlock);
    }
  };

  const updateFlock = (id: string, updates: Partial<FlockBatch>) => {
    setFlocks(prev => prev.map(f => {
      if (f.id === id) {
        const updated = { ...f, ...updates };
        syncRecord('poultry_flocks', updated);
        return updated;
      }
      return f;
    }));

    if (updates.isActive) {
      setFlocks(prev => {
        const target = prev.find(f => f.id === id);
        if (!target) return prev;
        return prev.map(f => {
          if (f.houseId === target.houseId && f.id !== id && f.isActive) {
            const deactivated = { ...f, isActive: false };
            syncRecord('poultry_flocks', deactivated);
            return deactivated;
          }
          return f;
        });
      });
    }
  };

  const deleteFlock = (id: string) => {
    setFlocks(prev => prev.filter(f => f.id !== id));
    deleteRecord('poultry_flocks', id);
  };

  const getActiveFlockByHouse = (houseId: string) => {
    return flocks.find(f => f.houseId === houseId && f.isActive);
  };

  const addMutation = async (mutData: Omit<PopulationMutation, 'id'>) => {
    let transactionId: string | undefined;

    const selectedAcc = accounts.find(a => a.isCashOrBank && a.id === `acc-kas-${mutData.houseId}`)
      || accounts.find(a => a.isCashOrBank)
      || accounts[0];

    // Financial Integration (Add transaction first to get ID)
    if (mutData.type === MutationType.ARRIVAL && mutData.totalPrice) {
      transactionId = await addTransaction({
        houseId: mutData.houseId,
        date: mutData.date,
        description: `Pembelian DOC: ${mutData.count} ekor @ Rp${mutData.pricePerBird?.toLocaleString()}`,
        qty: `${mutData.count} ekor`,
        price: mutData.pricePerBird || 0,
        total: mutData.totalPrice,
        account: selectedAcc.name,
        type: 'EXPENSE',
        category: 'Pembelian DOC'
      });
      addJournalEntry(
        {
          date: mutData.date,
          description: `Pembelian DOC: ${mutData.count} ekor`,
          reference: transactionId || ''
        },
        [
          { accountId: 'acc-beban-doc', debit: mutData.totalPrice, credit: 0, houseId: mutData.houseId },
          { accountId: selectedAcc.id, debit: 0, credit: mutData.totalPrice, houseId: mutData.houseId }
        ]
      );
    }

    if (mutData.type === MutationType.CULLING && mutData.totalPrice) {
      transactionId = await addTransaction({
        houseId: mutData.houseId,
        date: mutData.date,
        description: `Penjualan Ayam Afkir: ${mutData.count} ekor @ Rp${mutData.pricePerBird?.toLocaleString()}`,
        qty: `${mutData.count} ekor`,
        price: mutData.pricePerBird || 0,
        total: mutData.totalPrice,
        account: selectedAcc.name,
        type: 'INCOME',
        category: 'Penjualan Afkir'
      });
      addJournalEntry(
        {
          date: mutData.date,
          description: `Penjualan Ayam Afkir: ${mutData.count} ekor`,
          reference: transactionId || ''
        },
        [
          { accountId: selectedAcc.id, debit: mutData.totalPrice, credit: 0, houseId: mutData.houseId },
          { accountId: 'acc-penjualan-afkir', debit: 0, credit: mutData.totalPrice, houseId: mutData.houseId }
        ]
      );
    }

    const id = generateUUID();
    const newMut: PopulationMutation = { 
      ...mutData, 
      id,
      transactionId 
    };
    setMutations(prev => [newMut, ...prev]);
    syncRecord('poultry_mutations', newMut);

    // Update Flock Counts
    setFlocks(prev => prev.map(f => {
      if (f.houseId === mutData.houseId && f.isActive) {
        let newCount = f.currentCount;
        if (mutData.type === MutationType.ARRIVAL) newCount += mutData.count;
        if (mutData.type === MutationType.MORTALITY) newCount -= mutData.count;
        if (mutData.type === MutationType.CULLING) newCount -= mutData.count;
        if (mutData.type === MutationType.TRANSFER) newCount -= mutData.count;
        return { ...f, currentCount: Math.max(0, newCount) };
      }
      // If TRANSFER, add to target house
      if (mutData.type === MutationType.TRANSFER && f.houseId === mutData.targetHouseId && f.isActive) {
        return { ...f, currentCount: f.currentCount + mutData.count };
      }
      return f;
    }));
  };

  const deleteMutation = async (id: string) => {
    const mut = mutations.find(m => m.id === id);
    if (!mut) return;

    setMutations(prev => prev.filter(m => m.id !== id));
    deleteRecord('poultry_mutations', id);

    // Rollback Flock Counts
    setFlocks(prev => prev.map(f => {
      if (f.houseId === mut.houseId && f.isActive) {
        let newCount = f.currentCount;
        if (mut.type === MutationType.ARRIVAL) newCount -= mut.count;
        if (mut.type === MutationType.MORTALITY) newCount += mut.count;
        if (mut.type === MutationType.CULLING) newCount += mut.count;
        if (mut.type === MutationType.TRANSFER) newCount += mut.count;
        return { ...f, currentCount: Math.max(0, newCount) };
      }
      if (mut.type === MutationType.TRANSFER && f.houseId === mut.targetHouseId && f.isActive) {
        return { ...f, currentCount: Math.max(0, f.currentCount - mut.count) };
      }
      return f;
    }));

    // Delete linked transaction
    if (mut.transactionId) {
      await deleteTransaction(mut.transactionId);
    }
  };

  return (
    <FlockContext.Provider value={{ 
      flocks, mutations, addFlock, updateFlock, deleteFlock, getActiveFlockByHouse,
      addMutation, deleteMutation 
    }}>
      {children}
    </FlockContext.Provider>
  );
};



export const useFlock = () => {
  const context = useContext(FlockContext);
  if (!context) {
    throw new Error('useFlock must be used within a FlockProvider');
  }
  return context;
};
