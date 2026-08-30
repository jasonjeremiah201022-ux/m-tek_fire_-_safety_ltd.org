import 'package:flutter/material.dart';

import '../../core/format.dart' as fmt;
import '../../core/theme.dart';
import '../../data/models.dart';
import '../../data/auth_store.dart';
import '../../data/store.dart';
import '../widgets.dart';

/// STOCK — quantities, prices, low-stock alerts, adjustments (audit trail).
/// Seeded from seed/products_seed.txt (the owner-editable TXT import).
class StockScreen extends StatefulWidget {
  const StockScreen({super.key});

  @override
  State<StockScreen> createState() => _StockScreenState();
}

class _StockScreenState extends State<StockScreen> {

  /// CEO stock import: pick the edited products_seed.txt, rows upsert over
  /// the catalogue (existing IDs update, new IDs append) — no terminal needed.
  Future<void> _importTxt(BuildContext context) async {
    final text = await pickProductsTxt();
    if (text == null || text.trim().isEmpty) return;
    try {
      final count = await AppStore.instance.importProductsTsv(text);
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            backgroundColor: Mtek.success,
            content: Text('$count product row(s) imported — catalogue updated.')));
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            backgroundColor: Mtek.danger,
            content: Text(e.toString().replaceFirst('Exception: ', ''))));
      }
    }
  }

  String _query = '';
  String? _category;

  @override
  Widget build(BuildContext context) {
    final store = AppStore.instance;
    final lowCount = store.products.where((p) => p.isLow).length;

    final list = store.products.where((p) {
      if (_category != null && p.category.name != _category) return false;
      return p.name.toLowerCase().contains(_query.toLowerCase()) ||
          p.id.toLowerCase().contains(_query.toLowerCase());
    }).toList();

    return Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          PageHeader(
            title: 'Stock',
            subtitle:
                '${store.products.length} items · $lowCount low/out of stock · ${fmt.naira(store.stockValueAtCost())} at cost',
            actions: [
              // seed import: CEO ONLY (owner directive 2026-08-30)
              if (AuthStore.instance.isCeo)
                FilledButton.icon(
                  onPressed: () => _importTxt(context),
                  icon: const Icon(Icons.upload_file),
                  label: const Text('Import TXT'),
                ),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: TextField(
                  decoration: const InputDecoration(prefixIcon: Icon(Icons.search), hintText: 'Search by name or ID…'),
                  onChanged: (v) => setState(() => _query = v),
                ),
              ),
              const SizedBox(width: 12),
              DropdownButton<String>(
                value: _category,
                hint: const Text('All categories'),
                items: [
                  const DropdownMenuItem(value: null, child: Text('All categories')),
                  for (final c in ProductCategory.values)
                    DropdownMenuItem(value: c.name, child: Text(c.name.toUpperCase())),
                ],
                onChanged: (v) => setState(() => _category = v),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Expanded(
            child: Card(
              clipBehavior: Clip.antiAlias,
              child: ListView.separated(
                itemCount: list.length,
                separatorBuilder: (_, __) => const Divider(height: 1, color: Mtek.gray100),
                itemBuilder: (context, i) {
                  final p = list[i];
                  return ListTile(
                    leading: CircleAvatar(
                      backgroundColor: p.isOutOfStock
                          ? Mtek.dangerTint
                          : p.isLow
                              ? Mtek.warnTint
                              : Mtek.brandTint,
                      child: Text(
                        '${p.qtyOnHand}',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w800,
                          color: p.isOutOfStock ? Mtek.danger : p.isLow ? Mtek.warn : Mtek.brand600,
                        ),
                      ),
                    ),
                    title: Text(p.name, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                    subtitle: Text(
                        '${p.id} · ${p.category.name.toUpperCase()} · cost ${fmt.naira(p.costPrice)} · reorder @ ${p.reorderLevel}'),
                    trailing: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        AmountText(p.sellingPrice),
                        const SizedBox(width: 12),
                        // stock edits: CEO/Admin only (server-enforced too)
                        if (AuthStore.instance.isManagement)
                          IconButton(
                            tooltip: 'Adjust stock',
                            icon: const Icon(Icons.tune, color: Mtek.navy700),
                            onPressed: () => _adjustDialog(context, p),
                          ),
                      ],
                    ),
                  );
                },
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _adjustDialog(BuildContext context, Product p) {
    final qtyCtrl = TextEditingController();
    AdjustmentReason reason = AdjustmentReason.restock;
    showDialog<void>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: Text('Adjust — ${p.name}'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('Current: ${p.qtyOnHand} ${p.unit}', style: const TextStyle(color: Mtek.gray500)),
              const SizedBox(height: 12),
              TextField(
                controller: qtyCtrl,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Quantity change (use − for out)'),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<AdjustmentReason>(
                value: reason,
                items: [
                  for (final r in AdjustmentReason.values)
                    DropdownMenuItem(value: r, child: Text(r.name.toUpperCase())),
                ],
                onChanged: (v) => setDialogState(() => reason = v!),
              ),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
            FilledButton(
              onPressed: () {
                final delta = int.tryParse(qtyCtrl.text) ?? 0;
                if (delta != 0) {
                  AppStore.instance.adjustStock(p, delta, reason, 'Manual adjustment');
                  ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('Stock adjusted (${delta >= 0 ? '+' : ''}$delta) — logged in audit trail.')));
                }
                Navigator.pop(context);
              },
              child: const Text('Apply'),
            ),
          ],
        ),
      ),
    );
  }
}
