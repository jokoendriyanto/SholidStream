CREATE TABLE IF NOT EXISTS stream_recovery_attempts (
  id BIGSERIAL PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES stream_sessions(id) ON DELETE CASCADE,
  generation INTEGER NOT NULL,
  failure_class TEXT NOT NULL,
  attempt INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'QUEUED' CHECK(status IN ('QUEUED','ALLOCATED','RECOVERED','FAILED','EXHAUSTED')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(session_id,generation,attempt)
);
CREATE INDEX IF NOT EXISTS stream_recovery_attempts_session_idx ON stream_recovery_attempts(workspace_id,session_id,generation DESC);

CREATE TABLE IF NOT EXISTS platform_incidents (
  id BIGSERIAL PRIMARY KEY,
  severity TEXT NOT NULL CHECK(severity IN ('info','warning','critical')),
  incident_type TEXT NOT NULL,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  session_id UUID REFERENCES stream_sessions(id) ON DELETE CASCADE,
  worker_id UUID REFERENCES worker_nodes(id) ON DELETE SET NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
