require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./db');

const app = express();
app.use(express.json());
app.use(cors());
const PORT = process.env.PORT || 3000;

const ALLOWED_STATUS = ['Pending', 'In Progress', 'Completed', 'Released'];
const SORTABLE = ['id', 'customer_id', 'device_model', 'job_type', 'price', 'status', 'date_received'];

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'CellHub API is running' });
});

// ---------- CUSTOMERS ----------
app.get('/customers', (req, res) => {
  res.json(db.prepare('SELECT * FROM customers').all());
});

// Bonus: job count and total price per customer (must stay ABOVE /customers/:id)
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

app.post('/customers', (req, res) => {
  const { name, phone, email = null, address = null } = req.body || {};
  if ([name, phone].some((f) => typeof f !== 'string' || f.trim() === '')) {
    return res.status(400).json({ error: 'name and phone are required' });
  }
  if ((email !== null && typeof email !== 'string') || (address !== null && typeof address !== 'string')) {
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

app.delete('/customers/:id', (req, res) => {
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
      `SELECT service_jobs.id, customers.name AS customer_name, customers.phone,
              service_jobs.device_model, service_jobs.job_type,
              service_jobs.price, service_jobs.status
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

  res.json({ page, limit, total, totalPages: Math.ceil(total / limit), data });
});

app.get('/jobs/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM service_jobs WHERE id = ?').get(req.params.id);
  if (!row) {
    return res.status(404).json({ error: 'Service job not found' });
  }
  res.json(row);
});

app.post('/jobs', (req, res) => {
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
    .run(customer_id, device_model.trim(), issue.trim(), job_type.trim(), price, status, date_received.trim());
  const created = db
    .prepare('SELECT * FROM service_jobs WHERE id = ?')
    .get(result.lastInsertRowid);
  res.status(201).json(created);
});

app.put('/jobs/:id', (req, res) => {
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

app.delete('/jobs/:id', (req, res) => {
  const result = db.prepare('DELETE FROM service_jobs WHERE id = ?').run(req.params.id);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Service job not found' });
  }
  res.json({ message: 'Service job deleted' });
});

// ---------- ERRORS (keep these at the very bottom) ----------
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Request body is not valid JSON' });
  }
  console.error(err.message);
  res.status(500).json({ error: 'Something went wrong on the server' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Open: http://localhost:${PORT}`);
});