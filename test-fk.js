const db = require('./db');

try {
  db.prepare(
    'INSERT INTO service_jobs (customer_id, device_model, issue, job_type, price, status, date_received) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(999, 'iPhone 12', 'Test', 'Repair', 100, 'Pending', '2026-11-04');
  console.log('Row was saved. The relationship is NOT protected.');
} catch (err) {
  console.log('Blocked:', err.message);
}