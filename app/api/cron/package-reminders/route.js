import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL } from '../../../../muse/config.js';
import { reminderText } from '../../../../muse/reminder-text.js';
import { sendToSubscriptions } from '../../../../lib/push-send.js';
import { localDay, pickDue } from '../../../../lib/reminders.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Runs every morning (see vercel.json). Finds packages due tomorrow or today in each person's
 * own time zone and sends the reminders they asked for. Vercel calls it with the CRON_SECRET.
 */
export async function GET(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'Not allowed.' }, { status: 401 });
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY is missing in Vercel.' }, { status: 500 });
  const sb = createClient(SUPABASE_URL, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  // Anything due within a day either side of today (UTC) could be "today" or "tomorrow" somewhere.
  const from = localDay('UTC', -1), to = localDay('UTC', 2);
  const { data: pkgs, error } = await sb.from('packages')
    .select('id, user_id, name, store, message, expected_date, remind, timezone, reminded_before_at, reminded_dayof_at')
    .eq('delivered', false).neq('remind', 'off').gte('expected_date', from).lte('expected_date', to);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const due = pickDue(pkgs || [], new Date());
  if (!due.length) return NextResponse.json({ checked: pkgs?.length || 0, sent: 0 });

  const userIds = [...new Set(due.map((x) => x.p.user_id))];
  const { data: subs } = await sb.from('push_subscriptions').select('id, user_id, endpoint, p256dh, auth').in('user_id', userIds);
  let sent = 0; const gone = new Set();
  for (const { p, kind } of due) {
    const mine = (subs || []).filter((s) => s.user_id === p.user_id && !gone.has(s.id));
    if (!mine.length) continue;
    const { title, body } = reminderText(p, kind);
    const r = await sendToSubscriptions(mine, { title, body, url: '/#packages', tag: `pkg-${p.id}-${kind}` });
    r.gone.forEach((id) => gone.add(id));
    if (r.sent) {
      sent += r.sent;
      await sb.from('packages').update(kind === 'before' ? { reminded_before_at: new Date().toISOString() } : { reminded_dayof_at: new Date().toISOString() }).eq('id', p.id);
    }
  }
  if (gone.size) await sb.from('push_subscriptions').delete().in('id', [...gone]);
  return NextResponse.json({ checked: pkgs.length, due: due.length, sent, removedDevices: gone.size });
}
