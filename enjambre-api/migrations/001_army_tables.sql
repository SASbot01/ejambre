-- Army refactor — tablas compartidas + per-commander
-- Cada Comandante tiene su propio par (<name>_memory + <name>_decisions).
-- La tabla army_heartbeats sustituye al viejo agent_status estático.

-- ============ HEARTBEATS compartidos ============
CREATE TABLE IF NOT EXISTS army_heartbeats (
  agent_name text PRIMARY KEY,
  status text NOT NULL,                 -- 'patrolling' | 'on_mission' | 'degraded' | 'down'
  last_patrol_at timestamptz,
  last_patrol_summary text,
  patrol_cycles bigint DEFAULT 0,
  tokens_last_hour int DEFAULT 0,
  cost_last_hour_usd numeric(10,6) DEFAULT 0,
  dry_run boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============ GENERAL ============
CREATE TABLE IF NOT EXISTS general_orders (
  id uuid PRIMARY KEY,
  origin text NOT NULL,                 -- 'human' | 'event' | 'patrol'
  objective text NOT NULL,
  assigned_to text[] NOT NULL,          -- lista de agent_name a quienes va la orden
  status text NOT NULL DEFAULT 'pending', -- 'pending' | 'in_progress' | 'done' | 'failed'
  briefing_back text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_general_orders_status ON general_orders(status);

-- ============ PATTERN reusable (copiar por cada commander) ============
-- CRM
CREATE TABLE IF NOT EXISTS crm_decisions (
  id bigserial PRIMARY KEY,
  mission_id uuid NOT NULL,
  patrol_cycle bigint,
  decision_type text NOT NULL,          -- 'patrol' | 'investigation' | 'escalation' | 'support_request' | 'action_dry_run' | 'action_executed'
  summary text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  tokens_input int,
  tokens_output int,
  cost_usd numeric(10,6),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_crm_decisions_created ON crm_decisions(created_at DESC);

CREATE TABLE IF NOT EXISTS crm_memory (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- OPS
CREATE TABLE IF NOT EXISTS ops_decisions (LIKE crm_decisions INCLUDING ALL);
CREATE TABLE IF NOT EXISTS ops_memory (LIKE crm_memory INCLUDING ALL);

-- DEV
CREATE TABLE IF NOT EXISTS dev_decisions (LIKE crm_decisions INCLUDING ALL);
CREATE TABLE IF NOT EXISTS dev_memory (LIKE crm_memory INCLUDING ALL);

-- FORMS
CREATE TABLE IF NOT EXISTS forms_decisions (LIKE crm_decisions INCLUDING ALL);
CREATE TABLE IF NOT EXISTS forms_memory (LIKE crm_memory INCLUDING ALL);
