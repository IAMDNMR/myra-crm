# MYRA CRM
**Manage Your Relationships & Activities**

A custom-built CRM system for BlueGecko / NextGenlytics.

## Tech Stack
- **Frontend**: React + TypeScript + Vite + TanStack Router
- **Backend**: Python FastAPI + SQLite
- **Styling**: Tailwind CSS + shadcn/ui

## Running Locally

### Backend
```bash
cd backend
.\venv\Scripts\activate
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### Frontend
```bash
npm run dev
```

### Super Admin Login
- Email: `bluegecko.intelligence@nextgenlytics.com`
- Password: See `backend/.env`

## Modules
- **Leads** — Track inbound prospects
- **Contacts** — Manage key relationships
- **Companies** — Account management
- **Pipeline** — Visual deal tracking
- **Tasks** — Activity management with custom statuses
- **Reports** — Analytics and insights
- **Settings** — Pipelines, task statuses, team management
