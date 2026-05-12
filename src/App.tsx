/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AppProvider, useApp } from './AppContext';
import Layout from './Layout';
import Dashboard from './pages/Dashboard';
import Production from './pages/Production';
import Sales from './pages/Sales';
import Inventory from './pages/Inventory';
import Finance from './pages/Finance';
import Workers from './pages/Workers';
import Settings from './pages/Settings';
import Login from './pages/Login';
import FeedFormulation from './pages/FeedFormulation';
import Vaccine from './pages/Vaccine';
import Population from './pages/Population';

import { HouseProvider } from './HouseContext';

import { FlockProvider } from './FlockContext';
import { GlobalProvider, useGlobalData } from './GlobalContext';
import { UserRole } from './types';
import { ShieldOff } from 'lucide-react';
import { useHouse } from './HouseContext';

// ─── Access Denied Panel ──────────────────────────────────────────────────────

function AccessDenied({ tab }: { tab: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-8">
      <div className="w-16 h-16 bg-rose-50 border border-rose-200 rounded-sm flex items-center justify-center mb-6">
        <ShieldOff size={28} className="text-rose-400" />
      </div>
      <h2 className="text-lg font-black uppercase tracking-tight text-slate-900 italic">Akses Ditolak</h2>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">
        Role Anda tidak memiliki izin mengakses modul ini
      </p>
      <div className="mt-6 bg-rose-50 border border-rose-100 px-6 py-3">
        <p className="text-[10px] text-rose-600 font-bold uppercase tracking-widest">
          Hubungi SUPER_ADMIN untuk permintaan akses
        </p>
      </div>
    </div>
  );
}

// ─── App Content ──────────────────────────────────────────────────────────────

function AppContent() {
  const { user, isLoading, sidebarPermissions } = useApp();
  const { farmSettings, inventory, updateInventory, createOperationalExpense } = useGlobalData();
  const { houses } = useHouse();

  // WORKER defaults to production tab; others start at dashboard
  const defaultTab = user?.role === UserRole.WORKER ? 'production' : 'dashboard';
  const [activeTab, setActiveTab] = useState(defaultTab);
  
  // Daily Cron Job: Egg Allowance for Workers
  React.useEffect(() => {
    if (isLoading || !houses || houses.length === 0 || !inventory || inventory.length === 0) return;
    
    const today = new Date().toISOString().split('T')[0];
    const lastDeduction = localStorage.getItem('last_egg_allowance_date');
    
    if (lastDeduction !== today) {
      const allowancePerWorker = farmSettings.workerEggAllowancePerDay || 5;
      let totalDeducted = 0;
      
      houses.forEach(house => {
        const workers = house.workerCount || 0;
        if (workers > 0) {
          const deductionAmount = workers * allowancePerWorker;
          const eggStocks = inventory
            .filter(i => i.houseId === house.id && i.type === 'EGG_STOCK' && i.quantity > 0)
            .sort((a, b) => b.quantity - a.quantity); // Deduct from highest stock first
          
          let remainingToDeduct = deductionAmount;
          for (const stock of eggStocks) {
            if (remainingToDeduct <= 0) break;
            const amountToDeduct = Math.min(stock.quantity, remainingToDeduct);
            updateInventory(stock.id, -amountToDeduct);
            remainingToDeduct -= amountToDeduct;
          }
          
          totalDeducted += (deductionAmount - remainingToDeduct);
        }
      });
      
      if (totalDeducted > 0) {
          createOperationalExpense({
            date: today,
            description: `Jatah Telur Anak Kandang (${totalDeducted} butir)`,
            qty: `${totalDeducted} butir`,
            price: 0,
            total: totalDeducted * 2000, // Estimate 2000 per egg for cost
            account: 'Persediaan',
            category: 'Jatah Pekerja'
          }, 'acc-beban-gaji', 'acc-persediaan');
      }
      
      localStorage.setItem('last_egg_allowance_date', today);
    }
  }, [isLoading, houses, inventory, farmSettings, updateInventory, createOperationalExpense]);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-900">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-16 h-16 bg-white rounded-sm mb-6 shadow-[0_0_20px_rgba(255,255,255,0.1)] relative">
            <div className="absolute inset-0 border-2 border-amber-500 animate-ping opacity-20" />
          </div>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.5em]">Initializing...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Login />;

  const canAccess = (tab: string) => {
    return sidebarPermissions[user.role]?.includes(tab) ?? false;
  };

  const renderContent = () => {
    if (!canAccess(activeTab)) {
      return <AccessDenied tab={activeTab} />;
    }
    switch (activeTab) {
      case 'dashboard':       return <Dashboard />;
      case 'population':      return <Population />;
      case 'production':      return <Production />;
      case 'feedFormulation': return <FeedFormulation />;
      case 'vaccine':         return <Vaccine />;
      case 'sales':           return <Sales />;
      case 'inventory':       return <Inventory />;
      case 'finance':         return <Finance />;
      case 'workers':         return <Workers />;
      case 'settings':        return <Settings />;

      default:                return <Dashboard />;
    }
  };

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      {renderContent()}
    </Layout>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <AppProvider>
      <GlobalProvider>
        <FlockProvider>
          <HouseProvider>
            <AppContent />
          </HouseProvider>
        </FlockProvider>
      </GlobalProvider>
    </AppProvider>
  );
}
