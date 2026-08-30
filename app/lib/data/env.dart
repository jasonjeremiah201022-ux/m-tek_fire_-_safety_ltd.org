/// Build-time configuration. Provided via --dart-define at compile time.
/// Empty defaults keep the app fully functional offline (local store only).
///
///   flutter build apk --dart-define=SUPABASE_URL=… --dart-define=SUPABASE_ANON_KEY=… \
///       --dart-define=MILS_API_BASE=https://mtek-api.example.com
///
/// Architecture (owner directive 2026-08-30): Supabase = AUTH ONLY,
/// MongoDB (via the M-TEK data API) = all storage.
abstract final class Env {
  static const supabaseUrl = String.fromEnvironment('SUPABASE_URL', defaultValue: '');
  static const supabaseAnonKey = String.fromEnvironment('SUPABASE_ANON_KEY', defaultValue: '');

  /// Base URL of the M-TEK data API (Node service over MongoDB sections).
  static const apiBase = String.fromEnvironment('MILS_API_BASE', defaultValue: '');

  static bool get backendConfigured => supabaseUrl.isNotEmpty && supabaseAnonKey.isNotEmpty;
  static bool get apiConfigured => apiBase.isNotEmpty;
}
