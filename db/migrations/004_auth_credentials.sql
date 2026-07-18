-- Adds credential storage to app_user_profiles (previously assumed Firebase
-- Auth would always own this) and the token tables needed for a self-hosted
-- auth system: password reset and revocable refresh tokens.
--
-- user_id stays the existing Firebase UID string for migrated users, and a
-- new crypto.randomBytes-based id in the same shape for users created after
-- cutover -- every other table (kyc_submissions.user_id, listing_reports.
-- reporter_user_id, support_tickets.user_id, etc.) is already keyed on this
-- string, so we do not remint ids.

ALTER TABLE app_user_profiles
  ADD COLUMN IF NOT EXISTS password_hash TEXT,
  ADD COLUMN IF NOT EXISTS password_algo TEXT,
  ADD COLUMN IF NOT EXISTS password_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS auth_migrated_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES app_user_profiles(user_id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS password_reset_tokens_user_idx
  ON password_reset_tokens (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES app_user_profiles(user_id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  replaced_by_token_hash TEXT,
  user_agent TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS refresh_tokens_user_idx
  ON refresh_tokens (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS refresh_tokens_active_idx
  ON refresh_tokens (user_id) WHERE revoked_at IS NULL;
