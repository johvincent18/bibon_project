const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const dbFile = process.env.DB_FILE || path.join(__dirname, 'cellhub.db');
const db = new Database(dbFile);
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  passwordHash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'staff'
);

CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT
);

CREATE TABLE IF NOT EXISTS service_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL,
  device_model TEXT NOT NULL,
  issue TEXT,
  job_type TEXT NOT NULL,
  price REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pending',
  date_received TEXT NOT NULL,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  price REAL NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0,
  reorder_level INTEGER NOT NULL DEFAULT 5
);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER,
  job_id INTEGER,
  product_id INTEGER,
  quantity INTEGER NOT NULL DEFAULT 1,
  amount REAL NOT NULL,
  method TEXT NOT NULL,
  paid_at TEXT NOT NULL,
  note TEXT,
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (job_id) REFERENCES service_jobs(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);
`);

// ---------- 1. CUSTOMERS + JOBS (dapat una) ----------
if (db.prepare('SELECT COUNT(*) AS total FROM customers').get().total === 0) {
  const addCustomer = db.prepare(
    'INSERT INTO customers (name, phone, email, address) VALUES (?, ?, ?, ?)'
  );
  addCustomer.run('Maria Santos', '0917-111-2222', 'maria.santos@gmail.com', 'Ibabang Dupay, Lucena City');
  addCustomer.run('Juan Dela Cruz', '0918-333-4444', 'juan.delacruz@gmail.com', 'Poblacion, Tayabas');
  addCustomer.run('Ana Reyes', '0919-555-6666', 'ana.reyes@gmail.com', 'Sampaloc, Sariaya');
  addCustomer.run('Carlo Mendoza', '0920-777-8888', 'carlo.mendoza@gmail.com', 'Isabang, Lucena City');
  addCustomer.run('Liza Garcia', '0921-999-0000', 'liza.garcia@gmail.com', 'Poblacion, Candelaria');
  addCustomer.run('Paolo Ramos', '0922-123-4567', 'paolo.ramos@gmail.com', 'Gulang-gulang, Lucena City');
  addCustomer.run('Jenny Aquino', '0923-234-5678', 'jenny.aquino@gmail.com', 'Poblacion, Pagbilao');
  addCustomer.run('Mark Villanueva', '0924-345-6789', 'mark.villanueva@gmail.com', 'Bignay, Sariaya');

  const addJob = db.prepare(
    'INSERT INTO service_jobs (customer_id, device_model, issue, job_type, price, status, date_received) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  addJob.run(1, 'Samsung Galaxy A14', 'Cracked screen', 'Screen Replacement', 2500, 'Pending', '2026-11-02');
  addJob.run(1, 'Samsung Galaxy A14', 'Screen protector', 'Accessory Purchase', 150, 'Completed', '2026-11-02');
  addJob.run(2, 'iPhone 11', 'Battery drains fast', 'Battery Replacement', 1800, 'In Progress', '2026-11-03');
  addJob.run(3, 'Oppo A57', 'Forgot pattern lock', 'Unlocking', 500, 'Completed', '2026-11-01');
  addJob.run(4, 'Realme C55', 'Not charging', 'Charging Port Repair', 900, 'Pending', '2026-11-04');
  addJob.run(4, 'Realme C55', 'Phone case', 'Accessory Purchase', 200, 'Released', '2026-11-04');
  addJob.run(6, 'Vivo Y20', 'No display after drop', 'Screen Replacement', 3200, 'Pending', '2026-11-04');
  addJob.run(6, 'Vivo Y20', 'Tempered glass', 'Accessory Purchase', 120, 'Completed', '2026-11-04');
  addJob.run(7, 'Infinix Hot 30', 'Slow and hangs', 'Software Update', 350, 'In Progress', '2026-11-04');
}

// ---------- 2. PRODUCTS ----------
if (db.prepare('SELECT COUNT(*) AS total FROM products').get().total === 0) {
  const addProduct = db.prepare(
    'INSERT INTO products (name, category, price, stock, reorder_level) VALUES (?, ?, ?, ?, ?)'
  );
  addProduct.run('Tempered Glass 9H', 'Accessories', 120, 40, 10);
  addProduct.run('Universal Phone Case', 'Accessories', 200, 25, 8);
  addProduct.run('Fast Charger 20W', 'Chargers', 450, 12, 5);
  addProduct.run('USB-C Cable 1m', 'Cables', 150, 30, 10);
  addProduct.run('Power Bank 10000mAh', 'Power', 850, 4, 5);
  addProduct.run('Earphones with Mic', 'Audio', 180, 18, 6);
  addProduct.run('iPhone 11 Battery', 'Parts', 1200, 6, 3);
  addProduct.run('Samsung A14 LCD', 'Parts', 1800, 2, 3);
}

// ---------- 3. PAYMENTS (dapat huli, kailangan nito ang jobs at products) ----------
if (db.prepare('SELECT COUNT(*) AS total FROM payments').get().total === 0) {
  const findJob = db.prepare('SELECT customer_id, price FROM service_jobs WHERE id = ?');
  const findProduct = db.prepare('SELECT price FROM products WHERE id = ?');
  const addPayment = db.prepare(
    'INSERT INTO payments (customer_id, job_id, product_id, quantity, amount, method, paid_at, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );
  const reduceStock = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?');

  const payJob = (jobId, amount, method, date) => {
    const job = findJob.get(jobId);
    if (job && amount <= job.price) {
      addPayment.run(job.customer_id, jobId, null, 1, amount, method, date, null);
    }
  };
  const sell = (productId, qty, method, date) => {
    const product = findProduct.get(productId);
    if (product) {
      addPayment.run(null, null, productId, qty, product.price * qty, method, date, 'Walk-in sale');
      reduceStock.run(qty, productId);
    }
  };

  payJob(1, 1000, 'GCash', '2026-11-02');
  payJob(2, 150, 'Cash', '2026-11-02');
  payJob(3, 900, 'Cash', '2026-11-03');
  payJob(4, 500, 'GCash', '2026-11-01');
  payJob(6, 200, 'Cash', '2026-11-04');
  sell(1, 3, 'Cash', '2026-11-03');
  sell(3, 1, 'GCash', '2026-11-04');
  sell(4, 2, 'Cash', '2026-11-05');
}

// ---------- 4. DEMO ADMIN (survives redeploys on Render) ----------
const demoEmail = process.env.DEMO_EMAIL;
const demoPassword = process.env.DEMO_PASSWORD;
if (demoEmail && demoPassword) {
  const email = demoEmail.trim().toLowerCase();
  const found = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (!found) {
    const hash = bcrypt.hashSync(demoPassword, 10);
    db.prepare(
      "INSERT INTO users (name, email, passwordHash, role) VALUES (?, ?, ?, 'admin')"
    ).run('Demo Admin', email, hash);
  }
}

module.exports = db;