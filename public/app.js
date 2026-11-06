const STATUS_LIST = ['Pending', 'In Progress', 'Completed', 'Released'];
const PAGE_SIZE = 5;
const VIEWS = ['dashboard', 'customers', 'payments', 'inventory', 'reports'];
const TITLES = {
  dashboard: 'Dashboard',
  customers: 'Customers',
  payments: 'Payments',
  inventory: 'Inventory',
  reports: 'Reports',
};

let customers = [];
let allJobs = [];
let products = [];
let payments = [];
let report = null;
let currentPage = 1;
let selectedCustomerId = null;

// ---------- SMALL HELPERS ----------
const money2 = (n) => Math.round(Number(n) * 100) / 100;
const balanceOf = (j) => Math.max(0, money2(j.price - (j.paid || 0)));
const sum = (list, key) => list.reduce((t, x) => t + Number(x[key] || 0), 0);

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function addCell(tr, text) {
  const td = el('td');
  td.textContent = text;
  tr.appendChild(td);
  return td;
}
function emptyRow(tbody, text, cols) {
  const tr = el('tr');
  addCell(tr, text).colSpan = cols;
  tbody.appendChild(tr);
}
function badge(kind, text) {
  return el('span', 'badge ' + kind, text);
}
function statusBadge(status) {
  return badge('s-' + String(status).toLowerCase().replace(/[^a-z]+/g, '-'), status);
}
function payState(j) {
  const paid = Number(j.paid || 0);
  if (paid <= 0) return 'Unpaid';
  return balanceOf(j) > 0 ? 'Partial' : 'Paid';
}
function payBadge(j) {
  const state = payState(j);
  const b = badge('p-' + state.toLowerCase(), state);
  if (state === 'Partial') b.title = peso(j.paid) + ' paid of ' + peso(j.price);
  return b;
}
function itemText(p) {
  if (p.job_id) return 'Repair: ' + (p.device_model || 'job #' + p.job_id);
  return (p.product_name || 'Product') + ' x ' + p.quantity;
}
function setOptions(select, placeholder, items) {
  const old = select.value;
  select.replaceChildren();
  if (placeholder !== null) {
    const o = el('option', '', placeholder);
    o.value = '';
    select.appendChild(o);
  }
  for (const it of items) {
    const o = el('option', '', it.label);
    o.value = String(it.value);
    select.appendChild(o);
  }
  if (Array.from(select.options).some((o) => o.value === old)) select.value = old;
}

function countUp(node, to, format) {
  const from = Number(node.dataset.value || 0);
  node.dataset.value = to;
  if (reduceMotion() || from === to) {
    node.textContent = format(to);
    return;
  }
  const startTime = performance.now();
  const duration = 700;
  function step(now) {
    const t = Math.min(1, (now - startTime) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    node.textContent = format(t === 1 ? to : Math.round(from + (to - from) * eased));
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// ---------- NAVIGATION ----------
function showView(name) {
  if (!VIEWS.includes(name)) name = 'dashboard';
  for (const v of VIEWS) $('view-' + v).hidden = v !== name;
  document.querySelectorAll('.nav a').forEach((a) => {
    const on = a.dataset.view === name;
    a.classList.toggle('active', on);
    if (on) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  $('crumb').textContent = TITLES[name];
  document.title = TITLES[name] + ' - CellHub';
  window.scrollTo(0, 0);
  if (name === 'reports') loadReport();
}
function go(name) {
  history.pushState(null, '', '#' + name);
  showView(name);
  $('view-' + name).querySelector('h1').focus({ preventScroll: true });
}
window.addEventListener('hashchange', () => showView(location.hash.slice(1)));
window.addEventListener('popstate', () => showView(location.hash.slice(1)));

// ---------- LOAD DATA ----------
async function loadAll() {
  try {
    const [c, j, p, pay] = await Promise.all([
      api('/customers'),
      api('/jobs/details'),
      api('/products'),
      api('/payments'),
    ]);
    customers = c;
    allJobs = j;
    products = p;
    payments = pay;
  } catch (err) {
    showMessage(err.message, true);
    return;
  }
  renderAll();
}

function renderAll() {
  fillSelects();
  renderStats();
  renderRows();
  renderCustomers();
  renderProducts();
  renderPayments();
  updateJobHint();
  updateProductTotal();
  if (selectedCustomerId) showCustomer(selectedCustomerId, false);
  else renderCustomerJobs(null);
}

function fillSelects() {
  const custItems = customers.map((c) => ({ value: c.id, label: c.name + ' (' + c.phone + ')' }));
  setOptions($('customerSelect'), 'Select customer', custItems);
  setOptions($('detailSelect'), 'Select customer', custItems);
  setOptions($('payCustomer'), 'Walk-in customer', custItems);
  setOptions(
    $('payJob'),
    'Select a service job',
    allJobs
      .filter((j) => balanceOf(j) > 0)
      .map((j) => ({
        value: j.id,
        label: '#' + j.id + ' ' + j.customer_name + ' - ' + j.device_model + ' (balance ' + peso(balanceOf(j)) + ')',
      }))
  );
  setOptions(
    $('payProduct'),
    'Select a product',
    products
      .filter((p) => p.stock > 0)
      .map((p) => ({ value: p.id, label: p.name + ' - ' + peso(p.price) + ' (' + p.stock + ' in stock)' }))
  );
}

// ---------- DASHBOARD ----------
function renderStats() {
  const queue = allJobs.filter((j) => j.status === 'Pending' || j.status === 'In Progress').length;
  const low = products.filter((p) => p.stock <= p.reorder_level).length;
  countUp($('statTotal'), allJobs.length, String);
  countUp($('statQueue'), queue, String);
  countUp($('statCollected'), sum(payments, 'amount'), peso);
  countUp($('statLow'), low, String);
}

function renderRows() {
  const filter = $('statusFilter').value;
  const search = $('search').value.trim().toLowerCase();
  const list = allJobs.filter((j) => {
    const text = (j.customer_name + ' ' + j.device_model + ' ' + j.issue + ' ' + j.job_type).toLowerCase();
    return (!filter || j.status === filter) && text.includes(search);
  });

  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  if (currentPage > totalPages) currentPage = totalPages;
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageItems = list.slice(start, start + PAGE_SIZE);

  const tbody = $('rows');
  tbody.replaceChildren();

  if (list.length === 0) {
    emptyRow(tbody, 'No service jobs to show.', 9);
    $('pageInfo').textContent = 'No jobs to show.';
  } else {
    pageItems.forEach((j, index) => {
      const tr = el('tr');
      tr.style.setProperty('--i', index);
      addCell(tr, j.id);
      addCell(tr, j.customer_name);
      addCell(tr, j.device_model);
      addCell(tr, j.issue);
      addCell(tr, j.job_type);
      addCell(tr, peso(j.price));
      addCell(tr, '').appendChild(payBadge(j));
      addCell(tr, '').appendChild(statusBadge(j.status));

      const actions = el('div', 'actions');
      actions.append(makeJobViewButton(j));
      if (balanceOf(j) > 0) actions.append(makePayButton(j));
      actions.append(makeStatusSelect(j), makeJobDeleteButton(j));
      addCell(tr, '').appendChild(actions);
      tbody.appendChild(tr);
    });
    $('pageInfo').textContent =
      'Showing ' + (start + 1) + '\u2013' + (start + pageItems.length) +
      ' of ' + list.length + ' jobs (page ' + currentPage + ' of ' + totalPages + ')';
  }
  $('prevBtn').disabled = currentPage <= 1;
  $('nextBtn').disabled = currentPage >= totalPages;
}

function makeJobViewButton(j) {
  const b = el('button', 'btn btn-sm', 'View');
  b.type = 'button';
  b.setAttribute('aria-label', 'View details of ' + j.customer_name);
  b.addEventListener('click', () => showCustomer(j.customer_id, true));
  return b;
}
function makePayButton(j) {
  const b = el('button', 'btn btn-sm', 'Pay');
  b.type = 'button';
  b.setAttribute('aria-label', 'Record a payment for ' + j.device_model + ' of ' + j.customer_name);
  b.addEventListener('click', () => openJobPayment(j.id));
  return b;
}
function makeStatusSelect(j) {
  const select = el('select');
  select.setAttribute('aria-label', 'Status for ' + j.customer_name + ', ' + j.device_model);
  for (const s of STATUS_LIST) {
    const o = el('option', '', s);
    o.selected = s === j.status;
    select.appendChild(o);
  }
  select.addEventListener('change', async () => {
    try {
      await api('/jobs/' + j.id, { method: 'PUT', body: JSON.stringify({ status: select.value }) });
      showMessage('Status changed to ' + select.value + '.', false);
    } catch (err) {
      showMessage(err.message, true);
    }
    await loadAll();
  });
  return select;
}
function makeJobDeleteButton(j) {
  const b = el('button', 'btn btn-sm btn-danger', 'Delete');
  b.type = 'button';
  b.setAttribute('aria-label', 'Delete ' + j.device_model + ' job for ' + j.customer_name);
  b.addEventListener('click', async () => {
    if (!confirm('Delete this service job? This cannot be undone.')) return;
    try {
      await api('/jobs/' + j.id, { method: 'DELETE' });
      showMessage('Service job deleted.', false);
    } catch (err) {
      showMessage(err.message, true);
    }
    await loadAll();
  });
  return b;
}

// ---------- CUSTOMER PANEL ----------
function renderCustomerJobs(jobs) {
  const tbody = $('custJobRows');
  tbody.replaceChildren();
  if (jobs === null || jobs.length === 0) {
    emptyRow(tbody, jobs === null ? 'No customer selected.' : 'This customer has no jobs yet.', 3);
    return;
  }
  jobs.forEach((j, index) => {
    const tr = el('tr');
    tr.style.setProperty('--i', index);
    addCell(tr, j.date_received);
    addCell(tr, j.device_model);
    addCell(tr, '').appendChild(statusBadge(j.status));
    tbody.appendChild(tr);
  });
}

function showCustomer(id, moveFocus) {
  const c = customers.find((x) => x.id === Number(id));
  if (!c) {
    selectedCustomerId = null;
    $('detailSelect').value = '';
    $('detailBox').hidden = true;
    $('detailEmpty').hidden = false;
    renderCustomerJobs(null);
    return;
  }
  if (moveFocus && location.hash.slice(1) !== 'dashboard') go('dashboard');
  const jobs = allJobs.filter((j) => j.customer_id === c.id);
  const billed = sum(jobs, 'price');
  const paid = sum(jobs, 'paid');
  selectedCustomerId = c.id;
  $('detailSelect').value = String(c.id);
  $('detailAvatar').textContent = c.name.charAt(0).toUpperCase();
  $('detailName').textContent = c.name;
  $('detailEmail').textContent = c.email || 'Not provided';
  $('detailPhone').textContent = c.phone;
  $('detailAddress').textContent = c.address || 'Not provided';
  $('detailTotalJobs').textContent = jobs.length;
  $('detailBilled').textContent = peso(billed);
  $('detailPaid').textContent = peso(paid);
  $('detailBalance').textContent = peso(Math.max(0, billed - paid));
  $('detailBox').hidden = false;
  $('detailEmpty').hidden = true;
  renderCustomerJobs(jobs);
  if (moveFocus) {
    $('customerSection').scrollIntoView();
    $('detailName').focus();
  }
}

// ---------- CUSTOMERS VIEW ----------
function renderCustomers() {
  const q = $('custSearch').value.trim().toLowerCase();
  const list = customers.filter((c) =>
    (c.name + ' ' + c.phone + ' ' + (c.email || '') + ' ' + (c.address || '')).toLowerCase().includes(q)
  );
  const tbody = $('custRows');
  tbody.replaceChildren();
  if (list.length === 0) {
    emptyRow(tbody, 'No customers to show.', 7);
    return;
  }
  list.forEach((c, index) => {
    const jobs = allJobs.filter((j) => j.customer_id === c.id);
    const tr = el('tr');
    tr.style.setProperty('--i', index);
    addCell(tr, c.name);
    addCell(tr, c.phone);
    addCell(tr, c.email || '-');
    addCell(tr, c.address || '-');
    addCell(tr, jobs.length);
    addCell(tr, peso(sum(jobs, 'price')));

    const actions = el('div', 'actions');
    const view = el('button', 'btn btn-sm', 'View');
    view.type = 'button';
    view.setAttribute('aria-label', 'View ' + c.name);
    view.addEventListener('click', () => showCustomer(c.id, true));
    const del = el('button', 'btn btn-sm btn-danger', 'Delete');
    del.type = 'button';
    del.setAttribute('aria-label', 'Delete customer ' + c.name);
    del.addEventListener('click', async () => {
      if (!confirm('Delete ' + c.name + '? This cannot be undone.')) return;
      try {
        await api('/customers/' + c.id, { method: 'DELETE' });
        if (selectedCustomerId === c.id) selectedCustomerId = null;
        showMessage('Customer deleted.', false);
      } catch (err) {
        showMessage(err.message, true);
      }
      await loadAll();
    });
    actions.append(view, del);
    addCell(tr, '').appendChild(actions);
    tbody.appendChild(tr);
  });
}

// ---------- PAYMENTS VIEW ----------
function renderPayments() {
  const tbody = $('payRows');
  tbody.replaceChildren();
  if (payments.length === 0) {
    emptyRow(tbody, 'No payments recorded yet.', 5);
    return;
  }
  payments.forEach((p, index) => {
    const tr = el('tr');
    tr.style.setProperty('--i', Math.min(index, 8));
    addCell(tr, p.paid_at);
    addCell(tr, p.customer_name || 'Walk-in');
    addCell(tr, itemText(p));
    addCell(tr, p.method);
    addCell(tr, peso(p.amount));
    tbody.appendChild(tr);
  });
}

function syncPayType() {
  const isJob = $('payType').value === 'job';
  $('payJobBox').hidden = !isJob;
  $('payProductBox').hidden = isJob;
  $('payJob').required = isJob;
  $('payAmount').required = isJob;
  $('payProduct').required = !isJob;
  $('payQty').required = !isJob;
  updateJobHint();
  updateProductTotal();
}
function updateJobHint() {
  const job = allJobs.find((j) => j.id === Number($('payJob').value));
  if (job) {
    const b = balanceOf(job);
    $('payAmount').value = b;
    $('payAmount').max = b;
    $('payHint').textContent = 'Balance due: ' + peso(b) + '. You can pay part of it.';
  } else {
    $('payAmount').value = '';
    $('payHint').textContent = '';
  }
}
function updateProductTotal() {
  const p = products.find((x) => x.id === Number($('payProduct').value));
  const qty = Number($('payQty').value) || 0;
  if (p) {
    $('payQty').max = p.stock;
    $('payTotal').textContent = 'Total: ' + peso(p.price * qty) + ' (' + p.stock + ' in stock)';
  } else {
    $('payTotal').textContent = '';
  }
}
function openJobPayment(jobId) {
  go('payments');
  $('payType').value = 'job';
  syncPayType();
  $('payJob').value = String(jobId);
  updateJobHint();
  $('payAmount').focus();
}
function openProductSale(productId) {
  go('payments');
  $('payType').value = 'product';
  syncPayType();
  $('payProduct').value = String(productId);
  $('payQty').value = 1;
  updateProductTotal();
  $('payQty').focus();
}

// ---------- INVENTORY VIEW ----------
function stockBadge(p) {
  if (p.stock <= 0) return badge('st-out', 'Out of stock');
  if (p.stock <= p.reorder_level) return badge('st-low', 'Low stock');
  return badge('st-in', 'In stock');
}

function renderProducts() {
  const q = $('invSearch').value.trim().toLowerCase();
  const list = products.filter((p) => (p.name + ' ' + p.category).toLowerCase().includes(q));
  const tbody = $('invRows');
  tbody.replaceChildren();
  if (list.length === 0) {
    emptyRow(tbody, 'No products to show.', 7);
    return;
  }
  list.forEach((p, index) => {
    const tr = el('tr');
    tr.style.setProperty('--i', index);
    addCell(tr, p.name);
    addCell(tr, p.category);
    addCell(tr, peso(p.price));
    addCell(tr, p.stock);
    addCell(tr, '').appendChild(stockBadge(p));

    const edit = el('div', 'stock-edit');
    const input = el('input');
    input.type = 'number';
    input.min = '0';
    input.step = '1';
    input.value = p.stock;
    input.setAttribute('aria-label', 'New stock count for ' + p.name);
    const save = el('button', 'btn btn-sm', 'Save');
    save.type = 'button';
    save.setAttribute('aria-label', 'Save stock for ' + p.name);
    save.addEventListener('click', async () => {
      const stock = Number(input.value);
      if (input.value === '' || !Number.isInteger(stock) || stock < 0) {
        showMessage('Stock must be a whole number, 0 or higher.', true);
        return;
      }
      try {
        await api('/products/' + p.id, { method: 'PUT', body: JSON.stringify({ stock }) });
        showMessage(p.name + ' stock updated to ' + stock + '.', false);
      } catch (err) {
        showMessage(err.message, true);
      }
      await loadAll();
    });
    edit.append(input, save);
    addCell(tr, '').appendChild(edit);

    const actions = el('div', 'actions');
    if (p.stock > 0) {
      const sell = el('button', 'btn btn-sm', 'Sell');
      sell.type = 'button';
      sell.setAttribute('aria-label', 'Sell ' + p.name);
      sell.addEventListener('click', () => openProductSale(p.id));
      actions.append(sell);
    }
    const del = el('button', 'btn btn-sm btn-danger', 'Delete');
    del.type = 'button';
    del.setAttribute('aria-label', 'Delete product ' + p.name);
    del.addEventListener('click', async () => {
      if (!confirm('Delete ' + p.name + '? This cannot be undone.')) return;
      try {
        await api('/products/' + p.id, { method: 'DELETE' });
        showMessage('Product deleted.', false);
      } catch (err) {
        showMessage(err.message, true);
      }
      await loadAll();
    });
    actions.append(del);
    addCell(tr, '').appendChild(actions);
    tbody.appendChild(tr);
  });
}

// ---------- REPORTS VIEW ----------
const isoDay = (d) => d.toLocaleDateString('en-CA');

function setPeriod(kind) {
  const now = new Date();
  if (kind === 'today') {
    $('repFrom').value = isoDay(now);
    $('repTo').value = isoDay(now);
  } else if (kind === 'month') {
    $('repFrom').value = isoDay(new Date(now.getFullYear(), now.getMonth(), 1));
    $('repTo').value = isoDay(now);
  } else {
    $('repFrom').value = '';
    $('repTo').value = '';
  }
}

function periodText() {
  const from = $('repFrom').value;
  const to = $('repTo').value;
  if (!from && !to) return 'Period: all time';
  return 'Period: ' + (from || 'the beginning') + ' to ' + (to || 'today');
}

async function loadReport() {
  const params = new URLSearchParams();
  if ($('repFrom').value) params.set('from', $('repFrom').value);
  if ($('repTo').value) params.set('to', $('repTo').value);
  const qs = params.toString();
  try {
    report = await api('/reports/sales' + (qs ? '?' + qs : ''));
  } catch (err) {
    showMessage(err.message, true);
    return;
  }
  renderReport();
}

function renderReport() {
  const t = report.totals;
  const text = periodText();
  $('rPeriod').textContent = text;
  $('rPeriodPrint').textContent = text;
  countUp($('rTotal'), t.total, peso);
  countUp($('rServices'), t.services, peso);
  countUp($('rProducts'), t.products, peso);
  countUp($('rCount'), t.count, String);
  countUp($('rOutstanding'), t.outstanding, peso);

  const methods = $('rMethodRows');
  methods.replaceChildren();
  if (report.byMethod.length === 0) emptyRow(methods, 'No payments in this period.', 3);
  for (const m of report.byMethod) {
    const tr = el('tr');
    addCell(tr, m.method);
    addCell(tr, m.count);
    addCell(tr, peso(m.total));
    methods.appendChild(tr);
  }

  const bars = $('rDayBars');
  bars.replaceChildren();
  if (report.byDay.length === 0) bars.appendChild(el('p', 'muted', 'No sales in this period.'));
  const max = Math.max(1, ...report.byDay.map((d) => d.total));
  for (const d of report.byDay) {
    const pct = Math.max(2, Math.round((d.total / max) * 100));
    const row = el('div', 'bar-row');
    const track = el('div', 'bar-track');
    const fill = el('div', 'bar-fill');
    fill.style.width = reduceMotion() ? pct + '%' : '0%';
    track.appendChild(fill);
    row.append(el('span', 'bar-label', d.day), track, el('span', 'bar-val', peso(d.total)));
    bars.appendChild(row);
    if (!reduceMotion()) {
      requestAnimationFrame(() => requestAnimationFrame(() => { fill.style.width = pct + '%'; }));
    }
  }

  const top = $('rTopRows');
  top.replaceChildren();
  if (report.topProducts.length === 0) emptyRow(top, 'No product sales in this period.', 3);
  for (const p of report.topProducts) {
    const tr = el('tr');
    addCell(tr, p.name);
    addCell(tr, p.qty);
    addCell(tr, peso(p.total));
    top.appendChild(tr);
  }

  const items = $('rItemRows');
  items.replaceChildren();
  if (report.items.length === 0) emptyRow(items, 'No transactions in this period.', 5);
  for (const p of report.items) {
    const tr = el('tr');
    addCell(tr, p.paid_at);
    addCell(tr, p.customer_name || 'Walk-in');
    addCell(tr, itemText(p));
    addCell(tr, p.method);
    addCell(tr, peso(p.amount));
    items.appendChild(tr);
  }
}

// ---------- EVENTS ----------
$('addForm').addEventListener('submit', (event) => {
  event.preventDefault();
  runForm($('addForm'), async () => {
    await api('/jobs', {
      method: 'POST',
      body: JSON.stringify({
        customer_id: Number($('customerSelect').value),
        device_model: $('deviceModel').value,
        issue: $('issue').value,
        job_type: $('jobType').value,
        price: Number($('price').value),
      }),
    });
    $('addForm').reset();
    showMessage('Service job added.', false);
    await loadAll();
    $('deviceModel').focus();
  });
});

$('addCustomerForm').addEventListener('submit', (event) => {
  event.preventDefault();
  runForm($('addCustomerForm'), async () => {
    const created = await api('/customers', {
      method: 'POST',
      body: JSON.stringify({
        name: $('newCustName').value,
        phone: $('newCustPhone').value,
        email: $('newCustEmail').value.trim() || undefined,
        address: $('newCustAddress').value.trim() || undefined,
      }),
    });
    $('addCustomerForm').reset();
    showMessage(created.name + ' was added. You can now add a job for this customer.', false);
    await loadAll();
    $('customerSelect').value = String(created.id);
    $('newCustName').focus();
  });
});

$('addProductForm').addEventListener('submit', (event) => {
  event.preventDefault();
  runForm($('addProductForm'), async () => {
    const created = await api('/products', {
      method: 'POST',
      body: JSON.stringify({
        name: $('prodName').value,
        category: $('prodCategory').value,
        price: Number($('prodPrice').value),
        stock: Number($('prodStock').value),
        reorder_level: Number($('prodReorder').value),
      }),
    });
    $('addProductForm').reset();
    showMessage(created.name + ' was added to the inventory.', false);
    await loadAll();
    $('prodName').focus();
  });
});

$('payForm').addEventListener('submit', (event) => {
  event.preventDefault();
  runForm($('payForm'), async () => {
    const isJob = $('payType').value === 'job';
    const body = { method: $('payMethod').value, note: $('payNote').value.trim() || undefined };
    if (isJob) {
      body.job_id = Number($('payJob').value);
      body.amount = Number($('payAmount').value);
    } else {
      body.product_id = Number($('payProduct').value);
      body.quantity = Number($('payQty').value);
      if ($('payCustomer').value) body.customer_id = Number($('payCustomer').value);
    }
    const saved = await api('/payments', { method: 'POST', body: JSON.stringify(body) });
    showMessage('Payment of ' + peso(saved.amount) + ' recorded.', false);
    $('payNote').value = '';
    $('payQty').value = 1;
    await loadAll();
  });
});

$('payType').addEventListener('change', syncPayType);
$('payJob').addEventListener('change', updateJobHint);
$('payProduct').addEventListener('change', updateProductTotal);
$('payQty').addEventListener('input', updateProductTotal);

$('repForm').addEventListener('submit', (event) => {
  event.preventDefault();
  loadReport();
});
$('btnToday').addEventListener('click', () => { setPeriod('today'); loadReport(); });
$('btnMonth').addEventListener('click', () => { setPeriod('month'); loadReport(); });
$('btnAll').addEventListener('click', () => { setPeriod('all'); loadReport(); });
$('printBtn').addEventListener('click', () => window.print());
window.addEventListener('beforeprint', () => {
  $('rPrinted').textContent = 'Printed on ' + new Date().toLocaleString('en-PH');
});

$('logoutBtn').addEventListener('click', () => {
  clearToken();
  flash('You are logged out.', false);
  goTo('login.html');
});

$('statusFilter').addEventListener('change', () => { currentPage = 1; renderRows(); });
$('search').addEventListener('input', () => { currentPage = 1; renderRows(); });
$('prevBtn').addEventListener('click', () => { currentPage -= 1; renderRows(); });
$('nextBtn').addEventListener('click', () => { currentPage += 1; renderRows(); });
$('detailSelect').addEventListener('change', () => showCustomer($('detailSelect').value, false));
$('custSearch').addEventListener('input', renderCustomers);
$('invSearch').addEventListener('input', renderProducts);

// ---------- START ----------
async function start() {
  if (!getToken()) {
    location.replace('login.html');
    return;
  }
  renderCustomerJobs(null);
  try {
    const me = await api('/auth/me');
    $('who').textContent = me.email + ' (' + me.role + ')';
    $('avatar').textContent = String(me.email).charAt(0).toUpperCase();
  } catch (err) {
    showMessage(err.message, true);
    return;
  }
  showFlash();
  setPeriod('month');
  syncPayType();
  await loadAll();
  showView(location.hash.slice(1));
}

start();