# AeroEdge Ecosystem
## API Contracts Between Nodes

---

## Overview

This document defines the contracts between AeroEdge nodes. Each node must:
1. Emit the events it publishes
2. Handle the events it subscribes to
3. Implement the queries it provides
4. Only call queries that other nodes provide

**Contract enforcement:** The `validate-compat.sh` script checks these contracts.

---

## Event Bus Architecture

All inter-node communication happens via events stored in the shared `events` table.

```sql
-- Events table (in core schema)
CREATE TABLE events (
    id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,        -- e.g., 'flight.created'
    payload TEXT NOT NULL,           -- JSON
    source_node TEXT NOT NULL,       -- 'logbook', 'scheduler', etc.
    context_id TEXT,                 -- Which context this affects
    created_at TEXT NOT NULL,
    processed_at TEXT,               -- NULL until processed
    idempotency_key TEXT UNIQUE      -- Prevent duplicate processing
);
```

### Event Processing Rules

1. **Emit once** - Events are written to the events table
2. **Process locally** - Each node processes events relevant to it
3. **Mark processed** - Set `processed_at` after handling
4. **Idempotency** - Use `idempotency_key` to prevent double-processing
5. **Sync via CRDT** - Events table syncs like any other table

---

## Node: Logbook

### Events Published

#### `flight.created`

Emitted when a new flight is logged.

```typescript
interface FlightCreatedEvent {
  event_type: 'flight.created';
  payload: {
    flight_id: string;
    pilot_id: string;
    aircraft_id: string;
    date: string;              // ISO 8601
    total_time: number;        // Hours
    pic_time?: number;
    dual_received?: number;
    dual_given?: number;
    solo?: number;
    landings_day?: number;
    landings_night?: number;
    night_time?: number;
    instrument_actual?: number;
    instrument_simulated?: number;
    cross_country?: number;
    route?: string[];          // ICAO codes
    context_ids: string[];     // Which contexts this flight belongs to
    source: 'manual' | 'sms' | 'import' | 'cfi_logged' | 'booking';
  };
}
```

**Consumers:**
- `aircraft` - Updates hobbs/tach time
- `syllabus` - Checks if flight completes a lesson

---

#### `flight.updated`

Emitted when a flight record is modified.

```typescript
interface FlightUpdatedEvent {
  event_type: 'flight.updated';
  payload: {
    flight_id: string;
    changes: {
      field: string;
      old_value: any;
      new_value: any;
    }[];
    updated_by: string;        // User ID
  };
}
```

**Consumers:**
- `aircraft` - Adjusts hobbs if total_time changed
- `syllabus` - Re-validates lesson completion

---

#### `flight.linked`

Emitted when two flights are linked (dual, safety pilot, etc.).

```typescript
interface FlightLinkedEvent {
  event_type: 'flight.linked';
  payload: {
    flight_a_id: string;       // Usually CFI's flight
    flight_b_id: string;       // Usually student's flight
    link_type: 'dual' | 'safety_pilot' | 'examiner' | 'ground';
    linked_by: string;         // User ID who created the link
  };
}
```

**Consumers:**
- `syllabus` - Updates lesson completion for linked flights

---

### Events Subscribed

#### From `scheduler`: `booking.completed`

```typescript
interface BookingCompletedEvent {
  event_type: 'booking.completed';
  payload: {
    booking_id: string;
    aircraft_id: string;
    pilot_id: string;
    instructor_id?: string;
    start_time: string;        // Actual start
    end_time: string;          // Actual end
    hobbs_start?: number;
    hobbs_end?: number;
    context_id: string;
  };
}
```

**Action:** Create draft flight entry with pre-filled data.

---

#### From `syllabus`: `lesson.scheduled`

```typescript
interface LessonScheduledEvent {
  event_type: 'lesson.scheduled';
  payload: {
    enrollment_id: string;
    lesson_id: string;
    lesson_name: string;
    objectives: string[];
    booking_id: string;
  };
}
```

**Action:** Attach lesson metadata to upcoming flight draft.

---

### Queries Provided

#### `getFlightsByAircraft`

```typescript
function getFlightsByAircraft(params: {
  aircraft_id: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
}): Promise<Flight[]>;
```

---

#### `getPilotCurrency`

```typescript
function getPilotCurrency(params: {
  pilot_id: string;
}): Promise<{
  flight_review: { current: boolean; expires?: string };
  medical: { current: boolean; class?: number; expires?: string };
  night_passenger: { current: boolean; landings_last_90: number };
  ifr: { current: boolean; approaches_last_6mo: number };
}>;
```

---

#### `getFlightsByContext`

```typescript
function getFlightsByContext(params: {
  context_id: string;
  pilot_id?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
}): Promise<Flight[]>;
```

---

### Queries Required

#### From `aircraft`: `getAircraftDetails`

```typescript
function getAircraftDetails(params: {
  aircraft_id: string;
}): Promise<{
  id: string;
  tail_number: string;
  type: string;
  current_hobbs: number;
  current_tach: number;
}>;
```

---

#### From `syllabus`: `getStudentEnrollments`

```typescript
function getStudentEnrollments(params: {
  student_id: string;
  active_only?: boolean;
}): Promise<{
  enrollment_id: string;
  syllabus_name: string;
  current_lesson: string;
}[]>;
```

---

## Node: Aircraft

### Events Published

#### `aircraft.times_updated`

Emitted when aircraft times change (from flight logging or manual entry).

```typescript
interface AircraftTimesUpdatedEvent {
  event_type: 'aircraft.times_updated';
  payload: {
    aircraft_id: string;
    hobbs: number;
    tach?: number;
    updated_by: string;
    source: 'flight' | 'manual' | 'maintenance';
  };
}
```

**Consumers:**
- `scheduler` - Updates availability predictions

---

#### `aircraft.grounded`

Emitted when aircraft becomes unavailable.

```typescript
interface AircraftGroundedEvent {
  event_type: 'aircraft.grounded';
  payload: {
    aircraft_id: string;
    reason: 'squawk' | 'maintenance' | 'annual' | 'ad' | 'other';
    description: string;
    estimated_return?: string;  // ISO 8601
    grounded_by: string;
  };
}
```

**Consumers:**
- `scheduler` - Cancels/reschedules affected bookings

---

#### `aircraft.returned_to_service`

Emitted when grounded aircraft becomes available again.

```typescript
interface AircraftReturnedEvent {
  event_type: 'aircraft.returned_to_service';
  payload: {
    aircraft_id: string;
    returned_by: string;
    maintenance_performed?: string;
  };
}
```

**Consumers:**
- `scheduler` - Updates aircraft availability

---

#### `squawk.reported`

Emitted when a pilot reports a squawk.

```typescript
interface SquawkReportedEvent {
  event_type: 'squawk.reported';
  payload: {
    squawk_id: string;
    aircraft_id: string;
    reported_by: string;
    description: string;
    severity: 'grounding' | 'deferrable' | 'monitor';
    flight_id?: string;        // If reported after a flight
  };
}
```

**Consumers:**
- `scheduler` - May affect aircraft availability

---

#### `maintenance.due`

Emitted when maintenance is coming due.

```typescript
interface MaintenanceDueEvent {
  event_type: 'maintenance.due';
  payload: {
    aircraft_id: string;
    maintenance_type: '100hr' | 'annual' | 'oil_change' | 'ad' | 'custom';
    due_at: string | number;   // Date or hobbs hours
    warning_threshold: number; // Days or hours before due
  };
}
```

**Consumers:**
- `scheduler` - Blocks scheduling past maintenance due date

---

### Events Subscribed

#### From `logbook`: `flight.created`

**Action:** 
1. Update aircraft hobbs/tach from flight total time
2. Check if any maintenance thresholds crossed

---

### Queries Provided

#### `getAircraftDetails`

```typescript
function getAircraftDetails(params: {
  aircraft_id: string;
}): Promise<Aircraft>;
```

---

#### `getAircraftByCapability`

```typescript
function getAircraftByCapability(params: {
  context_id: string;
  capabilities: {
    night_capable?: boolean;
    ifr_equipped?: boolean;
    complex?: boolean;
    high_performance?: boolean;
    tailwheel?: boolean;
  };
  available_only?: boolean;
}): Promise<Aircraft[]>;
```

---

#### `getMaintenanceStatus`

```typescript
function getMaintenanceStatus(params: {
  aircraft_id: string;
}): Promise<{
  airworthy: boolean;
  squawks: Squawk[];
  upcoming_maintenance: MaintenanceItem[];
  hours_until_100hr?: number;
  days_until_annual?: number;
}>;
```

---

## Node: Scheduler

### Events Published

#### `booking.created`

```typescript
interface BookingCreatedEvent {
  event_type: 'booking.created';
  payload: {
    booking_id: string;
    aircraft_id: string;
    pilot_id: string;
    instructor_id?: string;
    start_time: string;
    end_time: string;
    booking_type: 'flight' | 'ground' | 'maintenance' | 'other';
    context_id: string;
    lesson_id?: string;        // If this is a syllabus lesson
  };
}
```

---

#### `booking.completed`

```typescript
interface BookingCompletedEvent {
  event_type: 'booking.completed';
  payload: {
    booking_id: string;
    aircraft_id: string;
    pilot_id: string;
    instructor_id?: string;
    start_time: string;
    end_time: string;
    hobbs_start?: number;
    hobbs_end?: number;
    context_id: string;
    lesson_id?: string;
  };
}
```

**Consumers:**
- `logbook` - Creates draft flight entry

---

#### `booking.cancelled`

```typescript
interface BookingCancelledEvent {
  event_type: 'booking.cancelled';
  payload: {
    booking_id: string;
    cancelled_by: string;
    reason: 'weather' | 'student' | 'instructor' | 'aircraft' | 'other';
    description?: string;
  };
}
```

---

#### `lesson.scheduled`

```typescript
interface LessonScheduledEvent {
  event_type: 'lesson.scheduled';
  payload: {
    enrollment_id: string;
    lesson_id: string;
    lesson_name: string;
    objectives: string[];
    booking_id: string;
  };
}
```

**Consumers:**
- `logbook` - Attaches lesson info to flight draft

---

### Events Subscribed

#### From `aircraft`: `aircraft.grounded`

**Action:** Cancel or reschedule bookings for grounded aircraft.

---

#### From `aircraft`: `aircraft.returned_to_service`

**Action:** Update availability, potentially auto-fill cancelled slots.

---

#### From `syllabus`: `lesson.completed`

**Action:** Queue next lesson for scheduling.

---

#### From `syllabus`: `enrollment.created`

**Action:** Initialize lesson queue for student.

---

### Queries Provided

#### `getBookingsByAircraft`

```typescript
function getBookingsByAircraft(params: {
  aircraft_id: string;
  date_from: string;
  date_to: string;
}): Promise<Booking[]>;
```

---

#### `getBookingsByUser`

```typescript
function getBookingsByUser(params: {
  user_id: string;
  role: 'pilot' | 'instructor' | 'any';
  date_from?: string;
  date_to?: string;
}): Promise<Booking[]>;
```

---

#### `getAvailableSlots`

```typescript
function getAvailableSlots(params: {
  context_id: string;
  aircraft_id?: string;
  instructor_id?: string;
  date: string;
  duration: number;
}): Promise<TimeSlot[]>;
```

---

### Queries Required

#### From `aircraft`: `getAircraftByCapability`

Used to filter aircraft for lesson requirements.

---

#### From `aircraft`: `getMaintenanceStatus`

Used to check aircraft availability for scheduling.

---

#### From `syllabus`: `getLessonRequirements`

Used to determine what aircraft/time of day a lesson needs.

---

## Node: Syllabus

### Events Published

#### `enrollment.created`

```typescript
interface EnrollmentCreatedEvent {
  event_type: 'enrollment.created';
  payload: {
    enrollment_id: string;
    student_id: string;
    syllabus_id: string;
    syllabus_name: string;
    enrolled_by: string;
    context_id: string;
  };
}
```

**Consumers:**
- `scheduler` - Initializes lesson queue

---

#### `lesson.completed`

```typescript
interface LessonCompletedEvent {
  event_type: 'lesson.completed';
  payload: {
    enrollment_id: string;
    lesson_id: string;
    lesson_name: string;
    completed_by: string;      // CFI ID
    flight_id?: string;
    grade: 'introduced' | 'developing' | 'proficient';
    next_lesson_id?: string;
  };
}
```

**Consumers:**
- `scheduler` - Queues next lesson

---

#### `stage.completed`

```typescript
interface StageCompletedEvent {
  event_type: 'stage.completed';
  payload: {
    enrollment_id: string;
    stage_id: string;
    stage_name: string;
    completed_by: string;
    stage_check_id?: string;
    next_stage_id?: string;
  };
}
```

---

#### `enrollment.completed`

```typescript
interface EnrollmentCompletedEvent {
  event_type: 'enrollment.completed';
  payload: {
    enrollment_id: string;
    student_id: string;
    syllabus_id: string;
    completed_at: string;
    certificate_type?: string;
  };
}
```

---

### Events Subscribed

#### From `logbook`: `flight.created`

**Action:** Check if flight satisfies any pending lesson requirements.

---

#### From `logbook`: `flight.linked`

**Action:** If dual flight, check if lesson completed for student.

---

### Queries Provided

#### `getStudentEnrollments`

```typescript
function getStudentEnrollments(params: {
  student_id: string;
  active_only?: boolean;
}): Promise<Enrollment[]>;
```

---

#### `getLessonRequirements`

```typescript
function getLessonRequirements(params: {
  lesson_id: string;
}): Promise<{
  duration: number;
  aircraft_requirements: AircraftRequirements;
  time_of_day: 'any' | 'day' | 'night';
  weather_requirements: 'vfr' | 'mvfr' | 'ifr' | 'any';
  cfi_required: boolean;
  prerequisites: string[];
}>;
```

---

#### `getNextLesson`

```typescript
function getNextLesson(params: {
  enrollment_id: string;
}): Promise<Lesson | null>;
```

---

#### `getSyllabusProgress`

```typescript
function getSyllabusProgress(params: {
  enrollment_id: string;
}): Promise<{
  total_lessons: number;
  completed_lessons: number;
  current_stage: string;
  estimated_hours_remaining: number;
}>;
```

---

## Contract Validation

Each node must implement a contract validation test:

```typescript
// tests/contract.test.ts

import { validateContract } from '@aeroedge/contract-validator';
import contract from '../_ecosystem/contracts/logbook-api.yaml';
import * as handlers from '../src/events/handlers';
import * as emitters from '../src/events/emitters';
import * as queries from '../src/queries';

describe('Contract Compliance', () => {
  it('implements all required event handlers', () => {
    const required = contract.events.subscribed.map(e => e.name);
    const implemented = Object.keys(handlers);
    expect(implemented).toEqual(expect.arrayContaining(required));
  });
  
  it('implements all required event emitters', () => {
    const required = contract.events.published.map(e => e.name);
    const implemented = Object.keys(emitters);
    expect(implemented).toEqual(expect.arrayContaining(required));
  });
  
  it('implements all required queries', () => {
    const required = contract.queries.provided.map(q => q.name);
    const implemented = Object.keys(queries);
    expect(implemented).toEqual(expect.arrayContaining(required));
  });
  
  it('event payloads match schema', async () => {
    for (const event of contract.events.published) {
      const emitter = emitters[event.name];
      // Generate test payload and validate against schema
      const payload = await emitter.generateTestPayload();
      expect(validateContract(event.schema, payload)).toBe(true);
    }
  });
});
```

---

## Version Compatibility

When contracts change:

1. **Non-breaking changes** (new optional fields): Minor version bump
2. **Breaking changes** (required fields, removed events): Major version bump
3. **All nodes must update together** for major changes

```yaml
# Contract versioning
contract_version: "1.2.0"

# Compatibility matrix
compatible_with:
  logbook: ">=1.0.0"
  aircraft: ">=1.1.0"
  scheduler: ">=1.0.0"
  syllabus: ">=1.2.0"
```

---

## Summary

This contract system ensures:

1. **Loose Coupling** - Nodes communicate via events, not direct calls
2. **Clear Dependencies** - Each node knows what it needs from others
3. **Testable Integration** - Contract tests catch incompatibilities early
4. **Offline-First** - Events queue and sync like any CRDT data
5. **Acquirer Clarity** - Integration points are documented and validated
