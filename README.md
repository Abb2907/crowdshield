# CrowdShield AI – Smart Stadium Operating System

## Overview

**CrowdShield AI** is a real‑time, AI‑powered stadium management platform that simulates a high‑capacity cricket match (e.g., an IPL showdown at Chinnaswamy Stadium).  It provides:
- **Live telemetry** for zones, gates, and incidents.
- **AI‑generated briefings** that adapt to the current stadium state.
- **Audio‑rich feedback** (ambient hum, alerts, evacuation sirens, speech synthesis).
- **Ticket‑scan simulation** and **spectator chatbot** for a fully immersive fan‑assistant experience.

The system is built as a **monorepo** with three primary workspaces:
1. **`backend`** – a TypeScript/Node.js server that hosts the WebSocket API, connects to Supabase, and drives the simulation logic.
2. **`apps/web`** – a React+Vite SPA that renders the command‑center UI, visualises the stadium map, gates, and analytics, and interacts with the backend via Socket.IO.
3. **`packages/*`** – shared utilities (currently empty but ready for future extensions).

> **Why 90 k+ capacity?**  The in‑memory fallback data has been updated to reflect a 95 000‑seat stadium (23k + 20k + 28k + 24k) to mimic a blockbuster IPL match and stress‑test the evacuation flow.

---

## Architecture

```
crowdcommand-workspace/
├─ backend/                # Node.js + TypeScript server
│   ├─ src/index.ts        # Core simulation, Socket.IO, Supabase sync
│   ├─ src/test_auth.ts   # Simple auth test (JWT stub)
│   └─ supabase/          # Supabase migration & seed data
│       └─ migrations/20260523000000_init_schema.sql
│
├─ apps/web/               # Vite + React front‑end
│   ├─ src/App.tsx         # Main UI, hooks into audioEngine & socket
│   ├─ src/audio.ts        # AudioEngine (ambient, chime, alert, siren)
│   └─ public/ …
│
├─ packages/               # Shared libraries (future)
│
├─ package.json            # Workspace definitions & scripts
└─ README.md               # **You are here** – project documentation
```

### Backend
- **Tech stack**: Node.js, TypeScript, Socket.IO, Supabase client (`@supabase/supabase-js`).
- **Entry point**: `src/index.ts`.
- **Core responsibilities**:
  - Initialise Supabase, fetch/seed stadium data.
  - Maintain in‑memory state for zones, gates, incidents, and AI briefings.
  - Broadcast updates to all connected clients via Socket.IO.
  - Provide REST endpoints (e.g., `/auth/token`) for the front‑end.
- **Database**: Supabase Postgres with tables for `stadium_zones`, `gates`, `incidents`, `alerts`. The seed migration populates the **90 k+** capacities.

### Front‑end (Web App)
- **Tech stack**: React 18, TypeScript, Vite, Zustand for state management, Socket.IO client, Framer Motion for UI animations, Recharts for analytics.
- **Key modules**:
  - `App.tsx` – orchestrates UI panels (map, gates, analytics), connects to the socket, and syncs with the audio engine.
  - `audio.ts` – `StadiumAudioEngine` delivers ambient sound, chimes, alerts, and an evacuation siren; also uses Web Speech API for AI briefings.
  - `scanner` – a ticket‑scan view that validates gate IDs (real/fake) and shows the result.
- **Audio controls**: Mute toggle (`audioMuted` state) persists across sessions; chime plays on un‑mute, alerts on new incidents, siren on evacuation.
- **AI Briefings**: Short spoken summaries are generated on the backend and spoken via `speechSynthesis`.

---

## Getting Started

### Prerequisites
- **Node.js** (v18+ recommended)
- **npm** (comes with Node)
- **Supabase CLI** (optional – the migrations are already applied when the backend starts)
- **Git** (optional, for version control)

### Installation
```bash
# Clone the repo (if you haven’t already)
git clone <repo‑url>
cd apl_finale_project

# Install all workspace dependencies
npm run install:all
```

### Running the stack
```bash
# Terminal 1 – Backend (listens on http://localhost:4000)
npm run dev:backend

# Terminal 2 – Front‑end (Vite dev server on http://localhost:5173)
npm run dev:web
```
The backend will automatically seed Supabase with the stadium layout.  The front‑end connects via Socket.IO and displays the live map, gate statuses, and analytics.

### Development notes
- **Hot‑reload**: `nodemon` watches all TypeScript files in `backend/src`.  Any change triggers a restart.
- **Live‑replay**: The UI contains a “Replay” mode that steps through historic state snapshots – great for demos.
- **Audio**: Interact with the mute button on the top‑right; un‑muting plays a pleasant chime.
- **Evacuation**: Clicking the “Evacuate” button activates the siren and an audio announcement.

---

## Project Structure Highlights
| Folder | Purpose |
|--------|---------|
| `backend/` | Server‑side logic, Supabase integration, socket handling. |
| `apps/web/` | React SPA – the command‑center UI. |
| `supabase/migrations/` | Database schema & seed data (zones, gates, incidents). |
| `packages/` | Placeholder for shared libraries (e.g., utilities, types). |

---

## Contributing
1. **Fork** the repository.
2. Create a **feature branch**:
   ```bash
   git checkout -b feature/<description>
   ```
3. Make your changes, run the dev servers, and test locally.
4. Submit a **Pull Request** – ensure lint passes (`npm run lint`).

## License
This project is licensed under the **MIT License**.

---

### Contact
For questions or demo requests, open an issue or reach out to the repository maintainer.
