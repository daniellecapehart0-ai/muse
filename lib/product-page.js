// Reads the product details a store publishes on its page (the same info used for link previews and
// shopping search results): schema.org Product data and Open Graph / product meta tags.
// Server-only. Fetches are guarded so the endpoint can't be used to reach private networks.
import { lookup } from 'node:dns/promises';
import net from 'node:net';

const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

// ---------- safe fetching ----------
function privateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const s = ip.toLowerCase();
  return s === '::1' || s === '::' || s.startsWith('fc') || s.startsWith('fd') || s.startsWith('fe80') || s.startsWith('::ffff:') && privateIp(s.slice(7));
}
async function assertPublic(u) {
  if (!['http:', 'https:'].includes(u.protocol)) throw new UserError('That link needs to start with https://');
  if (u.port && !['80', '443'].includes(u.port)) throw new UserError("MUSE can't open that link.");
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) throw new UserError("MUSE can't open that link.");
  const addrs = net.isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => { throw new UserError("That website couldn't be found. Check the link."); });
  if (!addrs.length || addrs.some((a) => privateIp(a.address))) throw new UserError("MUSE can't open that link.");
}
export class UserError extends Error {}

/** Fetch with a time limit, a size limit, and every redirect re-checked. */
export async function safeFetch(rawUrl, { accept, maxBytes, timeoutMs = 9000 }) {
  let url = new URL(rawUrl);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    for (let hop = 0; hop < 5; hop++) {
      await assertPublic(url);
      const res = await fetch(url, { redirect: 'manual', signal: ctrl.signal, headers: { 'User-Agent': UA, Accept: accept, 'Accept-Language': 'en-US,en;q=0.9' } });
      if (res.status >= 300 && res.status < 400 && res.headers.get('location')) { url = new URL(res.headers.get('location'), url); continue; }
      if (!res.ok) throw new UserError(res.status === 403 || res.status === 429 ? 'blocked' : `That page returned an error (${res.status}).`);
      const reader = res.body.getReader();
      const chunks = []; let size = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > maxBytes) { ctrl.abort(); break; }
        chunks.push(value);
      }
      return { url: url.toString(), type: res.headers.get('content-type') || '', bytes: Buffer.concat(chunks.map((c) => Buffer.from(c))) };
    }
    throw new UserError('That link redirects too many times.');
  } catch (e) {
    if (e.name === 'AbortError') throw new UserError('That page took too long to respond.');
    throw e;
  } finally { clearTimeout(timer); }
}

// ---------- parsing ----------
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', reg: '®', trade: '™', copy: '©', eacute: 'é', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“' };
const decode = (s) => String(s ?? '').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
  if (e[0] === '#') { const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) ? String.fromCodePoint(n) : m; }
  return ENT[e.toLowerCase()] ?? m;
}).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

function attrs(tag) {
  const out = {};
  tag.replace(/([a-zA-Z:_-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g, (_, k, __, a, b, c) => { out[k.toLowerCase()] = a ?? b ?? c ?? ''; return ''; });
  return out;
}

function metaTags(html) {
  const map = {};
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const a = attrs(m[0]);
    const key = (a.property || a.name || a.itemprop || '').toLowerCase();
    if (key && a.content != null && !(key in map)) map[key] = decode(a.content);
  }
  return map;
}

function jsonLdNodes(html) {
  const nodes = [];
  const walk = (v) => {
    if (!v || typeof v !== 'object') return;
    if (Array.isArray(v)) { v.forEach(walk); return; }
    nodes.push(v);
    if (v['@graph']) walk(v['@graph']);
    if (v.mainEntity) walk(v.mainEntity);
    if (v.itemListElement) walk(v.itemListElement);
    if (v.item) walk(v.item);
  };
  for (const m of html.matchAll(/<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi)) {
    const raw = m[1].trim().replace(/^<!--|-->$/g, '').replace(/^\s*\/\*[\s\S]*?\*\//, '');
    try { walk(JSON.parse(raw)); } catch { try { walk(JSON.parse(raw.replace(/[\u0000-\u001f]+/g, ' '))); } catch { /* skip broken block */ } }
  }
  return nodes;
}
const isType = (n, t) => [].concat(n['@type'] || []).some((x) => String(x).toLowerCase() === t);

const first = (...vals) => vals.find((v) => v != null && String(v).trim() !== '');
const textOf = (v) => (v == null ? '' : typeof v === 'string' ? decode(v) : Array.isArray(v) ? textOf(v[0]) : typeof v === 'object' ? textOf(v.name || v['@value'] || '') : String(v));
const imageOf = (v) => (!v ? '' : typeof v === 'string' ? v : Array.isArray(v) ? imageOf(v[0]) : v.url || v.contentUrl || (v['@id'] && /^https?:/.test(v['@id']) ? v['@id'] : ''));
function priceOf(offers) {
  const list = [].concat(offers || []).flatMap((o) => (o && o.offers ? [].concat(o.offers) : [o])).filter(Boolean);
  for (const o of list) {
    const p = first(o.price, o.lowPrice, o.priceSpecification && [].concat(o.priceSpecification)[0]?.price);
    if (p != null) return { price: p, currency: first(o.priceCurrency, o.priceSpecification && [].concat(o.priceSpecification)[0]?.priceCurrency) };
  }
  return null;
}
function money(v) {
  if (v == null) return null;
  const n = Number(String(v).replace(/[^0-9.,]/g, '').replace(/,(?=\d{3}\b)/g, '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 && n < 1e6 ? Math.round(n * 100) / 100 : null;
}
function storeFromHost(host) {
  const parts = host.replace(/^www\d?\./, '').split('.');
  const core = parts.length > 2 && parts[parts.length - 2].length <= 3 ? parts[parts.length - 3] : parts[parts.length - 2] || parts[0];
  return core ? core.charAt(0).toUpperCase() + core.slice(1) : '';
}
function cleanTitle(title, store) {
  let t = title;
  const seps = [' | ', ' – ', ' — ', ' - ', ' :: '];
  for (const s of seps) {
    if (t.includes(s)) {
      const bits = t.split(s);
      const tail = bits.slice(1).join(s).toLowerCase();
      if (!store || tail.includes(store.toLowerCase().slice(0, 5)) || bits[0].length > 8) { t = bits[0]; break; }
    }
  }
  return t.trim();
}
const absolute = (src, base) => { if (!src) return ''; try { return new URL(src.startsWith('//') ? 'https:' + src : src, base).toString(); } catch { return ''; } };

/** Pull product details out of a store page's HTML. Returns only what the page actually states. */
export function parseProductPage(html, pageUrl) {
  const meta = metaTags(html);
  const nodes = jsonLdNodes(html);
  const product = nodes.find((n) => isType(n, 'product')) || nodes.find((n) => isType(n, 'productgroup')) || null;
  const variant = product && product.hasVariant ? [].concat(product.hasVariant)[0] : null;
  const host = new URL(pageUrl).hostname;
  const store = first(meta['og:site_name'], meta['application-name'], storeFromHost(host)) || '';

  const name = first(textOf(product?.name), variant && textOf(variant.name), meta['og:title'] && cleanTitle(meta['og:title'], store), meta['twitter:title'] && cleanTitle(meta['twitter:title'], store),
    (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] && cleanTitle(decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)[1]), store)) || '';
  const brand = first(textOf(product?.brand), textOf(product?.manufacturer), meta['product:brand'], meta['og:brand'], meta.brand) || '';

  const offer = priceOf(product?.offers) || (variant && priceOf(variant.offers));
  const priceRaw = first(offer?.price, meta['product:price:amount'], meta['og:price:amount'], meta.price, meta['twitter:data1']);
  const currency = (first(offer?.currency, meta['product:price:currency'], meta['og:price:currency'], meta.pricecurrency) || '').toUpperCase() || null;

  // first real photo: skip "no image" placeholders, logos and tracking pixels
  const imageCandidates = [meta['og:image:secure_url'], meta['og:image'], imageOf(product?.image), variant && imageOf(variant.image), meta['og:image:url'], meta['twitter:image'], meta['twitter:image:src']]
    .map((s) => absolute(s, pageUrl)).filter((s) => s && !/no-image|placeholder|blank\.|spacer|pixel|logo|favicon/i.test(s));
  const image = imageCandidates[0] || '';
  let color = first(textOf(product?.color), variant && textOf(variant.color), meta['product:color']) || '';
  // names like "Shrunken Cardigan | Cocoa" carry the color after the bar
  let cleanName = name.replace(new RegExp('^' + store.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(\\.com)?\\s*:\\s*', 'i'), '');
  const bar = cleanName.match(/^(.*\S)\s+\|\s+([^|]{2,30})$/);
  if (bar && !color) { cleanName = bar[1]; color = bar[2]; }

  return {
    name: cleanName.slice(0, 200), brand: brand.slice(0, 120), store: store.slice(0, 120),
    price: money(priceRaw), currency, image, color: color.slice(0, 80),
    url: pageUrl, source: product ? 'product-data' : (meta['og:title'] ? 'preview-tags' : 'title'),
  };
}
