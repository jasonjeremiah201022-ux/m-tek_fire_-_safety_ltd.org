/// Build-time configuration (SPEC §5). Provided via --dart-define at
/// compile time; EMPTY defaults keep the app fully functional offline —
/// the Supabase sync layer simply stays dormant until configured.
///
///   flutter build apk --dart-define=SUPABASE_URL=… --dart-define=SUPABASE_ANON_KEY=…
abstract final class Env {
  static const supabaseUrl = String.fromEnvironment('SUPABASE_URL', defaultValue: '');
  static const supabaseAnonKey = String.fromEnvironment('SUPABASE_ANON_KEY', defaultValue: '');

  static const milsApiBase = String.fromEnvironment('MILS_API_BASE', defaultValue: '');

  static bool get backendConfigured => supabaseUrl.isNotEmpty && supabaseAnonKey.isNotEmpty;
}
