import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY } from '../../../../muse/config.js';
import { sendToSubscriptions } from '../../../../lib/push-send.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/push/test → sends "Notifications are on" to the signed-in person's devices. */
export async function POST(req) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  // Acts as the signed-in person, so the privacy rules only return their own devices.
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: user } = await sb.auth.getUser(token);
  if (!user?.user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  const { data: subs, error } = await sb.from('push_subscriptions').select('id, endpoint, p256dh, auth');
  if (error) return NextResponse.json({ error: "Couldn't find this device's notification settings." }, { status: 500 });
  try {
    const r = await sendToSubscriptions(subs || [], { title: 'Notifications are on ✨', body: "MUSE will remind you before your packages arrive.", url: '/#packages', tag: 'muse-test' });
    if (r.gone.length) await sb.from('push_subscriptions').delete().in('id', r.gone);
    return NextResponse.json({ sent: r.sent });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 503 });
  }
}
