import 'dart:convert';
import 'dart:io';

/// IO HTTP implementation (Android/Windows/desktop).
Future<bool> httpRequest({
  required String method,
  required String url,
  required Map<String, String> headers,
  required List<Map<String, dynamic>> body,
}) async {
  try {
    final client = HttpClient();
    client.connectionTimeout = const Duration(seconds: 12);
    final req = await client.openUrl(method, Uri.parse(url));
    headers.forEach(req.headers.set);
    req.add(utf8.encode(jsonEncode(body)));
    final res = await req.close();
    await res.drain<void>();
    client.close();
    return res.statusCode >= 200 && res.statusCode < 300;
  } catch (_) {
    return false; // offline — queue keeps the records
  }
}
