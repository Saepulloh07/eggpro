/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
    Wallet,
    Plus,
    ArrowUpRight,
    ArrowDownRight,
    FileText,
    Calendar,
    Layers,
    Upload,
    Camera,
    Download,
    Save,
    BookOpen,
    Receipt,
    ShoppingCart,
    Edit2,
    ChevronLeft,
    ChevronRight,
    Egg,
    Coins,
    ClipboardList,
    Building2,
    BookCopy,
    BarChart3,
    Scale,
    TrendingUp,
    TrendingDown,
    CircleDollarSign,
    LayoutDashboard,
    Zap,
    Banknote,
    RefreshCw,
    Bird,
    Home,
    PiggyBank,
    BarChart2,
    Calculator,
    AlertTriangle,
    CheckCircle,
    XCircle
} from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import Modal from '../components/Modal';
import Swal from 'sweetalert2';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

import { useHouse } from '../HouseContext';
import { useGlobalData } from '../GlobalContext';
import { useFlock } from '../FlockContext';
import { EggCategory, Asset, AccountCategory, ExpenseCategory, SinkingFundType } from '../types';

export default function Finance() {
    const { activeHouse, houses } = useHouse();
    const { getActiveFlockByHouse } = useFlock();
    const { productionLogs, salesLogs, transactions, addModalAwal, updateTransaction, assets, updateAssetStatus, addAsset, updateAsset, farmSettings, addTransaction, journalEntries, journalLines, apArRecords, accounts, addAPARRecord, updateAPARRecord, addOperationalExpenseRecord, operationalExpenses, sinkingFundAllocations, realizeSinkingFund, getTrialBalance, getAccountBalance } = useGlobalData();

    const [activeTab, setActiveTab] = useState<'BUKU_TELUR' | 'BUKU_TRANSAKSI' | 'ASET' | 'AKUNTANSI' | 'PENGELUARAN' | 'BUKU_BESAR' | 'NERACA_SALDO'>('BUKU_TELUR');
    const [isOpexModalOpen, setIsOpexModalOpen] = useState(false);
    const [isApArModalOpen, setIsApArModalOpen] = useState(false);
    const [isSinkingModalOpen, setIsSinkingModalOpen] = useState(false);
    const [glAccountFilter, setGlAccountFilter] = useState('');
    const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
    const [editingAsset, setEditingAsset] = useState<any | null>(null);
    const [assetOwnershipType, setAssetOwnershipType] = useState<'BELI' | 'MILIK_PRIBADI'>('BELI');
    const [isModalAwalOpen, setIsModalAwalOpen] = useState(false);
    const [editingModal, setEditingModal] = useState<any | null>(null);
    const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
    const [isMaintenanceModalOpen, setIsMaintenanceModalOpen] = useState(false);

    // Pagination State
    const [prodPage, setProdPage] = useState(1);
    const [txPage, setTxPage] = useState(1);
    const ITEMS_PER_PAGE = 10;

    // HPP Calculator State
    const [hppMarginPct, setHppMarginPct] = useState(25); // margin keuntungan default 25%
    const [hppCadangan, setHppCadangan] = useState(0);    // cadangan risiko (manual input)

    // --- Filtering Data based on Scope ---
    const isKonsolidasi = !activeHouse;
    const filteredProdLogs = isKonsolidasi ? productionLogs : productionLogs.filter(p => p.houseId === activeHouse?.id);
    const filteredSalesLogs = isKonsolidasi ? salesLogs : salesLogs.filter(s => s.houseId === activeHouse?.id);

    // Transaksi dipisah per kandang atau semua
    const houseTransactions = isKonsolidasi ? transactions : transactions.filter(t => t.houseId === activeHouse?.id);
    const expenseTransactions = houseTransactions.filter(t => t.type === 'EXPENSE');
    const incomeTransactions = houseTransactions.filter(t => t.type === 'INCOME');
    const modalTransactions = houseTransactions.filter(t => t.type === 'MODAL');

    const houseAssets = isKonsolidasi ? assets : assets.filter(a => a.houseId === activeHouse?.id);

    // For BUKU_TRANSAKSI - separate into 3 ledgers
    const salesTransactions = houseTransactions.filter(t => t.type === 'INCOME' && (t.category === 'Penjualan' || t.category === 'Free Goods' || t.category === 'Penjualan Afkir'));
    const bahanTransactions = houseTransactions.filter(t => t.type === 'EXPENSE' && (
        t.category === 'Pembelian DOC' ||
        t.description.toLowerCase().includes('stok') ||
        t.description.toLowerCase().includes('pakan') ||
        t.description.toLowerCase().includes('bahan') ||
        t.description.toLowerCase().includes('beli stok') ||
        t.description.toLowerCase().includes('pembelian stok')
    ));
    const operasionalTransactions = houseTransactions.filter(t => t.type === 'EXPENSE' && !bahanTransactions.find(b => b.id === t.id));


    // --- Total Calculations ---
    const totalProduction = filteredProdLogs.reduce((acc, curr) => acc + (curr.totalButir ?? (curr as any).totalKg ?? 0), 0);
    const totalSalesTelur = filteredSalesLogs.reduce((acc, curr) => acc + curr.total, 0);
    const totalExpenses = expenseTransactions.reduce((acc, curr) => acc + curr.total, 0);
    const totalIncome = incomeTransactions.reduce((acc, curr) => acc + curr.total, 0);
    const totalModalAwal = modalTransactions.reduce((acc, curr) => acc + curr.total, 0);

    // Accounting Logic
    const totalAllRevenue = totalIncome; // totalIncome includes sales (auto-added to transactions)
    const netProfit = totalAllRevenue - totalExpenses;
    const currentCapital = totalModalAwal + netProfit;

    const activeFlock = getActiveFlockByHouse(activeHouse?.id || '');
    const currentPopulation = activeFlock?.currentCount || 0;

    const sinkingFundAmount = netProfit > 0 ? netProfit * ((farmSettings.sinkingFundPct || 10) / 100) : 0;
    const netProfitAfterFund = netProfit > 0 ? netProfit - sinkingFundAmount : netProfit;

    // Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Egg Categorization Helpers Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    const getNormalButir = (log: typeof filteredProdLogs[0]) =>
        (log.breakdown[EggCategory.BM] || 0) +
        (log.breakdown[EggCategory.KRC] || 0) +
        (log.breakdown[EggCategory.KS] || 0) +
        (log.breakdown[EggCategory.PELOR] || 0);

    const getRetakButir = (log: typeof filteredProdLogs[0]) =>
        (log.breakdown[EggCategory.KRC_RETAK] || 0) +
        (log.breakdown[EggCategory.KS_RETAK] || 0) +
        (log.breakdown[EggCategory.RETAK] || 0);

    const getPecahButir = (log: typeof filteredProdLogs[0]) =>
        (log.breakdown[EggCategory.PECAH] || 0) + (log.discardedEggs || 0);

    const getSoldByDate = (date: string, category: 'NORMAL' | 'RETAK', isFree = false) => {
        const normalCats = ['BM', 'KRC', 'KS', 'PELOR', 'Remban', 'Bujang', EggCategory.BM, EggCategory.KRC, EggCategory.KS, EggCategory.PELOR];
        const retakCats = ['KRC_RETAK', 'KS_RETAK', 'RETAK', 'Bujang Retak', 'KS Retak', 'Retak', EggCategory.KRC_RETAK, EggCategory.KS_RETAK, EggCategory.RETAK];
        const cats = category === 'NORMAL' ? normalCats : retakCats;
        return filteredSalesLogs
            .filter(s => s.date === date && cats.includes(s.category) && !!s.isFree === isFree)
            .reduce((a, b) => a + b.quantity, 0);
    };

    const totalNormal = filteredProdLogs.reduce((a, b) => a + getNormalButir(b), 0);
    const totalRetak = filteredProdLogs.reduce((a, b) => a + getRetakButir(b), 0);
    const totalPecah = filteredProdLogs.reduce((a, b) => a + getPecahButir(b), 0);

    const totalNormalSold = filteredProdLogs.reduce((a, b) => a + getSoldByDate(b.date, 'NORMAL', false), 0);
    const totalNormalFree = filteredProdLogs.reduce((a, b) => a + getSoldByDate(b.date, 'NORMAL', true), 0);
    const totalRetakSold = filteredProdLogs.reduce((a, b) => a + getSoldByDate(b.date, 'RETAK', false), 0);
    const totalRetakFree = filteredProdLogs.reduce((a, b) => a + getSoldByDate(b.date, 'RETAK', true), 0);

    // Calculate daily balance flow
    const productionWithBalance = useMemo(() => {
        const sortedLogs = [...filteredProdLogs].sort((a, b) => a.date.localeCompare(b.date));
        let runningBalance = 0;
        return sortedLogs.map(log => {
            const prod = log.totalButir ?? (log as any).totalKg ?? 0;
            const soldN = getSoldByDate(log.date, 'NORMAL', false);
            const freeN = getSoldByDate(log.date, 'NORMAL', true);
            const soldR = getSoldByDate(log.date, 'RETAK', false);
            const freeR = getSoldByDate(log.date, 'RETAK', true);
            const waste = log.discardedEggs || 0;
            const totalOut = soldN + freeN + soldR + freeR + waste;

            const opening = runningBalance;
            runningBalance += (prod - totalOut);
            const closing = runningBalance;

            return { ...log, opening, closing, totalOut, soldN, freeN, soldR, freeR, waste };
        }).reverse(); // Latest first for display
    }, [filteredProdLogs, filteredSalesLogs]);

    const paginatedBalanceLogs = productionWithBalance.slice((prodPage - 1) * ITEMS_PER_PAGE, prodPage * ITEMS_PER_PAGE);

    const calculateDepreciation = (asset: Asset) => {
        const purchaseDate = new Date(asset.purchaseDate);
        const today = new Date();
        const diffMonths = (today.getFullYear() - purchaseDate.getFullYear()) * 12 + (today.getMonth() - purchaseDate.getMonth());

        const salvageValue = asset.salvageValue || 0;
        const depreciableAmount = asset.purchasePrice - salvageValue;

        // Garis Lurus: (Harga Beli - Nilai Sisa) / Umur Ekonomis
        const totalDepreciation = (depreciableAmount / (asset.expectedLifeYears * 12)) * Math.max(0, diffMonths);
        return Math.min(depreciableAmount, totalDepreciation);
    };

    const handleUpdateStatus = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedAssetId) return;
        const formData = new FormData(e.target as HTMLFormElement);
        const status = formData.get('status') as any;
        const notes = formData.get('notes') as string;
        const user = "Owner / Admin";

        updateAssetStatus(selectedAssetId, status, user, notes);
        Swal.fire({ title: 'Berhasil!', text: 'Status aset telah diperbarui.', icon: 'success', confirmButtonColor: '#0f172a' });
        setIsMaintenanceModalOpen(false);
    };

    const handleSaveAsset = (e: React.FormEvent) => {
        e.preventDefault();
        const formData = new FormData(e.target as HTMLFormElement);

        const name = formData.get('name') as string;
        const category = formData.get('category') as string;
        const purchasePrice = Number(formData.get('purchasePrice'));
        const salvageValue = Number(formData.get('salvageValue') || 0);
        const purchaseDate = formData.get('purchaseDate') as string;
        const expectedLifeYears = Number(formData.get('expectedLifeYears'));

        if (editingAsset) {
            updateAsset(editingAsset.id, {
                name,
                category,
                purchasePrice,
                salvageValue,
                purchaseDate,
                expectedLifeYears,
            });
            Swal.fire({ title: 'Berhasil!', text: 'Aset telah diperbarui.', icon: 'success', confirmButtonColor: '#0f172a' });
        } else {
            addAsset({
                houseId: activeHouse?.id || '',
                name,
                category,
                purchasePrice,
                salvageValue,
                purchaseDate,
                expectedLifeYears,
                condition: 'BAIK'
            });

            // Hanya catat ke buku kas jika jenis perolehan adalah BELI (bukan Milik Pribadi)
            if (assetOwnershipType === 'BELI') {
                const accountId = formData.get('accountId') as string;
                const selectedAcc = accounts.find(a => a.id === accountId) || accounts.find(a => a.isCashOrBank) || accounts[0];

                addTransaction({
                    houseId: activeHouse?.id,
                    date: purchaseDate,
                    description: `Pembelian Aset: ${name} (${category})`,
                    qty: '1 Unit',
                    price: purchasePrice,
                    total: purchasePrice,
                    account: selectedAcc.name,
                    type: 'EXPENSE',
                    category: 'Aset'
                });
                Swal.fire({ title: 'Berhasil!', text: 'Aset telah didaftarkan dan tercatat sebagai pengeluaran di Buku Kas.', icon: 'success', confirmButtonColor: '#0f172a' });
            } else {
                Swal.fire({ title: 'Berhasil!', text: 'Aset (Milik Pribadi) telah didaftarkan. Tidak dicatat sebagai pembelian di Buku Kas.', icon: 'success', confirmButtonColor: '#0f172a' });
            }
        }

        setIsAssetModalOpen(false);
        setAssetOwnershipType('BELI');
    };

    const handleExportExcel = async () => {
        const wb = new ExcelJS.Workbook();
        wb.creator = 'PoultryMind';
        wb.created = new Date();

        const DARK = 'FF0F172A'; const WHITE = 'FFFFFFFF';
        const GREEN_BG = 'FF064E3B'; const AMBER_BG = 'FF78350F'; const ROSE_BG = 'FF881337';
        const LIGHT_GRAY = 'FFF1F5F9'; const LIGHT_GREEN = 'FFD1FAE5'; const LIGHT_ROSE = 'FFFFE4E6';

        const styleHeader = (cell: ExcelJS.Cell, bg = DARK) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
            cell.font = { bold: true, color: { argb: WHITE }, size: 10 };
            cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            cell.border = { top: { style: 'thin', color: { argb: 'FF334155' } }, left: { style: 'thin', color: { argb: 'FF334155' } }, bottom: { style: 'thin', color: { argb: 'FF334155' } }, right: { style: 'thin', color: { argb: 'FF334155' } } };
        };
        const styleData = (cell: ExcelJS.Cell, even = false) => {
            cell.fill = even ? { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_GRAY } } : { type: 'pattern', pattern: 'solid', fgColor: { argb: WHITE } };
            cell.border = { top: { style: 'hair' }, left: { style: 'hair' }, bottom: { style: 'hair' }, right: { style: 'hair' } };
            cell.alignment = { vertical: 'middle' };
        };
        const addSheetTitle = (ws: ExcelJS.Worksheet, title: string, subtitle: string, cols: number) => {
            ws.mergeCells(`A1:${String.fromCharCode(64 + cols)}1`);
            const t = ws.getCell('A1'); t.value = title;
            t.font = { bold: true, size: 14, color: { argb: DARK } };
            t.alignment = { horizontal: 'center' };
            t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
            ws.mergeCells(`A2:${String.fromCharCode(64 + cols)}2`);
            const s = ws.getCell('A2'); s.value = subtitle;
            s.font = { size: 9, italic: true, color: { argb: 'FF64748B' } };
            s.alignment = { horizontal: 'center' };
            ws.getRow(1).height = 24; ws.getRow(2).height = 16;
        };
        const formatIDR = '#,##0';

        // Ã¢â€â‚¬Ã¢â€â‚¬ SHEET 1: BUKU TELUR Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
        const s1 = wb.addWorksheet('BUKU TELUR');
        s1.columns = [8, 12, 12, 12, 12, 12, 12, 12, 12, 14, 10, 14].map(w => ({ width: w }));
        addSheetTitle(s1, 'BUKU PRODUKSI TELUR', `Populasi: ${currentPopulation.toLocaleString()} ekor · Dicetak: ${new Date().toLocaleDateString('id-ID')}`, 12);
        const h1 = ['Tanggal', 'Normal', '', '', 'Retak', '', '', 'Pecah', '', 'Total (butir)', 'HDP %', 'Keterangan'];
        const sh1 = ['', 'Produksi', 'Jual', 'Free', 'Produksi', 'Jual', 'Free', 'Produksi', 'Buang', '', '', ''];
        s1.getRow(4).values = h1; s1.getRow(5).values = sh1;
        ['A4:A5', 'B4:D4', 'E4:G4', 'H4:I4', 'J4:J5', 'K4:K5', 'L4:L5'].forEach(m => s1.mergeCells(m));
        ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'].forEach(c => { styleHeader(s1.getCell(`${c}4`)); styleHeader(s1.getCell(`${c}5`)); });
        s1.getRow(4).height = 20; s1.getRow(5).height = 16;
        filteredProdLogs.forEach((row, i) => {
            const r = 6 + i; const even = i % 2 === 1;
            s1.getRow(r).values = [
                new Date(row.date).toLocaleDateString('id-ID'), getNormalButir(row), getSoldByDate(row.date, 'NORMAL', false), getSoldByDate(row.date, 'NORMAL', true),
                getRetakButir(row), getSoldByDate(row.date, 'RETAK', false), getSoldByDate(row.date, 'RETAK', true), row.breakdown[EggCategory.PECAH] || 0,
                row.discardedEggs || 0, row.totalButir ?? (row as any).totalKg ?? 0, +((row.eggCount / (currentPopulation || 1)) * 100).toFixed(2), ''
            ];
            ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'].forEach(c => styleData(s1.getCell(`${c}${r}`), even));
            s1.getRow(r).height = 16;
        });
        const tr1 = 6 + filteredProdLogs.length;
        s1.getRow(tr1).values = ['TOTAL', ...['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'].map(c => ({ formula: `SUM(${c}6:${c}${tr1 - 1})` })), '', ''];
        ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'].forEach(c => {
            const cell = s1.getCell(`${c}${tr1}`);
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
            cell.font = { bold: true };
        });

        // Helper: build a transaction sheet
        const buildTxSheet = (name: string, title: string, subtitle: string, txList: typeof houseTransactions, headerBg: string) => {
            const ws = wb.addWorksheet(name);
            ws.columns = [6, 14, 32, 14, 18, 18, 14, 20].map(w => ({ width: w }));
            addSheetTitle(ws, title, subtitle, 8);
            const headers = ['No', 'Tanggal Transaksi', 'Barang / Jasa', 'Qty', 'Harga Satuan (Rp)', 'Total Harga (Rp)', 'Tgl Bayar', 'Nama Request'];
            ws.getRow(4).values = headers;
            headers.forEach((_, ci) => styleHeader(ws.getCell(4, ci + 1), headerBg));
            ws.getRow(4).height = 20;
            let runTotal = 0;
            txList.forEach((t, i) => {
                const r = 5 + i; const even = i % 2 === 1;
                runTotal += t.total;
                ws.getRow(r).values = [i + 1, new Date(t.date).toLocaleDateString('id-ID'), t.description, t.qty, t.price || 0, t.total, new Date(t.date).toLocaleDateString('id-ID'), t.account || '-'];
                [1, 2, 3, 4, 5, 6, 7, 8].forEach(ci => styleData(ws.getCell(r, ci), even));
                ws.getCell(r, 5).numFmt = formatIDR; ws.getCell(r, 6).numFmt = formatIDR;
                ws.getCell(r, 1).alignment = { horizontal: 'center' };
                ws.getRow(r).height = 16;
            });
            const lr = 5 + txList.length;
            ws.mergeCells(`A${lr}:E${lr}`);
            ws.getCell(`A${lr}`).value = `TOTAL ${name.toUpperCase()}`;
            ws.getCell(`A${lr}`).font = { bold: true, size: 10 };
            ws.getCell(`A${lr}`).alignment = { horizontal: 'right' };
            ws.getCell(`F${lr}`).value = runTotal;
            ws.getCell(`F${lr}`).numFmt = formatIDR;
            ws.getCell(`F${lr}`).font = { bold: true, size: 11 };
            [ws.getCell(`A${lr}`), ws.getCell(`F${lr}`), ws.getCell(`G${lr}`), ws.getCell(`H${lr}`)].forEach(c => {
                c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
            });
            return runTotal;
        };

        const totalPenjualan = buildTxSheet('PENJUALAN TELUR', 'BUKU PENJUALAN TELUR', `Jurnal Pendapatan · ${new Date().toLocaleDateString('id-ID')}`, salesTransactions, GREEN_BG);
        const totalBahan = buildTxSheet('PENGELUARAN BAHAN', 'BUKU PENGELUARAN BAHAN', `Pembelian Pakan, Obat & Bahan Baku · ${new Date().toLocaleDateString('id-ID')}`, bahanTransactions, AMBER_BG);
        const totalOperasional = buildTxSheet('PENGELUARAN OPERASIONAL', 'BUKU PENGELUARAN OPERASIONAL', `Gaji, Aset & Biaya Tetap · ${new Date().toLocaleDateString('id-ID')}`, operasionalTransactions, ROSE_BG);

        // Ã¢â€â‚¬Ã¢â€â‚¬ SHEET: MODAL MASUK Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
        const sm = wb.addWorksheet('MODAL MASUK');
        sm.columns = [6, 30, 20, 14].map(w => ({ width: w }));
        addSheetTitle(sm, 'RINCIAN MODAL MASUK', `Total Modal: Rp ${totalModalAwal.toLocaleString('id-ID')}`, 4);
        sm.getRow(4).values = ['No', 'Keterangan', 'Nominal (Rp)', 'Tanggal'];
        [1, 2, 3, 4].forEach(ci => styleHeader(sm.getCell(4, ci), DARK));
        sm.getRow(4).height = 20;
        modalTransactions.forEach((m, i) => {
            const r = 5 + i;
            sm.getRow(r).values = [i + 1, m.description, m.total, new Date(m.date).toLocaleDateString('id-ID')];
            [1, 2, 3, 4].forEach(ci => styleData(sm.getCell(r, ci), i % 2 === 1));
            sm.getCell(r, 3).numFmt = formatIDR;
        });

        // Ã¢â€â‚¬Ã¢â€â‚¬ SHEET: LAPORAN LABA RUGI Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
        const sl = wb.addWorksheet('LABA RUGI');
        sl.columns = [35, 22].map(w => ({ width: w }));
        addSheetTitle(sl, 'LAPORAN LABA RUGI', `Periode s/d ${new Date().toLocaleDateString('id-ID')} · ${activeHouse?.name || 'Semua Kandang'}`, 2);
        const labaData: [string, number, boolean][] = [
            ['PENDAPATAN', '', false] as any,
            ['  Penjualan Telur', totalPenjualan, false],
            ['  Lain-lain (Pendapatan Lainnya)', totalIncome - totalPenjualan > 0 ? totalIncome - totalPenjualan : 0, false],
            ['TOTAL PENDAPATAN', totalIncome, true],
            ['', '', false] as any,
            ['BEBAN & PENGELUARAN', '', false] as any,
            ['  Beban Bahan & Stok', totalBahan, false],
            ['  Beban Operasional & Gaji', totalOperasional, false],
            ['TOTAL BEBAN', totalBahan + totalOperasional, true],
            ['', '', false] as any,
            ['LABA / (RUGI) BERSIH', netProfit, true],
            ['Modal Awal (Ekuitas)', totalModalAwal, false],
            ['MODAL AKHIR (EKUITAS)', currentCapital, true],
        ];
        labaData.forEach(([label, value, isBold], i) => {
            const r = 4 + i;
            const la = sl.getCell(r, 1); const va = sl.getCell(r, 2);
            la.value = label; va.value = typeof value === 'number' ? value : '';
            if (typeof value === 'number') va.numFmt = formatIDR;
            if (isBold) { la.font = { bold: true, size: 10 }; va.font = { bold: true, size: 10 }; }
            if (label === 'LABA / (RUGI) BERSIH') {
                [la, va].forEach(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: netProfit >= 0 ? LIGHT_GREEN : LIGHT_ROSE } }; c.font = { bold: true, size: 12 }; });
            }
            sl.getRow(r).height = 18;
        });

        // Ã¢â€â‚¬Ã¢â€â‚¬ SHEET 5: ASET & PENYUSUTAN Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
        const s4 = wb.addWorksheet('ASET');
        s4.columns = [6, 28, 20, 14, 18, 12, 18, 18].map(w => ({ width: w }));
        addSheetTitle(s4, 'DAFTAR ASET & PENYUSUTAN', `Metode: Garis Lurus · ${new Date().toLocaleDateString('id-ID')}`, 8);
        s4.getRow(4).values = ['No', 'Nama Aset', 'Kategori', 'Tgl Perolehan', 'Nilai Beli (Rp)', 'Kondisi', 'Akum. Penyusutan (Rp)', 'Nilai Buku (Rp)'];
        [1, 2, 3, 4, 5, 6, 7, 8].forEach(ci => styleHeader(s4.getCell(4, ci), DARK));
        s4.getRow(4).height = 22;
        houseAssets.forEach((asset, i) => {
            const dep = calculateDepreciation(asset); const r = 5 + i;
            s4.getRow(r).values = [i + 1, asset.name, asset.category, new Date(asset.purchaseDate).toLocaleDateString('id-ID'), asset.purchasePrice, asset.condition, dep, asset.purchasePrice - dep];
            [1, 2, 3, 4, 5, 6, 7, 8].forEach(ci => styleData(s4.getCell(r, ci), i % 2 === 1));
            [5, 7, 8].forEach(ci => { s4.getCell(r, ci).numFmt = formatIDR; });
        });

        // ── SHEET: BUKU KAS UMUM ──────────────────────────────────────────────────────
        const skbu = wb.addWorksheet('BUKU KAS UMUM');
        skbu.columns = [6, 14, 40, 14, 18, 18, 20].map(w => ({ width: w }));
        addSheetTitle(skbu, 'BUKU KAS UMUM', `Kandang: ${activeHouse?.name || 'Semua'} · Dicetak: ${new Date().toLocaleDateString('id-ID')}`, 7);
        skbu.getRow(4).values = ['No', 'Tanggal', 'Keterangan', 'Jenis', 'Debit (Masuk)', 'Kredit (Keluar)', 'Akun'];
        [1, 2, 3, 4, 5, 6, 7].forEach(ci => styleHeader(skbu.getCell(4, ci), DARK));
        skbu.getRow(4).height = 20;
        let runDebit = 0, runKredit = 0;
        houseTransactions.forEach((t, i) => {
            const r = 5 + i; const even = i % 2 === 1;
            const isDebit = t.type === 'INCOME' || t.type === 'MODAL';
            const debitVal = isDebit ? t.total : 0;
            const kreditVal = !isDebit ? t.total : 0;
            runDebit += debitVal; runKredit += kreditVal;
            skbu.getRow(r).values = [i + 1, new Date(t.date).toLocaleDateString('id-ID'), t.description, t.type, debitVal || '', kreditVal || '', t.account];
            [1, 2, 3, 4, 5, 6, 7].forEach(ci => styleData(skbu.getCell(r, ci), even));
            if (debitVal) { skbu.getCell(r, 5).numFmt = formatIDR; skbu.getCell(r, 5).font = { bold: true, color: { argb: 'FF065F46' } }; }
            if (kreditVal) { skbu.getCell(r, 6).numFmt = formatIDR; skbu.getCell(r, 6).font = { bold: true, color: { argb: 'FF9F1239' } }; }
            skbu.getRow(r).height = 16;
        });
        const lrKBU = 5 + houseTransactions.length;
        skbu.mergeCells(`A${lrKBU}:D${lrKBU}`);
        skbu.getCell(`A${lrKBU}`).value = 'TOTAL';
        skbu.getCell(`A${lrKBU}`).font = { bold: true };
        skbu.getCell(`E${lrKBU}`).value = runDebit; skbu.getCell(`E${lrKBU}`).numFmt = formatIDR; skbu.getCell(`E${lrKBU}`).font = { bold: true };
        skbu.getCell(`F${lrKBU}`).value = runKredit; skbu.getCell(`F${lrKBU}`).numFmt = formatIDR; skbu.getCell(`F${lrKBU}`).font = { bold: true };
        [skbu.getCell(`A${lrKBU}`), skbu.getCell(`E${lrKBU}`), skbu.getCell(`F${lrKBU}`), skbu.getCell(`G${lrKBU}`)].forEach(c => {
            c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
        });

        // ── SHEET: HUTANG & PIUTANG (AP/AR) ──────────────────────────────────────────
        const houseApAr = apArRecords.filter(r => !activeHouse || r.houseId === activeHouse.id || !r.houseId);
        const sapar = wb.addWorksheet('HUTANG & PIUTANG');
        sapar.columns = [8, 14, 28, 20, 18, 18, 12].map(w => ({ width: w }));
        addSheetTitle(sapar, 'BUKU HUTANG & PIUTANG (AP / AR)', `Total Records: ${houseApAr.length}`, 7);
        sapar.getRow(4).values = ['No', 'Jatuh Tempo', 'Nama Mitra', 'Keterangan', 'Total Tagihan (Rp)', 'Sisa Terutang (Rp)', 'Status'];
        [1, 2, 3, 4, 5, 6, 7].forEach(ci => styleHeader(sapar.getCell(4, ci), DARK));
        sapar.getRow(4).height = 20;
        houseApAr.forEach((r, i) => {
            const row = 5 + i; const even = i % 2 === 1;
            sapar.getRow(row).values = [i + 1, r.dueDate ? new Date(r.dueDate).toLocaleDateString('id-ID') : '-', r.entityName, r.description || '-', r.amount, r.remainingAmount, r.status];
            [1, 2, 3, 4, 5, 6, 7].forEach(ci => styleData(sapar.getCell(row, ci), even));
            [5, 6].forEach(ci => { sapar.getCell(row, ci).numFmt = formatIDR; });
            // Color HUTANG red, PIUTANG green
            const isHutang = (r as any).type === 'HUTANG';
            sapar.getCell(row, 5).font = { bold: true, color: { argb: isHutang ? 'FF9F1239' : 'FF065F46' } };
            sapar.getRow(row).height = 16;
        });

        const buffer = await wb.xlsx.writeBuffer();
        saveAs(new Blob([buffer]), `Laporan_Keuangan_${activeHouse?.name || 'Farm'}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    };


    const handleAddModalSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const formData = new FormData(e.target as HTMLFormElement);
        const amount = Number(formData.get('amount'));
        const desc = formData.get('description') as string;

        if (amount > 0) {
            const accountId = formData.get('accountId') as string;
            const houseId = formData.get('houseId') as string;
            if (editingModal) {
                updateTransaction(editingModal.id, { total: amount, price: amount, description: desc, houseId });
                Swal.fire({ title: 'Berhasil!', text: 'Modal telah diubah.', icon: 'success', confirmButtonColor: '#0f172a' });
            } else {
                addModalAwal(amount, desc, houseId, accountId);
                Swal.fire({ title: 'Berhasil!', text: 'Modal telah ditambahkan.', icon: 'success', confirmButtonColor: '#0f172a' });
            }
            setIsModalAwalOpen(false);
        }
    };

    const NeracaSaldo = () => {
        const tb = getTrialBalance(activeHouse?.id);
        const totalDebit = tb.reduce((s, r) => s + r.debit, 0);
        const totalCredit = tb.reduce((s, r) => s + r.credit, 0);
        const isBalanced = Math.abs(totalDebit - totalCredit) < 1;
        return (
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Neraca Saldo (Trial Balance)</h3>
                    <span className={cn("px-3 py-1.5 text-[10px] font-black uppercase tracking-widest border rounded-lg", isBalanced ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200')}>
                        {isBalanced ? 'BALANCE' : '⚠ TIDAK BALANCE'}
                    </span>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-x-auto">
                    <table className="w-full text-left min-w-max">
                        <thead><tr className="bg-slate-900 text-white text-[9px] font-black uppercase tracking-widest">
                            <th className="px-4 py-3 rounded-tl-xl">Kode</th><th className="px-4 py-3">Nama Akun</th>
                            <th className="px-4 py-3">Kategori</th>
                            <th className="px-4 py-3 text-right">Debit</th><th className="px-4 py-3 text-right rounded-tr-xl">Kredit</th>
                        </tr></thead>
                        <tbody className="divide-y divide-slate-100 text-[11px] font-bold">
                            {Object.values(AccountCategory).map(cat => {
                                const rows = tb.filter(r => r.category === cat);
                                if (rows.length === 0) return null;
                                return (
                                    <React.Fragment key={cat}>
                                        <tr className="bg-slate-100"><td colSpan={5} className="px-4 py-1.5 text-[9px] font-black uppercase text-slate-500 tracking-widest">{cat}</td></tr>
                                        {rows.map(r => (
                                            <tr key={r.accountId} className="hover:bg-slate-50">
                                                <td className="px-4 py-2 font-mono text-slate-500">{r.code}</td>
                                                <td className="px-4 py-2 text-slate-800">{r.name}</td>
                                                <td className="px-4 py-2 text-slate-400">{r.category}</td>
                                                <td className="px-4 py-2 text-right text-emerald-600">{r.debit > 0 ? formatCurrency(r.debit) : '-'}</td>
                                                <td className="px-4 py-2 text-right text-rose-500">{r.credit > 0 ? formatCurrency(r.credit) : '-'}</td>
                                            </tr>
                                        ))}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                        <tfoot><tr className={cn("border-t-2 font-black text-[11px]", isBalanced ? 'border-emerald-300 bg-emerald-50' : 'border-rose-300 bg-rose-50')}>
                            <td colSpan={3} className="px-4 py-3 uppercase">TOTAL</td>
                            <td className="px-4 py-3 text-right text-emerald-700">{formatCurrency(totalDebit)}</td>
                            <td className="px-4 py-3 text-right text-rose-700">{formatCurrency(totalCredit)}</td>
                        </tr></tfoot>
                    </table>
                </div>
            </div>
        );
    };

    // Tab config with icons & labels
    const TABS = [
        { id: 'BUKU_TELUR', label: 'Buku Telur', Icon: Egg, short: 'Telur' },
        { id: 'BUKU_TRANSAKSI', label: 'Buku Kas', Icon: Coins, short: 'Kas' },
        { id: 'PENGELUARAN', label: 'Pengeluaran', Icon: ClipboardList, short: 'Biaya' },
        { id: 'ASET', label: 'Aset', Icon: Building2, short: 'Aset' },
        { id: 'AKUNTANSI', label: 'Akuntansi', Icon: BookCopy, short: 'Jurnal' },
        { id: 'BUKU_BESAR', label: 'Buku Besar', Icon: BarChart3, short: 'Besar' },
        { id: 'NERACA_SALDO', label: 'Neraca Saldo', Icon: Scale, short: 'Neraca' },
    ] as const;

    return (
        <>
            <div className="pb-24 md:pb-8 space-y-0">
                {/* Ã¢â€â‚¬Ã¢â€â‚¬ HEADER Ã¢â€â‚¬Ã¢â€â‚¬ */}
                <div className="bg-white border-b border-slate-200 px-4 md:px-6 py-4 sticky top-0 z-30 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <h1 className="text-base md:text-xl font-black text-slate-900 tracking-tight uppercase">Finance & Accounting</h1>
                            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest hidden md:block">Manajemen keuangan sesuai standar akuntansi peternakan</p>
                        </div>
                        <div className="flex items-center gap-2">
                            {/* Quick actions */}
                            <button onClick={() => setIsOpexModalOpen(true)}
                                className="hidden md:flex items-center gap-1.5 bg-amber-500 text-white px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-wide hover:bg-amber-600 transition-all shadow-sm">
                                <span>+</span> Biaya Harian
                            </button>
                            <button onClick={handleExportExcel}
                                className="hidden md:flex items-center gap-1.5 bg-slate-900 text-white px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-wide hover:bg-slate-800 transition-all shadow-sm">
                                <Download size={13} /> Export
                            </button>
                        </div>
                    </div>

                    {/* Ã¢â€â‚¬Ã¢â€â‚¬ KPI SUMMARY CARDS Ã¢â€â‚¬Ã¢â€â‚¬ */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4">
                        {[
                            { label: 'Total Pemasukan', val: formatCurrency(totalIncome), color: 'text-emerald-600', bg: 'bg-emerald-50', Icon: TrendingUp },
                            { label: 'Total Pengeluaran', val: formatCurrency(totalExpenses), color: 'text-rose-600', bg: 'bg-rose-50', Icon: TrendingDown },
                            { label: 'Laba / Rugi Bersih', val: (netProfit >= 0 ? '+' : '') + formatCurrency(netProfit), color: netProfit >= 0 ? 'text-emerald-700' : 'text-rose-700', bg: netProfit >= 0 ? 'bg-emerald-100' : 'bg-rose-100', Icon: netProfit >= 0 ? CheckCircle : XCircle },
                            { label: 'Modal Akhir', val: formatCurrency(currentCapital), color: 'text-amber-700', bg: 'bg-amber-50', Icon: CircleDollarSign },
                        ].map(kpi => (
                            <div key={kpi.label} className={cn('p-3 rounded-lg border', kpi.bg, 'border-opacity-50')}>
                                <div className="flex items-center gap-1.5 mb-0.5">
                                    <kpi.Icon size={11} className={kpi.color} />
                                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">{kpi.label}</p>
                                </div>
                                <p className={cn('text-sm md:text-base font-black', kpi.color)}>{kpi.val}</p>
                            </div>
                        ))}
                    </div>

                    {/* Ã¢â€â‚¬Ã¢â€â‚¬ TAB NAVIGATION (Desktop: horizontal, under header) Ã¢â€â‚¬Ã¢â€â‚¬ */}
                    <div className="hidden md:flex mt-4 gap-1 overflow-x-auto pb-0.5">
                        {TABS.map(tab => (
                            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
                                className={cn(
                                    "flex items-center gap-1.5 px-3 py-2 text-[10px] font-black uppercase tracking-wide rounded-lg whitespace-nowrap transition-all",
                                    activeTab === tab.id
                                        ? "bg-slate-900 text-white shadow-md"
                                        : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                                )}
                            >
                                <tab.Icon size={13} /> {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Ã¢â€â‚¬Ã¢â€â‚¬ MOBILE BOTTOM TAB BAR Ã¢â€â‚¬Ã¢â€â‚¬ */}
                <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 shadow-2xl">
                    <div className="flex overflow-x-auto">
                        {TABS.map(tab => (
                            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
                                className={cn(
                                    "flex flex-col items-center justify-center flex-1 min-w-[56px] py-2 px-1 transition-all",
                                    activeTab === tab.id ? "text-amber-600 border-t-2 border-amber-500 bg-amber-50" : "text-slate-400"
                                )}
                            >
                                <tab.Icon size={18} />
                                <span className="text-[8px] font-black uppercase mt-0.5">{tab.short}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Ã¢â€â‚¬Ã¢â€â‚¬ MAIN CONTENT AREA Ã¢â€â‚¬Ã¢â€â‚¬ */}
                <div className="p-4 md:p-6">
                    <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
                        {/* Ã¢â€â‚¬Ã¢â€â‚¬ SIDEBAR Ã¢â€â‚¬Ã¢â€â‚¬ */}
                        <div className="xl:col-span-1">
                            {/* Mobile: horizontal scroll card row */}
                            <div className="flex xl:flex-col gap-3 overflow-x-auto pb-2 xl:pb-0">
                                {/* Equity Card */}
                                <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 min-w-[200px] xl:min-w-0 flex-shrink-0 xl:flex-shrink">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-1"><Wallet size={11} /> Ringkasan Ekuitas</p>
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center">
                                            <span className="text-[10px] text-slate-500 font-bold">Modal Awal</span>
                                            <span className="text-[11px] font-black text-slate-700">{formatCurrency(totalModalAwal)}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-[10px] text-slate-500 font-bold">Laba/Rugi</span>
                                            <span className={cn("text-[11px] font-black", netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600')}>{netProfit >= 0 ? '+' : ''}{formatCurrency(netProfit)}</span>
                                        </div>
                                        <div className="flex justify-between items-center border-t border-slate-100 pt-2">
                                            <span className="text-[10px] text-slate-700 font-black uppercase">Ekuitas Akhir</span>
                                            <span className="text-sm font-black text-amber-600">{formatCurrency(currentCapital)}</span>
                                        </div>
                                    </div>
                                </div>
                                {/* Renovation Recommendation Card */}
                                {(() => {
                                    // --- Kalkulasi Alokasi Peremajaan ---
                                    // Rumus: Alokasi Bulanan = (Nilai Aset - Nilai Sisa) / (Umur Ekonomis * 12)
                                    const cageMonthly = (farmSettings.cageValueTotal - farmSettings.cageSalvageValue) / (farmSettings.cageLifeYears * 12);
                                    const layerMonthly = (farmSettings.layerValueTotal - farmSettings.layerSalvageValue) / (farmSettings.layerLifeYears * 12);

                                    // Akumulasi penyusutan sejak pembelian (berdasarkan tanggal flock aktif)
                                    const activeFlock2 = getActiveFlockByHouse(activeHouse?.id || '');
                                    const flockAgeMonths = activeFlock2
                                        ? Math.max(0, (new Date().getFullYear() - new Date(activeFlock2.arrivalDate).getFullYear()) * 12
                                            + (new Date().getMonth() - new Date(activeFlock2.arrivalDate).getMonth()))
                                        : 0;
                                    const layerEconomicMonths = farmSettings.layerLifeYears * 12;
                                    const layerRemainingMonths = Math.max(0, layerEconomicMonths - flockAgeMonths);
                                    const layerPctDepleted = Math.min(100, (flockAgeMonths / layerEconomicMonths) * 100);

                                    // Dana yang sudah terakumulasi (dari sinkingFundAllocations)
                                    const totalFundSaved = sinkingFundAllocations.reduce((s, a) => s + a.amount, 0);
                                    const targetLayerFund = farmSettings.layerValueTotal - farmSettings.layerSalvageValue;
                                    const targetCageFund = farmSettings.cageValueTotal - farmSettings.cageSalvageValue;
                                    const totalTarget = targetLayerFund + targetCageFund;

                                    return (
                                        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 min-w-[200px] xl:min-w-0 flex-shrink-0 xl:flex-shrink space-y-4">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1"><RefreshCw size={11} /> Rekomendasi Peremajaan</p>

                                            {/* Peremajaan Ayam */}
                                            <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg">
                                                <div className="flex justify-between items-center mb-1">
                                                    <p className="text-[9px] font-black uppercase text-amber-700 flex items-center gap-1"><Bird size={11} /> Ayam Layer</p>
                                                    <span className="text-[8px] font-bold text-amber-600">{flockAgeMonths} / {layerEconomicMonths} bln</span>
                                                </div>
                                                <div className="w-full bg-amber-200 rounded-full h-1.5 mb-2">
                                                    <div className="bg-amber-500 h-1.5 rounded-full transition-all" style={{ width: `${layerPctDepleted}%` }} />
                                                </div>
                                                <div className="flex justify-between text-[9px]">
                                                    <span className="text-slate-500 font-bold">Dana/bln</span>
                                                    <span className="font-black text-amber-700">{formatCurrency(layerMonthly)}</span>
                                                </div>
                                                <div className="flex justify-between text-[9px] mt-0.5">
                                                    <span className="text-slate-500 font-bold">Sisa waktu</span>
                                                    <span className="font-black text-rose-600">{layerRemainingMonths} bln</span>
                                                </div>
                                            </div>

                                            {/* Peremajaan Kandang */}
                                            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                                                <p className="text-[9px] font-black uppercase text-slate-600 mb-1 flex items-center gap-1"><Home size={11} /> Kandang &amp; Bangunan</p>
                                                <div className="flex justify-between text-[9px]">
                                                    <span className="text-slate-500 font-bold">Cadangan/bln</span>
                                                    <span className="font-black text-slate-700">{formatCurrency(cageMonthly)}</span>
                                                </div>
                                                <div className="flex justify-between text-[9px] mt-0.5">
                                                    <span className="text-slate-500 font-bold">Target total</span>
                                                    <span className="font-black text-slate-500">{formatCurrency(targetCageFund)}</span>
                                                </div>
                                            </div>

                                            {/* Progress Dana */}
                                            <div className="pt-2 border-t border-slate-100">
                                                <div className="flex justify-between text-[9px] mb-1">
                                                    <span className="text-slate-400 font-bold uppercase">Dana Terkumpul</span>
                                                    <span className="font-black text-emerald-600">{totalTarget > 0 ? Math.round(totalFundSaved / totalTarget * 100) : 0}%</span>
                                                </div>
                                                <div className="w-full bg-slate-100 rounded-full h-1.5">
                                                    <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, totalTarget > 0 ? totalFundSaved / totalTarget * 100 : 0)}%` }} />
                                                </div>
                                                <p className="text-[8px] text-slate-400 mt-1">{formatCurrency(totalFundSaved)} dari {formatCurrency(totalTarget)}</p>
                                            </div>
                                            <button onClick={() => setIsSinkingModalOpen(true)} className="w-full text-[9px] font-black uppercase tracking-widest text-slate-600 border border-slate-200 rounded-lg py-1.5 hover:bg-slate-50 transition-all flex items-center justify-center gap-1">
                                                <PiggyBank size={11} /> Catat Realisasi Dana
                                            </button>
                                        </div>
                                    );
                                })()}
                                {/* Quick Action Buttons */}
                                <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 min-w-[180px] xl:min-w-0 flex-shrink-0 xl:flex-shrink space-y-2">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-1"><Zap size={11} /> Aksi Cepat</p>
                                    <button onClick={() => { setEditingModal(null); setIsModalAwalOpen(true); }}
                                        className="w-full flex items-center gap-2 bg-slate-100 text-slate-800 py-2.5 px-3 rounded-lg text-[10px] font-black uppercase tracking-wide hover:bg-slate-200 transition-all">
                                        <Banknote size={13} /> Suntik Modal
                                    </button>
                                    <button onClick={() => setIsOpexModalOpen(true)}
                                        className="w-full flex items-center gap-2 bg-amber-50 text-amber-800 py-2.5 px-3 rounded-lg text-[10px] font-black uppercase tracking-wide hover:bg-amber-100 transition-all border border-amber-100">
                                        <ClipboardList size={13} /> Catat Pengeluaran
                                    </button>
                                    <button onClick={handleExportExcel}
                                        className="w-full flex items-center gap-2 bg-slate-900 text-white py-2.5 px-3 rounded-lg text-[10px] font-black uppercase tracking-wide hover:bg-slate-800 transition-all">
                                        <Download size={12} /> Laporan Excel
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Ã¢â€â‚¬Ã¢â€â‚¬ TAB CONTENT AREA Ã¢â€â‚¬Ã¢â€â‚¬ */}
                        <div className="xl:col-span-3 space-y-4">
                            {activeTab === 'BUKU_TELUR' && (
                                <div className="bg-white border border-slate-200 overflow-hidden shadow-sm">
                                    <div className="p-8 border-b border-slate-100 bg-slate-50/30">
                                        <h3 className="font-bold text-lg text-slate-900 uppercase tracking-tight italic">Buku Telur Produksi</h3>
                                    </div>

                                    <div className="overflow-x-auto p-4">
                                        <table className="w-full text-center border-collapse border border-slate-200 min-w-max">
                                            <thead>
                                                <tr className="bg-slate-900 text-white text-[9px] font-black uppercase tracking-widest border-b border-slate-700">
                                                    <th rowSpan={2} className="px-3 py-3 border border-slate-700">Tgl</th>
                                                    <th rowSpan={2} className="px-3 py-3 border border-slate-700 bg-slate-800">Stok Awal</th>
                                                    <th colSpan={3} className="px-2 py-3 border border-slate-700 bg-emerald-900/50">Masuk (Produksi)</th>
                                                    <th colSpan={2} className="px-2 py-3 border border-slate-700 bg-amber-900/50">Keluar</th>
                                                    <th rowSpan={2} className="px-3 py-3 border border-slate-700 bg-slate-800 text-emerald-400">Stok Akhir</th>
                                                    <th rowSpan={2} className="px-3 py-3 border border-slate-700 italic">HDP</th>
                                                </tr>
                                                <tr className="bg-slate-800 text-slate-300 text-[8px] font-bold uppercase tracking-wider">
                                                    <th className="px-2 py-2 border border-slate-700">Normal</th>
                                                    <th className="px-2 py-2 border border-slate-700">Retak</th>
                                                    <th className="px-2 py-2 border border-slate-700">Pecah</th>
                                                    <th className="px-2 py-2 border border-slate-700">Jual/Free</th>
                                                    <th className="px-2 py-2 border border-slate-700">Buang</th>
                                                </tr>
                                            </thead>
                                            <tbody className="text-[10px] text-slate-700 font-medium">
                                                {paginatedBalanceLogs.map((row, idx) => (
                                                    <tr key={idx} className="hover:bg-slate-50 border-b border-slate-100 transition-colors">
                                                        <td className="px-3 py-3 font-bold bg-slate-50/50">{new Date(row.date).toLocaleDateString('id-ID')}</td>
                                                        <td className="px-3 py-3 font-mono text-slate-400">{row.opening.toLocaleString()}</td>

                                                        {/* MASUK */}
                                                        <td className="px-2 py-3 font-bold text-emerald-600">{getNormalButir(row).toLocaleString()}</td>
                                                        <td className="px-2 py-3 text-emerald-500">{(row.breakdown[EggCategory.RETAK] || 0).toLocaleString()}</td>
                                                        <td className="px-2 py-3 text-emerald-400">{(row.breakdown[EggCategory.PECAH] || 0).toLocaleString()}</td>

                                                        {/* KELUAR */}
                                                        <td className="px-2 py-3 text-amber-600 font-bold">{(row.soldN + row.soldR + row.freeN + row.freeR).toLocaleString()}</td>
                                                        <td className="px-2 py-3 text-rose-400">{row.waste || '-'}</td>

                                                        <td className="px-3 py-3 font-black text-slate-900 bg-emerald-50/30">{row.closing.toLocaleString()}</td>
                                                        <td className="px-3 py-3 font-bold text-slate-400 italic">{((row.eggCount / (currentPopulation || 1)) * 100).toFixed(1)}%</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                            <tfoot className="bg-slate-50 font-black text-[10px] uppercase">
                                                <tr>
                                                    <td className="px-3 py-4">TOTAL</td>
                                                    <td></td>
                                                    <td className="px-2 py-4 text-emerald-600 font-bold">{totalNormal.toLocaleString()}</td>
                                                    <td className="px-2 py-4">{totalRetak.toLocaleString()}</td>
                                                    <td className="px-2 py-4">{totalPecah.toLocaleString()}</td>
                                                    <td className="px-2 py-4 text-amber-600">{(totalNormalSold + totalRetakSold + totalNormalFree + totalRetakFree).toLocaleString()}</td>
                                                    <td className="px-2 py-4 text-rose-400">{filteredProdLogs.reduce((a, b) => a + (b.discardedEggs || 0), 0).toLocaleString()}</td>
                                                    <td className="px-3 py-4 text-slate-900 bg-emerald-50/50 italic">
                                                        {productionWithBalance.length > 0 ? productionWithBalance[0].closing.toLocaleString() : 0}
                                                    </td>
                                                    <td></td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                    <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
                                        <span className="text-[10px] font-bold text-slate-500 uppercase">Page {prodPage} of {Math.ceil(productionWithBalance.length / ITEMS_PER_PAGE) || 1}</span>
                                        <div className="flex space-x-2">
                                            <button onClick={() => setProdPage(Math.max(1, prodPage - 1))} disabled={prodPage === 1} className="p-1 bg-white border border-slate-200 rounded-sm disabled:opacity-50"><ChevronLeft size={16} /></button>
                                            <button onClick={() => setProdPage(Math.min(Math.ceil(productionWithBalance.length / ITEMS_PER_PAGE), prodPage + 1))} disabled={prodPage >= Math.ceil(productionWithBalance.length / ITEMS_PER_PAGE)} className="p-1 bg-white border border-slate-200 rounded-sm disabled:opacity-50"><ChevronRight size={16} /></button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Ã¢â€â‚¬Ã¢â€â‚¬ HPP TELUR PANEL Ã¢â€â‚¬Ã¢â€â‚¬ */}
                            {activeTab === 'BUKU_TELUR' && (() => {
                                // ============================================================
                                // RUMUS HPP (Harga Pokok Produksi) TELUR PER BUTIR
                                // HPP/butir = (Total Biaya Produksi) / (Total Telur Diproduksi)
                                // Komponen biaya:
                                //   1. Biaya Pakan, 2. TK, 3. Susut Ayam, 4. Susut Kandang, 5. Ops, 6. Cadangan
                                const totalButirProduksi = filteredProdLogs.reduce((s, l) => s + (l.totalButir ?? 0), 0);
                                const totalFeedConsumedKg = filteredProdLogs.reduce((s, l) => s + (l.feedConsumed || 0), 0);

                                // Harga pakan aktual (weighted avg dari transaksi bahan)
                                const feedCostTotal = bahanTransactions.reduce((s, t) => s + t.total, 0);
                                const hargaPakanPerKg = totalFeedConsumedKg > 0 ? feedCostTotal / totalFeedConsumedKg : 0;

                                const totalDays = filteredProdLogs.length || 1;
                                const avgDailyProd = totalButirProduksi / totalDays;

                                // Penyusutan ayam per butir
                                const depLayerPerButir = farmSettings.layerLifeYears > 0 && avgDailyProd > 0
                                    ? (farmSettings.layerValueTotal - farmSettings.layerSalvageValue) / (farmSettings.layerLifeYears * 365 * avgDailyProd)
                                    : 0;

                                // Penyusutan kandang per butir
                                const depCagePerButir = farmSettings.cageLifeYears > 0 && avgDailyProd > 0
                                    ? (farmSettings.cageValueTotal - farmSettings.cageSalvageValue) / (farmSettings.cageLifeYears * 365 * avgDailyProd)
                                    : 0;

                                // Biaya pakan per butir
                                const biayaPakanPerButir = totalButirProduksi > 0
                                    ? (totalFeedConsumedKg * hargaPakanPerKg) / totalButirProduksi : 0;

                                // Biaya operasional lainnya per butir
                                const totalOpex = operationalExpenses.reduce((s, e) => s + e.amount, 0);
                                const biayaOpsPerButir = totalButirProduksi > 0 ? totalOpex / totalButirProduksi : 0;

                                // Biaya tenaga kerja per butir
                                const totalGaji = expenseTransactions
                                    .filter(t => t.category === 'Tenaga Kerja' || t.description.toLowerCase().includes('gaji'))
                                    .reduce((s, t) => s + t.total, 0);
                                const biayaTKPerButir = totalButirProduksi > 0 ? totalGaji / totalButirProduksi : 0;

                                // === TOTAL BIAYA PRODUKSI ===
                                const totalBiayaProduksi = bahanTransactions.reduce((s, t) => s + t.total, 0)
                                    + totalGaji + totalOpex
                                    + (depLayerPerButir + depCagePerButir) * (totalButirProduksi || 1);

                                // === HPP DASAR ===
                                const hppBase = totalButirProduksi > 0
                                    ? (totalBiayaProduksi + hppCadangan) / totalButirProduksi
                                    : 0;

                                // === HARGA JUAL FINAL ===
                                // Rumus: Harga_Jual = ((Biaya + Cadangan) / Total_Telur) Ãƒâ€” (1 + Margin/100)
                                const hargaJualBase = hppBase * (1 + hppMarginPct / 100);

                                // Komponen per butir untuk breakdown chart
                                const biayaPakanPerButirFull = totalBiayaProduksi > 0 && totalButirProduksi > 0
                                    ? feedCostTotal / totalButirProduksi : biayaPakanPerButir;

                                // Markup per kategori
                                const QUALITY_MULT: Record<string, number> = {
                                    'Remban': 1.00,
                                    'Bujang': 0.93,
                                    'KS': 0.88,
                                    'Pelor': 0.82,
                                    'Bujang Retak': 0.76,
                                    'KS Retak': 0.68,
                                    'Retak': 0.60,
                                    'Pecah': 0.38,
                                };

                                const components = [
                                    { label: 'Biaya Pakan', val: biayaPakanPerButirFull, color: 'bg-amber-400', icon: <ShoppingCart size={10} /> },
                                    { label: 'Tenaga Kerja', val: biayaTKPerButir, color: 'bg-blue-400', icon: <Receipt size={10} /> },
                                    { label: 'Susut Ayam', val: depLayerPerButir, color: 'bg-rose-400', icon: <Bird size={10} /> },
                                    { label: 'Susut Kandang', val: depCagePerButir, color: 'bg-slate-400', icon: <Home size={10} /> },
                                    { label: 'Biaya Ops Lain', val: biayaOpsPerButir, color: 'bg-purple-400', icon: <ClipboardList size={10} /> },
                                    { label: 'Cadangan Risiko', val: totalButirProduksi > 0 ? hppCadangan / totalButirProduksi : 0, color: 'bg-orange-400', icon: <AlertTriangle size={10} /> },
                                ];

                                return (
                                    <div className="bg-white border border-slate-200 shadow-sm">
                                        {/* Header */}
                                        <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-amber-50 to-white">
                                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                                                <div>
                                                    <h3 className="font-black text-sm text-amber-800 uppercase tracking-tight flex items-center gap-2">
                                                        <Calculator size={16} /> HPP &amp; Estimasi Harga Jual Telur
                                                    </h3>
                                                    <p className="text-[9px] text-amber-600 font-bold uppercase tracking-widest mt-0.5">
                                                        Rumus: Harga_Jual = ((Biaya + Cadangan) / Total_Butir) &times; (1 + Margin%)
                                                    </p>
                                                </div>
                                                {/* HPP Controls */}
                                                <div className="flex items-center gap-3 flex-wrap">
                                                    <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                                                        <label className="text-[9px] font-black uppercase text-amber-700 whitespace-nowrap">Margin %</label>
                                                        <input
                                                            type="number" min={0} max={200} step={1}
                                                            value={hppMarginPct}
                                                            onChange={e => setHppMarginPct(Number(e.target.value))}
                                                            className="w-16 bg-white border border-amber-300 rounded-sm px-2 py-1 text-sm font-black text-amber-800 focus:outline-none text-center"
                                                        />
                                                    </div>
                                                    <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
                                                        <label className="text-[9px] font-black uppercase text-orange-700 whitespace-nowrap">Cadangan Risiko (Rp)</label>
                                                        <input
                                                            type="number" min={0} step={100000}
                                                            value={hppCadangan}
                                                            onChange={e => setHppCadangan(Number(e.target.value))}
                                                            className="w-32 bg-white border border-orange-300 rounded-sm px-2 py-1 text-sm font-black text-orange-800 focus:outline-none"
                                                        />
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-[9px] text-slate-400 font-bold uppercase">Harga Jual / Butir (Grade A)</p>
                                                        <p className="text-xl font-black text-amber-700">{formatCurrency(Math.ceil(hargaJualBase / 50) * 50)}</p>
                                                        <p className="text-[9px] text-slate-400">HPP Dasar: {formatCurrency(hppBase)}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                                            {/* Komponen HPP */}
                                            <div className="space-y-2">
                                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-1"><BarChart2 size={12} /> Komponen HPP per Butir</p>
                                                {components.map(c => {
                                                    const pct = hppBase > 0 ? (c.val / hppBase) * 100 : 0;
                                                    return (
                                                        <div key={c.label}>
                                                            <div className="flex justify-between text-[10px] mb-0.5">
                                                                <span className="font-bold text-slate-600 flex items-center gap-1">{c.icon} {c.label}</span>
                                                                <span className="font-black text-slate-800">
                                                                    {formatCurrency(c.val)} <span className="text-slate-400 font-bold">({pct.toFixed(0)}%)</span>
                                                                </span>
                                                            </div>
                                                            <div className="w-full bg-slate-100 rounded-full h-1.5">
                                                                <div className={`${c.color} h-1.5 rounded-full transition-all`} style={{ width: `${Math.min(100, pct)}%` }} />
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                                {totalButirProduksi === 0 && (
                                                    <p className="text-[9px] text-slate-400 italic text-center py-4">Belum cukup data produksi untuk menghitung HPP</p>
                                                )}
                                                {/* Summary box */}
                                                <div className="mt-3 p-3 bg-slate-900 rounded-lg text-white">
                                                    <div className="flex justify-between text-[9px] mb-1">
                                                        <span className="text-slate-400 font-bold">Total Butir Diproduksi</span>
                                                        <span className="font-black">{totalButirProduksi.toLocaleString()} butir</span>
                                                    </div>
                                                    <div className="flex justify-between text-[9px] mb-1">
                                                        <span className="text-slate-400 font-bold">Total Biaya Produksi</span>
                                                        <span className="font-black">{formatCurrency(totalBiayaProduksi)}</span>
                                                    </div>
                                                    <div className="flex justify-between text-[9px] mb-1">
                                                        <span className="text-slate-400 font-bold">Cadangan Risiko</span>
                                                        <span className="font-black text-orange-400">{formatCurrency(hppCadangan)}</span>
                                                    </div>
                                                    <div className="border-t border-slate-700 pt-1 mt-1 flex justify-between text-[10px]">
                                                        <span className="text-amber-400 font-black">HPP / Butir</span>
                                                        <span className="font-black text-amber-400">{formatCurrency(hppBase)}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Estimasi harga jual per kategori */}
                                            <div>
                                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-1"><TrendingUp size={12} /> Estimasi Harga Jual / Kategori</p>
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-left min-w-max">
                                                        <thead><tr className="bg-slate-900 text-white text-[8px] font-black uppercase tracking-widest">
                                                            <th className="px-3 py-2">Kategori</th>
                                                            <th className="px-3 py-2 text-right">HPP</th>
                                                            <th className="px-3 py-2 text-right">Faktor</th>
                                                            <th className="px-3 py-2 text-right">Harga Jual</th>
                                                            <th className="px-3 py-2 text-right">Harga Master</th>
                                                            <th className="px-3 py-2 text-center">Status</th>
                                                        </tr></thead>
                                                        <tbody className="divide-y divide-slate-50 text-[10px]">
                                                            {Object.entries(QUALITY_MULT).map(([cat, qMult]) => {
                                                                const hargaJual = Math.ceil(hargaJualBase * qMult / 50) * 50;
                                                                const masterPrice = (farmSettings.masterPrices || []).find(p => p.name === cat)?.price;
                                                                const diff = masterPrice ? masterPrice - hargaJual : null;
                                                                const isProfit = diff !== null && diff >= 0;
                                                                return (
                                                                    <tr key={cat} className="hover:bg-slate-50">
                                                                        <td className="px-3 py-2 font-bold text-slate-700">{cat}</td>
                                                                        <td className="px-3 py-2 text-right font-mono text-slate-400 text-[9px]">{formatCurrency(hppBase * qMult)}</td>
                                                                        <td className="px-3 py-2 text-right font-bold text-amber-600">&times;{qMult.toFixed(2)}</td>
                                                                        <td className="px-3 py-2 text-right font-black text-emerald-700">{formatCurrency(hargaJual)}</td>
                                                                        <td className={`px-3 py-2 text-right font-bold ${diff !== null ? (isProfit ? 'text-emerald-600' : 'text-rose-600') : 'text-slate-300'}`}>
                                                                            {masterPrice ? `${formatCurrency(masterPrice)} (${diff! >= 0 ? '+' : ''}${diff!.toLocaleString()})` : '–'}
                                                                        </td>
                                                                        <td className="px-3 py-2 text-center">
                                                                            {masterPrice ? (isProfit
                                                                                ? <CheckCircle size={12} className="text-emerald-500 mx-auto" />
                                                                                : <XCircle size={12} className="text-rose-500 mx-auto" />
                                                                            ) : null}
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                                <p className="text-[8px] text-slate-400 mt-2 italic flex items-center gap-1">
                                                    <CheckCircle size={9} className="text-emerald-500" /> = harga master &gt; HPP (margin aman).
                                                    <XCircle size={9} className="text-rose-500" /> = harga master &lt; HPP (risiko rugi).
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}
                            {activeTab === 'BUKU_TRANSAKSI' && (
                                <div className="space-y-8">

                                    {/* SECTION 0: KAS & BANK BALANCES — Semua akun kas/bank */}
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                        {accounts.filter(a => a.isCashOrBank).map(acc => {
                                            const bal = getAccountBalance(acc.id);
                                            const balance = bal.debit - bal.credit;
                                            const isHouseKas = acc.id.startsWith('acc-kas-');
                                            const linkedHouse = isHouseKas
                                                ? houses.find(h => acc.houseId === h.id || acc.id === `acc-kas-${h.id}`)
                                                : null;
                                            return (
                                                <div key={acc.id} className={`bg-white border rounded-xl p-4 shadow-sm relative overflow-hidden group ${isHouseKas && activeHouse && linkedHouse?.id === activeHouse.id ? 'border-amber-400 ring-2 ring-amber-200' : 'border-slate-200'}`}>
                                                    <div className="absolute -right-4 -top-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                                        <Wallet size={80} />
                                                    </div>
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <div className={`p-1.5 rounded-lg ${isHouseKas ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}><Wallet size={14} /></div>
                                                        <div>
                                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{acc.name}</p>
                                                            {linkedHouse && <p className="text-[8px] text-amber-600 font-bold uppercase">{linkedHouse.name}</p>}
                                                        </div>
                                                    </div>
                                                    <p className={`text-lg font-black ${balance >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>{formatCurrency(balance)}</p>
                                                    <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase">No. Rek: {acc.code}</p>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* BUKU KAS UMUM — Semua transaksi per kandang */}
                                    <div className="bg-white border border-slate-200 overflow-hidden shadow-sm">
                                        <div className="px-8 py-5 border-b border-slate-100 bg-slate-900 flex items-center justify-between">
                                            <div>
                                                <h3 className="font-bold text-base text-white uppercase tracking-tight italic">Buku Kas Umum</h3>
                                                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Semua mutasi kas · {houseTransactions.length} transaksi</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Saldo Akhir</p>
                                                <p className={`text-lg font-black ${(totalIncome - totalExpenses) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{formatCurrency(totalIncome - totalExpenses + totalModalAwal)}</p>
                                            </div>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left border-collapse min-w-max">
                                                <thead>
                                                    <tr className="bg-slate-800 text-white text-[9px] font-black uppercase tracking-widest">
                                                        <th className="px-3 py-3 w-8">No</th>
                                                        <th className="px-3 py-3">Tanggal</th>
                                                        <th className="px-3 py-3">Keterangan</th>
                                                        <th className="px-3 py-3 text-center">Jenis</th>
                                                        <th className="px-3 py-3 text-right">Debit (Masuk)</th>
                                                        <th className="px-3 py-3 text-right">Kredit (Keluar)</th>
                                                        <th className="px-3 py-3">Akun</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="text-[10px] divide-y divide-slate-50">
                                                    {houseTransactions.length === 0 ? (
                                                        <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-400 font-bold uppercase text-[9px]">Belum ada transaksi di kandang ini</td></tr>
                                                    ) : [...houseTransactions].reverse().map((t, idx) => (
                                                        <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                                                            <td className="px-3 py-2.5 text-slate-400 font-bold">{idx + 1}</td>
                                                            <td className="px-3 py-2.5 font-bold text-slate-700">{new Date(t.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                                                            <td className="px-3 py-2.5 font-bold text-slate-800 max-w-[200px] truncate">{t.description}</td>
                                                            <td className="px-3 py-2.5 text-center">
                                                                <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${
                                                                    t.type === 'INCOME' ? 'bg-emerald-50 text-emerald-700' :
                                                                    t.type === 'EXPENSE' ? 'bg-rose-50 text-rose-700' :
                                                                    t.type === 'MODAL' ? 'bg-blue-50 text-blue-700' :
                                                                    'bg-slate-100 text-slate-600'
                                                                }`}>{t.type}</span>
                                                            </td>
                                                            <td className="px-3 py-2.5 text-right font-mono font-bold text-emerald-700">{(t.type === 'INCOME' || t.type === 'MODAL') ? formatCurrency(t.total) : '-'}</td>
                                                            <td className="px-3 py-2.5 text-right font-mono font-bold text-rose-600">{t.type === 'EXPENSE' ? formatCurrency(t.total) : '-'}</td>
                                                            <td className="px-3 py-2.5 text-slate-500 text-[9px]">{t.account}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                                {houseTransactions.length > 0 && (
                                                    <tfoot className="bg-slate-100 border-t-2 border-slate-300">
                                                        <tr>
                                                            <td colSpan={4} className="px-3 py-3 text-[9px] font-black uppercase tracking-widest text-slate-700">TOTAL</td>
                                                            <td className="px-3 py-3 text-right font-black text-emerald-700 font-mono">{formatCurrency(totalIncome + totalModalAwal)}</td>
                                                            <td className="px-3 py-3 text-right font-black text-rose-600 font-mono">{formatCurrency(totalExpenses)}</td>
                                                            <td />
                                                        </tr>
                                                    </tfoot>
                                                )}
                                            </table>
                                        </div>
                                    </div>


                                    {/* SECTION 1: PENJUALAN TELUR */}
                                    <div className="bg-white border border-slate-200 overflow-hidden shadow-sm">
                                        <div className="px-8 py-5 border-b border-slate-100 bg-emerald-50 flex items-center justify-between">
                                            <div>
                                                <h3 className="font-bold text-base text-emerald-800 uppercase tracking-tight italic">Buku Penjualan Telur</h3>
                                                <p className="text-[9px] text-emerald-600 font-bold uppercase tracking-widest mt-0.5">Jurnal Pendapatan · {salesTransactions.length} transaksi</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[9px] text-emerald-600 font-bold uppercase tracking-widest">Total Pendapatan</p>
                                                <p className="text-lg font-black text-emerald-700">{formatCurrency(salesTransactions.reduce((a, t) => a + t.total, 0))}</p>
                                            </div>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left border-collapse min-w-max">
                                                <thead>
                                                    <tr className="bg-slate-900 text-white text-[9px] font-black uppercase tracking-widest">
                                                        <th className="px-3 py-3 w-8">No</th>
                                                        <th className="px-3 py-3">Tanggal Transaksi</th>
                                                        <th className="px-3 py-3">Barang / Jasa</th>
                                                        <th className="px-3 py-3 text-center">Qty</th>
                                                        <th className="px-3 py-3 text-right">Harga Satuan</th>
                                                        <th className="px-3 py-3 text-right">Total Harga</th>
                                                        <th className="px-3 py-3">Tgl Bayar</th>
                                                        <th className="px-3 py-3">Nama Pembeli</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="text-[10px] divide-y divide-slate-50">
                                                    {salesTransactions.length === 0 ? (
                                                        <tr><td colSpan={8} className="px-4 py-6 text-center text-slate-400 font-bold uppercase text-[9px]">Belum ada data penjualan telur</td></tr>
                                                    ) : salesTransactions.map((t, idx) => (
                                                        <tr key={t.id} className="hover:bg-emerald-50/30 transition-colors">
                                                            <td className="px-3 py-3 text-slate-400 font-bold">{idx + 1}</td>
                                                            <td className="px-3 py-3 font-bold text-slate-700">{new Date(t.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                                                            <td className="px-3 py-3 font-bold text-slate-800">{t.description}</td>
                                                            <td className="px-3 py-3 text-center font-mono font-bold text-slate-700">{t.qty}</td>
                                                            <td className="px-3 py-3 text-right font-mono text-slate-600">{t.price > 0 ? formatCurrency(t.price) : '-'}</td>
                                                            <td className="px-3 py-3 text-right font-mono font-black text-emerald-700">{formatCurrency(t.total)}</td>
                                                            <td className="px-3 py-3 text-slate-500">{new Date(t.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                                                            <td className="px-3 py-3 text-slate-500">{t.account}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                                {salesTransactions.length > 0 && (
                                                    <tfoot className="bg-emerald-50 border-t-2 border-emerald-200">
                                                        <tr>
                                                            <td colSpan={5} className="px-3 py-3 text-[9px] font-black uppercase tracking-widest text-emerald-700">Total Penjualan Telur</td>
                                                            <td className="px-3 py-3 text-right font-black text-emerald-700 font-mono">{formatCurrency(salesTransactions.reduce((a, t) => a + t.total, 0))}</td>
                                                            <td colSpan={2}></td>
                                                        </tr>
                                                    </tfoot>
                                                )}
                                            </table>
                                        </div>
                                    </div>

                                    {/* SECTION 2: PENGELUARAN BAHAN */}
                                    <div className="bg-white border border-slate-200 overflow-hidden shadow-sm">
                                        <div className="px-8 py-5 border-b border-slate-100 bg-amber-50 flex items-center justify-between">
                                            <div>
                                                <h3 className="font-bold text-base text-amber-800 uppercase tracking-tight italic">Pengeluaran Bahan & Stok</h3>
                                                <p className="text-[9px] text-amber-600 font-bold uppercase tracking-widest mt-0.5">Pembelian Pakan, Obat, Bahan Baku · {bahanTransactions.length} transaksi</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[9px] text-amber-600 font-bold uppercase tracking-widest">Total Pengeluaran</p>
                                                <p className="text-lg font-black text-amber-700">{formatCurrency(bahanTransactions.reduce((a, t) => a + t.total, 0))}</p>
                                            </div>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left border-collapse min-w-max">
                                                <thead>
                                                    <tr className="bg-slate-900 text-white text-[9px] font-black uppercase tracking-widest">
                                                        <th className="px-3 py-3 w-8">No</th>
                                                        <th className="px-3 py-3">Tanggal Transaksi</th>
                                                        <th className="px-3 py-3">Barang / Jasa</th>
                                                        <th className="px-3 py-3 text-center">Qty</th>
                                                        <th className="px-3 py-3 text-right">Harga Satuan</th>
                                                        <th className="px-3 py-3 text-right">Total Harga</th>
                                                        <th className="px-3 py-3">Tgl Bayar</th>
                                                        <th className="px-3 py-3">Nama Request</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="text-[10px] divide-y divide-slate-50">
                                                    {bahanTransactions.length === 0 ? (
                                                        <tr><td colSpan={8} className="px-4 py-6 text-center text-slate-400 font-bold uppercase text-[9px]">Belum ada pengeluaran bahan</td></tr>
                                                    ) : bahanTransactions.map((t, idx) => (
                                                        <tr key={t.id} className="hover:bg-amber-50/30 transition-colors">
                                                            <td className="px-3 py-3 text-slate-400 font-bold">{idx + 1}</td>
                                                            <td className="px-3 py-3 font-bold text-slate-700">{new Date(t.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                                                            <td className="px-3 py-3 font-bold text-slate-800">{t.description}</td>
                                                            <td className="px-3 py-3 text-center font-mono font-bold text-slate-700">{t.qty}</td>
                                                            <td className="px-3 py-3 text-right font-mono text-slate-600">{t.price > 0 ? formatCurrency(t.price) : '-'}</td>
                                                            <td className="px-3 py-3 text-right font-mono font-black text-rose-700">{formatCurrency(t.total)}</td>
                                                            <td className="px-3 py-3 text-slate-500">{new Date(t.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                                                            <td className="px-3 py-3 text-slate-500">{t.account}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                                {bahanTransactions.length > 0 && (
                                                    <tfoot className="bg-amber-50 border-t-2 border-amber-200">
                                                        <tr>
                                                            <td colSpan={5} className="px-3 py-3 text-[9px] font-black uppercase tracking-widest text-amber-700">Total Pengeluaran Bahan</td>
                                                            <td className="px-3 py-3 text-right font-black text-rose-700 font-mono">{formatCurrency(bahanTransactions.reduce((a, t) => a + t.total, 0))}</td>
                                                            <td colSpan={2}></td>
                                                        </tr>
                                                    </tfoot>
                                                )}
                                            </table>
                                        </div>
                                    </div>

                                    {/* SECTION 3: PENGELUARAN OPERASIONAL */}
                                    <div className="bg-white border border-slate-200 overflow-hidden shadow-sm">
                                        <div className="px-8 py-5 border-b border-slate-100 bg-rose-50 flex items-center justify-between">
                                            <div>
                                                <h3 className="font-bold text-base text-rose-800 uppercase tracking-tight italic">Pengeluaran Operasional</h3>
                                                <p className="text-[9px] text-rose-600 font-bold uppercase tracking-widest mt-0.5">Gaji, Aset, Biaya Operasional · {operasionalTransactions.length} transaksi</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[9px] text-rose-600 font-bold uppercase tracking-widest">Total Pengeluaran</p>
                                                <p className="text-lg font-black text-rose-700">{formatCurrency(operasionalTransactions.reduce((a, t) => a + t.total, 0))}</p>
                                            </div>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left border-collapse min-w-max">
                                                <thead>
                                                    <tr className="bg-slate-900 text-white text-[9px] font-black uppercase tracking-widest">
                                                        <th className="px-3 py-3 w-8">No</th>
                                                        <th className="px-3 py-3">Tanggal Transaksi</th>
                                                        <th className="px-3 py-3">Barang / Jasa</th>
                                                        <th className="px-3 py-3 text-center">Qty</th>
                                                        <th className="px-3 py-3 text-right">Harga Satuan</th>
                                                        <th className="px-3 py-3 text-right">Total Harga</th>
                                                        <th className="px-3 py-3">Tgl Bayar</th>
                                                        <th className="px-3 py-3">Nama Request</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="text-[10px] divide-y divide-slate-50">
                                                    {operasionalTransactions.length === 0 ? (
                                                        <tr><td colSpan={8} className="px-4 py-6 text-center text-slate-400 font-bold uppercase text-[9px]">Belum ada pengeluaran operasional</td></tr>
                                                    ) : operasionalTransactions.map((t, idx) => (
                                                        <tr key={t.id} className="hover:bg-rose-50/30 transition-colors">
                                                            <td className="px-3 py-3 text-slate-400 font-bold">{idx + 1}</td>
                                                            <td className="px-3 py-3 font-bold text-slate-700">{new Date(t.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                                                            <td className="px-3 py-3 font-bold text-slate-800">{t.description}</td>
                                                            <td className="px-3 py-3 text-center font-mono font-bold text-slate-700">{t.qty}</td>
                                                            <td className="px-3 py-3 text-right font-mono text-slate-600">{t.price > 0 ? formatCurrency(t.price) : '-'}</td>
                                                            <td className="px-3 py-3 text-right font-mono font-black text-rose-700">{formatCurrency(t.total)}</td>
                                                            <td className="px-3 py-3 text-slate-500">{new Date(t.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                                                            <td className="px-3 py-3 text-slate-500">{t.account}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                                {operasionalTransactions.length > 0 && (
                                                    <tfoot className="bg-rose-50 border-t-2 border-rose-200">
                                                        <tr>
                                                            <td colSpan={5} className="px-3 py-3 text-[9px] font-black uppercase tracking-widest text-rose-700">Total Operasional</td>
                                                            <td className="px-3 py-3 text-right font-black text-rose-700 font-mono">{formatCurrency(operasionalTransactions.reduce((a, t) => a + t.total, 0))}</td>
                                                            <td colSpan={2}></td>
                                                        </tr>
                                                    </tfoot>
                                                )}
                                            </table>
                                        </div>
                                    </div>

                                    {/* SUMMARY ROW */}
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                        <div className="bg-emerald-900 text-white p-4 lg:p-5">
                                            <p className="text-[9px] font-bold uppercase tracking-widest text-emerald-400 mb-1">Total Pendapatan</p>
                                            <p className="text-lg lg:text-xl font-black text-emerald-300">{formatCurrency(salesTransactions.reduce((a, t) => a + t.total, 0))}</p>
                                        </div>
                                        <div className="bg-rose-900 text-white p-4 lg:p-5">
                                            <p className="text-[9px] font-bold uppercase tracking-widest text-rose-400 mb-1">Total Pengeluaran</p>
                                            <p className="text-lg lg:text-xl font-black text-rose-300">{formatCurrency([...bahanTransactions, ...operasionalTransactions].reduce((a, t) => a + t.total, 0))}</p>
                                        </div>
                                        <div className={cn("p-4 lg:p-5 text-white", netProfit >= 0 ? 'bg-slate-900' : 'bg-rose-950')}>
                                            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">Laba / Rugi Bersih</p>
                                            <p className={cn("text-lg lg:text-xl font-black", netProfit >= 0 ? 'text-amber-400' : 'text-rose-400')}>{netProfit >= 0 ? '+' : ''}{formatCurrency(netProfit)}</p>
                                        </div>
                                    </div>

                                    {/* MODAL MASUK */}
                                    {modalTransactions.length > 0 && (
                                        <div className="bg-white border border-slate-200 overflow-hidden shadow-sm">
                                            <div className="px-8 py-4 border-b border-slate-100 bg-slate-50">
                                                <h3 className="font-bold text-sm text-slate-700 uppercase tracking-tight italic">Modal Masuk</h3>
                                            </div>
                                            <div className="p-4 space-y-2">
                                                {modalTransactions.map((m, i) => (
                                                    <div key={i} className="flex justify-between items-center p-3 bg-slate-50 border border-slate-100 group">
                                                        <span className="text-[11px] font-bold text-slate-600">{m.description} · {new Date(m.date).toLocaleDateString('id-ID')}</span>
                                                        <div className="flex items-center space-x-2">
                                                            <span className="text-emerald-600 font-black text-sm">{formatCurrency(m.total)}</span>
                                                            <button onClick={() => { setEditingModal(m); setIsModalAwalOpen(true); }} className="text-slate-400 hover:text-amber-500 opacity-0 group-hover:opacity-100 transition-opacity"><Edit2 size={12} /></button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'ASET' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {houseAssets.map((asset) => {
                                        const depreciation = calculateDepreciation(asset);
                                        const currentValue = asset.purchasePrice - depreciation;
                                        return (
                                            <div
                                                key={asset.id}
                                                onClick={() => {
                                                    setSelectedAssetId(asset.id);
                                                    setIsMaintenanceModalOpen(true);
                                                }}
                                                className="bg-white p-6 border border-slate-200 shadow-sm space-y-4 group hover:border-amber-500 transition-all cursor-pointer relative overflow-hidden"
                                            >
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{asset.category}</p>
                                                            <button onClick={(e) => { e.stopPropagation(); setEditingAsset(asset); setIsAssetModalOpen(true); }} className="text-slate-400 hover:text-amber-500"><Edit2 size={12} /></button>
                                                        </div>
                                                        <h4 className="font-bold text-slate-800 mt-1 uppercase tracking-tight">{asset.name}</h4>
                                                    </div>
                                                    <span className={cn(
                                                        "text-[9px] font-black uppercase px-2 py-0.5 rounded-sm border",
                                                        asset.condition === 'BAIK' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                                                            asset.condition === 'SERVIS' ? "bg-amber-50 text-amber-600 border-amber-100" :
                                                                "bg-rose-50 text-rose-600 border-rose-100"
                                                    )}>
                                                        {asset.condition}
                                                    </span>
                                                </div>
                                                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                                                    <div>
                                                        <p className="text-[8px] font-bold text-slate-400 uppercase">Nilai Awal</p>
                                                        <p className="text-xs font-black text-slate-600">{formatCurrency(asset.purchasePrice)}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[8px] font-bold text-slate-400 uppercase">Penyusutan</p>
                                                        <p className="text-xs font-black text-rose-500">-{formatCurrency(depreciation)}</p>
                                                    </div>
                                                </div>
                                                <div className="bg-slate-900 p-3 flex justify-between items-center">
                                                    <span className="text-[8px] font-bold text-slate-400 uppercase">Nilai Buku Saat Ini</span>
                                                    <span className="text-xs font-black text-amber-500">{formatCurrency(currentValue)}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    <button
                                        onClick={() => { setEditingAsset(null); setAssetOwnershipType('BELI'); setIsAssetModalOpen(true); }}
                                        className="bg-slate-50 border-2 border-dashed border-slate-200 p-6 flex flex-col items-center justify-center text-slate-400 hover:border-amber-500 hover:text-amber-500 transition-colors"
                                    >
                                        <Plus size={32} />
                                        <span className="text-[10px] font-bold uppercase mt-3">Tambah Aset Inventaris</span>
                                    </button>
                                </div>
                            )}

                            {activeTab === 'AKUNTANSI' && (
                                <div className="space-y-8">
                                    <div className="bg-white border border-slate-200 shadow-sm">
                                        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                                            <h3 className="font-bold text-sm text-slate-800 uppercase tracking-tight italic">Hutang & Piutang (AP / AR)</h3>
                                            <button onClick={() => setIsApArModalOpen(true)} className="bg-slate-900 text-white px-4 py-2 rounded-md text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 flex items-center gap-2">
                                                <Plus size={12} /> Tambah Tagihan
                                            </button>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left border-collapse min-w-max">
                                                <thead>
                                                    <tr className="bg-slate-900 text-white text-[9px] font-black uppercase tracking-widest">
                                                        <th className="px-3 py-3">Tgl Jatuh Tempo</th>
                                                        <th className="px-3 py-3">Jenis</th>
                                                        <th className="px-3 py-3">Mitra / Keterangan</th>
                                                        <th className="px-3 py-3 text-right">Total Tagihan</th>
                                                        <th className="px-3 py-3 text-right">Sisa Terutang</th>
                                                        <th className="px-3 py-3 text-center">Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="text-[10px] divide-y divide-slate-100">
                                                    {apArRecords.length === 0 ? (
                                                        <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400 font-bold uppercase">Belum ada Hutang / Piutang</td></tr>
                                                    ) : apArRecords.map((r, i) => (
                                                        <tr key={i} className="hover:bg-slate-50">
                                                            <td className="px-3 py-3 font-bold text-slate-700">{r.dueDate ? new Date(r.dueDate).toLocaleDateString('id-ID') : '-'}</td>
                                                            <td className="px-3 py-3 font-bold">
                                                                <span className={cn("px-2 py-1 rounded-sm text-[9px]", r.type === 'HUTANG' ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600")}>
                                                                    {r.type === 'HUTANG' ? 'HUTANG (AP)' : 'PIUTANG (AR)'}
                                                                </span>
                                                            </td>
                                                            <td className="px-3 py-3 text-slate-600 font-bold">{r.entityName}</td>
                                                            <td className="px-3 py-3 text-right font-mono font-bold">{formatCurrency(r.amount)}</td>
                                                            <td className="px-3 py-3 text-right font-mono font-bold text-rose-600">{formatCurrency(r.remainingAmount)}</td>
                                                            <td className="px-3 py-3 text-center">
                                                                <span className={cn("px-2 py-1 rounded-sm text-[9px] font-bold uppercase", r.status === 'PAID' ? "bg-emerald-100 text-emerald-700" : r.status === 'PARTIAL' ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700")}>
                                                                    {r.status}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    <div className="bg-white border border-slate-200 shadow-sm">
                                        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
                                            <h3 className="font-bold text-sm text-slate-800 uppercase tracking-tight italic">Jurnal Umum (Double-Entry)</h3>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left border-collapse min-w-max">
                                                <thead>
                                                    <tr className="bg-slate-900 text-white text-[9px] font-black uppercase tracking-widest">
                                                        <th className="px-3 py-3">Tanggal</th>
                                                        <th className="px-3 py-3">Keterangan</th>
                                                        <th className="px-3 py-3">Kode Akun</th>
                                                        <th className="px-3 py-3">Nama Akun</th>
                                                        <th className="px-3 py-3 text-right">Debit</th>
                                                        <th className="px-3 py-3 text-right">Kredit</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="text-[10px] divide-y divide-slate-100">
                                                    {journalEntries.length === 0 ? (
                                                        <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400 font-bold uppercase">Belum ada jurnal entri</td></tr>
                                                    ) : journalEntries.map((j) => {
                                                        const linesForJournal = journalLines.filter(l => l.journalId === j.id);
                                                        return (
                                                            <React.Fragment key={j.id}>
                                                                {linesForJournal.map((line, i) => {
                                                                    const account = accounts.find(a => a.id === line.accountId);
                                                                    return (
                                                                        <tr key={i} className="hover:bg-slate-50">
                                                                            {i === 0 && (
                                                                                <>
                                                                                    <td className="px-3 py-3 font-bold text-slate-700 border-b border-slate-200" rowSpan={linesForJournal.length}>{new Date(j.date).toLocaleDateString('id-ID')}</td>
                                                                                    <td className="px-3 py-3 text-slate-600 font-bold border-b border-slate-200" rowSpan={linesForJournal.length}>{j.description}</td>
                                                                                </>
                                                                            )}
                                                                            <td className="px-3 py-3 font-mono text-slate-500">{account?.code}</td>
                                                                            <td className="px-3 py-3 font-bold text-slate-700" style={{ paddingLeft: line.credit > 0 ? '2rem' : '0.75rem' }}>{account?.name}</td>
                                                                            <td className="px-3 py-3 text-right font-mono font-bold">{line.debit > 0 ? formatCurrency(line.debit) : '-'}</td>
                                                                            <td className="px-3 py-3 text-right font-mono font-bold">{line.credit > 0 ? formatCurrency(line.credit) : '-'}</td>
                                                                        </tr>
                                                                    );
                                                                })}
                                                                <tr className="bg-slate-100/50"><td colSpan={6} className="h-2"></td></tr>
                                                            </React.Fragment>
                                                        )
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Ã¢â€â‚¬Ã¢â€â‚¬ TAB: PENGELUARAN HARIAN Ã¢â€â‚¬Ã¢â€â‚¬ */}
                            {activeTab === 'PENGELUARAN' && (
                                <div className="space-y-6">
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight italic">Pengeluaran Operasional Harian</h3>
                                            <p className="text-xs text-slate-500 mt-1">Listrik, BBM, Konsumsi, dan biaya non-bahan baku lainnya.</p>
                                        </div>
                                        <button onClick={() => setIsOpexModalOpen(true)} className="bg-slate-900 text-white px-5 py-3 text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center gap-2">
                                            <Plus size={14} /> Tambah Pengeluaran
                                        </button>
                                    </div>
                                    <div className="bg-white border border-slate-200 shadow-sm overflow-x-auto">
                                        <table className="w-full text-left min-w-max">
                                            <thead><tr className="bg-slate-900 text-white text-[9px] font-black uppercase tracking-widest">
                                                <th className="px-4 py-3">Tanggal</th><th className="px-4 py-3">Kategori</th>
                                                <th className="px-4 py-3">Keterangan</th><th className="px-4 py-3">Dibayar dari</th>
                                                <th className="px-4 py-3 text-right">Jumlah</th>
                                            </tr></thead>
                                            <tbody className="divide-y divide-slate-100 text-[11px] font-bold">
                                                {operationalExpenses.length === 0 ? (
                                                    <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400 uppercase">Belum ada pengeluaran operasional</td></tr>
                                                ) : [...operationalExpenses].reverse().map(e => (
                                                    <tr key={e.id} className="hover:bg-slate-50">
                                                        <td className="px-4 py-3">{new Date(e.date).toLocaleDateString('id-ID')}</td>
                                                        <td className="px-4 py-3"><span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded-sm text-[9px] uppercase border border-amber-100">{e.category}</span></td>
                                                        <td className="px-4 py-3 text-slate-600">{e.description}</td>
                                                        <td className="px-4 py-3 text-slate-500">{accounts.find(a => a.id === e.paymentAccountId)?.name || '-'}</td>
                                                        <td className="px-4 py-3 text-right text-rose-600">{formatCurrency(e.amount)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                            {operationalExpenses.length > 0 && (
                                                <tfoot><tr className="bg-slate-50 border-t-2 border-slate-200">
                                                    <td colSpan={4} className="px-4 py-3 font-black text-[10px] uppercase text-slate-700">Total</td>
                                                    <td className="px-4 py-3 text-right font-black text-rose-600">{formatCurrency(operationalExpenses.reduce((s, e) => s + e.amount, 0))}</td>
                                                </tr></tfoot>
                                            )}
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* Ã¢â€â‚¬Ã¢â€â‚¬ TAB: BUKU BESAR Ã¢â€â‚¬Ã¢â€â‚¬ */}
                            {activeTab === 'BUKU_BESAR' && (
                                <div className="space-y-6">
                                    <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                                        <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight italic">Buku Besar (General Ledger)</h3>
                                        <select value={glAccountFilter} onChange={e => setGlAccountFilter(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-sm px-4 py-2 text-sm font-bold focus:outline-none focus:border-amber-500">
                                            <option value="">-- Semua Akun --</option>
                                            {accounts.map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                                        </select>
                                    </div>
                                    {accounts.filter(a => !glAccountFilter || a.id === glAccountFilter).map(acc => {
                                        const lines = journalLines.filter(l => l.accountId === acc.id);
                                        if (lines.length === 0) return null;
                                        let runningBalance = 0;
                                        const isDebitNormal = acc.category === AccountCategory.ASSET || acc.category === AccountCategory.EXPENSE;
                                        return (
                                            <div key={acc.id} className="bg-white border border-slate-200 shadow-sm overflow-x-auto">
                                                <div className="px-6 py-3 bg-slate-900 text-white flex justify-between items-center min-w-max">
                                                    <span className="font-black text-xs uppercase tracking-widest">{acc.code} – {acc.name}</span>
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase">{acc.category}</span>
                                                </div>
                                                <table className="w-full text-left min-w-max">
                                                    <thead><tr className="bg-slate-50 text-[9px] font-black uppercase text-slate-500 border-b border-slate-200">
                                                        <th className="px-4 py-2">Tanggal</th><th className="px-4 py-2">Keterangan</th>
                                                        <th className="px-4 py-2 text-right">Debit</th><th className="px-4 py-2 text-right">Kredit</th>
                                                        <th className="px-4 py-2 text-right">Saldo</th>
                                                    </tr></thead>
                                                    <tbody className="text-[11px] font-bold divide-y divide-slate-50">
                                                        {lines.map((line, idx) => {
                                                            const journal = journalEntries.find(j => j.id === line.journalId);
                                                            runningBalance += isDebitNormal ? (line.debit - line.credit) : (line.credit - line.debit);
                                                            return (
                                                                <tr key={idx} className="hover:bg-slate-50">
                                                                    <td className="px-4 py-2">{journal ? new Date(journal.date).toLocaleDateString('id-ID') : '-'}</td>
                                                                    <td className="px-4 py-2 text-slate-600">{journal?.description || '-'}</td>
                                                                    <td className="px-4 py-2 text-right text-emerald-600">{line.debit > 0 ? formatCurrency(line.debit) : '-'}</td>
                                                                    <td className="px-4 py-2 text-right text-rose-500">{line.credit > 0 ? formatCurrency(line.credit) : '-'}</td>
                                                                    <td className={cn("px-4 py-2 text-right font-black", runningBalance >= 0 ? 'text-slate-900' : 'text-rose-600')}>{formatCurrency(Math.abs(runningBalance))}</td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Ã¢â€â‚¬Ã¢â€â‚¬ TAB: NERACA SALDO Ã¢â€â‚¬Ã¢â€â‚¬ */}
                            {activeTab === 'NERACA_SALDO' && <NeracaSaldo />}
                        </div>
                    </div>
                </div>
            </div>
            {/* MODALS */}
            <Modal isOpen={isAssetModalOpen} onClose={() => { setIsAssetModalOpen(false); setAssetOwnershipType('BELI'); }} title={editingAsset ? "Edit Aset" : "Tambah Aset Baru"}>
                <form onSubmit={handleSaveAsset} className="space-y-6">
                    {/* Ownership Type — hanya tampil saat tambah baru */}
                    {!editingAsset && (
                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-3">Jenis Perolehan Aset</label>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    onClick={() => setAssetOwnershipType('BELI')}
                                    className={cn(
                                        "p-4 border-2 text-left transition-all rounded-sm",
                                        assetOwnershipType === 'BELI'
                                            ? "border-amber-500 bg-amber-50"
                                            : "border-slate-200 bg-slate-50 hover:border-slate-300"
                                    )}
                                >
                                    <p className={cn("text-[11px] font-black uppercase tracking-tight flex items-center gap-2", assetOwnershipType === 'BELI' ? 'text-amber-700' : 'text-slate-500')}><ShoppingCart size={14} /> Beli</p>
                                    <p className="text-[9px] text-slate-400 mt-1 leading-relaxed">Aset dibeli. Akan dicatat sebagai pengeluaran di Buku Kas.</p>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setAssetOwnershipType('MILIK_PRIBADI')}
                                    className={cn(
                                        "p-4 border-2 text-left transition-all rounded-sm",
                                        assetOwnershipType === 'MILIK_PRIBADI'
                                            ? "border-slate-700 bg-slate-900"
                                            : "border-slate-200 bg-slate-50 hover:border-slate-300"
                                    )}
                                >
                                    <p className={cn("text-[11px] font-black uppercase tracking-tight flex items-center gap-2", assetOwnershipType === 'MILIK_PRIBADI' ? 'text-white' : 'text-slate-500')}><Home size={14} /> Milik Pribadi</p>
                                    <p className={cn("text-[9px] mt-1 leading-relaxed", assetOwnershipType === 'MILIK_PRIBADI' ? 'text-slate-400' : 'text-slate-400')}>Aset milik pemilik. Tidak dicatat sebagai pembelian di laporan keuangan.</p>
                                </button>
                            </div>
                            {assetOwnershipType === 'MILIK_PRIBADI' && (
                                <div className="mt-2 p-3 bg-slate-800 border border-slate-700 flex items-start gap-2">
                                    <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" />
                                    <p className="text-[9px] text-slate-400 leading-relaxed">Aset ini hanya akan didaftarkan ke registri aset (untuk tracking penyusutan & kondisi), namun <strong className="text-white">tidak akan muncul sebagai pengeluaran</strong> di Buku Kas / Laporan Keuangan.</p>
                                </div>
                            )}
                        </div>
                    )}
                    <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Nama Aset</label>
                        <input name="name" required type="text" defaultValue={editingAsset?.name} placeholder="Cth: Genset 5000W" className="w-full bg-slate-50 border border-slate-200 rounded-sm px-4 py-3 text-sm font-bold focus:outline-none focus:border-amber-500" />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Kategori</label>
                        <select name="category" required defaultValue={editingAsset?.category} className="w-full bg-slate-50 border border-slate-200 rounded-sm px-4 py-3 text-sm font-bold focus:outline-none focus:border-amber-500">
                            <option value="Peralatan Kandang">Peralatan Kandang</option>
                            <option value="Kendaraan">Kendaraan</option>
                            <option value="Elektronik">Elektronik</option>
                            <option value="Tanah & Bangunan">Tanah & Bangunan</option>
                            <option value="Lainnya">Lainnya</option>
                        </select>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Harga Beli / Estimasi Nilai (IDR)</label>
                            <input name="purchasePrice" required type="number" defaultValue={editingAsset?.purchasePrice} placeholder="Cth: 5000000" className="w-full bg-slate-50 border border-slate-200 rounded-sm px-4 py-3 text-sm font-bold focus:outline-none focus:border-amber-500" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Nilai Sisa (Residu)</label>
                            <input name="salvageValue" required type="number" defaultValue={editingAsset?.salvageValue || 0} placeholder="Cth: 500000" className="w-full bg-slate-50 border border-slate-200 rounded-sm px-4 py-3 text-sm font-bold focus:outline-none focus:border-amber-500" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Umur Ekonomis (Thn)</label>
                            <input name="expectedLifeYears" required type="number" defaultValue={editingAsset?.expectedLifeYears} placeholder="Cth: 5" className="w-full bg-slate-50 border border-slate-200 rounded-sm px-4 py-3 text-sm font-bold focus:outline-none focus:border-amber-500" />
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">{assetOwnershipType === 'BELI' ? 'Tanggal Beli' : 'Tanggal Perolehan / Estimasi'}</label>
                        <input name="purchaseDate" required type="date" defaultValue={editingAsset ? editingAsset.purchaseDate.split('T')[0] : new Date().toISOString().split('T')[0]} className="w-full bg-slate-50 border border-slate-200 rounded-sm px-4 py-3 text-sm font-bold focus:outline-none focus:border-amber-500" />
                    </div>
                    {assetOwnershipType === 'BELI' && (
                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Metode Pembayaran (Rekening)</label>
                            <select name="accountId" required className="w-full bg-slate-50 border border-slate-200 rounded-sm px-4 py-3 text-sm font-bold focus:outline-none focus:border-amber-500">
                                {accounts.filter(a => a.isCashOrBank).map(a => (
                                    <option key={a.id} value={a.id}>{a.name} ({a.code})</option>
                                ))}
                            </select>
                        </div>
                    )}
                    <button type="submit" className={cn(
                        "w-full py-4 rounded-sm font-bold text-[10px] uppercase tracking-[0.25em] transition-all",
                        assetOwnershipType === 'MILIK_PRIBADI'
                            ? "bg-slate-800 text-white hover:bg-slate-700"
                            : "bg-slate-900 text-white hover:bg-slate-800"
                    )}>
                        {editingAsset ? "Simpan Perubahan" : assetOwnershipType === 'MILIK_PRIBADI' ? "Daftarkan sebagai Milik Pribadi" : "Daftarkan Aset & Catat Pengeluaran"}
                    </button>
                </form>
            </Modal>

            <Modal isOpen={isModalAwalOpen} onClose={() => setIsModalAwalOpen(false)} title={editingModal ? "Edit Modal Usaha" : "Suntik Modal Usaha"}>
                <form onSubmit={handleAddModalSubmit} className="space-y-6">
                    <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Nominal Modal</label>
                        <input name="amount" required type="number" defaultValue={editingModal?.total} className="w-full bg-slate-50 border border-slate-200 rounded-sm px-4 py-3 text-sm font-bold focus:outline-none focus:border-amber-500" />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Keterangan</label>
                        <input name="description" required type="text" defaultValue={editingModal?.description} placeholder="Contoh: Tambahan Modal Sendiri" className="w-full bg-slate-50 border border-slate-200 rounded-sm px-4 py-3 text-sm font-bold focus:outline-none focus:border-amber-500" />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Penerima Modal (Kandang)</label>
                        <select name="houseId" required defaultValue={activeHouse?.id} className="w-full bg-slate-50 border border-slate-200 rounded-sm px-4 py-3 text-sm font-bold focus:outline-none focus:border-amber-500">
                            {houses.map(h => (
                                <option key={h.id} value={h.id}>{h.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Rekening Penerima</label>
                        <select name="accountId" required className="w-full bg-slate-50 border border-slate-200 rounded-sm px-4 py-3 text-sm font-bold focus:outline-none focus:border-amber-500">
                            {accounts.filter(a => a.isCashOrBank).map(a => (
                                <option key={a.id} value={a.id}>{a.name} ({a.code})</option>
                            ))}
                        </select>
                    </div>
                    <button type="submit" className="w-full bg-slate-900 text-white py-4 rounded-sm font-bold text-[10px] uppercase tracking-[0.25em]">Simpan Modal</button>
                </form>
            </Modal>

            <Modal isOpen={isMaintenanceModalOpen} onClose={() => setIsMaintenanceModalOpen(false)} title="Update Status & Histori Aset">
                {selectedAssetId && (
                    <div className="space-y-8">
                        <div className="p-4 bg-slate-900 border border-slate-800">
                            <h4 className="text-[10px] font-black uppercase text-amber-500 tracking-widest mb-1">{assets.find(a => a.id === selectedAssetId)?.name}</h4>
                            <p className="text-[9px] text-slate-400 font-bold uppercase">Update Kondisi & Histori Perawatan</p>
                        </div>
                        <form onSubmit={handleUpdateStatus} className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Kondisi Terbaru</label>
                                    <select name="status" className="w-full bg-slate-50 border border-slate-200 rounded-sm px-4 py-3 text-sm font-bold focus:outline-none focus:border-amber-500">
                                        <option value="BAIK">BAIK</option>
                                        <option value="SERVIS">SERVIS</option>
                                        <option value="RUSAK">RUSAK</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Catatan Update</label>
                                    <input name="notes" type="text" placeholder="Detail perbaikan..." className="w-full bg-slate-50 border border-slate-200 rounded-sm px-4 py-3 text-sm font-bold focus:outline-none focus:border-amber-500" />
                                </div>
                            </div>
                            <button type="submit" className="w-full bg-slate-900 text-white py-4 rounded-sm font-bold text-[10px] uppercase tracking-[0.25em]">Simpan Pembaruan</button>
                        </form>
                        <div className="border-t border-slate-200 pt-6">
                            <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-900 mb-4">Histori Perawatan</h5>
                            <div className="max-h-[150px] overflow-y-auto overflow-x-auto border border-slate-100">
                                <table className="w-full text-left text-[10px] min-w-max">
                                    <thead className="bg-slate-50 border-b border-slate-200 uppercase font-black">
                                        <tr><th className="px-3 py-2">Tgl</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Oleh</th><th className="px-3 py-2">Catatan</th></tr>
                                    </thead>
                                    <tbody className="font-bold text-slate-600">
                                        {assets.find(a => a.id === selectedAssetId)?.maintenanceHistory.map((h, i) => (
                                            <tr key={i} className="border-b border-slate-50">
                                                <td className="px-3 py-2">{new Date(h.date).toLocaleDateString('id-ID')}</td>
                                                <td className="px-3 py-2"><span className={cn("px-1.5 py-0.5 rounded-sm text-[8px]", h.status === 'BAIK' ? "bg-emerald-50 text-emerald-600" : h.status === 'SERVIS' ? "bg-amber-50 text-amber-600" : "bg-rose-50 text-rose-600")}>{h.status}</span></td>
                                                <td className="px-3 py-2">{h.user}</td>
                                                <td className="px-3 py-2 text-slate-400">{h.notes || '-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Ã¢â€â‚¬Ã¢â€â‚¬ MODAL: PENGELUARAN OPERASIONAL HARIAN Ã¢â€â‚¬Ã¢â€â‚¬ */}
            <Modal isOpen={isOpexModalOpen} onClose={() => setIsOpexModalOpen(false)} title="Tambah Pengeluaran Harian">
                <form onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.target as HTMLFormElement);
                    addOperationalExpenseRecord({
                        houseId: activeHouse?.id,
                        date: fd.get('date') as string,
                        category: fd.get('category') as string,
                        description: fd.get('description') as string,
                        amount: Number(fd.get('amount')),
                        accountId: fd.get('accountId') as string,
                        paymentAccountId: fd.get('paymentAccountId') as string,
                    });
                    setIsOpexModalOpen(false);
                    Swal.fire({ title: 'Berhasil!', text: 'Pengeluaran harian telah dicatat dan dijurnal otomatis.', icon: 'success', confirmButtonColor: '#0f172a', timer: 2000, showConfirmButton: false });
                }} className="space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Tanggal</label>
                            <input name="date" type="date" required defaultValue={new Date().toISOString().split('T')[0]} className="w-full bg-slate-50 border border-slate-200 rounded-sm px-4 py-3 text-sm font-bold focus:outline-none focus:border-amber-500" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Kategori</label>
                            <select name="category" required className="w-full bg-slate-50 border border-slate-200 rounded-sm px-4 py-3 text-sm font-bold focus:outline-none focus:border-amber-500">
                                {Object.values(ExpenseCategory).map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div className="col-span-2">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Keterangan</label>
                            <input name="description" type="text" required placeholder="Cth: Bayar tagihan PLN bulan Mei" className="w-full bg-slate-50 border border-slate-200 rounded-sm px-4 py-3 text-sm font-bold focus:outline-none focus:border-amber-500" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Jumlah (Rp)</label>
                            <input name="amount" type="number" min="1" required className="w-full bg-slate-50 border border-slate-200 rounded-sm px-4 py-3 text-sm font-bold focus:outline-none focus:border-amber-500 font-mono" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Akun Beban (Debit)</label>
                            <select name="accountId" required className="w-full bg-slate-50 border border-slate-200 rounded-sm px-4 py-3 text-sm font-bold focus:outline-none focus:border-amber-500">
                                {accounts.filter(a => a.category === AccountCategory.EXPENSE).map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                            </select>
                        </div>
                        <div className="col-span-2">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Dibayar dari Rekening (Kredit)</label>
                            <select name="paymentAccountId" required className="w-full bg-slate-50 border border-slate-200 rounded-sm px-4 py-3 text-sm font-bold focus:outline-none focus:border-amber-500">
                                {accounts.filter(a => a.isCashOrBank).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                            </select>
                        </div>
                    </div>
                    <button type="submit" className="w-full bg-slate-900 text-white py-4 rounded-sm font-bold text-[10px] uppercase tracking-[0.2em] hover:bg-slate-800">Simpan & Jurnal Otomatis</button>
                </form>
            </Modal>

            {/* MODAL: DANA PEREMAJAAN*/}
            <Modal isOpen={isSinkingModalOpen} onClose={() => setIsSinkingModalOpen(false)} title="Catat Realisasi Dana Peremajaan">
                <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg mb-4">
                    <p className="text-[10px] font-bold text-amber-700 leading-relaxed">
                        Dana peremajaan dicatat sebagai alokasi dari keuntungan operasional untuk membiayai penggantian ayam (DOC baru) atau renovasi kandang di masa mendatang. Dana ini dijurnal sebagai <span className="font-black">Debit: Dana Cadangan</span>.
                    </p>
                </div>
                <form onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.target as HTMLFormElement);
                    realizeSinkingFund(Number(fd.get('amount')), fd.get('type') as SinkingFundType, activeHouse?.id, fd.get('notes') as string);
                    setIsSinkingModalOpen(false);
                    Swal.fire({ title: 'Berhasil!', text: 'Dana peremajaan telah dicatat dan dijurnal otomatis.', icon: 'success', confirmButtonColor: '#0f172a', timer: 2000, showConfirmButton: false });
                }} className="space-y-5">
                    <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Tujuan Dana Peremajaan</label>
                        <select name="type" required className="w-full bg-slate-50 border border-slate-200 rounded-sm px-4 py-3 text-sm font-bold focus:outline-none focus:border-amber-500">
                            <option value={SinkingFundType.DOC}>DOC Baru  Peremajaan Ayam Layer</option>
                            <option value={SinkingFundType.RENOVATION}>Peremajaan Kandang  Renovasi Bangunan</option>
                            <option value={SinkingFundType.RESERVE}>Dana Cadangan Umum</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Nominal Alokasi (Rp)</label>
                        <input name="amount" type="number" min="1" required className="w-full bg-slate-50 border border-slate-200 rounded-sm px-4 py-3 text-sm font-bold focus:outline-none focus:border-amber-500 font-mono" />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Catatan / Keterangan</label>
                        <textarea name="notes" placeholder="Cth: Alokasi bulan Mei 2026 untuk DOC batch berikutnya" className="w-full bg-slate-50 border border-slate-200 rounded-sm px-4 py-3 text-sm font-bold focus:outline-none focus:border-amber-500 h-20" />
                    </div>
                    <button type="submit" className="w-full bg-slate-900 text-white py-4 rounded-sm font-bold text-[10px] uppercase tracking-[0.2em] hover:bg-slate-800 flex items-center justify-center gap-2">
                        Simpan & Jurnal Otomatis
                    </button>
                </form>
            </Modal>
            {/* MODAL: AP/AR - TAMBAH TAGIHAN HUTANG / PIUTANG */}
            <Modal isOpen={isApArModalOpen} onClose={() => setIsApArModalOpen(false)} title="Tambah Tagihan Hutang / Piutang">
                <form onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.target as HTMLFormElement);
                    addAPARRecord({
                        type: fd.get('type') as 'HUTANG' | 'PIUTANG',
                        entityName: fd.get('entityName') as string,
                        description: fd.get('description') as string,
                        amount: Number(fd.get('amount')),
                        remainingAmount: Number(fd.get('amount')),
                        dueDate: fd.get('dueDate') as string,
                        status: 'OPEN',
                        houseId: activeHouse?.id,
                    });
                    setIsApArModalOpen(false);
                    Swal.fire({ title: 'Berhasil!', text: 'Tagihan berhasil ditambahkan.', icon: 'success', confirmButtonColor: '#0f172a', timer: 1500, showConfirmButton: false });
                }} className="space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Jenis</label>
                            <select name="type" required className="w-full bg-slate-50 border border-slate-200 rounded-sm px-4 py-3 text-sm font-bold focus:outline-none focus:border-amber-500">
                                <option value="HUTANG">HUTANG (AP) — Kita berhutang</option>
                                <option value="PIUTANG">PIUTANG (AR) — Orang berhutang ke kita</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Jatuh Tempo</label>
                            <input name="dueDate" type="date" required className="w-full bg-slate-50 border border-slate-200 rounded-sm px-4 py-3 text-sm font-bold focus:outline-none focus:border-amber-500" />
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Nama Mitra / Pihak</label>
                        <input name="entityName" type="text" required placeholder="Cth: Supplier Pakan Jaya" className="w-full bg-slate-50 border border-slate-200 rounded-sm px-4 py-3 text-sm font-bold focus:outline-none focus:border-amber-500" />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Total Tagihan (Rp)</label>
                        <input name="amount" type="number" min="1" required className="w-full bg-slate-50 border border-slate-200 rounded-sm px-4 py-3 text-sm font-bold focus:outline-none focus:border-amber-500 font-mono" />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Keterangan</label>
                        <input name="description" type="text" placeholder="Cth: Pembelian 1 ton pakan ternak" className="w-full bg-slate-50 border border-slate-200 rounded-sm px-4 py-3 text-sm font-bold focus:outline-none focus:border-amber-500" />
                    </div>
                    <button type="submit" className="w-full bg-slate-900 text-white py-4 rounded-sm font-bold text-[10px] uppercase tracking-[0.2em] hover:bg-slate-800 flex items-center justify-center gap-2">
                        <Plus size={14} /> Simpan Tagihan
                    </button>
                </form>
            </Modal>

        </>
    );
}
