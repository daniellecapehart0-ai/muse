import { safeFetch, UserError } from '../../../lib/product-page.js';
import { userFromRequest } from '../../../lib/auth-check.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/product-image?url=… → the product photo, so MUSE can save its own copy to the person's account. */
export async function GET(req) {
  if (!(await userFromRequest(req))) return new Response('Sign in first.', { status: 401 });
  const raw = new URL(req.url).searchParams.get('url') || '';
  try {
    const img = await safeFetch(new URL(raw).toString(), { accept: 'image/avif,image/webp,image/jpeg,image/png,image/*;q=0.8', maxBytes: 12 * 1024 * 1024, timeoutMs: 12000 });
    const type = img.type.split(';')[0].trim();
    if (!/^image\/(jpeg|png|webp|gif|avif)$/i.test(type)) return new Response('Not an image.', { status: 415 });
    return new Response(img.bytes, { headers: { 'Content-Type': type, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
  } catch (e) {
    return new Response(e instanceof UserError ? e.message : "Couldn't get that photo.", { status: 422 });
  }
}
