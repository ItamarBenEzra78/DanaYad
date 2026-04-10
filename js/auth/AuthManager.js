import { SUPABASE_URL, SUPABASE_ANON, ADMIN_EMAIL } from '../config.js';
import { openPdfModal } from '../export/PdfExporter.js';

const _sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
let _user = null;
let _profile = null;

function showAuthMsg(text, type) {
  const el = document.getElementById('auth-msg');
  el.textContent = text;
  el.className = 'auth-msg ' + type;
}

export async function handleGoogleLogin() {
  const btn = document.getElementById('google-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="auth-spinner"></span> מתחבר...';

  const { error } = await _sb.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin + window.location.pathname
    }
  });

  if (error) {
    btn.disabled = false;
    btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg> התחבר עם Google';
    showAuthMsg('שגיאה בהתחברות: ' + error.message, 'error');
  }
}

export async function handleLogout() {
  await _sb.auth.signOut();
  _user = null; _profile = null;
  document.getElementById('auth-overlay').classList.remove('hidden');
  document.getElementById('user-badge').style.display = 'none';
  document.getElementById('logout-btn').style.display = 'none';
}

function dyIsAdmin() {
  if (_profile && _profile.role === 'admin') return true;
  if (_user && _user.email && _user.email.toLowerCase() === ADMIN_EMAIL) return true;
  return false;
}

async function loadProfile(user) {
  const { data } = await _sb.from('profiles').select('*').eq('id', user.id).single();
  if (data) { _profile = data; }
  else {
    const role = user.email.toLowerCase() === ADMIN_EMAIL ? 'admin' : 'user';
    _profile = { id: user.id, email: user.email, role, subscription_status: 'inactive' };
  }
}

export function checkAndExport() {
  openPdfModal();
}

export async function startStripeCheckout() {
  if (!_user) { showAuthMsg('יש להתחבר תחילה', 'error'); return; }
  try {
    const paymentUrl = 'https://buy.stripe.com/YOUR_PAYMENT_LINK'
      + '?client_reference_id=' + encodeURIComponent(_user.id)
      + '?prefilled_email=' + encodeURIComponent(_user.email);
    window.open(paymentUrl, '_blank');
  } catch (err) {
    alert('שגיאה בפתיחת דף תשלום: ' + err.message);
  }
}

async function initApp(user) {
  _user = user;
  try { await loadProfile(user); } catch (e) { /* ignore */ }

  document.getElementById('auth-overlay').classList.add('hidden');

  const badge = document.getElementById('user-badge');
  badge.style.display = '';
  badge.textContent = dyIsAdmin() ? '👑 ' + user.email : user.email;
  if (dyIsAdmin()) badge.style.background = '#fef3c7';
  document.getElementById('logout-btn').style.display = '';
}

export async function checkSession() {
  try {
    const result = await Promise.race([
      _sb.auth.getSession(),
      new Promise(resolve => setTimeout(() => resolve({ data: { session: null }, timedOut: true }), 3000))
    ]);

    if (result.timedOut) {
      console.warn('Supabase session check timed out');
      return;
    }

    const session = result.data?.session;
    if (session && session.user) {
      await initApp(session.user);
    }
  } catch (err) {
    console.warn('Auth check failed:', err);
  }
}

export function initAuthListener() {
  _sb.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session?.user) {
      await initApp(session.user);
    }
  });
}
