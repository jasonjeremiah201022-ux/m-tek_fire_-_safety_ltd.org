import 'package:flutter/material.dart';

import '../core/theme.dart';
import 'screens/customers_screen.dart';
import 'screens/insights_screen.dart';
import 'screens/invoices_screen.dart';
import 'screens/mils_screen.dart';
import 'screens/receipts_screen.dart';
import 'screens/sales_screen.dart';
import 'screens/stock_screen.dart';
import 'screens/summary_screen.dart';
import 'screens/transactions_screen.dart';

class Destination {
  final String label;
  final IconData icon;
  final IconData selectedIcon;
  final Widget screen;
  const Destination(this.label, this.icon, this.selectedIcon, this.screen);
}

const _insights = Destination('Insights', Icons.insights_outlined, Icons.insights, InsightsScreen());
const _transactions = Destination('Transactions', Icons.swap_horiz_outlined, Icons.swap_horiz, TransactionsScreen());
const _customers = Destination('Customers', Icons.people_outline, Icons.people, CustomersScreen());
const _receipts = Destination('Receipts', Icons.receipt_long_outlined, Icons.receipt_long, ReceiptsScreen());
const _invoices = Destination('Invoices', Icons.request_quote_outlined, Icons.request_quote, InvoicesScreen());
const _mils = Destination('MILS', Icons.build_circle_outlined, Icons.build_circle, MilsScreen());
const _sales = Destination('Sales', Icons.point_of_sale_outlined, Icons.point_of_sale, SalesScreen());
const _stock = Destination('Stock', Icons.inventory_2_outlined, Icons.inventory_2, StockScreen());
const _summary = Destination('Summary', Icons.summarize_outlined, Icons.summarize, SummaryScreen());

const destinations = <Destination>[
  _insights, _transactions, _customers, _receipts, _invoices,
  _mils, _sales, _stock, _summary,
];

/// Responsive shell: NavigationRail on wide screens (desktop/tablet),
/// drawer + AppBar menu on narrow screens (phones).
class AppShell extends StatefulWidget {
  const AppShell({super.key});

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  int _index = 0;
  final _scaffoldKey = GlobalKey<ScaffoldState>();

  @override
  Widget build(BuildContext context) {
    final wide = MediaQuery.of(context).size.width >= 1000;
    final dest = destinations[_index];

    final appBar = AppBar(
      title: Row(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: Image.asset('assets/logo.png', height: 34, errorBuilder: (_, __, ___) => const SizedBox.shrink()),
          ),
          const SizedBox(width: 10),
          Text(dest.label, style: const TextStyle(fontWeight: FontWeight.w700)),
        ],
      ),
      actions: [
        IconButton(icon: const Icon(Icons.notifications_outlined), onPressed: () {}),
        const Padding(
          padding: EdgeInsets.only(right: 16),
          child: Center(child: Text('Admin', style: TextStyle(fontSize: 13))),
        ),
      ],
      leading: wide
          ? null
          : IconButton(
              icon: const Icon(Icons.menu),
              onPressed: () => _scaffoldKey.currentState?.openDrawer(),
            ),
    );

    final body = wide
        ? Row(
            children: [
              _rail(),
              Expanded(child: dest.screen),
            ],
          )
        : dest.screen;

    return Scaffold(
      key: _scaffoldKey,
      appBar: appBar,
      drawer: wide ? null : _drawer(context),
      body: body,
    );
  }

  Widget _rail() {
    return NavigationRail(
      selectedIndex: _index,
      onDestinationSelected: (i) => setState(() => _index = i),
      labelType: NavigationRailLabelType.all,
      leading: Padding(
        padding: const EdgeInsets.symmetric(vertical: 12),
        child: Column(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(10),
              child: Image.asset('assets/logo.png', width: 40, height: 40, errorBuilder: (_, __, ___) => const SizedBox.shrink()),
            ),
          ],
        ),
      ),
      destinations: [
        for (final d in destinations)
          NavigationRailDestination(
            icon: Icon(d.icon),
            selectedIcon: Icon(d.selectedIcon),
            label: Text(d.label),
          ),
      ],
    );
  }

  Widget _drawer(BuildContext context) {
    return NavigationDrawer(
      selectedIndex: _index,
      onDestinationSelected: (i) {
        setState(() => _index = i);
        Navigator.pop(context);
      },
      children: [
        const Padding(
          padding: EdgeInsets.fromLTRB(28, 24, 16, 12),
          child: Text('M-Tek Fire & Safety', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16, color: Colors.white)),
        ),
        for (final d in destinations)
          NavigationDrawerDestination(icon: Icon(d.icon), label: Text(d.label)),
      ],
    );
  }
}
