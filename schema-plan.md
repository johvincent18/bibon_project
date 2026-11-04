# CellHub Database Design

## Table 1: customers

| Column  | Type                                  |
|---------|---------------------------------------|
| id      | INTEGER (primary key, auto-increment) |
| name    | TEXT                                  |
| phone   | TEXT                                  |
| email   | TEXT                                  |
| address | TEXT                                  |

## Table 2: service_jobs

| Column        | Type                                           |
|---------------|------------------------------------------------|
| id            | INTEGER (primary key, auto-increment)          |
| customer_id   | INTEGER (foreign key -> customers.id)          |
| device_model  | TEXT                                           |
| issue         | TEXT                                           |
| job_type      | TEXT (repair, unlocking, accessory purchase)   |
| price         | REAL                                           |
| status        | TEXT (pending, in progress, completed, released) |
| date_received | TEXT                                           |

## Relationship

One customer can have many service jobs. `service_jobs.customer_id` links each job to a row in `customers`.