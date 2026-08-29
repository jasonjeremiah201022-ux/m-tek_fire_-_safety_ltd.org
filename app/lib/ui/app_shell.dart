import 'package:flutter/material.dart';

import '../core/theme.dart';
import '../data/auth_store.dart';
import 'screens/customers_screen.dart';
import 'screens/generator_screen.dart';
import 'screens/insights_screen.dart';
import 'screens/invoices_screen.dart';
import 'screens/mils_screen.dart';
import 'screens/receipts_screen.dart';
import 'screens/sales_screen.dart';
import 'screens/stock_screen.dart';
import 'screens/settings_screen.dart';
import 'screens/summary_screen.dart';
import 'screens/transactions_screen.dart';
import 'watermark_background.dart';

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
const _docs = Destination('Documents', Icons.draw_outlined, Icons.draw, GeneratorScreen());

const _settings = Destination('Settings', Icons.settings_outlined, Icons.settings, SettingsScreen());

/// Admin sees everything; Sales never sees revenue/profit/settings (SPEC §6).
List<Destination> destinationsFor(String? role) {
  if (role == 'admin') {
    return const [
      _insights, _transactions, _customers, _receipts, _invoices,
      _mils, _sales, _stock, _summary, _docs, _settings,
    ];
  }
  return const [
    _sales, _stock, _customers, _receipts, _invoices, _docs,
  ];
}

/// Kept for backwards compatibility (admin view).
const destinations = <Destination>[
  _insights, _transactions, _customers, _receipts, _invoices,
  _mils, _sales, _stock, _summary, _docs, _settings,
];

/// Primary destinations for the phone bottom bar; everything else lives
/// behind "More" (opens the drawer).
const _bottomBarIndexes = [0, 6, 7, 5]; // Insights, Sales, Stock, MILS

/// Responsive shell — four tiers:
///   ≥1280px : NavigationRail with extended labels (desktop)
///   ≥1000px : compact NavigationRail (small desktop / tablet landscape)
///    ≥640px : drawer + AppBar menu (tablet portrait / large phones)
///    <640px : bottom NavigationBar (5 slots incl. "More") + drawer
class AppShell extends StatefulWidget {
  const AppShell({super.key});

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  int _index = 0;
  final _scaffoldKey = GlobalKey<ScaffoldState>();

  List<Destination> get _visible => destinationsFor(AuthStore.instance.current?.role);

  @override
  Widget build(BuildContext context) {
    final w = MediaQuery.of(context).size.width;
    final extended = w >= 1280;
    final useRail = w >= 1000;
    final useBottomBar = w < 640;
    final visible = _visible;
    if (_index >= visible.length) _index = 0;
    final dest = visible[_index];

    final appBar = AppBar(
      title: Row(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: Image.asset('assets/logo.png', height: 34,
                errorBuilder: (_, __, ___) => const SizedBox.shrink()),
          ),
          const SizedBox(width: 10),
          Flexible(child: Text(dest.label, style: const TextStyle(fontWeight: FontWeight.w700), overflow: TextOverflow.ellipsis)),
        ],
      ),
      actions: [
        IconButton(icon: const Icon(Icons.notifications_outlined), onPressed: () {}),
        const Padding(
          padding: EdgeInsets.only(right: 8),
          child: Center(child: Text('Admin', style: TextStyle(fontSize: 13))),
        ),
        Padding(
          padding: const EdgeInsets.only(right: 8),
          child: Center(
            child: Text(AuthStore.instance.current?.role.toUpperCase() ?? '',
                style: const TextStyle(fontSize: 11, letterSpacing: 1)),
          ),
        ),
        IconButton(
          tooltip: 'Sign out',
          icon: const Icon(Icons.logout),
          onPressed: () => AuthStore.instance.signOut(),
        ),
      ],
      leading: useRail
          ? null
          : IconButton(
              icon: const Icon(Icons.menu),
              onPressed: () => _scaffoldKey.currentState?.openDrawer(),
            ),
    );

    Widget body;
    if (useRail) {
      body = Row(children: [
        _rail(extended: extended),
        Expanded(
          child: Stack(children: [
            const Positioned.fill(child: WatermarkBackground()),
            dest.screen,
          ]),
        ),
      ]);
    } else {
      body = Stack(children: [
        const Positioned.fill(child: WatermarkBackground()),
        dest.screen,
      ]);
    }

    return Scaffold(
      key: _scaffoldKey,
      appBar: appBar,
      drawer: useRail ? null : _drawer(context),
      body: body,
      bottomNavigationBar: useBottomBar ? _bottomBar() : null,
    );
  }

  Widget _rail({required bool extended}) {
    return NavigationRail(
      selectedIndex: _index,
      onDestinationSelected: (i) => setState(() => _index = i),
      extended: extended,
      labelType: extended ? null : NavigationRailLabelType.all,
      leading: Padding(
        padding: const EdgeInsets.symmetric(vertical: 12),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(10),
          child: Image.asset('assets/logo.png', width: 40, height: 40,
              errorBuilder: (_, __, ___) => const SizedBox.shrink()),
        ),
      ),
      destinations: [
        for (final d in _visible)
          NavigationRailDestination(
            icon: Icon(d.icon),
            selectedIcon: Icon(d.selectedIcon),
            label: Text(d.label),
          ),
      ],
    );
  }

  Widget _bottomBar() {
    final moreSelected = !_bottomBarIndexes.contains(_index);
    final visibleBottom = AuthStore.instance.current?.role == 'admin'
        ? _bottomBarIndexes.where((i) => i < _visible.length).toList()
        : [for (var i = 0; i < _visible.length && i < 4; i++) i];
    return NavigationBar(
      height: 64,
      selectedIndex: visibleBottom.indexOf(_index) == -1
          ? visibleBottom.length
          : visibleBottom.indexOf(_index),
      onDestinationSelected: (i) {
        if (i < visibleBottom.length) {
          setState(() => _index = visibleBottom[i]);
        } else {
          _scaffoldKey.currentState?.openDrawer();
        }
      },
      destinations: [
        for (final idx in visibleBottom)
          NavigationDestination(
            icon: Icon(_visible[idx].icon),
            selectedIcon: Icon(_visible[idx].selectedIcon),
            label: _visible[idx].label,
          ),
        const NavigationDestination(
          icon: Icon(Icons.menu),
          selectedIcon: Icon(Icons.menu),
          label: 'More',
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
          child: Text('M-Tek Fire & Safety',
              style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16, color: Colors.white)),
        ),
        for (final d in _visible)
          NavigationDrawerDestination(icon: Icon(d.icon), label: Text(d.label)),
      ],
    );
  }
}
