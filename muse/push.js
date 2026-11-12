// Notifications on this device: register the service worker, ask permission, and save the
// device's push address to the account so the morning reminder job can reach it.
import { supabase } from './supabase.js';
import { VAPID_PUBLIC_KEY } from './config.js';
import { currentUserId } from './db.js';

const supported = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
export const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const isInstalled = () => (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('/sw.js').catch(() => { /* notifications just won't be available */ });
}

function keyBytes(base64) {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}
const device = () => (isIOS() ? 'iPhone or iPad' : /Android/i.test(navigator.userAgent) ? 'Android' : /Mac/i.test(navigator.userAgent) ? 'Mac' : 'Computer');

async function currentSubscription() {
  if (!supported()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? reg.pushManager.getSubscription() : null;
}

/** 'on' | 'off' | 'denied' | 'install' (iPhone needs MUSE on the Home Screen first) | 'unsupported' */
export async function notificationStatus() {
  if (isIOS() && !isInstalled()) return 'install';
  if (!supported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const sub = await currentSubscription();
  return sub && Notification.permission === 'granted' ? 'on' : 'off';
}

async function saveSubscription(sub) {
  const j = sub.toJSON();
  const { error } = await supabase.from('push_subscriptions').upsert(
    { user_id: currentUserId(), endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, device: device() },
    { onConflict: 'user_id,endpoint' },
  );
  if (error) throw new Error("Couldn't save notification settings. " + error.message);
}

/** Must be called from a tap (iPhone only allows asking then). Resolves the new status. */
export async function enableNotifications() {
  if (isIOS() && !isInstalled()) return 'install';
  if (!supported()) return 'unsupported';
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'off';
  registerServiceWorker();
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) });
  await saveSubscription(sub);
  return 'on';
}

export async function disableNotifications() {
  const sub = await currentSubscription();
  if (sub) {
    await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
    await sub.unsubscribe().catch(() => {});
  }
  return 'off';
}

/** After sign-in, make sure this device's push address is on the account (it can change over time). */
export async function syncNotifications() {
  try { if (Notification.permission === 'granted') { const sub = await currentSubscription(); if (sub) await saveSubscription(sub); } } catch { /* optional */ }
}

export async function sendTestNotification() {
  const { data } = await supabase.auth.getSession();
  const r = await fetch('/api/push/test', { method: 'POST', headers: { Authorization: 'Bearer ' + (data.session?.access_token || '') } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Couldn't send a test notification.");
  return j;
}
