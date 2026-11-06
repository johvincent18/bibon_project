# Final Checklist

Write PASS or FAIL for each check. Write a short note for every FAIL.

## A. On my PC
1. npm test shows fail 0: 
2. node server.js starts with no red errors: 
3. Page opens at http://localhost:3000 with data: 
4. New account registered and logged in: 
5. Add, change, delete from the page: 
6. Wrong password shows a Problem message: 
7. Keyboard only login works: 
8. Phone width has no sideways scroll: (tables sit inside a scrolling box, so check the page itself)

## B. My live site
9. Live address opens: 
10. Demo login works: 
11. Add, change, delete work live: 
12. Weather box works live: 
13. GET /health live gives 200: 
14. POST without a token gives 401: PASS (POST /jobs, /customers, /products, /payments all use requireAuth)

## C. GitHub
15. README.md, api-docs.md, tests, .env.example, public are there: 
16. .env and the .db file are NOT there: 
17. My key is not found anywhere in the code: 
18. Commit history has 6 or more commits: 
19. README has my live address: 
20. api-docs.md has one row for every route: (server.js has about 22 routes, count them)

## D. I can explain
21. Why the password is hashed:
 If someone steals my database, they only see scrambled hashes and not the real passwords, and a hash can’t be turned back into the password. In my project, bcrypt.hashSync(password, 10) hashes it at register, and bcrypt.compareSync checks it at login.

22. Why the weather key stays on the server: 
Anything in app.js can be seen by every visitor through View Source, so anyone could steal my key and use up my WeatherAPI limit. The key stays in .env, and the browser only calls my own /weather route, which calls WeatherAPI for it.

23. The difference between 401 and 403: 
there is no token, or it’s invalid or expired. 403 means “I know who you are, but you’re not allowed to do this,” like a staff user trying an admin-only action. My project only returns 401 right now.

24. What happens to my data when Render redeploys:

On the free plan, the SQLite database file is erased on every redeploy, so anything I added by hand is lost. I prepared for it with seed data that is added back automatically, and a demo admin that is recreated from DEMO_EMAIL and DEMO_PASSWORD on Render, so I can always log in.