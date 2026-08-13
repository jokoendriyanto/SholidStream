ALTER TABLE stream_sessions ADD COLUMN IF NOT EXISTS lease_token_ciphertext TEXT;
ALTER TABLE automation_jobs ADD COLUMN IF NOT EXISTS queued_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS automation_jobs_claim_idx ON automation_jobs(status,scheduled_for,queued_at);
