/**
 * AeroEdge Shared Types
 * Synced to all nodes via push-to-nodes.sh
 */

// ============================================================
// Core Entities
// ============================================================

export interface User {
  id: string;
  email: string | null;
  display_name: string;
  phone: string | null;
  avatar_url: string | null;

  pilot_certificate: PilotCertificate | null;
  medical_certificate: MedicalCertificate | null;
  cfi_certificate: CFICertificate | null;

  settings: UserSettings;

  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface PilotCertificate {
  type: 'student' | 'sport' | 'recreational' | 'private' | 'commercial' | 'atp';
  number: string;
  issued: string;
  ratings: string[];
}

export interface MedicalCertificate {
  class: 1 | 2 | 3;
  issued: string;
  expires: string;
}

export interface CFICertificate {
  number: string;
  expires: string;
  ratings: ('cfi' | 'cfii' | 'mei' | 'agi' | 'igi')[];
}

export interface UserSettings {
  timezone?: string;
  units?: 'imperial' | 'metric';
  theme?: 'light' | 'dark' | 'system';
  notifications?: NotificationSettings;
}

export interface NotificationSettings {
  email: boolean;
  sms: boolean;
  push: boolean;
}

// ============================================================
// Contexts
// ============================================================

export interface Context {
  id: string;
  type: 'personal' | 'club' | 'school' | 'fbo';
  name: string;
  description: string | null;
  settings: ContextSettings;

  sync_method: 'local' | 'cloud_folder' | 'hub' | 'managed' | null;
  sync_config: SyncConfig | null;

  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface ContextSettings {
  timezone?: string;
  currency?: string;
  booking_rules?: BookingRules;
  rate_structure?: RateStructure;
}

export interface BookingRules {
  min_advance_hours?: number;
  max_advance_days?: number;
  cancellation_hours?: number;
  auto_release_hours?: number;
}

export interface RateStructure {
  type: 'flat' | 'tiered' | 'membership';
  rates: Record<string, number>;
}

export interface SyncConfig {
  // Cloud folder sync
  folder_path?: string;
  provider?: 'dropbox' | 'gdrive' | 'icloud' | 'onedrive';

  // Hub sync
  hub_url?: string;
  hub_token?: string;

  // Managed sync
  managed_instance_id?: string;
}

export type ContextRole = 'owner' | 'admin' | 'instructor' | 'member' | 'student' | 'maintenance';

export interface ContextMember {
  id: string;
  context_id: string;
  user_id: string;
  role: ContextRole;
  permissions: Permissions | null;
  joined_at: string;
  invited_by: string | null;
}

export interface Permissions {
  can_book?: boolean;
  can_dispatch?: boolean;
  can_view_financials?: boolean;
  can_manage_aircraft?: boolean;
  can_manage_users?: boolean;
}

// ============================================================
// Aircraft
// ============================================================

export interface Aircraft {
  id: string;
  context_id: string;
  registration: string;
  make: string;
  model: string;
  year: number | null;
  serial_number: string | null;
  category: AircraftCategory;
  class: AircraftClass;
  equipment: string[];
  hobbs: number;
  tach: number;
  total_time: number;
  rates: AircraftRates;
  status: AircraftStatus;
  created_at: string;
  updated_at: string;
}

export type AircraftCategory = 'airplane' | 'rotorcraft' | 'glider' | 'lighter_than_air' | 'powered_lift' | 'powered_parachute' | 'weight_shift_control';

export type AircraftClass = 'single_engine_land' | 'single_engine_sea' | 'multi_engine_land' | 'multi_engine_sea' | 'helicopter' | 'gyroplane';

export type AircraftStatus = 'available' | 'maintenance' | 'grounded' | 'inactive';

export interface AircraftRates {
  wet?: number;
  dry?: number;
  block?: number;
  instruction?: number;
}

// ============================================================
// Flights
// ============================================================

export interface Flight {
  id: string;
  pilot_id: string;
  aircraft_id: string;
  date: string;

  // Times (decimal hours)
  total_time: number;
  pic: number;
  sic: number;
  dual_received: number;
  dual_given: number;
  solo: number;
  night: number;
  instrument_actual: number;
  instrument_simulated: number;
  cross_country: number;

  // Landings
  landings_day: number;
  landings_night: number;

  // Route
  route: string | null;

  // Approaches
  approaches: Approach[];
  holds: number;

  // Instructor
  instructor_id: string | null;

  // Training
  lesson_id: string | null;

  // Remarks
  remarks: string | null;

  // Source
  source: 'manual' | 'foreflight' | 'logten' | 'myflightbook' | 'import';
  source_ref: string | null;

  // Contexts
  context_ids: string[];

  created_at: string;
  updated_at: string;
}

export interface Approach {
  type: 'ILS' | 'LOC' | 'VOR' | 'NDB' | 'GPS' | 'RNAV' | 'LDA' | 'SDF' | 'PAR' | 'ASR' | 'VISUAL';
  airport: string;
  runway?: string;
  circle_to_land?: boolean;
}

// ============================================================
// Bookings
// ============================================================

export interface Booking {
  id: string;
  context_id: string;
  aircraft_id: string;
  pilot_id: string;
  instructor_id: string | null;
  start_time: string;
  end_time: string;
  booking_type: BookingType;
  lesson_id: string | null;
  status: BookingStatus;
  notes: string | null;
  dispatch_info: DispatchInfo | null;
  created_at: string;
  updated_at: string;
  created_by: string;
}

export type BookingType = 'flight' | 'ground' | 'maintenance' | 'other';

export type BookingStatus = 'pending' | 'confirmed' | 'checked_out' | 'completed' | 'cancelled' | 'no_show';

export interface DispatchInfo {
  checked_out_at?: string;
  checked_out_by?: string;
  hobbs_out?: number;
  tach_out?: number;
  fuel_out?: number;
  checked_in_at?: string;
  checked_in_by?: string;
  hobbs_in?: number;
  tach_in?: number;
  fuel_in?: number;
  squawks?: string[];
}

// ============================================================
// Event Bus
// ============================================================

export interface Event<T = unknown> {
  id: string;
  event_type: string;
  payload: T;
  source_node: string;
  context_id: string | null;
  created_at: string;
  processed_at: string | null;
  idempotency_key: string | null;
}

// Event types (extend in node-specific files)
export type EventType =
  | 'flight.created'
  | 'flight.updated'
  | 'flight.linked'
  | 'aircraft.times_updated'
  | 'aircraft.grounded'
  | 'aircraft.returned_to_service'
  | 'booking.created'
  | 'booking.completed'
  | 'booking.cancelled'
  | 'enrollment.created'
  | 'lesson.completed'
  | 'lesson.scheduled';

// ============================================================
// Migration / Import
// ============================================================

export interface ImportJob {
  id: string;
  user_id: string;
  context_id: string | null;
  source: string;
  status: ImportStatus;
  progress: ImportProgress | null;
  analysis: ImportAnalysis | null;
  result: ImportResult | null;
  validation: ValidationResult | null;
  error: string | null;
  started_at: string;
  completed_at: string | null;
}

export type ImportStatus =
  | 'pending'
  | 'analyzing'
  | 'analyzed'
  | 'needs_review'
  | 'importing'
  | 'validating'
  | 'complete'
  | 'failed';

export interface ImportProgress {
  stage: string;
  percent: number;
  current_record?: number;
  total_records?: number;
}

export interface ImportAnalysis {
  source: string;
  detected_version?: string;
  counts: Record<string, number>;
  issues: ImportIssue[];
  warnings: ImportWarning[];
}

export interface ImportIssue {
  type: string;
  severity: 'error' | 'warning';
  message: string;
  row?: number;
  field?: string;
  suggestion?: string;
  data?: unknown;
}

export interface ImportWarning {
  type: string;
  message: string;
  suggestion?: string;
}

export interface ImportResult {
  success: boolean;
  records: Record<string, number>;
  errors?: string[];
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  type: string;
  message: string;
  data?: unknown;
}

export interface ValidationWarning {
  type: string;
  message: string;
  suggestion?: string;
}

// ============================================================
// Utility Types
// ============================================================

export type ISO8601 = string; // YYYY-MM-DDTHH:mm:ss.sssZ

export interface Pagination {
  limit: number;
  offset: number;
  total?: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  pagination?: Pagination;
}

// ============================================================
// Currency Tracking
// ============================================================

export interface CurrencyStatus {
  pilot_id: string;
  calculated_at: string;

  // Day currency (14 CFR 61.57)
  day_current: boolean;
  day_expires: string | null;
  day_landings_needed: number;

  // Night currency (14 CFR 61.57)
  night_current: boolean;
  night_expires: string | null;
  night_landings_needed: number;

  // Instrument currency (14 CFR 61.57)
  instrument_current: boolean;
  instrument_expires: string | null;
  approaches_needed: number;
  holds_needed: number;

  // Flight review (14 CFR 61.56)
  flight_review_current: boolean;
  flight_review_expires: string | null;

  // Medical
  medical_current: boolean;
  medical_expires: string | null;

  // Warnings
  warnings: CurrencyWarning[];
}

export interface CurrencyWarning {
  type: 'day' | 'night' | 'instrument' | 'flight_review' | 'medical';
  message: string;
  expires_in_days: number;
}
