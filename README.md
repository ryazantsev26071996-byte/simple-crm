# Simple CRM (React + Node/Express + SQLite)

## What it does

- **Clients (Manager only):** add/edit clients and see them in a table
- **Comments (Teacher only):** add a comment wall per client, with timestamp + author
- **UI:** minimal dashboard with client list on the left and client details + comments on the right

## Folder structure

- `backend/` Express REST API with SQLite
- `frontend/` React (Vite) dashboard

## Run

### Backend

```bash
cd backend
npm install
npm run dev
```

Backend listens on `http://localhost:4000`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`.

## How role-based permissions work

There is no real login. Use the top bar to set:

- `Manager`:
  - can add/edit clients
  - can view comments
- `Teacher`:
  - can add comments (student progress)
  - can view clients

The frontend sends the selected role and author name in headers:

- `x-user-role`
- `x-user-name`

## Notes

- SQLite database file is created automatically at `backend/data/crm.sqlite`.
- Comments are returned sorted by newest first.

