CREATE TABLE IF NOT EXISTS stream_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  stream_definition_id UUID NOT NULL REFERENCES stream_definitions(id) ON DELETE CASCADE,
  schedule_kind TEXT NOT NULL CHECK (schedule_kind IN ('once','interval')),
  trigger_spec JSONB NOT NULL DEFAULT '{}'::jsonb,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  next_run_at TIMESTAMPTZ NOT NULL,
  last_run_at TIMESTAMPTZ,
  claim_token UUID,
  claimed_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS stream_schedules_due_idx ON stream_schedules(enabled, next_run_at) WHERE enabled = TRUE;

CREATE TABLE IF NOT EXISTS schedule_executions (
  id BIGSERIAL PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  schedule_id UUID NOT NULL REFERENCES stream_schedules(id) ON DELETE CASCADE,
  scheduled_for TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED','RUNNING','COMPLETED','FAILED','SKIPPED')),
  stream_session_id UUID REFERENCES stream_sessions(id) ON DELETE SET NULL,
  correlation_id UUID,
  error_code TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(schedule_id, scheduled_for)
);
