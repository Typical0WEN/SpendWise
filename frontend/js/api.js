// LOCATION: frontend/js/api.js
const API = 'https://spendwise-k80g.onrender.com/api/v1';

// ── Auth helpers ─────────────────────────────────────────────
function getToken() { return localStorage.getItem('token'); }

function getUser() {
  try { return JSON.parse(localStorage.getItem('user') || '{}'); }
  catch { return {}; }
}

function saveUser(u) {
  // Store exactly what the server gave us — no merging with stale local data.
  // Merging was the root cause: old balance values survived server updates.
  localStorage.setItem('user', JSON.stringify(u));
}

// ── Currency ─────────────────────────────────────────────────
const CURRENCY_SYMBOLS = {
  NGN:'₦', USD:'$',  GBP:'£',  EUR:'€',  GHS:'₵',
  KES:'KSh',ZAR:'R', CAD:'CA$',AUD:'A$', JPY:'¥',
  CNY:'¥',  INR:'₹', BRL:'R$', MXN:'MX$',AED:'AED',
  SAR:'SAR',EGP:'EGP',TZS:'TSh',UGX:'USh',RWF:'RWF',
};

function getCurrencySymbol(code) {
  return CURRENCY_SYMBOLS[code] || code || '₦';
}

function getUserCurrency() { return getUser().currency || 'NGN'; }

function fmt(amount) {
  const sym = getCurrencySymbol(getUserCurrency());
  return sym + (amount || 0).toLocaleString(undefined, { minimumFractionDigits: 0 });
}

// ── Live exchange rates ───────────────────────────────────────
// Uses open.er-api.com — completely free, no API key, updated every 24h
// We cache in memory and auto-refresh every 60 seconds so the UI stays current.

let _ratesCache     = null;
let _ratesTimestamp = 0;
let _ratesBase      = 'USD';
const RATES_TTL     = 60 * 1000; // refresh every 60 seconds

async function fetchExchangeRates(base = 'USD') {
  const now = Date.now();

  // Return cached rates if fresh and same base
  if (_ratesCache && _ratesBase === base && now - _ratesTimestamp < RATES_TTL) {
    return _ratesCache;
  }

  try {
    // Primary: open.er-api.com (free, real-time, no key needed)
    const res  = await fetch(`https://open.er-api.com/v6/latest/${base}`);
    const data = await res.json();

    if (data.result === 'success' && data.rates) {
      _ratesCache     = data.rates;
      _ratesBase      = base;
      _ratesTimestamp = now;
      return data.rates;
    }
    throw new Error('Bad response from primary API');

  } catch {
    // Fallback: exchangerate-api.com
    try {
      const res  = await fetch(`https://api.exchangerate-api.com/v4/latest/${base}`);
      const data = await res.json();

      if (data.rates) {
        _ratesCache     = data.rates;
        _ratesBase      = base;
        _ratesTimestamp = now;
        return data.rates;
      }
    } catch { /* both APIs failed */ }

    return _ratesCache || null; // return last known rates
  }
}

// Returns the timestamp of the last successful rate fetch as a readable string
function getRatesLastUpdated() {
  if (!_ratesTimestamp) return null;
  return new Date(_ratesTimestamp).toLocaleTimeString(undefined, {
    hour: '2-digit', minute: '2-digit',
  });
}

// ── Core fetch wrapper ───────────────────────────────────────
async function apiFetch(path, options = {}) {
  try {
    const res = await fetch(API + path, {
      ...options,
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${getToken()}`,
        ...(options.headers || {}),
      },
    });

    if (res.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = 'auth.html';
      return { ok: false, data: null };
    }

    let data = null;
    try { data = await res.json(); } catch { data = null; }

    if (!res.ok) {
      console.error(`API ${options.method || 'GET'} ${path} [${res.status}]:`, data);
      return { ok: false, data };
    }

    return { ok: true, data };
  } catch (err) {
    console.error(`API ${options.method || 'GET'} ${path} network error:`, err.message);
    return { ok: false, data: null };
  }
}

// ── Transactions ─────────────────────────────────────────────
async function getTransactions() {
  const { ok, data } = await apiFetch('/transactions');
  if (!ok || !data) return [];
  return Array.isArray(data) ? data : [];
}

async function addTransaction(payload) {
  const { ok, data } = await apiFetch('/transactions', {
    method: 'POST', body: JSON.stringify(payload),
  });
  return ok ? data : null;
}

async function deleteTransaction(id) {
  const { ok, data } = await apiFetch(`/transactions/${id}`, { method: 'DELETE' });
  return ok ? data : null;
}

// ── Insights ─────────────────────────────────────────────────
async function getInsights() {
  const { ok, data } = await apiFetch('/insights');
  return ok ? data : null;
}

// ── AI Coach ─────────────────────────────────────────────────
async function askCoach(message) {
  const { ok, data } = await apiFetch('/coach', {
    method: 'POST', body: JSON.stringify({ message }),
  });
  return ok ? data : null;
}

// ── Profile ──────────────────────────────────────────────────
async function getProfile() {
  const { ok, data } = await apiFetch('/profile');
  return ok ? data : null;
}

async function updateProfile(payload) {
  console.log('updateProfile →', payload);
  const { ok, data } = await apiFetch('/profile', {
    method: 'PATCH', body: JSON.stringify(payload),
  });
  console.log('updateProfile ←', ok, data);
  if (ok && data && (data.id || data._id)) saveUser(data);
  return ok ? data : (data || null);
}

// ── Goals ────────────────────────────────────────────────────
async function getGoals() {
  const { ok, data } = await apiFetch('/goals');
  if (!ok || !data) return [];
  return Array.isArray(data) ? data : [];
}

async function addGoal(payload) {
  const { ok, data } = await apiFetch('/goals', {
    method: 'POST', body: JSON.stringify(payload),
  });
  return ok ? data : null;
}

async function deleteGoal(id) {
  const { ok, data } = await apiFetch(`/goals/${id}`, { method: 'DELETE' });
  return ok ? data : null;
}
// ── Monthly Budget ────────────────────────────────────────────
async function getCurrentBudget() {
  const { ok, data } = await apiFetch('/budget/current');
  return ok ? data : null;
}

async function setCurrentBudget(balance) {
  const { ok, data } = await apiFetch('/budget/current', {
    method: 'POST', body: JSON.stringify({ balance }),
  });
  return ok ? data : null;
}

async function getBudgetHistory() {
  const { ok, data } = await apiFetch('/budget/history');
  return ok ? data : [];
}
