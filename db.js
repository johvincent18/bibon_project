const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'cellhub.db'));
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  address TEXT
);

CREATE TABLE IF NOT EXISTS service_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL,
  device_model TEXT NOT NULL,
  issue TEXT NOT NULL,
  job_type TEXT NOT NULL,
  price REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pending',
  date_received TEXT NOT NULL,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);
`);

const count = db.prepare('SELECT COUNT(*) AS total FROM customers').get().total;

if (count === 0) {
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

module.exports = db;