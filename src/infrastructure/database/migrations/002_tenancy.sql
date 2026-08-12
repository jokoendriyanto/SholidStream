CREATE TABLE IF NOT EXISTS workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','deleted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workspace_members (
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner','admin','operator','viewer')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','invited','disabled')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS workspace_members_user_idx
  ON workspace_members(user_id, status);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'audit_logs_workspace_fk'
  ) THEN
    ALTER TABLE audit_logs
      ADD CONSTRAINT audit_logs_workspace_fk
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE SET NULL;
  END IF;
END $$;
