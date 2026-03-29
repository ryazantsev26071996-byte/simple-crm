# Backend (Express + SQLite)

## Env

Create `.env` (optional). Example:

`DATABASE_PATH` - path to SQLite DB file (default: `data/crm.sqlite`)
`PORT` - server port (default: `4000`)

## API

- `GET /api/clients`
- `POST /api/clients` (Manager)
- `PUT /api/clients/:id` (Manager)
- `GET /api/clients/:id/comments`
- `POST /api/clients/:id/comments` (Teacher)

## Headers (no login)

Backend expects:

- `x-user-role`: `Manager` or `Teacher`
- `x-user-name`: any string (stored as comment author)

