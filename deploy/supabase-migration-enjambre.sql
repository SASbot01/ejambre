-- ============================================================
-- ENJAMBRE BLACKWOLF — Migración completa a Supabase
-- Ejecutar en: Supabase Dashboard → SQL Editor → New Query
-- ============================================================
-- Este script crea:
--   1. Tablas de Enjambre (antes en PostgreSQL local)
--   2. Tablas CEO Mind (faltantes)
--   3. Tablas Formación & Comunidad (faltantes)
-- ============================================================


-- ============================================================
-- PARTE 1: TABLAS ENJAMBRE (migradas de PostgreSQL local)
-- ============================================================

-- 1a. Eventos del Enjambre (pizarra compartida persistida)
CREATE TABLE IF NOT EXISTS events (
    id BIGSERIAL PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,
    source_agent VARCHAR(50) NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}',
    correlation_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_source ON events(source_agent);
CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_correlation ON events(correlation_id);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on events" ON events
  FOR ALL USING (true) WITH CHECK (true);


-- 1b. Leads de infoproductos
CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(255),
    email VARCHAR(255) NOT NULL,
    telefono VARCHAR(50),
    producto VARCHAR(255),
    landing_source VARCHAR(255),
    ip_address INET,
    utm_source VARCHAR(100),
    utm_medium VARCHAR(100),
    utm_campaign VARCHAR(100),
    status VARCHAR(50) NOT NULL DEFAULT 'nuevo',
    assigned_setter VARCHAR(255),
    fraud_score DECIMAL(5,2) DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at DESC);

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on leads" ON leads
  FOR ALL USING (true) WITH CHECK (true);


-- 1c. Decisiones del Cerebro (Claude)
CREATE TABLE IF NOT EXISTS brain_decisions (
    id BIGSERIAL PRIMARY KEY,
    trigger_event_id BIGINT REFERENCES events(id),
    decision_type VARCHAR(100) NOT NULL,
    agents_involved VARCHAR(255)[] NOT NULL DEFAULT '{}',
    reasoning TEXT,
    actions_taken JSONB NOT NULL DEFAULT '[]',
    confidence DECIMAL(3,2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE brain_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on brain_decisions" ON brain_decisions
  FOR ALL USING (true) WITH CHECK (true);


-- 1d. Estado de agentes
CREATE TABLE IF NOT EXISTS agent_status (
    agent_name VARCHAR(50) PRIMARY KEY,
    status VARCHAR(20) NOT NULL DEFAULT 'online',
    last_heartbeat TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metrics JSONB DEFAULT '{}',
    config JSONB DEFAULT '{}'
);

INSERT INTO agent_status (agent_name, status) VALUES
    ('ciber', 'online'),
    ('crm', 'online'),
    ('ops', 'online'),
    ('forms', 'online')
ON CONFLICT (agent_name) DO NOTHING;

ALTER TABLE agent_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on agent_status" ON agent_status
  FOR ALL USING (true) WITH CHECK (true);


-- 1e. Configuración de setters para round-robin
CREATE TABLE IF NOT EXISTS setters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    activo BOOLEAN DEFAULT true,
    leads_asignados_hoy INT DEFAULT 0,
    ultimo_lead_asignado TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE setters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on setters" ON setters
  FOR ALL USING (true) WITH CHECK (true);


-- 1f. Dev Agent: Tickets de desarrollo
CREATE TABLE IF NOT EXISTS dev_tickets (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    project VARCHAR(100) DEFAULT 'general',
    status VARCHAR(50) DEFAULT 'pending',
    result TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE dev_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on dev_tickets" ON dev_tickets
  FOR ALL USING (true) WITH CHECK (true);


-- 1g. Dev Agent: Sesiones autónomas
CREATE TABLE IF NOT EXISTS dev_sessions (
    id BIGSERIAL PRIMARY KEY,
    duration_hours INT DEFAULT 2,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE dev_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on dev_sessions" ON dev_sessions
  FOR ALL USING (true) WITH CHECK (true);


-- 1h. Secuencias de follow-up automático
CREATE TABLE IF NOT EXISTS sequences (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    trigger_status VARCHAR(50) DEFAULT 'nuevo',
    product_filter VARCHAR(100),
    steps JSONB NOT NULL DEFAULT '[]',
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on sequences" ON sequences
  FOR ALL USING (true) WITH CHECK (true);


CREATE TABLE IF NOT EXISTS sequence_enrollments (
    id BIGSERIAL PRIMARY KEY,
    lead_id UUID REFERENCES leads(id),
    sequence_id BIGINT REFERENCES sequences(id),
    current_step INT DEFAULT 0,
    status VARCHAR(50) DEFAULT 'active',
    next_fire_at TIMESTAMPTZ,
    last_response_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_status ON sequence_enrollments(status);
CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_next_fire ON sequence_enrollments(next_fire_at);

ALTER TABLE sequence_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on sequence_enrollments" ON sequence_enrollments
  FOR ALL USING (true) WITH CHECK (true);


-- 1i. Configuración de formularios por landing
CREATE TABLE IF NOT EXISTS form_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    landing_slug VARCHAR(100) NOT NULL UNIQUE,
    producto VARCHAR(255) NOT NULL,
    webhook_secret VARCHAR(255) NOT NULL,
    fields JSONB NOT NULL DEFAULT '["nombre","email","telefono"]',
    auto_assign BOOLEAN DEFAULT true,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE form_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on form_configs" ON form_configs
  FOR ALL USING (true) WITH CHECK (true);


-- ============================================================
-- PARTE 2: TABLAS CEO MIND (faltantes)
-- ============================================================

-- 2a. CEO Meetings
CREATE TABLE IF NOT EXISTS ceo_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id),
  title TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  duration_minutes INTEGER,
  participants TEXT,
  summary TEXT,
  action_items TEXT,
  key_topics TEXT,
  sentiment TEXT CHECK (sentiment IN ('positive', 'negative', 'neutral', 'mixed')),
  transcript_url TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled')),
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'fireflies', 'google_calendar')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ceo_meetings_client ON ceo_meetings(client_id);
CREATE INDEX IF NOT EXISTS idx_ceo_meetings_date ON ceo_meetings(client_id, date DESC);

ALTER TABLE ceo_meetings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon" ON ceo_meetings FOR ALL USING (true) WITH CHECK (true);


-- 2b. CEO Projects
CREATE TABLE IF NOT EXISTS ceo_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id),
  name TEXT NOT NULL,
  description TEXT,
  owner TEXT,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'idea' CHECK (status IN ('idea', 'planned', 'in_progress', 'paused', 'completed')),
  start_date DATE,
  end_date DATE,
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  tags TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ceo_projects_client ON ceo_projects(client_id);
CREATE INDEX IF NOT EXISTS idx_ceo_projects_status ON ceo_projects(client_id, status);

ALTER TABLE ceo_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon" ON ceo_projects FOR ALL USING (true) WITH CHECK (true);


-- 2c. CEO Ideas
CREATE TABLE IF NOT EXISTS ceo_ideas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id),
  title TEXT NOT NULL,
  description TEXT,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'meeting', 'ai_suggestion')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewing', 'approved', 'discarded')),
  meeting_id UUID REFERENCES ceo_meetings(id) ON DELETE SET NULL,
  project_id UUID REFERENCES ceo_projects(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ceo_ideas_client ON ceo_ideas(client_id);
CREATE INDEX IF NOT EXISTS idx_ceo_ideas_status ON ceo_ideas(client_id, status);

ALTER TABLE ceo_ideas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon" ON ceo_ideas FOR ALL USING (true) WITH CHECK (true);


-- 2d. CEO Daily Digests
CREATE TABLE IF NOT EXISTS ceo_daily_digests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id),
  date DATE NOT NULL,
  summary TEXT,
  key_metrics TEXT,
  decisions_needed TEXT,
  highlights TEXT,
  alerts TEXT,
  generated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (client_id, date)
);

CREATE INDEX IF NOT EXISTS idx_ceo_daily_digests_date ON ceo_daily_digests(client_id, date DESC);

ALTER TABLE ceo_daily_digests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon" ON ceo_daily_digests FOR ALL USING (true) WITH CHECK (true);


-- 2e. CEO Weekly Digests
CREATE TABLE IF NOT EXISTS ceo_weekly_digests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id),
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  numbers_summary TEXT,
  executive_summary TEXT,
  decisions_taken TEXT,
  next_steps TEXT,
  alerts TEXT,
  generated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (client_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_ceo_weekly_digests_week ON ceo_weekly_digests(client_id, week_start DESC);

ALTER TABLE ceo_weekly_digests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon" ON ceo_weekly_digests FOR ALL USING (true) WITH CHECK (true);


-- 2f. CEO Team Notes
CREATE TABLE IF NOT EXISTS ceo_team_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id),
  member_id UUID NOT NULL,
  note TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (client_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_ceo_team_notes_member ON ceo_team_notes(client_id, member_id);

ALTER TABLE ceo_team_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon" ON ceo_team_notes FOR ALL USING (true) WITH CHECK (true);


-- 2g. CEO Integrations
CREATE TABLE IF NOT EXISTS ceo_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id),
  service TEXT NOT NULL CHECK (service IN ('fireflies', 'google_calendar', 'google_drive')),
  api_key TEXT,
  config JSONB DEFAULT '{}'::JSONB,
  enabled BOOLEAN DEFAULT false,
  last_sync TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (client_id, service)
);

CREATE INDEX IF NOT EXISTS idx_ceo_integrations_service ON ceo_integrations(client_id, service);

ALTER TABLE ceo_integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon" ON ceo_integrations FOR ALL USING (true) WITH CHECK (true);


-- ============================================================
-- PARTE 3: TABLAS FORMACIÓN & COMUNIDAD (faltantes)
-- ============================================================

-- 3a. Cursos de formación
CREATE TABLE IF NOT EXISTS formacion_cursos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    thumbnail_url TEXT,
    category VARCHAR(50) DEFAULT 'general',
    position INT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_formacion_cursos_client ON formacion_cursos(client_id);

ALTER TABLE formacion_cursos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on formacion_cursos" ON formacion_cursos
  FOR ALL USING (true) WITH CHECK (true);


-- 3b. Videos dentro de un curso
CREATE TABLE IF NOT EXISTS formacion_videos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    curso_id UUID NOT NULL REFERENCES formacion_cursos(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    video_url TEXT NOT NULL,
    embed_url TEXT,
    position INT DEFAULT 0,
    duration_seconds INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_formacion_videos_curso ON formacion_videos(curso_id);
CREATE INDEX IF NOT EXISTS idx_formacion_videos_client ON formacion_videos(client_id);

ALTER TABLE formacion_videos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on formacion_videos" ON formacion_videos
  FOR ALL USING (true) WITH CHECK (true);


-- 3c. Canales de comunidad
CREATE TABLE IF NOT EXISTS comunidad_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50) DEFAULT 'general',
    description TEXT,
    position INT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comunidad_channels_client ON comunidad_channels(client_id);

ALTER TABLE comunidad_channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on comunidad_channels" ON comunidad_channels
  FOR ALL USING (true) WITH CHECK (true);


-- 3d. Mensajes de comunidad
CREATE TABLE IF NOT EXISTS comunidad_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID NOT NULL REFERENCES comunidad_channels(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    author_name VARCHAR(100) NOT NULL,
    content TEXT NOT NULL,
    is_announcement BOOLEAN DEFAULT FALSE,
    pinned BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comunidad_messages_channel ON comunidad_messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_comunidad_messages_created ON comunidad_messages(created_at DESC);

ALTER TABLE comunidad_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on comunidad_messages" ON comunidad_messages
  FOR ALL USING (true) WITH CHECK (true);


-- ============================================================
-- FIN — Todas las tablas creadas
-- ============================================================
