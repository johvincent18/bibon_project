const db = require('./db');

const input = "x' OR '1'='1";

const unsafe = db.prepare(`SELECT * FROM service_jobs WHERE status = '${input}'`).all();
console.log('UNSAFE version returned', unsafe.length, 'rows');

const safe = db.prepare('SELECT * FROM service_jobs WHERE status = ?').all(input);
console.log('SAFE version returned', safe.length, 'rows');