import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show rootBundle;

import '../../core/format.dart' as fmt;
import '../../core/theme.dart';
import '../../data/auth_store.dart';
import '../../documents/doc_models.dart';
import '../../documents/forms_spec.dart';
import '../../documents/pdf_painters.dart';
import '../../documents/serial_service.dart';
import '../../documents/share_service.dart';
import '../signature_dialog.dart';

/// DOCUMENT GENERATOR (SPEC §12, Phase A): document-type switcher →
/// per-type form state (context preserved) → validation → Signature
/// Passcode gate → PDF build → share via WhatsApp/email (fallback save).
class GeneratorScreen extends StatefulWidget {
  const GeneratorScreen({super.key});

  @override
  State<GeneratorScreen> createState() => _GeneratorScreenState();
}

class _GeneratorScreenState extends State<GeneratorScreen> {
  DocType _type = DocType.receipt;

  // One live form state per type — switching tabs keeps context.
  final ReceiptDocState _receipt = ReceiptDocState();
  final InvoiceDocState _invoice = InvoiceDocState();
  final MilsDocState _mils = MilsDocState();

  final Map<DocType, String?> _errors = {
    DocType.receipt: null,
    DocType.invoice: null,
    DocType.mils: null,
  };

  static const _labels = {
    DocType.receipt: 'Receipt',
    DocType.invoice: 'Invoice',
    DocType.mils: 'MILS',
  };

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Padding(
          padding: EdgeInsets.fromLTRB(20, 20, 20, 0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Documents', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700, color: Mtek.ink)),
              SizedBox(height: 4),
              Text('Write up a receipt, invoice or MILS log — PDF mirrors your paper books, signed & shared instantly',
                  style: TextStyle(color: Mtek.gray500)),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
          child: SegmentedButton<DocType>(
            segments: const [
              ButtonSegment(value: DocType.receipt, icon: Icon(Icons.receipt_long_outlined), label: Text('Payment Receipt')),
              ButtonSegment(value: DocType.invoice, icon: Icon(Icons.request_quote_outlined), label: Text('Sales Invoice')),
              ButtonSegment(value: DocType.mils, icon: Icon(Icons.build_circle_outlined), label: Text('MILS Sheet')),
            ],
            selected: {_type},
            onSelectionChanged: (s) => setState(() => _type = s.first),
          ),
        ),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.all(20),
            children: [
              ...switch (_type) {
                DocType.receipt => _receiptForm(),
                DocType.invoice => _invoiceForm(),
                DocType.mils => _milsForm(),
              },
              if (_errors[_type] != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Text(_errors[_type]!,
                      style: const TextStyle(color: Mtek.danger, fontWeight: FontWeight.w600)),
                ),
              FilledButton.icon(
                icon: const Icon(Icons.draw_outlined),
                label: const Text('Sign & generate PDF'),
                onPressed: _generate,
              ),
              const SizedBox(height: 8),
              const Text(
                'Generation requires your Signature Passcode · PDF carries the corporate header, '
                'watermark, your signature stamp and a verification QR.',
                style: TextStyle(fontSize: 11, color: Mtek.gray500),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ],
    );
  }

  // ---------- shared field builders ----------

  Widget _field(
    TextEditingController controller,
    String label, {
    TextInputType? keyboard,
    String? hint,
    ValueChanged<String>? onChanged,
    bool enabled = true,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: TextField(
        controller: controller,
        keyboardType: keyboard,
        enabled: enabled,
        decoration: InputDecoration(labelText: label, hintText: hint),
        onChanged: onChanged,
      ),
    );
  }

  Widget _summaryTile(String label, String value, {Color? color, bool strong = false}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(children: [
        Text(label, style: const TextStyle(color: Mtek.gray500, fontSize: 13)),
        const Spacer(),
        Text(value,
            style: TextStyle(fontSize: strong ? 17 : 14, fontWeight: FontWeight.w800, color: color ?? Mtek.ink)),
      ]),
    );
  }

  // ---------- RECEIPT ----------

  final _rName = TextEditingController(), _rAddr = TextEditingController(), _rPhone = TextEditingController(),
      _rAmount = TextEditingController(), _rFor = TextEditingController(), _rIrn = TextEditingController();

  List<Widget> _receiptForm() {
    return [
      _serialBanner('receipt', _receipt.serial),
      _field(_rIrn, 'IRN (Invoice Reference Number)', onChanged: (v) => _receipt.irn = v),
      _field(_rName, 'Customer name *', onChanged: (v) => _receipt.name = v),
      _field(_rAddr, 'Address', onChanged: (v) => _receipt.address = v),
      _field(_rPhone, 'Phone No.', keyboard: TextInputType.phone, onChanged: (v) => _receipt.phone = v),
      _field(_rFor, 'Being Payment for', hint: 'e.g. Refill of 24 × 6kg extinguishers', onChanged: (v) => _receipt.beingPaymentFor = v),
      _field(_rAmount, 'The Sum of (₦) *', keyboard: const TextInputType.numberWithOptions(decimal: true),
          onChanged: (v) => setState(() => _receipt.amount = double.tryParse(v) ?? 0)),
      const SizedBox(height: 6),
      const Text('PAYMENT METHOD', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 1, color: Mtek.gray500)),
      const SizedBox(height: 6),
      Wrap(
        spacing: 8,
        children: [
          for (final m in MtekForms.receiptMethods)
            ChoiceChip(
              label: Text(m),
              selected: _receipt.method == m,
              selectedColor: Mtek.brandTint,
              onSelected: (_) => setState(() => _receipt.method = m),
            ),
        ],
      ),
      const SizedBox(height: 10),
      _summaryTile('The Sum of (words)', _receipt.amountInWords, strong: true),
      _serialBanner('receipt', null, preview: true),
    ];
  }

  // ---------- INVOICE ----------

  final _iName = TextEditingController(), _iAddr = TextEditingController(), _iPhone = TextEditingController(),
      _iMils = TextEditingController(), _iRec = TextEditingController(), _iLpo = TextEditingController(),
      _iAdvance = TextEditingController();

  List<Widget> _invoiceForm() {
    return [
      _serialBanner('invoice', _invoice.serial),
      Wrap(
        spacing: 6,
        runSpacing: 6,
        children: [
          for (final variant in MtekForms.invoiceVariants)
            ChoiceChip(
              label: Text(variant),
              selected: _invoice.variant == variant,
              selectedColor: Mtek.brandTint,
              onSelected: (_) => setState(() => _invoice.variant = variant),
            ),
          FilterChip(
            label: const Text('MILS No ref.'),
            selected: _invoice.showMilsNo,
            selectedColor: Mtek.goldTint,
            onSelected: (_) => setState(() => _invoice.showMilsNo = !_invoice.showMilsNo),
          ),
          FilterChip(
            label: const Text('Receipt No ref.'),
            selected: _invoice.showReceiptNo,
            selectedColor: Mtek.goldTint,
            onSelected: (_) => setState(() => _invoice.showReceiptNo = !_invoice.showReceiptNo),
          ),
        ],
      ),
      const SizedBox(height: 10),
      if (_invoice.showMilsNo) _field(_iMils, 'MILS No', onChanged: (v) => _invoice.milsNo = v),
      if (_invoice.showReceiptNo) _field(_iRec, 'Receipt No', onChanged: (v) => _invoice.receiptNo = v),
      _field(_iLpo, 'L.P.O. No', onChanged: (v) => _invoice.lpoNo = v),
      _field(_iName, 'Customer name *', onChanged: (v) => _invoice.name = v),
      _field(_iAddr, 'Address', onChanged: (v) => _invoice.address = v),
      _field(_iPhone, 'Phone No.', keyboard: TextInputType.phone, onChanged: (v) => _invoice.phone = v),
      const SizedBox(height: 6),
      const Text('ITEMISED LEDGER', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 1, color: Mtek.gray500)),
      ..._invoiceFormRows(),
      TextButton.icon(
        onPressed: () => setState(() => _invoice.rows.add(LedgerRow())),
        icon: const Icon(Icons.add, size: 18),
        label: const Text('Add row'),
      ),
      const SizedBox(height: 8),
      _summaryTile('Subtotal', fmt.naira(_invoice.subtotal)),
      _summaryTile('7.5% VAT', fmt.naira(_invoice.vat)),
      _summaryTile('GRAND TOTAL', fmt.naira(_invoice.grandTotal), strong: true, color: Mtek.brand700),
      _field(_iAdvance, 'Advance Payment (₦)', keyboard: const TextInputType.numberWithOptions(decimal: true),
          onChanged: (v) => setState(() => _invoice.advancePayment = double.tryParse(v) ?? 0)),
      _summaryTile('Balance Payment', fmt.naira(_invoice.balance), strong: true, color: Mtek.danger),
      _summaryTile('Amount in words', _invoice.amountInWords),
    ];
  }

  List<Widget> _invoiceFormRows() {
    return [
      for (var i = 0; i < _invoice.rows.length; i++)
        Card(
          margin: const EdgeInsets.only(bottom: 8),
          child: Padding(
            padding: const EdgeInsets.all(10),
            child: Row(children: [
              Expanded(
                flex: 4,
                child: TextFormField(
                  initialValue: _invoice.rows[i].description,
                  decoration: const InputDecoration(labelText: 'Description', isDense: true),
                  onChanged: (v) => _invoice.rows[i].description = v,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: TextFormField(
                  initialValue: _invoice.rows[i].qty == 1 ? '1' : _invoice.rows[i].qty.toString(),
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  decoration: const InputDecoration(labelText: 'Qty', isDense: true),
                  onChanged: (v) => setState(() => _invoice.rows[i].qty = double.tryParse(v) ?? 0),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                flex: 2,
                child: TextFormField(
                  initialValue: _invoice.rows[i].rate == 0 ? '' : _invoice.rows[i].rate.toString(),
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  decoration: const InputDecoration(labelText: 'Rate (₦)', isDense: true),
                  onChanged: (v) => setState(() => _invoice.rows[i].rate = double.tryParse(v) ?? 0),
                ),
              ),
              const SizedBox(width: 8),
              SizedBox(
                width: 86,
                child: Text(fmt.naira(_invoice.rows[i].amount), textAlign: TextAlign.right,
                    style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
              ),
              IconButton(
                icon: const Icon(Icons.close, size: 16),
                onPressed: _invoice.rows.length > 1
                    ? () => setState(() => _invoice.rows.removeAt(i))
                    : null,
              ),
            ]),
          ),
        ),
    ];
  }

  // ---------- MILS ----------

  final _mName = TextEditingController(), _mAddr = TextEditingController(), _mPhone = TextEditingController(),
      _mInvoiceNo = TextEditingController(), _mReceiptNo = TextEditingController(), _mLpo = TextEditingController(),
      _mAdvance = TextEditingController();

  List<Widget> _milsForm() {
    return [
      _serialBanner('mils', _mils.serial),
      Row(children: [
        Expanded(child: _dateTile('Entry Date', _mils.entryDate, (d) => _mils.entryDate = d)),
        const SizedBox(width: 8),
        Expanded(child: _dateTile('Collection Date', _mils.collectionDate, (d) => _mils.collectionDate = d)),
      ]),
      const SizedBox(height: 8),
      Row(children: [
        Expanded(child: _dateTile('Next Service Date', _mils.nextServiceDate, (d) => _mils.nextServiceDate = d)),
        const SizedBox(width: 8),
        Expanded(child: _field(_mLpo, 'LPO No.', onChanged: (v) => _mils.lpoNo = v)),
      ]),
      _field(_mInvoiceNo, 'Invoice No.', onChanged: (v) => _mils.invoiceNo = v),
      _field(_mReceiptNo, 'Receipt No.', onChanged: (v) => _mils.receiptNo = v),
      const SizedBox(height: 6),
      const Text('A — DESCRIPTION (EXTINGUISHERS BY WEIGHT)', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 1, color: Mtek.gray500)),
      ..._milsWeightGrid(),
      const SizedBox(height: 10),
      const Text('B — REPLACEMENT (COMPONENTS)', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 1, color: Mtek.gray500)),
      Wrap(
        spacing: 6,
        runSpacing: 6,
        children: [
          for (final c in MtekForms.components)
            FilterChip(
              label: Text(c),
              selected: (_mils.componentQty[c] ?? 0) > 0,
              selectedColor: Mtek.brandTint,
              onSelected: (on) => setState(() {
                _mils.componentQty[c] = on ? 1 : 0;
                if (!on) _mils.componentRate.remove(c);
              }),
            ),
        ],
      ),
      for (final c in MtekForms.components)
        if ((_mils.componentQty[c] ?? 0) > 0) _milsComponentRow(c),
      const SizedBox(height: 10),
      _field(_mName, "Customer's Name *", onChanged: (v) => _mils.name = v),
      _field(_mAddr, 'Address', onChanged: (v) => _mils.address = v),
      _field(_mPhone, 'Phone Number', keyboard: TextInputType.phone, onChanged: (v) => _mils.phone = v),
      const SizedBox(height: 6),
      _summaryTile('Subtotal', fmt.naira(_mils.subtotal)),
      _summaryTile('VAT', fmt.naira(_mils.vat)),
      _summaryTile('GRAND TOTAL', fmt.naira(_mils.grandTotal), strong: true, color: Mtek.brand700),
      _field(_mAdvance, 'Advance Payment (₦) — min 50% required by policy',
          keyboard: const TextInputType.numberWithOptions(decimal: true),
          onChanged: (v) => _mils.advancePayment = double.tryParse(v) ?? 0),
      _summaryTile('Balance Total', fmt.naira(_mils.balance), strong: true, color: Mtek.danger),
      _summaryTile('Bill in words', _mils.amountInWords),
    ];
  }

  Widget _milsWeightGrid() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(10),
        child: Column(
          children: [
            for (final wc in MtekForms.weightClasses)
              Row(children: [
                SizedBox(width: 52, child: Text(wc.label, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13))),
                Expanded(
                  child: Slider(
                    value: _mils.weightQty[wc.kg] ?? 0,
                    min: 0,
                    max: 60,
                    divisions: 60,
                    label: '${(_mils.weightQty[wc.kg] ?? 0).round()}',
                    activeColor: Mtek.brand600,
                    onChanged: (v) => setState(() => _mils.weightQty[wc.kg] = v),
                  ),
                ),
                SizedBox(
                  width: 44,
                  child: Text('${(_mils.weightQty[wc.kg] ?? 0).round()}',
                      textAlign: TextAlign.end, style: const TextStyle(fontWeight: FontWeight.w800)),
                ),
                SizedBox(
                  width: 110,
                  child: TextFormField(
                    initialValue: _mils.weightRate[wc.kg]?.toString() ?? '',
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'Rate', isDense: true),
                    onChanged: (v) => _mils.weightRate[wc.kg] = double.tryParse(v) ?? 0,
                  ),
                ),
              ]),
          ],
        ),
      ),
    );
  }

  Widget _milsComponentRow(String c) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(children: [
        SizedBox(width: 90, child: Text(c, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13))),
        Expanded(
          child: TextFormField(
            initialValue: (_mils.componentQty[c] ?? 0).toString(),
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(labelText: 'Qty', isDense: true),
            onChanged: (v) => setState(() => _mils.componentQty[c] = double.tryParse(v) ?? 0),
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          flex: 2,
          child: TextFormField(
            initialValue: _mils.componentRate[c]?.toString() ?? '',
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(labelText: 'Rate (₦)', isDense: true),
            onChanged: (v) => setState(() => _mils.componentRate[c] = double.tryParse(v) ?? 0),
          ),
        ),
      ]),
    );
  }

  Widget _dateTile(String label, DateTime value, ValueChanged<DateTime> onPicked) {
    return Card(
      child: ListTile(
        dense: true,
        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 2),
        title: Text(label, style: const TextStyle(fontSize: 11, color: Mtek.gray500)),
        subtitle: Text(fmt.fmtDate(value), style: const TextStyle(fontWeight: FontWeight.w700)),
        trailing: const Icon(Icons.calendar_month_outlined, size: 18),
        onTap: () async {
          final d = await showDatePicker(
            context: context,
            initialDate: value,
            firstDate: DateTime(2020),
            lastDate: DateTime(2035),
          );
          if (d != null) onPicked(d);
        },
      ),
    );
  }

  Widget _serialBanner(String type, int? assigned, {bool preview = false}) {
    final label = switch (type) {
      'receipt' => 'Receipt No',
      'invoice' => 'Invoice No',
      _ => 'MILS No',
    };
    final next = SerialService.instance.current(type) + 1;
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(color: Mtek.goldTint, borderRadius: BorderRadius.circular(10)),
      child: Row(children: [
        const Icon(Icons.tag, size: 15, color: Mtek.warn),
        const SizedBox(width: 6),
        Text('$label: ', style: const TextStyle(fontWeight: FontWeight.w700)),
        Text(preview ? 'next on paper sequence: $next' : '${assigned ?? next}',
            style: const TextStyle(fontWeight: FontWeight.w800)),
        const Spacer(),
        Text('continues book numbering', style: TextStyle(fontSize: 10.5, color: Mtek.gray600)),
      ]),
    );
  }

  // ---------- validation → signature → PDF → share ----------

  Future<void> _generate() async {
    final err = switch (_type) {
      DocType.receipt => _receipt.valid ? null : 'Customer name and a valid amount are required.',
      DocType.invoice => _invoice.valid ? null : 'Customer name and at least one line item (description + amount) are required.',
      DocType.mils => _mils.valid ? null : "Customer's name and at least one weight entry or component are required.",
    };
    setState(() => _errors[_type] = err);
    if (err != null) return;

    final signer = await confirmSignature(context);
    if (signer == null || !mounted) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Not signed — document NOT issued.')));
      }
      return;
    }

    // serial assignment (paper-book sequence)
    final typeKey = switch (_type) {
      DocType.receipt => 'receipt',
      DocType.invoice => 'invoice',
      DocType.mils => 'mils',
    };
    final serial = SerialService.instance.next(typeKey);
    _receipt.serial = serial; _invoice.serial = serial; _mils.serial = serial;

    final logoBytes = await rootBundle.load('assets/branding/logo.png');
    final signatureBytes = dataUrlToBytes(signer.signaturePng);

    final bytes = await buildDocument(
      switch (_type) {
        DocType.receipt => GeneratedDoc.receipt,
        DocType.invoice => GeneratedDoc.invoice,
        DocType.mils => GeneratedDoc.mils,
      },
      logoBytes: logoBytes.buffer.asUint8List(),
      receipt: _receipt,
      invoice: _invoice,
      mils: _mils,
      signedBy: signer.name,
      signaturePngBytes: signatureBytes,
    );

    final customer = switch (_type) {
      DocType.receipt => _receipt.name,
      DocType.invoice => _invoice.name,
      DocType.mils => _mils.name,
    };
    final docLabel = switch (_type) {
      DocType.receipt => 'Payment Receipt',
      DocType.invoice => 'Invoice',
      DocType.mils => 'Maintenance Information Log Sheet (MILS)',
    };
    final filename = 'mtek_${typeKey}_$serial'
        '_${DateTime.now().millisecondsSinceEpoch}.pdf';

    final outcome = await dispatchPdf(
      bytes: bytes,
      filename: filename,
      message: shareMessage(docLabel: docLabel, serial: serial, customerName: customer),
    );

    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      backgroundColor: outcome.result == ShareResult.failed ? Mtek.danger : Mtek.success,
      content: Text('✓ $docLabel No: $serial signed by ${signer.name} — ${outcome.message}'),
    ));
  }
}
