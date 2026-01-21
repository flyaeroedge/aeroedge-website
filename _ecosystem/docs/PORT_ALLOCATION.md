# AeroEdge Ecosystem Port Allocation

This document defines the localhost port assignments for all nodes and apps to prevent conflicts during local development.

## Port Ranges

| Range | Purpose |
|-------|---------|
| 3001-3099 | Node Frontend (React, Next.js, etc.) |
| 5001-5099 | Node Backend API |
| 8000-8099 | Shared Services & Python Apps |

## Node Ports

| Node | Frontend | Backend API | Notes |
|------|----------|-------------|-------|
| aeroedge_logbook | 3001 | 5001 | Flight logging UI + API |
| aeroedge_aircraft | 3002 | 5002 | Aircraft management UI + API |
| aeroedge_scheduler | 3003 | 5003 | Booking/dispatch UI + API |
| aeroedge_syllabus | 3004 | 5004 | Training programs UI + API |
| aeroedge_website | 3005 | 5005 | Marketing site + CMS API |
| aeroedge_command_center | 3006 | 5006 | Admin dashboard + API |

## App Ports

| App | Port | Framework | Notes |
|-----|------|-----------|-------|
| aeroedge_tracking_api | 8000 | FastAPI | Central analytics API |
| aeroedge_overlay_tools | 8050 | Dash | Maneuver visualization |
| aeroedge_em_diagram | 8051 | Dash | E-M diagram tool |
| aeroedge_social_media | N/A | CLI | No web server (automation scripts) |

## Quick Reference

```
# Nodes - Frontend
http://localhost:3001  # Logbook
http://localhost:3002  # Aircraft
http://localhost:3003  # Scheduler
http://localhost:3004  # Syllabus
http://localhost:3005  # Website
http://localhost:3006  # Command Center

# Nodes - Backend API
http://localhost:5001  # Logbook API
http://localhost:5002  # Aircraft API
http://localhost:5003  # Scheduler API
http://localhost:5004  # Syllabus API
http://localhost:5005  # Website API
http://localhost:5006  # Command Center API

# Apps
http://localhost:8000  # Tracking API
http://localhost:8050  # Overlay Tools
http://localhost:8051  # EM Diagram
```

## Environment Variables

Each node/app should use environment variables for port configuration:

```bash
# Node pattern
PORT=3001           # Frontend port
API_PORT=5001       # Backend API port

# App pattern
PORT=8051           # App port
```

## Development Scripts

Add to each node's `package.json`:

```json
{
  "scripts": {
    "dev": "next dev -p $PORT",
    "dev:api": "node server.js"
  }
}
```

Or for Python apps, use the `.env` file:

```bash
# .env
PORT=8051
HOST=0.0.0.0
DEBUG=true
```

## Reserved Ports

These ports are reserved for future use:

| Range | Reserved For |
|-------|--------------|
| 3007-3010 | Future nodes |
| 5007-5010 | Future node APIs |
| 8052-8059 | Future Python apps |
| 9000-9010 | Database/Redis/services |

## Database Ports (Reference)

| Service | Port | Notes |
|---------|------|-------|
| PostgreSQL | 5432 | Default |
| Redis | 6379 | Default |
| SQLite | N/A | File-based |
