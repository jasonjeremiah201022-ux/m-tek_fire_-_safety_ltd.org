import 'package:flutter/material.dart';

import '../../core/format.dart' as fmt;
import '../../core/theme.dart';
import '../../data/models.dart';
import '../../data/sample_store.dart';
import '../widgets.dart';

/// INVOICES — bill now, pay later (corporate clients).
/// Payments post a Transaction + Receipt automatically.
class InvoicesScreen extends StatelessWidget {
  const InvoicesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final store = SampleStore.instance;
    final invoices = store.invoices.reversed.toList();

    return Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          PageHeader(
            title: 'Invoices',
            subtitle: '${store.outstandingInvoicesTotal() == 0 ? "All settled" : "${fmt.naira(store.outstandingInvoicesTotal())} outstanding"}',
            actions: [
              FilledButton.icon(
                onPressed: () {},
                icon: const Icon(Icons.post_add),
                label: const Text('New invoice'),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Expanded(
            child: Card(
              clipBehavior: Clip.antiAlias,
              child: ListView.separated(
                itemCount: invoices.length,
                separatorBuilder: (_, __) => const Divider(height: 1, color: Mtek.gray100),
                itemBuilder: (context, i) {
                  final inv = invoices[i];
                  final status = inv.status(DateTime.now());
                  return ListTile(
                    leading: const CircleAvatar(
                      backgroundColor: Mtek.brandTint,
                      child: Icon(Icons.request_quote, size: 18, color: Mtek.brand600),
                    ),
                    title: Text('${inv.number} — ${inv.customer.name}',
                        style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                    subtitle: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Issued ${fmt.fmtDate(inv.issued)} · Due ${fmt.fmtDate(inv.due)}'),
                        const SizedBox(height: 5),
                        ClipRRect(
                          borderRadius: BorderRadius.circular(6),
                          child: LinearProgressIndicator(
                            value: inv.total == 0 ? 0 : inv.amountPaid / inv.total,
                            minHeight: 6,
                            backgroundColor: Mtek.gray100,
                            color: status == InvoiceStatus.paid ? Mtek.success : Mtek.brand600,
                          ),
                        ),
                      ],
                    ),
                    trailing: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        _statusChip(status),
                        const SizedBox(height: 6),
                        AmountText(inv.total),
                        if (inv.balance > 0)
                          Text('Balance ${fmt.nairaCompact(inv.balance)}',
                              style: const TextStyle(fontSize: 11, color: Mtek.danger)),
                      ],
                    ),
                    onTap: () => _actions(context, inv),
                  );
                },
              ),
            ),
          ),
        ],
      ),
    );
  }

  StatusChip _statusChip(InvoiceStatus s) => switch (s) {
        InvoiceStatus.paid => const StatusChip.paid('PAID'),
        InvoiceStatus.partial => const StatusChip.pending('PARTIAL'),
        InvoiceStatus.overdue => const StatusChip.bad('OVERDUE'),
        InvoiceStatus.unpaid => const StatusChip.neutral('UNPAID'),
      };

  void _actions(BuildContext context, Invoice inv) {
    if (inv.balance <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('${inv.number} is fully paid — receipt already issued.')),
      );
      return;
    }
    showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Record payment — ${inv.number}'),
        content: Text(
            '${inv.customer.name} owes ${fmt.naira(inv.balance)} of ${fmt.naira(inv.total)}.\n'
            'Record a payment now? It will post to Transactions and issue a receipt.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
          FilledButton(
            onPressed: () {
              SampleStore.instance.payInvoice(inv, inv.balance);
              Navigator.pop(context);
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(content: Text('Payment recorded — receipt issued, stock untouched.')),
              );
            },
            child: const Text('Record full payment'),
          ),
        ],
      ),
    );
  }
}
