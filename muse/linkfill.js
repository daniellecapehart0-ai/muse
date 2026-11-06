import { supabase } from './supabase.js';

async function authHeader() {
  const { data } = await supabase.auth.getSession();
  return { Authorization: 'Bearer ' + (data.session?.access_token || '') };
}

/** Ask MUSE's server to read a store page. Resolves { name, brand, store, price, currency, image, color } or throws a friendly message. */
export async function readProductLink(url) {
  let r;
  try { r = await fetch('/api/product-info?url=' + encodeURIComponent(url), { headers: await authHeader() }); }
  catch { throw new Error('No internet connection. Check your connection and try again.'); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Couldn't read that page. Fill in the details yourself.");
  return j;
}

/** Download the product photo through MUSE's server so it can be saved to the person's account. Returns a File or null. */
export async function fetchProductPhoto(imageUrl) {
  try {
    const r = await fetch('/api/product-image?url=' + encodeURIComponent(imageUrl), { headers: await authHeader() });
    if (!r.ok) return null;
    const blob = await r.blob();
    if (!blob.type.startsWith('image/') || blob.size < 500) return null;
    const ext = blob.type.split('/')[1].replace('jpeg', 'jpg');
    return new File([blob], 'product.' + ext, { type: blob.type });
  } catch { return null; }
}

const MAKEUP_WORDS = [
  ['Setting spray', /setting spray|setting mist|fixing spray/], ['Lip liner', /lip liner|lip pencil/], ['Lip gloss', /lip gloss|gloss|lip oil/], ['Lip balm', /lip balm|lip treatment|lip mask/],
  ['Lipstick', /lipstick|lip color|lip stain|lip tint|liquid lip/], ['Mascara', /mascara/], ['Eyeliner', /eyeliner|eye liner|kohl/], ['Eyeshadow', /eyeshadow|eye shadow|shadow palette/],
  ['Brow', /brow/], ['Concealer', /concealer/], ['Foundation', /foundation|skin tint|tinted moisturi/], ['Primer', /primer/], ['Highlighter', /highlight|luminizer/],
  ['Bronzer', /bronzer/], ['Contour', /contour/], ['Blush', /blush|cheek/], ['Powder', /powder/], ['Tool', /brush|sponge|curler|applicator/], ['Skincare', /serum|cleanser|moisturizer|sunscreen|spf|toner|cream/],
];
export function guessMakeupType(name) {
  const n = (name || '').toLowerCase();
  const hit = MAKEUP_WORDS.find(([, re]) => re.test(n));
  return hit ? hit[0] : '';
}
