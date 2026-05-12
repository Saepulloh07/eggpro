import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function calculateHDP(totalEggs: number, liveBirds: number) {
  if (liveBirds <= 0) return 0;
  return (totalEggs / liveBirds) * 100;
}

export function getEggCategoryRange(category: string) {
  switch (category) {
    case 'Remban': case 'BM': return 'Remban (19.5 - 20 kg)';
    case 'Bujang': case 'KRC': return 'Bujang (18 - 19.5 kg)';
    case 'Bujang Retak': case 'KRC Retak': return 'Bujang Retak';
    case 'KS': return 'KS (16 - 18 kg)';
    case 'KS Retak': return 'KS Retak';
    case 'Pelor': case 'PELOR': return 'Pelor (< 16 kg)';
    case 'Retak': case 'RETAK': return 'Telur Retak';
    case 'Pecah': case 'PECAH': return 'Abnormal/Pecah';
    default: return '';
  }
}
