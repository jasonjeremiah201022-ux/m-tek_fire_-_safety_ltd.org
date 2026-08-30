// M-Tek preview seed data — first-run dataset for the local API server.
// Mirrors the Flutter app's sample dataset (docs/SPEC.md). The server
// persists everything to preview/.data/db.json (gitignored) after first run.
'use strict';

const CATS = { Fire: 'Fire', Safety: 'Safety', Security: 'Security', Solar: 'Solar', Automation: 'Automation & Surveillance' };
const CAT_COLOR = { Fire: '#c8102e', Safety: '#f0a92e', Security: '#1a2a4a', Solar: '#15803d', Automation: '#ff5b66' };

const products = [
  { id: 'F002', name: 'BOX FOR 6KG FIRE EXTINGUISHER', cat: 'Fire', cost: 38000, price: 55000, qty: 24, reorder: 10, unit: 'pcs' },
  { id: 'F003', name: 'BOX FOR 9KG FIRE EXTINGUISHER', cat: 'Fire', cost: 45000, price: 65000, qty: 12, reorder: 8, unit: 'pcs' },
  { id: 'F008', name: 'BREATHING APPARATUS', cat: 'Fire', cost: 260000, price: 350000, qty: 4, reorder: 2, unit: 'pcs' },
  { id: 'S003', name: 'BODY HARNESS', cat: 'Safety', cost: 34000, price: 50000, qty: 18, reorder: 6, unit: 'pcs' },
  { id: 'S005', name: 'CAUTION CONE (75CM)', cat: 'Safety', cost: 10000, price: 16000, qty: 40, reorder: 15, unit: 'pcs' },
  { id: 'S008', name: 'COMPLETE OVERALL', cat: 'Safety', cost: 15500, price: 23000, qty: 9, reorder: 12, unit: 'pcs' },
  { id: 'Q002', name: 'WALK-THROUGH METAL DETECTOR GATE', cat: 'Security', cost: 500000, price: 680000, qty: 2, reorder: 1, unit: 'unit' },
  { id: 'L011', name: '30AHS CHARGE CONTROLLER', cat: 'Solar', cost: 13500, price: 20000, qty: 14, reorder: 5, unit: 'pcs' },
  { id: 'L012', name: '30 WATTS LED SOLAR LIGHT', cat: 'Solar', cost: 17000, price: 25000, qty: 3, reorder: 8, unit: 'pcs' },
  { id: 'H001', name: 'BAOFENG TWO WAY RADIO BF-7775', cat: 'Automation', cost: 12000, price: 18000, qty: 30, reorder: 10, unit: 'pcs' },
  { id: 'H006', name: 'BELL (24 VDC CHLORIDE UK)', cat: 'Automation', cost: 9800, price: 15000, qty: 11, reorder: 5, unit: 'pcs' },
  { id: 'SRV-1', name: 'DCP 6KG REFILL SERVICE', cat: 'Fire', cost: 3000, price: 7500, qty: 0, reorder: 0, unit: 'job', service: true },
];

const customers = [
  { id: 'C001', name: 'Nigerian Breweries — Kaduna Depot', corp: true, phone: '+234 803 415 2288', balance: 360000 },
  { id: 'C002', name: 'Kaduna Refining & Petrochemical Co.', corp: true, phone: '+234 803 552 0117', balance: 300000 },
  { id: 'C003', name: 'Alhaji Musa Ibrahim', corp: false, phone: '+234 806 113 4478', balance: 0 },
  { id: 'C004', name: 'Engr. Chuka Okafor', corp: false, phone: '+234 802 930 5561', balance: 0 },
  { id: 'C005', name: 'Mrs. Grace Adeyemi', corp: false, phone: '+234 805 780 2234', balance: 0 },
  { id: 'C006', name: 'Barr. Sani Bello', corp: false, phone: '+234 807 442 8890', balance: 396000 },
];

const sales = [
  { id: 'S001', day: 2, hour: 10, cust: 'C003', method: 'cash', items: [['F002', 2], ['SRV-1', 1]] },
  { id: 'S002', day: 5, hour: 11, cust: 'C001', method: 'transfer', items: [['S003', 4]] },
  { id: 'S003', day: 8, hour: 14, cust: 'C005', method: 'pos', items: [['L012', 1], ['L011', 1]] },
  { id: 'S005', day: 14, hour: 10, cust: 'C004', method: 'transfer', items: [['Q002', 1]] },
  { id: 'S006', day: 18, hour: 12, cust: 'C003', method: 'cash', items: [['S005', 6]] },
  { id: 'S007', day: 22, hour: 15, cust: 'C005', method: 'transfer', items: [['H001', 2], ['H006', 1]] },
  { id: 'S008', day: 26, hour: 11, cust: 'C001', method: 'pos', items: [['S005', 10], ['S003', 5]] },
  { id: 'S009', day: 28, hour: 13, cust: 'C004', method: 'cash', items: [['L011', 2], ['L012', 1]] },
  { id: 'S010', day: 29, hour: 10, cust: 'C003', method: 'transfer', items: [['F003', 1], ['F002', 2]] },
  { id: 'S011', day: 29, hour: 11, cust: 'C005', method: 'cash', items: [['H001', 3]] },
  { id: 'S012', day: 29, hour: 13, cust: 'C002', method: 'cash', items: [['SRV-1', 12]] },
];

const invoices = [
  { no: 'MTK-INV-0001', issued: 11, due: 25, cust: 'C002', items: [['F008', 3]], paid: 1050000 },
  { no: 'MTK-INV-0002', issued: 14, due: 28, cust: 'C001', items: [['Q002', 2]], paid: 1000000 },
  { no: 'MTK-INV-0003', issued: 19, due: '2 Sep 2026', cust: 'C002', items: [['SRV-1', 40]], paid: 0 },
  { no: 'MTK-INV-0004', issued: 5, due: 19, cust: 'C006', items: [['F008', 1], ['S008', 2]], paid: 0 },
];

const txns = [
  { d: '2 Aug, 10:20', type: 'sale', amt: 117500, m: 'cash', ref: 'S001' },
  { d: '5 Aug, 11:05', type: 'sale', amt: 200000, m: 'transfer', ref: 'S002' },
  { d: '8 Aug, 14:12', type: 'sale', amt: 45000, m: 'pos', ref: 'S003' },
  { d: '14 Aug, 10:44', type: 'sale', amt: 680000, m: 'transfer', ref: 'S005' },
  { d: '18 Aug, 12:30', type: 'sale', amt: 96000, m: 'cash', ref: 'S006' },
  { d: '20 Aug, 09:15', type: 'invoice', amt: 1050000, m: 'transfer', ref: 'MTK-INV-0001' },
  { d: '22 Aug, 15:02', type: 'sale', amt: 51000, m: 'transfer', ref: 'S007' },
  { d: '24 Aug, 10:08', type: 'invoice', amt: 1000000, m: 'transfer', ref: 'MTK-INV-0002' },
  { d: '24 Aug, 16:40', type: 'refund', amt: -32000, m: 'cash', ref: 'Return — S006 (2× caution cone)' },
  { d: '26 Aug, 11:26', type: 'sale', amt: 410000, m: 'pos', ref: 'S008' },
  { d: '28 Aug, 13:51', type: 'sale', amt: 65000, m: 'cash', ref: 'S009' },
  { d: '29 Aug, 10:14', type: 'sale', amt: 175000, m: 'transfer', ref: 'S010' },
  { d: '29 Aug, 11:37', type: 'sale', amt: 54000, m: 'cash', ref: 'S011' },
  { d: '29 Aug, 13:09', type: 'sale', amt: 90000, m: 'cash', ref: 'S012' },
];

const mils = [
  { id: 'MTK-MILS-0001', date: '6 Aug', equip: 'DCP 6kg Fire Extinguisher ×24', serial: 'DCP6-2026-118', client: 'Nigerian Breweries — Kaduna Depot', loc: 'Depot yard, stations 1–12', action: 'REFILL', tech: 'Ibrahim Kabeer', next: '6 Feb 2027', overdue: false, findings: '12 units at zero pressure, valves replaced' },
  { id: 'MTK-MILS-0002', date: '12 Aug', equip: 'Maxlogic 2-Zone Fire Alarm Panel', serial: 'FAP-ML2-0091', client: 'Kaduna Refining & Petrochemical Co.', loc: 'Control room, block B', action: 'INSPECTION', tech: 'Sunday Ademola', next: '12 Nov 2026', overdue: false, findings: 'Zone 2 detector sensitivity low; battery OK' },
  { id: 'MTK-MILS-0003', date: '15 Aug', equip: 'Flame Fighting Hose Reel + Cabinet', client: 'Barr. Sani Bello', loc: 'Residence, Barnawa', action: 'INSTALLATION', tech: 'Ibrahim Kabeer', next: '15 Aug 2027', overdue: false, findings: 'New install; pressure test passed' },
  { id: 'MTK-MILS-0004', date: '20 Aug', equip: 'CCTV (8ch DVR, 6 cameras)', serial: 'DVR8-5521', client: 'Mrs. Grace Adeyemi', loc: 'Shop plaza, Kawo', action: 'REPAIR', tech: 'Sunday Ademola', next: '20 Feb 2027', overdue: false, findings: 'Cam 3 lens condensation; replaced' },
  { id: 'MTK-MILS-0005', date: '25 Aug', equip: 'Walk-Through Metal Detector Gate', serial: 'WTMD-Q2-011', client: 'Nigerian Breweries — Kaduna Depot', loc: 'Main gate', action: 'CALIBRATION', tech: 'Musa Danjuma', next: '28 Aug 2026', overdue: true, findings: 'Sensitivity re-calibrated; zone 4 sensor drifting' },
  { id: 'MTK-MILS-0006', date: '29 Aug', equip: 'Solar Inverter 3kVA + 200Ah Battery', serial: 'INV3K-88412', client: 'Mrs. Grace Adeyemi', loc: 'Residence, Ungwan Rimi', action: 'INSPECTION', tech: 'Musa Danjuma', next: '29 Nov 2026', overdue: false, findings: 'Battery water topped up; panels cleaned' },
];

const adjustments = [
  { id: 'ADJ-1', d: '10 Aug', pid: 'F002', delta: 24, reason: 'RESTOCK', note: 'PO-2214 — Bajik supply' },
  { id: 'ADJ-2', d: '16 Aug', pid: 'S005', delta: -2, reason: 'DAMAGE', note: 'Crushed in storage' },
  { id: 'ADJ-3', d: '21 Aug', pid: 'S003', delta: 6, reason: 'RESTOCK', note: 'PO-2220' },
  { id: 'ADJ-4', d: '25 Aug', pid: 'H006', delta: -1, reason: 'CORRECTION', note: 'Shelf count correction' },
];
const DEFAULT_SERIALS = { receipt: 2131, invoice: 4335, mils: 925,
  waybill: 174, deliverynote: 19790088 };
const DEFAULT_SETTINGS = { vatEnabled: true, vatRate: 0.075, company: 'M-TEK FIRE & SAFETY LTD.', watermark: true };

module.exports = { CATS, CAT_COLOR, products, customers, sales, invoices, txns, mils, adjustments, DEFAULT_SERIALS, DEFAULT_SETTINGS };
