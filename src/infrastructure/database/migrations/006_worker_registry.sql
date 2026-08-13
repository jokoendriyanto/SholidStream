CREATE TABLE IF NOT EXISTS worker_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_key TEXT NOT NULL UNIQUE,
  region TEXT NOT NULL DEFAULT 'default',
  status TEXT NOT NULL DEFAULT 'REGISTERING' CHECK (status IN (
    'REGISTERING','HEALTHY','DEGRADED','DRAINING','OFFLINE','MAINTENANCE'
  )),
  max_streams INTEGER NOT NULL DEFAULT 2 CHECK (max_streams > 0),
  active_streams INTEGER NOT NULL DEFAULT 0 CHECK (active_streams >= 0),
  reserved_streams INTEGER NOT NULL DEFAULT 0 CHECK (reserved_streams >= 0),
  cpu_percent NUMERIC(5,2),
  memory_percent NUMERIC(5,2),
  reliability_score NUMERIC(6,4) NOT NULL DEFAULT 1.0,
  capabilities JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_heartbeat_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS worker_nodes_health_idx
  ON worker_nodes(status, last_heartbeat_at DESC, region);

CREATE TABLE IF NOT EXISTS worker_capacity_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES worker_nodes(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES stream_sessions(id) ON DELETE CASCADE,
  generation INTEGER NOT NULL CHECK (generation > 0),
  status TEXT NOT NULL DEFAULT 'RESERVED' CHECK (status IN ('RESERVED','ACTIVE','RELEASED','EXPIRED')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(session_id, generation)
);

CREATE INDEX IF NOT EXISTS worker_capacity_reservations_worker_idx
  ON worker_capacity_reservations(worker_id, status, expires_at);

ALTER TABLE stream_sessions
  ADD COLUMN IF NOT EXISTS worker_reservation_id UUID REFERENCES worker_capacity_reservations(id) ON DELETE SET NULL;
