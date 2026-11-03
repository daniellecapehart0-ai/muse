// Your Supabase project. Both values are public by design: every app that uses Supabase
// ships them to the browser. Private data is protected by the database's privacy rules (RLS).
// They can also be set as NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in Vercel.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://wkqvzogvkpwulkmfvfud.supabase.co';
export const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_z3dOCLKiBsjjA8cSDFcJlA_XL7a4Bti';
export const PHOTO_BUCKET = 'muse-photos';
