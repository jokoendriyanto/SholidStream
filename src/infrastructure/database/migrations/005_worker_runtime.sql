ALTER TABLE stream_sessions
  ADD COLUMN IF NOT EXISTS lease_token_hash TEXT,
  ADD COLUMN IF NOT EXISTS last_heartbeat_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS worker_runtime JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS stream_sessions_lease_idx
  ON stream_sessions(state, lease_expires_at)
  WHERE state NOT IN ('STOPPED','FAILED','CANCELLED');
