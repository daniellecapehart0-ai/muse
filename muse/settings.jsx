import React from 'react';
import { useStore } from './store.jsx';
import { useNav } from './nav.js';
import { Icon, useUi } from './ui.jsx';
import { THEMES, applyTheme, applyAppearance, currentTheme, currentAppearance } from './themes.js';
import { getName, saveName } from './data.jsx';
import { fmtDate, nextDate } from './util.js';
import { APP } from './legal.jsx';
import { supabase, rememberMe, setRememberMe } from './supabase.js';
import { deleteAccount } from './db.js';
import { Btn } from './ui.jsx';
import { NotificationSettings } from './packages.jsx';

const { useState } = React;

export function SettingsView({ onReplayWelcome }) {
  const { open, go } = useNav();
  const { toast, confirm } = useUi();
  const store = useStore();
  const [theme, setTheme] = useState(currentTheme);
  const [mode, setMode] = useState(currentAppearance);
  const [name, setName] = useState(getName);
  const [email, setEmail] = useState('');
  const [keep, setKeep] = useState(rememberMe);
  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState('');
  const [pwMsg, setPwMsg] = useState('');
  const [busy, setBusy] = useState(false);
  React.useEffect(() => { supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email || '')); }, []);
  const signOut = async () => { await supabase.auth.signOut(); try { localStorage.removeItem('muse-name'); } catch { /* optional */ } location.hash = 'home'; };
  async function changePassword(e) {
    e.preventDefault();
    if (pw.length < 8) { setPwMsg('Use a password with at least 8 characters.'); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) setPwMsg(error.message); else { setPw(''); setPwOpen(false); setPwMsg(''); toast('Password changed'); }
  }
  const pick = (t) => { applyTheme(t.id); setTheme(t.id); toast(`${t.name} theme on`); };
  const pickMode = (m) => { applyAppearance(m); setMode(m); };
  const counts = [
    [store.products.filter((p) => p.kind !== 'gift').length, 'wishlist items'],
    [store.outfits.length + store.routines.length, 'outfits & routines'],
    [store.people.length, 'gift profiles'],
  ];

  return (
    <>
      <section className="hero settings-hero">
        <p className="eyebrow">MUSE</p>
        <h1 className="page-title">Settings</h1>
      </section>

      <section className="section" aria-labelledby="acct-h">
        <h2 className="section-title" id="acct-h">Account</h2>
        <div className="settings-list">
          <div className="settings-row static-row">
            <span className="settings-row-icon" aria-hidden="true"><Icon name="person" size={20} /></span>
            <span className="settings-row-text"><span className="settings-row-title">Signed in as</span><span className="muted email-line">{email || '…'}</span></span>
          </div>
          <label className="settings-row toggle-row" htmlFor="keep-signed-in">
            <span className="settings-row-icon" aria-hidden="true"><Icon name="check" size={20} /></span>
            <span className="settings-row-text"><span className="settings-row-title">Keep me signed in</span><span className="muted">{keep ? 'MUSE stays signed in on this device until you sign out' : 'You\u2019ll sign in again each time you open MUSE'}</span></span>
            <input id="keep-signed-in" type="checkbox" role="switch" className="switch" checked={keep}
              onChange={async (e) => { const on = e.target.checked; setKeep(on); await setRememberMe(on); toast(on ? 'MUSE will keep you signed in' : 'MUSE will ask you to sign in next time'); }} />
          </label>
          <button type="button" className="settings-row" onClick={() => { setPwOpen(!pwOpen); setPwMsg(''); }} aria-expanded={pwOpen}>
            <span className="settings-row-icon" aria-hidden="true"><Icon name="edit" size={20} /></span>
            <span className="settings-row-text"><span className="settings-row-title">Change password</span></span>
          </button>
          {pwOpen && (
            <form className="pw-form" onSubmit={changePassword}>
              <label htmlFor="new-pw" className="label-text">New password (8+ characters)</label>
              <input id="new-pw" className="input" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
              {pwMsg && <p className="error" role="alert">{pwMsg}</p>}
              <Btn type="submit" size="sm" disabled={busy}>{busy ? 'Saving…' : 'Save new password'}</Btn>
            </form>
          )}
          <button type="button" className="settings-row" onClick={signOut}>
            <span className="settings-row-icon" aria-hidden="true"><Icon name="back" size={20} /></span>
            <span className="settings-row-text"><span className="settings-row-title">Sign out</span></span>
          </button>
        </div>
      </section>

      <section className="section" aria-labelledby="notif-h">
        <h2 className="section-title" id="notif-h">Notifications</h2>
        <NotificationSettings />
      </section>

      <section className="section" aria-labelledby="you-h">
        <h2 className="section-title" id="you-h">You</h2>
        <div className="you-field">
          <label htmlFor="settings-name" className="label-text">Your name</label>
          <input id="settings-name" className="input" value={name} maxLength={40} placeholder="Your first name"
            onChange={(e) => { setName(e.target.value); saveName(e.target.value); }} />
          <p className="hint">MUSE uses it to greet you on Your Data.</p>
        </div>
      </section>

      <section className="section" aria-labelledby="theme-h">
        <div className="section-head">
          <div>
            <h2 className="section-title" id="theme-h">Theme</h2>
            <p className="muted">Changes the colors across MUSE, including the welcome screen.</p>
          </div>
        </div>
        <div className="theme-grid" role="radiogroup" aria-labelledby="theme-h">
          {THEMES.map((t) => {
            const on = theme === t.id;
            return (
              <button key={t.id} type="button" role="radio" aria-checked={on} className={`theme-card ${on ? 'on' : ''}`} onClick={() => pick(t)}>
                <span className="theme-swatches" aria-hidden="true">{t.colors.map((c) => <span key={c} style={{ background: c }} />)}</span>
                <span className="theme-name">{t.name}</span>
                {on && <span className="theme-check" aria-hidden="true"><Icon name="check" size={16} /></span>}
              </button>
            );
          })}
        </div>
      </section>

      <section className="section" aria-labelledby="look-h">
        <h2 className="section-title" id="look-h">Appearance</h2>
        <div className="seg seg-lg" role="radiogroup" aria-labelledby="look-h">
          {[['system', 'Match iPhone'], ['light', 'Light'], ['dark', 'Dark']].map(([v, l]) => (
            <button key={v} type="button" role="radio" aria-checked={mode === v} className={mode === v ? 'on' : ''} onClick={() => pickMode(v)}>{l}</button>
          ))}
        </div>
        <p className="hint">“Match iPhone” follows your phone's light or dark mode.</p>
      </section>

      <section className="section" aria-labelledby="archive-h">
        <div className="section-head">
          <div>
            <h2 className="section-title" id="archive-h">Archived Lists <span className="count num">{store.archivedOccasions.length}</span></h2>
            <p className="muted">Holiday lists move here the day after their date. They're kept exactly as they were.</p>
          </div>
        </div>
        {store.archivedOccasions.length === 0 ? (
          <div className="empty"><p className="empty-title">Nothing archived yet</p><p className="empty-body">When a holiday list's date passes, it leaves Home and Gifts and waits here, with its items and gifts.</p></div>
        ) : (
          <div className="settings-list">
            {store.archivedOccasions.map((o) => {
              const dt = nextDate(o.date, false);
              const mine = o.productIds.filter((id) => store.byId[id]).length;
              const gifts = store.products.filter((p) => p.kind === 'gift' && p.occasionId === o.id).length;
              return (
                <button key={o.id} type="button" className="settings-row archived-row" style={{ '--cat': o.accent }} onClick={() => go('o-' + o.id)}>
                  <span className="occ-date sm" aria-hidden="true"><span className="occ-mon">{dt.toLocaleDateString('en-US', { month: 'short' })}</span><span className="occ-day num">{dt.getDate()}</span></span>
                  <span className="settings-row-text">
                    <span className="settings-row-title">{o.icon ? o.icon + ' ' : ''}{o.name}</span>
                    <span className="muted num">Ended {fmtDate(dt.getTime())} · {mine} of my item{mine === 1 ? '' : 's'} · {gifts} gift{gifts === 1 ? '' : 's'}</span>
                  </span>
                  <Icon name="arrow" size={18} />
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section className="section" aria-labelledby="data-h">
        <h2 className="section-title" id="data-h">Data &amp; backup</h2>
        <div className="settings-list">
          <button type="button" className="settings-row" onClick={() => go('data')}>
            <span className="settings-row-icon" aria-hidden="true"><Icon name="grid" size={20} /></span>
            <span className="settings-row-text"><span className="settings-row-title">Your Data</span><span className="muted">Spending, brands, sizes and upcoming gifting dates</span></span>
            <Icon name="arrow" size={18} />
          </button>
          <button type="button" className="settings-row" onClick={() => open({ type: 'backup' })}>
            <span className="settings-row-icon" aria-hidden="true"><Icon name="folder" size={20} /></span>
            <span className="settings-row-text"><span className="settings-row-title">Backup &amp; export</span><span className="muted">Save a copy, restore a backup or export a spreadsheet</span></span>
            <Icon name="arrow" size={18} />
          </button>
          <button type="button" className="settings-row" onClick={onReplayWelcome}>
            <span className="settings-row-icon" aria-hidden="true"><Icon name="gift" size={20} /></span>
            <span className="settings-row-text"><span className="settings-row-title">Replay welcome screen</span><span className="muted">Watch the shopping bag animation again</span></span>
            <Icon name="arrow" size={18} />
          </button>
        </div>
        <p className="hint num">In your account: {counts.map(([n, l]) => `${n} ${l}`).join(' · ')}. Everything is saved to your MUSE account and shows up wherever you sign in.</p>
      </section>
      <section className="section" aria-labelledby="about-h">
        <h2 className="section-title" id="about-h">About</h2>
        <div className="settings-list">
          {[['help', 'Help & Support', 'Questions, tips and how to contact us', 'list'], ['privacy', 'Privacy Policy', 'What MUSE saves and where', 'person'], ['terms', 'Terms of Use', 'The rules for using MUSE', 'folder']].map(([r, t, sub, icon]) => (
            <button key={r} type="button" className="settings-row" onClick={() => go(r)}>
              <span className="settings-row-icon" aria-hidden="true"><Icon name={icon} size={20} /></span>
              <span className="settings-row-text"><span className="settings-row-title">{t}</span><span className="muted">{sub}</span></span>
              <Icon name="arrow" size={18} />
            </button>
          ))}
          <button type="button" className="settings-row danger-row" onClick={async () => {
            if (!await confirm({ title: 'Delete your MUSE account?', danger: true, confirmLabel: 'Delete my account',
              body: 'This permanently deletes your account and everything in it: every item, photo, outfit, routine, collection, gift profile and holiday list. It can\'t be undone. Export a backup first if you might want anything.' })) return;
            try {
              await deleteAccount();
              try { Object.keys(localStorage).filter((k) => k.startsWith('muse-')).forEach((k) => localStorage.removeItem(k)); } catch { /* optional */ }
              location.hash = 'home'; location.reload();
            } catch (e) { toast("Couldn't delete your account. " + e.message, 'error'); }
          }}>
            <span className="settings-row-icon" aria-hidden="true"><Icon name="trash" size={20} /></span>
            <span className="settings-row-text"><span className="settings-row-title">Delete my account</span><span className="muted">Permanently erase your account and everything in it</span></span>
          </button>
        </div>
        <p className="hint">MUSE {APP.version} · For ages {APP.minAge}+ · Contact {APP.supportEmail}</p>
      </section>
    </>
  );
}
