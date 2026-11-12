import React from 'react';
import { useStore } from './store.jsx';
import { getAll } from './db.js';
import { normalizeAll } from './model.js';
import { Btn, Modal, useUi } from './ui.jsx';
import { csvCell, blobToDataURL, dataURLToBlob, fmtDate, label, statusList, PRIORITY } from './util.js';

const { useState } = React;

let dlPromise = null;
function getDownloads() {
  if (!window.claude || typeof window.claude.use !== 'function') return Promise.resolve(null);
  if (!dlPromise) dlPromise = window.claude.use('downloads').catch(() => null);
  return dlPromise;
}

/** Offers a file through the viewer's save prompt; falls back to a normal browser download outside claude.ai. */
async function saveFile(filename, text, mime) {
  const dl = await getDownloads();
  if (dl) {
    try { await dl.save({ filename, data: text }); return 'saved'; }
    catch (e) { if (e && e.code === 'declined') return 'declined'; if (!['unavailable', 'not_granted', 'capability_disabled', 'capability_removed'].includes(e?.code)) throw new Error(e?.message || 'Could not save the file.'); }
  }
  // Installed phone app: hand the file to the share sheet (Save to Files, AirDrop, email…)
  const standalone = window.matchMedia && matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (standalone && navigator.canShare) {
    const file = new File([text], filename, { type: mime });
    if (navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: filename }); return 'saved'; }
      catch (e) { if (e && e.name === 'AbortError') return 'declined'; }
    }
  }
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return 'fallback';
}

/** Restored records always get fresh ids (swapped everywhere they're referenced), so a backup never collides with records that already exist, in this account or any other. */
function remapIds(data, images) {
  const map = new Map();
  const fix = (id) => { if (!id || id === 'birthday') return id; if (!map.has(id)) map.set(id, crypto.randomUUID()); return map.get(id); };
  ['products', 'categories', 'people', 'occasions', 'outfits', 'routines'].forEach((k) => data[k].forEach((r) => { r.id = fix(r.id); }));
  data.products.forEach((p) => { p.categoryId = fix(p.categoryId); p.personId = fix(p.personId); p.occasionId = fix(p.occasionId); p.imageId = fix(p.imageId); });
  data.categories.forEach((c) => { c.coverImageId = fix(c.coverImageId); });
  data.people.forEach((p) => { p.coverImageId = fix(p.coverImageId); p.eventIds = p.eventIds.map(fix); });
  data.occasions.forEach((o) => { o.coverImageId = fix(o.coverImageId); o.productIds = o.productIds.map(fix); });
  data.outfits.forEach((o) => { o.coverImageId = fix(o.coverImageId); o.pieces.forEach((x) => { x.id = fix(x.id); x.productId = fix(x.productId); }); });
  data.routines.forEach((r) => { r.coverImageId = fix(r.coverImageId); r.steps.forEach((s) => { s.id = fix(s.id); s.productId = fix(s.productId); }); });
  (data.packages || []).forEach((k) => { k.id = fix(k.id); k.productId = fix(k.productId); });
  images.forEach((im) => { im.id = fix(im.id); });
}

const stamp = () => new Date().toISOString().slice(0, 10);

export function BackupPanel({ onClose }) {
  const store = useStore();
  const { confirm, toast } = useUi();
  const [busy, setBusy] = useState('');
  const [pending, setPending] = useState(null); // parsed import awaiting a choice
  const [importErr, setImportErr] = useState('');
  const [copyText, setCopyText] = useState('');

  async function exportJSON() {
    setBusy('json');
    try {
      const imgs = await getAll('images');
      const images = [];
      for (const r of imgs) if (r.blob instanceof Blob) images.push({ id: r.id, type: r.blob.type, data: await blobToDataURL(r.blob) });
      const payload = { app: 'MUSE', version: 1, exportedAt: new Date().toISOString(), products: store.products, categories: store.categories, outfits: store.outfits, routines: store.routines, people: store.people, occasions: store.allOccasions, packages: store.packages, images };
      const text = JSON.stringify(payload);
      const r = await saveFile(`muse-backup-${stamp()}.json`, text, 'application/json');
      if (r === 'saved') toast('Backup saved');
      if (r === 'fallback') { toast('Backup downloaded'); setCopyText(text.length < 2_000_000 ? text : ''); }
    } catch (e) { toast("Couldn't export: " + e.message, 'error'); }
    setBusy('');
  }

  async function exportCSV() {
    setBusy('csv');
    try {
      const cols = ['ID', 'Collection', 'Holiday lists', 'Name', 'Brand', 'Store', 'Product URL', 'Price', 'Size', 'Color', 'Product type', 'Shade name', 'Shade number', 'Priority', 'Status', 'Favorite', 'Notes', 'Image link', 'Date added', 'Last updated'];
      const catName = (p) => (p.kind === 'clothing' ? 'Clothes' : p.kind === 'makeup' ? 'Makeup' : p.kind === 'gift' ? 'Gift for ' + (store.people.find((x) => x.id === p.personId)?.name || '') : store.categories.find((c) => c.id === p.categoryId)?.name || '');
      const lists = (p) => (p.kind === 'gift' && p.occasionId === 'birthday' ? 'Birthday' : (p.kind === 'gift' ? store.allOccasions.filter((o) => o.id === p.occasionId) : store.allOccasions.filter((o) => o.productIds.includes(p.id))).map((o) => o.name).join('; '));
      const rows = store.products.map((p) => [p.id, catName(p), lists(p), p.name, p.brand, p.store, p.url, p.price == null ? '' : p.price.toFixed(2), p.size, p.color, p.productType, p.shadeName, p.shadeNumber,
        label(PRIORITY, p.priority), label(statusList(p.kind), p.status), p.favorite ? 'Yes' : 'No', p.notes, p.imageUrl, new Date(p.createdAt).toISOString(), new Date(p.updatedAt).toISOString()]);
      const text = '﻿' + [cols, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
      const r = await saveFile(`muse-wishlist-${stamp()}.csv`, text, 'text/csv');
      if (r === 'saved') toast('CSV saved'); if (r === 'fallback') toast('CSV downloaded');
    } catch (e) { toast("Couldn't export: " + e.message, 'error'); }
    setBusy('');
  }

  async function readImport(e) {
    const f = e.target.files && e.target.files[0]; e.target.value = '';
    setImportErr(''); setPending(null);
    if (!f) return;
    try {
      const raw = JSON.parse(await f.text());
      if (!raw || raw.app !== 'MUSE' || !Array.isArray(raw.products)) throw new Error('This file is not a MUSE backup.');
      const { data, invalid } = normalizeAll(raw);
      const images = [];
      let badImages = 0;
      for (const im of Array.isArray(raw.images) ? raw.images : []) {
        const blob = im && typeof im.id === 'string' ? dataURLToBlob(im.data) : null;
        if (blob && blob.type.startsWith('image/')) images.push({ id: im.id, blob, type: blob.type, createdAt: Date.now() }); else badImages++;
      }
      remapIds(data, images);
      setPending({ name: f.name, data, images, invalid: invalid + badImages, exportedAt: raw.exportedAt });
    } catch (err) { setImportErr(err instanceof SyntaxError ? 'That file is not valid JSON.' : err.message); }
  }

  async function applyImport(mode) {
    const p = pending;
    const ok = await confirm({
      title: mode === 'replace' ? 'Replace all MUSE data?' : 'Add this backup to your account?', danger: mode === 'replace',
      confirmLabel: mode === 'replace' ? 'Replace everything' : 'Add to my account',
      body: mode === 'replace' ? 'Everything currently saved in your MUSE account will be deleted and replaced with the backup. This can\'t be undone.'
        : 'Everything in the backup is added to your account alongside what\'s already here. Restoring the same backup twice adds it twice.',
    });
    if (!ok) return;
    setBusy('import');
    if (await store.actions.importAll(p.data, p.images, mode)) { toast('Backup restored'); setPending(null); }
    setBusy('');
  }

  async function clearAll() {
    if (await confirm({ title: 'Delete everything in your account?', danger: true, confirmLabel: 'Delete everything', body: 'Every item, gift profile, holiday list, outfit, routine, collection and photo in your account will be removed. Your account stays open. Export a backup first if you want to keep anything.' }))
      if (await store.actions.clearAll()) toast('All data deleted');
  }

  const n = (k) => store[k].length;
  return (
    <Modal title="Backup & export" onClose={onClose} size="md">
      <div className="backup">
        <p className="hint">Everything is saved to your MUSE account, so it shows up wherever you sign in. Export a backup to keep your own copy. To bring in what you saved in the earlier, on-device version of MUSE, export a backup there and restore it here.</p>
        <p className="muted num">In your account: {n('products')} items · {n('outfits')} outfits · {n('routines')} routines · {n('categories')} collections · {n('people')} gift profiles · {store.allOccasions.length} holiday lists</p>
        <div className="backup-block">
          <h3 className="sub-title">Export</h3>
          <div className="row-actions">
            <Btn onClick={exportJSON} disabled={!!busy}>{busy === 'json' ? 'Preparing…' : 'Export full backup (.json)'}</Btn>
            <Btn variant="secondary" onClick={exportCSV} disabled={!!busy || !n('products')}>{busy === 'csv' ? 'Preparing…' : 'Export wishlist (.csv)'}</Btn>
          </div>
          <p className="hint">The backup includes uploaded photos. The CSV lists every wishlist item for spreadsheets.</p>
          {copyText && (
            <details className="copy-fallback"><summary>Download didn't start?</summary>
              <p className="hint">Copy the backup text and save it as a .json file.</p>
              <Btn variant="secondary" size="sm" onClick={async (e) => { try { await navigator.clipboard.writeText(copyText); toast('Copied'); } catch { const t = e.currentTarget.parentElement.querySelector('textarea'); t.select(); } }}>Copy backup text</Btn>
              <textarea className="input" rows="3" readOnly value={copyText} aria-label="Backup text" />
            </details>
          )}
        </div>
        <div className="backup-block">
          <h3 className="sub-title">Restore</h3>
          <label className="btn btn-secondary file-btn" htmlFor="import-file">Choose backup file…</label>
          <input id="import-file" type="file" accept="application/json,.json" className="sr-only" onChange={readImport} />
          {importErr && <p className="error" role="alert">{importErr}</p>}
          {pending && (
            <div className="import-summary" role="region" aria-label="Backup contents">
              <p><strong>{pending.name}</strong>{pending.exportedAt ? ` · exported ${fmtDate(Date.parse(pending.exportedAt))}` : ''}</p>
              <p className="num">{pending.data.products.length} items · {pending.data.outfits.length} outfits · {pending.data.routines.length} routines · {pending.data.categories.length} collections · {pending.data.people.length} gift profiles · {pending.data.occasions.length} holiday lists · {pending.images.length} photos</p>
              {pending.invalid > 0 && <p className="hint">{pending.invalid} damaged record{pending.invalid > 1 ? 's' : ''} will be skipped.</p>}
              <div className="row-actions">
                <Btn variant="secondary" onClick={() => applyImport('merge')} disabled={!!busy}>Add to my account</Btn>
                <Btn variant="danger" onClick={() => applyImport('replace')} disabled={!!busy}>Replace current data</Btn>
              </div>
            </div>
          )}
        </div>
        <div className="backup-block">
          <h3 className="sub-title">Start over</h3>
          <Btn variant="ghost" className="danger-text" onClick={clearAll}>Delete everything in my account</Btn>
        </div>
      </div>
    </Modal>
  );
}
