import 'dart:async';
import 'dart:collection';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart' show rootBundle;

import 'env.dart';
import 'local_store.dart';
import 'models.dart';
import 'rest_client.dart';
import '../documents/serial_service.dart';
import 'seed_import.dart';

/// AppStore — the Phase B data layer. Same observable API the screens were
/// built against, now:
///   1. loads from the LOCAL CACHE (local_store, JSON per collection),
///   2. falls back to the bundled TXT seed (products) + demo dataset,
///   3. every mutation PERSISTS locally and enqueues a sync record,
///   4. a sync flush pushes the queue to Supabase REST when configured
///      (env.dart) — the app stays fully usable offline (SPEC §5, §12 Phase B).
class AppStore extends ChangeNotifier {
  AppStore._();
  static final AppStore instance = AppStore._();

  final List<Product> products = [];
  final List<Customer> customers = [];
  final List<Sale> sales = [];
  final List<Transaction> transactions = [];
  final List<Receipt> receipts = [];
  final List<Invoice> invoices = [];
  final List<MaintenanceLog> milsLogs = [];
  final List<StockAdjustment> adjustments = [];

  /// Generated-document history (Phase A/B): every PDF the app issued.
  final List<IssuedDocument> docHistory = [];

  StoreSettings settings = StoreSettings();
  final List<Map<String, dynamic>> _syncQueue = [];
  bool _loaded = false;
  bool get isLoaded => _loaded;

  RestClient? _remote;

  // ---------------------------------------------------------------- init
  Future<void> init() async {
    if (_loaded) return;
    if (Env.supabaseUrl.isNotEmpty) {
      _remote = RestClient(
        baseUrl: Env.supabaseUrl,
        apiKey: Env.supabaseAnonKey,
      );
    }
    final loadedAny = await _loadLocal();
    if (!loadedAny) {
      await _importBundledSeed();
      _seedDemo();
      await _persistAll();
    }
    _loaded = true;
    notifyListeners();
    unawaited(flushSyncQueue());
  }

  Future<List<dynamic>> _readList(String key) async {
    final raw = await localRead(key);
    if (raw == null || raw.isEmpty) return const [];
    try {
      final decoded = jsonDecode(raw);
      return decoded is List ? decoded : const [];
    } catch (_) {
      return const [];
    }
  }

  Future<bool> _loadLocal() async {
    final rawProducts = await _readList('products');
    final rawCustomers = await _readList('customers');
    if (rawProducts.isEmpty && rawCustomers.isEmpty) return false;

    products.addAll(parseProducts(rawProducts));
    for (final e in rawCustomers) {
      if (e is Map) customers.add(parseCustomer((e).cast<String, dynamic>()));
    }
    final rawTxns = await _readList('transactions');
    for (final e in rawTxns) {
      if (e is Map) {
        final m = (e).cast<String, dynamic>();
        transactions.add(Transaction(
          id: '${m['id'] ?? ''}',
          date: DateTime.tryParse('${m['date']}') ?? DateTime.now(),
          type: TxnType.values.firstWhere((t) => t.name == m['type'], orElse: () => TxnType.salePayment),
          amount: _asInt(m['amount']),
          method: PaymentMethod.values.firstWhere((t) => t.name == m['method'], orElse: () => PaymentMethod.cash),
          reference: '${m['reference'] ?? ''}',
        ));
      }
    }
    final rawSettings = await readStore('settings');
    if (rawSettings.isNotEmpty) {
      settings = StoreSettings.fromJson(rawSettings);
    }
    final rawSerials = await readStore('serials');
    if (rawSerials.isNotEmpty) {
      SerialService.instance.loadFrom(rawSerials);
    }
    final rawReceipts = await _readList('receipts');
    for (final e in rawReceipts) {
      if (e is Map) {
        final m = (e).cast<String, dynamic>();
        receipts.add(Receipt(
          number: '${m['number'] ?? ''}',
          date: DateTime.tryParse('${m['date']}') ?? DateTime.now(),
          customer: Customer(id: 'r', name: '${m['customer'] ?? ''}', isCorporate: false, phone: '', email: '', address: ''),
          amount: _asInt(m['amount']),
          method: PaymentMethod.values.firstWhere((t) => t.name == m['method'], orElse: () => PaymentMethod.cash),
          forDoc: '${m['for_doc'] ?? ''}',
          signedBy: '${m['signed_by'] ?? 'Admin'}',
          issuedBy: '${m['issued_by'] ?? 'Admin'}',
        ));
      }
    }
    final rawDocs = await _readList('doc_history');
    for (final e in rawDocs) {
      if (e is Map) docHistory.add(IssuedDocument.fromJson((e).cast<String, dynamic>()));
    }
    return true;
  }

  /// First run: import the owner-editable seed file bundled as an asset
  /// (seed/products_seed.txt workflow — SPEC §8).
  Future<void> _importBundledSeed() async {
    try {
      final csv = await rootBundle.loadString('assets/seed/products_seed.txt');
      if (csv.trim().isEmpty) return;
      final imported = parseSeedTsv(csv);
      // seed rows upsert over whatever is loaded (they are authoritative)
      for (final p in imported) {
        final idx = products.indexWhere((x) => x.id == p.id);
        if (idx == -1) {
          products.add(p);
        } else {
          products[idx] = p;
        }
      }
    } catch (_) {
      // missing/malformed bundle → app still starts with the demo dataset
    }
  }

  /// Owner sends an edited TXT back → Admin imports it here (Stock screen).
  Future<int> importSeedCsv(String tsv) async {
    final imported = parseSeedTsv(tsv);
    var added = 0;
    for (final p in imported) {
      final idx = products.indexWhere((x) => x.id == p.id);
      if (idx == -1) {
        products.add(p);
        added++;
      } else {
        products[idx] = p;
      }
    }
    await writeStore('products', products.map(productToJson).toList());
    enqueueSync('products', products.map(productToJson).toList());
    notifyListeners();
    return added;
  }

  // ---------------------------------------------------------------- sync
  void enqueueSync(String table, List<Map<String, dynamic>> rows) {
    _syncQueue.add({'table': table, 'rows': rows, 'at': DateTime.now().toIso8601String()});
    writeStore('sync_queue', _syncQueue);
  }

  /// Pushes the offline queue to Supabase (PostgREST). No-op when the
  /// backend isn't configured or the device is offline — the queue stays.
  Future<void> flushSyncQueue() async {
    if (_remote == null || _syncQueue.isEmpty) return;
    final pending = List.of(_syncQueue);
    for (final job in pending) {
      final ok = await _remote!.upsertRows(job['table'] as String, job['rows'] as List<Map<String, dynamic>>);
      if (ok) _syncQueue.remove(job);
    }
    await writeStore('sync_queue', _syncQueue);
  }

  // ---------------------------------------------------------------- docs
  /// Persists a generated document (Phase A flow) into history + serials.
  Future<IssuedDocument> issueDocument({
    required String type,
    required int serial,
    required String customer,
    required double total,
    required String signedBy,
    required String verifyHash,
  }) async {
    final doc = IssuedDocument(
      type: type,
      serial: serial,
      customer: customer,
      total: total,
      signedBy: signedBy,
      verifyHash: verifyHash,
      issuedAt: DateTime.now(),
    );
    docHistory.insert(0, doc);
    await writeStore('doc_history', docHistory.map((d) => d.toJson()).toList());
    enqueueSync('documents', [doc.toJson()]);
    unawaited(flushSyncQueue());
    notifyListeners();
    return doc;
  }

  // ------------------------------------------------------------ settings
  Future<void> updateSettings({
    bool? vatEnabled,
    double? vatRate,
    Map<String, int>? serialReseed,
  }) async {
    if (vatEnabled != null) settings = settings.copyWith(vatEnabled: vatEnabled);
    if (vatRate != null) settings = settings.copyWith(vatRate: vatRate);
    if (serialReseed != null) {
      for (final e in serialReseed.entries) {
        SerialService.instance.reseed(e.key, e.value);
      }
    }
    await writeStore('settings', settings.toJson());
    notifyListeners();
  }

  // ------------------------------------------------------- persistence IO
  Future<void> writeStore(String key, Object data) =>
      localWrite(key, jsonEncode(data));

  Future<Map<String, dynamic>> readStore(String key) async {
    final raw = await localRead(key);
    if (raw == null || raw.isEmpty) return {};
    try {
      return jsonDecode(raw) as Map<String, dynamic>;
    } catch (_) {
      return {};
    }
  }

  Future<void> _persistAll() async {
    await writeStore('products', products.map(productToJson).toList());
    await writeStore('customers', customers.map(customerToJson).toList());
    await writeStore('settings', settings.toJson());
    await writeStore('serials', SerialService.instance.toJson());
  }

  // ------------------------------------------------------------ analytics

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

  /// Avg. transaction value = net revenue / paying transactions.
  int avgTransactionValue() {
    final paying = transactions.where((t) => !t.isRefund).length;
    return paying == 0 ? 0 : revenue() ~/ paying;
  }

  /// Revenue grouped by product category (for the breakdown chart).
  Map<ProductCategory, int> revenueByCategory() {
    final byCat = <ProductCategory, int>{};
    for (final sale in sales) {
      for (final item in sale.items) {
        if (sale.method == PaymentMethod.credit && !_invoiceFullyPaid(sale)) {
          continue; // credit counts when the invoice is paid
        }
        byCat[item.product.category] =
            (byCat[item.product.category] ?? 0) + item.total;
      }
    }
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
      .where((i) =>
          i.items.length == sale.items.length && i.total == sale.total)
      .any((i) => i.amountPaid >= i.total);

  int stockValueAtCost() =>
      products.fold(0, (s, p) => s + (p.isService ? 0 : p.costPrice * p.qtyOnHand));

  int outstandingInvoicesTotal() => invoices.fold(0, (s, i) => s + i.balance);

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

  // ------------------------------------------------------------ mutations
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
    for (final i in items) {
      final idx = products.indexWhere((p) => p.id == i.product.id);
      if (idx != -1 && !products[idx].isService) {
        products[idx] = products[idx].copyWith(qtyOnHand: products[idx].qtyOnHand - i.qty);
      }
    }
    if (method == PaymentMethod.credit) {
      final number = 'MTK-INV-${(invoices.length + 1).toString().padLeft(4, '0')}';
      invoices.add(Invoice(
        number: number,
        issued: now,
        due: now.add(const Duration(days: 14)),
        customer: customer,
        items: List.of(items),
      ));
    } else {
      _postPayment(date: now, amount: sale.total, method: method, forDoc: sale.id, customer: customer, signedBy: signedBy);
    }
    unawaited(_persistSaleSide(sale));
    notifyListeners();
  }

  Future<void> _persistSaleSide(Sale sale) async {
    await writeStore('products', products.map(productToJson).toList());
    await writeStore('sales', sales.map(saleToJson).toList());
    await writeStore('transactions', transactions.map(txnToJson).toList());
    await writeStore('receipts', receipts.map(receiptToJson).toList());
    await writeStore('invoices', invoices.map(invoiceToJson).toList());
    enqueueSync('sales', [saleToJson(sale)]);
    unawaited(flushSyncQueue());
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
    _postPayment(date: now, amount: amount, method: PaymentMethod.transfer, forDoc: invoice.number, customer: invoice.customer, signedBy: signedBy);
    unawaited(_persistSaleSide(invoices[idx]));
    notifyListeners();
  }

  void adjustStock(Product product, int delta, AdjustmentReason reason, String note) {
    final idx = products.indexOf(product);
    products[idx] = product.copyWith(qtyOnHand: product.qtyOnHand + delta);
    final adj = StockAdjustment(
      id: 'ADJ-${adjustments.length + 1}',
      date: DateTime.now(),
      product: products[idx],
      delta: delta,
      reason: reason,
      note: note,
    );
    adjustments.insert(0, adj);
    unawaited(() async {
      await writeStore('products', products.map(productToJson).toList());
      await writeStore('adjustments', adjustments.map(adjToJson).toList());
      enqueueSync('stock_adjustments', [adjToJson(adj)]);
      unawaited(flushSyncQueue());
    }());
    notifyListeners();
  }

  void addCustomer(Customer c) {
    customers.add(c);
    unawaited(() async {
      await writeStore('customers', customers.map(customerToJson).toList());
      enqueueSync('customers', [customerToJson(c)]);
      unawaited(flushSyncQueue());
    }());
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
    final txnSeq = transactions.length + 1;
    transactions.add(Transaction(
      id: 'TXN-${txnSeq.toString().padLeft(4, '0')}',
      date: date,
      type: forDoc.startsWith('MTK-INV') ? TxnType.invoicePayment : TxnType.salePayment,
      amount: amount,
      method: method,
      reference: forDoc,
    ));
    receipts.add(Receipt(
      number: 'MTK-REC-${(receipts.length + 1).toString().padLeft(4, '0')}',
      date: date,
      customer: customer,
      amount: amount,
      method: method,
      forDoc: forDoc,
      signedBy: signedBy,
      issuedBy: 'Admin',
    ));
  }

  // ------------------------------------------------------- demo fallback
  void _seedDemo() {
    DateTime d(int day, [int h = 12]) => DateTime(2026, 8, day, h);
    Product p(String id, String name, ProductCategory c, int cost, int price, int qty, int reorder,
        {String unit = 'pcs', bool service = false}) {
      return Product(
        id: id, name: name, category: c, costPrice: cost, sellingPrice: price,
        qtyOnHand: qty, reorderLevel: reorder, unit: unit, isService: service,
      );
    }

    final f002 = p('F002', 'BOX FOR 6KG FIRE EXTINGUISHER', ProductCategory.fire, 38000, 55000, 24, 10);
    final f003 = p('F003', 'BOX FOR 9KG FIRE EXTINGUISHER', ProductCategory.fire, 45000, 65000, 12, 8);
    final refill = p('SRV-1', 'DCP 6KG REFILL SERVICE', ProductCategory.fire, 3000, 7500, 0, 0, unit: 'job', service: true);
    products.addAll([f002, f003, refill]);

    Customer c(String id, String name, bool corp, {int balance = 0}) => Customer(
          id: id, name: name, isCorporate: corp,
          phone: '+234 803 000 0000', email: 'client@example.com',
          address: 'Kaduna, Nigeria', creditBalance: balance,
        );
    final c003 = c('C003', 'Alhaji Musa Ibrahim', false);
    customers.addAll([c003, c('C001', 'Nigerian Breweries — Kaduna Depot', true, balance: 360000)]);

    final sale = Sale(
      id: 'S001', date: d(2),
      customer: c003, method: PaymentMethod.cash,
      items: [SaleItem(product: f002, qty: 2), SaleItem(product: refill, qty: 1)],
    );
    sales.add(sale);
    transactions.add(Transaction(
      id: 'TXN-0001', date: d(2), type: TxnType.salePayment,
      amount: sale.total, method: PaymentMethod.cash, reference: 'S001',
    ));
    receipts.add(Receipt(
      number: 'MTK-REC-0001', date: d(2), customer: c003,
      amount: sale.total, method: PaymentMethod.cash, forDoc: 'S001',
      signedBy: 'Admin', issuedBy: 'Admin',
    ));
  }
}

// ---------------------------------------------------------------- model IO
// Lightweight JSON shims kept beside the store so models stay dependency-free.

Map<String, dynamic> productToJson(Product p) => {
      'id': p.id, 'name': p.name, 'category': p.category.name,
      'cost_price': p.costPrice, 'selling_price': p.sellingPrice,
      'qty_on_hand': p.qtyOnHand, 'reorder_level': p.reorderLevel,
      'unit': p.unit, 'is_service': p.isService,
    };

List<Product> parseProducts(dynamic raw) {
  final list = raw is List ? raw : (raw is Map ? raw['rows'] ?? raw['items'] ?? const [] : const []);
  return list.map<Product>((e) {
    final m = (e as Map).cast<String, dynamic>();
    return Product(
      id: '${m['id'] ?? m['ID'] ?? ''}',
      name: '${m['name'] ?? m['NAME'] ?? ''}',
      category: ProductCategory.values.firstWhere(
        (c) => c.name == (m['category'] ?? ''), orElse: () => ProductCategory.fire),
      costPrice: _asInt(m['cost_price'] ?? m['COST PRICE (NGN)']),
      sellingPrice: _asInt(m['selling_price'] ?? m['SELLING PRICE (NGN)']),
      qtyOnHand: _asInt(m['qty_on_hand'] ?? m['QTY / OPENING BALANCE']),
      reorderLevel: _asInt(m['reorder_level'] ?? m['REORDER LEVEL']),
      unit: '${m['unit'] ?? 'pcs'}',
      isService: m['is_service'] == true,
    );
  }).toList();
}

Customer parseCustomer(Map<String, dynamic> m) => Customer(
      id: '${m['id'] ?? ''}', name: '${m['name'] ?? ''}',
      isCorporate: m['is_corporate'] == true,
      phone: '${m['phone'] ?? ''}', email: '${m['email'] ?? ''}',
      address: '${m['address'] ?? ''}',
      creditBalance: _asInt(m['credit_balance']),
    );

Map<String, dynamic> customerToJson(Customer c) => {
      'id': c.id, 'name': c.name, 'is_corporate': c.isCorporate,
      'phone': c.phone, 'email': c.email, 'address': c.address,
      'credit_balance': c.creditBalance,
    };

Map<String, dynamic> saleToJson(Sale s) => {
      'id': s.id, 'date': s.date.toIso8601String(), 'customer': s.customer.id,
      'items': s.items.map((i) => {'product': i.product.id, 'qty': i.qty, 'unit_price': i.unitPrice}).toList(),
      'discount': s.discount, 'method': s.method.name,
    };

Map<String, dynamic> txnToJson(Transaction t) => {
      'id': t.id, 'date': t.date.toIso8601String(), 'type': t.type.name,
      'amount': t.amount, 'method': t.method.name, 'reference': t.reference,
    };

Map<String, dynamic> receiptToJson(Receipt r) => {
      'number': r.number, 'date': r.date.toIso8601String(),
      'customer': r.customer.name, 'amount': r.amount,
      'method': r.method.name, 'for_doc': r.forDoc,
      'signed_by': r.signedBy, 'issued_by': r.issuedBy,
    };

Map<String, dynamic> invoiceToJson(Invoice i) => {
      'number': i.number, 'issued': i.issued.toIso8601String(),
      'due': i.due.toIso8601String(), 'customer': i.customer.name,
      'amount_paid': i.amountPaid, 'total': i.total,
    };

Map<String, dynamic> adjToJson(StockAdjustment a) => {
      'id': a.id, 'date': a.date.toIso8601String(), 'product': a.product.id,
      'delta': a.delta, 'reason': a.reason.name, 'note': a.note,
    };

int _asInt(dynamic v) => v is int ? v : v is num ? v.round() : int.tryParse('$v') ?? 0;

// ------------------------------------------------------------- settings
class StoreSettings {
  final bool vatEnabled;
  final double vatRate;
  StoreSettings({this.vatEnabled = false, this.vatRate = 0.075});

  StoreSettings copyWith({bool? vatEnabled, double? vatRate}) => StoreSettings(
        vatEnabled: vatEnabled ?? this.vatEnabled,
        vatRate: vatRate ?? this.vatRate,
      );

  Map<String, dynamic> toJson() => {'vat_enabled': vatEnabled, 'vat_rate': vatRate};
  static StoreSettings fromJson(Map<String, dynamic> j) => StoreSettings(
        vatEnabled: j['vat_enabled'] == true,
        vatRate: (j['vat_rate'] as num?)?.toDouble() ?? 0.075,
      );
}

/// One row of the generated-document history (Phase A/B).
class IssuedDocument {
  final String type; // receipt | invoice | mils
  final int serial;
  final String customer;
  final double total;
  final String signedBy;
  final String verifyHash;
  final DateTime issuedAt;
  IssuedDocument({
    required this.type,
    required this.serial,
    required this.customer,
    required this.total,
    required this.signedBy,
    required this.verifyHash,
    required this.issuedAt,
  });

  Map<String, dynamic> toJson() => {
        'type': type, 'serial': serial, 'customer': customer,
        'total': total, 'signed_by': signedBy,
        'verify_hash': verifyHash, 'issued_at': issuedAt.toIso8601String(),
      };
  static IssuedDocument fromJson(Map<String, dynamic> j) => IssuedDocument(
        type: '${j['type']}', serial: _asInt(j['serial']),
        customer: '${j['customer']}', total: (j['total'] as num?)?.toDouble() ?? 0,
        signedBy: '${j['signed_by']}', verifyHash: '${j['verify_hash']}',
        issuedAt: DateTime.tryParse('${j['issued_at']}') ?? DateTime.now(),
      );
}

// re-export for callers that imported it from here
export 'models.dart';
export 'seed_import.dart';
