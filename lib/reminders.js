/** YYYY-MM-DD for "today" (+ offset days) in a time zone, as of `now`. */
export function localDay(tz, offset = 0, now = new Date()) {
  let zone = tz || 'America/Los_Angeles';
  try { new Intl.DateTimeFormat('en-CA', { timeZone: zone }); } catch { zone = 'America/Los_Angeles'; }
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  if (!offset) return day;
  const d = new Date(day + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

/** Which reminders are due right now, judged by each package owner's own calendar day. */
export function pickDue(pkgs, now = new Date()) {
  const due = [];
  for (const p of pkgs) {
    if (p.delivered || p.remind === 'off') continue;
    const today = localDay(p.timezone, 0, now), tomorrow = localDay(p.timezone, 1, now);
    if ((p.remind === 'before' || p.remind === 'both') && p.expected_date === tomorrow && !p.reminded_before_at) due.push({ p, kind: 'before' });
    if ((p.remind === 'dayof' || p.remind === 'both') && p.expected_date === today && !p.reminded_dayof_at) due.push({ p, kind: 'dayof' });
  }
  return due;
}
