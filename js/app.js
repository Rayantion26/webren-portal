/* -- Config -- */
/* -- Error sanitizer -- */
function safeErr(error) {
  if (!error) return 'Something went wrong. Please try again.';
  const m = error.message || '';
  if (m.includes('Email not allowed to register')) return 'Registration closed. Contact Aaron to join.';
  if (m.includes('Invalid login credentials'))     return 'Incorrect email or password.';
  if (m.includes('Email not confirmed'))           return 'Please confirm your email before signing in.';
  if (m.includes('User already registered'))       return 'An account with this email already exists.';
  if (m.includes('Password should be'))            return 'Password must be at least 8 characters.';
  if (m.includes('duplicate key'))                 return 'This entry already exists.';
  if (m.includes('rate limit') || m.includes('too many requests')) return 'Too many attempts. Please wait a moment.';
  if (m.includes('timed out') || m.includes('timeout')) return 'Connection timed out. Please try again.';
  if (m.includes('JWT') || m.includes('token'))   return 'Session expired. Please sign in again.';
  if (error.code === 'PGRST')                      return 'Something went wrong. Please try again.';
  return 'Something went wrong. Please try again.';
}
const SUPABASE_URL  = 'https://gfcncubcurtnzupycwnf.supabase.co';
const SUPABASE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdmY25jdWJjdXJ0bnp1cHljd25mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyMzQ4MzYsImV4cCI6MjA4OTgxMDgzNn0.Hbuo8Zl1MNjq8bUlc7Ed_HSBmGQiNHc9wDqKd4XDdOE';
const COMMISSION    = 0.15;
const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
// Warm up the Supabase connection immediately on page load so it's ready before the user clicks Sign In
sb.from('allowed_emails').select('count', { count: 'exact', head: true }).then(() => {}).catch(() => {});
function pt(key, fallback) {
  const lang = localStorage.getItem('webren_lang') || 'en';
  const s = window.PORTAL_STRINGS && window.PORTAL_STRINGS[lang];
  return (s && s[key] !== undefined) ? s[key] : (fallback !== undefined ? fallback : key);
}
let lastClients = [];
let lastInvoices = [];
let _pendingRegData = null;

function escHtml(str) {
  if (str == null) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function escAttr(s) { return escHtml(s); }
let currentUser = null;
let isAdmin     = false;
let agentName   = '';
function statusBadge(status) {
  const map = {
    active: ['status-active', pt('status_active', 'Active')],
    hold: ['status-hold', pt('status_hold', 'On Hold')],
    cancelled: ['status-cancelled', pt('status_cancelled', 'Cancelled')],
    inactive: ['status-inactive', pt('status_inactive', 'Inactive')],
    possible_client: ['status-lead', pt('status_possible_client', 'Lead')],
    denied: ['status-denied', pt('status_denied', 'Denied')]
  };
  const cfg = map[status] || ['status-hold', status || 'Unknown'];
  return '<span class="status-badge ' + cfg[0] + '">' + cfg[1] + '</span>';
}
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.auth-tab').forEach(btn => btn.addEventListener('click', () => switchAuthTab(btn.dataset.tab)));
  document.getElementById('form-login').addEventListener('submit', handleLogin);
  document.getElementById('form-register').addEventListener('submit', handleRegister);
  document.getElementById('form-forgot').addEventListener('submit', handleForgotPassword);
  document.getElementById('btn-forgot').addEventListener('click', () => showAuthForm('forgot'));
  document.getElementById('btn-back-login').addEventListener('click', () => showAuthForm('login'));
  document.getElementById('btn-logout').addEventListener('click', handleLogout);
  document.getElementById('btn-open-add-client').addEventListener('click', openModal);
  document.getElementById('btn-close-modal').addEventListener('click', closeModal);
  document.getElementById('add-client-overlay').addEventListener('click', e => { if (e.target === e.currentTarget) closeModal(); });
  document.getElementById('form-add-client').addEventListener('submit', handleAddClient);
  document.getElementById('btn-add-email').addEventListener('click', addAllowedEmail);
  document.getElementById('btn-custom-toggle').addEventListener('click', () => {
    const btn = document.getElementById('btn-custom-toggle');
    const body = document.getElementById('custom-body');
    const open = btn.getAttribute('aria-expanded') === 'true';
    btn.setAttribute('aria-expanded', !open);
    body.classList.toggle('hidden', open);
  });
  document.getElementById('btn-edit-account').addEventListener('click', enterEditAccount);
  document.getElementById('btn-save-account').addEventListener('click', saveAccount);
  document.getElementById('btn-cancel-account').addEventListener('click', exitEditAccount);
  document.getElementById('btn-toggle-bank').addEventListener('click', toggleBankNumber);
  document.getElementById('btn-avatar').addEventListener('click', () => {
    document.getElementById('account-section').scrollIntoView({ behavior: 'smooth' });
  });
  document.getElementById('btn-download-contract-reg').addEventListener('click', function () { downloadContract(this.dataset.name, this.dataset.date); });
  document.getElementById('client-search').addEventListener('input', applyFilters);
  document.getElementById('client-filter-type').addEventListener('change', applyFilters);
  document.getElementById('client-sort').addEventListener('change', applyFilters);
  document.getElementById('client-plan').addEventListener('change', recalcFee);
  initLangTagInput();
  // onAuthStateChange fires INITIAL_SESSION immediately on load in Supabase v2
  // Use it as the single source of truth — no getSession() needed
  sb.auth.onAuthStateChange(async (event, session) => {
    if (session && session.user) {
      if (currentUser && currentUser.id === session.user.id) return; // already loaded (TOKEN_REFRESHED etc.)
      currentUser = session.user; showScreen('dashboard'); await resolveAdmin(); loadDashboard();
    } else {
      currentUser = null; isAdmin = false; showScreen('auth');
    }
  });
});
async function resolveAdmin() {
  try {
    const { data } = await sb.from('agents').select('is_admin, full_name').eq('id', currentUser.id).maybeSingle();
    isAdmin = !!(data && data.is_admin);
    agentName = (data && data.full_name) || currentUser.email;
  } catch (e) {
    isAdmin = false;
    agentName = currentUser.email;
  }
  // Set avatar initials from full name or email
  const initials = agentName.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase() || agentName.slice(0, 2).toUpperCase();
  document.getElementById('header-avatar-initials').textContent = initials;
  document.getElementById('header-user').classList.remove('hidden');
  ['col-paydue', 'col-desc', 'col-approve'].forEach(id => document.getElementById(id).classList.toggle('hidden', !isAdmin));
  document.getElementById('allowed-emails-section').classList.toggle('hidden', !isAdmin);
}
async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-password').value;
  if (!email) { showMsg('login-error', 'Please enter your email address.'); return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showMsg('login-error', 'Please enter a valid email address.'); return; }
  if (!pass)  { showMsg('login-error', 'Please enter your password.'); return; }
  const btn = document.getElementById('btn-login');
  const origText = btn.textContent;
  btn.disabled = true; btn.textContent = 'Signing in\u2026'; showMsg('login-error', '');
  const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 12000));
  let error;
  try {
    const result = await Promise.race([sb.auth.signInWithPassword({ email, password: pass }), timeout]);
    error = result.error;
  } catch (e) {
    error = { message: e.message === 'timeout' ? 'Connection timed out. Please try again.' : e.message };
  }
  if (error) { showMsg('login-error', safeErr(error)); btn.disabled = false; btn.textContent = origText; }
  // on success: onAuthStateChange fires and shows dashboard
}
async function handleRegister(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-register');
  showMsg('reg-error', ''); showMsg('reg-success', '');
  const name  = document.getElementById('reg-name').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const phone = document.getElementById('reg-phone').value.trim();
  const pass  = document.getElementById('reg-password').value;
  if (!name)  { showMsg('reg-error', 'Please enter your full name.'); return; }
  if (!email) { showMsg('reg-error', 'Please enter your email address.'); return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showMsg('reg-error', 'Please enter a valid email address.'); return; }
  if (!phone) { showMsg('reg-error', 'Please enter your phone number.'); return; }
  if (!/^(09\d{2}-?\d{3}-?\d{3}|0\d{1,2}-?\d{6,8})$/.test(phone)) { showMsg('reg-error', 'Please enter a valid Taiwan phone number (e.g. 0912-345-678).'); return; }
  if (pass.length < 8) { showMsg('reg-error', 'Password must be at least 8 characters.'); return; }
  btn.disabled = true;
  // Store pending data and show T&C modal
  _pendingRegData = { name, email, phone, pass };
  btn.disabled = false;
  window.showTncModal && window.showTncModal();
}

async function doSignUp() {
  if (!_pendingRegData) return;
  const { name, email, phone, pass } = _pendingRegData;
  _pendingRegData = null;
  const btn = document.getElementById('btn-register');
  btn.disabled = true;
  showMsg('reg-error', ''); showMsg('reg-success', '');
  // Pre-check whitelist
  const { data: allowed } = await sb.from('allowed_emails').select('email').eq('email', email).maybeSingle();
  if (!allowed) {
    showMsg('reg-error', 'Your email is not on the access list. Please contact Aaron to get added.');
    btn.disabled = false; return;
  }
  const { error } = await sb.auth.signUp({ email, password: pass, options: { data: { full_name: name, phone } } });
  if (error) { showMsg('reg-error', safeErr(error)); }
  else {
    showMsg('reg-success', 'Account created! Please check your email to confirm.', true);
    const dlBtn = document.getElementById('btn-download-contract-reg');
    dlBtn.dataset.name = name;
    dlBtn.dataset.date = new Date().toLocaleDateString('en-GB');
    dlBtn.classList.remove('hidden');
    document.getElementById('form-register').reset();
  }
  btn.disabled = false;
}
window.doSignUp = doSignUp;
async function handleForgotPassword(e) {
  e.preventDefault();
  showMsg('forgot-error', ''); showMsg('forgot-success', '');
  const email = document.getElementById('forgot-email').value.trim();
  if (!email) { showMsg('forgot-error', 'Please enter your email address.'); return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showMsg('forgot-error', 'Please enter a valid email address.'); return; }
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + '/' });
  if (error) { showMsg('forgot-error', safeErr(error)); }
  else { showMsg('forgot-success', 'Reset link sent - check your inbox.', true); }
}
async function handleLogout() { await sb.auth.signOut(); document.getElementById('header-user').classList.add('hidden'); }
async function loadDashboard() {
  await Promise.all([loadClients(), loadLeads(), loadInvoices()]);
  if (isAdmin) loadAllowedEmails();
  loadProfile();
}
async function loadClients() {
  const tbody = document.getElementById('clients-tbody');
  const cols = isAdmin ? 10 : 7;
  tbody.innerHTML = '<tr><td colspan="' + cols + '" class="empty-row">' + pt('loading', 'Loading\u2026') + '</td></tr>';
  const query = isAdmin
    ? sb.from('clients').select('*, agents(full_name)').not('status', 'in', '("possible_client","denied")').order('created_at', { ascending: false })
    : sb.from('clients').select('*').eq('agent_id', currentUser.id).not('status', 'in', '("possible_client","denied")').order('created_at', { ascending: false });
  const { data, error } = await query;
  if (error) { tbody.innerHTML = '<tr><td colspan="' + cols + '" class="empty-row">' + pt('err_clients', 'Error loading clients.') + '</td></tr>'; return; }
  lastClients = data || [];
  renderStats(lastClients);
  applyFilters();
  await loadTotalEarned();
}
let lastLeads = [];
async function loadLeads() {
  const tbody = document.getElementById('leads-tbody');
  tbody.replaceChildren();
  const tr0 = tbody.insertRow(); const td0 = tr0.insertCell(); td0.colSpan = 4; td0.className = 'empty-row'; td0.textContent = pt('loading', 'Loading\u2026');
  const query = isAdmin
    ? sb.from('clients').select('*, agents(full_name)').eq('status', 'possible_client').order('created_at', { ascending: false })
    : sb.from('clients').select('*').eq('agent_id', currentUser.id).eq('status', 'possible_client').order('created_at', { ascending: false });
  const { data, error } = await query;
  if (error) { tbody.replaceChildren(); const tr = tbody.insertRow(); const td = tr.insertCell(); td.colSpan = 4; td.className = 'empty-row'; td.textContent = pt('err_leads', 'Error loading leads.'); return; }
  lastLeads = data || [];
  renderLeads(lastLeads);
}
function renderLeads(leads) {
  const tbody = document.getElementById('leads-tbody');
  if (!leads.length) { tbody.replaceChildren(); const tr = tbody.insertRow(); const td = tr.insertCell(); td.colSpan = 4; td.className = 'empty-row'; td.textContent = pt('no_leads', 'No pending leads.'); return; }
  const typeLabels = { store: pt('type_store', 'Store'), restaurant: pt('type_restaurant', 'Restaurant'), company: pt('type_company', 'Company') };
  const frag = document.createDocumentFragment();
  leads.forEach(lead => {
    const tr = document.createElement('tr');
    const tdName = document.createElement('td');
    if (isAdmin && lead.agents) { const s = document.createElement('span'); s.style.cssText = 'font-size:0.8rem;color:var(--text-muted)'; s.textContent = lead.agents.full_name || ''; tdName.appendChild(s); tdName.appendChild(document.createElement('br')); }
    tdName.appendChild(document.createTextNode(lead.client_name || ''));
    const tdType = document.createElement('td'); tdType.textContent = typeLabels[lead.type] || lead.type || '\u2014';
    const tdDate = document.createElement('td'); tdDate.textContent = lead.created_at ? new Date(lead.created_at).toLocaleDateString() : '\u2014';
    const tdAct = document.createElement('td');
    const cb = document.createElement('button'); cb.type = 'button'; cb.className = 'btn-primary btn-sm'; cb.textContent = pt('btn_confirm_lead', 'Confirm'); cb.addEventListener('click', () => confirmLead(lead.id));
    const db = document.createElement('button'); db.type = 'button'; db.className = 'btn-deny'; db.style.marginLeft = '4px'; db.textContent = pt('btn_deny_lead', 'Deny'); db.addEventListener('click', () => denyLead(lead.id));
    tdAct.appendChild(cb); tdAct.appendChild(db);
    tr.appendChild(tdName); tr.appendChild(tdType); tr.appendChild(tdDate); tr.appendChild(tdAct);
    frag.appendChild(tr);
  });
  tbody.replaceChildren(frag);
}
function confirmLead(id) {
  const lead = lastLeads.find(l => l.id === id);
  if (!lead) return;
  document.getElementById('client-name').value = lead.client_name || '';
  document.getElementById('client-type').value = lead.type || 'store';
  const demoGroup = document.getElementById('demo-data-group');
  const demoArea = document.getElementById('client-demo-data');
  if (lead.demo_data) { demoArea.value = JSON.stringify(lead.demo_data, null, 2); demoGroup.classList.remove('hidden'); }
  else { demoArea.value = ''; demoGroup.classList.add('hidden'); }
  document.getElementById('form-add-client').dataset.leadId = id;
  // Hide customization section for lead confirmations — client already chose their config
  document.getElementById('custom-section').classList.add('hidden');
  openModal();
  showToast(pt('toast_lead_confirmed', 'Lead confirmed \u2014 fill in the details.'));
}
async function denyLead(id) {
  const { error } = await sb.from('clients').update({ status: 'denied' }).eq('id', id);
  if (error) { showToast('Error denying lead.'); return; }
  showToast(pt('toast_lead_denied', 'Lead denied.')); loadLeads();
}
function renderClients(clients) {
  const tbody = document.getElementById('clients-tbody');
  const cols = isAdmin ? 10 : 7;
  if (!clients.length) { tbody.innerHTML = '<tr><td colspan="' + cols + '" class="empty-row">' + pt('no_clients', 'No clients yet.') + '</td></tr>'; document.getElementById('total-commission').textContent = 'NT$0'; return; }
  let totalComm = 0;
  const typeLabels = { store: pt('type_store', 'Store'), restaurant: pt('type_restaurant', 'Restaurant'), company: pt('type_company', 'Company') };
  const rows = clients.map(c => {
    const fee = Number(c.monthly_fee) || 0; const comm = fee * COMMISSION;
    if (c.status === 'active') totalComm += comm;
    const badge = statusBadge(c.status);
    const agentInfo = (isAdmin && c.agents) ? '<span style="font-size:0.8rem;color:var(--text-muted)">' + escHtml(c.agents.full_name) + '</span><br>' : '';
    const startDate = c.start_date ? new Date(c.start_date).toLocaleDateString() : '—';
    const typeLabel = typeLabels[c.type] || escHtml(c.type) || '—';
    let adminCols = '';
    if (isAdmin) {
      const statuses = ['hold', 'active', 'cancelled', 'inactive'];
      const labels   = { hold: 'On Hold', active: 'Active', cancelled: 'Cancelled', inactive: 'Inactive' };
      const opts = statuses.map(s => '<option value="' + s + '"' + (c.status === s ? ' selected' : '') + '>' + labels[s] + '</option>').join('');
      const due = c.payment_deadline ? new Date(c.payment_deadline).toLocaleDateString() : (c.status === 'hold' ? '7 days from start' : '—');
      adminCols = '<td>' + due + '</td>'
        + '<td><input class="desc-input" data-id="' + escAttr(c.id) + '" value="' + escAttr(c.description || '') + '" placeholder="Notes…"></td>'
        + '<td><select class="status-select" data-id="' + escAttr(c.id) + '">' + opts + '</select></td>';
    }
    return '<tr><td>' + agentInfo + escHtml(c.client_name)
      + '</td><td>' + escHtml(c.plan)
      + '</td><td>NT$' + fee.toLocaleString()
      + '</td><td>NT$' + comm.toLocaleString()
      + '</td><td>' + badge
      + '</td><td>' + startDate
      + '</td><td>' + typeLabel
      + adminCols + '</tr>';
  });
  tbody.innerHTML = rows.join('');
  document.getElementById('total-commission').textContent = 'NT$' + totalComm.toLocaleString();
  if (isAdmin) {
    tbody.querySelectorAll('.status-select').forEach(sel => sel.addEventListener('change', () => updateClientStatus(sel.dataset.id, sel.value)));
    tbody.querySelectorAll('.desc-input').forEach(inp => {
      let timer;
      inp.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => updateClientDesc(inp.dataset.id, inp.value), 800); });
    });
  }
}
function renderStats(clients) {
  const active = clients.filter(c => c.status === 'active');
  const monthly = active.reduce((s, c) => s + Number(c.monthly_fee) * COMMISSION, 0);
  document.getElementById('stat-clients').textContent = clients.length;
  document.getElementById('stat-monthly').textContent = 'NT$' + monthly.toLocaleString();
  document.getElementById('stat-yearly').textContent  = 'NT$' + (monthly * 12).toLocaleString();
}
async function loadTotalEarned() {
  let query = sb.from('invoices').select('commission_amount').eq('status', 'paid');
  if (!isAdmin) query = query.eq('agent_id', currentUser.id);
  const { data } = await query;
  const total = (data || []).reduce((s, r) => s + Number(r.commission_amount), 0);
  document.getElementById('stat-earned').textContent = 'NT$' + total.toLocaleString();
}
async function updateClientStatus(id, status) {
  const update = { status };
  if (status === 'active') update.start_date = new Date().toISOString().split('T')[0];
  const { error } = await sb.from('clients').update(update).eq('id', id);
  if (error) { showToast('Error updating status.'); loadClients(); return; }
  showToast(pt('toast_status', 'Status updated!')); renderStats([]); loadClients();
}
async function updateClientDesc(id, description) {
  const { error } = await sb.from('clients').update({ description }).eq('id', id);
  if (error) showToast('Error saving notes.');
}
async function loadInvoices() {
  const tbody = document.getElementById('invoices-tbody');
  tbody.innerHTML = '<tr><td colspan="4" class="empty-row">' + pt('loading', 'Loading\u2026') + '</td></tr>';
  let query = sb.from('invoices').select('*, clients(client_name)').eq('status', 'pending').order('due_date');
  if (!isAdmin) query = query.eq('agent_id', currentUser.id);
  const { data, error } = await query;
  if (error) { tbody.innerHTML = '<tr><td colspan="4" class="empty-row">' + pt('err_invoices', 'Error loading invoices.') + '</td></tr>'; return; }
  renderInvoices(data || []);
}
function renderInvoices(invoices) {
  lastInvoices = invoices;
  const tbody = document.getElementById('invoices-tbody');
  if (!invoices.length) { tbody.innerHTML = '<tr><td colspan="4" class="empty-row">' + pt('no_invoices', 'No pending invoices.') + '</td></tr>'; return; }
  const rows = invoices.map(inv => {
    const amount = Number(inv.commission_amount) || 0;
    const due = inv.due_date ? new Date(inv.due_date).toLocaleDateString() : '—';
    const client = (inv.clients && inv.clients.client_name) || '—';
    const payBtn = isAdmin ? '<button type="button" class="btn-pay" data-id="' + escAttr(inv.id) + '">' + pt('btn_mark_paid', 'Mark Paid') + '</button>' : '<span style="color:var(--text-muted);font-size:0.85rem">' + pt('btn_pending', 'Pending') + '</span>';
    return '<tr><td>' + escHtml(client) + '</td><td>NT$' + amount.toLocaleString() + '</td><td>' + due + '</td><td>' + payBtn + '</td></tr>';
  });
  tbody.innerHTML = rows.join('');
  tbody.querySelectorAll('.btn-pay').forEach(btn => btn.addEventListener('click', () => markInvoicePaid(btn.dataset.id)));
}
async function markInvoicePaid(id) {
  if (!isAdmin) return;
  const { error } = await sb.from('invoices').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', id);
  if (error) { showToast('Error updating invoice.'); return; }
  showToast(pt('toast_invoice', 'Invoice marked as paid!')); loadInvoices(); loadTotalEarned();
}
/* ── Language tag input ─────────────────────────────────────────────────── */
const LANG_LIST = [
  'English','Traditional Chinese','Simplified Chinese','Japanese','Korean',
  'Thai','Indonesian','Vietnamese','Malay','French','Spanish','German',
  'Portuguese','Arabic','Hindi','Italian','Dutch','Russian','Turkish','Polish'
];
const LANG_FEE = 700;
const BASE_FEES = { 'Option A Basic': 3000, 'Option A Professional': 4500, 'Option A Premium': 5000 };
let selectedLangs = [];

function recalcFee() {
  const plan = document.getElementById('client-plan').value;
  const feeEl = document.getElementById('client-fee');
  if (BASE_FEES[plan] != null) {
    feeEl.value = BASE_FEES[plan] + selectedLangs.length * LANG_FEE;
    feeEl.readOnly = true;
  } else {
    feeEl.readOnly = false;
    if (!feeEl.value) feeEl.value = '';
  }
}

function renderLangTags() {
  const container = document.getElementById('lang-tags');
  container.replaceChildren(...selectedLangs.map(l => {
    const tag = document.createElement('span');
    tag.className = 'lang-tag';
    tag.textContent = l + ' ';
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'lang-tag-remove';
    btn.setAttribute('aria-label', 'Remove'); btn.textContent = '\u00d7';
    btn.addEventListener('click', () => {
      selectedLangs = selectedLangs.filter(x => x !== l);
      renderLangTags(); recalcFee();
    });
    tag.appendChild(btn);
    return tag;
  }));
}

function showLangSuggestions(query) {
  const box = document.getElementById('lang-suggestions');
  const matches = query
    ? LANG_LIST.filter(l => l.toLowerCase().includes(query.toLowerCase()) && !selectedLangs.includes(l))
    : [];
  if (!matches.length) { box.classList.add('hidden'); return; }
  const frag = document.createDocumentFragment();
  matches.slice(0, 7).forEach(l => {
    const item = document.createElement('div');
    item.className = 'lang-suggestion-item';
    item.textContent = l; item.dataset.lang = l;
    item.addEventListener('mousedown', e => {
      e.preventDefault();
      if (!selectedLangs.includes(l)) { selectedLangs.push(l); renderLangTags(); recalcFee(); }
      document.getElementById('lang-tag-search').value = '';
      box.classList.add('hidden');
    });
    frag.appendChild(item);
  });
  box.replaceChildren(frag);
  box.classList.remove('hidden');
}

function initLangTagInput() {
  const search = document.getElementById('lang-tag-search');
  const wrap   = document.getElementById('lang-tag-wrap');
  search.addEventListener('input', () => showLangSuggestions(search.value));
  search.addEventListener('blur',  () => setTimeout(() => document.getElementById('lang-suggestions').classList.add('hidden'), 150));
  wrap.addEventListener('click',   () => search.focus());
}

function resetLangTags() {
  selectedLangs = []; renderLangTags();
  const s = document.getElementById('lang-tag-search');
  if (s) s.value = '';
  document.getElementById('lang-suggestions').classList.add('hidden');
}

const PORTAL_PRESET_THEMES = {
  ivory:    { primary: '#0D9488', accent: '#7C3AED', bg: '#FAFAFA',  text: '#111827' },
  midnight: { primary: '#38BDF8', accent: '#818CF8', bg: '#0D1117',  text: '#F9FAFB' },
  ocean:    { primary: '#06B6D4', accent: '#38BDF8', bg: '#0F1F3D',  text: '#E0F2FE' },
  forest:   { primary: '#10B981', accent: '#FCD34D', bg: '#0F2318',  text: '#D1FAE5' },
  sunset:   { primary: '#F97316', accent: '#EF4444', bg: '#1C0A00',  text: '#FEF3C7' },
  rose:     { primary: '#EC4899', accent: '#8B5CF6', bg: '#FFF1F5',  text: '#1F0010' },
  arctic:   { primary: '#0284C7', accent: '#6366F1', bg: '#F0F9FF',  text: '#0C4A6E' },
  obsidian: { primary: '#A1A1AA', accent: '#71717A', bg: '#09090B',  text: '#FAFAFA'  },
  amethyst: { primary: '#A855F7', accent: '#EC4899', bg: '#1A0A2E',  text: '#EDE9FE' },
  marigold: { primary: '#D97706', accent: '#EF4444', bg: '#FFFBEB',  text: '#422006' },
};

async function handleAddClient(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-submit-client');
  btn.disabled = true; showMsg('add-client-error', '');
  const clientData = {
    client_name: document.getElementById('client-name').value.trim(),
    plan: document.getElementById('client-plan').value,
    monthly_fee: Number(document.getElementById('client-fee').value),
    description: document.getElementById('client-desc').value.trim() || null,
    type: document.getElementById('client-type').value,
    languages: selectedLangs.length ? selectedLangs.join(', ') : null,
    status: 'hold',
  };
  const leadId = e.target.dataset.leadId;
  let error;
  if (leadId) {
    // Confirming a lead: update existing record, preserve existing demo_data
    ({ error } = await sb.from('clients').update(clientData).eq('id', leadId));
    delete e.target.dataset.leadId;
  } else {
    // Manual add: include agent customization preferences in demo_data
    const presetId = document.getElementById('client-preset').value;
    const bgStyle  = document.getElementById('client-bg-style').value;
    const headFont = document.getElementById('client-heading-font').value;
    const bodyFont = document.getElementById('client-body-font').value;
    const hasCustom = presetId || bgStyle || headFont || bodyFont;
    if (hasCustom) {
      const theme = PORTAL_PRESET_THEMES[presetId] || null;
      clientData.demo_data = {
        config: {
          mode: clientData.type,
          theme: theme || null,
          preset: presetId || null,
          fonts: { heading: headFont || null, body: bodyFont || null },
          bgStyle: bgStyle || null,
        }
      };
    }
    ({ error } = await sb.from('clients').insert({ ...clientData, agent_id: currentUser.id }));
  }
  if (error) { showMsg('add-client-error', safeErr(error)); }
  else {
    closeModal(); e.target.reset(); resetLangTags();
    // Reset customization section
    document.getElementById('btn-custom-toggle').setAttribute('aria-expanded', 'false');
    document.getElementById('custom-body').classList.add('hidden');
    showToast(pt('toast_client', 'Client submitted for approval!')); loadClients(); loadLeads();
  }
  btn.disabled = false;
}
function showScreen(name) {
  document.getElementById('auth-screen').classList.toggle('hidden', name !== 'auth');
  document.getElementById('dashboard-screen').classList.toggle('hidden', name !== 'dashboard');
}
function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  showAuthForm(tab);
}
function showAuthForm(name) {
  ['login', 'register', 'forgot'].forEach(f => document.getElementById('form-' + f).classList.toggle('hidden', f !== name));
  if (name === 'login' || name === 'register') switchAuthTab(name);
}
function openModal()  {
  document.getElementById('custom-section').classList.remove('hidden');
  document.getElementById('add-client-overlay').classList.remove('hidden');
}
function closeModal() {
  document.getElementById('add-client-overlay').classList.add('hidden');
  resetLangTags();
  delete document.getElementById('form-add-client').dataset.leadId;
  document.getElementById('demo-data-group').classList.add('hidden');
  document.getElementById('client-demo-data').value = '';
}
function showMsg(id, msg, success) {
  const el = document.getElementById(id); if (!el) return;
  el.textContent = msg; el.classList.toggle('hidden', !msg); el.classList.toggle('success', !!success);
}
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.remove('hidden');
  clearTimeout(t._timer); t._timer = setTimeout(() => t.classList.add('hidden'), 3000);
}

async function loadAllowedEmails() {
  const tbody = document.getElementById('allowed-emails-tbody');
  tbody.innerHTML = '<tr><td colspan="5" class="empty-row">' + pt('loading', 'Loading\u2026') + '</td></tr>';
  const { data, error } = await sb.from('allowed_emails').select('*').order('created_at', { ascending: false });
  if (error) { tbody.innerHTML = '<tr><td colspan="5" class="empty-row">' + pt('err_allowed', 'Error loading.') + '</td></tr>'; return; }
  renderAllowedEmails(data || []);
}
function renderAllowedEmails(rows) {
  const tbody = document.getElementById('allowed-emails-tbody');
  if (!rows.length) { tbody.replaceChildren(); const tr = tbody.insertRow(); const td = tr.insertCell(); td.colSpan = 4; td.className = 'empty-row'; td.textContent = pt('no_allowed', 'No emails yet.'); return; }
  const frag = document.createDocumentFragment();
  rows.forEach(r => {
    const tr = document.createElement('tr');
    const tdEmail = tr.insertCell(); tdEmail.textContent = r.email;
    const tdFree = tr.insertCell();
    const cbFree = document.createElement('input'); cbFree.type = 'checkbox'; cbFree.checked = !!r.is_free; cbFree.className = 'ae-free';
    cbFree.addEventListener('change', () => toggleAEFlag(r.email, 'is_free', cbFree.checked));
    tdFree.appendChild(cbFree);
    const tdAdded = tr.insertCell(); tdAdded.textContent = r.created_at ? new Date(r.created_at).toLocaleDateString() : '\u2014';
    const tdAct = tr.insertCell();
    const delBtn = document.createElement('button'); delBtn.className = 'btn-remove-email'; delBtn.textContent = pt('btn_remove', 'Remove');
    delBtn.addEventListener('click', () => removeAllowedEmail(r.email));
    tdAct.appendChild(delBtn);
    frag.appendChild(tr);
  });
  tbody.replaceChildren(frag);
}
async function addAllowedEmail() {
  const emailEl = document.getElementById('new-allowed-email');
  const email = emailEl.value.trim();
  if (!email) { showToast(pt('toast_enter_email', 'Enter an email address.')); return; }
  const is_free = document.getElementById('new-email-free').checked;
  const { error } = await sb.from('allowed_emails').insert({ email, is_free });
  if (error) { showToast(safeErr(error)); return; }
  showToast(pt('toast_email_added', 'Email added!')); emailEl.value = '';
  document.getElementById('new-email-free').checked = false;
  loadAllowedEmails();
}
async function removeAllowedEmail(email) {
  const { error } = await sb.from('allowed_emails').delete().eq('email', email);
  if (error) { showToast('Error removing email.'); return; }
  showToast(pt('toast_email_removed', 'Email removed.')); loadAllowedEmails();
}
async function toggleAEFlag(email, field, val) {
  const upd = {}; upd[field] = val;
  const { error } = await sb.from('allowed_emails').update(upd).eq('email', email);
  if (error) showToast('Error updating.');
}

function applyFilters() {
  const search = (document.getElementById('client-search')?.value || '').toLowerCase().trim();
  const filterType = document.getElementById('client-filter-type')?.value || '';
  const sortVal = document.getElementById('client-sort')?.value || 'newest';
  let filtered = lastClients.slice();
  if (search) {
    filtered = filtered.filter(c => {
      const name = (c.client_name || '').toLowerCase();
      const agent = ((c.agents && c.agents.full_name) || '').toLowerCase();
      return name.includes(search) || agent.includes(search);
    });
  }
  if (filterType) {
    filtered = filtered.filter(c => (c.type || 'store') === filterType);
  }
  if (sortVal === 'agent') {
    filtered.sort((a, b) => {
      const an = ((a.agents && a.agents.full_name) || '').toLowerCase();
      const bn = ((b.agents && b.agents.full_name) || '').toLowerCase();
      return an.localeCompare(bn);
    });
  } else if (sortVal === 'type') {
    filtered.sort((a, b) => (a.type || 'store').localeCompare(b.type || 'store'));
  }
  renderClients(filtered);
}

document.addEventListener('portal:lang', () => {
  if (window.applyPortalStrings) window.applyPortalStrings(localStorage.getItem('webren_lang') || 'en');
  const welcomeEl = document.getElementById('header-welcome');
  if (welcomeEl && agentName) welcomeEl.textContent = pt('welcome', 'Welcome, ') + agentName;
  applyFilters();
  renderInvoices(lastInvoices);
  if (currentUser && isAdmin) loadAllowedEmails();
});

// ── Account section ───────────────────────────────────────────────────────────
let _accountData = {}; // cached account data from DB
let _bankVisible = false;

async function loadProfile() {
  const { data } = await sb.from('agents').select('full_name, codename, bank_name, bank_number').eq('id', currentUser.id).maybeSingle();
  _accountData = data || {};
  renderAccount(_accountData);
}

function renderAccount(d) {
  // Full name
  const fnEl = document.getElementById('acc-fullname');
  if (fnEl) fnEl.value = d.full_name || '';

  // Codename — locked once set
  renderCodenameField(d.codename);

  // Bank name
  const bnEl = document.getElementById('acc-bank-name');
  if (bnEl) bnEl.value = d.bank_name || '';

  // Bank number — masked by default
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
    // Locked — show as read-only display
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
    // Not set — show input + set button
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:8px;';
    const input = document.createElement('input');
    input.type = 'text';
    input.id = 'codename-input';
    input.maxLength = 20;
    input.placeholder = pt('hint_codename', 'Set your agent code…');
    input.style.flex = '1';
    input.style.textTransform = 'uppercase';
    input.addEventListener('input', () => { input.value = input.value.toUpperCase(); });
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn-primary btn-sm';
    btn.textContent = pt('btn_set_codename', 'Set Code');
    btn.addEventListener('click', () => setCodename(input.value.trim()));
    row.appendChild(input);
    row.appendChild(btn);
    wrap.appendChild(row);
  }
}

async function setCodename(val) {
  if (!val) return;
  val = val.toUpperCase();
  // Check uniqueness — query other agents with same codename
  const { data: existing } = await sb.from('agents').select('id').eq('codename', val).neq('id', currentUser.id);
  if (existing && existing.length > 0) {
    showToast(pt('toast_codename_taken', 'That agent code is already taken.'));
    return;
  }
  const { error } = await sb.from('agents').update({ codename: val }).eq('id', currentUser.id);
  if (error) { showToast(pt('toast_account_error', 'Error saving.')); return; }
  _accountData.codename = val;
  renderCodenameField(val);
  showToast(pt('toast_account_saved', 'Account saved!'));
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
  document.getElementById('btn-toggle-bank').title = _bankVisible ? 'Hide' : 'Show';
}

function enterEditAccount() {
  // Unlock bank name + bank number inputs
  document.getElementById('acc-bank-name').removeAttribute('readonly');
  // Show real bank number for editing
  const numEl = document.getElementById('acc-bank-number');
  numEl.removeAttribute('readonly');
  numEl.value = numEl.dataset.real;
  _bankVisible = true;
  document.getElementById('btn-toggle-bank').disabled = true;
  // Swap buttons
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
  // Restore from cached data
  renderAccount(_accountData);
}

async function saveAccount() {
  const bankName   = document.getElementById('acc-bank-name').value.trim();
  const bankNumber = document.getElementById('acc-bank-number').value.trim();
  const { error } = await sb.from('agents').update({ bank_name: bankName, bank_number: bankNumber }).eq('id', currentUser.id);
  if (error) { showToast(pt('toast_account_error', 'Error saving account.')); return; }
  _accountData.bank_name   = bankName;
  _accountData.bank_number = bankNumber;
  document.getElementById('acc-bank-number').dataset.real = bankNumber;
  exitEditAccount();
  showToast(pt('toast_account_saved', 'Account saved!'));
}
function downloadContract(name, date) {
  if (typeof html2pdf === "undefined" || typeof contractHTML === "undefined") {
    showToast('PDF library not loaded. Try again in a moment.'); return;
  }
  const safeName = name || 'Agent';
  const safeDate = date || new Date().toLocaleDateString('en-GB');
  html2pdf().set({
    margin: 0,
    filename: 'WebRen-Agent-Agreement.pdf',
    html2canvas: { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff' },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  }).from(contractHTML(escHtml(safeName), escHtml(safeDate))).save();
}
