import 'dart:typed_data';

/// Export & dispatch pipeline (blueprint Part 1/3):
///   PDF bytes → timestamped local cache file → native share sheet
///   (WhatsApp / email) → fallback: save to device storage + toast.
///
/// Platform split via conditional imports:
///   io: path_provider + share_plus (Android/Windows/iOS/desktop)
///   web: browser download (fallback) — share_plus is limited on web.
export 'share_impl_io.dart' if (dart.library.html) 'share_impl_web.dart';

enum ShareResult { shared, savedOnly, failed }

class ShareOutcome {
  final ShareResult result;
  final String message; // user-facing toast text
  const ShareOutcome(this.result, this.message);
}

/// Pre-formatted share message bodies (blueprint Part 3).
String shareMessage({
  required String docLabel,
  required int? serial,
  required String customerName,
}) {
  return 'Good day $customerName, please find attached your official '
      '$docLabel${serial != null ? ' (No: $serial)' : ''} from M-Tek Fire & Safety Ltd. '
      'Thank you for your business. — mtekfiresafetyltd@gmail.com · 08033489452';
}

/// Calls the platform implementation selected by the conditional export above.
Future<ShareOutcome> dispatchPdf({
  required Uint8List bytes,
  required String filename,
  required String message,
}) =>
    dispatchPdfImpl(bytes: bytes, filename: filename, message: message);
