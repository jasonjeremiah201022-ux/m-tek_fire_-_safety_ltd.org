import 'dart:collection';

import 'package:flutter/foundation.dart';

import 'models.dart';

/// In-memory store seeded with a deterministic, internally consistent
/// sample dataset (Aug 2026). M2 swaps this for Drift repositories —
/// screens keep working unchanged because they only read this API.
class SampleStore extends ChangeNotifier {
  SampleStore._() {
    _seed();
  }
  static final SampleStore instance = SampleStore._();

  final List<Product> products = [];
  final List<Customer> customers = [];
  final List<Sale> sales = [];
  final List<Transaction> transactions = [];
  final List<Receipt> receipts = [];
  final List<Invoice> invoices = [];
  final List<MaintenanceLog> milsLogs = [];
  final List<StockAdjustment> adjustments = [];

  int _txnSeq = 0;
  int _recSeq = 0;

  // ---------- derived figures (Insights / Summary) ----------

  /// Net revenue: all payments in, minus refunds.
  int revenue({DateTime? from, DateTime? to}) {
    int sum = 0;
    for (final t in transactions) {
      if (from != null && t.date.isBefore(from)) continue;
      if (to != null && t.date.isAfter(to)) continue;
      sum += t.isRefund ? -t.amount : t.amount;
    }
    return sum;
  }

  int get revenueToday {
    final now = DateTime.now();
    return revenue(
      from: DateTime(now.year, now.month, now.day),
      to: DateTime(now.year, now.month, now.day, 23, 59, 59),
    );
  }

  int get revenueThisWeek {
    final now = DateTime.now();
    final monday = now.subtract(Duration(days: now.weekday - 1));
    return revenue(
      from: DateTime(monday.year, monday.month, monday.day),
      to: DateTime(now.year, now.month, now.day, 23, 59, 59),
    );
  }

  int get revenueThisMonth {
    final now = DateTime.now();
    return revenue(
      from: DateTime(now.year, now.month),
      to: DateTime(now.year, now.month + 1),
    );
  }

  /// Avg. transaction value = net revenue ÷ paying transactions.
  int avgTransactionValue() {
    final paying = transactions.where((t) => !t.isRefund).length;
    return paying == 0 ? 0 : revenue() ~/ paying;
  }

  /// Revenue grouped by product category (for the breakdown chart).
  Map<ProductCategory, int> revenueByCategory() {
    final byCat = <ProductCategory, int>{};
    for (final sale in sales) {
      for (final item in sale.items) {
        if (sale.method == PaymentMethod.credit &&
            !_invoiceFullyPaid(sale)) {
          continue; // credit counts when the invoice is paid
        }
        byCat[item.product.category] =
            (byCat[item.product.category] ?? 0) + item.total;
      }
    }
    // Service revenue (refills etc.) has no product category slot:
    // it is bucketed under the item's category (services use `fire` by
    // convention here) — M2 moves services to a dedicated ledger.
    return byCat;
  }

  Map<PaymentMethod, int> revenueByMethod() {
    final byMethod = <PaymentMethod, int>{};
    for (final t in transactions) {
      if (t.isRefund) continue;
      byMethod[t.method] = (byMethod[t.method] ?? 0) + t.amount;
    }
    return byMethod;
  }

  bool _invoiceFullyPaid(Sale sale) => invoices
      .where((i) => i.items.length == sale.items.length && i.total == sale.total)
      .any((i) => i.amountPaid >= i.total);

  int stockValueAtCost() => products.fold(
      0, (s, p) => s + (p.isService ? 0 : p.costPrice * p.qtyOnHand));

  int outstandingInvoicesTotal() =>
      invoices.fold(0, (s, i) => s + i.balance);

  int estimatedProfit({DateTime? from, DateTime? to}) {
    int profit = 0;
    for (final sale in sales) {
      if (sale.method == PaymentMethod.credit) continue; // recognised on payment
      if (from != null && sale.date.isBefore(from)) continue;
      if (to != null && sale.date.isAfter(to)) continue;
      final cost =
          sale.items.fold(0, (s, i) => s + i.product.costPrice * i.qty);
      profit += sale.total - cost;
    }
    return profit;
  }

  LinkedHashMap<String, int> topProducts({int limit = 5}) {
    final byProduct = <String, int>{};
    final qty = <String, int>{};
    for (final sale in sales) {
      for (final i in sale.items) {
        byProduct[i.product.name] = (byProduct[i.product.name] ?? 0) + i.total;
        qty[i.product.name] = (qty[i.product.name] ?? 0) + i.qty;
      }
    }
    final entries = byProduct.entries.toList()
      ..sort((a, b) => b.value.compareTo(a.value));
    final out = LinkedHashMap<String, int>();
    for (final e in entries.take(limit)) {
      out['${e.key} ×${qty[e.key]}'] = e.value;
    }
    return out;
  }

  // ---------- write actions (used by Sales/Stock screens) ----------

  void completeSale({
    required Customer customer,
    required List<SaleItem> items,
    required PaymentMethod method,
    int discount = 0,
    required String signedBy,
  }) {
    final now = DateTime.now();
    final sale = Sale(
      id: 'S${sales.length + 1}',
      date: now,
      customer: customer,
      items: List.of(items),
      method: method,
      discount: discount,
    );
    sales.add(sale);

    // decrement stock
    for (final i in items) {
      final idx = products.indexWhere((p) => p.id == i.product.id);
      if (idx != -1 && !products[idx].isService) {
        products[idx] = products[idx].copyWith(
          qtyOnHand: products[idx].qtyOnHand - i.qty,
        );
      }
    }

    if (method == PaymentMethod.credit) {
      // bill now, pay later → invoice (payment posts a txn + receipt later)
      final number = 'MTK-INV-${(invoices.length + 1).toString().padLeft(4, '0')}';
      invoices.add(Invoice(
        number: number,
        issued: now,
        due: now.add(const Duration(days: 14)),
        customer: customer,
        items: List.of(items),
      ));
    } else {
      _postPayment(
        date: now,
        amount: sale.total,
        method: method,
        forDoc: sale.id,
        customer: customer,
        signedBy: signedBy,
      );
    }
    notifyListeners();
  }

  void payInvoice(Invoice invoice, int amount, {required String signedBy}) {
    final idx = invoices.indexOf(invoice);
    final now = DateTime.now();
    invoices[idx] = Invoice(
      number: invoice.number,
      issued: invoice.issued,
      due: invoice.due,
      customer: invoice.customer,
      items: invoice.items,
      amountPaid: invoice.amountPaid + amount,
    );
    _postPayment(
      date: now,
      amount: amount,
      method: PaymentMethod.transfer,
      forDoc: invoice.number,
      customer: invoice.customer,
      signedBy: signedBy,
    );
    notifyListeners();
  }

  void adjustStock(Product product, int delta, AdjustmentReason reason, String note) {
    final idx = products.indexOf(product);
    products[idx] = product.copyWith(qtyOnHand: product.qtyOnHand + delta);
    adjustments.add(StockAdjustment(
      id: 'ADJ-${adjustments.length + 1}',
      date: DateTime.now(),
      product: products[idx],
      delta: delta,
      reason: reason,
      note: note,
    ));
    notifyListeners();
  }

  void _postPayment({
    required DateTime date,
    required int amount,
    required PaymentMethod method,
    required String forDoc,
    required Customer customer,
    required String signedBy,
  }) {
    _txnSeq += 1;
    transactions.add(Transaction(
      id: 'TXN-${_txnSeq.toString().padLeft(4, '0')}',
      date: date,
      type: forDoc.startsWith('MTK-INV')
          ? TxnType.invoicePayment
          : TxnType.salePayment,
      amount: amount,
      method: method,
      reference: forDoc,
    ));
    _recSeq += 1;
    receipts.add(Receipt(
      number: 'MTK-REC-${_recSeq.toString().padLeft(4, '0')}',
      date: date,
      customer: customer,
      amount: amount,
      method: method,
      forDoc: forDoc,
      signedBy: signedBy,
      issuedBy: 'Admin',
    ));
  }

  // ---------- seed data (deterministic, consistent) ----------

  void _seed() {
    DateTime d(int day, [int h = 12]) => DateTime(2026, 8, day, h);

    Product p(String id, String name, ProductCategory c, int cost, int price,
            int qty, int reorder, {String unit = 'pcs', bool service = false}) =>
        Product(
          id: id,
          name: name,
          category: c,
          costPrice: cost,
          sellingPrice: price,
          qtyOnHand: qty,
          reorderLevel: reorder,
          unit: unit,
          isService: service,
        );

    final f002 = p('F002', 'BOX FOR 6KG FIRE EXTINGUISHER', ProductCategory.fire, 38000, 55000, 24, 10);
    final f003 = p('F003', 'BOX FOR 9KG FIRE EXTINGUISHER', ProductCategory.fire, 45000, 65000, 12, 8);
    final f008 = p('F008', 'BREATHING APPARATUS', ProductCategory.fire, 260000, 350000, 4, 2);
    final s003 = p('S003', 'BODY HARNESS', ProductCategory.safety, 34000, 50000, 18, 6);
    final s005 = p('S005', 'CAUTION CONE (75CM)', ProductCategory.safety, 10000, 16000, 40, 15);
    final s008 = p('S008', 'COMPLETE OVERALL', ProductCategory.safety, 15500, 23000, 9, 12);
    final q002 = p('Q002', 'WALK-THROUGH METAL DETECTOR GATE', ProductCategory.security, 500000, 680000, 2, 1, unit: 'unit');
    final l011 = p('L011', '30AHS CHARGE CONTROLLER', ProductCategory.solar, 13500, 20000, 14, 5);
    final l012 = p('L012', '30 WATTS LED SOLAR LIGHT', ProductCategory.solar, 17000, 25000, 3, 8);
    final h001 = p('H001', 'BAOFENG TWO WAY RADIO BF-7775', ProductCategory.automation, 12000, 18000, 30, 10);
    final h006 = p('H006', 'BELL (24 VDC CHLORIDE UK)', ProductCategory.automation, 9800, 15000, 11, 5);
    final refill = p('SRV-1', 'DCP 6KG REFILL SERVICE', ProductCategory.fire, 3000, 7500, 0, 0, unit: 'job', service: true);

    products.addAll([f002, f003, f008, s003, s005, s008, q002, l011, l012, h001, h006, refill]);

    Customer c(String id, String name, bool corp, {int balance = 0}) =>
        Customer(
          id: id,
          name: name,
          isCorporate: corp,
          phone: '+234 803 000 0000',
          email: corp ? 'procurement@client.example' : 'client@example.com',
          address: 'Kaduna, Nigeria',
          creditBalance: balance,
        );

    final c001 = c('C001', 'Nigerian Breweries — Kaduna Depot', true);
    final c002 = c('C002', 'Kaduna Refining & Petrochemical Co.', true);
    final c003 = c('C003', 'Alhaji Musa Ibrahim', false);
    final c004 = c('C004', 'Engr. Chuka Okafor', false);
    final c005 = c('C005', 'Mrs. Grace Adeyemi', false);
    final c006 = c('C006', 'Barr. Sani Bello', false);

    customers.addAll([c001, c002, c003, c004, c005, c006]);

    List<SaleItem> items(List<(Product, int)> spec) =>
        spec.map((e) => SaleItem(product: e.$1, qty: e.$2)).toList();

    // ---- sales history (paid) ----
    sales.addAll([
      Sale(id: 'S001', date: d(2), customer: c003, method: PaymentMethod.cash, items: items([(f002, 2), (refill, 1)])),
      Sale(id: 'S002', date: d(5), customer: c001, method: PaymentMethod.transfer, items: items([(s003, 4)])),
      Sale(id: 'S003', date: d(8), customer: c005, method: PaymentMethod.pos, items: items([(l012, 1), (l011, 1)])),
      Sale(id: 'S005', date: d(14), customer: c004, method: PaymentMethod.transfer, items: items([(q002, 1)])),
      Sale(id: 'S006', date: d(18), customer: c003, method: PaymentMethod.cash, items: items([(s005, 6)])),
      Sale(id: 'S007', date: d(22), customer: c005, method: PaymentMethod.transfer, items: items([(h001, 2), (h006, 1)])),
      Sale(id: 'S008', date: d(26), customer: c001, method: PaymentMethod.pos, items: items([(s005, 10), (s003, 5)])),
      Sale(id: 'S009', date: d(28), customer: c004, method: PaymentMethod.cash, items: items([(l011, 2), (l012, 1)])),
      Sale(id: 'S010', date: d(29, 10), customer: c003, method: PaymentMethod.transfer, items: items([(f003, 1), (f002, 2)])),
      Sale(id: 'S011', date: d(29, 11), customer: c005, method: PaymentMethod.cash, items: items([(h001, 3)])),
      Sale(id: 'S012', date: d(29, 13), customer: c002, method: PaymentMethod.cash, items: items([(refill, 12)])),
    ]);

    // ---- invoices (credit sales) ----
    final inv1Items = items([(f008, 3)]);
    final inv2Items = items([(q002, 2)]);
    final inv3Items = items([(refill, 40)]);
    final inv4Items = items([(f008, 1), (s008, 2)]);

    invoices.addAll([
      Invoice(number: 'MTK-INV-0001', issued: d(11), due: d(25), customer: c002, items: inv1Items, amountPaid: 1050000),
      Invoice(number: 'MTK-INV-0002', issued: d(14), due: d(28), customer: c001, items: inv2Items, amountPaid: 1000000),
      Invoice(number: 'MTK-INV-0003', issued: d(19), due: DateTime(2026, 9, 2), customer: c002, items: inv3Items),
      Invoice(number: 'MTK-INV-0004', issued: d(5), due: d(19), customer: c006, items: inv4Items),
    ]);

    c001.creditBalance = invoices[1].balance; // 360000
    c002.creditBalance = invoices[2].balance; // 300000
    c006.creditBalance = invoices[3].balance; // 396000

    // ---- transactions & receipts (chronological, consistent with above) ----
    void txn(DateTime date, TxnType type, int amount, PaymentMethod m, String ref) {
      _txnSeq += 1;
      transactions.add(Transaction(
        id: 'TXN-${_txnSeq.toString().padLeft(4, '0')}',
        date: date,
        type: type,
        amount: amount,
        method: m,
        reference: ref,
      ));
    }

    void rec(DateTime date, Customer cust, int amount, PaymentMethod m, String forDoc) {
      _recSeq += 1;
      receipts.add(Receipt(
        number: 'MTK-REC-${_recSeq.toString().padLeft(4, '0')}',
        date: date,
        customer: cust,
        amount: amount,
        method: m,
        forDoc: forDoc,
        signedBy: 'Admin',
        issuedBy: 'Admin',
      ));
    }

    // paid sales
    txn(d(2), TxnType.salePayment, 117500, PaymentMethod.cash, 'S001');
    rec(d(2), c003, 117500, PaymentMethod.cash, 'S001');
    txn(d(5), TxnType.salePayment, 200000, PaymentMethod.transfer, 'S002');
    rec(d(5), c001, 200000, PaymentMethod.transfer, 'S002');
    txn(d(8), TxnType.salePayment, 45000, PaymentMethod.pos, 'S003');
    rec(d(8), c005, 45000, PaymentMethod.pos, 'S003');
    txn(d(14), TxnType.salePayment, 680000, PaymentMethod.transfer, 'S005');
    rec(d(14), c004, 680000, PaymentMethod.transfer, 'S005');
    txn(d(18), TxnType.salePayment, 96000, PaymentMethod.cash, 'S006');
    rec(d(18), c003, 96000, PaymentMethod.cash, 'S006');
    txn(d(22), TxnType.salePayment, 51000, PaymentMethod.transfer, 'S007');
    rec(d(22), c005, 51000, PaymentMethod.transfer, 'S007');
    txn(d(26), TxnType.salePayment, 410000, PaymentMethod.pos, 'S008');
    rec(d(26), c001, 410000, PaymentMethod.pos, 'S008');
    txn(d(28), TxnType.salePayment, 65000, PaymentMethod.cash, 'S009');
    rec(d(28), c004, 65000, PaymentMethod.cash, 'S009');
    txn(d(29, 10), TxnType.salePayment, 175000, PaymentMethod.transfer, 'S010');
    rec(d(29, 10), c003, 175000, PaymentMethod.transfer, 'S010');
    txn(d(29, 11), TxnType.salePayment, 54000, PaymentMethod.cash, 'S011');
    rec(d(29, 11), c005, 54000, PaymentMethod.cash, 'S011');
    txn(d(29, 13), TxnType.salePayment, 90000, PaymentMethod.cash, 'S012');
    rec(d(29, 13), c002, 90000, PaymentMethod.cash, 'S012');

    // invoice payments
    txn(d(20), TxnType.invoicePayment, 1050000, PaymentMethod.transfer, 'MTK-INV-0001');
    rec(d(20), c002, 1050000, PaymentMethod.transfer, 'MTK-INV-0001');
    txn(d(24), TxnType.invoicePayment, 1000000, PaymentMethod.transfer, 'MTK-INV-0002');
    rec(d(24), c001, 1000000, PaymentMethod.transfer, 'MTK-INV-0002');

    // one refund (2 caution cones returned)
    txn(d(24, 16), TxnType.refund, 32000, PaymentMethod.cash, 'Return — S006 (2× caution cone)');
    rec(d(24, 16), c003, 32000, PaymentMethod.cash, 'Credit note — S006');

    // ---- MILS maintenance logs ----
    milsLogs.addAll([
      MaintenanceLog(id: 'MTK-MILS-0001', serviceDate: d(6), equipment: 'DCP 6kg Fire Extinguisher ×24', serial: 'DCP6-2026-118', client: c001, location: 'Depot yard, stations 1–12', action: MaintenanceAction.refill, findings: '12 units at zero pressure, valves replaced', technician: 'Ibrahim Kabeer', nextDue: DateTime(2027, 2, 6)),
      MaintenanceLog(id: 'MTK-MILS-0002', serviceDate: d(12), equipment: 'Maxlogic 2-Zone Fire Alarm Panel', serial: 'FAP-ML2-0091', client: c002, location: 'Control room, block B', action: MaintenanceAction.inspection, findings: 'Zone 2 detector sensitivity low; battery OK', technician: 'Sunday Ademola', nextDue: DateTime(2026, 11, 12)),
      MaintenanceLog(id: 'MTK-MILS-0003', serviceDate: d(15), equipment: 'Flame Fighting Hose Reel + Cabinet', client: c006, location: 'Residence, Barnawa', action: MaintenanceAction.installation, findings: 'New install; pressure test passed', technician: 'Ibrahim Kabeer', nextDue: DateTime(2027, 8, 15)),
      MaintenanceLog(id: 'MTK-MILS-0004', serviceDate: d(20), equipment: 'CCTV (8ch DVR, 6 cameras)', serial: 'DVR8-5521', client: c005, location: 'Shop plaza, Kawo', action: MaintenanceAction.repair, findings: 'Cam 3 lens condensation; replaced', technician: 'Sunday Ademola', nextDue: DateTime(2027, 2, 20)),
      MaintenanceLog(id: 'MTK-MILS-0005', serviceDate: d(25), equipment: 'Walk-Through Metal Detector Gate', serial: 'WTMD-Q2-011', client: c001, location: 'Main gate', action: MaintenanceAction.calibration, findings: 'Sensitivity re-calibrated; zone 4 sensor drifting', technician: 'Musa Danjuma', nextDue: d(28)),
      MaintenanceLog(id: 'MTK-MILS-0006', serviceDate: d(29), equipment: 'Solar Inverter 3kVA + 200Ah Battery', serial: 'INV3K-88412', client: c005, location: 'Residence, Ungwan Rimi', action: MaintenanceAction.inspection, findings: 'Battery water topped up; panels cleaned', technician: 'Musa Danjuma', nextDue: DateTime(2026, 11, 29)),
    ]);

    // ---- stock adjustments (audit trail) ----
    adjustments.addAll([
      StockAdjustment(id: 'ADJ-1', date: d(10), product: f002, delta: 24, reason: AdjustmentReason.restock, note: 'PO-2214 — Bajik supply'),
      StockAdjustment(id: 'ADJ-2', date: d(16), product: s005, delta: -2, reason: AdjustmentReason.damage, note: 'Crushed in storage'),
      StockAdjustment(id: 'ADJ-3', date: d(21), product: s003, delta: 6, reason: AdjustmentReason.restock, note: 'PO-2220'),
      StockAdjustment(id: 'ADJ-4', date: d(25), product: h006, delta: -1, reason: AdjustmentReason.correction, note: 'Shelf count correction'),
    ]);
  }
}
