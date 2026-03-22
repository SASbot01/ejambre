-- ============================================
-- ENJAMBRE BLACKWOLF - SCHEMA INICIAL
-- ============================================

-- Eventos del Enjambre (pizarra compartida persistida)
CREATE TABLE IF NOT EXISTS events (
    id BIGSERIAL PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,
    source_agent VARCHAR(50) NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}',
    correlation_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_events_type ON events(event_type);
CREATE INDEX idx_events_source ON events(source_agent);
CREATE INDEX idx_events_created ON events(created_at DESC);
CREATE INDEX idx_events_correlation ON events(correlation_id);

-- Leads de infoproductos
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

CREATE INDEX idx_leads_email ON leads(email);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_created ON leads(created_at DESC);

-- Decisiones del Cerebro (Claude)
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

-- Estado de agentes
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

-- Configuración de setters para round-robin
CREATE TABLE IF NOT EXISTS setters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    activo BOOLEAN DEFAULT true,
    leads_asignados_hoy INT DEFAULT 0,
    ultimo_lead_asignado TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Configuración de formularios por landing
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
