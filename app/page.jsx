'use client';
import dynamic from 'next/dynamic';

// MUSE runs entirely in the browser (it needs the signed-in session, local settings and the camera roll),
// so the app loads on the client only.
const Muse = dynamic(() => import('../muse/app.jsx'), { ssr: false, loading: () => <div className="auth-loading">Opening MUSE…</div> });

export default function Page() {
  return <Muse />;
}
