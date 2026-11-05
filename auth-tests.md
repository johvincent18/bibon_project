# CellHub Auth Tests

| # | Test | Request | Expected | Actual |
|---|------|---------|----------|--------|
| 1 | Register ok | POST /auth/register {"name":"Ben Lim","email":"ben@test.com","password":"secret123"} | 201, no password shown | |
| 2 | Duplicate email | POST /auth/register (same body as #1) | 409 | |
| 3 | Short password | POST /auth/register with password "123" | 400 | |
| 4 | Bad email | POST /auth/register with email "abc" | 400 | |
| 5 | Login ok | POST /auth/login {"email":"ana@test.com","password":"secret123"} | 200 + token | |
| 6 | Wrong password | POST /auth/login with password "wrongpass" | 401 | |
| 7 | Missing token | POST /customers (no Authorization header) | 401 Please log in first | |
| 8 | Fake token | POST /customers with Authorization: Bearer abc | 401 invalid or expired | |
| 9 | Good token | POST /customers with a real token | 201 | |
| 10 | Public read | GET /customers (no token) | 200 + list | |
| 11 | Staff delete | DELETE /jobs/:id with a staff token | 403 Admins only | |
| 12 | Admin delete | DELETE /jobs/:id with an admin token (after make-admin and a new login) | 200 | |
| 13 | Expired token | POST /customers with a token older than 20s (expiry experiment) | 401 | |

## Logout question

(Write your 2 sentences here.)