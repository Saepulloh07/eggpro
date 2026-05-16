import React, { createContext, useContext, useState, useEffect } from 'react';
import localforage from 'localforage';
import { syncToDb, loadFromDbOrIndexedDB } from './syncUtils';
import { PoultryHouse } from './types';

interface HouseContextType {
  houses: PoultryHouse[];
  selectedHouseId: string;
  setSelectedHouseId: (id: string) => void;
  activeHouse: PoultryHouse | undefined;
  addHouse: (name: string, capacity?: number, area?: number, managerId?: string, purchaseDate?: string, purchasePrice?: number) => Promise<void>;
  updateHouse: (id: string, updates: Partial<PoultryHouse>) => void;
  deleteHouse: (id: string) => void;
}

const HouseContext = createContext<HouseContextType | undefined>(undefined);

export const HouseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [houses, setHouses] = useState<PoultryHouse[]>([]);
  const [selectedHouseId, setSelectedHouseId] = useState<string>('');

  useEffect(() => {
    if (houses.length > 0) syncToDb('poultry_houses', houses);
  }, [houses]);

  useEffect(() => {
    if (selectedHouseId) localforage.setItem('selected_house_id', selectedHouseId);
  }, [selectedHouseId]);

  useEffect(() => {
    loadFromDbOrIndexedDB('poultry_houses', (data) => {
      setHouses(data);
      if (data.length > 0 && !selectedHouseId) {
        setSelectedHouseId(data[0].id);
      }
    });
    localforage.getItem('selected_house_id').then(id => {
      if (id) setSelectedHouseId(id as string);
    });
  }, []);

  const activeHouse = houses.find(h => h.id === selectedHouseId) || houses[0];

  const addHouse = async (name: string, capacity = 0, area = 0, managerId?: string, purchaseDate?: string, purchasePrice?: number) => {
    const newHouse: PoultryHouse = {
      id: `h${Date.now()}`,
      name,
      capacity,
      area,
      managerId,
      purchaseDate,
      purchasePrice
    };
    setHouses(prev => [...prev, newHouse]);
    setSelectedHouseId(newHouse.id);

    // Auto-create Kas Kandang account in backend
    try {
      const apiUrl = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${apiUrl}/api/admin/create-house-kas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ houseId: newHouse.id, houseName: name })
      });
      if (res.ok) {
        console.log(`[HouseContext] Kas account created for house: ${name}`);
      }
    } catch(e) {
      console.warn('[HouseContext] Could not create kas account (offline?):', e);
    }
  };

  const updateHouse = (id: string, updates: Partial<PoultryHouse>) => {
    setHouses(prev => prev.map(h => h.id === id ? { ...h, ...updates } : h));
  };

  const deleteHouse = (id: string) => {
    setHouses(prev => {
      const filtered = prev.filter(h => h.id !== id);
      if (selectedHouseId === id && filtered.length > 0) {
        setSelectedHouseId(filtered[0].id);
      }
      return filtered;
    });
  };

  return (
    <HouseContext.Provider value={{
      houses, selectedHouseId, setSelectedHouseId, activeHouse,
      addHouse, updateHouse, deleteHouse
    }}>
      {children}
    </HouseContext.Provider>
  );
};

export const useHouse = () => {
  const context = useContext(HouseContext);
  if (!context) {
    throw new Error('useHouse must be used within a HouseProvider');
  }
  return context;
};
