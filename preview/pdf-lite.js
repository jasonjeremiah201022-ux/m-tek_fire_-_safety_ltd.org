// ===========================================================================
// pdf-lite — minimal, dependency-free PDF writer for the preview.
// Produces REAL PDF bytes (A4, Helvetica, text + rules + boxed tables) so
// every document button hands out a genuine file: Web Share (files) →
// WhatsApp/Email pickers, or download on desktop. NO pre-filled message
// text anywhere — the PDF *is* the content (owner directive 2026-08-30).
// ===========================================================================
'use strict';

const esc = s => String(s ?? '').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

/** lines: [{text, size, bold, gapBefore, rule, boxed, shade}] — y flows top-down */
function buildPdf(lines, title) {
  const W = 595.28, H = 841.89, M = 46;
  let y = H - M;
  const ops = [];
  const F = (bold, size) => `/F${bold ? 2 : 1} ${size} Tf`;

  for (const L of lines) {
    const size = L.size ?? 10, bold = !!L.bold;
    y -= (L.gapBefore ?? 0);
    if (L.shade) {
      ops.push(`q 0.93 0.95 0.99 rg ${M} ${y - 4} ${W - 2 * M} ${size + 10} re f Q`);
    }
    if (L.boxed) {
      ops.push(`0.75 0.78 0.85 RG 0.8 w ${M} ${y - 4} ${W - 2 * M} ${size + 12} re S`);
    }
    if (L.rule) {
      y -= 6;
      ops.push(`0.55 0.60 0.30 RG ${M} ${y} ${W - 2 * M} 0.8 re f`);
      ops.push('0 0 0 RG');
    }
    y -= size + 5;
    if (L.text) {
      const x = L.center ? (W - M * 2) / 2 - (L.text.length * size * 0.26) : M;
      ops.push(`BT ${F(bold, size)} ${L.color || '0 0 0'} 1 Tc 0 Tw 1 0 0 1 ${x.toFixed(1)} ${y.toFixed(1)} Tm (${esc(L.text)}) Tj ET`);
      ops.push('0 0 0 rg 0 Tc');
    }
    y -= (L.gapAfter ?? 0);
    if (y < M + 60) break; // single page is plenty for the preview mirror
  }
  const content = ops.join('\n');

  const objects = [];
  objects.push('<< /Type /Catalog /Pages 2 0 R >>');
  objects.push('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>`);
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
  objects.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  objects.push(`<< /Title (${esc(title || 'M-TEK Document')}) /Producer (M-TEK pdf-lite) >>`);

  let out = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((body, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) out += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info ${objects.length} 0 R >>\nstartxref\n${xref}\n%%EOF`;

  const bytes = new Uint8Array(out.length);
  for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xff;
  return bytes;
}

// ---- document builders (mirror of the Flutter painters, real data only) ----
function docHeader(kind, serial, dateStr) {
  const TITLES = { receipt: 'PAYMENT RECEIPT', invoice: 'INVOICE', mils: 'MAINTENANCE INFORMATION LOG SHEET', waybill: 'WAYBILL', deliverynote: 'DELIVERY NOTE' };
  return [
    { text: 'M-TEK FIRE & SAFETY LTD.', size: 16, bold: true, center: true },
    { text: 'RC: 1082534  ·  Sales · Supplies · Installations · Refilling · Maintenance · Training · Consultancy', size: 7.5, center: true },
    { text: 'HEAD OFFICE: YY 12, Kazaure Road, By Lagos Street Round About, Kaduna. Tel: 08033489452', size: 7.5, center: true },
    { text: 'BRANCH OFFICE: Plot 45, Sir Patrick Ibrahim Yakowa Way By Milton School, Kamazou Kaduna. 08170577595', size: 7.5, center: true, rule: true },
    { text: TITLES[kind] || String(kind).toUpperCase(), size: 13, bold: true, center: true, gapBefore: 6 },
    { text: `No: ${String(serial).padStart(9, '0')}    Date: ${dateStr}`, size: 10, bold: true, center: true, gapAfter: 6 },
  ];
}
function footer(signedBy, hash) {
  return [
    { text: `Digitally signed by ${signedBy} — signature passcode verified server-side`, size: 8, bold: true, gapBefore: 10 },
    { text: `Verification hash: ${hash}  ·  This document is invalid without the company stamp and seal.`, size: 7 },
  ];
}
const naira = n => 'N' + Number(n || 0).toLocaleString('en-NG', { maximumFractionDigits: 2 });

window.MtekPdf = {
  /** Build + return a real PDF File for any document. */
  build(kind, d) {
    const dateStr = new Date().toLocaleDateString('en-GB');
    const L = [...docHeader(kind, d.serial, dateStr)];
    L.push({ text: `Customer: ${d.customer || '—'}`, size: 10, bold: true });
    L.push({ text: `Contact: ${d.contact || '—'}`, size: 9 });
    L.push({ gapAfter: 4, rule: true });
    if (kind === 'receipt') {
      L.push({ text: `The sum of: ${naira(d.total)} (NGN)`, size: 11, bold: true });
      L.push({ text: `Being payment for: ${d.forWhat || '—'}`, size: 9.5 });
      L.push({ text: `Method: ${d.method || 'Cash'}`, size: 9.5 });
    } else if (kind === 'waybill') {
      L.push({ text: 'PRODUCTS / TECH. SPEC / BRAND / QTY', size: 9, bold: true, shade: true });
      for (const r of (d.rows || [])) L.push({ text: `${r.d || r.product || ''}  ·  ${r.spec || r.techSpec || '—'}  ·  ${r.brand || '—'}  ·  Qty ${r.q || r.qty || ''}`, size: 9 });
      L.push({ text: `Origin: ${d.from || 'HEAD OFFICE: YY 12, Kazaure Road, By Lagos Street Round About, Kaduna'}`, size: 8.5, gapBefore: 6 });
      L.push({ text: `Destination: ${d.dest || d.destination || '—'}`, size: 8.5 });
      L.push({ text: `Driver: ${d.driver || '—'}  ·  Vehicle: ${d.vehicle || '—'}  ·  Plate: ${d.plate || '—'}`, size: 8.5 });
      L.push({ text: `Receiver: ${d.receiver || '—'}`, size: 8.5 });
      L.push({ text: 'Caution! Goods on transit insurance cover and tracking are the responsibility of the customer. We bear no liability on goods lost on transit or damaged.', size: 7 });
    } else if (kind === 'deliverynote') {
      L.push({ text: 'DESCRIPTION / ORDERED / DELIVERED / OUTSTANDING', size: 9, bold: true, shade: true });
      for (const r of (d.rows || [])) L.push({ text: `${r.d || r.description || ''}  ·  Ord ${r.ordered ?? ''}  ·  Deli ${r.delivered ?? ''}  ·  Out ${r.outstanding ?? ''}`, size: 9 });
      if (d.summary) L.push({ text: `Summary: ${d.summary}`, size: 8.5, gapBefore: 6 });
      L.push({ text: 'Goods must be checked before signing as signature and or Stamp confirms correct quantity and satisfactory condition.', size: 7 });
    } else { // invoice / mils
      L.push({ text: 'DESCRIPTION / QTY / RATE / AMOUNT', size: 9, bold: true, shade: true });
      for (const r of (d.rows || [])) L.push({ text: `${r.d || ''}  ·  ${r.q ?? r.qty ?? ''} × ${naira(r.r || r.rate || 0)}  =  ${naira((r.q ?? r.qty ?? 0) * (r.r || r.rate || 0))}`, size: 9 });
      L.push({ text: `TOTAL: ${naira(d.total)}`, size: 11, bold: true, boxed: true, gapBefore: 6 });
    }
    if (d.customerSig) L.push({ text: "[Customer's signature on file]", size: 7.5 });
    L.push(...footer(d.signedBy, d.hash || ''));
    const bytes = buildPdf(L, `M-TEK ${kind} ${String(d.serial).padStart(9, '0')}`);
    return new File([bytes], `mtek_${kind}_${String(d.serial).padStart(9, '0')}.pdf`, { type: 'application/pdf' });
  },

  /** Share the file (no pre-filled text anywhere). WhatsApp/Email use the SAME
   * OS share sheet — the user picks the app, the PDF rides along. */
  async share(file, contactPhone) {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file] }); return 'shared'; } catch { /* dismissed → fall through */ }
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file);
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 8000);
    if (contactPhone && String(contactPhone).replace(/\D/g, '').length >= 7) {
      // open the chat with the number — NO pre-filled text; attach the downloaded PDF
      window.open(`https://wa.me/${String(contactPhone).replace(/[^\d]/g, '')}`, '_blank');
      return 'downloaded+wa';
    }
    return 'downloaded';
  },
};
