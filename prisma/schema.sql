-- ==============================================================================
-- Smart City SOS Dashboard - Full PostgreSQL Database Schema
-- Generated for Cambodia Smart City Emergency Response & SOS System
-- ==============================================================================

-- ─── ENUMS DEFINITIONS ────────────────────────────────────────────────────────

CREATE TYPE user_role AS ENUM (
  'ADMIN',
  'OPERATOR',
  'RESCUE_AGENT',
  'CITIZEN'
);

CREATE TYPE user_status AS ENUM (
  'ACTIVE',
  'BLOCKED',
  'PENDING_VERIFICATION'
);

CREATE TYPE emergency_type AS ENUM (
  'FIRE',
  'POLICE',
  'MEDICAL'
);

CREATE TYPE sos_status AS ENUM (
  'PENDING',
  'EN_ROUTE',
  'RESOLVED',
  'SPAM'
);

CREATE TYPE agent_status AS ENUM (
  'AVAILABLE',
  'ON_DUTY',
  'OFFLINE'
);

CREATE TYPE org_status AS ENUM (
  'ACTIVE',
  'INACTIVE'
);

CREATE TYPE access_level AS ENUM (
  'HIGH',
  'MEDIUM',
  'STANDARD'
);

CREATE TYPE broadcast_level AS ENUM (
  'CRITICAL',
  'WARNING',
  'INFO'
);

CREATE TYPE broadcast_type AS ENUM (
  'FLOOD',
  'STORM',
  'FIRE',
  'TRAFFIC',
  'SECURITY',
  'MEDICAL_CRISIS',
  'GENERAL_ANNOUNCEMENT'
);

CREATE TYPE broadcast_status AS ENUM (
  'ACTIVE',
  'EXPIRED'
);

CREATE TYPE audience_type AS ENUM (
  'ALL_CITIZENS',
  'RESCUE_AGENTS'
);

CREATE TYPE officer_status AS ENUM (
  'ON_DUTY',
  'OFF_DUTY',
  'RESPONDING'
);

CREATE TYPE shift_type AS ENUM (
  'DAY',
  'NIGHT'
);

CREATE TYPE permission_action AS ENUM (
  'VIEW',
  'DISPATCH',
  'EDIT',
  'DELETE'
);

CREATE TYPE news_status AS ENUM (
  'DRAFT',
  'PUBLISHED',
  'ARCHIVED'
);

CREATE TYPE report_type AS ENUM (
  'SUMMARY',
  'DETAIL',
  'EXCEPTION'
);

CREATE TYPE report_format AS ENUM (
  'PDF',
  'EXCEL'
);

-- ─── TABLES DEFINITIONS ───────────────────────────────────────────────────────

-- 1. Organizations Table (Parent Emergency Authorities)
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  type emergency_type NOT NULL,
  hotline VARCHAR(50) NOT NULL,
  head VARCHAR(150) NOT NULL,
  address TEXT NOT NULL,
  status org_status DEFAULT 'ACTIVE',
  access_level access_level DEFAULT 'STANDARD',
  gps_lat DOUBLE PRECISION,
  gps_lng DOUBLE PRECISION,
  active_vehicles_count INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Users Table (System Users & Citizens)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name VARCHAR(150) NOT NULL,
  badge_id VARCHAR(50) DEFAULT 'N/A',
  username VARCHAR(60) UNIQUE NOT NULL,
  email VARCHAR(120) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  role user_role DEFAULT 'CITIZEN',
  status user_status DEFAULT 'ACTIVE',
  mfa_enabled BOOLEAN DEFAULT FALSE,
  failed_login_attempts INT DEFAULT 0,
  last_password_change TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Agents Table (Emergency Response Personnel / First Responders)
CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(150) NOT NULL,
  role VARCHAR(100) NOT NULL,
  type emergency_type NOT NULL,
  phone VARCHAR(30) NOT NULL,
  status agent_status DEFAULT 'AVAILABLE',
  vehicle_no VARCHAR(50),
  vehicle_type VARCHAR(100),
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Officers Table (Police Officers / Health Officers / Fire Command Officers)
CREATE TABLE officers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  name_kh VARCHAR(150) NOT NULL,
  name_en VARCHAR(150) NOT NULL,
  title VARCHAR(100) NOT NULL,
  work_phone VARCHAR(50) NOT NULL,
  personal_phone VARCHAR(50),
  photo_url TEXT,
  languages TEXT[] DEFAULT ARRAY['KH', 'EN'],
  status officer_status DEFAULT 'ON_DUTY',
  shift shift_type DEFAULT 'DAY',
  assigned_sos UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Stations Table (Emergency Stations & Referral Hospitals)
CREATE TABLE stations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  type emergency_type NOT NULL,
  province VARCHAR(100) NOT NULL,
  district VARCHAR(100) NOT NULL,
  address TEXT NOT NULL,
  hotline VARCHAR(50) NOT NULL,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  capacity INT DEFAULT 0,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  status org_status DEFAULT 'ACTIVE',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. SOS Alerts Table (Citizen Emergency Incidents)
CREATE TABLE sos_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  citizen_name VARCHAR(150) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  type emergency_type NOT NULL,
  district VARCHAR(100) NOT NULL,
  province VARCHAR(100) DEFAULT 'Phnom Penh',
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  report_text TEXT NOT NULL,
  has_media BOOLEAN DEFAULT FALSE,
  media_urls TEXT[],
  status sos_status DEFAULT 'PENDING',
  assigned_agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  assigned_agent_name VARCHAR(150),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP WITH TIME ZONE
);

-- 7. Broadcasts Table (Emergency Alerts & Public Warnings)
CREATE TABLE broadcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  level broadcast_level DEFAULT 'WARNING',
  type broadcast_type DEFAULT 'SECURITY',
  target_audience audience_type DEFAULT 'ALL_CITIZENS',
  status broadcast_status DEFAULT 'ACTIVE',
  target_provinces TEXT[],
  reach_count INT DEFAULT 0,
  expires_at TIMESTAMP WITH TIME ZONE,
  sent_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  sent_by_name VARCHAR(150),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. News Table (Emergency News & Public Guidance Articles)
CREATE TABLE news (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  summary TEXT,
  content TEXT NOT NULL,
  cover_url TEXT,
  category VARCHAR(100) DEFAULT 'General',
  status news_status DEFAULT 'PUBLISHED',
  author_id UUID REFERENCES users(id) ON DELETE SET NULL,
  published_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. System Settings Table (Global App Configs & Integration Credentials)
CREATE TABLE system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(100) UNIQUE NOT NULL,
  value TEXT NOT NULL,
  description TEXT,
  is_encrypted BOOLEAN DEFAULT FALSE,
  updated_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 10. Role Permissions Table (Dynamic Access Control Matrix)
CREATE TABLE role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role user_role NOT NULL,
  action permission_action NOT NULL,
  is_granted BOOLEAN DEFAULT TRUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_role_action UNIQUE (role, action)
);

-- 11. Report Exports Table (Generated Analytics & Download History)
CREATE TABLE report_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  report_type report_type DEFAULT 'SUMMARY',
  format report_format DEFAULT 'PDF',
  file_url TEXT,
  file_size VARCHAR(50),
  record_count INT DEFAULT 0,
  resolved_count INT DEFAULT 0,
  delayed_count INT DEFAULT 0,
  created_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 12. Audit Logs Table (System Security & Action Auditing)
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  time VARCHAR(50) NOT NULL,
  event TEXT NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  user_name VARCHAR(150),
  ip_address VARCHAR(45),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 13. Refresh Tokens Table (JWT Authentication Sessions)
CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token VARCHAR(500) UNIQUE NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ─── INDEXES ──────────────────────────────────────────────────────────────────

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_sos_alerts_status ON sos_alerts(status);
CREATE INDEX idx_sos_alerts_type ON sos_alerts(type);
CREATE INDEX idx_sos_alerts_created_at ON sos_alerts(created_at);
CREATE INDEX idx_agents_status ON agents(status);
CREATE INDEX idx_broadcasts_status ON broadcasts(status);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
