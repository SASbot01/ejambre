-- ============================================
-- ENJAMBRE — Tablas en Supabase
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================

-- Eventos del sistema
CREATE TABLE IF NOT EXISTS events (
  id bigserial PRIMARY KEY,
  event_type varchar NOT NULL,
  source_agent varchar NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  correlation_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_agent ON events(source_agent);
CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at DESC);

-- Estado de agentes
CREATE TABLE IF NOT EXISTS agent_status (
  agent_name varchar PRIMARY KEY,
  status varchar NOT NULL DEFAULT 'online',
  last_heartbeat timestamptz NOT NULL DEFAULT now(),
  metrics jsonb DEFAULT '{}',
  config jsonb DEFAULT '{}'
);

-- Decisiones del cerebro
CREATE TABLE IF NOT EXISTS brain_decisions (
  id bigserial PRIMARY KEY,
  trigger_event_id bigint,
  decision_type varchar NOT NULL,
  agents_involved varchar[] NOT NULL DEFAULT '{}',
  reasoning text,
  actions_taken jsonb NOT NULL DEFAULT '[]',
  confidence numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Leads (formularios de infoproducto)
CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre varchar,
  email varchar NOT NULL,
  telefono varchar,
  producto varchar,
  landing_source varchar,
  ip_address inet,
  utm_source varchar,
  utm_medium varchar,
  utm_campaign varchar,
  status varchar NOT NULL DEFAULT 'nuevo',
  assigned_setter varchar,
  fraud_score numeric DEFAULT 0,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);

-- Setters
CREATE TABLE IF NOT EXISTS setters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre varchar NOT NULL,
  email varchar,
  activo boolean DEFAULT true,
  leads_asignados_hoy integer DEFAULT 0,
  ultimo_lead_asignado timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Secuencias de follow-up
CREATE TABLE IF NOT EXISTS sequences (
  id bigserial PRIMARY KEY,
  name varchar NOT NULL,
  trigger_status varchar DEFAULT 'nuevo',
  product_filter varchar,
  steps jsonb NOT NULL DEFAULT '[]',
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Enrollments en secuencias
CREATE TABLE IF NOT EXISTS sequence_enrollments (
  id bigserial PRIMARY KEY,
  lead_id uuid REFERENCES leads(id),
  sequence_id bigint REFERENCES sequences(id),
  current_step integer DEFAULT 0,
  status varchar DEFAULT 'active',
  next_fire_at timestamptz,
  last_response_at timestamptz,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_enrollments_status ON sequence_enrollments(status);
CREATE INDEX IF NOT EXISTS idx_enrollments_fire ON sequence_enrollments(next_fire_at);

-- RLS + full access policies
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE brain_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE setters ENABLE ROW LEVEL SECURITY;
ALTER TABLE sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE sequence_enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "enjambre_full" ON events FOR ALL USING (true);
CREATE POLICY "enjambre_full" ON agent_status FOR ALL USING (true);
CREATE POLICY "enjambre_full" ON brain_decisions FOR ALL USING (true);
CREATE POLICY "enjambre_full" ON leads FOR ALL USING (true);
CREATE POLICY "enjambre_full" ON setters FOR ALL USING (true);
CREATE POLICY "enjambre_full" ON sequences FOR ALL USING (true);
CREATE POLICY "enjambre_full" ON sequence_enrollments FOR ALL USING (true);
