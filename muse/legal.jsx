import { useNav } from './nav.js';
import { Btn, Icon, Modal, useUi } from './ui.jsx';

// ---- app details used across the public pages (change these in one place) ----
export const APP = {
  name: 'MUSE',
  version: '1.0',
  supportEmail: 'dcap821@gmail.com',
  minAge: 13,
  effective: 'November 2, 2026',
  law: 'the State of Washington, USA',
};

function CopyEmail() {
  const { toast } = useUi();
  return (
    <span className="copy-email">
      <span className="email-text" tabIndex={0}>{APP.supportEmail}</span>
      <Btn variant="secondary" size="sm" icon="copy" onClick={async (e) => {
        try { await navigator.clipboard.writeText(APP.supportEmail); toast('Email address copied'); }
        catch { const r = document.createRange(); r.selectNodeContents(e.currentTarget.parentElement.querySelector('.email-text')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); toast('Email selected. Copy it from here.'); }
      }}>Copy</Btn>
    </span>
  );
}

export function PrivacyContent() {
  return (
    <div className="doc">
      <p className="doc-meta">Effective {APP.effective}</p>
      <p>MUSE is a personal wishlist and planning app. This policy explains what information MUSE collects, where it's kept, and the choices you have. The short version: <strong>your wishlist is private to your account, we never sell it, and there are no ads or trackers.</strong></p>

      <h2>What we collect</h2>
      <ul>
        <li><strong>Your account:</strong> your email address, your password (stored scrambled by our sign-in provider; nobody, including us, can read it), and the first name you choose to give.</li>
        <li><strong>What you save:</strong> wishlist items, links, prices, notes, photos you upload, outfits, makeup routines, collections, holiday lists and gift profiles.</li>
        <li><strong>On your device only:</strong> your theme and light or dark mode choice. These never leave your device.</li>
      </ul>

      <h2>Where it's kept and who can see it</h2>
      <p>Your account and everything you save are stored with our database and file storage provider, Supabase, on servers in the United States. Photos are kept in private storage and are shown to you through temporary links that expire. Every connection is encrypted.</p>
      <p>The database is set up so that each account can only read and change its own information. Other MUSE users can never see your wishlist, photos or gift profiles. As the app's operator we can technically access the database to keep the service running, but we don't look at your content unless you ask us for help or it's needed to protect the service or follow the law.</p>

      <h2>Information about other people</h2>
      <p>Gift profiles can hold details about people you shop for, like their birthday, sizes and favorite things. This is private to your account like everything else. Please only save what you'd be comfortable with them knowing you wrote down.</p>

      <h2>What we don't do</h2>
      <ul>
        <li>No ads, and no advertising or analytics trackers.</li>
        <li>No selling, renting or sharing of your information for marketing.</li>
      </ul>

      <h2>Filling in items from a link</h2>
      <p>When you paste a product link and tap <em>Fill in details</em>, MUSE's server opens that one page to read the product details the store publishes for previews, like the name, brand, price and photo. The details go straight into your form. The server doesn't keep the page or a record of the link; the link is saved only if you save the item. If you keep the photo, it's stored in your account like one you uploaded.</p>

      <h2>Packages and reminders</h2>
      <p>Packages you add, including tracking numbers and reminder messages, are saved to your account like everything else. If you turn on notifications, MUSE saves an address for your device from Apple's or your browser's notification service, and your time zone so reminders come in the morning. Each reminder's title and message pass through that notification service to reach your device. Turn notifications off in Settings at any time and the device address is removed.</p>

      <h2>Companies that help run MUSE</h2>
      <ul>
        <li><strong>Supabase</strong> provides sign-in, the database and photo storage.</li>
        <li><strong>Vercel</strong> hosts the app. Like any web host, it keeps short-lived technical logs (such as IP address and browser type) to deliver the site and keep it secure.</li>
      </ul>
      <p>They handle your information only to provide these services to MUSE. If you paste an image link, your device loads that image from the website it's on. Opening a product page takes you to that store's site, which has its own privacy policy.</p>

      <h2>Your choices</h2>
      <ul>
        <li>Edit or delete anything you've saved at any time.</li>
        <li>Download all of it from <em>Settings › Backup &amp; export</em>.</li>
        <li>Delete your account from <em>Settings › Delete my account</em>. This permanently removes your account, everything you saved and your photos. Copies may remain in our providers' routine backups for a short time before they're overwritten.</li>
      </ul>

      <h2>Age</h2>
      <p>MUSE is for people {APP.minAge} and older. If you're under 18, please use it with a parent or guardian's permission. If we learn that someone under {APP.minAge} has created an account, we'll delete it.</p>

      <h2>Changes</h2>
      <p>If we change this policy in a meaningful way, we'll tell you in the app before the change takes effect. The date at the top shows when it last changed.</p>

      <h2>Contact</h2>
      <p>Questions about privacy, or want us to delete something for you? Email us:</p>
      <CopyEmail />
    </div>
  );
}

export function TermsContent() {
  return (
    <div className="doc">
      <p className="doc-meta">Effective {APP.effective}</p>
      <p>These terms are an agreement between you and MUSE about using the app. By using MUSE, you agree to them. If you don't agree, please don't use the app.</p>

      <h2>Who can use MUSE</h2>
      <p>You must be at least {APP.minAge} years old. If you're under 18, you need permission from a parent or guardian, and they agree to these terms on your behalf.</p>

      <h2>Your account</h2>
      <p>Use a real email address and keep your password private. An account is for one person. You're responsible for what happens in your account, so tell us right away if you think someone else has signed in to it.</p>

      <h2>Your content</h2>
      <p>Everything you add to MUSE is yours. You give us permission only to store it and show it back to you so the app works. You're responsible for what you save, including photos you upload and information about other people. Only upload photos you have the right to use.</p>

      <h2>Using MUSE responsibly</h2>
      <p>Please don't use MUSE to break the law, to harass or track anyone, to upload harmful or illegal content, to access other people's accounts, or to try to damage, overload, copy or interfere with the app. We may suspend or close accounts that break these rules.</p>

      <h2>Stores, brands and prices</h2>
      <p>MUSE isn't affiliated with, endorsed by, or paid by any store or brand you save. Brand names belong to their owners. Prices, sizes and other details in MUSE are whatever you enter or MUSE reads from a store's page when you ask it to, so they may be out of date or wrong. Always check the store before you buy. Purchases happen on other websites, under their terms.</p>

      <h2>Your data and backups</h2>
      <p>MUSE saves your information to your account and we work to keep it safe and available. No online service can promise data will never be lost, so we recommend downloading a backup from Settings now and then.</p>

      <h2>The app is provided "as is"</h2>
      <p>MUSE is offered for free and as is, without warranties of any kind. We work to keep it reliable, but we can't promise it will always be available or error-free. To the fullest extent the law allows, MUSE and its creator aren't liable for any indirect or consequential losses, or for lost data, arising from your use of the app.</p>

      <h2>Changes and ending use</h2>
      <p>We may update MUSE or these terms. If the terms change in a meaningful way, we'll let you know in the app. You can stop using MUSE at any time and delete your account from Settings.</p>

      <h2>Governing law</h2>
      <p>These terms are governed by the laws of {APP.law}.</p>

      <h2>Contact</h2>
      <CopyEmail />
    </div>
  );
}

const FAQ = [
  ['Where is my stuff saved?', 'In your MUSE account. It shows up on every phone or computer where you sign in, and it stays safe if you delete the app.'],
  ['How do I use MUSE on another device?', 'Open MUSE there and sign in with the same email and password. Everything is already there.'],
  ['How do I bring in what I saved in the older version of MUSE?', 'In the older, on-device version, open Settings \u203a Backup & export and export a full backup. Then in this version, open Settings \u203a Backup & export, choose the file under Restore, and pick Add to my account.'],
  ['How do I install MUSE on my iPhone?', 'Open MUSE in Safari, tap the Share button, then Add to Home Screen. It opens full-screen like a regular app.'],
  ['How do package reminders work?', 'Add a package under Organize \u203a Packages with the day it should arrive. MUSE sends a notification around 9 AM Pacific time the day before, that morning, or both, with your own message if you write one. On iPhone, open MUSE from its Home Screen icon and turn on notifications in Settings first.'],
  ['I forgot my password.', 'On the sign-in screen, tap \u201cForgot your password?\u201d and we\u2019ll email you a link to choose a new one. Open the link on the same device.'],
  ['How do I add an item from a link?', 'Tap +, choose the kind of item, and paste the product link at the top. MUSE fills in the name, brand, price and photo when the store shares them. Some stores, like Amazon, block apps from reading their pages, so you\u2019ll fill in what\u2019s missing yourself. Always check the size and color.'],
  ['How do I mark something as bought?', 'Press and hold an item (or tap \u22ef on its card) and choose \u201cI bought it.\u201d You can also change the status on the item itself.'],
  ['I deleted something by accident.', 'Tap Undo on the message that appears right after deleting.'],
  ['Where did my holiday list go?', 'Lists move to Settings \u203a Archived Lists the day after their date. Open one and tap \u201cBring back for next year\u201d to reuse it.'],
  ['How do I delete my account?', 'Settings \u203a Delete my account permanently erases your account and everything in it. Export a backup first if you might want anything.'],
];

export function HelpContent() {
  const { toast } = useUi();
  const details = `MUSE ${APP.version} · ${navigator.userAgent}`;
  return (
    <div className="doc">
      <h2>Questions people ask</h2>
      <div className="faq">
        {FAQ.map(([q, a]) => (
          <details key={q} className="faq-item">
            <summary>{q}</summary>
            <p>{a}</p>
          </details>
        ))}
      </div>
      <h2>Contact support</h2>
      <p>Found a bug or have an idea? Email us and we'll get back to you.</p>
      <CopyEmail />
      <p className="hint">If you're reporting a problem, include what you were doing and these details about your device:</p>
      <div className="device-details">
        <code>{details}</code>
        <Btn variant="ghost" size="sm" icon="copy" onClick={async () => { try { await navigator.clipboard.writeText(details); toast('Device details copied'); } catch { toast('Select the details above to copy them'); } }}>Copy details</Btn>
      </div>
    </div>
  );
}

const DOCS = { privacy: ['Privacy Policy', PrivacyContent], terms: ['Terms of Use', TermsContent], help: ['Help & Support', HelpContent] };

/** Full-page view for the routes #privacy, #terms and #help. */
export function DocPage({ route }) {
  const { go } = useNav();
  const [title, Content] = DOCS[route];
  return (
    <article className="doc-page">
      <button type="button" className="back-link" onClick={() => go('settings')}><Icon name="back" size={16} />Settings</button>
      <h1 className="page-title">{title}</h1>
      <Content />
    </article>
  );
}

/** The same documents in a sheet (used on the welcome screen). */
export function DocSheet({ doc, onClose }) {
  const [title, Content] = DOCS[doc];
  return <Modal title={title} onClose={onClose} size="md"><Content /></Modal>;
}
