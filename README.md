# MUSE

Your wishlist, beautifully kept. Save clothes and makeup, plan outfits and makeup routines, keep gift profiles for the people you shop for, and track holiday lists.

## How it's built
- **Next.js** app (`app/`) that loads the MUSE interface (`muse/`) in the browser.
- **Supabase** for accounts, the database and private photo storage. `supabase-setup.sql` creates every table, the privacy rules (each account can only see its own data) and the `muse-photos` bucket.
- Hosted on **Vercel**.

## Settings
The Supabase project URL and publishable key are in `muse/config.js`. They're safe to be public; private data is protected by the database's privacy rules. To use a different project, set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in Vercel.

## Run it on a computer
```
npm install
npm run dev
```
Then open http://localhost:3000
