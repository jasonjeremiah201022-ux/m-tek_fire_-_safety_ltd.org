import 'dart:convert';

import 'package:flutter/foundation.dart';

/// Staff accounts with TWO separate secrets:
///  • account password  → signs in
///  • signature passcode → authorises/signs documents (SPEC §6.1)
///
/// M1 demo hashing (fnv1a) — replaced in M3 by Supabase Auth + salted
/// hashes (staff.signature_passcode_hash) + signature images in Storage.
class StaffUser {
  final String name;
  final String email;
  final String role; // 'ceo' | 'admin' | 'sales'
  final String passwordHash;
  final String signaturePasscodeHash;
  final String? signaturePng; // base64 data-URL of the drawn signature
  StaffUser({
    required this.name,
    required this.email,
    required this.role,
    required this.passwordHash,
    required this.signaturePasscodeHash,
    this.signaturePng,
  });

  Map<String, dynamic> toJson() => {
        'name': name, 'email': email, 'role': role,
        'passwordHash': passwordHash,
        'signaturePasscodeHash': signaturePasscodeHash,
        'signaturePng': signaturePng,
      };
  static StaffUser fromJson(Map<String, dynamic> j) => StaffUser(
        name: j['name'], email: j['email'], role: j['role'],
        passwordHash: j['passwordHash'],
        signaturePasscodeHash: j['signaturePasscodeHash'],
        signaturePng: j['signaturePng'],
      );
}

String demoHash(String input) {
  // FNV-1a 32-bit — DEMO ONLY (client-side, unsalted). M3 moves all
  // credential verification server-side with salted hashes.
  var h = 0x811c9dc5;
  for (final code in utf8.encode('mtek::$input')) {
    h ^= code;
    h = (h * 0x01000193) & 0xFFFFFFFF;
  }
  return h.toRadixString(16).padLeft(8, '0');
}

class AuthStore extends ChangeNotifier {
  AuthStore._() {
    users.add(StaffUser(
      name: 'Admin',
      email: 'admin@mtek.demo',
      role: 'admin',
      passwordHash: demoHash('admin123'),
      signaturePasscodeHash: demoHash('1234'),
    ));
    // CEO is HARDCODED (owner directive 2026-08-30): locked to this email,
    // never appears in registration — signing in shows CEO at the top.
    users.add(StaffUser(
      name: 'CEO',
      email: AuthStore.ceoEmail,
      role: 'ceo',
      passwordHash: demoHash('ceo1234'),
      signaturePasscodeHash: demoHash('1234'),
    ));
  }

  /// The CEO identity is fixed to this email across the whole system
  /// (Flutter app, preview server, Supabase backend in Phase C).
  static const String ceoEmail = 'mtekfiresafetyltd@gmail.com';
  static final AuthStore instance = AuthStore._();

  final List<StaffUser> users = [];
  StaffUser? current;

  bool get isSignedIn => current != null;
  bool get isAdmin => current?.role == 'admin';

  /// CEO outranks admin — full management reach everywhere.
  bool get isCeo => current?.role == 'ceo';

  /// Management-level authority (CEO or Admin): settings, seeds, approvals.
  bool get isManagement => isAdmin || isCeo;

  String? signIn(String email, String password) {
    final mail = email.trim().toLowerCase();
    final user = users.where((u) => u.email == mail).firstOrNull;
    if (user == null) return 'No account with that email';
    if (user.passwordHash != demoHash(password)) return 'Wrong password';
    if (mail == ceoEmail && user.role != 'ceo') user.role = 'ceo'; // locked
    current = user;
    notifyListeners();
    return null;
  }

  /// Creates the account. Enforces password ≠ signature passcode.
  String? signUp({
    required String name,
    required String email,
    required String password,
    required String signaturePasscode,
    required String role,
    String? signaturePng,
  }) {
    final mail = email.trim().toLowerCase();
    if (name.trim().isEmpty) return 'Enter your full name';
    if (!mail.contains('@')) return 'Enter a valid email';
    if (password.length < 6) return 'Password must be at least 6 characters';
    if (signaturePasscode.length < 4) {
      return 'Signature passcode must be at least 4 characters';
    }
    if (signaturePasscode == password) {
      return 'Signature passcode must be different from your password';
    }
    if (mail == ceoEmail) return 'The CEO account is pre-provisioned — sign in directly';
    if (users.any((u) => u.email == mail)) return 'An account with that email already exists';
    users.add(StaffUser(
      name: name.trim(),
      email: mail,
      role: role == 'ceo' ? 'admin' : role,
      passwordHash: demoHash(password),
      signaturePasscodeHash: demoHash(signaturePasscode),
      signaturePng: signaturePng,
    ));
    current = users.last;
    notifyListeners();
    return null;
  }

  /// Verifies the Signature Passcode when issuing a document.
  bool verifySignature(String passcode) {
    final user = current;
    if (user == null) return false;
    return user.signaturePasscodeHash == demoHash(passcode);
  }

  void signOut() {
    current = null;
    notifyListeners();
  }

  /// Public notification for external listeners (boot/data-load events).
  void ping() => notifyListeners();
}

extension _FirstOrNull<T> on Iterable<T> {
  T? get firstOrNull => isEmpty ? null : first;
}
