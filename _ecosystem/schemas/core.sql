-- AeroEdge Core Schema
-- Shared tables used by all nodes
-- This file is synced to all nodes via push-to-nodes.sh

-- Enable cr-sqlite for CRDT sync
-- (Actual initialization depends on runtime)

------------------------------------------------------------
-- USERS
------------------------------------------------------------

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    display_name TEXT NOT NULL,
    phone TEXT,
    avatar_url TEXT,

    -- Pilot certificates (JSON)
    pilot_certificate TEXT,
    medical_certificate TEXT,
    cfi_certificate TEXT,

    -- Preferences (JSON)
    settings TEXT DEFAULT '{}',

    -- Timestamps
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),

    -- Soft delete
    deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

------------------------------------------------------------
-- CONTEXTS (Organizations/Groups)
------------------------------------------------------------

CREATE TABLE IF NOT EXISTS contexts (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('personal', 'club', 'school', 'fbo')),
    name TEXT NOT NULL,
    description TEXT,

    -- Settings (JSON)
    settings TEXT DEFAULT '{}',

    -- Sync configuration
    sync_method TEXT CHECK (sync_method IN ('local', 'cloud_folder', 'hub', 'managed')),
    sync_config TEXT,

    -- Timestamps
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    created_by TEXT NOT NULL REFERENCES users(id)
);

------------------------------------------------------------
-- CONTEXT MEMBERSHIP
------------------------------------------------------------

CREATE TABLE IF NOT EXISTS context_members (
    id TEXT PRIMARY KEY,
    context_id TEXT NOT NULL REFERENCES contexts(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'instructor', 'member', 'student', 'maintenance')),

    -- Permissions override (JSON, optional)
    permissions TEXT,

    -- Timestamps
    joined_at TEXT NOT NULL DEFAULT (datetime('now')),
    invited_by TEXT REFERENCES users(id),

    UNIQUE(context_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_context_members_context ON context_members(context_id);
CREATE INDEX IF NOT EXISTS idx_context_members_user ON context_members(user_id);

------------------------------------------------------------
-- EVENT BUS (Inter-node communication)
------------------------------------------------------------

CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    payload TEXT NOT NULL,
    source_node TEXT NOT NULL,
    context_id TEXT,

    -- Processing tracking
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    processed_at TEXT,

    -- Idempotency
    idempotency_key TEXT UNIQUE
);

CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_unprocessed ON events(processed_at) WHERE processed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_events_context ON events(context_id);

------------------------------------------------------------
-- IMPORT JOBS (Migration tracking)
------------------------------------------------------------

CREATE TABLE IF NOT EXISTS import_jobs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    context_id TEXT REFERENCES contexts(id),

    source TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'analyzing', 'analyzed', 'needs_review', 'importing', 'validating', 'complete', 'failed')),

    -- Progress tracking (JSON)
    progress TEXT,
    analysis TEXT,
    result TEXT,
    validation TEXT,
    error TEXT,

    -- Timestamps
    started_at TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_import_jobs_user ON import_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_import_jobs_status ON import_jobs(status);

------------------------------------------------------------
-- SYNC METADATA
------------------------------------------------------------

CREATE TABLE IF NOT EXISTS sync_metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Store last sync times, peer info, etc.

------------------------------------------------------------
-- AIRCRAFT (Core aircraft data shared across nodes)
------------------------------------------------------------

CREATE TABLE IF NOT EXISTS aircraft (
    id TEXT PRIMARY KEY,
    context_id TEXT NOT NULL REFERENCES contexts(id),

    -- Identification
    registration TEXT NOT NULL,
    make TEXT NOT NULL,
    model TEXT NOT NULL,
    year INTEGER,
    serial_number TEXT,

    -- Category/Class
    category TEXT NOT NULL, -- airplane, rotorcraft, glider, etc.
    class TEXT NOT NULL,    -- single_engine_land, multi_engine_sea, etc.

    -- Equipment (JSON array)
    equipment TEXT DEFAULT '[]',

    -- Times
    hobbs REAL DEFAULT 0,
    tach REAL DEFAULT 0,
    total_time REAL DEFAULT 0,

    -- Rates (JSON)
    rates TEXT DEFAULT '{}',

    -- Status
    status TEXT DEFAULT 'available' CHECK (status IN ('available', 'maintenance', 'grounded', 'inactive')),

    -- Timestamps
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_aircraft_context ON aircraft(context_id);
CREATE INDEX IF NOT EXISTS idx_aircraft_registration ON aircraft(registration);

------------------------------------------------------------
-- FLIGHTS (Core flight data)
------------------------------------------------------------

CREATE TABLE IF NOT EXISTS flights (
    id TEXT PRIMARY KEY,
    pilot_id TEXT NOT NULL REFERENCES users(id),
    aircraft_id TEXT NOT NULL REFERENCES aircraft(id),
    date TEXT NOT NULL,

    -- Times (decimal hours)
    total_time REAL NOT NULL DEFAULT 0,
    pic REAL DEFAULT 0,
    sic REAL DEFAULT 0,
    dual_received REAL DEFAULT 0,
    dual_given REAL DEFAULT 0,
    solo REAL DEFAULT 0,

    -- Night/Instrument
    night REAL DEFAULT 0,
    instrument_actual REAL DEFAULT 0,
    instrument_simulated REAL DEFAULT 0,

    -- Cross country
    cross_country REAL DEFAULT 0,

    -- Landings
    landings_day INTEGER DEFAULT 0,
    landings_night INTEGER DEFAULT 0,

    -- Route
    route TEXT,

    -- Approaches (JSON array)
    approaches TEXT,
    holds INTEGER DEFAULT 0,

    -- Instructor
    instructor_id TEXT REFERENCES users(id),

    -- Training
    lesson_id TEXT,

    -- Remarks
    remarks TEXT,

    -- Source tracking
    source TEXT DEFAULT 'manual',
    source_ref TEXT,

    -- Context membership (JSON array for multi-context flights)
    context_ids TEXT NOT NULL,

    -- Timestamps
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_flights_pilot ON flights(pilot_id);
CREATE INDEX IF NOT EXISTS idx_flights_aircraft ON flights(aircraft_id);
CREATE INDEX IF NOT EXISTS idx_flights_date ON flights(date);
CREATE INDEX IF NOT EXISTS idx_flights_instructor ON flights(instructor_id);

------------------------------------------------------------
-- BOOKINGS
------------------------------------------------------------

CREATE TABLE IF NOT EXISTS bookings (
    id TEXT PRIMARY KEY,
    context_id TEXT NOT NULL REFERENCES contexts(id),
    aircraft_id TEXT NOT NULL REFERENCES aircraft(id),

    -- Who
    pilot_id TEXT NOT NULL REFERENCES users(id),
    instructor_id TEXT REFERENCES users(id),

    -- When
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,

    -- What
    booking_type TEXT NOT NULL CHECK (booking_type IN ('flight', 'ground', 'maintenance', 'other')),
    lesson_id TEXT,

    -- Status
    status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('pending', 'confirmed', 'checked_out', 'completed', 'cancelled', 'no_show')),

    -- Notes
    notes TEXT,

    -- Dispatch info (JSON)
    dispatch_info TEXT,

    -- Timestamps
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    created_by TEXT NOT NULL REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_bookings_context ON bookings(context_id);
CREATE INDEX IF NOT EXISTS idx_bookings_aircraft ON bookings(aircraft_id);
CREATE INDEX IF NOT EXISTS idx_bookings_pilot ON bookings(pilot_id);
CREATE INDEX IF NOT EXISTS idx_bookings_time ON bookings(start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
