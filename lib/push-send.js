import webpush from 'web-push';
import { VAPID_PUBLIC_KEY, SITE_URL } from '../muse/config.js';

let ready = false;
function setup() {
  if (ready) return true;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!priv) return false;
  webpush.setVapidDetails(SITE_URL, VAPID_PUBLIC_KEY, priv);
  ready = true;
  return true;
}
export const pushConfigured = () => setup();

/**
 * Send one notification to each subscription. Resolves { sent, gone } where `gone` lists
 * subscription ids the push service says no longer exist (the app was removed or permission revoked).
 */
export async function sendToSubscriptions(subs, payload) {
  if (!setup()) throw new Error('Notifications are not set up yet (VAPID_PRIVATE_KEY is missing in Vercel).');
  let sent = 0; const gone = [];
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 60 * 60 * 12, urgency: 'normal', topic: (payload.tag || 'muse').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32) });
      sent++;
    } catch (e) {
      if (e && (e.statusCode === 404 || e.statusCode === 410)) gone.push(s.id);
    }
  }));
  return { sent, gone };
}
