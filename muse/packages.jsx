import React from 'react';
import { useStore } from './store.jsx';
import { useNav } from './nav.js';
import { Btn, Icon, Field, Img, Modal, Empty, useUi, useDirty, useGuardedClose } from './ui.jsx';
import { CARRIERS } from './model.js';
import { nextDate, daysUntil, fmtDate } from './util.js';
import { reminderText, trackingUrl, guessCarrier } from './reminder-text.js';
import { notificationStatus, enableNotifications, disableNotifications, sendTestNotification } from './push.js';

const { useState, useEffect } = React;

const daysTo = (iso) => daysUntil(nextDate(iso, false));
const dayName = (iso) => nextDate(iso, false).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

export function arrivalText(k) {
  if (k.delivered) return k.deliveredAt ? `Delivered ${fmtDate(k.deliveredAt)}` : 'Delivered';
  const n = daysTo(k.expectedDate);
  if (n < 0) return `Expected ${dayName(k.expectedDate)} · running late`;
  if (n === 0) return 'Arriving today';
  if (n === 1) return `Arriving tomorrow · ${dayName(k.expectedDate)}`;
  return `Arriving ${dayName(k.expectedDate)} · in ${n} days`;
}
const REMIND = [['before', 'Day before'], ['dayof', 'Morning of'], ['both', 'Both'], ['off', 'Off']];
const REMIND_LABEL = { before: 'Reminder the day before', dayof: 'Reminder that morning', both: 'Reminders the day before and that morning', off: 'No reminder' };

function PackageThumb({ k }) {
  const { byId } = useStore();
  const p = k.productId && byId[k.productId];
  return <span className="pkg-thumb" aria-hidden="true">{p ? <Img imageId={p.imageId} url={p.imageUrl} alt="" fallback={<Icon name="box" size={22} />} /> : <Icon name="box" size={22} />}</span>;
}

// ---------- notifications ----------
const STATUS_TEXT = {
  on: 'On for this device. MUSE sends package reminders here.',
  off: 'Off for this device.',
  install: 'iPhone only sends notifications to apps on the Home Screen. Open MUSE from its Home Screen icon to turn these on.',
  denied: 'Blocked. Turn them on in your iPhone Settings › Notifications › MUSE, then come back.',
  unsupported: "This browser can't show notifications.",
};

/** A gentle nudge shown wherever reminders matter, until notifications are on. */
export function NotifyBanner() {
  const [st, setSt] = useState(null);
  const { toast } = useUi();
  useEffect(() => { notificationStatus().then(setSt).catch(() => setSt('unsupported')); }, []);
  if (!st || st === 'on' || st === 'unsupported') return null;
  const text = {
    off: 'Turn on notifications so MUSE can remind you before your packages arrive.',
    install: 'To get reminders on iPhone, add MUSE to your Home Screen (Safari › Share › Add to Home Screen) and open it from there.',
    denied: 'Notifications are blocked for MUSE. Turn them on in iPhone Settings › Notifications › MUSE.',
  }[st];
  return (
    <div className="notify-banner" role="note">
      <Icon name="bell" size={20} />
      <p>{text}</p>
      {st === 'off' && (
        <Btn size="sm" onClick={async () => {
          try { const s = await enableNotifications(); setSt(s); toast(s === 'on' ? 'Notifications are on' : s === 'denied' ? 'Notifications were blocked' : 'Notifications are still off'); }
          catch (e) { toast(e.message, 'error'); }
        }}>Turn on</Btn>
      )}
    </div>
  );
}

export function NotificationSettings() {
  const [st, setSt] = useState(null);
  const [busy, setBusy] = useState(false);
  const { toast } = useUi();
  useEffect(() => { notificationStatus().then(setSt).catch(() => setSt('unsupported')); }, []);
  const canToggle = st === 'on' || st === 'off';
  return (
    <div className="settings-list">
      <label className={`settings-row ${canToggle ? 'toggle-row' : 'static-row'}`} htmlFor="notif-switch">
        <span className="settings-row-icon" aria-hidden="true"><Icon name="bell" size={20} /></span>
        <span className="settings-row-text"><span className="settings-row-title">Package reminders</span><span className="muted">{st ? STATUS_TEXT[st] : 'Checking…'}</span></span>
        {canToggle && (
          <input id="notif-switch" type="checkbox" role="switch" className="switch" checked={st === 'on'} disabled={busy}
            onChange={async (e) => {
              setBusy(true);
              try { setSt(e.target.checked ? await enableNotifications() : await disableNotifications()); }
              catch (err) { toast(err.message, 'error'); }
              setBusy(false);
            }} />
        )}
      </label>
      {st === 'on' && (
        <button type="button" className="settings-row" disabled={busy} onClick={async () => {
          setBusy(true);
          try { const r = await sendTestNotification(); toast(r.sent ? 'Test sent. It should show up in a few seconds.' : 'No devices to send to yet. Turn reminders off and on again.'); }
          catch (e) { toast(e.message, 'error'); }
          setBusy(false);
        }}>
          <span className="settings-row-icon" aria-hidden="true"><Icon name="check" size={20} /></span>
          <span className="settings-row-text"><span className="settings-row-title">Send a test notification</span><span className="muted">Check that reminders reach this device</span></span>
        </button>
      )}
    </div>
  );
}

// ---------- list ----------
export function PackageRow({ k }) {
  const { actions, byId } = useStore();
  const { open } = useNav();
  const { toast } = useUi();
  const n = daysTo(k.expectedDate);
  const late = !k.delivered && n < 0;
  const track = trackingUrl(k.carrier, k.trackingNumber);
  async function delivered() {
    if (!(await actions.patchDoc('packages', k.id, { delivered: true, deliveredAt: Date.now() }))) return;
    const p = k.productId && byId[k.productId];
    if (p && p.status !== 'purchased' && p.status !== 'given') await actions.patchProduct(p.id, { status: 'purchased' }); // shows the celebration
    else toast(`${k.name} delivered`);
  }
  return (
    <li className={`pkg-row ${late ? 'late' : ''} ${k.delivered ? 'done' : ''}`}>
      <button type="button" className="pkg-main" onClick={() => open({ type: 'package-edit', pkg: k })} aria-label={`Edit ${k.name}`}>
        <PackageThumb k={k} />
        <span className="pkg-text">
          <span className="pkg-name">{k.name}</span>
          {(k.store || k.carrier) && <span className="muted">{[k.store, k.carrier].filter(Boolean).join(' · ')}</span>}
          <span className={`pkg-when ${late ? 'late' : n === 0 && !k.delivered ? 'today' : ''}`}>{arrivalText(k)}</span>
          {!k.delivered && <span className="pkg-remind"><Icon name={k.remind === 'off' ? 'x' : 'bell'} size={14} />{REMIND_LABEL[k.remind]}</span>}
        </span>
      </button>
      <div className="pkg-actions">
        {track && <a className="btn btn-ghost btn-sm" href={track} target="_blank" rel="noopener noreferrer"><Icon name="ext" size={14} />Track</a>}
        {!k.delivered
          ? <Btn size="sm" variant="secondary" icon="check" onClick={delivered}>Delivered</Btn>
          : <Btn size="sm" variant="ghost" onClick={() => actions.patchDoc('packages', k.id, { delivered: false, deliveredAt: null })}>Not delivered</Btn>}
      </div>
    </li>
  );
}

export function PackagesView() {
  const { packages } = useStore();
  const { open } = useNav();
  const active = packages.filter((k) => !k.delivered);
  const delivered = packages.filter((k) => k.delivered).sort((a, b) => (b.deliveredAt || 0) - (a.deliveredAt || 0));
  const groups = [
    ['late', 'Running late', (n) => n < 0], ['today', 'Arriving today', (n) => n === 0], ['tomorrow', 'Tomorrow', (n) => n === 1],
    ['week', 'This week', (n) => n >= 2 && n <= 7], ['later', 'Later', (n) => n > 7],
  ];
  return (
    <section className="section" aria-labelledby="pkg-h">
      <div className="section-head">
        <div>
          <p className="eyebrow">Organize</p>
          <h1 className="page-title" id="pkg-h">Packages</h1>
          <p className="lede">Keep track of what's on the way, and get a reminder before it arrives.</p>
        </div>
        <Btn icon="plus" onClick={() => open({ type: 'package-edit' })}>Add package</Btn>
      </div>
      <NotifyBanner />
      {active.length === 0
        ? <Empty title="Nothing on the way" body="When you order something, add it here with the day it should arrive. MUSE can remind you the day before or that morning."
            action={<Btn variant="secondary" icon="plus" onClick={() => open({ type: 'package-edit' })}>Add package</Btn>} />
        : groups.map(([key, label, test]) => {
          const list = active.filter((k) => test(daysTo(k.expectedDate)));
          return list.length ? (
            <div key={key} className={`pkg-group ${key}`}>
              <h2 className="sub-title">{label} <span className="count num">{list.length}</span></h2>
              <ul className="pkg-list">{list.map((k) => <PackageRow key={k.id} k={k} />)}</ul>
            </div>
          ) : null;
        })}
      {delivered.length > 0 && (
        <details className="pkg-delivered">
          <summary>Delivered <span className="count num">{delivered.length}</span></summary>
          <ul className="pkg-list">{delivered.map((k) => <PackageRow key={k.id} k={k} />)}</ul>
        </details>
      )}
    </section>
  );
}

/** "On the way" summary on Home; hidden when nothing is coming. */
export function PackagesCard() {
  const { packages } = useStore();
  const { go } = useNav();
  const up = packages.filter((k) => !k.delivered).slice(0, 3);
  if (!up.length) return null;
  const more = packages.filter((k) => !k.delivered).length - up.length;
  return (
    <button type="button" className="pkg-card" onClick={() => go('packages')}>
      <span className="data-card-head"><span className="eyebrow">On the way</span><span className="data-card-link">All packages<Icon name="arrow" size={16} /></span></span>
      {up.map((k) => {
        const n = daysTo(k.expectedDate);
        return (
          <span key={k.id} className="pkg-mini">
            <PackageThumb k={k} />
            <span className="pkg-text">
              <span className="pkg-name">{k.name}</span>
              <span className={`pkg-when ${n < 0 ? 'late' : n === 0 ? 'today' : ''}`}>{arrivalText(k)}</span>
            </span>
          </span>
        );
      })}
      {more > 0 && <span className="muted">+ {more} more</span>}
    </button>
  );
}

// ---------- form ----------
const blank = () => ({ id: null, productId: null, name: '', store: '', carrier: '', trackingNumber: '', expectedDate: '', remind: 'before', message: '', notes: '', delivered: false, deliveredAt: null });

export function PackageEditor({ pkg, productId, onClose }) {
  const { products, byId, people, actions } = useStore();
  const from = !pkg && productId ? byId[productId] : null;
  const init = pkg ? { ...pkg } : { ...blank(), productId: from ? from.id : null, name: from ? from.name : '', store: from ? (from.store || from.brand) : '' };
  const [d, setD] = useState(init);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const dirty = useDirty(init, d);
  const close = useGuardedClose(dirty, onClose);
  const set = (k) => (e) => setD({ ...d, [k]: e.target.value });
  const items = products.filter((p) => p.id === d.productId || (p.status !== 'purchased' && p.status !== 'given'))
    .sort((a, b) => a.name.localeCompare(b.name));
  const itemLabel = (p) => p.kind === 'gift' ? `${p.name} (gift for ${people.find((x) => x.id === p.personId)?.name || 'someone'})` : p.name;
  const pickItem = (id) => {
    const p = byId[id];
    setD((prev) => ({ ...prev, productId: id || null, name: prev.name.trim() || !p ? prev.name : p.name, store: prev.store.trim() || !p ? prev.store : (p.store || p.brand) }));
  };
  const track = trackingUrl(d.carrier || guessCarrier(d.trackingNumber), d.trackingNumber);
  const previews = d.remind === 'off' ? [] : d.remind === 'both' ? ['before', 'dayof'] : [d.remind];

  async function save(e) {
    e.preventDefault();
    const er = {};
    if (!d.name.trim()) er.name = "Name this package, like what's inside.";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.expectedDate || '')) er.expectedDate = 'Choose the day it should arrive.';
    setErrors(er);
    if (Object.keys(er).length) return;
    setSaving(true);
    let timezone = 'America/Los_Angeles';
    try { timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || timezone; } catch { /* keep default */ }
    const rec = await actions.savePackage({ ...d, name: d.name.trim(), trackingNumber: d.trackingNumber.trim(), carrier: d.carrier || guessCarrier(d.trackingNumber), timezone });
    if (rec) {
      const p = rec.productId && byId[rec.productId];
      if (p && p.status === 'want') await actions.patchProduct(p.id, { status: 'ordered' });
      onClose();
    }
    setSaving(false);
  }

  return (
    <Modal title={pkg ? 'Edit package' : 'Add package'} onClose={close} size="md"
      footer={<>
        {pkg && <Btn variant="ghost" icon="trash" className="danger-text" onClick={async () => { if (await actions.deleteDoc('packages', pkg.id)) onClose(); }}>Delete</Btn>}
        <span className="spacer" />
        <Btn variant="secondary" onClick={close}>Cancel</Btn>
        <Btn type="submit" form="pkg-form" disabled={saving}>{saving ? 'Saving…' : pkg ? 'Save package' : 'Add package'}</Btn>
      </>}>
      <form id="pkg-form" className="form-grid" onSubmit={save} noValidate>
        {items.length > 0 && (
          <Field label="For an item on your lists (optional)" full>
            <select className="input select" value={d.productId || ''} onChange={(e) => pickItem(e.target.value)}>
              <option value="">Not linked to an item</option>
              {items.map((p) => <option key={p.id} value={p.id}>{itemLabel(p)}</option>)}
            </select>
          </Field>
        )}
        <Field label="What's coming? *" error={errors.name} full><input className="input" value={d.name} onChange={set('name')} placeholder="Linen midi skirt" /></Field>
        <Field label="Store"><input className="input" value={d.store} onChange={set('store')} placeholder="Reformation" /></Field>
        <Field label="Arrives on *" error={errors.expectedDate}><input className="input" type="date" value={d.expectedDate} onChange={set('expectedDate')} /></Field>
        <Field label="Tracking number"><input className="input" value={d.trackingNumber} autoCapitalize="characters" autoCorrect="off" spellCheck={false}
          onChange={(e) => { const t = e.target.value; setD((v) => { const was = guessCarrier(v.trackingNumber); const auto = !v.carrier || v.carrier === was; return { ...v, trackingNumber: t, carrier: auto ? (guessCarrier(t) || (v.carrier === was ? '' : v.carrier)) : v.carrier }; }); }} /></Field>
        <Field label="Carrier">
          <select className="input select" value={d.carrier} onChange={set('carrier')}>
            <option value="">Choose a carrier</option>
            {CARRIERS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        {track && <p className="full"><a className="link-btn" href={track} target="_blank" rel="noopener noreferrer">Open {d.carrier || guessCarrier(d.trackingNumber)} tracking</a></p>}

        <fieldset className="field full remind-field">
          <legend>Remind me</legend>
          <div className="seg seg-lg" role="radiogroup" aria-label="Remind me">
            {REMIND.map(([v, l]) => <button key={v} type="button" role="radio" aria-checked={d.remind === v} className={d.remind === v ? 'on' : ''} onClick={() => setD({ ...d, remind: v })}>{l}</button>)}
          </div>
          <p className="hint">Reminders go out once each morning, around 9 AM Pacific time.</p>
        </fieldset>
        {d.remind !== 'off' && (
          <>
            <Field label="Your reminder message" hint="Make it yours, or leave it blank for the standard message." full>
              <input className="input" value={d.message} maxLength={180} onChange={set('message')} placeholder={reminderText(d, 'before').body} />
            </Field>
            <div className="full notif-previews" aria-label="Reminder preview">
              {previews.map((kind) => {
                const t = reminderText(d, kind);
                return (
                  <div key={kind} className="notif-preview">
                    <img src="/icons/icon-192.png" alt="" width="38" height="38" />
                    <div className="notif-text">
                      <p className="notif-top"><span>MUSE</span><span>{kind === 'dayof' ? 'that morning' : 'the day before'}</span></p>
                      <p className="notif-title">{t.title}</p>
                      <p className="notif-body">{t.body}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="full"><NotifyBanner /></div>
          </>
        )}
        <Field label="Notes" full><textarea className="input" rows="2" value={d.notes} onChange={set('notes')} placeholder="Order number, size ordered, return window…" /></Field>
      </form>
    </Modal>
  );
}
