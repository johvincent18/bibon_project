require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const db = require('./db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 3000;

// ---------- FRONTEND FOLDER ----------
// Palitan kung iba ang folder ng login.html, index.html, atbp.
// 'public' = may folder na public sa tabi ng server.js
// __dirname = nasa mismong tabi ng server.js ang mga .html
const FRONTEND_DIR = path.join(__dirname, 'public');

// Tanggapin ang /api/auth/login AT /auth/login (parehong gagana)
app.use((req, res, next) => {
  if (req.url.startsWith('/api/')) req.url = req.url.slice(4);
  next();
});

// I-serve ang login.html, index.html, css, js
app.use(express.static(FRONTEND_DIR));

const ALLOWED_STATUS = ['Pending', 'In Progress', 'Completed', 'Released'];
const SORTABLE = ['id', 'customer_id', 'device_model', 'job_type', 'price', 'status', 'date_received'];

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('Missing JWT_SECRET. Add it to your .env file.');
  process.exit(1);
}

// ---------- AUTH HELPERS ----------
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [type, token] = header.split(' ');

  if (type !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Please log in first' });
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Your login is invalid or expired' });
  }
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' },
});

// Health check (hindi na '/', para ma-serve ang index.html sa '/')
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'CellHub API is running' });
});

// ---------- AUTH ROUTES ----------
app.post('/auth/register', (req, res) => {
  const { name, email, password } = req.body || {};

  if (typeof name !== 'string' || name.trim() === '') {
    return res.status(400).json({ error: 'name is required' });
  }

  if (typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email)) {
    return res.status(400).json({ error: 'a valid email is required' });
  }

  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'password must be at least 8 characters' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const taken = db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail);

  if (taken) {
    return res.status(409).json({ error: 'That email is already registered' });
  }

  const passwordHash = bcrypt.hashSync(password, 10);

  const result = db
    .prepare('INSERT INTO users (name, email, passwordHash) VALUES (?, ?, ?)')
    .run(name.trim(), cleanEmail, passwordHash);

  res.status(201).json({
    id: result.lastInsertRowid,
    name: name.trim(),
    email: cleanEmail,
  });
});

app.post('/auth/login', loginLimiter, (req, res) => {
  const { email, password } = req.body || {};

  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'email and password are required' });
  }

  const user = db
    .prepare('SELECT * FROM users WHERE email = ?')
    .get(email.trim().toLowerCase());

  const ok = user && bcrypt.compareSync(password, user.passwordHash);

  if (!ok) {
    return res.status(401).json({ error: 'Wrong email or password' });
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email },
  });
});

app.get('/auth/me', requireAuth, (req, res) => {
  res.json({
    id: req.user.id,
    email: req.user.email,
    role: req.user.role,
  });
});

  // ---------- WEATHER (THIRD PARTY API) ----------
const WEATHER_KEY = process.env.WEATHER_KEY;
const WEATHER_URL = 'https://api.weatherapi.com/v1/current.json';
const weatherCache = new Map();

const weatherLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  message: { error: 'Too many weather requests. Please wait a minute.' },
});

app.get('/weather', weatherLimiter, async (req, res) => {
  if (!WEATHER_KEY) {
    return res.status(503).json({ error: 'Weather is not set up on this server' });
  }

  const city = String(req.query.city || 'Lucena').trim();

  if (city === '' || city.length > 60) {
    return res.status(400).json({ error: 'city must be 1 to 60 characters' });
  }

  const saved = weatherCache.get(city.toLowerCase());

  if (saved && Date.now() - saved.time < 5 * 60 * 1000) {
    return res.json({ ...saved.data, cached: true });
  }

  const params = new URLSearchParams({ key: WEATHER_KEY, q: city });
  const url = WEATHER_URL + '?' + params;

  let response;

  try {
    response = await fetch(url, { signal: AbortSignal.timeout(5000) });
  } catch (err) {
    return res
      .status(504)
      .json({ error: 'The weather service could not be reached. Try again.' });
  }

  const body = await response.json().catch(() => null);

  if (!response.ok || !body || !body.current) {
    if (body && body.error && body.error.code === 1006) {
      return res.status(404).json({ error: 'City not found' });
    }

    console.error('Weather service problem:', response.status, body && body.error);

    return res
      .status(502)
      .json({ error: 'The weather service is not available right now.' });
  }

  const data = {
    city: body.location.name,
    country: body.location.country,
    tempC: body.current.temp_c,
    feelsLikeC: body.current.feelslike_c,
    humidity: body.current.humidity,
    condition: body.current.condition.text,
  };

  weatherCache.set(city.toLowerCase(), { time: Date.now(), data });

  res.json({ ...data, cached: false });
});
// ---------- CUSTOMERS ----------
app.get('/customers', (req, res) => {
  res.json(db.prepare('SELECT * FROM customers').all());
});

// Must stay ABOVE /customers/:id
app.get('/customers/summary', (req, res) => {
  const rows = db
    .prepare(
      `SELECT customers.id, customers.name,
              COUNT(service_jobs.id) AS totalJobs,
              COALESCE(SUM(service_jobs.price), 0) AS totalPrice
       FROM customers
       LEFT JOIN service_jobs ON service_jobs.customer_id = customers.id
       GROUP BY customers.id
       ORDER BY customers.id`
    )
    .all();

  res.json(rows);
});

app.get('/customers/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);

  if (!row) {
    return res.status(404).json({ error: 'Customer not found' });
  }

  res.json(row);
});

app.get('/customers/:id/jobs', (req, res) => {
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);

  if (!customer) {
    return res.status(404).json({ error: 'Customer not found' });
  }

  const rows = db
    .prepare('SELECT * FROM service_jobs WHERE customer_id = ?')
    .all(req.params.id);

  res.json(rows);
});

app.post('/customers', requireAuth, (req, res) => {
  const { name, phone, email = null, address = null } = req.body || {};

  if ([name, phone].some((f) => typeof f !== 'string' || f.trim() === '')) {
    return res.status(400).json({ error: 'name and phone are required' });
  }

  if (
    (email !== null && typeof email !== 'string') ||
    (address !== null && typeof address !== 'string')
  ) {
    return res.status(400).json({ error: 'email and address must be text' });
  }

  const result = db
    .prepare('INSERT INTO customers (name, phone, email, address) VALUES (?, ?, ?, ?)')
    .run(name.trim(), phone.trim(), email, address);

  const created = db
    .prepare('SELECT * FROM customers WHERE id = ?')
    .get(result.lastInsertRowid);

  res.status(201).json(created);
});

app.delete('/customers/:id', requireAuth, (req, res) => {
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);

  if (!customer) {
    return res.status(404).json({ error: 'Customer not found' });
  }

  const { total } = db
    .prepare('SELECT COUNT(*) AS total FROM service_jobs WHERE customer_id = ?')
    .get(req.params.id);

  if (total > 0) {
    return res.status(409).json({
      error: 'Customer still has service jobs. Delete those first.',
    });
  }

  db.prepare('DELETE FROM customers WHERE id = ?').run(req.params.id);

  res.json({ message: 'Customer deleted' });
});

// ---------- SERVICE JOBS ----------
// This route must stay ABOVE /jobs/:id
app.get('/jobs/details', (req, res) => {
  const rows = db
    .prepare(
      `SELECT service_jobs.id, service_jobs.customer_id,
              customers.name AS customer_name, customers.phone,
              service_jobs.device_model, service_jobs.issue,
              service_jobs.job_type, service_jobs.price, service_jobs.status,
              service_jobs.date_received,
              COALESCE(
                (SELECT SUM(amount) FROM payments
                 WHERE payments.job_id = service_jobs.id), 0
              ) AS paid
       FROM service_jobs
       JOIN customers ON service_jobs.customer_id = customers.id
       ORDER BY service_jobs.id`
    )
    .all();

  res.json(rows);
});

app.get('/jobs', (req, res) => {
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 10);
  const sort = req.query.sort ?? 'id';
  const order = String(req.query.order ?? 'asc').toLowerCase();
  const { status, job_type } = req.query;

  if (!Number.isInteger(page) || page < 1) {
    return res.status(400).json({ error: 'page must be a whole number, 1 or higher' });
  }

  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    return res.status(400).json({ error: 'limit must be a whole number from 1 to 50' });
  }

  if (!SORTABLE.includes(sort)) {
    return res.status(400).json({ error: `sort must be one of: ${SORTABLE.join(', ')}` });
  }

  if (order !== 'asc' && order !== 'desc') {
    return res.status(400).json({ error: 'order must be asc or desc' });
  }

  const conditions = [];
  const filterValues = [];

  if (status) {
    conditions.push('status = ?');
    filterValues.push(status);
  }

  if (job_type) {
    conditions.push('job_type = ?');
    filterValues.push(job_type);
  }

  const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

  const { total } = db
    .prepare(`SELECT COUNT(*) AS total FROM service_jobs ${where}`)
    .get(...filterValues);

  const data = db
    .prepare(
      `SELECT * FROM service_jobs ${where} ` +
      `ORDER BY ${sort} ${order.toUpperCase()} LIMIT ? OFFSET ?`
    )
    .all(...filterValues, limit, (page - 1) * limit);

  res.json({
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
    data,
  });
});

app.get('/jobs/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM service_jobs WHERE id = ?').get(req.params.id);

  if (!row) {
    return res.status(404).json({ error: 'Service job not found' });
  }

  res.json(row);
});

app.post('/jobs', requireAuth, (req, res) => {
  const {
    customer_id,
    device_model,
    issue,
    job_type,
    price,
    status = 'Pending',
    date_received = new Date().toISOString().slice(0, 10),
  } = req.body || {};

  if (!Number.isInteger(customer_id)) {
    return res.status(400).json({ error: 'customer_id must be a whole number' });
  }

  if ([device_model, issue, job_type].some((f) => typeof f !== 'string' || f.trim() === '')) {
    return res.status(400).json({ error: 'device_model, issue and job_type are required' });
  }

  if (typeof price !== 'number' || !Number.isFinite(price) || price < 0) {
    return res.status(400).json({ error: 'price must be a number, 0 or higher' });
  }

  if (!ALLOWED_STATUS.includes(status)) {
    return res.status(400).json({
      error: `status must be one of: ${ALLOWED_STATUS.join(', ')}`,
    });
  }

  if (typeof date_received !== 'string' || date_received.trim() === '') {
    return res.status(400).json({ error: 'date_received must be text like 2026-11-04' });
  }

  const customer = db.prepare('SELECT id FROM customers WHERE id = ?').get(customer_id);

  if (!customer) {
    return res.status(400).json({ error: 'customer_id does not match any customer' });
  }

  const result = db
    .prepare(
      'INSERT INTO service_jobs (customer_id, device_model, issue, job_type, price, status, date_received) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
    .run(
      customer_id,
      device_model.trim(),
      issue.trim(),
      job_type.trim(),
      price,
      status,
      date_received.trim()
    );

  const created = db
    .prepare('SELECT * FROM service_jobs WHERE id = ?')
    .get(result.lastInsertRowid);

  res.status(201).json(created);
});

app.put('/jobs/:id', requireAuth, (req, res) => {
  const { status } = req.body || {};

  if (!ALLOWED_STATUS.includes(status)) {
    return res.status(400).json({
      error: `status must be one of: ${ALLOWED_STATUS.join(', ')}`,
    });
  }

  const result = db
    .prepare('UPDATE service_jobs SET status = ? WHERE id = ?')
    .run(status, req.params.id);

  if (result.changes === 0) {
    return res.status(404).json({ error: 'Service job not found' });
  }

  res.json(db.prepare('SELECT * FROM service_jobs WHERE id = ?').get(req.params.id));
});

app.delete('/jobs/:id', requireAuth, (req, res) => {
  const result = db.prepare('DELETE FROM service_jobs WHERE id = ?').run(req.params.id);

  if (result.changes === 0) {
    return res.status(404).json({ error: 'Service job not found' });
  }

  res.json({ message: 'Service job deleted' });
});

// ---------- INVENTORY, PAYMENTS, REPORTS ----------
const protect = requireAuth;
const PAYMENT_METHODS = ['Cash', 'GCash', 'Maya', 'Card'];

const money = (n) => Math.round(n * 100) / 100;

const todayManila = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });

const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

// ----- Products -----
app.get('/products', protect, (req, res) => {
  res.json(db.prepare('SELECT * FROM products ORDER BY name').all());
});

app.post('/products', protect, (req, res) => {
  const { name, category, price, stock = 0, reorder_level = 5 } = req.body || {};

  if ([name, category].some((f) => typeof f !== 'string' || f.trim() === '')) {
    return res.status(400).json({ error: 'name and category are required' });
  }

  if (typeof price !== 'number' || !Number.isFinite(price) || price < 0) {
    return res.status(400).json({ error: 'price must be a number, 0 or higher' });
  }

  if (
    !Number.isInteger(stock) ||
    stock < 0 ||
    !Number.isInteger(reorder_level) ||
    reorder_level < 0
  ) {
    return res.status(400).json({
      error: 'stock and reorder_level must be whole numbers, 0 or higher',
    });
  }

  const result = db
    .prepare(
      'INSERT INTO products (name, category, price, stock, reorder_level) VALUES (?, ?, ?, ?, ?)'
    )
    .run(name.trim(), category.trim(), price, stock, reorder_level);

  res.status(201).json(
    db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid)
  );
});

app.put('/products/:id', protect, (req, res) => {
  const { price, stock } = req.body || {};

  if (price === undefined && stock === undefined) {
    return res.status(400).json({ error: 'send price and/or stock' });
  }

  if (price !== undefined && (typeof price !== 'number' || !Number.isFinite(price) || price < 0)) {
    return res.status(400).json({ error: 'price must be a number, 0 or higher' });
  }

  if (stock !== undefined && (!Number.isInteger(stock) || stock < 0)) {
    return res.status(400).json({ error: 'stock must be a whole number, 0 or higher' });
  }

  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);

  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }

  db.prepare('UPDATE products SET price = ?, stock = ? WHERE id = ?')
    .run(price ?? product.price, stock ?? product.stock, req.params.id);

  res.json(db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id));
});

app.delete('/products/:id', protect, (req, res) => {
  const result = db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);

  if (result.changes === 0) {
    return res.status(404).json({ error: 'Product not found' });
  }

  res.json({ message: 'Product deleted' });
});

// ----- Payments -----
const PAYMENT_LIST_SQL = `
  SELECT payments.*, customers.name AS customer_name,
         service_jobs.device_model, products.name AS product_name
  FROM payments
  LEFT JOIN customers ON payments.customer_id = customers.id
  LEFT JOIN service_jobs ON payments.job_id = service_jobs.id
  LEFT JOIN products ON payments.product_id = products.id`;

app.get('/payments', protect, (req, res) => {
  res.json(
    db.prepare(PAYMENT_LIST_SQL + ' ORDER BY payments.paid_at DESC, payments.id DESC').all()
  );
});

app.post('/payments', protect, (req, res) => {
  const {
    job_id,
    product_id,
    quantity = 1,
    amount,
    method,
    note = null,
    customer_id = null,
  } = req.body || {};

  if (!PAYMENT_METHODS.includes(method)) {
    return res.status(400).json({
      error: `method must be one of: ${PAYMENT_METHODS.join(', ')}`,
    });
  }

  if (note !== null && typeof note !== 'string') {
    return res.status(400).json({ error: 'note must be text' });
  }

  const hasJob = job_id !== undefined && job_id !== null;
  const hasProduct = product_id !== undefined && product_id !== null;

  if (hasJob === hasProduct) {
    return res.status(400).json({
      error: 'choose either a service job or a product, not both',
    });
  }

  const insert = db.prepare(
    'INSERT INTO payments (customer_id, job_id, product_id, quantity, amount, method, paid_at, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );

  const today = todayManila();

  // Payment for a service job
  if (hasJob) {
    if (!Number.isInteger(job_id)) {
      return res.status(400).json({ error: 'job_id must be a whole number' });
    }

    const job = db
      .prepare('SELECT id, customer_id, price FROM service_jobs WHERE id = ?')
      .get(job_id);

    if (!job) {
      return res.status(404).json({ error: 'Service job not found' });
    }

    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'amount must be a number above 0' });
    }

    const { paid } = db
      .prepare('SELECT COALESCE(SUM(amount), 0) AS paid FROM payments WHERE job_id = ?')
      .get(job_id);

    const balance = money(job.price - paid);

    if (balance <= 0) {
      return res.status(409).json({ error: 'This job is already fully paid' });
    }

    if (money(amount) > balance) {
      return res.status(400).json({
        error: `amount is more than the balance of ${balance}`,
      });
    }

    const result = insert.run(
      job.customer_id,
      job_id,
      null,
      1,
      money(amount),
      method,
      today,
      note
    );

    return res.status(201).json(
      db.prepare('SELECT * FROM payments WHERE id = ?').get(result.lastInsertRowid)
    );
  }

  // Product sale
  if (!Number.isInteger(product_id)) {
    return res.status(400).json({ error: 'product_id must be a whole number' });
  }

  if (!Number.isInteger(quantity) || quantity < 1) {
    return res.status(400).json({
      error: 'quantity must be a whole number, 1 or higher',
    });
  }

  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(product_id);

  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }

  if (customer_id !== null) {
    if (
      !Number.isInteger(customer_id) ||
      !db.prepare('SELECT id FROM customers WHERE id = ?').get(customer_id)
    ) {
      return res.status(400).json({
        error: 'customer_id does not match any customer',
      });
    }
  }

  if (product.stock < quantity) {
    return res.status(409).json({
      error: `Not enough stock. Only ${product.stock} left`,
    });
  }

  const sale = db.transaction(() => {
    db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?')
      .run(quantity, product_id);

    return insert.run(
      customer_id,
      null,
      product_id,
      quantity,
      money(product.price * quantity),
      method,
      today,
      note
    );
  });

  const result = sale();

  res.status(201).json(
    db.prepare('SELECT * FROM payments WHERE id = ?').get(result.lastInsertRowid)
  );
});

// ----- Sales Report -----
app.get('/reports/sales', protect, (req, res) => {
  const { from, to } = req.query;

  if ((from && !isDate(from)) || (to && !isDate(to))) {
    return res.status(400).json({
      error: 'from and to must look like 2026-11-30',
    });
  }

  if (from && to && from > to) {
    return res.status(400).json({
      error: 'from must be on or before to',
    });
  }

  const conditions = [];
  const values = [];

  if (from) {
    conditions.push('payments.paid_at >= ?');
    values.push(from);
  }

  if (to) {
    conditions.push('payments.paid_at <= ?');
    values.push(to);
  }

  const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

  const totals = db
    .prepare(
      `SELECT COUNT(*) AS count,
              COALESCE(SUM(amount), 0) AS total,
              COALESCE(SUM(CASE WHEN job_id IS NOT NULL THEN amount END), 0) AS services,
              COALESCE(SUM(CASE WHEN product_id IS NOT NULL THEN amount END), 0) AS products
       FROM payments ${where}`
    )
    .get(...values);

  const byMethod = db
    .prepare(
      `SELECT method, COUNT(*) AS count, SUM(amount) AS total
       FROM payments ${where}
       GROUP BY method
       ORDER BY total DESC`
    )
    .all(...values);

  const byDay = db
    .prepare(
      `SELECT paid_at AS day, SUM(amount) AS total
       FROM payments ${where}
       GROUP BY paid_at
       ORDER BY paid_at`
    )
    .all(...values);

  const topProducts = db
    .prepare(
      `SELECT products.name, SUM(payments.quantity) AS qty,
              SUM(payments.amount) AS total
       FROM payments
       JOIN products ON payments.product_id = products.id
       ${where}
       GROUP BY products.id
       ORDER BY total DESC
       LIMIT 5`
    )
    .all(...values);

  const items = db
    .prepare(
      PAYMENT_LIST_SQL +
      ` ${where} ORDER BY payments.paid_at DESC, payments.id DESC`
    )
    .all(...values);

  const { outstanding } = db
    .prepare(
      `SELECT COALESCE(SUM(
                service_jobs.price - COALESCE(
                  (SELECT SUM(amount) FROM payments
                   WHERE payments.job_id = service_jobs.id), 0
                )
              ), 0) AS outstanding
       FROM service_jobs`
    )
    .get();

  res.json({
    from: from || null,
    to: to || null,
    totals: { ...totals, outstanding: money(outstanding) },
    byMethod,
    byDay,
    topProducts,
    items,
  });
});

// ---------- ERRORS (KEEP THESE AT THE VERY BOTTOM) ----------
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: 'Request body is not valid JSON',
    });
  }

  if (err.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
    return res.status(409).json({
      error: 'This record is linked to other records, so it cannot be removed.',
    });
  }

  console.error(err.message);

  res.status(500).json({
    error: 'Something went wrong on the server',
  });
});

// ---------- START SERVER ----------
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Open: http://localhost:${PORT}/login.html`);
});