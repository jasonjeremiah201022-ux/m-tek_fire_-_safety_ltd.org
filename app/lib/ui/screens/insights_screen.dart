import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';

import '../../core/format.dart' as fmt;
import '../../core/theme.dart';
import '../../data/models.dart';
import '../../data/sample_store.dart';
import '../widgets.dart';

/// INSIGHTS — revenue, avg. transaction value, revenue breakdown.
class InsightsScreen extends StatelessWidget {
  const InsightsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final store = SampleStore.instance;
    final byCat = store.revenueByCategory();
    final byMethod = store.revenueByMethod();
    final atv = store.avgTransactionValue();

    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        const PageHeader(
          title: 'Insights',
          subtitle: 'Money in — today, this week, this month',
        ),
        const SizedBox(height: 16),
        LayoutBuilder(builder: (context, c) {
          final cols = c.maxWidth > 1100 ? 3 : (c.maxWidth > 640 ? 2 : 1);
          return Wrap(
            spacing: 14,
            runSpacing: 14,
            children: [
              SizedBox(
                width: (c.maxWidth - (cols - 1) * 14) / cols,
                child: StatCard(
                  label: 'Revenue — today',
                  value: fmt.naira(store.revenueToday),
                  hint: '${DateTime.now().day}/${DateTime.now().month}/${DateTime.now().year}',
                  icon: Icons.today_outlined,
                ),
              ),
              SizedBox(
                width: (c.maxWidth - (cols - 1) * 14) / cols,
                child: StatCard(
                  label: 'Revenue — this week',
                  value: fmt.naira(store.revenueThisWeek),
                  icon: Icons.date_range_outlined,
                  accent: Mtek.navy700,
                ),
              ),
              SizedBox(
                width: (c.maxWidth - (cols - 1) * 14) / cols,
                child: StatCard(
                  label: 'Revenue — this month',
                  value: fmt.naira(store.revenueThisMonth),
                  hint: 'Net of refunds',
                  icon: Icons.calendar_month_outlined,
                  accent: Mtek.gold500,
                ),
              ),
              SizedBox(
                width: (c.maxWidth - (cols - 1) * 14) / cols,
                child: StatCard(
                  label: 'Avg. transaction value',
                  value: fmt.naira(atv),
                  hint: 'Net revenue ÷ paying transactions',
                  icon: Icons.query_stats_outlined,
                  accent: Mtek.success,
                ),
              ),
              SizedBox(
                width: (c.maxWidth - (cols - 1) * 14) / cols,
                child: StatCard(
                  label: 'Outstanding invoices',
                  value: fmt.naira(store.outstandingInvoicesTotal()),
                  hint: 'Credit to collect',
                  icon: Icons.hourglass_top_outlined,
                  accent: Mtek.warn,
                ),
              ),
              SizedBox(
                width: (c.maxWidth - (cols - 1) * 14) / cols,
                child: StatCard(
                  label: 'Stock value (cost)',
                  value: fmt.naira(store.stockValueAtCost()),
                  icon: Icons.inventory_2_outlined,
                  accent: Mtek.navy700,
                ),
              ),
            ],
          );
        }),
        const SizedBox(height: 20),
        const Text('REVENUE BREAKDOWN', style: TextStyle(fontSize: 12, letterSpacing: 1.2, fontWeight: FontWeight.w700, color: Mtek.gray500)),
        const SizedBox(height: 12),
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
                        const Text('By category', style: TextStyle(fontWeight: FontWeight.w700)),
                        const SizedBox(height: 12),
                        SizedBox(
                          height: 240,
                          child: byCat.isEmpty
                              ? const EmptyHint('No revenue recorded yet')
                              : PieChart(
                                  PieChartData(
                                    sectionsSpace: 2,
                                    centerSpaceRadius: 48,
                                    sections: byCat.entries.map((e) {
                                      final total = byCat.values.fold(0, (a, b) => a + b);
                                      final pct = total == 0 ? 0 : e.value * 100 ~/ total;
                                      return PieChartSectionData(
                                        value: e.value.toDouble(),
                                        title: '$pct%',
                                        titleStyle: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Colors.white),
                                        color: _catColor(e.key),
                                        radius: 56,
                                      );
                                    }).toList(),
                                  ),
                                ),
                        ),
                        const SizedBox(height: 8),
                        Wrap(
                          spacing: 14,
                          runSpacing: 6,
                          children: [
                            for (final e in byCat.entries)
                              _legend(_catColor(e.key), _catName(e.key), e.value),
                          ],
                        ),
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
                        const Text('By payment method', style: TextStyle(fontWeight: FontWeight.w700)),
                        const SizedBox(height: 16),
                        ...byMethod.entries.map((e) {
                          final total = byMethod.values.fold(0, (a, b) => a + b);
                          final pct = total == 0 ? 0.0 : e.value / total;
                          return Padding(
                            padding: const EdgeInsets.only(bottom: 14),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    MethodIcon(e.key),
                                    const SizedBox(width: 8),
                                    Text(MethodIcon.label(e.key), style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                                    const Spacer(),
                                    AmountText(e.value),
                                    const SizedBox(width: 8),
                                    Text('${(pct * 100).toStringAsFixed(0)}%', style: const TextStyle(color: Mtek.gray500, fontSize: 12)),
                                  ],
                                ),
                                const SizedBox(height: 6),
                                ClipRRect(
                                  borderRadius: BorderRadius.circular(6),
                                  child: LinearProgressIndicator(
                                    value: pct,
                                    minHeight: 8,
                                    backgroundColor: Mtek.gray100,
                                    color: Mtek.brand600,
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
            ],
          );
        }),
      ],
    );
  }

  Widget _legend(Color color, String label, int value) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(width: 10, height: 10, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
        const SizedBox(width: 6),
        Text('$label — ${fmt.nairaCompact(value)}', style: const TextStyle(fontSize: 12, color: Mtek.gray600)),
      ],
    );
  }

  Color _catColor(ProductCategory c) => switch (c) {
        ProductCategory.fire => Mtek.brand600,
        ProductCategory.safety => Mtek.gold500,
        ProductCategory.security => Mtek.navy700,
        ProductCategory.solar => Mtek.success,
        ProductCategory.automation => Mtek.brand300,
      };

  String _catName(ProductCategory c) => switch (c) {
        ProductCategory.fire => 'Fire',
        ProductCategory.safety => 'Safety',
        ProductCategory.security => 'Security',
        ProductCategory.solar => 'Solar',
        ProductCategory.automation => 'Automation & Surveillance',
      };
}
