import 'rest_client_io.dart' if (dart.library.html) 'rest_client_web.dart' as impl;

/// Minimal REST client used by the sync layer to reach Supabase
/// (PostgREST). Implementation is conditional: HttpClient (io) or
/// fetch (web). Returns true on 2xx.
class RestClient {
  final String baseUrl;
  final String apiKey;
  RestClient({required this.baseUrl, required this.apiKey});

  Map<String, String> get _headers => {
        'apikey': apiKey,
        'Authorization': 'Bearer $apiKey',
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates',
      };

  Future<bool> upsertRows(String table, List<Map<String, dynamic>> rows) {
    return impl.httpRequest(
      method: 'POST',
      url: '$baseUrl/rest/v1/$table',
      headers: _headers,
      body: rows,
    );
  }
}
