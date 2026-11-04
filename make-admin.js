const db = require('./db');

const email = process.argv[2];

if (!email) {
  console.log('Usage: node make-admin.js email@example.com');
  process.exit(1);
}

const result = db
  .prepare('UPDATE users SET role = ? WHERE email = ?')
  .run('admin', email.trim().toLowerCase());

if (result.changes === 0) {
  console.log('User not found. Register the account first.');
} else {
  console.log(`${email} is now an admin.`);
}

db.close();