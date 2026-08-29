import 'package:flutter/material.dart';

import 'core/theme.dart';
import 'data/auth_store.dart';
import 'ui/app_shell.dart';
import 'ui/screens/login_screen.dart';

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
      home: AnimatedBuilder(
        animation: AuthStore.instance,
        builder: (context, _) => AuthStore.instance.isSignedIn
            ? const AppShell()
            : const LoginScreen(),
      ),
    );
  }
}
