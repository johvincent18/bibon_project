const TOKEN_KEY = 'cellhubToken';
const $ = (id) => document.getElementById(id);
const peso = (n) => '\u20B1' + Number(n).toLocaleString('en-PH', { maximumFractionDigits: 2 });
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- STORAGE ----------
function getToken() {
  try { return localStorage.getItem(TOKEN_KEY); } catch (err) { return null; }
}
function setToken(token) {
  try { localStorage.setItem(TOKEN_KEY, token); } catch (err) { /* page still works this visit */ }
}
function clearToken() {
  try { localStorage.removeItem(TOKEN_KEY); } catch (err) { /* nothing to clear */ }
}
function flashSet(key, value) {
  try { sessionStorage.setItem(key, value); } catch (err) { /* ignore */ }
}
function flashTake(key) {
  try {
    const value = sessionStorage.getItem(key);
    sessionStorage.removeItem(key);
    return value;
  } catch (err) {
    return null;
  }
}

// ---------- MESSAGES (toast) ----------
let messageTimer;
function showMessage(text, isError) {
  const box = $('message');
  box.textContent = (isError ? 'Problem: ' : '') + text;
  box.className = (isError ? 'error' : 'ok') + ' show';
  clearTimeout(messageTimer);
  if (!isError) {
    messageTimer = setTimeout(() => box.classList.remove('show'), 5000);
  }
}
function flash(text, isError) {
  flashSet('cellhubFlash', JSON.stringify({ text, error: !!isError }));
}
function showFlash() {
  const raw = flashTake('cellhubFlash');
  if (!raw) return;
  try {
    const f = JSON.parse(raw);
    showMessage(f.text, f.error);
  } catch (err) { /* ignore */ }
}

// ---------- PAGE TRANSITIONS ----------
function goTo(url) {
  document.body.classList.add('leaving');
  setTimeout(() => { location.href = url; }, reduceMotion() ? 0 : 260);
}
document.addEventListener('click', (event) => {
  const link = event.target.closest('a[data-go]');
  if (!link || event.ctrlKey || event.metaKey || event.shiftKey) return;
  event.preventDefault();
  goTo(link.getAttribute('href'));
});
window.addEventListener('pageshow', () => document.body.classList.remove('leaving'));

// ---------- TALKING TO THE API ----------
async function api(path, options = {}) {
  const { noAuth, ...fetchOptions } = options;
  const headers = { 'Content-Type': 'application/json' };
  const token = noAuth ? null : getToken();
  if (token) headers.Authorization = 'Bearer ' + token;

  let res;
  try {
    res = await fetch(path, { ...fetchOptions, headers });
  } catch (err) {
    throw new Error('Cannot reach the server. Check your internet and try again.');
  }
  let data = null;
  try { data = await res.json(); } catch (err) { /* no JSON body */ }

  if (res.status === 401 && token) {
    clearToken();
    flash('Your login expired. Please log in again.', true);
    location.replace('login.html');
    throw new Error('Your login expired. Please log in again.');
  }
  if (!res.ok) {
    throw new Error((data && data.error) || 'Something went wrong. Please try again.');
  }
  return data;
}

// ---------- FORMS ----------
async function runForm(form, work) {
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    await work();
  } catch (err) {
    showMessage(err.message, true);
  }
  button.disabled = false;
}