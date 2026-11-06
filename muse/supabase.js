import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

// ---------- "Keep me signed in" ----------
// On (the default): the sign-in is saved on this device in two places (localStorage and IndexedDB),
// so if iOS clears one, MUSE restores it from the other. Off: it lives only until the app is closed.
const REMEMBER = 'muse-remember';
export const rememberMe = () => { try { return localStorage.getItem(REMEMBER) !== '0'; } catch { return true; } };

const DB = 'muse-auth', STORE = 'kv';
function idb(mode, fn) {
  return new Promise((resolve) => {
    try {
      const open = indexedDB.open(DB, 1);
      open.onupgradeneeded = () => open.result.createObjectStore(STORE);
      open.onerror = () => resolve(null);
      open.onsuccess = () => {
        try {
          const tx = open.result.transaction(STORE, mode);
          const req = fn(tx.objectStore(STORE));
          tx.oncomplete = () => { resolve(req ? req.result : null); open.result.close(); };
          tx.onerror = () => { resolve(null); open.result.close(); };
        } catch { resolve(null); }
      };
    } catch { resolve(null); }
  });
}
const idbGet = (k) => idb('readonly', (s) => s.get(k));
const idbSet = (k, v) => idb('readwrite', (s) => s.put(v, k));
const idbDel = (k) => idb('readwrite', (s) => s.delete(k));
const safe = (fn, fallback = null) => { try { return fn(); } catch { return fallback; } };

const authStorage = {
  async getItem(key) {
    if (!rememberMe()) return safe(() => sessionStorage.getItem(key));
    const local = safe(() => localStorage.getItem(key));
    if (local != null) return local;
    const saved = await idbGet(key); // localStorage was cleared: bring the sign-in back from the backup
    if (saved != null) safe(() => localStorage.setItem(key, saved));
    return saved ?? null;
  },
  async setItem(key, value) {
    if (!rememberMe()) { safe(() => sessionStorage.setItem(key, value)); return; }
    safe(() => localStorage.setItem(key, value));
    await idbSet(key, value);
  },
  async removeItem(key) {
    safe(() => localStorage.removeItem(key));
    safe(() => sessionStorage.removeItem(key));
    await idbDel(key);
  },
};

// PKCE keeps sign-in tokens out of the URL hash, which MUSE uses for its own page routes.
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storage: authStorage },
});

/** Switch "Keep me signed in" and move the current sign-in to match, without signing out. */
export async function setRememberMe(on) {
  const was = rememberMe();
  safe(() => localStorage.setItem(REMEMBER, on ? '1' : '0'));
  if (was === on) return;
  const keys = [];
  const from = on ? sessionStorage : localStorage;
  safe(() => { for (let i = 0; i < from.length; i++) { const k = from.key(i); if (k && k.startsWith('sb-')) keys.push(k); } });
  for (const k of keys) {
    const v = safe(() => from.getItem(k));
    if (v == null) continue;
    if (on) { safe(() => localStorage.setItem(k, v)); await idbSet(k, v); safe(() => sessionStorage.removeItem(k)); }
    else { safe(() => sessionStorage.setItem(k, v)); safe(() => localStorage.removeItem(k)); await idbDel(k); }
  }
}

/** Ask the browser to keep MUSE's storage even when the phone is low on space. */
export function askToKeepStorage() {
  try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch { /* not supported */ }
}

// Remember the email of the last person who signed in, so signing back in is one tap with saved passwords.
export const lastEmail = () => safe(() => localStorage.getItem('muse-last-email') || '', '');
export const saveLastEmail = (e) => safe(() => (e ? localStorage.setItem('muse-last-email', e) : localStorage.removeItem('muse-last-email')));
