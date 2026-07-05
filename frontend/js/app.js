// LOCATION: frontend/js/app.js
// Depends on api.js being loaded first in index.html.

const CAT_ICONS = {
  Food:'🍛', Transport:'🚗', Entertainment:'🎬', Games:'🎮',
  Shopping:'🛒', Bills:'💡', Health:'💊', Other:'📦',
};
const CAT_COLORS = {
  Food:'#ef4444', Transport:'#06b6d4', Entertainment:'#8b5cf6', Games:'#06d6a0',
  Shopping:'#f59e0b', Bills:'#3b82f6', Health:'#10b981', Other:'#94a3b8',
};

const CURRENCIES = [
  { code:'NGN', name:'Nigerian Naira',     symbol:'₦'   },
  { code:'USD', name:'US Dollar',          symbol:'$'   },
  { code:'GBP', name:'British Pound',      symbol:'£'   },
  { code:'EUR', name:'Euro',               symbol:'€'   },
  { code:'GHS', name:'Ghanaian Cedi',      symbol:'₵'   },
  { code:'KES', name:'Kenyan Shilling',    symbol:'KSh' },
  { code:'ZAR', name:'South African Rand', symbol:'R'   },
  { code:'CAD', name:'Canadian Dollar',    symbol:'CA$' },
  { code:'AUD', name:'Australian Dollar',  symbol:'A$'  },
  { code:'JPY', name:'Japanese Yen',       symbol:'¥'   },
  { code:'INR', name:'Indian Rupee',       symbol:'₹'   },
  { code:'EGP', name:'Egyptian Pound',     symbol:'EGP' },
  { code:'TZS', name:'Tanzanian Shilling', symbol:'TSh' },
  { code:'UGX', name:'Ugandan Shilling',   symbol:'USh' },
];

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

// ── State ─────────────────────────────────────────────────────
let transactions  = [];   // current month only
let currentBudget = null; // { month, year, balance, spent, remaining, budgetSet, transactions }
let exchangeRates = null;

// ── INIT ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  if (!getToken()) { window.location.href = 'auth.html'; return; }

  document.getElementById('exp-date').valueAsDate = new Date();

  populateSidebarUser();
  setGreeting();

  const [profile, budget] = await Promise.all([
    getProfile(),
    getCurrentBudget(),
  ]);

  if (profile) {
    saveUser({
      ...getUser(),
      ...profile,
      _id:            profile._id || profile.id,
      id:             profile.id  || profile._id,
      currentBalance: Number(profile.currentBalance ?? 0),
      currency:       profile.currency || 'NGN',
    });
    populateSidebarUser();
    setGreeting();
  }

  currentBudget = budget;
  transactions  = budget?.transactions || [];

  fetchExchangeRates().then(rates => { exchangeRates = rates; });

  // Prompt user to set a budget if none exists for this month
  if (budget && !budget.budgetSet) {
    openNewMonthModal();
  }

  renderDashboard();
  showPage('dashboard');
});

// ── SIDEBAR USER ──────────────────────────────────────────────
function populateSidebarUser() {
  const user     = getUser();
  const nameEl   = document.getElementById('user-name');
  const avatarEl = document.getElementById('user-avatar');

  if (!user || !user.name) {
    try {
      const payload = JSON.parse(atob(getToken().split('.')[1]));
      if (payload.name && nameEl) nameEl.textContent = payload.name;
    } catch { /* ignore */ }
    return;
  }

  const initials = user.name.split(' ').filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2);
  if (avatarEl) avatarEl.textContent = initials;
  if (nameEl)   nameEl.textContent   = user.name;
}

function setGreeting() {
  const user = getUser();
  const h    = new Date().getHours();
  const pfx  = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  const name = user?.name ? user.name.split(' ')[0] : '';
  const el   = document.getElementById('greeting');
  if (el) el.textContent = name ? `${pfx}, ${name}` : pfx;
}

// ── PAGE ROUTING ──────────────────────────────────────────────
function showPage(id) {
  document.querySelectorAll('.page').forEach(p     => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  document.getElementById('page-' + id)?.classList.add('active');
  document.querySelector(`[data-page="${id}"]`)?.classList.add('active');

  if (id === 'transactions') renderAllTransactions();
  if (id === 'insights')     renderInsightsPage();
  if (id === 'coach')        initCoach();
  if (id === 'settings')     renderSettingsPage();
  if (id === 'history')      renderHistoryPage();
}

// ── DASHBOARD ─────────────────────────────────────────────────
function renderDashboard() {
  const emptyEl   = document.getElementById('dash-empty');
  const contentEl = document.getElementById('dash-content');
  if (!emptyEl || !contentEl) return;

  const user = getUser() || {};
  const sym  = getCurrencySymbol(user.currency || 'NGN');

  // Month label
  const monthEl = document.getElementById('dash-month-label');
  if (monthEl && currentBudget) {
    monthEl.textContent = `${MONTH_NAMES[currentBudget.month - 1]} ${currentBudget.year}`;
  }

  // Balance card — always visible
  const balEl = document.getElementById('stat-balance');
  const subEl = document.getElementById('stat-balance-sub');

  if (balEl) {
    const bal   = currentBudget?.balance || 0;
    const spent = currentBudget?.spent   || 0;
    const left  = bal - spent;

    if (!currentBudget?.budgetSet) {
      balEl.textContent = '—';
      if (subEl) {
        subEl.innerHTML = `<button onclick="openNewMonthModal()" style="background:none;border:none;color:var(--cyan-dk);font-weight:700;font-size:12px;cursor:pointer;">Set this month's budget →</button>`;
        subEl.className = 'stat-sub';
      }
    } else {
      balEl.textContent = fmt(bal);
      if (subEl) {
        const pct = bal > 0 ? ((spent / bal) * 100).toFixed(0) : 0;
        if (left < 0) {
          subEl.textContent = `⚠ Over by ${sym}${Math.abs(left).toLocaleString()}`;
          subEl.className   = 'stat-sub over';
        } else if (Number(pct) >= 70) {
          subEl.textContent = `${pct}% spent · ${sym}${left.toLocaleString()} left`;
          subEl.className   = 'stat-sub warn';
        } else {
          subEl.textContent = `${sym}${left.toLocaleString()} remaining`;
          subEl.className   = 'stat-sub good';
        }
      }
    }
  }

  if (transactions.length === 0) {
    emptyEl.style.display   = 'block';
    contentEl.style.display = 'none';
    return;
  }

  emptyEl.style.display   = 'none';
  contentEl.style.display = 'block';

  const total = transactions.reduce((s, t) => s + t.amount, 0);
  const avg   = Math.round(total / transactions.length);

  const totalEl = document.getElementById('stat-total');
  const avgEl   = document.getElementById('stat-avg');
  const countEl = document.getElementById('stat-count');
  if (totalEl) totalEl.textContent = fmt(total);
  if (avgEl)   avgEl.textContent   = fmt(avg);
  if (countEl) countEl.textContent = transactions.length + ' transactions';

  const cats   = buildCatTotals(transactions);
  const sorted = Object.entries(cats).sort((a, b) => b[1] - a[1]);
  const topEl  = document.getElementById('stat-top');
  const topSub = document.getElementById('stat-top-sub');
  if (topEl && sorted.length) {
    topEl.textContent = sorted[0][0];
    if (topSub) topSub.textContent = fmt(sorted[0][1]);
  }

  renderCategoryBars('cat-list', cats, total);
  renderTxList('recent-list', transactions.slice(0, 6), false);
}

// ── ALL TRANSACTIONS PAGE ─────────────────────────────────────
function renderAllTransactions() {
  const listEl  = document.getElementById('all-tx-list');
  const emptyEl = document.getElementById('all-tx-empty');
  if (!listEl) return;

  let txs  = [...transactions];
  const cat  = document.getElementById('filter-cat')?.value  || '';
  const sort = document.getElementById('filter-sort')?.value || 'newest';

  if (cat) txs = txs.filter(t => t.category === cat);

  txs.sort((a, b) => {
    if (sort === 'oldest')  return new Date(a.date) - new Date(b.date);
    if (sort === 'highest') return b.amount - a.amount;
    if (sort === 'lowest')  return a.amount - b.amount;
    return new Date(b.date) - new Date(a.date);
  });

  if (txs.length === 0) {
    listEl.innerHTML      = '';
    emptyEl.style.display = 'block';
    return;
  }
  emptyEl.style.display = 'none';
  renderTxList('all-tx-list', txs, true);
}

// ── INSIGHTS PAGE ─────────────────────────────────────────────
async function renderInsightsPage() {
  const emptyEl   = document.getElementById('insights-empty');
  const contentEl = document.getElementById('insights-content');

  if (transactions.length === 0) {
    if (emptyEl)   emptyEl.style.display   = 'block';
    if (contentEl) contentEl.style.display = 'none';
    return;
  }
  if (emptyEl)   emptyEl.style.display   = 'none';
  if (contentEl) contentEl.style.display = 'block';

  const total = transactions.reduce((s, t) => s + t.amount, 0);
  const avg   = Math.round(total / transactions.length);
  const cats  = buildCatTotals(transactions);

  const insTotal = document.getElementById('ins-total');
  const insAvg   = document.getElementById('ins-avg');
  const insCount = document.getElementById('ins-count');
  if (insTotal) insTotal.textContent = fmt(total);
  if (insAvg)   insAvg.textContent   = fmt(avg);
  if (insCount) insCount.textContent = transactions.length;

  renderCategoryBars('ins-cats', cats, total);

  const anomalies   = transactions.filter(t => t.amount > avg * 2);
  const anomalyCard = document.getElementById('anomaly-card');
  if (anomalyCard) {
    anomalyCard.style.display = anomalies.length > 0 ? 'block' : 'none';
    if (anomalies.length > 0) renderTxList('ins-anomalies', anomalies, false);
  }
}

// ── HISTORY PAGE ──────────────────────────────────────────────
async function renderHistoryPage() {
  const container = document.getElementById('history-content');
  const emptyEl   = document.getElementById('history-empty');
  const loadingEl = document.getElementById('history-loading');
  if (!container) return;

  if (loadingEl) loadingEl.style.display = 'block';
  if (emptyEl)   emptyEl.style.display   = 'none';
  container.innerHTML = '';

  const history = await getBudgetHistory();

  if (loadingEl) loadingEl.style.display = 'none';

  if (!history || history.length === 0) {
    if (emptyEl) emptyEl.style.display = 'block';
    return;
  }

  const user = getUser();
  const sym  = getCurrencySymbol(user.currency || 'NGN');

  container.innerHTML = history.map(entry => {
    const monthName = MONTH_NAMES[entry.month - 1];
    const pct       = entry.balance > 0 ? ((entry.spent / entry.balance) * 100).toFixed(0) : 0;
    const left      = entry.balance - entry.spent;
    const statusCls = !entry.budgetSet ? '' : left < 0 ? 'over' : pct >= 70 ? 'warn' : 'good';
    const statusTxt = !entry.budgetSet
      ? 'No budget set'
      : left < 0
        ? `Over by ${sym}${Math.abs(left).toLocaleString()}`
        : `${sym}${left.toLocaleString()} remaining`;

    const txRows = entry.transactions.slice(0, 5).map(t => `
      <div class="tx-row">
        <div class="tx-icon">${CAT_ICONS[t.category] || '📦'}</div>
        <div class="tx-body">
          <div class="tx-name">${t.description || t.category}</div>
          <div class="tx-meta">${new Date(t.date).toLocaleDateString(undefined, { day:'numeric', month:'short' })}</div>
        </div>
        <div class="tx-right">
          <div class="tx-amount">−${fmt(t.amount)}</div>
          <div class="tx-cat">${t.category}</div>
        </div>
      </div>`).join('');

    const moreCount = entry.transactions.length - 5;

    return `
      <div class="card history-card">
        <div class="history-card-hd">
          <div>
            <div class="history-month">${monthName} ${entry.year}</div>
            <div class="history-budget">${entry.budgetSet ? `Budget: ${fmt(entry.balance)}` : 'No budget recorded'}</div>
          </div>
          <div class="history-summary">
            <div class="history-spent">Spent: <strong>${fmt(entry.spent)}</strong></div>
            <div class="stat-sub ${statusCls}" style="text-align:right;margin-top:4px">${statusTxt}</div>
          </div>
        </div>
        ${entry.transactions.length > 0
          ? `<div class="history-txs">${txRows}${moreCount > 0 ? `<div class="inner-empty" style="padding:10px 0"><p>+ ${moreCount} more transactions this month</p></div>` : ''}</div>`
          : '<div class="inner-empty"><p>No transactions this month.</p></div>'}
      </div>`;
  }).join('');
}

// ── NEW MONTH MODAL ───────────────────────────────────────────
function openNewMonthModal() {
  const now = new Date();
  const el  = document.getElementById('new-month-label');
  if (el) el.textContent = `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`;

  const symEl = document.getElementById('new-month-sym');
  if (symEl) symEl.textContent = getCurrencySymbol(getUser().currency || 'NGN');

  document.getElementById('new-month-overlay').classList.add('open');
  setTimeout(() => document.getElementById('new-month-input')?.focus(), 60);
}

function closeNewMonthModal() {
  document.getElementById('new-month-overlay').classList.remove('open');
  const errEl = document.getElementById('new-month-error');
  if (errEl) errEl.classList.remove('show');
}

async function submitNewMonthBudget() {
  const input  = document.getElementById('new-month-input');
  const errEl  = document.getElementById('new-month-error');
  const btn    = document.getElementById('new-month-btn');
  const amount = parseFloat(input?.value?.trim());

  if (isNaN(amount) || amount <= 0) {
    if (errEl) { errEl.textContent = 'Please enter a valid amount.'; errEl.classList.add('show'); }
    return;
  }

  if (errEl) errEl.classList.remove('show');
  if (btn)   { btn.disabled = true; btn.textContent = 'Saving…'; }

  const saved = await setCurrentBudget(amount);

  if (btn) { btn.disabled = false; btn.textContent = 'Set Budget'; }

  if (!saved) {
    if (errEl) { errEl.textContent = 'Failed to save. Is the backend running?'; errEl.classList.add('show'); }
    return;
  }

  // Re-fetch the full current budget state from the server
  currentBudget = await getCurrentBudget();
  transactions  = currentBudget?.transactions || [];

  closeNewMonthModal();
  renderDashboard();
}

// ── SETTINGS PAGE ─────────────────────────────────────────────
let _settingsRendered = false;

function renderSettingsPage() {
  const user     = getUser();
  const currency = user.currency || 'NGN';

  const sel = document.getElementById('settings-currency');
  if (sel && !_settingsRendered) {
    sel.innerHTML = CURRENCIES.map(c =>
      `<option value="${c.code}" ${c.code === currency ? 'selected' : ''}>
        ${c.symbol} — ${c.name} (${c.code})
      </option>`
    ).join('');
    sel.addEventListener('change', () => renderExchangeRate(sel.value));
  }

  _settingsRendered = true;
  renderExchangeRate(sel?.value || currency);
}

function resetSettingsPage() { _settingsRendered = false; }

async function saveSettings() {
  const currency = document.getElementById('settings-currency')?.value;
  const errEl    = document.getElementById('settings-error');
  const btn      = document.getElementById('settings-save-btn');

  if (errEl) errEl.classList.remove('show');
  if (btn)   { btn.disabled = true; btn.textContent = 'Saving…'; }

  const payload = {};
  if (currency) payload.currency = currency;

  const updated = await updateProfile(payload);

  if (btn) btn.disabled = false;

  if (!updated || (!updated.id && !updated._id)) {
    const msg = updated?.message || 'Failed to save.';
    if (errEl) { errEl.textContent = msg; errEl.classList.add('show'); }
    if (btn)   btn.textContent = 'Save Settings';
    return;
  }

  if (btn) {
    btn.textContent = '✓ Saved!';
    setTimeout(() => { btn.textContent = 'Save Settings'; }, 2000);
  }

  const fresh = await getProfile();
  if (fresh) saveUser(fresh);

  resetSettingsPage();
  populateSidebarUser();
  renderDashboard();
}

// ── EXCHANGE RATES ────────────────────────────────────────────
let _rateRefreshTimer = null;

async function renderExchangeRate(code) {
  const el = document.getElementById('rate-display');
  if (!el) return;

  if (_rateRefreshTimer) clearInterval(_rateRefreshTimer);
  el.innerHTML = '<span class="rate-loading">⟳ Fetching live rates…</span>';

  const rates = await fetchExchangeRates(code);
  exchangeRates = rates;
  _drawRates(el, code, rates);

  _rateRefreshTimer = setInterval(async () => {
    const fresh = await fetchExchangeRates(code);
    exchangeRates = fresh;
    const el2 = document.getElementById('rate-display');
    if (el2) _drawRates(el2, code, fresh);
  }, 60000);
}

function _drawRates(el, code, rates) {
  if (!rates) {
    el.innerHTML = '<span class="rate-loading" style="color:var(--red)">Could not fetch rates.</span>';
    return;
  }
  const sym     = getCurrencySymbol(code);
  const base    = rates[code] || 1;
  const pairs   = ['USD','EUR','GBP','NGN','GHS','KES','ZAR','INR'].filter(c => c !== code).slice(0, 6);
  const updated = getRatesLastUpdated();

  const items = pairs.map(pair => {
    const pr = rates[pair];
    if (!pr) return '';
    const rate      = pr / base;
    const pairSym   = getCurrencySymbol(pair);
    const formatted = rate >= 1000
      ? rate.toLocaleString(undefined, { maximumFractionDigits: 2 })
      : rate >= 1 ? rate.toFixed(4) : rate.toFixed(6);
    return `<div class="rate-item">
      <span class="rate-pair">1 ${sym}</span>
      <span class="rate-eq">=</span>
      <span class="rate-value">${pairSym}${formatted}</span>
      <span class="rate-code">${pair}</span>
    </div>`;
  }).filter(Boolean);

  el.innerHTML = `
    <div class="rate-header">
      <div class="rate-title">Live exchange rates · 1 ${code}</div>
      ${updated ? `<div class="rate-updated">Updated ${updated} · auto-refreshes</div>` : ''}
    </div>
    <div class="rate-grid">${items.join('')}</div>
    <div class="rate-source">Source: open.er-api.com (real-time)</div>`;
}

// ── SHARED RENDERERS ──────────────────────────────────────────
function buildCatTotals(txs) {
  const cats = {};
  txs.forEach(t => { cats[t.category] = (cats[t.category] || 0) + t.amount; });
  return cats;
}

function renderCategoryBars(containerId, cats, total) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const sorted = Object.entries(cats).sort((a, b) => b[1] - a[1]);
  if (!sorted.length) { el.innerHTML = '<div class="inner-empty"><p>No data yet.</p></div>'; return; }
  el.innerHTML = sorted.map(([cat, amt]) => {
    const pct   = Math.round((amt / total) * 100);
    const color = CAT_COLORS[cat] || '#94a3b8';
    const icon  = CAT_ICONS[cat]  || '📦';
    return `
      <div class="cat-row">
        <div class="cat-icon">${icon}</div>
        <div class="cat-info">
          <div class="cat-name"><span class="cat-label">${cat}</span><span class="cat-pct">${pct}%</span></div>
          <div class="cat-bar-bg"><div class="cat-bar-fill" style="width:${pct}%;background:${color}"></div></div>
        </div>
        <div class="cat-amount">${fmt(amt)}</div>
      </div>`;
  }).join('');
}

function renderTxList(containerId, txs, showDelete) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!txs.length) { el.innerHTML = '<div class="inner-empty"><p>Nothing here yet.</p></div>'; return; }
  el.innerHTML = txs.map(t => {
    const icon    = CAT_ICONS[t.category] || '📦';
    const dateStr = new Date(t.date).toLocaleDateString(undefined, { weekday:'short', day:'numeric', month:'short' });
    const delBtn  = showDelete ? `<button class="tx-del" onclick="handleDelete('${t._id}')" title="Delete">✕</button>` : '';
    return `
      <div class="tx-row" id="txrow-${t._id}">
        <div class="tx-icon">${icon}</div>
        <div class="tx-body">
          <div class="tx-name">${t.description || t.category}</div>
          <div class="tx-meta">${dateStr}</div>
        </div>
        <div class="tx-right">
          <div class="tx-amount">−${fmt(t.amount)}</div>
          <div class="tx-cat">${t.category}</div>
        </div>
        ${delBtn}
      </div>`;
  }).join('');
}

// ── DELETE ────────────────────────────────────────────────────
async function handleDelete(id) {
  if (!confirm('Delete this transaction?')) return;
  await deleteTransaction(id);
  transactions = transactions.filter(t => t._id !== id);
  if (currentBudget) {
    currentBudget.spent        = transactions.reduce((s, t) => s + t.amount, 0);
    currentBudget.remaining    = (currentBudget.balance || 0) - currentBudget.spent;
    currentBudget.transactions = transactions;
  }
  renderDashboard();
  renderAllTransactions();
}

// ── ADD EXPENSE MODAL ─────────────────────────────────────────
function openModal() {
  document.getElementById('modal-overlay').classList.add('open');
  setTimeout(() => document.getElementById('exp-amount').focus(), 60);
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
  const errEl = document.getElementById('exp-error');
  if (errEl) errEl.classList.remove('show');
  ['exp-amount','exp-desc'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  const cat = document.getElementById('exp-cat');
  if (cat) cat.value = '';
  document.getElementById('exp-date').valueAsDate = new Date();
}

async function submitExpense() {
  const amount  = parseFloat(document.getElementById('exp-amount').value);
  const cat     = document.getElementById('exp-cat').value;
  const desc    = document.getElementById('exp-desc').value.trim();
  const date    = document.getElementById('exp-date').value;
  const errEl   = document.getElementById('exp-error');
  const btn     = document.getElementById('exp-submit-btn');
  const labelEl = document.getElementById('exp-label');
  const loader  = document.getElementById('exp-loader');

  if (!amount || amount <= 0 || !cat) {
    if (errEl) { errEl.textContent = 'Please enter an amount and select a category.'; errEl.classList.add('show'); }
    return;
  }

  if (errEl) errEl.classList.remove('show');
  if (btn)     btn.disabled          = true;
  if (labelEl) labelEl.style.display = 'none';
  if (loader)  loader.style.display  = 'block';

  try {
    const saved = await addTransaction({ amount, category: cat, description: desc, date: date || new Date().toISOString() });

    if (saved && saved._id) {
      transactions.unshift(saved);
      if (currentBudget) {
        currentBudget.spent        = transactions.reduce((s, t) => s + t.amount, 0);
        currentBudget.remaining    = (currentBudget.balance || 0) - currentBudget.spent;
        currentBudget.transactions = transactions;
      }
      closeModal();
      renderDashboard();
      if (document.getElementById('page-transactions')?.classList.contains('active')) renderAllTransactions();
    } else {
      if (errEl) { errEl.textContent = 'Failed to save. Please try again.'; errEl.classList.add('show'); }
    }
  } catch {
    if (errEl) { errEl.textContent = 'Server error. Please try again.'; errEl.classList.add('show'); }
  } finally {
    if (btn)     btn.disabled          = false;
    if (labelEl) labelEl.style.display = 'inline';
    if (loader)  loader.style.display  = 'none';
  }
}

// ── BALANCE MODAL ALIASES ─────────────────────────────────────
// The stat card onclick and sidebar button call these.
// They alias to the new monthly budget modal so both entry points
// work through a single modal flow.
function openBalanceModal()  { openNewMonthModal(); }
function closeBalanceModal() { closeNewMonthModal(); }
async function submitBalance() { await submitNewMonthBudget(); }

// ── SIGN OUT ──────────────────────────────────────────────────
function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = 'auth.html';
}