// ============================================================
// CrimeLink — TypeScript Type Definitions
// ============================================================

export interface User {
  id: string;
  username: string;
  email: string;
  full_name: string;
  badge_number?: string;
  department?: string;
  is_active: boolean;
  is_locked: boolean;
  roles: string[];
  permissions: string[];
  last_login?: string;
  created_at: string;
  updated_at: string;
}

export interface AuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user_id: string;
  username: string;
  full_name: string;
  roles: string[];
  permissions: string[];
}

// ── Cases ────────────────────────────────────────────────────────────────────
export type CaseStatus = 'DRAFT' | 'OPEN' | 'UNDER_INVESTIGATION' | 'ON_HOLD' | 'SOLVED' | 'CLOSED' | 'ARCHIVED';
export type CasePriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface AssignedOfficer {
  user_id: string;
  username: string;
  full_name: string;
  role: string;
  assigned_at: string;
}

export interface Case {
  id: string;
  case_number: string;
  title: string;
  case_type: string;
  description?: string;
  location?: string;
  incident_date?: string;
  status: CaseStatus;
  priority: CasePriority;
  created_by: string;
  created_at: string;
  updated_at: string;
  closed_at?: string;
  persons_count: number;
  evidence_count: number;
  assigned_officers: AssignedOfficer[];
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

// ── Persons ──────────────────────────────────────────────────────────────────
export type PersonRole = 'SUSPECT' | 'VICTIM' | 'WITNESS' | 'COMPLAINANT' | 'OFFICER' | 'OTHER';

export interface PersonCaseHistory {
  case_id: string;
  case_number: string;
  title: string;
  case_type: string;
  status: string;
  role: string;
  added_at: string;
}

export interface Person {
  id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  alias?: string;
  date_of_birth?: string;
  gender?: string;
  nationality?: string;
  national_id?: string;
  address?: string;
  phone?: string;
  email?: string;
  occupation?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  case_history: PersonCaseHistory[];
}

export interface CasePersonResponse {
  id: string;
  case_id: string;
  person_id: string;
  person_name: string;
  role: string;
  notes?: string;
  added_at: string;
}

// ── Evidence ─────────────────────────────────────────────────────────────────
export interface Evidence {
  id: string;
  case_id: string;
  evidence_number: string;
  evidence_type: string;
  description?: string;
  original_filename: string;
  stored_filename: string;
  mime_type: string;
  file_size: number;
  sha256_hash: string;
  status: string;
  current_custodian_id?: string;
  current_custodian_name?: string;
  uploaded_by_id: string;
  uploaded_by_name: string;
  uploaded_at: string;
  updated_at: string;
}

export interface CustodyRecord {
  id: string;
  evidence_id: string;
  previous_custodian_name?: string;
  new_custodian_name?: string;
  transferred_by_name: string;
  action: string;
  remarks?: string;
  sha256_at_transfer?: string;
  transferred_at: string;
}

export interface IntegrityResult {
  evidence_id: string;
  evidence_number: string;
  is_intact: boolean;
  stored_hash: string;
  current_hash: string;
  message: string;
  checked_at: string;
}

// ── Investigation Timeline ────────────────────────────────────────────────────
export interface InvestigationEvent {
  id: string;
  case_id: string;
  event_type: string;
  title: string;
  description?: string;
  occurred_at: string;
  created_by?: string;
  created_by_name?: string;
  related_person_id?: string;
  related_person_name?: string;
  related_evidence_id?: string;
  related_evidence_number?: string;
}

// ── Relationships ─────────────────────────────────────────────────────────────
export interface GraphNode {
  id: string;
  type: string;
  label: string;
  data: Record<string, unknown>;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  strength: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface Relationship {
  id: string;
  source_type: string;
  source_id: string;
  source_label: string;
  target_type: string;
  target_id: string;
  target_label: string;
  relationship_type: string;
  strength: string;
  notes?: string;
  created_at: string;
}

// ── Prioritization ────────────────────────────────────────────────────────────
export interface ScoreBreakdown {
  previous_cases: number;
  case_type_similarity: number;
  relationship_strength: number;
  evidence_association: number;
  geographic_relevance: number;
}

export interface SuspectScore {
  id: string;
  case_id: string;
  person_id: string;
  person_name: string;
  score: number;
  score_breakdown: ScoreBreakdown;
  contributing_factors: string[];
  data_sources: Record<string, unknown>;
  engine_version: string;
  generated_at: string;
  is_latest: boolean;
}

export interface PrioritizationResult {
  case_id: string;
  case_number: string;
  candidates: SuspectScore[];
  total_candidates: number;
  generated_at: string;
  engine_version: string;
  disclaimer: string;
}

// ── Dashboard ────────────────────────────────────────────────────────────────
export interface DashboardStats {
  cases: {
    total: number;
    open: number;
    under_investigation: number;
    on_hold: number;
    solved: number;
    closed: number;
    archived: number;
    high_priority: number;
    critical_priority: number;
  };
  persons: {
    total: number;
    suspects: number;
    victims: number;
    witnesses: number;
  };
  evidence: {
    total: number;
    images: number;
    videos: number;
    documents: number;
    audio: number;
    active: number;
    archived: number;
  };
  recent_security_events: number;
  total_users: number;
}

export interface ChartDataPoint {
  name: string;
  value: number;
  color: string;
}

export interface ChartData {
  cases_by_status: ChartDataPoint[];
  cases_by_type: ChartDataPoint[];
  cases_by_priority: ChartDataPoint[];
  evidence_by_type: ChartDataPoint[];
  activity_last_7_days: Array<{ date: string; events: number }>;
}

// ── Audit ─────────────────────────────────────────────────────────────────────
export interface AuditLog {
  id: string;
  user_id?: string;
  username?: string;
  action: string;
  resource_type?: string;
  resource_id?: string;
  result: string;
  ip_address?: string;
  user_agent?: string;
  details?: Record<string, unknown>;
  created_at: string;
}

export interface SecurityEvent {
  id: string;
  event_type: string;
  severity: string;
  user_id?: string;
  username?: string;
  ip_address?: string;
  description: string;
  details?: Record<string, unknown>;
  resolved: boolean;
  created_at: string;
}

// ── API Error ────────────────────────────────────────────────────────────────
export interface ApiError {
  detail: string | Array<{ msg: string; loc: string[] }>;
}

// ── Case Wizard ───────────────────────────────────────────────────────────────
export interface WizardPersonEntry {
  first_name: string;
  last_name: string;
  alias?: string;
  date_of_birth?: string;
  gender?: string;
  nationality?: string;
  address?: string;
  phone?: string;
  occupation?: string;
  notes?: string;
  role: string;
  existing_person_id?: string;
}

export interface WizardRelationshipEntry {
  source_type: string;
  source_id: string;
  target_type: string;
  target_id: string;
  relationship_type: string;
  strength: string;
  notes?: string;
}

export interface WizardEventEntry {
  event_type: string;
  title: string;
  description?: string;
  occurred_at?: string;
}

export interface CaseWizardPayload {
  title: string;
  case_type: string;
  description?: string;
  location?: string;
  incident_date?: string;
  priority: string;
  status: string;
  persons: WizardPersonEntry[];
  relationships: WizardRelationshipEntry[];
  events: WizardEventEntry[];
}

// ── Case Completion ───────────────────────────────────────────────────────────
export interface CaseCompletion {
  case_id: string;
  percentage: number;
  has_description: boolean;
  has_location: boolean;
  has_incident_date: boolean;
  persons_count: number;
  evidence_count: number;
  relationships_count: number;
  events_count: number;
}

// ── Bulk Import ───────────────────────────────────────────────────────────────
export interface ImportRowError {
  row: number;
  field?: string;
  message: string;
}

export interface ImportSheetPreview {
  sheet: string;
  valid_rows: number;
  invalid_rows: number;
  duplicate_rows: number;
  errors: ImportRowError[];
}

export interface ImportPreviewResponse {
  filename: string;
  file_size: number;
  sheets_found: string[];
  cases: ImportSheetPreview;
  persons: ImportSheetPreview;
  relationships?: ImportSheetPreview;
  events?: ImportSheetPreview;
  can_import: boolean;
  total_valid: number;
  total_invalid: number;
}

export interface ImportConfirmResponse {
  cases_created: number;
  persons_created: number;
  persons_linked: number;
  relationships_created: number;
  events_created: number;
  errors: string[];
}

// ── Bulk Evidence Upload ──────────────────────────────────────────────────────
export interface BulkUploadFileResult {
  filename: string;
  status: 'success' | 'failed' | 'duplicate';
  message?: string;
  evidence_number?: string;
  evidence_id?: string;
  evidence_type?: string;
  file_size?: number;
  sha256?: string;
  mime_type?: string;
}

export interface BulkUploadResponse {
  case_id: string;
  total_files: number;
  uploaded: number;
  failed: number;
  results: BulkUploadFileResult[];
}
