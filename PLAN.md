# CellHub Enhancement Plan

## 1. Database Schema Changes
- Add `inventory` table (parts stock)
- Add `payments` table (payment tracking per job)
- Add `settings` table (business settings)
- Add `payment_status`, `amount_paid` to `service_jobs`

## 2. Backend API Endpoints
- `/inventory` - CRUD for parts inventory
- `/jobs/:id/payment` - Record payment for a job
- `/sales` - Sales summary (completed jobs with payments)
- `/reports` - Generate printable reports
- `/settings` - Get/update business settings

## 3. Frontend Architecture
- `login.html` - Separate login page (redirects to dashboard)
- `dashboard.html` - Main dashboard with sidebar navigation
- `inventory.html` - Inventory management
- `sales.html` - Sales tracking
- `reports.html` - Printable reports
- `settings.html` - Settings page
- Shared `style.css` with animations
- Shared `app.js` for common logic + page-specific modules

## 4. UI/UX Improvements
- Smooth page transitions (fade/slide animations)
- Sidebar with Inventory, Sales, Reports, Settings
- Logout button fixed at bottom of sidebar
- Fully responsive (mobile-first)
- Print-friendly reports