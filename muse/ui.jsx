import React from 'react';
import { imageUrl } from './db.js';

const { createContext, useContext, useEffect, useRef, useState, useCallback, useId } = React;

// ---------- icons ----------
const P = {
  plus: 'M12 5v14M5 12h14',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
  x: 'M6 6l12 12M18 6L6 18',
  heart: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z',
  edit: 'M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4',
  trash: 'M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13',
  up: 'M12 19V5M6 11l6-6 6 6',
  down: 'M12 5v14M6 13l6 6 6-6',
  ext: 'M14 5h5v5M19 5l-8 8M18 14v5H5V6h5',
  copy: 'M9 9h10v10H9zM5 15V5h10',
  gear: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM4 12h2M18 12h2M12 4v2M12 18v2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M6.3 17.7l1.4-1.4M16.3 7.7l1.4-1.4',
  image: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15 9h.01',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  back: 'M19 12H5M11 6l-6 6 6 6',
  check: 'M5 12l5 5 9-10',
  home: 'M4 11l8-7 8 7v9h-5v-6H9v6H4z',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  gift: 'M4 11h16v9H4zM3 7h18v4H3zM12 7v13M12 7C10.5 4 7 3.5 7 5.5S10 7 12 7zM12 7c1.5-3 5-3.5 5-1.5S14 7 12 7z',
  shirt: 'M8 4L4 7l2 4 2-1v10h8V10l2 1 2-4-4-3c-1 1.5-2.2 2-4 2s-3-.5-4-2z',
  lipstick: 'M8 21h8v-8H8zM10 13V7l4-3v9',
  list: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01',
  folder: 'M3 6h7l2 2h9v11H3z',
  person: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 4-6 8-6s8 2 8 6',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  box: 'M3 7.5l9-4.5 9 4.5v9L12 21l-9-4.5zM3 7.5l9 4.5 9-4.5M12 12v9M7.5 5.2l9 4.6',
  bell: 'M6 16v-5a6 6 0 1 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0',
};
export function Icon({ name, size = 18, filled }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false"
      fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d={P[name]} />
    </svg>
  );
}

export function Btn({ variant = 'primary', size, icon, children, className = '', ...rest }) {
  return (
    <button type="button" className={`btn btn-${variant} ${size === 'sm' ? 'btn-sm' : ''} ${className}`} {...rest}>
      {icon && <Icon name={icon} size={16} />}{children}
    </button>
  );
}
export function IconBtn({ label, icon, filled, className = '', ...rest }) {
  return (
    <button type="button" className={`icon-btn ${className}`} aria-label={label} title={label} {...rest}>
      <Icon name={icon} filled={filled} />
    </button>
  );
}

// ---------- form fields ----------
export function Field({ label, error, hint, children, full }) {
  const id = useId();
  const child = React.cloneElement(children, { id, 'aria-invalid': error ? 'true' : undefined, 'aria-describedby': error ? id + '-err' : undefined });
  return (
    <div className={`field ${full ? 'full' : ''}`}>
      <label htmlFor={id}>{label}</label>
      {child}
      {hint && !error && <p className="hint">{hint}</p>}
      {error && <p className="error" id={id + '-err'}>{error}</p>}
    </div>
  );
}

// ---------- images ----------
export function Img({ imageId, url, alt = '', className = '', fallback }) {
  const [src, setSrc] = useState(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true; setFailed(false);
    if (imageId) imageUrl(imageId).then((u) => { if (live) { if (u) setSrc(u); else if (url) setSrc(url); else setFailed(true); } }).catch(() => live && (url ? setSrc(url) : setFailed(true)));
    else if (url) setSrc(url);
    else setSrc(null);
    return () => { live = false; };
  }, [imageId, url]);
  if (!src || failed) return <div className={`img-ph ${className}`} aria-hidden={!alt}>{fallback || <Icon name="image" size={22} />}</div>;
  return <img className={className} src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} />;
}

/** Picker for an uploaded file or a pasted URL. value = {file, keep, url, imageId} */
export function ImageInput({ value, onChange, allowUrl = true, label = 'Image' }) {
  const [err, setErr] = useState('');
  const [preview, setPreview] = useState(null);
  useEffect(() => {
    if (!value.file) { setPreview(null); return; }
    const u = URL.createObjectURL(value.file); setPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [value.file]);
  const inputId = useId();
  function pick(e) {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    if (!f.type.startsWith('image/')) { setErr('Choose an image file (JPG, PNG, WebP, GIF).'); return; }
    if (f.size > 15 * 1024 * 1024) { setErr('That image is over 15 MB. Choose a smaller one.'); return; }
    setErr(''); onChange({ ...value, file: f, keep: false });
  }
  const hasStored = value.keep && value.imageId;
  return (
    <div className="field full">
      <span className="label-text">{label}</span>
      <div className="image-input">
        <div className="image-input-preview">
          {preview ? <img src={preview} alt="New upload preview" />
            : hasStored ? <Img imageId={value.imageId} alt="Current image" />
            : value.url ? <Img url={value.url} alt="Image from link" />
            : <div className="img-ph"><Icon name="image" size={22} /></div>}
        </div>
        <div className="image-input-actions">
          <label className="btn btn-secondary btn-sm file-btn" htmlFor={inputId}>
            <Icon name="image" size={16} />{preview || hasStored ? 'Replace photo' : 'Upload photo'}
          </label>
          <input id={inputId} type="file" accept="image/*" className="sr-only" onChange={pick} />
          {(preview || hasStored) && <Btn variant="ghost" size="sm" onClick={() => onChange({ ...value, file: null, keep: false })}>Remove photo</Btn>}
          {allowUrl && (
            <input type="url" className="input" placeholder="…or paste an image link (https://)" aria-label="Image link"
              value={value.url || ''} onChange={(e) => onChange({ ...value, url: e.target.value })} />
          )}
          <p className="hint">Uploads are kept on this device. A pasted link shows the image while the website still hosts it.</p>
          {err && <p className="error" role="alert">{err}</p>}
        </div>
      </div>
    </div>
  );
}

// ---------- modal ----------
export function Modal({ title, onClose, children, footer, size = 'md', labelledBy }) {
  const ref = useRef(null);
  const openedAt = useRef(Date.now());
  const titleId = useId();
  useEffect(() => {
    const prev = document.activeElement;
    const el = ref.current;
    const first = el && el.querySelector('input, select, textarea, button:not(.modal-close)');
    (first || el)?.focus();
    function onKey(e) {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
      if (e.key === 'Tab' && el) {
        const f = [...el.querySelectorAll('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter((x) => x.offsetParent !== null);
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    }
    el.addEventListener('keydown', onKey);
    document.body.classList.add('modal-open');
    return () => { el.removeEventListener('keydown', onKey); document.body.classList.remove('modal-open'); prev && prev.focus && prev.focus(); };
  }, []);
  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget && Date.now() - openedAt.current > 450) onClose(); }}>
      <div className={`modal modal-${size}`} role="dialog" aria-modal="true" aria-labelledby={labelledBy || titleId} ref={ref} tabIndex={-1}>
        <header className="modal-head">
          <h2 id={titleId} className="modal-title">{title}</h2>
          <IconBtn label="Close" icon="x" className="modal-close" onClick={onClose} />
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>
  );
}

// ---------- confirm dialogs + toasts ----------
const UiCtx = createContext(null);
export const useUi = () => useContext(UiCtx);

export function UiProvider({ children }) {
  const [confirmState, setConfirmState] = useState(null);
  const [toasts, setToasts] = useState([]);
  const confirm = useCallback((opts) => new Promise((resolve) => setConfirmState({ ...opts, resolve })), []);
  const [party, setParty] = useState(null);
  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  /** toast(message, kind, action?) — action = { label, onClick } adds a button (used for Undo). */
  const toast = useCallback((msg, kind = 'info', action) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t.slice(-2), { id, msg, kind, action }]);
    setTimeout(() => dismiss(id), action ? 7000 : kind === 'error' ? 6000 : 3000);
  }, [dismiss]);
  /** A short confetti moment, e.g. when something on the wishlist gets bought. */
  const celebrate = useCallback((title, sub) => setParty({ id: Date.now(), title, sub }), []);
  const close = (v) => { confirmState.resolve(v); setConfirmState(null); };
  return (
    <UiCtx.Provider value={{ confirm, toast, celebrate }}>
      {children}
      {confirmState && (
        <Modal title={confirmState.title} onClose={() => close(false)} size="sm"
          footer={<>
            <Btn variant="secondary" onClick={() => close(false)}>{confirmState.cancelLabel || 'Cancel'}</Btn>
            <Btn variant={confirmState.danger ? 'danger' : 'primary'} onClick={() => close(true)}>{confirmState.confirmLabel || 'Confirm'}</Btn>
          </>}>
          <p className="confirm-body">{confirmState.body}</p>
        </Modal>
      )}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind} ${t.action ? 'has-action' : ''}`}>
            <span>{t.msg}</span>
            {t.action && <button type="button" className="toast-action" onClick={() => { dismiss(t.id); t.action.onClick(); }}>{t.action.label}</button>}
          </div>
        ))}
      </div>
      {party && <Celebration key={party.id} title={party.title} sub={party.sub} onDone={() => setParty(null)} />}
    </UiCtx.Provider>
  );
}

export function Empty({ title, body, action }) {
  return (
    <div className="empty">
      <p className="empty-title">{title}</p>
      <p className="empty-body">{body}</p>
      {action}
    </div>
  );
}

export function Chip({ tone = 'plain', children }) { return <span className={`chip chip-${tone}`}>{children}</span>; }

/** Tracks whether an editor has unsaved changes and warns before leaving the page. */
export function useDirty(initial, current) {
  const base = useRef(JSON.stringify(initial));
  const dirty = JSON.stringify(current) !== base.current;
  useEffect(() => {
    if (!dirty) return;
    const h = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);
  return dirty;
}

export function useGuardedClose(dirty, onClose) {
  const { confirm } = useUi();
  return async () => {
    if (!dirty || await confirm({ title: 'Discard changes?', body: 'You have unsaved changes in this form. Leaving now will lose them.', confirmLabel: 'Discard changes', cancelLabel: 'Keep editing', danger: true })) onClose();
  };
}

/** Confetti in the theme's colors with a little message; skips the motion when reduced motion is on. */
function Celebration({ title, sub, onDone }) {
  const canvas = useRef(null);
  useEffect(() => {
    const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const done = setTimeout(onDone, reduce ? 1800 : 2300);
    if (reduce || !canvas.current) return () => clearTimeout(done);
    const c = canvas.current, ctx = c.getContext('2d');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = c.width = innerWidth * dpr, H = c.height = innerHeight * dpr;
    const css = getComputedStyle(document.documentElement);
    const colors = ['--coral', '--salmon', '--apricot', '--peach', '--cream'].map((v) => css.getPropertyValue(v).trim() || '#F08080');
    const bits = Array.from({ length: 90 }, (_, i) => ({
      x: W / 2 + (Math.random() - 0.5) * W * 0.2, y: H * 0.42,
      vx: (Math.random() - 0.5) * 16 * dpr, vy: (-6 - Math.random() * 12) * dpr,
      r: (4 + Math.random() * 5) * dpr, a: Math.random() * 6.28, va: (Math.random() - 0.5) * 0.3,
      color: colors[i % colors.length], shape: i % 3,
    }));
    let raf, t0 = performance.now();
    const tick = (t) => {
      const k = Math.min(2, (t - t0) / 16.7); t0 = t;
      ctx.clearRect(0, 0, W, H);
      bits.forEach((b) => {
        b.vy += 0.45 * dpr * k; b.vx *= 0.99; b.x += b.vx * k; b.y += b.vy * k; b.a += b.va * k;
        ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.a); ctx.fillStyle = b.color;
        if (b.shape === 0) { ctx.beginPath(); ctx.arc(0, 0, b.r * 0.7, 0, 6.29); ctx.fill(); }
        else if (b.shape === 1) ctx.fillRect(-b.r, -b.r * 0.45, b.r * 2, b.r * 0.9);
        else { ctx.beginPath(); ctx.moveTo(0, -b.r); ctx.lineTo(b.r * 0.35, -b.r * 0.35); ctx.lineTo(b.r, 0); ctx.lineTo(b.r * 0.35, b.r * 0.35); ctx.lineTo(0, b.r); ctx.lineTo(-b.r * 0.35, b.r * 0.35); ctx.lineTo(-b.r, 0); ctx.lineTo(-b.r * 0.35, -b.r * 0.35); ctx.fill(); }
        ctx.restore();
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); clearTimeout(done); };
  }, []);
  return (
    <div className="party" aria-live="polite" onClick={onDone}>
      <canvas ref={canvas} className="party-canvas" aria-hidden="true" />
      <div className="party-card"><p className="party-title">{title}</p>{sub && <p className="party-sub">{sub}</p>}</div>
    </div>
  );
}
