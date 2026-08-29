// Web HTTP implementation (fetch).
// ignore_for_file: avoid_web_libraries_in_flutter
import 'dart:convert';
import 'dart:html' as html;

Future<bool> httpRequest({
  required String method,
  required String url,
  required Map<String, String> headers,
  required List<Map<String, dynamic>> body,
}) async {
  try {
    final res = await html.HttpRequest.request(url,
        method: method,
        requestHeaders: headers,
        sendData: jsonEncode(body));
    return res.status >= 200 && res.status < 300;
  } catch (_) {
    return false; // offline — queue keeps the records
  }
}
