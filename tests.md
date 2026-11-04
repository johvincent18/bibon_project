# CellHub Test Plan

| # | Test | Request | Expected | Actual |
|---|------|---------|----------|--------|
| 1 | JOIN | GET /jobs/details | 200, shows customer_name | |
| 2 | Create customer | POST /customers {"name":"Pedro Lim","phone":"0925-111-2222"} | 201 | |
| 3 | Create job | POST /jobs {"customer_id":2,"device_model":"Xiaomi Redmi 12","issue":"Broken speaker","job_type":"Speaker Repair","price":450} | 201, status Pending | |
| 4 | Bad data | POST /jobs {"customer_id":999,...} | 400 | |
| 5 | Wrong status | POST /jobs with "status":"Maybe" | 400 | |
| 6 | Update | PUT /jobs/1 {"status":"Completed"} | 200 | |
| 7 | Missing record | PUT /jobs/99 {"status":"Completed"} | 404 | |
| 8 | Blocked delete | DELETE /customers/1 | 409 | |
| 9 | Delete job | DELETE /jobs/10 | 200 | |
| 10 | Pagination | GET /jobs?page=2&limit=2 | 200, 2 records | |
| 11 | Sort | GET /jobs?sort=price&order=desc | 200, highest price first | |
| 12 | Filter | GET /jobs?status=Pending | 200, only Pending | |
| 13 | Invalid limit | GET /jobs?limit=500 | 400 | |
| 14 | Unknown route | GET /nothing | 404 | |
| 15 | Bonus route | GET /customers/summary | 200, jobs count per customer | |