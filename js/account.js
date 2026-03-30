// account.js — My Account page logic

const SUPABASE_URL  = 'https://gfcncubcurtnzupycwnf.supabase.co';
const SUPABASE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdmY25jdWJjdXJ0bnp1cHljd25mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyMzQ4MzYsImV4cCI6MjA4OTgxMDgzNn0.Hbuo8Zl1MNjq8bUlc7Ed_HSBmGQiNHc9wDqKd4XDdOE';
const WITHDRAW_WEBHOOK_URL = ''; // TODO: set your n8n webhook URL here

const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { storage: window.sessionStorage, persistSession: true }
});

let currentUser = null;
let _accountData = {};
let _bankVisible = false;

function setTbodyMsg(tbody, cols, msg) {
  tbody.replaceChildren();
  const tr = tbody.insertRow();
  const td = tr.insertCell();
  td.colSpan = cols;
  td.className = 'empty-row';
  td.textContent = msg;
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add('hidden'), 3500);
}

// ── Auth guard ────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { window.location.href = 'index.html'; return; }
  currentUser = session.user;

  const { data: agentMeta } = await sb.from('agents').select('full_name').eq('id', currentUser.id).maybeSingle();
  const name = (agentMeta && agentMeta.full_name) || currentUser.email;
  const initials = name.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase() || name.slice(0, 2).toUpperCase();
  document.getElementById('header-avatar-initials').textContent = initials;
  document.getElementById('header-user').classList.remove('hidden');
  document.getElementById('account-wrap').style.display = '';

  document.getElementById('btn-logout').addEventListener('click', async () => {
    await sb.auth.signOut();
    window.location.href = 'index.html';
  });
  document.getElementById('btn-edit-account').addEventListener('click', enterEditAccount);
  document.getElementById('btn-save-account').addEventListener('click', saveAccount);
  document.getElementById('btn-cancel-account').addEventListener('click', exitEditAccount);
  document.getElementById('btn-toggle-bank').addEventListener('click', toggleBankNumber);
  document.getElementById('btn-withdraw').addEventListener('click', requestWithdrawal);

  await Promise.all([loadProfile(), loadWithdrawal()]);
});

// ── Profile ───────────────────────────────────────────────────────────────────
async function loadProfile() {
  const { data } = await sb.from('agents').select('full_name, codename, bank_name, bank_number').eq('id', currentUser.id).maybeSingle();
  _accountData = data || {};
  renderAccount(_accountData);
}

function renderAccount(d) {
  const fnEl = document.getElementById('acc-fullname');
  if (fnEl) fnEl.value = d.full_name || '';
  renderCodenameField(d.codename);
  const bnEl = document.getElementById('acc-bank-name');
  if (bnEl) bnEl.value = d.bank_name || '';
  const numEl = document.getElementById('acc-bank-number');
  if (numEl) {
    numEl.dataset.real = d.bank_number || '';
    _bankVisible = false;
    numEl.value = maskBankNumber(d.bank_number || '');
  }
}

function renderCodenameField(codename) {
  const wrap = document.getElementById('acc-codename-wrap');
  if (!wrap) return;
  wrap.textContent = '';
  if (codename) {
    const display = document.createElement('div');
    display.className = 'codename-locked';
    const code = document.createElement('span');
    code.textContent = codename;
    const lock = document.createElement('span');
    lock.className = 'lock-icon';
    lock.textContent = '🔒';
    display.appendChild(code);
    display.appendChild(lock);
    wrap.appendChild(display);
  } else {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:8px;';
    const input = document.createElement('input');
    input.type = 'text';
    input.id = 'codename-input';
    input.maxLength = 20;
    input.placeholder = 'Set your agent code…';
    input.style.flex = '1';
    input.style.textTransform = 'uppercase';
    input.addEventListener('input', () => { input.value = input.value.toUpperCase(); });
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn-primary btn-sm';
    btn.textContent = 'Set Code';
    btn.addEventListener('click', () => setCodename(input.value.trim()));
    row.appendChild(input);
    row.appendChild(btn);
    wrap.appendChild(row);
  }
}

async function setCodename(val) {
  if (!val) return;
  val = val.toUpperCase();
  const { data: existing } = await sb.from('agents').select('id').eq('codename', val).neq('id', currentUser.id);
  if (existing && existing.length > 0) {
    showToast('That agent code is already taken. Please choose another.');
    return;
  }
  const { error } = await sb.from('agents').update({ codename: val }).eq('id', currentUser.id);
  if (error) { showToast('Error saving. Please try again.'); return; }
  _accountData.codename = val;
  renderCodenameField(val);
  showToast('Agent code set!');
}

function maskBankNumber(num) {
  if (!num) return '';
  if (num.length <= 4) return '•'.repeat(num.length);
  return '•'.repeat(num.length - 4) + num.slice(-4);
}

function toggleBankNumber() {
  const el = document.getElementById('acc-bank-number');
  if (!el) return;
  _bankVisible = !_bankVisible;
  el.value = _bankVisible ? el.dataset.real : maskBankNumber(el.dataset.real);
}

function enterEditAccount() {
  document.getElementById('acc-bank-name').removeAttribute('readonly');
  const numEl = document.getElementById('acc-bank-number');
  numEl.removeAttribute('readonly');
  numEl.value = numEl.dataset.real;
  _bankVisible = true;
  document.getElementById('btn-toggle-bank').disabled = true;
  document.getElementById('btn-edit-account').classList.add('hidden');
  document.getElementById('btn-save-account').classList.remove('hidden');
  document.getElementById('btn-cancel-account').classList.remove('hidden');
}

function exitEditAccount() {
  document.getElementById('acc-bank-name').setAttribute('readonly', '');
  const numEl = document.getElementById('acc-bank-number');
  numEl.setAttribute('readonly', '');
  numEl.value = maskBankNumber(numEl.dataset.real);
  _bankVisible = false;
  document.getElementById('btn-toggle-bank').disabled = false;
  document.getElementById('btn-edit-account').classList.remove('hidden');
  document.getElementById('btn-save-account').classList.add('hidden');
  document.getElementById('btn-cancel-account').classList.add('hidden');
  renderAccount(_accountData);
}

async function saveAccount() {
  const bankName   = document.getElementById('acc-bank-name').value.trim();
  const bankNumber = document.getElementById('acc-bank-number').value.trim();
  const { error } = await sb.from('agents').update({ bank_name: bankName, bank_number: bankNumber }).eq('id', currentUser.id);
  if (error) { showToast('Error saving account.'); return; }
  _accountData.bank_name   = bankName;
  _accountData.bank_number = bankNumber;
  document.getElementById('acc-bank-number').dataset.real = bankNumber;
  exitEditAccount();
  showToast('Account saved!');
}

// ── Withdrawal ────────────────────────────────────────────────────────────────
async function loadWithdrawal() {
  // Total paid commission from invoices for this agent
  const { data: invoices } = await sb
    .from('invoices')
    .select('commission_amount')
    .eq('agent_id', currentUser.id)
    .eq('status', 'paid');
  const totalEarned = (invoices || []).reduce((s, r) => s + (Number(r.commission_amount) || 0), 0);

  // Total already requested (pending + paid — exclude rejected)
  const { data: withdrawals } = await sb
    .from('withdrawals')
    .select('*')
    .eq('agent_id', currentUser.id)
    .order('created_at', { ascending: false });

  const totalWithdrawn = (withdrawals || [])
    .filter(w => w.status !== 'rejected')
    .reduce((s, w) => s + (Number(w.amount) || 0), 0);

  const available = Math.max(0, totalEarned - totalWithdrawn);
  document.getElementById('withdraw-available').textContent = 'NT$' + available.toLocaleString();

  const btn = document.getElementById('btn-withdraw');
  btn.disabled = available < 1000;
  btn.dataset.amount = available;

  renderWithdrawals(withdrawals || []);
}

function renderWithdrawals(rows) {
  const tbody = document.getElementById('withdraw-tbody');
  if (!rows.length) {
    setTbodyMsg(tbody, 4, 'No withdrawals yet.');
    return;
  }
  const frag = document.createDocumentFragment();
  rows.forEach(w => {
    const tr = document.createElement('tr');
    const date = tr.insertCell();
    date.textContent = new Date(w.created_at).toLocaleDateString();
    const amt = tr.insertCell();
    amt.textContent = 'NT$' + Number(w.amount).toLocaleString();
    const st = tr.insertCell();
    const badge = document.createElement('span');
    badge.className = 'withdraw-status-' + w.status;
    badge.textContent = w.status.charAt(0).toUpperCase() + w.status.slice(1);
    st.appendChild(badge);
    const paid = tr.insertCell();
    paid.textContent = w.paid_at ? new Date(w.paid_at).toLocaleDateString() : '—';
    frag.appendChild(tr);
  });
  tbody.replaceChildren(frag);
}

async function requestWithdrawal() {
  const btn = document.getElementById('btn-withdraw');
  const amount = Number(btn.dataset.amount);
  if (amount < 1000) return;

  btn.disabled = true;
  btn.textContent = 'Requesting…';

  try {
    const { error } = await sb.from('withdrawals').insert({ agent_id: currentUser.id, amount });
    if (error) throw error;

    if (WITHDRAW_WEBHOOK_URL) {
      await fetch(WITHDRAW_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_id: currentUser.id, amount })
      });
    }

    showToast('Withdrawal request submitted!');
    await loadWithdrawal();
  } catch (e) {
    showToast('Error submitting withdrawal. Please try again.');
  }

  btn.disabled = amount < 1000;
  btn.textContent = 'Request Withdrawal';
}
