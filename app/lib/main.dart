import 'package:flutter/material.dart';

import 'core/theme.dart';
import 'ui/app_shell.dart';

void main() {
  runApp(const MtekApp());
}

class MtekApp extends StatelessWidget {
  const MtekApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'M-Tek Inventory',
      debugShowCheckedModeBanner: false,
      theme: MtekTheme.light(),
      home: const AppShell(),
    );
  }
}
