
// ---------- TEST ENVIRONMENT ----------
process.env.DB_FILE = ':memory:';
process.env.JWT_SECRET = 'test-secret-only-for-tests';
process.env.WEATHER_KEY = '';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const app = require('../server');

let server;
let base;
let token;

before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });

  base = 'http://localhost:' + server.address().port;
});

after(() => {
  server.closeAllConnections();
  server.close();
});

// ---------- HELPER ----------
async function call(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json'
  };

  if (options.token) {
    headers.Authorization = 'Bearer ' + options.token;
  }

  const res = await fetch(base + path, {
    method: options.method || 'GET',
    headers,
    body: options.body
      ? JSON.stringify(options.body)
      : undefined
  });

  const data = await res.json();

  return {
    status: res.status,
    data
  };
}

// ---------- 1. HEALTH ----------
test('health route answers ok', async () => {
  const { status, data } = await call('/health');

  assert.equal(status, 200);
  assert.equal(data.status, 'ok');
});

// ---------- 2. CUSTOMERS ----------
test('customers list returns rows', async () => {
  const { status, data } = await call('/customers');

  assert.equal(status, 200);
  assert.ok(Array.isArray(data));
  assert.ok(data.length >= 1);
});

test('unknown customer gives 404', async () => {
  const { status, data } = await call('/customers/9999');

  assert.equal(status, 404);
  assert.equal(data.error, 'Customer not found');
});

test('customer summary returns job totals', async () => {
  const { status, data } = await call('/customers/summary');

  assert.equal(status, 200);
  assert.ok(Array.isArray(data));
  assert.ok(data[0].totalJobs !== undefined);
  assert.ok(data[0].totalPrice !== undefined);
});

test('customer jobs route returns rows', async () => {
  const { status, data } = await call('/customers/1/jobs');

  assert.equal(status, 200);
  assert.ok(Array.isArray(data));
});

test('unknown customer jobs gives 404', async () => {
  const { status } = await call('/customers/9999/jobs');

  assert.equal(status, 404);
});

// ---------- 3. JOBS ----------
test('jobs list returns paginated data', async () => {
  const { status, data } = await call('/jobs');

  assert.equal(status, 200);
  assert.ok(Array.isArray(data.data));
  assert.equal(data.page, 1);
  assert.equal(data.limit, 10);
  assert.ok(data.total >= 1);
});

test('jobs details returns customer names', async () => {
  const { status, data } = await call('/jobs/details');

  assert.equal(status, 200);
  assert.ok(Array.isArray(data));
  assert.ok(data.length >= 1);
  assert.ok(data[0].customer_name);
});

test('unknown job gives 404', async () => {
  const { status } = await call('/jobs/9999');

  assert.equal(status, 404);
});

test('page size above 50 gives 400', async () => {
  const { status } = await call('/jobs?limit=500');

  assert.equal(status, 400);
});

test('invalid sorting gives 400', async () => {
  const { status } = await call('/jobs?sort=invalid_column');

  assert.equal(status, 400);
});

test('job pagination works', async () => {
  const { status, data } = await call('/jobs?page=1&limit=2');

  assert.equal(status, 200);
  assert.equal(data.limit, 2);
  assert.equal(data.data.length, 2);
});

// ---------- 4. AUTHENTICATION ----------
test('register works and never returns password', async () => {
  const { status, data } = await call('/auth/register', {
    method: 'POST',
    body: {
      name: 'CellHub Tester',
      email: 'cellhubtest@test.com',
      password: 'secret123'
    }
  });

  assert.equal(status, 201);
  assert.equal(data.email, 'cellhubtest@test.com');
  assert.equal(data.password, undefined);
  assert.equal(data.passwordHash, undefined);
});

test('registering the same email again gives 409', async () => {
  const { status } = await call('/auth/register', {
    method: 'POST',
    body: {
      name: 'CellHub Tester',
      email: 'cellhubtest@test.com',
      password: 'secret123'
    }
  });

  assert.equal(status, 409);
});

test('short password gives 400', async () => {
  const { status } = await call('/auth/register', {
    method: 'POST',
    body: {
      name: 'Short',
      email: 'short@test.com',
      password: '123'
    }
  });

  assert.equal(status, 400);
});

test('wrong password gives 401', async () => {
  const { status } = await call('/auth/login', {
    method: 'POST',
    body: {
      email: 'cellhubtest@test.com',
      password: 'wrong-password'
    }
  });

  assert.equal(status, 401);
});

test('login gives a token', async () => {
  const { status, data } = await call('/auth/login', {
    method: 'POST',
    body: {
      email: 'cellhubtest@test.com',
      password: 'secret123'
    }
  });

  assert.equal(status, 200);
  assert.ok(data.token);

  token = data.token;
});

test('logged in user can access auth me', async () => {
  const { status, data } = await call('/auth/me', {
    token
  });

  assert.equal(status, 200);
  assert.equal(data.email, 'cellhubtest@test.com');
});

test('auth me without token gives 401', async () => {
  const { status } = await call('/auth/me');

  assert.equal(status, 401);
});

// ---------- 5. PROTECTED ROUTES ----------
test('creating a customer without token gives 401', async () => {
  const { status } = await call('/customers', {
    method: 'POST',
    body: {
      name: 'Test Customer',
      phone: '0900'
    }
  });

  assert.equal(status, 401);
});

test('creating a job without token gives 401', async () => {
  const { status } = await call('/jobs', {
    method: 'POST',
    body: {
      customer_id: 1,
      device_model: 'Samsung A15',
      issue: 'Broken screen',
      job_type: 'Screen Replacement',
      price: 2500
    }
  });

  assert.equal(status, 401);
});

// ---------- 6. JOB VALIDATION ----------
test('job with unknown customer_id gives 400', async () => {
  const { status } = await call('/jobs', {
    method: 'POST',
    token,
    body: {
      customer_id: 999999,
      device_model: 'Test Phone',
      issue: 'Broken screen',
      job_type: 'Screen Repair',
      price: 500
    }
  });

  assert.equal(status, 400);
});

test('job with invalid status gives 400', async () => {
  const { status } = await call('/jobs', {
    method: 'POST',
    token,
    body: {
      customer_id: 1,
      device_model: 'Test Phone',
      issue: 'Testing',
      job_type: 'Repair',
      price: 500,
      status: 'Invalid Status'
    }
  });

  assert.equal(status, 400);
});

// ---------- 7. PRODUCTS ----------
test('products without token gives 401', async () => {
  const { status } = await call('/products');

  assert.equal(status, 401);
});

// ---------- 8. WEATHER ----------
test('weather without API key gives 503', async () => {
  const { status, data } = await call('/weather');

  assert.equal(status, 503);
  assert.ok(data.error);
});

// ---------- 9. UNKNOWN ROUTE ----------
test('unknown route gives JSON 404', async () => {
  const { status, data } = await call('/nothing-here');

  assert.equal(status, 404);
  assert.equal(data.error, 'Route not found');
});
