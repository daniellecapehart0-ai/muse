import { NextResponse } from 'next/server';
import { safeFetch, parseProductPage, UserError } from '../../../lib/product-page.js';
import { userFromRequest } from '../../../lib/auth-check.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const say = (error, status = 400) => NextResponse.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } });

/** GET /api/product-info?url=… → the product details the store's page publishes. Signed-in people only. */
export async function GET(req) {
  if (!(await userFromRequest(req))) return say('Sign in to fill in items from a link.', 401);
  const raw = new URL(req.url).searchParams.get('url') || '';
  let target;
  try { target = new URL(raw.trim()); } catch { return say('Paste a full link that starts with https://'); }
  try {
    const page = await safeFetch(target.toString(), { accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8', maxBytes: 3 * 1024 * 1024 });
    if (!/html|xml/i.test(page.type)) return say("That link isn't a product page.");
    const html = page.bytes.toString('utf8');
    const info = parseProductPage(html, page.url);
    // Shopify stores publish a product feed at /products/<handle>.js; use it to fill a missing photo or price
    const handle = new URL(page.url).pathname.match(/\/products\/([^/?#.]+)/);
    if (handle && (!info.image || info.price == null) && /cdn\/shop|shopify/i.test(html)) {
      try {
        const feed = await safeFetch(new URL(`/products/${handle[1]}.js`, page.url).toString(), { accept: 'application/json', maxBytes: 2 * 1024 * 1024, timeoutMs: 6000 });
        const p = JSON.parse(feed.bytes.toString('utf8'));
        if (!info.image && (p.featured_image || p.images?.[0])) info.image = new URL(String(p.featured_image || p.images[0]).replace(/^\/\//, 'https://'), page.url).toString();
        if (info.price == null && Number.isFinite(p.price)) { info.price = p.price / 100; info.currency = info.currency || null; }
        if (!info.brand && p.vendor) info.brand = String(p.vendor).slice(0, 120);
      } catch { /* the page details are enough */ }
    }
    if (/not found|access denied|robot|captcha|are you a human|page unavailable|^sorry|^error/i.test(info.name)) return say(`${info.store || 'That store'} didn't show MUSE the product. Fill in the details yourself.`, 422);
    if (!info.name && info.price == null && !info.image) return say(`${info.store || 'That store'} didn't share any product details. Fill them in yourself.`, 422);
    return NextResponse.json(info, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    if (e instanceof UserError) return say(e.message === 'blocked' ? `${target.hostname.replace(/^www\./, '')} doesn't let apps read its pages. Fill in the details yourself.` : e.message, 422);
    return say("Couldn't read that page. Fill in the details yourself.", 502);
  }
}
