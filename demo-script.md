# Demo Script

## 1. Intro (1 minute)
"Hello, my name is ____. My project is CellHub, a system for a cellphone repair shop. Shops like this often track repairs, payments and stock on paper. CellHub puts customers, repair jobs, payments and inventory in one place, so the owner can see the numbers at a glance."

## 2. Live page (1 minute)
I open my .onrender.com address (already awake) and log in with the demo account.
"This is the dashboard. It shows total jobs, jobs in the queue, money collected, and low-stock items. Below is today's weather for Lucena, with a tip for the shop."

## 3. Use it (1 minute)
- Click Register here, create a new account, log in.
- Add a service job: pick a customer, type a device, price, issue, job type, click Add job.
- Change its status in the table to In Progress.
- Delete that same job. (Only jobs with no payments can be deleted, and I will say that.)

## 4. A problem (1 minute)
I log out and log in with a wrong password.
"The page shows a clear message that starts with Problem, so the user knows what to fix."

## 5. The API (1 minute)
In Thunder Client:
- GET /jobs, shows the list with page and total.
- POST /auth/login, copy the token.
- POST /jobs with the token in the Authorization header, status 201.
- POST /jobs without a token, status 401: "Please log in first".

## 6. The code (1 minute)
Route: POST /jobs in server.js.
"First, requireAuth checks the token. Then I check each field: customer_id is a whole number, the text fields are not empty, price is a number, status is in the allowed list. Then I check that the customer exists, so a wrong foreign key is rejected. Last, I insert with ? placeholders, which protects against SQL injection, and return 201."

## 7. Tests (1 minute)
I type npm test and show fail 0.

## 8. Limits and next steps (1 minute)
"On the Render free plan, my SQLite database is erased on every redeploy. The demo admin is recreated from DEMO_EMAIL and DEMO_PASSWORD, and the seed data is added back automatically. Next, I would move to a hosted database so data is kept, and add admin-only actions that return 403."

## Quick answers (say them out loud)
- Why hash passwords: if the database leaks, nobody can read the real passwords.
- Why the weather key stays on the server: anything in app.js can be seen by every visitor, so the key stays in .env and the browser calls my /weather route.
- 401 vs 403: 401 means not logged in or bad token. 403 means logged in but not allowed. (My code only uses 401 today.)
- Redeploy: the database file is erased, so I use seed data and demo env variables to rebuild it.