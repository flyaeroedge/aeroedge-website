# AeroEdge Ecosystem
## Technical Implementation Guide: Sync & Context System

---

## Overview

This document provides implementation details for the local-first, context-based sync architecture that enables AeroEdge to work across all tiers without requiring traditional server infrastructure for most users.

### Key Design Principle: Resilience Mode

Unlike web-based competitors that fail when servers go down, AeroEdge uses a **multi-layer sync architecture** where every device maintains a complete local database and can sync directly with nearby devices on the same WiFi network.

```
SYNC PRIORITY STACK (all run simultaneously):

┌─────────────────────────────────────────────────────────────────┐
│ PRIORITY 1: LOCAL P2P (Same WiFi)                               │
│ • mDNS auto-discovery of nearby AeroEdge devices                │
│ • Direct device-to-device sync                                  │
│ • <1 second latency                                             │
│ • Works without any internet connection                         │
│ • KEEPS EVERYONE ON-SITE IN SYNC EVEN IF SERVER IS DOWN        │
├─────────────────────────────────────────────────────────────────┤
│ PRIORITY 2: Hub Device (if configured)                          │
│ • Always-on device at club/school                               │
│ • Local network or internet access                              │
│ • 1-5 second latency                                            │
├─────────────────────────────────────────────────────────────────┤
│ PRIORITY 3: Managed Server (if subscribed)                      │
│ • Cloud-hosted sync endpoint                                    │
│ • Required for remote user access                               │
│ • 1-3 second latency                                            │
├─────────────────────────────────────────────────────────────────┤
│ PRIORITY 4: Cloud Folder (fallback)                             │
│ • iCloud/Google Drive/Dropbox                                   │
│ • 30-60 second latency                                          │
│ • Works when nothing else does                                  │
└─────────────────────────────────────────────────────────────────┘
```

**The critical insight:** If you're physically at the flight school, you sync with nearby devices via P2P instantly. Server going down doesn't stop operations - everyone on the same WiFi keeps working together. When the server returns, accumulated changes merge automatically via CRDT.

---

## Table of Contents

1. [Core Technologies](#1-core-technologies)
2. [Local Database Schema](#2-local-database-schema)
3. [CRDT Implementation](#3-crdt-implementation)
4. [Context Management](#4-context-management)
5. [Sync Protocols](#5-sync-protocols)
6. [Resilience Mode & Local P2P](#6-resilience-mode--local-p2p)
7. [Conflict Resolution](#7-conflict-resolution)
8. [Encryption & Security](#8-encryption--security)
9. [Platform-Specific Implementation](#9-platform-specific-implementation)
10. [Hub Server Implementation](#10-hub-server-implementation)

---

## 1. Core Technologies

### Technology Stack

```yaml
Database:
  Primary: SQLite 3.40+
  CRDT Extension: cr-sqlite (vlcn.io)
  Mobile: SQLite via platform native bridges
  Web: sql.js (WASM) + IndexedDB persistence

Application:
  Cross-platform: React Native (mobile) + Electron (desktop)
  Web: React + PWA
  Language: TypeScript
  State Management: Zustand

Networking:
  P2P Discovery: mDNS (Bonjour/Avahi)
  P2P Transport: WebSocket direct or libp2p
  Cloud Sync: Native cloud provider SDKs
  Remote Relay: WebRTC with TURN fallback

Encryption:
  Symmetric: AES-256-GCM (data at rest and in transit)
  Key Derivation: Argon2id (from shared secrets)
  Key Exchange: X25519 (for P2P)
  Signing: Ed25519 (for change verification)

Serialization:
  Sync Data: MessagePack (compact binary)
  Config: JSON
  Export: SQLite file + JSON manifest
```

### Why cr-sqlite?

cr-sqlite adds CRDT properties directly to SQLite tables with minimal code changes:

```sql
-- Standard SQLite table
CREATE TABLE flights (
    id TEXT PRIMARY KEY,
    pilot_id TEXT NOT NULL,
    aircraft_id TEXT NOT NULL,
    date TEXT NOT NULL,
    duration_hours REAL NOT NULL
);

-- One line to enable CRDT tracking
SELECT crsql_as_crr('flights');

-- Table now automatically:
-- • Tracks all changes with vector clocks
-- • Supports merge from any other copy
-- • Resolves conflicts deterministically
-- • Works with standard SQL (SELECT, INSERT, UPDATE, DELETE)
```

---

## 2. Local Database Schema

### Context Management Tables

```sql
-- ============================================================
-- CONTEXT & IDENTITY
-- ============================================================

-- Local device identity
CREATE TABLE local_device (
    id TEXT PRIMARY KEY DEFAULT 'self',
    device_id TEXT NOT NULL,           -- UUID, generated on first run
    device_name TEXT,                   -- User-friendly name
    created_at TEXT NOT NULL,
    last_sync_at TEXT
);

-- User's own identity
CREATE TABLE local_user (
    id TEXT PRIMARY KEY DEFAULT 'self',
    user_id TEXT NOT NULL,              -- UUID, stable across devices
    display_name TEXT,
    email TEXT,
    created_at TEXT NOT NULL
);

-- Contexts this device participates in
CREATE TABLE contexts (
    id TEXT PRIMARY KEY,                -- UUID
    name TEXT NOT NULL,
    type TEXT NOT NULL,                 -- personal, partnership, club, school
    tier TEXT NOT NULL,                 -- solo, small_group, organization
    created_at TEXT NOT NULL,
    created_by TEXT NOT NULL,
    
    -- Encryption
    key_salt TEXT NOT NULL,             -- For key derivation
    key_verification TEXT NOT NULL,     -- To verify correct key entered
    
    -- Sync configuration (JSON)
    sync_method TEXT,                   -- local, cloud_folder, p2p, hub, managed
    sync_config TEXT,                   -- Method-specific settings
    
    -- State
    is_active INTEGER DEFAULT 1,
    last_sync_at TEXT,
    sync_status TEXT DEFAULT 'idle'     -- idle, syncing, error
);

-- Members of each context (synced within context)
CREATE TABLE context_members (
    id TEXT PRIMARY KEY,
    context_id TEXT NOT NULL REFERENCES contexts(id),
    user_id TEXT NOT NULL,
    display_name TEXT NOT NULL,
    email TEXT,
    role TEXT NOT NULL,                 -- owner, admin, manager, member, readonly
    permissions TEXT,                   -- JSON array of specific permissions
    joined_at TEXT NOT NULL,
    invited_by TEXT,
    status TEXT DEFAULT 'active'        -- active, suspended, removed
);
SELECT crsql_as_crr('context_members');

-- ============================================================
-- LOGBOOK TABLES
-- ============================================================

-- Aircraft (can be personal or shared in context)
CREATE TABLE aircraft (
    id TEXT PRIMARY KEY,
    context_id TEXT NOT NULL REFERENCES contexts(id),
    
    tail_number TEXT NOT NULL,
    type TEXT NOT NULL,                 -- C172, PA-28, etc.
    model TEXT,                         -- C172S, PA-28-181, etc.
    category_class TEXT NOT NULL,       -- ASEL, AMEL, ASES, etc.
    
    -- Capabilities (JSON)
    capabilities TEXT,                  -- {ifr: true, night: true, taa: true, ...}
    limitations TEXT,                   -- {max_crosswind: 15, ...}
    
    -- For owned/managed aircraft
    year INTEGER,
    serial_number TEXT,
    registration_expires TEXT,
    
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    is_active INTEGER DEFAULT 1
);
SELECT crsql_as_crr('aircraft');

-- Flights / Logbook entries
CREATE TABLE flights (
    id TEXT PRIMARY KEY,
    context_id TEXT NOT NULL REFERENCES contexts(id),
    pilot_id TEXT NOT NULL,
    
    -- Flight details
    date TEXT NOT NULL,                 -- YYYY-MM-DD
    aircraft_id TEXT REFERENCES aircraft(id),
    aircraft_tail TEXT,                 -- Denormalized for display
    aircraft_type TEXT,                 -- Denormalized
    
    -- Route
    departure TEXT,                     -- ICAO
    destination TEXT,                   -- ICAO
    route TEXT,                         -- Intermediate points
    
    -- Times
    duration_total REAL NOT NULL,
    duration_pic REAL DEFAULT 0,
    duration_sic REAL DEFAULT 0,
    duration_dual_received REAL DEFAULT 0,
    duration_dual_given REAL DEFAULT 0,
    duration_solo REAL DEFAULT 0,
    duration_xc REAL DEFAULT 0,
    duration_night REAL DEFAULT 0,
    duration_actual_instrument REAL DEFAULT 0,
    duration_simulated_instrument REAL DEFAULT 0,
    duration_simulator REAL DEFAULT 0,
    
    -- Landings
    landings_day INTEGER DEFAULT 0,
    landings_night INTEGER DEFAULT 0,
    landings_full_stop INTEGER DEFAULT 0,
    
    -- Approaches (JSON array)
    approaches TEXT,                    -- [{type: "ILS", airport: "KORD", count: 2}, ...]
    
    -- Holds
    holds INTEGER DEFAULT 0,
    
    -- People
    instructor_id TEXT,
    instructor_name TEXT,
    passengers TEXT,                    -- JSON array
    
    -- Notes
    remarks TEXT,
    
    -- Metadata
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    
    -- For billing context (if flight is in multiple contexts)
    billing_context_id TEXT,
    billing_status TEXT                 -- pending, invoiced, paid
);
SELECT crsql_as_crr('flights');

-- Flight-context mapping (flight can belong to multiple contexts)
CREATE TABLE flight_contexts (
    flight_id TEXT NOT NULL REFERENCES flights(id),
    context_id TEXT NOT NULL REFERENCES contexts(id),
    added_at TEXT NOT NULL,
    added_by TEXT,
    PRIMARY KEY (flight_id, context_id)
);
SELECT crsql_as_crr('flight_contexts');

-- ============================================================
-- CURRENCY & ENDORSEMENTS
-- ============================================================

CREATE TABLE pilot_currency (
    id TEXT PRIMARY KEY,
    context_id TEXT NOT NULL REFERENCES contexts(id),
    pilot_id TEXT NOT NULL,
    
    currency_type TEXT NOT NULL,        -- flight_review, medical, night, ifr, etc.
    status TEXT NOT NULL,               -- current, expiring, expired
    
    -- Dates
    effective_date TEXT,
    expiration_date TEXT,
    
    -- For calculated currencies
    qualifying_events TEXT,             -- JSON: flights/landings that count
    events_required INTEGER,
    events_completed INTEGER,
    
    -- Medical specific
    medical_class TEXT,                 -- first, second, third, basicmed
    
    updated_at TEXT NOT NULL
);
SELECT crsql_as_crr('pilot_currency');

CREATE TABLE endorsements (
    id TEXT PRIMARY KEY,
    context_id TEXT NOT NULL REFERENCES contexts(id),
    pilot_id TEXT NOT NULL,
    
    endorsement_type TEXT NOT NULL,     -- solo, solo_xc, checkride, etc.
    endorsement_text TEXT,
    
    given_by TEXT NOT NULL,             -- CFI user_id
    given_by_name TEXT,
    cfi_certificate TEXT,
    cfi_expiration TEXT,
    
    effective_date TEXT NOT NULL,
    expiration_date TEXT,               -- NULL = no expiration
    
    -- For aircraft-specific
    aircraft_type TEXT,
    aircraft_tail TEXT,
    
    created_at TEXT NOT NULL
);
SELECT crsql_as_crr('endorsements');

-- ============================================================
-- AIRCRAFT MAINTENANCE (AMS)
-- ============================================================

CREATE TABLE aircraft_times (
    id TEXT PRIMARY KEY,
    context_id TEXT NOT NULL REFERENCES contexts(id),
    aircraft_id TEXT NOT NULL REFERENCES aircraft(id),
    
    recorded_at TEXT NOT NULL,
    recorded_by TEXT,
    
    -- Times
    ttsn REAL,                          -- Total time since new
    tach REAL,
    hobbs REAL,
    
    -- Engine(s)
    engine1_ttsn REAL,
    engine1_tsmoh REAL,                 -- Time since major overhaul
    engine2_ttsn REAL,
    engine2_tsmoh REAL,
    
    -- Prop(s)
    prop1_ttsn REAL,
    prop2_ttsn REAL,
    
    -- Cycles
    cycles INTEGER,
    
    source TEXT                         -- manual, flight_log, import
);
SELECT crsql_as_crr('aircraft_times');

CREATE TABLE inspections (
    id TEXT PRIMARY KEY,
    context_id TEXT NOT NULL REFERENCES contexts(id),
    aircraft_id TEXT NOT NULL REFERENCES aircraft(id),
    
    inspection_type TEXT NOT NULL,      -- annual, 100_hour, progressive, etc.
    
    -- Due tracking
    due_type TEXT NOT NULL,             -- calendar, hours, both
    due_date TEXT,
    due_hours REAL,
    
    -- Completion
    completed_date TEXT,
    completed_hours REAL,
    completed_by TEXT,                  -- Mechanic/IA
    
    -- Next due (calculated or set)
    next_due_date TEXT,
    next_due_hours REAL,
    
    notes TEXT,
    documents TEXT,                     -- JSON: [{name, file_id}, ...]
    
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
SELECT crsql_as_crr('inspections');

CREATE TABLE squawks (
    id TEXT PRIMARY KEY,
    context_id TEXT NOT NULL REFERENCES contexts(id),
    aircraft_id TEXT NOT NULL REFERENCES aircraft(id),
    
    description TEXT NOT NULL,
    reported_by TEXT NOT NULL,
    reported_at TEXT NOT NULL,
    
    severity TEXT NOT NULL,             -- grounding, major, minor, cosmetic
    category TEXT,                      -- engine, avionics, airframe, etc.
    
    -- MEL info
    mel_reference TEXT,
    dispatch_restriction TEXT,          -- day_vfr, no_night, no_ifr, etc.
    deferral_date TEXT,
    deferral_expiration TEXT,
    
    -- Resolution
    status TEXT DEFAULT 'open',         -- open, deferred, in_progress, resolved
    resolved_at TEXT,
    resolved_by TEXT,
    resolution_notes TEXT,
    work_order_id TEXT,
    
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
SELECT crsql_as_crr('squawks');

-- ============================================================
-- SCHEDULING
-- ============================================================

CREATE TABLE bookings (
    id TEXT PRIMARY KEY,
    context_id TEXT NOT NULL REFERENCES contexts(id),
    
    -- Resources
    aircraft_id TEXT REFERENCES aircraft(id),
    pilot_id TEXT NOT NULL,
    instructor_id TEXT,
    
    -- Timing
    start_time TEXT NOT NULL,           -- ISO 8601
    end_time TEXT NOT NULL,
    duration_hours REAL NOT NULL,
    
    -- Type
    booking_type TEXT NOT NULL,         -- solo, dual, checkride, maintenance, other
    
    -- For training
    lesson_id TEXT,
    syllabus_id TEXT,
    
    -- Status
    status TEXT DEFAULT 'confirmed',    -- confirmed, pending, cancelled, completed
    weather_status TEXT,                -- green, yellow, orange, red
    
    -- Completion
    actual_start TEXT,
    actual_end TEXT,
    hobbs_start REAL,
    hobbs_end REAL,
    
    -- Linked records
    flight_id TEXT REFERENCES flights(id),
    billing_event_id TEXT,
    
    -- Metadata
    notes TEXT,
    created_at TEXT NOT NULL,
    created_by TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    cancelled_at TEXT,
    cancelled_by TEXT,
    cancellation_reason TEXT
);
SELECT crsql_as_crr('bookings');

-- Recurring schedule templates
CREATE TABLE schedule_templates (
    id TEXT PRIMARY KEY,
    context_id TEXT NOT NULL REFERENCES contexts(id),
    pilot_id TEXT NOT NULL,
    
    -- Recurrence
    day_of_week INTEGER NOT NULL,       -- 0=Sunday, 6=Saturday
    start_time TEXT NOT NULL,           -- HH:MM
    duration_hours REAL NOT NULL,
    
    -- Defaults
    default_aircraft_id TEXT,
    default_instructor_id TEXT,
    booking_type TEXT DEFAULT 'dual',
    
    -- Validity
    effective_from TEXT NOT NULL,
    effective_until TEXT,
    
    is_active INTEGER DEFAULT 1,
    created_at TEXT NOT NULL
);
SELECT crsql_as_crr('schedule_templates');

-- CFI availability
CREATE TABLE cfi_availability (
    id TEXT PRIMARY KEY,
    context_id TEXT NOT NULL REFERENCES contexts(id),
    cfi_id TEXT NOT NULL,
    
    -- Recurring or specific
    is_recurring INTEGER DEFAULT 1,
    day_of_week INTEGER,                -- For recurring
    specific_date TEXT,                 -- For one-time
    
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    
    status TEXT NOT NULL,               -- available, standby, unavailable
    
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
SELECT crsql_as_crr('cfi_availability');

-- ============================================================
-- SYLLABUS & TRAINING
-- ============================================================

CREATE TABLE syllabi (
    id TEXT PRIMARY KEY,
    context_id TEXT NOT NULL REFERENCES contexts(id),
    
    name TEXT NOT NULL,
    version TEXT NOT NULL,
    certificate_type TEXT,              -- private, instrument, commercial, etc.
    
    -- Full structure as JSON
    structure TEXT NOT NULL,            -- {stages: [{lessons: [...]}]}
    
    -- Metadata
    regulatory_basis TEXT,              -- part_61, part_141
    created_by TEXT,
    is_template INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
SELECT crsql_as_crr('syllabi');

CREATE TABLE student_enrollments (
    id TEXT PRIMARY KEY,
    context_id TEXT NOT NULL REFERENCES contexts(id),
    
    student_id TEXT NOT NULL,
    syllabus_id TEXT NOT NULL REFERENCES syllabi(id),
    
    assigned_cfi_id TEXT,
    backup_cfi_id TEXT,
    
    start_date TEXT NOT NULL,
    target_completion_date TEXT,
    
    -- Progress
    current_stage TEXT,
    current_lesson TEXT,
    progress_data TEXT,                 -- JSON: {lessons: {id: status, ...}}
    
    status TEXT DEFAULT 'active',       -- active, paused, completed, withdrawn
    completed_at TEXT,
    
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
SELECT crsql_as_crr('student_enrollments');

-- ============================================================
-- BILLING
-- ============================================================

CREATE TABLE billing_events (
    id TEXT PRIMARY KEY,
    context_id TEXT NOT NULL REFERENCES contexts(id),
    
    -- Source
    booking_id TEXT REFERENCES bookings(id),
    flight_id TEXT REFERENCES flights(id),
    
    -- Who owes
    billed_to TEXT NOT NULL,            -- user_id
    
    -- Line items (JSON array)
    line_items TEXT NOT NULL,           -- [{type, description, qty, rate, total}, ...]
    
    subtotal REAL NOT NULL,
    tax REAL DEFAULT 0,
    total REAL NOT NULL,
    
    -- Status
    status TEXT DEFAULT 'pending',      -- pending, invoiced, paid, void
    invoice_id TEXT,
    paid_at TEXT,
    payment_method TEXT,
    
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
SELECT crsql_as_crr('billing_events');

-- ============================================================
-- SYNC METADATA (Local only, not synced)
-- ============================================================

CREATE TABLE sync_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    context_id TEXT NOT NULL,
    sync_type TEXT NOT NULL,            -- push, pull, full
    sync_method TEXT NOT NULL,          -- cloud_folder, p2p, hub
    peer_device_id TEXT,
    started_at TEXT NOT NULL,
    completed_at TEXT,
    status TEXT NOT NULL,               -- in_progress, success, failed
    changes_sent INTEGER DEFAULT 0,
    changes_received INTEGER DEFAULT 0,
    error_message TEXT
);

CREATE TABLE pending_sync (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    context_id TEXT NOT NULL,
    table_name TEXT NOT NULL,
    row_id TEXT NOT NULL,
    operation TEXT NOT NULL,            -- insert, update, delete
    created_at TEXT NOT NULL,
    synced_at TEXT
);
```

---

## 3. CRDT Implementation

### How cr-sqlite Works

cr-sqlite uses **Causal Length** (also called Lamport timestamps) to track changes:

```sql
-- After enabling CRDT on a table, cr-sqlite creates hidden tracking columns
-- and a changes table that records all operations

-- View pending changes for a table
SELECT * FROM crsql_changes WHERE table_name = 'flights';

-- Returns:
-- table_name | row_id | column | value | version | site_id
-- flights    | f-123  | duration_total | 1.5 | 5 | device-abc
-- flights    | f-123  | remarks | "Good flight" | 6 | device-abc
```

### Sync Implementation

```typescript
// sync-engine.ts

import { Database } from 'better-sqlite3';

interface SyncState {
  contextId: string;
  lastSyncVersion: number;
  peerDeviceId: string;
}

export class CRDTSyncEngine {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  /**
   * Get all changes since a given version for a context
   */
  getChangesSince(contextId: string, sinceVersion: number): ChangeSet {
    // Get changes from cr-sqlite
    const changes = this.db.prepare(`
      SELECT 
        c.table_name,
        c.pk,
        c.cid,
        c.val,
        c.col_version,
        c.db_version,
        c.site_id
      FROM crsql_changes c
      JOIN context_aware_tables cat ON c.table_name = cat.table_name
      WHERE c.db_version > ?
        AND (
          -- Filter to only rows belonging to this context
          c.table_name NOT IN ('flights', 'aircraft', 'bookings') 
          OR EXISTS (
            SELECT 1 FROM flight_contexts fc 
            WHERE fc.flight_id = c.pk AND fc.context_id = ?
          )
        )
      ORDER BY c.db_version ASC
    `).all(sinceVersion, contextId);

    return {
      contextId,
      fromVersion: sinceVersion,
      toVersion: this.getCurrentVersion(),
      changes: changes,
      deviceId: this.getDeviceId()
    };
  }

  /**
   * Apply changes from another device
   */
  applyChanges(changeSet: ChangeSet): ApplyResult {
    const applied = [];
    const conflicts = [];

    this.db.exec('BEGIN TRANSACTION');

    try {
      for (const change of changeSet.changes) {
        // cr-sqlite handles merge automatically
        this.db.prepare(`
          INSERT INTO crsql_changes (table_name, pk, cid, val, col_version, db_version, site_id)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          change.table_name,
          change.pk,
          change.cid,
          change.val,
          change.col_version,
          change.db_version,
          change.site_id
        );
        applied.push(change);
      }

      this.db.exec('COMMIT');

      return { success: true, applied: applied.length, conflicts: [] };

    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  /**
   * Get current database version
   */
  getCurrentVersion(): number {
    const result = this.db.prepare('SELECT crsql_db_version()').get();
    return result['crsql_db_version()'];
  }

  /**
   * Get this device's unique ID
   */
  getDeviceId(): string {
    const result = this.db.prepare('SELECT crsql_site_id()').get();
    return result['crsql_site_id()'];
  }
}
```

### Change Serialization

```typescript
// change-serialization.ts

import * as msgpack from '@msgpack/msgpack';
import { encrypt, decrypt } from './encryption';

interface ChangeSet {
  contextId: string;
  fromVersion: number;
  toVersion: number;
  changes: Change[];
  deviceId: string;
  timestamp: number;
}

/**
 * Serialize changes for transmission
 */
export function serializeChanges(
  changeSet: ChangeSet, 
  encryptionKey: Uint8Array
): Uint8Array {
  // Pack with MessagePack (compact binary)
  const packed = msgpack.encode(changeSet);
  
  // Encrypt
  const encrypted = encrypt(packed, encryptionKey);
  
  return encrypted;
}

/**
 * Deserialize received changes
 */
export function deserializeChanges(
  data: Uint8Array, 
  encryptionKey: Uint8Array
): ChangeSet {
  // Decrypt
  const decrypted = decrypt(data, encryptionKey);
  
  // Unpack
  const changeSet = msgpack.decode(decrypted) as ChangeSet;
  
  return changeSet;
}
```

---

## 4. Context Management

### Creating a Context

```typescript
// context-manager.ts

import { v4 as uuidv4 } from 'uuid';
import { deriveKey, generateSalt, hashForVerification } from './encryption';

export class ContextManager {
  private db: Database;

  /**
   * Create a new context (user is automatically owner)
   */
  async createContext(params: {
    name: string;
    type: 'personal' | 'partnership' | 'club' | 'school';
    sharedSecret?: string;  // For group contexts
  }): Promise<Context> {
    const contextId = uuidv4();
    const userId = this.getCurrentUserId();
    
    // Generate encryption key
    const salt = generateSalt();
    let encryptionKey: Uint8Array;
    
    if (params.type === 'personal') {
      // Personal context: key from device secret
      encryptionKey = await deriveKey(this.getDeviceSecret(), salt);
    } else {
      // Group context: key from shared secret
      if (!params.sharedSecret) {
        throw new Error('Shared secret required for group contexts');
      }
      encryptionKey = await deriveKey(params.sharedSecret, salt);
    }
    
    // Create verification hash (to verify correct secret later)
    const verification = hashForVerification(encryptionKey);
    
    // Insert context
    this.db.prepare(`
      INSERT INTO contexts (id, name, type, tier, created_at, created_by, 
                           key_salt, key_verification, sync_method)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      contextId,
      params.name,
      params.type,
      this.determineTier(params.type),
      new Date().toISOString(),
      userId,
      salt,
      verification,
      params.type === 'personal' ? 'local' : 'pending'
    );
    
    // Add creator as owner
    this.db.prepare(`
      INSERT INTO context_members (id, context_id, user_id, display_name, role, joined_at)
      VALUES (?, ?, ?, ?, 'owner', ?)
    `).run(
      uuidv4(),
      contextId,
      userId,
      this.getCurrentUserName(),
      new Date().toISOString()
    );
    
    // Store encryption key in secure storage
    await this.storeContextKey(contextId, encryptionKey);
    
    return this.getContext(contextId);
  }

  /**
   * Join an existing context via invite
   */
  async joinContext(params: {
    contextId: string;
    sharedSecret: string;
    inviteCode?: string;
  }): Promise<Context> {
    // Fetch context metadata (from invite or sync)
    const contextMeta = await this.fetchContextMetadata(params.contextId, params.inviteCode);
    
    // Derive key and verify
    const encryptionKey = await deriveKey(params.sharedSecret, contextMeta.keySalt);
    const verification = hashForVerification(encryptionKey);
    
    if (verification !== contextMeta.keyVerification) {
      throw new Error('Invalid shared secret');
    }
    
    // Store context locally
    this.db.prepare(`
      INSERT INTO contexts (id, name, type, tier, created_at, created_by,
                           key_salt, key_verification, sync_method, sync_config)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      contextMeta.id,
      contextMeta.name,
      contextMeta.type,
      contextMeta.tier,
      contextMeta.createdAt,
      contextMeta.createdBy,
      contextMeta.keySalt,
      contextMeta.keyVerification,
      contextMeta.syncMethod,
      JSON.stringify(contextMeta.syncConfig)
    );
    
    // Store encryption key
    await this.storeContextKey(params.contextId, encryptionKey);
    
    // Initial sync to get data
    await this.syncEngine.performFullSync(params.contextId);
    
    return this.getContext(params.contextId);
  }

  /**
   * Generate invite link/QR for a context
   */
  generateInvite(contextId: string): Invite {
    const context = this.getContext(contextId);
    
    // Create invite record
    const inviteCode = this.generateInviteCode();
    
    // Invite contains:
    // - Context ID
    // - Context name (for display)
    // - Invite code (for validation)
    // - Sync endpoint hint
    // Does NOT contain shared secret (must be communicated separately)
    
    return {
      contextId: context.id,
      contextName: context.name,
      inviteCode: inviteCode,
      syncHint: context.syncConfig,
      // Generate QR code data
      qrData: `aeroedge://join?ctx=${context.id}&code=${inviteCode}`,
      // Generate shareable link
      link: `https://aeroedge.app/join/${context.id}?code=${inviteCode}`
    };
  }
}
```

### Context-Aware Queries

```typescript
// context-queries.ts

export class ContextAwareRepository {
  private db: Database;
  private activeContexts: string[];

  /**
   * Get flights visible to current user across all their contexts
   */
  getFlights(filters?: FlightFilters): Flight[] {
    const contextPlaceholders = this.activeContexts.map(() => '?').join(',');
    
    let sql = `
      SELECT DISTINCT f.* 
      FROM flights f
      JOIN flight_contexts fc ON f.id = fc.flight_id
      WHERE fc.context_id IN (${contextPlaceholders})
    `;
    
    const params = [...this.activeContexts];
    
    if (filters?.startDate) {
      sql += ' AND f.date >= ?';
      params.push(filters.startDate);
    }
    
    if (filters?.endDate) {
      sql += ' AND f.date <= ?';
      params.push(filters.endDate);
    }
    
    if (filters?.pilotId) {
      sql += ' AND f.pilot_id = ?';
      params.push(filters.pilotId);
    }
    
    sql += ' ORDER BY f.date DESC, f.created_at DESC';
    
    return this.db.prepare(sql).all(...params);
  }

  /**
   * Create a flight in specific context(s)
   */
  createFlight(flight: NewFlight, contextIds: string[]): Flight {
    const flightId = uuidv4();
    
    this.db.exec('BEGIN TRANSACTION');
    
    try {
      // Insert flight with primary context
      this.db.prepare(`
        INSERT INTO flights (
          id, context_id, pilot_id, date, aircraft_id, aircraft_tail, aircraft_type,
          departure, destination, duration_total, duration_pic, duration_dual_received,
          landings_day, landings_night, remarks, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        flightId,
        contextIds[0],  // Primary context
        flight.pilotId,
        flight.date,
        flight.aircraftId,
        flight.aircraftTail,
        flight.aircraftType,
        flight.departure,
        flight.destination,
        flight.durationTotal,
        flight.durationPic || 0,
        flight.durationDualReceived || 0,
        flight.landingsDay || 0,
        flight.landingsNight || 0,
        flight.remarks,
        new Date().toISOString(),
        new Date().toISOString()
      );
      
      // Link to all specified contexts
      for (const contextId of contextIds) {
        this.db.prepare(`
          INSERT INTO flight_contexts (flight_id, context_id, added_at)
          VALUES (?, ?, ?)
        `).run(flightId, contextId, new Date().toISOString());
      }
      
      this.db.exec('COMMIT');
      
      return this.getFlightById(flightId);
      
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
}
```

---

## 5. Sync Protocols

### Cloud Folder Sync

```typescript
// sync-cloud-folder.ts

import { CloudStorage } from './cloud-providers';

export class CloudFolderSync {
  private storage: CloudStorage;
  private syncEngine: CRDTSyncEngine;

  /**
   * Sync context via shared cloud folder
   */
  async sync(contextId: string): Promise<SyncResult> {
    const context = await this.getContext(contextId);
    const config = JSON.parse(context.syncConfig);
    
    // 1. Check for remote changes
    const remoteManifest = await this.storage.readFile(
      `${config.folderPath}/manifest.json`
    );
    
    // 2. Download and apply any new change files
    const localVersion = this.syncEngine.getLastSyncVersion(contextId);
    const newChangeFiles = remoteManifest.changeFiles
      .filter(f => f.version > localVersion)
      .sort((a, b) => a.version - b.version);
    
    for (const changeFile of newChangeFiles) {
      const data = await this.storage.readFile(
        `${config.folderPath}/changes/${changeFile.name}`
      );
      const changes = deserializeChanges(data, context.encryptionKey);
      await this.syncEngine.applyChanges(changes);
    }
    
    // 3. Upload our changes
    const ourChanges = this.syncEngine.getChangesSince(contextId, localVersion);
    
    if (ourChanges.changes.length > 0) {
      const serialized = serializeChanges(ourChanges, context.encryptionKey);
      const fileName = `${Date.now()}-${this.getDeviceId()}.changes`;
      
      await this.storage.writeFile(
        `${config.folderPath}/changes/${fileName}`,
        serialized
      );
      
      // Update manifest
      await this.updateManifest(config.folderPath, {
        version: ourChanges.toVersion,
        name: fileName
      });
    }
    
    // 4. Update local sync state
    this.updateSyncState(contextId, ourChanges.toVersion);
    
    return {
      success: true,
      changesReceived: newChangeFiles.length,
      changesSent: ourChanges.changes.length
    };
  }
}
```

### P2P Sync (Local Network)

```typescript
// sync-p2p.ts

import { Bonjour } from 'bonjour-service';
import WebSocket from 'ws';

export class P2PSync {
  private bonjour: Bonjour;
  private server: WebSocket.Server;
  private peers: Map<string, WebSocket>;
  private syncEngine: CRDTSyncEngine;

  /**
   * Start advertising this device on local network
   */
  startAdvertising(contextId: string): void {
    this.bonjour.publish({
      name: `AeroEdge-${this.getDeviceId().slice(0, 8)}`,
      type: 'aeroedge-sync',
      port: 8765,
      txt: {
        contextId: contextId,
        version: String(this.syncEngine.getCurrentVersion())
      }
    });
  }

  /**
   * Discover peers on local network
   */
  discoverPeers(contextId: string): void {
    this.bonjour.find({ type: 'aeroedge-sync' }, (service) => {
      if (service.txt.contextId === contextId) {
        this.connectToPeer(service.addresses[0], service.port, contextId);
      }
    });
  }

  /**
   * Connect to discovered peer and sync
   */
  private async connectToPeer(
    host: string, 
    port: number, 
    contextId: string
  ): Promise<void> {
    const ws = new WebSocket(`ws://${host}:${port}`);
    
    ws.on('open', () => {
      // Send handshake with our version
      ws.send(JSON.stringify({
        type: 'handshake',
        deviceId: this.getDeviceId(),
        contextId: contextId,
        version: this.syncEngine.getCurrentVersion()
      }));
    });
    
    ws.on('message', async (data) => {
      const message = JSON.parse(data.toString());
      
      switch (message.type) {
        case 'handshake':
          await this.handleHandshake(ws, message);
          break;
          
        case 'request_changes':
          await this.handleChangesRequest(ws, message);
          break;
          
        case 'changes':
          await this.handleChanges(ws, message);
          break;
      }
    });
  }

  /**
   * Handle incoming handshake - determine who needs what
   */
  private async handleHandshake(ws: WebSocket, message: any): Promise<void> {
    const theirVersion = message.version;
    const ourVersion = this.syncEngine.getCurrentVersion();
    
    if (theirVersion > ourVersion) {
      // They have changes we need
      ws.send(JSON.stringify({
        type: 'request_changes',
        sinceVersion: ourVersion
      }));
    }
    
    if (ourVersion > theirVersion) {
      // We have changes they need - send them
      const changes = this.syncEngine.getChangesSince(message.contextId, theirVersion);
      const encrypted = serializeChanges(changes, this.getContextKey(message.contextId));
      
      ws.send(JSON.stringify({
        type: 'changes',
        data: Buffer.from(encrypted).toString('base64')
      }));
    }
  }

  /**
   * Handle incoming changes
   */
  private async handleChanges(ws: WebSocket, message: any): Promise<void> {
    const encrypted = Buffer.from(message.data, 'base64');
    const changes = deserializeChanges(encrypted, this.getContextKey(message.contextId));
    
    await this.syncEngine.applyChanges(changes);
    
    // Acknowledge
    ws.send(JSON.stringify({
      type: 'ack',
      version: this.syncEngine.getCurrentVersion()
    }));
  }
}
```

### Hub Sync (WebSocket)

```typescript
// sync-hub.ts

export class HubSync {
  private ws: WebSocket;
  private syncEngine: CRDTSyncEngine;
  private reconnectAttempts: number = 0;

  /**
   * Connect to hub server
   */
  async connect(contextId: string): Promise<void> {
    const context = await this.getContext(contextId);
    const config = JSON.parse(context.syncConfig);
    
    this.ws = new WebSocket(config.hubUrl);
    
    this.ws.on('open', () => {
      this.reconnectAttempts = 0;
      
      // Authenticate
      this.ws.send(JSON.stringify({
        type: 'auth',
        contextId: contextId,
        deviceId: this.getDeviceId(),
        token: this.getAuthToken(contextId)
      }));
    });
    
    this.ws.on('message', async (data) => {
      const message = JSON.parse(data.toString());
      await this.handleMessage(message, contextId);
    });
    
    this.ws.on('close', () => {
      this.scheduleReconnect(contextId);
    });
  }

  /**
   * Handle messages from hub
   */
  private async handleMessage(message: any, contextId: string): Promise<void> {
    switch (message.type) {
      case 'auth_success':
        // Request changes since last sync
        const lastVersion = this.getLastSyncVersion(contextId);
        this.ws.send(JSON.stringify({
          type: 'sync_request',
          sinceVersion: lastVersion
        }));
        break;
        
      case 'changes':
        // Apply changes from hub
        const encrypted = Buffer.from(message.data, 'base64');
        const changes = deserializeChanges(encrypted, this.getContextKey(contextId));
        await this.syncEngine.applyChanges(changes);
        
        // Send our changes
        await this.pushChanges(contextId);
        break;
        
      case 'change_notification':
        // Real-time notification of new changes
        this.ws.send(JSON.stringify({
          type: 'sync_request',
          sinceVersion: this.syncEngine.getCurrentVersion()
        }));
        break;
    }
  }

  /**
   * Push local changes to hub
   */
  private async pushChanges(contextId: string): Promise<void> {
    const changes = this.syncEngine.getChangesSince(
      contextId, 
      this.getLastPushVersion(contextId)
    );
    
    if (changes.changes.length > 0) {
      const encrypted = serializeChanges(changes, this.getContextKey(contextId));
      
      this.ws.send(JSON.stringify({
        type: 'push_changes',
        data: Buffer.from(encrypted).toString('base64')
      }));
    }
  }
}
```

---

## 6. Resilience Mode & Local P2P

This is the key differentiator: **when the server goes down, everyone on-site keeps working together.**

### Architecture Overview

```
NORMAL OPERATION:
                         ☁️ Managed Server
                              │
            ┌─────────────────┼─────────────────┐
            │                 │                 │
            ▼                 ▼                 ▼
        📱 Device A      📱 Device B      📱 Device C
            │                 │                 │
            └────────[Local P2P Sync]───────────┘
                    (always running)

SERVER DOWN:
                         ☁️ Managed Server
                              ✗ (offline)
            
        📱 Device A      📱 Device B      📱 Device C
            │                 │                 │
            └────────[Local P2P Sync]───────────┘
                    (still working!)
                    
All devices on same WiFi continue syncing with each other.
Operations continue normally. Users see "Local sync only" badge.

SERVER RETURNS:
All accumulated changes sync to server automatically.
Remote users see everything that happened while server was down.
Zero data loss, zero downtime for on-site users.
```

### Sync Coordinator

The SyncCoordinator manages all sync methods simultaneously:

```typescript
// sync-coordinator.ts

import { P2PSync } from './sync-p2p';
import { HubSync } from './sync-hub';
import { CloudFolderSync } from './sync-cloud-folder';

type SyncStatus = 'synced' | 'syncing' | 'local_only' | 'offline';

interface SyncState {
  overall: SyncStatus;
  localPeers: PeerInfo[];
  serverReachable: boolean;
  pendingChanges: number;
  lastServerSync: Date | null;
  lastLocalSync: Date | null;
}

export class SyncCoordinator {
  private p2p: P2PSync;
  private hub: HubSync | null;
  private cloudFolder: CloudFolderSync | null;
  private state: SyncState;
  
  constructor(contextId: string, config: SyncConfig) {
    // P2P is ALWAYS enabled - it's the resilience layer
    this.p2p = new P2PSync(contextId);
    
    // Hub/managed server if configured
    if (config.hubUrl) {
      this.hub = new HubSync(config.hubUrl, contextId);
    }
    
    // Cloud folder as fallback
    if (config.cloudFolder) {
      this.cloudFolder = new CloudFolderSync(config.cloudFolder, contextId);
    }
    
    this.state = {
      overall: 'syncing',
      localPeers: [],
      serverReachable: false,
      pendingChanges: 0,
      lastServerSync: null,
      lastLocalSync: null
    };
  }

  /**
   * Start all sync methods
   */
  async start(): Promise<void> {
    // 1. Always start local P2P discovery
    await this.p2p.startDiscovery();
    this.p2p.on('peer_found', this.handlePeerFound.bind(this));
    this.p2p.on('sync_complete', this.handleLocalSyncComplete.bind(this));
    
    // 2. Connect to hub/server if available
    if (this.hub) {
      try {
        await this.hub.connect();
        this.state.serverReachable = true;
        this.hub.on('sync_complete', this.handleServerSyncComplete.bind(this));
        this.hub.on('disconnected', this.handleServerDisconnected.bind(this));
      } catch (error) {
        console.log('Server unreachable, continuing with local sync');
        this.state.serverReachable = false;
      }
    }
    
    // 3. Start cloud folder sync as background fallback
    if (this.cloudFolder) {
      this.cloudFolder.startPeriodicSync(60000); // Every minute
    }
    
    this.updateOverallStatus();
  }

  /**
   * Handle new peer discovered on local network
   */
  private handlePeerFound(peer: PeerInfo): void {
    console.log(`Found peer: ${peer.deviceName} (${peer.deviceId})`);
    this.state.localPeers.push(peer);
    
    // Immediately sync with new peer
    this.p2p.syncWithPeer(peer);
    
    this.updateOverallStatus();
    this.emitStateChange();
  }

  /**
   * Handle local P2P sync completion
   */
  private handleLocalSyncComplete(result: SyncResult): void {
    this.state.lastLocalSync = new Date();
    console.log(`Local sync: sent ${result.changesSent}, received ${result.changesReceived}`);
    
    this.updateOverallStatus();
    this.emitStateChange();
  }

  /**
   * Handle server becoming unreachable
   */
  private handleServerDisconnected(): void {
    console.log('Server disconnected - switching to local-only mode');
    this.state.serverReachable = false;
    
    // P2P continues working - no action needed
    // Just update status indicator
    
    this.updateOverallStatus();
    this.emitStateChange();
    
    // Try to reconnect periodically
    this.scheduleServerReconnect();
  }

  /**
   * Determine overall sync status for UI
   */
  private updateOverallStatus(): void {
    const hasPendingChanges = this.state.pendingChanges > 0;
    const hasLocalPeers = this.state.localPeers.length > 0;
    const hasServer = this.state.serverReachable;
    
    if (hasServer && !hasPendingChanges) {
      this.state.overall = 'synced';
    } else if (hasLocalPeers && !hasServer) {
      this.state.overall = 'local_only'; // Key state: server down but local sync working
    } else if (hasPendingChanges) {
      this.state.overall = 'syncing';
    } else {
      this.state.overall = 'offline';
    }
  }

  /**
   * Get current sync state for UI
   */
  getState(): SyncState {
    return { ...this.state };
  }

  /**
   * Force immediate sync with all available methods
   */
  async syncNow(): Promise<void> {
    const promises: Promise<void>[] = [];
    
    // Sync with all local peers
    for (const peer of this.state.localPeers) {
      promises.push(this.p2p.syncWithPeer(peer));
    }
    
    // Sync with server if available
    if (this.hub && this.state.serverReachable) {
      promises.push(this.hub.sync());
    }
    
    await Promise.allSettled(promises);
  }
}
```

### P2P Discovery & Sync

```typescript
// sync-p2p-detailed.ts

import Bonjour, { Service } from 'bonjour-service';
import { WebSocket, WebSocketServer } from 'ws';
import { networkInterfaces } from 'os';

interface PeerInfo {
  deviceId: string;
  deviceName: string;
  address: string;
  port: number;
  contextId: string;
  dbVersion: number;
}

export class P2PSync extends EventEmitter {
  private bonjour: Bonjour;
  private server: WebSocketServer;
  private contextId: string;
  private activePeers: Map<string, WebSocket> = new Map();
  private syncEngine: CRDTSyncEngine;
  
  private readonly SERVICE_TYPE = '_aeroedge._tcp';
  private readonly PORT = 8765;

  constructor(contextId: string) {
    super();
    this.contextId = contextId;
    this.bonjour = new Bonjour();
    this.syncEngine = new CRDTSyncEngine();
  }

  /**
   * Start listening for connections and advertising presence
   */
  async startDiscovery(): Promise<void> {
    // 1. Start WebSocket server for incoming connections
    this.server = new WebSocketServer({ port: this.PORT });
    this.server.on('connection', this.handleIncomingConnection.bind(this));
    
    // 2. Advertise this device on local network
    this.bonjour.publish({
      name: `AeroEdge-${this.getDeviceId().slice(0, 8)}`,
      type: this.SERVICE_TYPE,
      port: this.PORT,
      txt: {
        contextId: this.contextId,
        deviceId: this.getDeviceId(),
        deviceName: this.getDeviceName(),
        version: String(this.syncEngine.getCurrentVersion())
      }
    });
    
    // 3. Browse for other devices
    this.bonjour.find({ type: this.SERVICE_TYPE }, (service) => {
      this.handleServiceDiscovered(service);
    });
    
    console.log(`P2P sync started on port ${this.PORT}`);
  }

  /**
   * Handle discovering another AeroEdge device on the network
   */
  private handleServiceDiscovered(service: Service): void {
    // Ignore our own advertisement
    if (service.txt?.deviceId === this.getDeviceId()) return;
    
    // Only connect to devices in same context
    if (service.txt?.contextId !== this.contextId) return;
    
    const peer: PeerInfo = {
      deviceId: service.txt.deviceId,
      deviceName: service.txt.deviceName || service.name,
      address: service.addresses?.[0] || service.host,
      port: service.port,
      contextId: service.txt.contextId,
      dbVersion: parseInt(service.txt.version || '0')
    };
    
    // Avoid duplicate connections (lower deviceId initiates)
    if (this.getDeviceId() < peer.deviceId) {
      this.connectToPeer(peer);
    }
    
    this.emit('peer_found', peer);
  }

  /**
   * Initiate connection to discovered peer
   */
  private async connectToPeer(peer: PeerInfo): Promise<void> {
    if (this.activePeers.has(peer.deviceId)) return;
    
    const ws = new WebSocket(`ws://${peer.address}:${peer.port}`);
    
    ws.on('open', () => {
      console.log(`Connected to peer: ${peer.deviceName}`);
      this.activePeers.set(peer.deviceId, ws);
      
      // Send handshake
      ws.send(JSON.stringify({
        type: 'handshake',
        deviceId: this.getDeviceId(),
        deviceName: this.getDeviceName(),
        contextId: this.contextId,
        version: this.syncEngine.getCurrentVersion()
      }));
    });
    
    ws.on('message', (data) => this.handleMessage(ws, peer.deviceId, data));
    ws.on('close', () => this.handlePeerDisconnected(peer.deviceId));
    ws.on('error', (err) => console.error(`Peer error: ${err.message}`));
  }

  /**
   * Handle incoming connection from another device
   */
  private handleIncomingConnection(ws: WebSocket): void {
    let peerId: string | null = null;
    
    ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      
      if (message.type === 'handshake') {
        // Only accept peers in same context
        if (message.contextId !== this.contextId) {
          ws.close();
          return;
        }
        
        peerId = message.deviceId;
        this.activePeers.set(peerId, ws);
        console.log(`Peer connected: ${message.deviceName}`);
        
        // Respond with our handshake
        ws.send(JSON.stringify({
          type: 'handshake_ack',
          deviceId: this.getDeviceId(),
          version: this.syncEngine.getCurrentVersion()
        }));
        
        // Initiate sync
        this.initiateSync(ws, message.version);
      } else {
        this.handleMessage(ws, peerId!, data);
      }
    });
    
    ws.on('close', () => {
      if (peerId) this.handlePeerDisconnected(peerId);
    });
  }

  /**
   * Handle messages from peers
   */
  private async handleMessage(
    ws: WebSocket, 
    peerId: string, 
    data: Buffer | string
  ): Promise<void> {
    const message = JSON.parse(data.toString());
    
    switch (message.type) {
      case 'handshake_ack':
        this.initiateSync(ws, message.version);
        break;
        
      case 'sync_request':
        await this.handleSyncRequest(ws, message);
        break;
        
      case 'sync_response':
        await this.handleSyncResponse(message);
        break;
        
      case 'changes':
        await this.handleChanges(ws, message);
        break;
        
      case 'ack':
        // Sync complete
        this.emit('sync_complete', { 
          peerId, 
          changesSent: message.sent || 0,
          changesReceived: message.received || 0 
        });
        break;
    }
  }

  /**
   * Start sync with a peer based on version comparison
   */
  private async initiateSync(ws: WebSocket, theirVersion: number): Promise<void> {
    const myVersion = this.syncEngine.getCurrentVersion();
    
    if (theirVersion > myVersion) {
      // They have changes we need
      ws.send(JSON.stringify({
        type: 'sync_request',
        sinceVersion: myVersion
      }));
    }
    
    if (myVersion > theirVersion) {
      // We have changes they need
      const changes = this.syncEngine.getChangesSince(this.contextId, theirVersion);
      const encrypted = serializeChanges(changes, this.getContextKey());
      
      ws.send(JSON.stringify({
        type: 'changes',
        data: Buffer.from(encrypted).toString('base64'),
        fromVersion: theirVersion,
        toVersion: myVersion
      }));
    }
    
    if (myVersion === theirVersion) {
      // Already in sync
      ws.send(JSON.stringify({ type: 'ack', sent: 0, received: 0 }));
    }
  }

  /**
   * Handle request for our changes
   */
  private async handleSyncRequest(ws: WebSocket, message: any): Promise<void> {
    const changes = this.syncEngine.getChangesSince(this.contextId, message.sinceVersion);
    const encrypted = serializeChanges(changes, this.getContextKey());
    
    ws.send(JSON.stringify({
      type: 'changes',
      data: Buffer.from(encrypted).toString('base64'),
      count: changes.changes.length
    }));
  }

  /**
   * Apply changes received from peer
   */
  private async handleChanges(ws: WebSocket, message: any): Promise<void> {
    const encrypted = Buffer.from(message.data, 'base64');
    const changes = deserializeChanges(new Uint8Array(encrypted), this.getContextKey());
    
    const result = await this.syncEngine.applyChanges(changes);
    
    // Acknowledge receipt
    ws.send(JSON.stringify({
      type: 'ack',
      received: result.applied,
      newVersion: this.syncEngine.getCurrentVersion()
    }));
    
    // Check if we have changes they don't have
    if (this.syncEngine.getCurrentVersion() > message.toVersion) {
      const ourChanges = this.syncEngine.getChangesSince(this.contextId, message.toVersion);
      if (ourChanges.changes.length > 0) {
        const encrypted = serializeChanges(ourChanges, this.getContextKey());
        ws.send(JSON.stringify({
          type: 'changes',
          data: Buffer.from(encrypted).toString('base64'),
          count: ourChanges.changes.length
        }));
      }
    }
  }

  /**
   * Manually trigger sync with specific peer
   */
  async syncWithPeer(peer: PeerInfo): Promise<void> {
    const ws = this.activePeers.get(peer.deviceId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      this.initiateSync(ws, peer.dbVersion);
    }
  }

  /**
   * Get list of currently connected peers
   */
  getConnectedPeers(): string[] {
    return Array.from(this.activePeers.keys());
  }

  /**
   * Stop P2P sync
   */
  stop(): void {
    this.bonjour.unpublishAll();
    this.bonjour.destroy();
    
    for (const ws of this.activePeers.values()) {
      ws.close();
    }
    this.activePeers.clear();
    
    this.server.close();
  }
}
```

### Resilience Mode UI State

```typescript
// sync-status-ui.tsx

interface SyncStatusProps {
  state: SyncState;
}

export function SyncStatusIndicator({ state }: SyncStatusProps) {
  switch (state.overall) {
    case 'synced':
      return <Badge color="green" icon="✓" text="Synced" />;
      
    case 'local_only':
      // KEY STATE: Server down but local sync working
      return (
        <Badge 
          color="yellow" 
          icon="🏠" 
          text="Local sync" 
          tooltip={`Server offline. ${state.localPeers.length} devices syncing locally.`}
        />
      );
      
    case 'syncing':
      return <Badge color="blue" icon="🔄" text="Syncing..." />;
      
    case 'offline':
      return (
        <Badge 
          color="gray" 
          icon="📴" 
          text="Offline" 
          tooltip="Changes saved locally. Will sync when connected."
        />
      );
  }
}

export function SyncStatusDetail({ state }: SyncStatusProps) {
  return (
    <div className="sync-status-detail">
      <h3>Sync Status</h3>
      
      <section>
        <h4>Local Network</h4>
        {state.localPeers.length > 0 ? (
          <>
            <p className="success">✓ {state.localPeers.length} devices on same network</p>
            <ul>
              {state.localPeers.map(peer => (
                <li key={peer.deviceId}>
                  {peer.deviceName} 
                  <span className="subtle">
                    (synced {formatRelative(peer.lastSync)})
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="muted">No other devices found on this network</p>
        )}
      </section>
      
      <section>
        <h4>Server</h4>
        {state.serverReachable ? (
          <p className="success">
            ✓ Connected 
            <span className="subtle">
              (last sync {formatRelative(state.lastServerSync)})
            </span>
          </p>
        ) : (
          <div className="warning">
            <p>⚠️ Server unreachable</p>
            <p className="subtle">
              Don't worry - local sync is keeping everyone on-site up to date.
              {state.pendingChanges > 0 && 
                ` ${state.pendingChanges} changes will sync when server returns.`
              }
            </p>
          </div>
        )}
      </section>
      
      {state.pendingChanges > 0 && (
        <section>
          <h4>Pending Changes</h4>
          <p>{state.pendingChanges} changes waiting to sync to server</p>
          <p className="success">
            ✓ All changes synced with local devices
          </p>
        </section>
      )}
      
      <button onClick={() => syncCoordinator.syncNow()}>
        Sync Now
      </button>
    </div>
  );
}
```

### Real-World Scenario

```
8:00 AM - Server goes down (AWS issue, network problem, whatever)

FLIGHT SCHEDULE PRO:
├── 8:01 - "Service Unavailable" error
├── 8:15 - Student can't book aircraft
├── 8:30 - CFI can't see schedule
├── 9:00 - Operations halt
├── 10:00 - Server returns
├── 10:01 - Users have to re-login, refresh everything
└── Lost time: 2 hours of chaos

AEROEDGE:
├── 8:01 - Status badge changes to "🏠 Local sync"
├── 8:01 - Everything keeps working
├── 8:15 - Student books N12345 on phone
│         → Front desk iPad sees it in <1 second
├── 8:30 - CFI checks schedule - fully current
│         → Shows all bookings made by people on-site
├── 9:00 - Squawk reported by student
│         → Visible to all on-site devices immediately
├── 10:00 - Server returns
├── 10:01 - All accumulated changes sync automatically
│          → Remote users see everything that happened
│          → CRDT merges cleanly, no conflicts
└── Lost time: ZERO
```

---

## 7. Conflict Resolution

### CRDT Automatic Resolution

Most conflicts are handled automatically by cr-sqlite using Last-Writer-Wins (LWW) with causal ordering:

```
Device A (offline): UPDATE flights SET remarks = 'Good' WHERE id = 'f1';  -- timestamp 100
Device B (offline): UPDATE flights SET remarks = 'Great' WHERE id = 'f1'; -- timestamp 105

After sync: remarks = 'Great' (timestamp 105 > 100)
```

### Application-Level Conflict Detection

For business logic conflicts that CRDTs can't detect:

```typescript
// conflict-detection.ts

export class ConflictDetector {
  
  /**
   * Detect booking conflicts after sync
   */
  detectBookingConflicts(contextId: string): BookingConflict[] {
    // Find overlapping confirmed bookings for same aircraft
    const conflicts = this.db.prepare(`
      SELECT 
        b1.id as booking1_id,
        b2.id as booking2_id,
        b1.aircraft_id,
        b1.start_time as b1_start,
        b1.end_time as b1_end,
        b2.start_time as b2_start,
        b2.end_time as b2_end
      FROM bookings b1
      JOIN bookings b2 ON b1.aircraft_id = b2.aircraft_id
        AND b1.id < b2.id  -- Avoid duplicates
        AND b1.status = 'confirmed'
        AND b2.status = 'confirmed'
        AND b1.start_time < b2.end_time
        AND b1.end_time > b2.start_time
      WHERE b1.context_id = ?
    `).all(contextId);
    
    return conflicts.map(c => ({
      type: 'booking_overlap',
      booking1: c.booking1_id,
      booking2: c.booking2_id,
      aircraftId: c.aircraft_id,
      overlapStart: max(c.b1_start, c.b2_start),
      overlapEnd: min(c.b1_end, c.b2_end),
      resolution: this.suggestResolution(c)
    }));
  }
  
  /**
   * Suggest resolution for booking conflict
   */
  private suggestResolution(conflict: any): Resolution {
    // First-created wins by default
    const booking1 = this.getBooking(conflict.booking1_id);
    const booking2 = this.getBooking(conflict.booking2_id);
    
    if (new Date(booking1.created_at) < new Date(booking2.created_at)) {
      return {
        action: 'keep_first',
        keep: conflict.booking1_id,
        modify: conflict.booking2_id,
        suggestion: 'Move second booking to next available slot'
      };
    } else {
      return {
        action: 'keep_first',
        keep: conflict.booking2_id,
        modify: conflict.booking1_id,
        suggestion: 'Move first booking to next available slot'
      };
    }
  }
}

// Run after every sync
syncEngine.on('sync_complete', async (contextId) => {
  const conflicts = conflictDetector.detectBookingConflicts(contextId);
  
  if (conflicts.length > 0) {
    // Notify user/admin of conflicts requiring resolution
    await notificationService.notifyConflicts(contextId, conflicts);
  }
});
```

### Conflict Resolution UI Flow

```typescript
// User is presented with conflicts to resolve

interface ConflictResolutionUI {
  showConflict(conflict: BookingConflict): void {
    // Display both bookings
    // Show overlap period
    // Offer options:
    //   1. Keep Booking A, find new slot for B
    //   2. Keep Booking B, find new slot for A
    //   3. Cancel one booking
    //   4. Contact both parties
  }
  
  async resolveConflict(
    conflict: BookingConflict, 
    resolution: 'keep_a' | 'keep_b' | 'cancel_a' | 'cancel_b'
  ): Promise<void> {
    switch (resolution) {
      case 'keep_a':
        await this.rescheduleBooking(conflict.booking2, conflict.booking1.end_time);
        break;
      case 'keep_b':
        await this.rescheduleBooking(conflict.booking1, conflict.booking2.end_time);
        break;
      case 'cancel_a':
        await this.cancelBooking(conflict.booking1, 'Conflict resolution');
        break;
      case 'cancel_b':
        await this.cancelBooking(conflict.booking2, 'Conflict resolution');
        break;
    }
  }
}
```

---

## 7. Encryption & Security

### Key Derivation

```typescript
// encryption.ts

import { argon2id } from 'argon2';
import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';

/**
 * Derive encryption key from shared secret
 */
export async function deriveKey(
  secret: string, 
  salt: Uint8Array
): Promise<Uint8Array> {
  const key = await argon2id.hash(secret, {
    salt: salt,
    memoryCost: 65536,  // 64 MB
    timeCost: 3,
    parallelism: 4,
    hashLength: 32  // 256 bits for AES-256
  });
  
  return new Uint8Array(key);
}

/**
 * Generate random salt
 */
export function generateSalt(): Uint8Array {
  return randomBytes(16);
}

/**
 * Encrypt data with AES-256-GCM
 */
export function encrypt(data: Uint8Array, key: Uint8Array): Uint8Array {
  const iv = randomBytes(12);  // 96-bit IV for GCM
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  
  const encrypted = Buffer.concat([
    cipher.update(data),
    cipher.final()
  ]);
  
  const authTag = cipher.getAuthTag();
  
  // Return: IV (12) + AuthTag (16) + Ciphertext
  return Buffer.concat([iv, authTag, encrypted]);
}

/**
 * Decrypt data
 */
export function decrypt(data: Uint8Array, key: Uint8Array): Uint8Array {
  const iv = data.slice(0, 12);
  const authTag = data.slice(12, 28);
  const ciphertext = data.slice(28);
  
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final()
  ]);
}

/**
 * Hash for key verification (to check if user entered correct secret)
 */
export function hashForVerification(key: Uint8Array): string {
  // Hash the key with a fixed string - NOT the actual key
  const verificationData = Buffer.concat([
    Buffer.from('aeroedge-key-verification'),
    key
  ]);
  
  return createHash('sha256').update(verificationData).digest('hex').slice(0, 32);
}
```

### Secure Key Storage

```typescript
// secure-storage.ts

import * as Keychain from 'react-native-keychain';  // Mobile
import keytar from 'keytar';  // Desktop

export class SecureStorage {
  /**
   * Store context encryption key
   */
  async storeContextKey(contextId: string, key: Uint8Array): Promise<void> {
    const keyBase64 = Buffer.from(key).toString('base64');
    
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      // Mobile: Use Keychain/Keystore
      await Keychain.setGenericPassword(
        contextId,
        keyBase64,
        { service: 'com.aeroedge.context-keys' }
      );
    } else {
      // Desktop: Use OS keychain via keytar
      await keytar.setPassword('AeroEdge', contextId, keyBase64);
    }
  }
  
  /**
   * Retrieve context encryption key
   */
  async getContextKey(contextId: string): Promise<Uint8Array | null> {
    let keyBase64: string | null = null;
    
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      const credentials = await Keychain.getGenericPassword({
        service: 'com.aeroedge.context-keys'
      });
      if (credentials && credentials.username === contextId) {
        keyBase64 = credentials.password;
      }
    } else {
      keyBase64 = await keytar.getPassword('AeroEdge', contextId);
    }
    
    if (!keyBase64) return null;
    
    return new Uint8Array(Buffer.from(keyBase64, 'base64'));
  }
}
```

---

## 8. Platform-Specific Implementation

### iOS/Android (React Native)

```typescript
// App.tsx - React Native

import SQLite from 'react-native-sqlite-storage';
import { loadCRSQLite } from '@vlcn.io/crsqlite-react-native';

export async function initializeDatabase(): Promise<Database> {
  // Load cr-sqlite extension
  await loadCRSQLite();
  
  // Open database
  const db = await SQLite.openDatabase({
    name: 'aeroedge.db',
    location: 'default'
  });
  
  // Run migrations
  await runMigrations(db);
  
  // Enable CRDT on tables
  await enableCRDT(db);
  
  return db;
}

// Background sync
import BackgroundFetch from 'react-native-background-fetch';

BackgroundFetch.configure({
  minimumFetchInterval: 15,  // minutes
  stopOnTerminate: false,
  startOnBoot: true,
}, async (taskId) => {
  // Sync all active contexts
  const contexts = await getActiveContexts();
  for (const ctx of contexts) {
    await syncContext(ctx.id);
  }
  BackgroundFetch.finish(taskId);
});
```

### Desktop (Electron)

```typescript
// main.ts - Electron main process

import { app, BrowserWindow } from 'electron';
import Database from 'better-sqlite3';
import { extensionPath } from '@vlcn.io/crsqlite';

let db: Database.Database;

app.whenReady().then(() => {
  // Initialize database with cr-sqlite
  const dbPath = path.join(app.getPath('userData'), 'aeroedge.db');
  db = new Database(dbPath);
  
  // Load cr-sqlite extension
  db.loadExtension(extensionPath);
  
  // Run migrations
  runMigrations(db);
  
  createWindow();
});

// Expose database to renderer via IPC
ipcMain.handle('db:query', async (event, sql, params) => {
  return db.prepare(sql).all(...params);
});

ipcMain.handle('db:run', async (event, sql, params) => {
  return db.prepare(sql).run(...params);
});
```

### Web (PWA)

```typescript
// database.ts - Web with sql.js

import initSqlJs, { Database } from 'sql.js';
import { loadCRSQLiteWasm } from '@vlcn.io/crsqlite-wasm';

let db: Database;

export async function initializeDatabase(): Promise<Database> {
  // Load sql.js with cr-sqlite
  const SQL = await initSqlJs({
    locateFile: file => `https://sql.js.org/dist/${file}`
  });
  
  // Load cr-sqlite WASM extension
  await loadCRSQLiteWasm(SQL);
  
  // Try to load existing database from IndexedDB
  const savedDb = await loadFromIndexedDB();
  
  if (savedDb) {
    db = new SQL.Database(savedDb);
  } else {
    db = new SQL.Database();
    await runMigrations(db);
  }
  
  // Auto-save to IndexedDB on changes
  setInterval(() => saveToIndexedDB(db), 5000);
  
  return db;
}

async function saveToIndexedDB(db: Database): Promise<void> {
  const data = db.export();
  const dbRequest = indexedDB.open('AeroEdge', 1);
  
  dbRequest.onsuccess = () => {
    const idb = dbRequest.result;
    const tx = idb.transaction('database', 'readwrite');
    tx.objectStore('database').put(data, 'main');
  };
}
```

---

## 9. Hub Server Implementation

For organizations that need always-on sync:

```typescript
// hub-server.ts

import { WebSocketServer, WebSocket } from 'ws';
import Database from 'better-sqlite3';

interface ConnectedDevice {
  ws: WebSocket;
  deviceId: string;
  contextId: string;
  authenticated: boolean;
}

export class AeroEdgeHub {
  private wss: WebSocketServer;
  private db: Database.Database;
  private devices: Map<string, ConnectedDevice> = new Map();

  constructor(port: number, dbPath: string) {
    this.db = new Database(dbPath);
    this.db.loadExtension(extensionPath);
    
    this.wss = new WebSocketServer({ port });
    this.wss.on('connection', this.handleConnection.bind(this));
    
    console.log(`AeroEdge Hub running on port ${port}`);
  }

  private handleConnection(ws: WebSocket): void {
    let device: ConnectedDevice = {
      ws,
      deviceId: '',
      contextId: '',
      authenticated: false
    };

    ws.on('message', async (data) => {
      const message = JSON.parse(data.toString());
      
      switch (message.type) {
        case 'auth':
          device = await this.handleAuth(ws, message);
          break;
          
        case 'sync_request':
          if (device.authenticated) {
            await this.handleSyncRequest(device, message);
          }
          break;
          
        case 'push_changes':
          if (device.authenticated) {
            await this.handlePushChanges(device, message);
          }
          break;
      }
    });

    ws.on('close', () => {
      this.devices.delete(device.deviceId);
    });
  }

  private async handleAuth(ws: WebSocket, message: any): Promise<ConnectedDevice> {
    // Verify device token
    const isValid = await this.verifyToken(message.contextId, message.token);
    
    if (!isValid) {
      ws.send(JSON.stringify({ type: 'auth_failed' }));
      ws.close();
      return null;
    }
    
    const device: ConnectedDevice = {
      ws,
      deviceId: message.deviceId,
      contextId: message.contextId,
      authenticated: true
    };
    
    this.devices.set(message.deviceId, device);
    
    ws.send(JSON.stringify({ type: 'auth_success' }));
    
    return device;
  }

  private async handleSyncRequest(device: ConnectedDevice, message: any): Promise<void> {
    // Get changes since requested version
    const changes = this.getChangesSince(device.contextId, message.sinceVersion);
    
    device.ws.send(JSON.stringify({
      type: 'changes',
      data: changes  // Already encrypted by clients
    }));
  }

  private async handlePushChanges(device: ConnectedDevice, message: any): Promise<void> {
    // Store changes (hub stores encrypted blobs, can't read them)
    await this.storeChanges(device.contextId, message.data);
    
    // Notify other connected devices in same context
    this.notifyOtherDevices(device.contextId, device.deviceId);
    
    device.ws.send(JSON.stringify({ type: 'push_ack' }));
  }

  private notifyOtherDevices(contextId: string, excludeDeviceId: string): void {
    for (const [deviceId, device] of this.devices) {
      if (device.contextId === contextId && deviceId !== excludeDeviceId) {
        device.ws.send(JSON.stringify({ type: 'change_notification' }));
      }
    }
  }
}

// Run hub server
const hub = new AeroEdgeHub(
  parseInt(process.env.PORT || '8765'),
  process.env.DB_PATH || './hub.db'
);
```

### Docker Deployment for Self-Hosted Hub

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --production

COPY dist/ ./dist/

# Create data directory
RUN mkdir -p /data

ENV PORT=8765
ENV DB_PATH=/data/hub.db

EXPOSE 8765

CMD ["node", "dist/hub-server.js"]
```

```yaml
# docker-compose.yml
version: '3.8'

services:
  aeroedge-hub:
    build: .
    ports:
      - "8765:8765"
    volumes:
      - aeroedge-data:/data
    restart: unless-stopped
    environment:
      - PORT=8765
      - DB_PATH=/data/hub.db

volumes:
  aeroedge-data:
```

---

## 11. Flight Capture System

The "Never Forget to Log" system provides multiple entry points for flight data.

### Text-to-Log Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Pilot     │────▶│   Twilio    │────▶│  AeroEdge   │
│   Phone     │ SMS │   Gateway   │     │  Webhook    │
│             │◀────│             │◀────│  Handler    │
└─────────────┘     └─────────────┘     └─────────────┘
                                               │
                          ┌────────────────────┼────────────────────┐
                          │                    │                    │
                          ▼                    ▼                    ▼
                    ┌───────────┐        ┌───────────┐        ┌───────────┐
                    │  Basic    │        │  AI       │        │  User's   │
                    │  Parser   │        │  Parser   │        │  Database │
                    │  (free)   │        │  (paid)   │        │           │
                    └───────────┘        └───────────┘        └───────────┘
```

### Basic Parser (No AI Required)

```typescript
// text-to-log-basic.ts

interface ParsedFlight {
  duration?: number;
  aircraft?: string;
  route?: { from?: string; to?: string };
  landings?: { day?: number; night?: number };
  type?: 'pic' | 'dual' | 'solo' | 'cfi';
  student?: string;
  remarks?: string;
  confidence: number;
}

const PATTERNS = {
  duration: /(\d+\.?\d*)\s*(hr|hour|hrs)?/i,
  aircraft: /\b(N?\d{3,5}[A-Z]{0,2}|(?:the\s+)?(?:172|182|152|archer|warrior|arrow|bonanza|skylane|skyhawk))\b/i,
  landings: /(\d+)\s*(?:ldg|landing|landings)/i,
  xc: /\b(xc|cross\s*country)\b/i,
  icao: /\b([KP]?[A-Z]{3,4})\b/g,
  night: /\bnight\b/i,
  instrument: /\b(ifr|instrument|imc|approaches?)\b/i,
  dual: /\b(dual|with|student|lesson)\b/i,
  studentName: /(?:with|student)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
};

export function parseBasic(text: string, userContext: UserContext): ParsedFlight {
  const result: ParsedFlight = { confidence: 0 };
  let matches = 0;
  
  // Duration
  const durationMatch = text.match(PATTERNS.duration);
  if (durationMatch) {
    result.duration = parseFloat(durationMatch[1]);
    matches++;
  }
  
  // Aircraft - check user's aircraft first
  const aircraftMatch = text.match(PATTERNS.aircraft);
  if (aircraftMatch) {
    result.aircraft = resolveAircraft(aircraftMatch[1], userContext);
    matches++;
  } else if (userContext.defaultAircraft) {
    result.aircraft = userContext.defaultAircraft;
  }
  
  // Landings
  const landingsMatch = text.match(PATTERNS.landings);
  if (landingsMatch) {
    const count = parseInt(landingsMatch[1]);
    if (PATTERNS.night.test(text)) {
      result.landings = { night: count };
    } else {
      result.landings = { day: count };
    }
    matches++;
  }
  
  // Route (ICAO codes)
  const icaoCodes = text.match(PATTERNS.icao) || [];
  const validIcao = icaoCodes.filter(c => isValidAirport(c));
  if (validIcao.length >= 2) {
    result.route = { from: validIcao[0], to: validIcao[1] };
    matches++;
  } else if (validIcao.length === 1) {
    result.route = { from: userContext.homeAirport, to: validIcao[0] };
    matches++;
  }
  
  // Dual flight detection
  if (PATTERNS.dual.test(text)) {
    result.type = userContext.isCFI ? 'cfi' : 'dual';
    
    // Try to extract student name
    const studentMatch = text.match(PATTERNS.studentName);
    if (studentMatch) {
      result.student = resolveStudent(studentMatch[1], userContext);
      matches++;
    }
  }
  
  result.confidence = Math.min(matches / 4, 1);
  return result;
}

function resolveAircraft(input: string, ctx: UserContext): string {
  const normalized = input.toLowerCase().replace(/^the\s+/, '');
  
  // Check user's aircraft by nickname or type
  for (const aircraft of ctx.aircraft) {
    if (aircraft.tailNumber.toLowerCase().includes(normalized)) return aircraft.tailNumber;
    if (aircraft.type.toLowerCase().includes(normalized)) return aircraft.tailNumber;
    if (aircraft.nickname?.toLowerCase() === normalized) return aircraft.tailNumber;
  }
  
  return input.toUpperCase();
}

function resolveStudent(name: string, ctx: UserContext): string | undefined {
  if (!ctx.students) return undefined;
  
  const normalized = name.toLowerCase();
  
  // Exact match
  for (const student of ctx.students) {
    if (student.displayName.toLowerCase() === normalized) return student.id;
    if (student.firstName.toLowerCase() === normalized) return student.id;
  }
  
  // Fuzzy match
  for (const student of ctx.students) {
    if (student.displayName.toLowerCase().includes(normalized)) return student.id;
  }
  
  return undefined;
}
```

### SMS Handler

```typescript
// sms-handler.ts

import Twilio from 'twilio';

export async function handleIncomingSMS(from: string, body: string): Promise<string> {
  // 1. Identify user by phone number
  const user = await findUserByPhone(from);
  if (!user) {
    return "I don't recognize this number. Link your phone in the AeroEdge app first.";
  }
  
  // 2. Get user context (aircraft, students, home airport)
  const userContext = await getUserContext(user.id);
  
  // 3. Check for ForeFlight attachment
  const foreflightData = extractForeFlightData(body);
  if (foreflightData) {
    return await handleForeFlightImport(user, userContext, foreflightData, body);
  }
  
  // 4. Parse as text-to-log
  let parsed: ParsedFlight;
  if (user.hasAISubscription) {
    parsed = await parseWithAI(body, userContext);
  } else {
    parsed = parseBasic(body, userContext);
  }
  
  // 5. Check for dual flight (CFI logging for student)
  if (parsed.student && userContext.isCFI) {
    return await handleDualFlight(user, userContext, parsed);
  }
  
  // 6. Create draft flight
  const draft = await createFlightDraft(user.id, {
    ...parsed,
    rawText: body,
    source: 'sms',
    status: 'draft'
  });
  
  // 7. Build response
  const summary = formatFlightSummary(draft);
  const editLink = `aeroedge://flight/draft/${draft.id}`;
  
  if (parsed.confidence < 0.5) {
    return `Draft saved (needs review):\n${summary}\n\nTap to edit: ${editLink}`;
  } else {
    return `✓ Draft created:\n${summary}\n\nReply to add details or tap: ${editLink}`;
  }
}
```

### ForeFlight Import

```typescript
// foreflight-parser.ts

interface ForeFlightImport {
  date: string;
  aircraft: string;
  route: string[];
  departureTime: string;
  arrivalTime: string;
  totalTime: number;
  landings: number;
  nightTime?: number;
  approaches?: Approach[];
  holds?: number;
  distance?: number;
  trackLog?: string;
}

export function parseForeFlightSummary(text: string): ForeFlightImport | null {
  // Detect ForeFlight format
  if (!text.includes('Total Time:') && !text.includes('Track Log')) {
    return null;
  }
  
  const result: Partial<ForeFlightImport> = {};
  
  // Date
  const dateMatch = text.match(/Date:\s*(\d{4}-\d{2}-\d{2})/);
  if (dateMatch) result.date = dateMatch[1];
  
  // Aircraft
  const acMatch = text.match(/Aircraft:\s*(N?\d+[A-Z]*)/i);
  if (acMatch) result.aircraft = acMatch[1];
  
  // Route
  const routeMatch = text.match(/Route:\s*([A-Z]{3,4}(?:\s+[A-Z]{3,4})*)/);
  if (routeMatch) result.route = routeMatch[1].split(/\s+/);
  
  // Times
  const totalMatch = text.match(/Total\s*Time:\s*(\d+\.?\d*)/i);
  if (totalMatch) result.totalTime = parseFloat(totalMatch[1]);
  
  const nightMatch = text.match(/Night:\s*(\d+\.?\d*)/i);
  if (nightMatch) result.nightTime = parseFloat(nightMatch[1]);
  
  // Landings
  const ldgMatch = text.match(/Landings:\s*(\d+)/i);
  if (ldgMatch) result.landings = parseInt(ldgMatch[1]);
  
  // Approaches
  const approachSection = text.match(/Approaches:\s*([\s\S]*?)(?=\n\w+:|$)/i);
  if (approachSection) {
    result.approaches = parseApproaches(approachSection[1]);
  }
  
  // Holds
  const holdsMatch = text.match(/Holds:\s*(\d+)/i);
  if (holdsMatch) result.holds = parseInt(holdsMatch[1]);
  
  return result as ForeFlightImport;
}

function parseApproaches(text: string): Approach[] {
  const approaches: Approach[] = [];
  const lines = text.trim().split('\n');
  
  for (const line of lines) {
    const match = line.match(/(ILS|RNAV|VOR|LOC|NDB|LDA|GPS).*?(RWY\s*\d+[LRC]?)?\s+([A-Z]{3,4})/i);
    if (match) {
      approaches.push({
        type: normalizeApproachType(match[1]),
        runway: match[2]?.replace(/\s+/g, '') || '',
        airport: match[3]
      });
    }
  }
  
  return approaches;
}

async function handleForeFlightImport(
  user: User,
  userContext: UserContext,
  foreflightData: ForeFlightImport,
  originalText: string
): Promise<string> {
  // Check for student mention (dual flight)
  const studentMatch = originalText.match(/(?:with|student|dual)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
  
  if (studentMatch && userContext.isCFI) {
    const studentRef = studentMatch[1];
    const student = await findStudentByReference(user.id, studentRef);
    
    if (student) {
      return await createDualFlightEntries(user, student, foreflightData, originalText);
    } else {
      // Can't find student - create CFI entry only, ask for clarification
      const flight = await createFlightFromImport(user.id, foreflightData, 'dual_given');
      return `✓ Your flight logged:\n${formatFlightSummary(flight)}\n\n` +
             `I couldn't find student "${studentRef}". Reply with full name to log their entry too.`;
    }
  }
  
  // Solo flight - just log for this user
  const flight = await createFlightFromImport(user.id, foreflightData, 'pic');
  return `✓ Flight logged from ForeFlight:\n${formatFlightSummary(flight)}\n\n` +
         `Tap to review: aeroedge://flight/${flight.id}`;
}
```

### Dual Flight Logging (CFI + Student)

```typescript
// dual-flight-handler.ts

interface DualFlightResult {
  status: 'success' | 'needs_clarification' | 'error';
  cfiEntry?: Flight;
  studentEntry?: Flight;
  message: string;
}

export async function createDualFlightEntries(
  cfi: User,
  student: User,
  flightData: ForeFlightImport | ParsedFlight,
  originalText: string
): Promise<string> {
  
  // 1. Find shared context (flight school)
  const sharedContext = await findSharedContext(cfi.id, student.id);
  
  // 2. Extract lesson reference if present
  const lessonMatch = originalText.match(/lesson\s*(\d+|[IVXLC]+)/i);
  const lessonRef = lessonMatch ? lessonMatch[1] : null;
  
  // 3. Create CFI's entry
  const cfiEntry = await createFlightEntry({
    userId: cfi.id,
    contextIds: [cfi.personalContextId, sharedContext?.id].filter(Boolean),
    date: flightData.date || new Date().toISOString().split('T')[0],
    aircraft: flightData.aircraft,
    route: flightData.route,
    totalTime: flightData.totalTime || flightData.duration,
    dualGiven: flightData.totalTime || flightData.duration,
    landings: flightData.landings,
    nightTime: flightData.nightTime,
    approaches: flightData.approaches,
    holds: flightData.holds,
    studentId: student.id,
    studentName: student.displayName,
    lessonReference: lessonRef,
    source: 'import',
    linkedFlightId: null, // Set after student entry created
  });
  
  // 4. Create student's entry (mirror of CFI's)
  const studentEntry = await createFlightEntry({
    userId: student.id,
    contextIds: [student.personalContextId, sharedContext?.id].filter(Boolean),
    date: flightData.date || new Date().toISOString().split('T')[0],
    aircraft: flightData.aircraft,
    route: flightData.route,
    totalTime: flightData.totalTime || flightData.duration,
    dualReceived: flightData.totalTime || flightData.duration,
    landings: flightData.landings,
    nightTime: flightData.nightTime,
    approaches: flightData.approaches,
    holds: flightData.holds,
    instructorId: cfi.id,
    instructorName: cfi.displayName,
    instructorCertificate: cfi.cfiCertificate,
    lessonReference: lessonRef,
    source: 'cfi_logged',
    linkedFlightId: cfiEntry.id,
  });
  
  // 5. Link entries bidirectionally
  await linkFlights(cfiEntry.id, studentEntry.id, 'dual');
  
  // 6. Update syllabus progress if lesson referenced
  if (lessonRef && sharedContext) {
    await updateSyllabusProgress(student.id, lessonRef, {
      status: 'completed',
      completedAt: new Date().toISOString(),
      flightId: studentEntry.id,
      cfiId: cfi.id,
    });
  }
  
  // 7. Notify student
  await sendNotification(student.id, {
    type: 'flight_logged',
    title: 'Flight logged by your instructor',
    body: `${cfi.displayName} logged your ${flightData.totalTime}hr flight`,
    data: { flightId: studentEntry.id }
  });
  
  // 8. Return confirmation to CFI
  const summary = formatDualFlightSummary(cfiEntry, studentEntry, student);
  return `✓ Flight logged for you AND ${student.firstName}:\n${summary}\n\n` +
         `Both entries linked. ${student.firstName} has been notified.`;
}

// Flight linking table operations
async function linkFlights(
  flightAId: string, 
  flightBId: string, 
  linkType: 'dual' | 'safety_pilot' | 'examiner'
): Promise<void> {
  await db.run(`
    INSERT INTO flight_links (id, flight_a_id, flight_b_id, link_type, created_at, created_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [
    generateId(),
    flightAId,
    flightBId,
    linkType,
    new Date().toISOString(),
    getCurrentUserId()
  ]);
  
  // Update both flights with link reference
  await db.run(`UPDATE flights SET linked_flight_id = ? WHERE id = ?`, [flightBId, flightAId]);
  await db.run(`UPDATE flights SET linked_flight_id = ? WHERE id = ?`, [flightAId, flightBId]);
}
```

### Flight Links Database Schema

```sql
-- Add to existing schema

-- Flight linking table (for dual, safety pilot, examiner flights)
CREATE TABLE flight_links (
    id TEXT PRIMARY KEY,
    flight_a_id TEXT NOT NULL REFERENCES flights(id),
    flight_b_id TEXT NOT NULL REFERENCES flights(id),
    link_type TEXT NOT NULL,  -- 'dual', 'safety_pilot', 'examiner', 'ground'
    created_at TEXT NOT NULL,
    created_by TEXT NOT NULL,
    
    UNIQUE(flight_a_id, flight_b_id)
);
SELECT crsql_as_crr('flight_links');

-- Index for finding linked flights
CREATE INDEX idx_flight_links_a ON flight_links(flight_a_id);
CREATE INDEX idx_flight_links_b ON flight_links(flight_b_id);

-- Update flights table to add linking support
ALTER TABLE flights ADD COLUMN linked_flight_id TEXT REFERENCES flights(id);
ALTER TABLE flights ADD COLUMN source TEXT DEFAULT 'manual'; -- manual, sms, import, cfi_logged, booking

-- Notification when linked flight is updated
CREATE TRIGGER notify_linked_flight_update
AFTER UPDATE ON flights
WHEN OLD.updated_at != NEW.updated_at
BEGIN
    INSERT INTO notifications (id, user_id, type, title, body, data, created_at)
    SELECT 
        lower(hex(randomblob(16))),
        f.pilot_id,
        'linked_flight_updated',
        'Flight record updated',
        'A linked flight from ' || NEW.date || ' was modified',
        json_object('flightId', f.id, 'linkedFlightId', NEW.id),
        datetime('now')
    FROM flight_links fl
    JOIN flights f ON f.id = CASE 
        WHEN fl.flight_a_id = NEW.id THEN fl.flight_b_id 
        ELSE fl.flight_a_id 
    END
    WHERE (fl.flight_a_id = NEW.id OR fl.flight_b_id = NEW.id)
      AND f.pilot_id != NEW.pilot_id;
END;
```

### Safety Pilot Logging

```typescript
// safety-pilot-handler.ts

export async function handleSafetyPilotFlight(
  reporter: User,
  otherPilot: User,
  flightData: ParsedFlight,
  splits: { reporterPIC: number; otherPIC: number; hoodTime: number }
): Promise<string> {
  
  const totalTime = flightData.duration;
  
  // Reporter's entry
  const reporterEntry = await createFlightEntry({
    userId: reporter.id,
    contextIds: [reporter.personalContextId],
    date: flightData.date || new Date().toISOString().split('T')[0],
    aircraft: flightData.aircraft,
    route: flightData.route,
    totalTime: totalTime,
    picTime: splits.reporterPIC,
    simulatedInstrument: splits.otherPIC, // Time acting as safety pilot
    remarks: `Safety pilot for ${otherPilot.displayName}`,
    source: 'sms',
  });
  
  // Other pilot's entry
  const otherEntry = await createFlightEntry({
    userId: otherPilot.id,
    contextIds: [otherPilot.personalContextId],
    date: flightData.date || new Date().toISOString().split('T')[0],
    aircraft: flightData.aircraft,
    route: flightData.route,
    totalTime: totalTime,
    picTime: splits.otherPIC,
    simulatedInstrument: splits.hoodTime,
    remarks: `Safety pilot: ${reporter.displayName}`,
    source: 'other_logged',
  });
  
  // Link entries
  await linkFlights(reporterEntry.id, otherEntry.id, 'safety_pilot');
  
  // Notify other pilot
  await sendNotification(otherPilot.id, {
    type: 'flight_logged',
    title: 'Safety pilot flight logged',
    body: `${reporter.displayName} logged your ${totalTime}hr flight`,
    data: { flightId: otherEntry.id }
  });
  
  return `✓ Safety pilot flight logged for both:\n` +
         `You: ${splits.reporterPIC} PIC\n` +
         `${otherPilot.firstName}: ${splits.otherPIC} PIC, ${splits.hoodTime} hood\n` +
         `Entries linked.`;
}
```

### Ground Instruction (Multiple Students)

```typescript
// ground-instruction-handler.ts

export async function handleGroundInstruction(
  cfi: User,
  studentRefs: string[],
  duration: number,
  topic: string
): Promise<string> {
  
  const students = await Promise.all(
    studentRefs.map(ref => findStudentByReference(cfi.id, ref))
  );
  
  const validStudents = students.filter(s => s !== null) as User[];
  const notFound = studentRefs.filter((_, i) => students[i] === null);
  
  // Create CFI's ground instruction entry
  const cfiEntry = await createGroundEntry({
    userId: cfi.id,
    date: new Date().toISOString().split('T')[0],
    duration: duration,
    type: 'ground_given',
    topic: topic,
    studentIds: validStudents.map(s => s.id),
    studentNames: validStudents.map(s => s.displayName).join(', '),
  });
  
  // Create entry for each student
  const studentEntries = await Promise.all(
    validStudents.map(student => createGroundEntry({
      userId: student.id,
      date: new Date().toISOString().split('T')[0],
      duration: duration,
      type: 'ground_received',
      topic: topic,
      instructorId: cfi.id,
      instructorName: cfi.displayName,
      linkedFlightId: cfiEntry.id,
    }))
  );
  
  // Link all entries
  for (const studentEntry of studentEntries) {
    await linkFlights(cfiEntry.id, studentEntry.id, 'ground');
  }
  
  // Notify all students
  for (const student of validStudents) {
    await sendNotification(student.id, {
      type: 'ground_logged',
      title: 'Ground instruction logged',
      body: `${cfi.displayName} logged ${duration}hr ground: ${topic}`,
    });
  }
  
  let response = `✓ Ground instruction logged:\n` +
                 `${duration} hrs | ${topic}\n` +
                 `Logged for: ${validStudents.map(s => s.firstName).join(', ')}`;
  
  if (notFound.length > 0) {
    response += `\n\n⚠️ Couldn't find: ${notFound.join(', ')}`;
  }
  
  return response;
}
```

---

## 12. AI Integration

### AI Availability by Connectivity

```typescript
// ai-availability.ts

type AICapability = 'full' | 'basic' | 'none';

function getAICapability(connectivity: ConnectivityState): AICapability {
  if (connectivity.hasInternet && connectivity.serverReachable) {
    return 'full';  // Cloud AI available
  } else if (connectivity.hasLocalPeers) {
    return 'basic'; // On-device only
  } else {
    return 'none';  // Offline, queue for later
  }
}

// AI features by capability level
const AI_FEATURES = {
  full: [
    'natural_language_parsing',
    'smart_recommendations',
    'training_analysis',
    'fleet_insights',
    'settings_assistant',
    'voice_to_log',
  ],
  basic: [
    'basic_parsing',      // Pattern matching
    'cached_responses',   // Pre-downloaded common answers
    'smart_defaults',     // Based on local history
  ],
  none: [
    'queued_requests',    // Ask now, answer when connected
  ]
};
```

### Settings Assistant

```typescript
// settings-assistant.ts

interface SettingsChange {
  setting: string;
  oldValue: any;
  newValue: any;
  confirmed: boolean;
}

export async function handleSettingsRequest(
  user: User,
  request: string
): Promise<{ response: string; changes?: SettingsChange[] }> {
  
  const prompt = `
    User wants to change settings. Parse their request and determine what to change.
    
    Current settings:
    ${JSON.stringify(user.settings, null, 2)}
    
    User request: "${request}"
    
    Return JSON with:
    - understood: boolean
    - changes: [{setting, oldValue, newValue}]
    - clarification: string (if not understood)
    - confirmation: string (to show user before applying)
  `;
  
  const response = await claude.complete(prompt);
  const parsed = JSON.parse(response);
  
  if (!parsed.understood) {
    return { response: parsed.clarification };
  }
  
  // Format confirmation
  const changes = parsed.changes.map((c: any) => ({
    ...c,
    confirmed: false
  }));
  
  return {
    response: parsed.confirmation + '\n\nReply "yes" to confirm.',
    changes
  };
}

// Example interactions:
// User: "Stop sending me weather alerts"
// AI: "I'll turn off weather notifications. You won't receive alerts about 
//      weather conditions for your flights. Reply 'yes' to confirm."
// User: "yes"
// AI: "Done. Weather notifications are now off. You can re-enable them 
//      anytime in Settings > Notifications."

// User: "I want to see times in 24 hour format"
// AI: "I'll change your time display to 24-hour format. Times like 2:30 PM 
//      will show as 14:30. Reply 'yes' to confirm."
```

### Currency Assistant

```typescript
// currency-assistant.ts

export async function handleCurrencyQuery(
  user: User,
  query: string
): Promise<string> {
  
  const currency = await calculateCurrency(user.id);
  
  const prompt = `
    Pilot is asking about their currency status.
    
    Current currency data:
    ${JSON.stringify(currency, null, 2)}
    
    Query: "${query}"
    
    Provide a helpful, concise answer. If they're at risk of going non-current,
    suggest specific actions. Reference their actual flights and dates.
  `;
  
  return await claude.complete(prompt);
}

// Example:
// User: "Am I night current?"
// AI: "Yes, you're night current. You have 4 night landings in the past 90 days 
//      (3 required). Your oldest qualifying landing was Dec 15, so you'll need 
//      another night landing by Mar 15 to stay current. You have a booking on 
//      Feb 28 that ends at 5pm - want me to extend it past sunset?"
```

---

## Summary

This technical implementation provides:

1. **Local-first architecture** using SQLite + cr-sqlite for automatic CRDT sync
2. **Context isolation** ensuring personal and group data stay separate
3. **Multiple sync options** from zero-infrastructure P2P to managed cloud
4. **Resilience Mode** keeping on-site operations running even when server is down
5. **End-to-end encryption** so even hub servers can't read user data
6. **Cross-platform support** for mobile, desktop, and web
7. **Self-hostable hub** for organizations wanting full control
8. **Flight capture system** with text-to-log, ForeFlight import, and dual logging
9. **Linked flight entries** ensuring CFI and student times always match
10. **Optional AI integration** for enhanced UX without gating core features

The key insight is that cr-sqlite does the heavy lifting - it turns standard SQL tables into automatically-mergeable CRDTs. The application layer handles context management, sync transport, encryption, flight capture, and AI enhancement.

This architecture supports the full pricing model from solo pilots (local-only, no sync needed) to large flight schools (always-on hub with real-time sync, AI-powered training analysis).
