/// Machine-readable structure of the three physical corporate forms
/// (docs/forms/FORM_LAYOUTS.md) — drives both the generator UI and the
/// PDF painters, so paper and digital stay 1:1.
///
/// Serials on the physical books are PRE-PRINTED (Receipt 2131, MILS 925,
/// Invoice 4335): the app's SerialService is seeded by Admin to continue
/// from the current book numbers.
library;

class WeightClass {
  final int kg;
  const WeightClass(this.kg);
  String get label => '${kg}kg';
}

class MtekForms {
  /// MILS Section A — exact weight classes from the physical sheet.
  static const weightClasses = <WeightClass>[
    WeightClass(1), WeightClass(2), WeightClass(3), WeightClass(5),
    WeightClass(6), WeightClass(9), WeightClass(12), WeightClass(25),
    WeightClass(50), WeightClass(75),
  ];

  /// MILS Section B — REPLACEMENT component rows (12, incl. Seal).
  static const components = <String>[
    'Nipple', 'Horn', 'Hose', 'Manometre', 'Valve', 'Strap',
    'Label', 'Lever', 'Seal', 'Powder', 'Pull Pin', 'Cartridge',
  ];

  /// Sales Invoice document-type checkboxes.
  static const invoiceVariants = <String>[
    'WAY BILL', 'PRO-FORMER', 'SERVICE INVOICE', 'SALES INVOICE',
  ];

  /// Receipt payment methods (2×2 grid on the form).
  static const receiptMethods = <String>['Cash', 'Cheque', 'Transfer', 'POS'];

  /// Current book numbers (Admin-seedable in Settings → Serials).
  static const seedSerials = <String, int>{
    'receipt': 2131,
    'mils': 925,
    'invoice': 4335,
    'waybill': 174, // physical book currently on No: 0174
    'deliverynote': 19790088, // pre-printed book (next: 19790089)
  };

  /// VAT shown on the Sales Invoice (7.5% — configurable in Settings, §7).
  static const double invoiceVatRate = 0.075;
}
