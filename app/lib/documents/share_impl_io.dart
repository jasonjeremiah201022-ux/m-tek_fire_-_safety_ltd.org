import 'dart:io';
import 'dart:typed_data';

import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import 'share_service.dart';

/// IO implementation: cache the PDF with a timestamped name, then open the
/// system share sheet (WhatsApp/email targets). On failure, keep the file
/// and report savedOnly so the UI can toast its location.
Future<ShareOutcome> dispatchPdfImpl({
  required Uint8List bytes,
  required String filename,
  required String message,
}) async {
  try {
    final dir = await getTemporaryDirectory();
    final file = File('${dir.path}/$filename');
    await file.writeAsBytes(bytes, flush: true);
    try {
      final xfile = XFile(file.path, mimeType: 'application/pdf');
      await Share.shareXFiles([xfile], text: message, subject: filename);
      return const ShareOutcome(ShareResult.shared, 'Shared — delivered via your selected app.');
    } catch (shareErr) {
      // Fallback (blueprint Part 3): keep the file, tell the user where.
      return ShareOutcome(ShareResult.savedOnly,
          'Share sheet unavailable — PDF saved to app cache: ${file.path}');
    }
  } catch (e) {
    return ShareOutcome(ShareResult.failed, 'Could not write PDF: $e');
  }
}
