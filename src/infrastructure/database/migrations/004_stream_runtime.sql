CREATE TABLE IF NOT EXISTS stream_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('asset','playlist','composition')),
  source_ref UUID,
  encoding_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  runtime_policy JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived','deleted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS stream_definitions_workspace_idx
  ON stream_definitions(workspace_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS stream_destinations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  stream_definition_id UUID NOT NULL REFERENCES stream_definitions(id) ON DELETE CASCADE,
  destination_type TEXT NOT NULL CHECK (destination_type IN ('youtube','facebook','custom_rtmp')),
  connection_ref UUID,
  endpoint_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  secret_ref TEXT,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, id)
);

CREATE INDEX IF NOT EXISTS stream_destinations_definition_idx
  ON stream_destinations(workspace_id, stream_definition_id, enabled);

CREATE TABLE IF NOT EXISTS stream_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  stream_definition_id UUID NOT NULL REFERENCES stream_definitions(id) ON DELETE RESTRICT,
  idempotency_key TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN (
    'DRAFT','QUEUED','ALLOCATING','PREPARING','STARTING','CONNECTING','LIVE',
    'DEGRADED','RECOVERING','STOPPING','STOPPED','FAILED','CANCELLED'
  )),
  desired_state TEXT NOT NULL DEFAULT 'LIVE' CHECK (desired_state IN ('LIVE','STOPPED')),
  generation INTEGER NOT NULL DEFAULT 1 CHECK (generation > 0),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  assigned_worker_id UUID,
  lease_expires_at TIMESTAMPTZ,
  failure_code TEXT,
  failure_message TEXT,
  queued_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  stopped_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS stream_sessions_workspace_state_idx
  ON stream_sessions(workspace_id, state, created_at DESC);
CREATE INDEX IF NOT EXISTS stream_sessions_definition_idx
  ON stream_sessions(workspace_id, stream_definition_id, created_at DESC);

CREATE TABLE IF NOT EXISTS stream_events (
  id BIGSERIAL PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES stream_sessions(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  from_state TEXT,
  to_state TEXT,
  generation INTEGER NOT NULL,
  correlation_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS stream_events_session_idx
  ON stream_events(workspace_id, session_id, id);
