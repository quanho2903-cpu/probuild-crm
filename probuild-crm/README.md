# Construction CRM & Project Tracker

This is a simple internal CRM web app for a construction company.

## Main features

- Company login
- Admin/staff dashboard
- Customer pipeline
- Track customer stages:
  - New Lead
  - Contacted
  - Site Inspection
  - Quotation Sent
  - Negotiation
  - Contract Signed
  - Design
  - Permit Approval
  - Construction
  - Final Inspection
  - Handover
  - Warranty
  - Completed
- Add/edit/delete customers
- Track project type, budget, address, assigned staff, next action, due date and notes
- SQLite database shared by all staff using the same server

## Demo login

Email: admin@company.com  
Password: admin123

## How to run locally

1. Install Node.js
2. Open Terminal in this folder
3. Run:

```bash
npm install
npm start
```

4. Open:

```text
http://localhost:3000
```

## How company staff can use it together

Option A: Same office Wi-Fi / LAN

1. Run this app on one office computer or mini server.
2. Find that computer's local IP address.
3. Other staff open:

```text
http://YOUR-SERVER-IP:3000
```

Example:

```text
http://192.168.1.20:3000
```

Option B: Online company use

Deploy it to a cloud server such as Render, Railway, Fly.io, DigitalOcean, AWS, Azure, or a company VPS.

For real business use, change:
- JWT_SECRET
- Admin password
- Add proper user management
- Use PostgreSQL instead of SQLite
- Add backups
- Add HTTPS
- Add role permissions