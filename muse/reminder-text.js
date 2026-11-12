// Shared by the app (for the preview) and the morning reminder job, so what you see is what you get.

/** kind: 'before' (the day before) or 'dayof' (the morning it's due) */
export function reminderText(pkg, kind) {
  const what = (pkg.name || '').trim() || 'package';
  const from = (pkg.store || '').trim() ? ` from ${pkg.store.trim()}` : '';
  const title = kind === 'dayof' ? 'Arriving today 📦' : 'Arriving tomorrow 📦';
  const custom = (pkg.message || '').trim();
  const body = custom || (kind === 'dayof' ? `Your ${what}${from} should arrive today.` : `Your ${what}${from} should arrive tomorrow.`);
  return { title, body };
}

/** Best guess at the carrier from the shape of a tracking number. */
export function guessCarrier(number) {
  const n = String(number || '').replace(/\s+/g, '').toUpperCase();
  if (!n) return '';
  if (/^1Z[0-9A-Z]{16}$/.test(n)) return 'UPS';
  if (/^TBA\d+$/.test(n)) return 'Amazon';
  if (/^(94|93|92|95)\d{20,24}$/.test(n) || /^[A-Z]{2}\d{9}US$/.test(n)) return 'USPS';
  if (/^(\d{12}|\d{15}|\d{20}|\d{22})$/.test(n)) return 'FedEx';
  if (/^\d{10}$/.test(n) || /^JJD\d+$/.test(n)) return 'DHL';
  if (/^(C|D)\d{14}$/.test(n) || /^1LS\d+/.test(n)) return 'OnTrac';
  return '';
}

/** The carrier's public tracking page, or '' when there isn't one MUSE can link to. */
export function trackingUrl(carrier, number) {
  const t = encodeURIComponent(String(number || '').replace(/\s+/g, ''));
  if (!t) return '';
  switch ((carrier || '').toLowerCase()) {
    case 'usps': return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${t}`;
    case 'ups': return `https://www.ups.com/track?tracknum=${t}`;
    case 'fedex': return `https://www.fedex.com/fedextrack/?trknbr=${t}`;
    case 'dhl': return `https://www.dhl.com/us-en/home/tracking/tracking-express.html?submit=1&tracking-id=${t}`;
    case 'ontrac':
    case 'lasership': return `https://www.ontrac.com/tracking/?number=${t}`;
    default: return '';
  }
}
