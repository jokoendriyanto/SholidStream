CREATE TABLE IF NOT EXISTS integration_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK(provider IN ('youtube')),
  external_account_id TEXT,
  display_name TEXT,
  credential_ciphertext TEXT NOT NULL,
  credential_key_version TEXT,
  scopes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','needs_reauth','revoked','disabled')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS integration_connections_provider_account_unique ON integration_connections(workspace_id,provider,external_account_id) WHERE external_account_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS integration_connections_workspace_idx ON integration_connections(workspace_id,provider,status);
CREATE TABLE IF NOT EXISTS youtube_live_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES integration_connections(id) ON DELETE CASCADE,
  stream_session_id UUID REFERENCES stream_sessions(id) ON DELETE SET NULL,
  broadcast_id TEXT NOT NULL,
  live_stream_id TEXT NOT NULL,
  ingestion_address TEXT NOT NULL,
  stream_key_ciphertext TEXT NOT NULL,
  lifecycle_state TEXT NOT NULL DEFAULT 'created',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(workspace_id,broadcast_id)
);
CREATE TABLE IF NOT EXISTS youtube_quota_daily_totals (
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  quota_day DATE NOT NULL,
  used_units INTEGER NOT NULL DEFAULT 0 CHECK(used_units >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(workspace_id,quota_day)
);
CREATE TABLE IF NOT EXISTS youtube_quota_usage (
  id BIGSERIAL PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  connection_id UUID REFERENCES integration_connections(id) ON DELETE SET NULL,
  operation TEXT NOT NULL,
  units INTEGER NOT NULL CHECK(units > 0),
  quota_day DATE NOT NULL DEFAULT CURRENT_DATE,
  correlation_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS youtube_quota_usage_day_idx ON youtube_quota_usage(workspace_id,quota_day,operation);
