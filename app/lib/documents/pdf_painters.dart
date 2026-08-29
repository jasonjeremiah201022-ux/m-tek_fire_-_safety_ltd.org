import 'dart:typed_data';

import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;

import 'branding.dart';
import 'doc_models.dart';
import 'forms_spec.dart';
import 'pdf_shared.dart';

/// DYNAMIC PDF PAINTER (blueprint Part 1): conditional layout builders
/// that swap grids, fields and banners per document type, mapping 1:1 to
/// the physical corporate forms (docs/forms/FORM_LAYOUTS.md).
///
/// Every document gets: corporate dual-office header, faint watermark,
/// signature stamp of the signer, QR verification hash, exact disclaimers.

enum GeneratedDoc { receipt, invoice, mils }

Future<Uint8List> buildDocument(
  GeneratedDoc type, {
  required Uint8List logoBytes,
  required ReceiptDocState? receipt,
  required InvoiceDocState? invoice,
  required MilsDocState? mils,
  required String signedBy,
  Uint8List? signaturePngBytes,
}) async {
  await MtekPdfFonts.load();
  final logo = pw.MemoryImage(logoBytes);
  final signature = signaturePngBytes == null ? null : pw.MemoryImage(signaturePngBytes);

  final doc = pw.Document();
  switch (type) {
    case GeneratedDoc.receipt:
      doc.addPage(_receiptPage(logo, signature, receipt!, signedBy));
    case GeneratedDoc.invoice:
      doc.addPage(_invoicePage(logo, signature, invoice!, signedBy));
    case GeneratedDoc.mils:
      doc.addPage(_milsPage(logo, signature, mils!, signedBy));
  }
  return doc.save();
}

pw.PageTheme _theme(pw.ImageProvider logo, PdfPageFormat format) {
  return pw.PageTheme(
    pageFormat: format,
    margin: const pw.EdgeInsets.fromLTRB(22, 18, 22, 16),
    theme: pw.ThemeData.withFont(base: MtekPdfFonts.base, bold: MtekPdfFonts.bold),
    buildBackground: (context) => documentWatermark(logo),
  );
}

// =====================================================================
// 1. PAYMENT RECEIPT (landscape — mirrors No: 2131 book)
// =====================================================================
pw.MultiPage _receiptPage(
    pw.ImageProvider logo, pw.ImageProvider? signature, ReceiptDocState r, String signedBy) {
  final methodChecked = (String m) => r.method.toLowerCase() == m.toLowerCase();
  final hashPayload =
      '${r.serial}|${r.amount}|${r.date.toIso8601String()}|${r.name}';

  return pw.MultiPage(
    pageTheme: _theme(logo, PdfPageFormat.a4.landscape),
    maxPages: 2,
    build: (context) => [
      corporateHeader(logo),
      pw.SizedBox(height: 10),

      // Identity row: customer | IRN + title | No + Date
      pw.Row(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
        pw.Expanded(
          flex: 3,
          child: pw.Container(
            padding: const pw.EdgeInsets.all(8),
            decoration: pw.BoxDecoration(border: pw.Border.all(color: PdfColors.black)),
            child: pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
              ruledField('Name:', value: r.name),
              ruledField('Address:', value: r.address),
              ruledField('', value: ''),
              ruledField('Phone No.', value: r.phone),
            ]),
          ),
        ),
        pw.SizedBox(width: 12),
        pw.Expanded(
          flex: 2,
          child: pw.Column(children: [
            pw.Container(
              width: double.infinity,
              padding: const pw.EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: pw.Border.all(color: PdfColors.red900, width: 1.4),
              child: pw.Text('IRN: ${r.irn}',
                  style: pw.TextStyle(fontSize: 11, fontWeight: pw.FontWeight.bold, color: PdfColors.red900)),
            ),
            pw.SizedBox(height: 6),
            pw.Container(
              width: double.infinity,
              padding: const pw.EdgeInsets.symmetric(vertical: 5),
              color: PdfColors.red900,
              alignment: pw.Alignment.center,
              child: pw.Text('PAYMENT RECEIPT',
                  style: pw.TextStyle(fontSize: 13, fontWeight: pw.FontWeight.bold, color: PdfColors.white)),
            ),
          ]),
        ),
        pw.SizedBox(width: 12),
        pw.Expanded(
          flex: 2,
          child: pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
            pw.Text('No: ${r.serial}',
                style: pw.TextStyle(fontSize: 15, fontWeight: pw.FontWeight.bold)),
            pw.SizedBox(height: 8),
            ruledField('Date:', value: _d(r.date)),
          ]),
        ),
      ]),
      pw.SizedBox(height: 10),

      // The Sum of | Being Payment for
      pw.Row(crossAxisAlignment: pw.CrossAxisAlignment.stretch, children: [
        pw.Expanded(
          child: pw.Container(
            padding: const pw.EdgeInsets.all(8),
            decoration: pw.BoxDecoration(border: pw.Border.all(color: PdfColors.black)),
            child: pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
              ruledField('The Sum of', value: r.amountInWords, fontSize: 9),
              ruledField(''),
              ruledField(''),
            ]),
          ),
        ),
        pw.SizedBox(width: 12),
        pw.Expanded(
          child: pw.Container(
            padding: const pw.EdgeInsets.all(8),
            decoration: pw.BoxDecoration(border: pw.Border.all(color: PdfColors.black)),
            child: pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
              ruledField('Being Payment for', value: r.beingPaymentFor),
              ruledField(''),
            ]),
          ),
        ),
      ]),
      pw.SizedBox(height: 10),

      // 2×2 payment-method grid (exact paper layout)
      pw.Row(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
        pw.Expanded(
          child: pw.Column(children: [
            _methodBox('Cash', methodChecked('Cash'), '₦${_money(r.amount)}'),
            pw.SizedBox(height: 8),
            _methodBox('Transfer', methodChecked('Transfer')),
          ]),
        ),
        pw.SizedBox(width: 12),
        pw.Expanded(
          child: pw.Column(children: [
            _methodBox('Cheque', methodChecked('Cheque')),
            pw.SizedBox(height: 8),
            _methodBox('POS', methodChecked('POS')),
          ]),
        ),
      ]),
      pw.SizedBox(height: 12),

      // Sign-off boxes
      pw.Row(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
        pw.Expanded(
          child: pw.Container(
            padding: const pw.EdgeInsets.all(8),
            height: 52,
            decoration: pw.BoxDecoration(border: pw.Border.all(color: PdfColors.black)),
            child: pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
              pw.Text('For: M-TEK FIRE & SAFETY LTD',
                  style: pw.TextStyle(fontSize: 8, fontWeight: pw.FontWeight.bold)),
              pw.Spacer(),
              pw.Text(signedBy, style: const pw.TextStyle(fontSize: 8, fontStyle: pw.FontStyle.italic)),
            ]),
          ),
        ),
        pw.SizedBox(width: 12),
        pw.Expanded(
          child: pw.Container(
            padding: const pw.EdgeInsets.all(8),
            height: 52,
            decoration: pw.BoxDecoration(border: pw.Border.all(color: PdfColors.black)),
            child: pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
              pw.Text("For: CUSTOMER'S/CLIENT",
                  style: pw.TextStyle(fontSize: 8, fontWeight: pw.FontWeight.bold)),
              pw.Spacer(),
              if (signature != null) pw.Image(signature, width: 70, height: 24, fit: pw.BoxFit.contain),
            ]),
          ),
        ),
      ]),
      pw.SizedBox(height: 8),

      // Disclaimers (exact wording from the book)
      pw.Container(
        width: double.infinity,
        padding: const pw.EdgeInsets.all(6),
        color: PdfColors.amber50,
        child: pw.Text(MtekBranding.receiptDisclaimer,
            style: const pw.TextStyle(fontSize: 6.5), textAlign: pw.TextAlign.left),
      ),
      pw.SizedBox(height: 6),
      pw.Row(mainAxisAlignment: pw.MainAxisAlignment.spaceBetween, children: [
        pw.Text('Digitally signed by $signedBy — ${_dt(r.date)}',
            style: pw.TextStyle(fontSize: 7, fontWeight: pw.FontWeight.bold, color: PdfColors.green900)),
        verificationFooter('receipt', r.serial ?? 0, hashPayload),
      ]),
    ],
  );
}

pw.Widget _methodBox(String label, bool checked, [String value = '']) {
  return pw.Container(
    padding: const pw.EdgeInsets.symmetric(horizontal: 8, vertical: 6),
    decoration: pw.BoxDecoration(border: pw.Border.all(color: PdfColors.black)),
    child: pw.Row(children: [
      pw.Container(
        width: 10,
        height: 10,
        decoration: pw.BoxDecoration(border: pw.Border.all(color: PdfColors.black, width: 1)),
        alignment: pw.Alignment.center,
        child: checked ? pw.Text('✓', style: pw.TextStyle(fontSize: 9, fontWeight: pw.FontWeight.bold)) : null,
      ),
      pw.SizedBox(width: 6),
      pw.Container(width: 52, child: pw.Text(label, style: pw.TextStyle(fontSize: 9.5, fontWeight: pw.FontWeight.bold))),
      pw.Expanded(
        child: pw.Container(
          padding: const pw.EdgeInsets.only(left: 4),
          decoration: const pw.BoxDecoration(border: pw.Border(bottom: pw.BorderSide(color: PdfColors.grey600, width: .7))),
          child: pw.Text(value, style: pw.TextStyle(fontSize: 9.5, fontWeight: checked ? pw.FontWeight.bold : pw.FontWeight.normal)),
        ),
      ),
    ]),
  );
}

// =====================================================================
// 2. SALES INVOICE (portrait — mirrors No: 4335 book)
// =====================================================================
pw.MultiPage _invoicePage(
    pw.ImageProvider logo, pw.ImageProvider? signature, InvoiceDocState v, String signedBy) {
  final hashPayload = '${v.serial}|${v.grandTotal}|${v.date.toIso8601String()}|${v.name}';

  final rows = <List<String>>[
    for (var i = 0; i < v.rows.length; i++)
      if (v.rows[i].description.trim().isNotEmpty)
        [
          '${i + 1}',
          v.rows[i].description,
          _qty(v.rows[i].qty),
          _money(v.rows[i].rate),
          _nairaPart(v.rows[i].amount),
          _koboPart(v.rows[i].amount),
        ],
  ];
  while (rows.length < 14) {
    rows.add(['', '', '', '', '', '']); // blank ruled rows like the book
  }

  return pw.MultiPage(
    pageTheme: _theme(logo, PdfPageFormat.a4),
    maxPages: 10,
    build: (context) => [
      corporateHeader(logo),
      pw.SizedBox(height: 8),

      // Document-type checkbox cluster
      pw.Row(children: [
        checkboxCell('MILS No:', v.showMilsNo),
        pw.SizedBox(width: 8),
        checkboxCell('RECEIPT NO:', v.showReceiptNo),
        pw.SizedBox(width: 8),
        checkboxCell('WAY BILL', v.variant == 'WAY BILL'),
        pw.SizedBox(width: 8),
        checkboxCell('PRO-FORMER', v.variant == 'PRO-FORMER'),
        pw.SizedBox(width: 8),
        checkboxCell('SERVICE INVOICE', v.variant == 'SERVICE INVOICE'),
        pw.SizedBox(width: 8),
        checkboxCell('SALES INVOICE', v.variant == 'SALES INVOICE'),
      ]),
      pw.SizedBox(height: 6),

      // Cross-reference fields + No/Date
      pw.Row(crossAxisAlignment: pw.CrossAxisAlignment.end, children: [
        pw.Expanded(child: ruledField('MILS No:', value: v.milsNo)),
        pw.Expanded(child: ruledField('RECEIPT No:', value: v.receiptNo)),
        pw.Expanded(child: ruledField('L.P.O. No:', value: v.lpoNo)),
        pw.SizedBox(width: 14),
        pw.Text('No: ${v.serial}', style: pw.TextStyle(fontSize: 14, fontWeight: pw.FontWeight.bold)),
      ]),
      pw.Row(children: [
        pw.Expanded(flex: 3, child: ruledField('Name:', value: v.name)),
        pw.Expanded(flex: 2, child: ruledField('Address:', value: v.address)),
        pw.Expanded(flex: 2, child: ruledField('Phone No:', value: v.phone)),
        pw.Expanded(child: ruledField('Date:', value: _d(v.date))),
      ]),
      pw.SizedBox(height: 4),

      // Itemised ledger (dual naira/kobo amount columns)
      pw.TableHelper.fromTextArray(
        context,
        headers: ['S/NO', 'DESCRIPTION', 'QTY', 'RATE (₦)', 'AMOUNT (₦)', 'K'],
        data: rows,
        headerStyle: pw.TextStyle(fontSize: 8, fontWeight: pw.FontWeight.bold, color: PdfColors.white),
        headerDecoration: const pw.BoxDecoration(color: PdfColors.blue700),
        cellStyle: const pw.TextStyle(fontSize: 8),
        cellAlignment: pw.Alignment.centerLeft,
        columnWidths: const {
          0: pw.FixedColumnWidth(30),
          1: pw.FlexColumnWidth(5),
          2: pw.FixedColumnWidth(36),
          3: pw.FixedColumnWidth(60),
          4: pw.FixedColumnWidth(66),
          5: pw.FixedColumnWidth(28),
        },
        cellPadding: const pw.EdgeInsets.symmetric(horizontal: 4, vertical: 2.5),
        border: pw.TableBorder.all(color: PdfColors.grey600, width: .5),
      ),
      pw.SizedBox(height: 8),

      // Financial summary
      pw.Row(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
        pw.Spacer(),
        pw.SizedBox(
          width: 240,
          child: pw.Column(children: [
            if (v.vatEnabled) _summaryRow('7.5% VAT', v.vat),
            _summaryRow('TOTAL', v.grandTotal, bold: true),
            pw.SizedBox(height: 4),
          ]),
        ),
      ]),
      pw.SizedBox(height: 6),
      ruledField('Amount in words:', value: '${v.amountInWords} ONLY', fontSize: 8.5),
      pw.SizedBox(height: 4),
      pw.Row(children: [
        pw.Expanded(
          child: pw.Container(
            padding: const pw.EdgeInsets.all(6),
            decoration: pw.BoxDecoration(border: pw.Border.all(color: PdfColors.black)),
            child: pw.Text('Advance Payment: ₦${_money(v.advancePayment)}',
                style: pw.TextStyle(fontSize: 9, fontWeight: pw.FontWeight.bold)),
          ),
        ),
        pw.SizedBox(width: 8),
        pw.Expanded(
          child: pw.Container(
            padding: const pw.EdgeInsets.all(6),
            decoration: pw.BoxDecoration(border: pw.Border.all(color: PdfColors.black)),
            child: pw.Text('Balance Payment: ₦${_money(v.balance)}',
                style: pw.TextStyle(fontSize: 9, fontWeight: pw.FontWeight.bold, color: PdfColors.red900)),
          ),
        ),
      ]),
      pw.SizedBox(height: 12),

      _signOffRow(signature, signedBy, ['Prepared by:', 'Approved by:', 'Customer/Client']),
      pw.SizedBox(height: 8),
      pw.Container(
        width: double.infinity,
        padding: const pw.EdgeInsets.all(6),
        color: PdfColors.amber50,
        child: pw.Text(MtekBranding.invoiceDisclaimer, style: const pw.TextStyle(fontSize: 6.5)),
      ),
      pw.SizedBox(height: 6),
      pw.Row(mainAxisAlignment: pw.MainAxisAlignment.spaceBetween, children: [
        pw.Text('Digitally signed by $signedBy — ${_dt(v.date)}',
            style: pw.TextStyle(fontSize: 7, fontWeight: pw.FontWeight.bold, color: PdfColors.green900)),
        verificationFooter('invoice', v.serial ?? 0, hashPayload),
      ]),
    ],
  );
}

// =====================================================================
// 3. MAINTENANCE INFORMATION LOG SHEET (portrait — mirrors No: 925 book)
// =====================================================================
pw.MultiPage _milsPage(
    pw.ImageProvider logo, pw.ImageProvider? signature, MilsDocState m, String signedBy) {
  final hashPayload = '${m.serial}|${m.grandTotal}|${m.entryDate.toIso8601String()}|${m.name}';

  final weightRows = <List<String>>[
    for (final wc in MtekForms.weightClasses)
      [
        wc.label,
        m.weightQty[wc.kg]?.toStringAsFixed(0) ?? '',
        m.weightRate[wc.kg] != null ? _money(m.weightRate[wc.kg]!) : '',
        (m.weightQty[wc.kg] ?? 0) > 0 ? _money((m.weightQty[wc.kg] ?? 0) * (m.weightRate[wc.kg] ?? 0)) : '',
      ],
  ];

  final componentRows = <List<String>>[
    for (final c in MtekForms.components)
      [
        c,
        m.componentQty[c]?.toStringAsFixed(0) ?? '',
        m.componentRate[c] != null ? _money(m.componentRate[c]!) : '',
        (m.componentQty[c] ?? 0) > 0 ? _money((m.componentQty[c] ?? 0) * (m.componentRate[c] ?? 0)) : '',
      ],
  ];

  return pw.MultiPage(
    pageTheme: _theme(logo, PdfPageFormat.a4),
    maxPages: 5,
    build: (context) => [
      corporateHeader(logo),
      pw.SizedBox(height: 6),

      // Red title banner + MILS No
      pw.Row(children: [
        pw.Expanded(
          child: pw.Container(
            color: PdfColors.red900,
            padding: const pw.EdgeInsets.symmetric(vertical: 5),
            alignment: pw.Alignment.center,
            child: pw.Text('MAINTENANCE INFORMATION LOG SHEET',
                style: pw.TextStyle(fontSize: 12.5, fontWeight: pw.FontWeight.bold, color: PdfColors.white)),
          ),
        ),
        pw.SizedBox(width: 10),
        pw.Container(
          padding: const pw.EdgeInsets.symmetric(horizontal: 10, vertical: 5),
          decoration: pw.Border.all(color: PdfColors.red900, width: 1.2),
          child: pw.Text('MILS No: ${m.serial}',
              style: pw.TextStyle(fontSize: 11, fontWeight: pw.FontWeight.bold, color: PdfColors.red900)),
        ),
      ]),
      pw.SizedBox(height: 6),

      // Top field row
      pw.Row(children: [
        pw.Expanded(child: ruledField('Entry Date:', value: _d(m.entryDate), fontSize: 7.5)),
        pw.Expanded(child: ruledField('Collection Date:', value: _d(m.collectionDate), fontSize: 7.5)),
        pw.Expanded(child: ruledField('Next Service Date:', value: _d(m.nextServiceDate), fontSize: 7.5)),
        pw.Expanded(child: ruledField('Invoice No:', value: m.invoiceNo, fontSize: 7.5)),
        pw.Expanded(child: ruledField('Receipt No:', value: m.receiptNo, fontSize: 7.5)),
        pw.Expanded(child: ruledField('LPO NO.:', value: m.lpoNo, fontSize: 7.5)),
      ]),
      pw.SizedBox(height: 4),

      // SECTION A — DESCRIPTION (weights)
      pw.Text('DESCRIPTION:', style: pw.TextStyle(fontSize: 9.5, fontWeight: pw.FontWeight.bold)),
      pw.SizedBox(height: 3),
      pw.TableHelper.fromTextArray(
        context,
        headers: ['Description', 'Qty', 'Rate (₦)', 'Amount (₦)'],
        data: weightRows,
        headerStyle: pw.TextStyle(fontSize: 7.5, fontWeight: pw.FontWeight.bold, color: PdfColors.white),
        headerDecoration: const pw.BoxDecoration(color: PdfColors.blue700),
        cellStyle: const pw.TextStyle(fontSize: 7.5),
        columnWidths: const {
          0: pw.FlexColumnWidth(4),
          1: pw.FixedColumnWidth(50),
          2: pw.FixedColumnWidth(64),
          3: pw.FixedColumnWidth(70),
        },
        cellPadding: const pw.EdgeInsets.symmetric(horizontal: 4, vertical: 1.8),
        border: pw.TableBorder.all(color: PdfColors.grey600, width: .5),
      ),
      pw.SizedBox(height: 6),

      // SECTION B — REPLACEMENT (components)
      pw.Text('REPLACEMENT:', style: pw.TextStyle(fontSize: 9.5, fontWeight: pw.FontWeight.bold, color: PdfColors.red900)),
      pw.SizedBox(height: 3),
      pw.TableHelper.fromTextArray(
        context,
        headers: ['Component', 'Qty', 'Rate (₦)', 'Amount (₦)'],
        data: componentRows,
        headerStyle: pw.TextStyle(fontSize: 7.5, fontWeight: pw.FontWeight.bold, color: PdfColors.white),
        headerDecoration: const pw.BoxDecoration(color: PdfColors.blue700),
        cellStyle: const pw.TextStyle(fontSize: 7.5),
        columnWidths: const {
          0: pw.FlexColumnWidth(4),
          1: pw.FixedColumnWidth(50),
          2: pw.FixedColumnWidth(64),
          3: pw.FixedColumnWidth(70),
        },
        cellPadding: const pw.EdgeInsets.symmetric(horizontal: 4, vertical: 1.8),
        border: pw.TableBorder.all(color: PdfColors.grey600, width: .5),
      ),
      pw.SizedBox(height: 8),

      // Customer block + summary boxes
      pw.Row(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
        pw.Expanded(
          flex: 3,
          child: pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
            ruledField("Customer's Name:", value: m.name, fontSize: 8.5),
            ruledField('Address:', value: m.address, fontSize: 8.5),
            ruledField('Phone Number:', value: m.phone, fontSize: 8.5),
            ruledField('Bill in words:', value: '${m.amountInWords} ONLY', fontSize: 8.5),
          ]),
        ),
        pw.SizedBox(width: 14),
        pw.SizedBox(
          width: 200,
          child: pw.Column(children: [
            _summaryBox('VAT', m.vat),
            pw.SizedBox(height: 5),
            _summaryBox('Grand Total', m.grandTotal, bold: true),
            pw.SizedBox(height: 5),
            _summaryBox('Advance Payment', m.advancePayment),
            pw.SizedBox(height: 5),
            _summaryBox('Balance Total', m.balance, bold: true),
          ]),
        ),
      ]),
      pw.SizedBox(height: 10),

      _signOffRow(signature, signedBy,
          ['Prepared by:', 'APPROVED by:', "Customer's Assent:", "Collector's Assent:"]),
      pw.SizedBox(height: 8),

      // Caution fine print (owner-confirmed wording)
      pw.Container(
        width: double.infinity,
        padding: const pw.EdgeInsets.all(6),
        color: PdfColors.amber50,
        child: pw.Text(MtekBranding.milsCaution, style: const pw.TextStyle(fontSize: 6.2)),
      ),
      pw.SizedBox(height: 6),
      pw.Row(mainAxisAlignment: pw.MainAxisAlignment.spaceBetween, children: [
        pw.Text('Digitally signed by $signedBy — ${_dt(m.entryDate)}',
            style: pw.TextStyle(fontSize: 7, fontWeight: pw.FontWeight.bold, color: PdfColors.green900)),
        verificationFooter('mils', m.serial ?? 0, hashPayload),
      ]),
    ],
  );
}

// shared bits -----------------------------------------------------------

pw.Widget _summaryRow(String label, double amount, {bool bold = false}) {
  return pw.Container(
    padding: const pw.EdgeInsets.symmetric(horizontal: 8, vertical: 4),
    decoration: pw.BoxDecoration(
      border: pw.Border.all(color: PdfColors.black, width: bold ? 1.1 : .7),
      color: bold ? PdfColors.amber50 : null,
    ),
    child: pw.Row(mainAxisAlignment: pw.MainAxisAlignment.spaceBetween, children: [
      pw.Text(label, style: pw.TextStyle(fontSize: 9.5, fontWeight: pw.FontWeight.bold)),
      pw.Text('₦${_money(amount)}', style: pw.TextStyle(fontSize: 10.5, fontWeight: pw.FontWeight.bold)),
    ]),
  );
}

pw.Widget _summaryBox(String label, double amount, {bool bold = false}) {
  return _summaryRow(label, amount, bold: bold);
}

pw.Widget _signOffRow(pw.ImageProvider? signature, String signedBy, List<String> labels) {
  return pw.Row(
    crossAxisAlignment: pw.CrossAxisAlignment.start,
    children: [
      for (var i = 0; i < labels.length; i++) ...[
        if (i > 0) pw.SizedBox(width: 10),
        pw.Expanded(
          child: pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
            pw.Container(height: 1, color: PdfColors.grey600),
            pw.SizedBox(height: 2),
            pw.Text(labels[i], style: pw.TextStyle(fontSize: 7.5, fontWeight: pw.FontWeight.bold)),
            pw.SizedBox(height: 2),
            if (i == 0 && signature != null)
              pw.Image(signature, width: 62, height: 20, fit: pw.BoxFit.contain)
            else if (i == 0)
              pw.Text(signedBy, style: const pw.TextStyle(fontSize: 7, fontStyle: pw.FontStyle.italic)),
          ]),
        ),
      ],
    ],
  );
}

String _d(DateTime d) =>
    '${d.day}/${d.month}/${d.year}';
String _dt(DateTime d) =>
    '${d.day}/${d.month}/${d.year} ${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';
String _money(num n) => n.toStringAsFixed(n.truncateToDouble() == n ? 0 : 2)
    .replaceAll(RegExp(r'\B(?=(\d{3})+(?!\d))'), ',');
String _qty(num q) => q == q.roundToDouble() ? q.toInt().toString() : q.toStringAsFixed(1);
int _nairaPart(num n) => n.floor();
int _koboPart(num n) => ((n - n.floor()) * 100).round();
