import 'package:flutter/material.dart';

import '../../core/format.dart' as fmt;
import '../../core/theme.dart';
import '../../data/store.dart';
import '../widgets.dart';

/// SUMMARY — period report: totals, profit estimate, top products,
/// stock valuation, outstanding invoices. M4: export as PDF/share.
class SummaryScreen extends StatefulWidget {
  const SummaryScreen({super.key});

  @override
  State<SummaryScreen> createState() => _SummaryScreenState();
}

class _SummaryScreenState extends State<SummaryScreen> {
  String _period = 'month';

  @override
  Widget build(BuildContext context) {
    final store = AppStore.instance;
    final now = DateTime.now();
    final (from, label) = switch (_period) {
      'today' => (DateTime(now.year, now.month, now.day), 'Today'),
      'week' => (
          now.subtract(Duration(days: now.weekday - 1)),
          'This week',
        ),
      _ => (DateTime(now.year, now.month), 'This month'),
    };

    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        PageHeader(
          title: 'Summary',
          subtitle: 'Business report — $label (Aug 2026)',
          actions: [
            OutlinedButton.icon(onPressed: () {}, icon: const Icon(Icons.ios_share, size: 18), label: const Text('Export PDF')),
          ],
        ),
        const SizedBox(height: 14),
        Wrap(
          spacing: 8,
          children: [
            for (final p in const [('today', 'Daily'), ('week', 'Weekly'), ('month', 'Monthly')])
              ChoiceChip(
                label: Text(p.$2),
                selected: _period == p.$1,
                selectedColor: Mtek.brandTint,
                onSelected: (_) => setState(() => _period = p.$1),
              ),
          ],
        ),
        const SizedBox(height: 16),
        LayoutBuilder(builder: (context, c) {
          final cols = c.maxWidth > 1000 ? 4 : 2;
          return Wrap(
            spacing: 14,
            runSpacing: 14,
            children: [
              for (final card in [
                ('Revenue (net)', store.revenue(from: from), Icons.payments_outlined, Mtek.brand600),
                ('Profit estimate', store.estimatedProfit(from: from), Icons.trending_up_outlined, Mtek.success),
                ('Stock value (cost)', store.stockValueAtCost(), Icons.inventory_2_outlined, Mtek.navy700),
                ('Outstanding invoices', store.outstandingInvoicesTotal(), Icons.hourglass_top_outlined, Mtek.warn),
              ])
                SizedBox(
                  width: (c.maxWidth - (cols - 1) * 14) / cols,
                  child: StatCard(label: card.$1, value: fmt.naira(card.$2), icon: card.$3, accent: card.$4),
                ),
            ],
          );
        }),
        const SizedBox(height: 20),
        LayoutBuilder(builder: (context, c) {
          final two = c.maxWidth > 900;
          return Wrap(
            spacing: 14,
            runSpacing: 14,
            children: [
              SizedBox(
                width: two ? c.maxWidth * 0.485 : c.maxWidth,
                child: Card(
                  child: Padding(
                    padding: const EdgeInsets.all(18),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Top products (all-time)', style: TextStyle(fontWeight: FontWeight.w700)),
                        const SizedBox(height: 12),
                        ...store.topProducts().entries.toList().asMap().entries.map((e) {
                          final max = store.topProducts().values.first;
                          return Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Text('#${e.key + 1} ${e.value.key}',
                                        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                                    const Spacer(),
                                    AmountText(e.value.value),
                                  ],
                                ),
                                const SizedBox(height: 6),
                                ClipRRect(
                                  borderRadius: BorderRadius.circular(6),
                                  child: LinearProgressIndicator(
                                    value: max == 0 ? 0 : e.value.value / max,
                                    minHeight: 8,
                                    backgroundColor: Mtek.gray100,
                                    color: Mtek.gold500,
                                  ),
                                ),
                              ],
                            ),
                          );
                        }),
                      ],
                    ),
                  ),
                ),
              ),
              SizedBox(
                width: two ? c.maxWidth * 0.485 : c.maxWidth,
                child: Card(
                  child: Padding(
                    padding: const EdgeInsets.all(18),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Attention needed', style: TextStyle(fontWeight: FontWeight.w700)),
                        const SizedBox(height: 12),
                        for (final p in store.products.where((p) => p.isLow))
                          ListTile(
                            contentPadding: EdgeInsets.zero,
                            dense: true,
                            leading: Icon(
                              p.isOutOfStock ? Icons.error_outline : Icons.warning_amber_outlined,
                              color: p.isOutOfStock ? Mtek.danger : Mtek.warn,
                            ),
                            title: Text(p.name, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                            subtitle: Text('${p.qtyOnHand} left · reorder level ${p.reorderLevel}', style: const TextStyle(fontSize: 12)),
                            trailing: Text(p.isOutOfStock ? 'OUT' : 'LOW',
                                style: TextStyle(color: p.isOutOfStock ? Mtek.danger : Mtek.warn, fontWeight: FontWeight.w800, fontSize: 12)),
                          ),
                        for (final inv in store.invoices.where((i) => i.balance > 0))
                          ListTile(
                            contentPadding: EdgeInsets.zero,
                            dense: true,
                            leading: const Icon(Icons.request_quote_outlined, color: Mtek.brand600),
                            title: Text('${inv.number} — ${inv.customer.name}', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                            subtitle: Text('Due ${fmt.fmtDate(inv.due)}', style: const TextStyle(fontSize: 12)),
                            trailing: AmountText(inv.balance, color: Mtek.danger),
                          ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          );
        }),
      ],
    );
  }
}
