import React, { createContext, useContext, useState, useEffect } from 'react';
import { FlockBatch, PopulationMutation, MutationType, MortalityCause } from './types';
import { useGlobalData } from './GlobalContext';
import { syncToDb, loadFromDbOrIndexedDB } from './syncUtils';

interface FlockContextType {
  flocks: FlockBatch[];
  mutations: PopulationMutation[];
  addFlock: (flock: Omit<FlockBatch, 'id'>) => void;
  updateFlock: (id: string, updates: Partial<FlockBatch>) => void;
  deleteFlock: (id: string) => void;
  getActiveFlockByHouse: (houseId: string) => FlockBatch | undefined;
  addMutation: (mutation: Omit<PopulationMutation, 'id'>) => void;
  deleteMutation: (id: string) => void;
}


const FlockContext = createContext<FlockContextType | undefined>(undefined);

export const FlockProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { addTransaction, deleteTransaction } = useGlobalData();
  const [flocks, setFlocks] = useState<FlockBatch[]>([]);
  const [mutations, setMutations] = useState<PopulationMutation[]>([]);

  useEffect(() => {
    if (flocks.length > 0) syncToDb('poultry_flocks', flocks);
  }, [flocks]);

  useEffect(() => {
    if (mutations.length > 0) syncToDb('poultry_mutations', mutations);
  }, [mutations]);

  useEffect(() => {
    loadFromDbOrIndexedDB('poultry_flocks', setFlocks);
    loadFromDbOrIndexedDB('poultry_mutations', setMutations);
  }, []);

  const addFlock = (flockData: Omit<FlockBatch, 'id'>) => {
    const newFlock: FlockBatch = {
      ...flockData,
      id: `f${Date.now()}`
    };

    // If setting as active, deactivate other flocks in the same house
    if (newFlock.isActive) {
      setFlocks(prev => prev.map(f =>
        f.houseId === newFlock.houseId ? { ...f, isActive: false } : f
      ).concat(newFlock));
    } else {
      setFlocks(prev => [...prev, newFlock]);
    }
  };

  const updateFlock = (id: string, updates: Partial<FlockBatch>) => {
    setFlocks(prev => prev.map(f => {
      if (f.id === id) {
        const updated = { ...f, ...updates };
        return updated;
      }
      return f;
    }));

    if (updates.isActive) {
      setFlocks(prev => {
        const target = prev.find(f => f.id === id);
        if (!target) return prev;
        return prev.map(f =>
          (f.houseId === target.houseId && f.id !== id) ? { ...f, isActive: false } : f
        );
      });
    }
  };

  const deleteFlock = (id: string) => {
    setFlocks(prev => prev.filter(f => f.id !== id));
  };

  const getActiveFlockByHouse = (houseId: string) => {
    return flocks.find(f => f.houseId === houseId && f.isActive);
  };

  const addMutation = (mutData: Omit<PopulationMutation, 'id'>) => {
    let transactionId: string | undefined;

    // Financial Integration (Add transaction first to get ID)
    if (mutData.type === MutationType.ARRIVAL && mutData.totalPrice) {
      transactionId = addTransaction({
        houseId: mutData.houseId,
        date: mutData.date,
        description: `Pembelian DOC: ${mutData.count} ekor @ Rp${mutData.pricePerBird?.toLocaleString()}`,
        qty: `${mutData.count} ekor`,
        price: mutData.pricePerBird || 0,
        total: mutData.totalPrice,
        account: 'Kas Tunai',
        type: 'EXPENSE',
        category: 'Pembelian DOC'
      });
    }

    if (mutData.type === MutationType.CULLING && mutData.totalPrice) {
      transactionId = addTransaction({
        houseId: mutData.houseId,
        date: mutData.date,
        description: `Penjualan Ayam Afkir: ${mutData.count} ekor @ Rp${mutData.pricePerBird?.toLocaleString()}`,
        qty: `${mutData.count} ekor`,
        price: mutData.pricePerBird || 0,
        total: mutData.totalPrice,
        account: 'Kas Tunai',
        type: 'INCOME',
        category: 'Penjualan Afkir'
      });
    }

    const newMut: PopulationMutation = { 
      ...mutData, 
      id: `mut-${Date.now()}`,
      transactionId 
    };
    setMutations(prev => [newMut, ...prev]);

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

  const deleteMutation = (id: string) => {
    const mut = mutations.find(m => m.id === id);
    if (!mut) return;

    setMutations(prev => prev.filter(m => m.id !== id));

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
      deleteTransaction(mut.transactionId);
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
