CREATE TABLE IF NOT EXISTS media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('video','audio','image','other')),
  storage_driver TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  original_filename TEXT,
  mime_type TEXT,
  size_bytes BIGINT CHECK (size_bytes IS NULL OR size_bytes >= 0),
  checksum_sha256 TEXT,
  duration_seconds NUMERIC,
  width INTEGER,
  height INTEGER,
  fps NUMERIC,
  video_codec TEXT,
  audio_codec TEXT,
  status TEXT NOT NULL DEFAULT 'uploading' CHECK (status IN ('uploading','verifying','probing','processing','ready','failed','deleted')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  UNIQUE (workspace_id, storage_key)
);

CREATE INDEX IF NOT EXISTS media_assets_workspace_status_idx
  ON media_assets(workspace_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS media_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  media_asset_id UUID REFERENCES media_assets(id) ON DELETE CASCADE,
  upload_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','uploading','completed','failed','expired')),
  expected_size_bytes BIGINT,
  received_size_bytes BIGINT NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, upload_key)
);
