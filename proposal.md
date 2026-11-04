# CellHub: Capstone Proposal

## Business Idea

CellHub is a cellphone shop system that manages customers and their repair/service jobs, so the shop can track what was dropped off, its status, and the cost.

## Database Design

### Table 1: customers

| Column  | Type                                  |
|---------|---------------------------------------|
| id      | INTEGER (primary key, auto-increment) |
| name    | TEXT                                  |
| phone   | TEXT                                  |
| email   | TEXT                                  |
| address | TEXT                                  |

### Table 2: service_jobs

| Column        | Type                                              |
|---------------|---------------------------------------------------|
| id            | INTEGER (primary key, auto-increment)             |
| customer_id   | INTEGER (foreign key -> customers.id)             |
| device_model  | TEXT                                              |
| issue         | TEXT                                              |
| job_type      | TEXT (repair, unlocking, accessory purchase)      |
| price         | REAL                                              |
| status        | TEXT (pending, in progress, completed, released)  |
| date_received | TEXT                                              |

### Relationship

One customer can have many service jobs. `service_jobs.customer_id` links each job to a row in `customers`.

## Routes

| Method | Route          | What it does                         |
|--------|----------------|--------------------------------------|
| GET    | /customers     | Returns all customers.               |
| GET    | /customers/:id | Returns one customer by id.          |
| POST   | /customers     | Adds a new customer.                 |
| GET    | /jobs          | Returns all service jobs.            |
| GET    | /jobs/:id      | Returns one service job by id.       |
| POST   | /jobs          | Creates a new service job.           |
| PUT    | /jobs/:id      | Updates the status of a service job. |
| DELETE | /jobs/:id      | Removes a service job.               |