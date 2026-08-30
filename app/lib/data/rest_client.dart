import 'rest_client_io.dart' if (dart.library.html) 'rest_client_web.dart' as impl;

export 'rest_client_io.dart' if (dart.library.html) 'rest_client_web.dart'
    show RestJsonResponse;

/// Real Supabase REST client — PostgREST reads, RPC calls, upserts and GoTrue
/// password sign-in. When [accessToken] is set (after sign-in) requests run
/// AS THAT USER so Row-Level Security enforces the CEO/Admin/Sales rules
/// server-side. Without a token the anon key is used (read-only per RLS).
class RestClient {
  final String baseUrl;
  final String apiKey;
  String? accessToken; // set by AuthStore.remoteSignIn
  RestClient({required this.baseUrl, required this.apiKey});

  Map<String, String> _headers({bool merge = true}) => {
        'apikey': apiKey,
        'Authorization': 'Bearer ${accessToken ?? apiKey}',
        'Content-Type': 'application/json',
        if (merge) 'Prefer': 'resolution=merge-duplicates',
      };

  /// POST /auth/v1/token?grant_type=password → {access_token, user}
  Future<impl.RestJsonResponse?> authSignInRaw(String email, String password) {
    return impl.httpJson(
      method: 'POST',
      url: '$baseUrl/auth/v1/token?grant_type=password',
      headers: {'apikey': apiKey, 'Content-Type': 'application/json'},
      body: {'email': email, 'password': password},
    );
  }

  /// GET /rest/v1/<table>[?<query>]  → list of rows (null when offline)
  Future<List<dynamic>?> getRows(String table, {String? query}) async {
    final res = await impl.httpJson(
      method: 'GET',
      url: '$baseUrl/rest/v1/$table${query == null ? '' : '?$query'}',
      headers: _headers(merge: false),
    );
    if (res == null || !res.ok) return null;
    final j = res.json;
    return j is List ? j : null;
  }

  /// POST /rest/v1/rpc/<fn> → decoded JSON result (null when offline/failed)
  Future<dynamic> postRpc(String fn, Map<String, dynamic> params) async {
    final res = await impl.httpJson(
      method: 'POST',
      url: '$baseUrl/rest/v1/rpc/$fn',
      headers: _headers(merge: false),
      body: params,
    );
    if (res == null || !res.ok) return null;
    return res.json;
  }

  Future<bool> upsertRows(String table, List<Map<String, dynamic>> rows) {
    return impl.httpRequest(
      method: 'POST',
      url: '$baseUrl/rest/v1/$table',
      headers: _headers(),
      body: rows,
    );
  }
}
