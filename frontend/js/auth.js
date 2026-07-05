// LOCATION: frontend/js/auth.js
const API = 'http://localhost:3000/api';

let googleClientId = '';
let googleClientIdPromise = null;

if (localStorage.getItem('token')) {
  window.location.href = 'index.html';
}

function showTab(tab) {
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  document.getElementById(tab + '-form').classList.add('active');
  clearErrors();
}

function clearErrors() {
  document.querySelectorAll('.auth-error').forEach(el => {
    el.textContent = '';
    el.classList.remove('show');
  });
}

function showError(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
}

function setLoading(btnId, labelId, loaderId, on) {
  const btn = document.getElementById(btnId);
  const label = document.getElementById(labelId);
  const loader = document.getElementById(loaderId);
  if (btn) btn.disabled = on;
  if (label) label.style.display = on ? 'none' : 'inline';
  if (loader) loader.style.display = on ? 'block' : 'none';
}

function saveAndRedirect(data) {
  localStorage.setItem('token', data.token);
  localStorage.setItem('user', JSON.stringify(data.user));
  window.location.href = 'index.html';
}

async function handleLogin() {
  clearErrors();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  if (!email || !password) {
    showError('login-error', 'Please enter your email and password.');
    return;
  }

  setLoading('login-btn', 'login-label', 'login-loader', true);
  try {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      showError('login-error', data.message || 'Login failed.');
      return;
    }
    saveAndRedirect(data);
  } catch {
    showError('login-error', 'Cannot connect to server. Is the backend running on port 3000?');
  } finally {
    setLoading('login-btn', 'login-label', 'login-loader', false);
  }
}

async function handleSignup() {
  clearErrors();
  const name = document.getElementById('signup-name').value.trim();
  const email = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value;

  if (!name || !email || !password) {
    showError('signup-error', 'Please fill in all fields.');
    return;
  }
  if (password.length < 6) {
    showError('signup-error', 'Password must be at least 6 characters.');
    return;
  }

  setLoading('signup-btn', 'signup-label', 'signup-loader', true);
  try {
    const res = await fetch(`${API}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      showError('signup-error', data.message || 'Registration failed.');
      return;
    }
    saveAndRedirect(data);
  } catch {
    showError('signup-error', 'Cannot connect to server. Is the backend running on port 3000?');
  } finally {
    setLoading('signup-btn', 'signup-label', 'signup-loader', false);
  }
}

function getGoogleClientIdFromMeta() {
  const meta = document.querySelector('meta[name="google-signin-client_id"]');
  return meta?.content || '';
}

function isValidGoogleClientId(id) {
  return Boolean(id) &&
    !id.includes('YOUR_GOOGLE_CLIENT_ID') &&
    id.endsWith('.apps.googleusercontent.com');
}

async function loadGoogleClientId() {
  if (isValidGoogleClientId(googleClientId)) return googleClientId;
  if (googleClientIdPromise) return googleClientIdPromise;

  googleClientIdPromise = (async () => {
    try {
      const res = await fetch(`${API}/auth/google/client-id`);
      if (res.ok) {
        const data = await res.json();
        if (isValidGoogleClientId(data.clientId)) {
          googleClientId = data.clientId;
          return googleClientId;
        }
      }
    } catch {
      // Fall back to the static meta tag if the backend config endpoint is unavailable.
    }

    const metaClientId = getGoogleClientIdFromMeta();
    if (isValidGoogleClientId(metaClientId)) {
      googleClientId = metaClientId;
      return googleClientId;
    }

    googleClientId = '';
    return '';
  })();

  try {
    return await googleClientIdPromise;
  } finally {
    googleClientIdPromise = null;
  }
}

function showGoogleNotConfigured() {
  const activeForm = document.querySelector('.auth-form.active');
  const errId = activeForm?.id === 'signup-form' ? 'signup-error' : 'login-error';
  showError(errId, 'Google sign-in is not configured yet. Add GOOGLE_CLIENT_ID to backend/.env and restart the backend server.');
}

async function initiateGoogleSignIn() {
  clearErrors();

  const clientId = await loadGoogleClientId();
  if (!isValidGoogleClientId(clientId)) {
    showGoogleNotConfigured();
    return;
  }

  if (!window.google?.accounts?.id) {
    setTimeout(initiateGoogleSignIn, 400);
    return;
  }

  google.accounts.id.initialize({
    client_id: clientId,
    callback: handleGoogleCredential,
    auto_select: false,
    cancel_on_tap_outside: true,
  });

  google.accounts.id.prompt(notification => {
    if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
      const btn = document.createElement('div');
      btn.style.display = 'none';
      document.body.appendChild(btn);
      google.accounts.id.renderButton(btn, { theme: 'outline', size: 'large' });
      btn.querySelector('div[role=button]')?.click();
    }
  });
}

async function handleGoogleCredential(response) {
  if (!response?.credential) {
    const errId = document.querySelector('.auth-form.active')?.id === 'signup-form'
      ? 'signup-error'
      : 'login-error';
    showError(errId, 'Google sign-in was cancelled or failed.');
    return;
  }

  try {
    const res = await fetch(`${API}/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential: response.credential }),
    });
    const data = await res.json();

    if (!res.ok) {
      const errId = document.querySelector('.auth-form.active')?.id === 'signup-form'
        ? 'signup-error'
        : 'login-error';
      showError(errId, data.message || 'Google sign-in failed.');
      return;
    }

    saveAndRedirect(data);
  } catch {
    const errId = document.querySelector('.auth-form.active')?.id === 'signup-form'
      ? 'signup-error'
      : 'login-error';
    showError(errId, 'Google sign-in failed. Check your connection.');
  }
}

document.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  const active = document.querySelector('.auth-form.active');
  if (!active) return;
  if (active.id === 'login-form') handleLogin();
  if (active.id === 'signup-form') handleSignup();
});

loadGoogleClientId();
