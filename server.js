require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./db');

const app = express();
app.use(express.json());
app.use(cors());
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'CellHub API is running' });
});

app.get('/customers', (req, res) => {
  const rows = db.prepare('SELECT * FROM customers').all();
  res.json(rows);
});

app.get('/customers/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
  if (!row) {
    return res.status(404).json({ error: 'Customer not found' });
  }
  res.json(row);
});

// Challenge: all jobs of one customer
app.get('/customers/:id/jobs', (req, res) => {
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
  if (!customer) {
    return res.status(404).json({ error: 'Customer not found' });
  }
  const rows = db.prepare('SELECT * FROM service_jobs WHERE customer_id = ?').all(req.params.id);
  res.json(rows);
});

app.get('/jobs', (req, res) => {
  const { status, job_type } = req.query;
  let sql = 'SELECT * FROM service_jobs';
  const conditions = [];
  const values = [];

  if (status) {
    conditions.push('status = ?');
    values.push(status);
  }
  if (job_type) {
    conditions.push('job_type = ?');
    values.push(job_type);
  }
  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }

  const rows = db.prepare(sql).all(...values);
  res.json(rows);
});

app.get('/jobs/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM service_jobs WHERE id = ?').get(req.params.id);
  if (!row) {
    return res.status(404).json({ error: 'Service job not found' });
  }
  res.json(row);
});

// 404 for any unknown route
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Open: http://localhost:${PORT}`);
});