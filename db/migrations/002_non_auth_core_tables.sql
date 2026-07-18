CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS app_user_profiles (
  user_id TEXT PRIMARY KEY,
  email TEXT,
  display_name TEXT,
  photo_url TEXT,
  phone_number TEXT,
  location TEXT,
  bio TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  kyc_status TEXT NOT NULL DEFAULT 'unverified',
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  sign_in_provider TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data JSONB NOT NULL DEFAULT '{}'::JSONB
);

CREATE INDEX IF NOT EXISTS app_user_profiles_role_idx
  ON app_user_profiles (role, is_admin);

CREATE INDEX IF NOT EXISTS app_user_profiles_kyc_status_idx
  ON app_user_profiles (kyc_status);

CREATE TABLE IF NOT EXISTS onboarding_outreach_queue (
  id TEXT PRIMARY KEY,
  advert_id TEXT NOT NULL,
  collection_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  agent_name TEXT,
  location TEXT,
  priority INTEGER NOT NULL DEFAULT 10,
  status TEXT NOT NULL DEFAULT 'pending',
  claim_token_id UUID,
  batch_token_id UUID,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  locked_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  provider_message_id TEXT,
  suppressed_at TIMESTAMPTZ,
  suppressed_phone TEXT,
  batched_at TIMESTAMPTZ,
  claimed_at TIMESTAMPTZ,
  claimed_by_user_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data JSONB NOT NULL DEFAULT '{}'::JSONB
);

CREATE INDEX IF NOT EXISTS onboarding_queue_pending_idx
  ON onboarding_outreach_queue (status, priority, next_run_at, created_at);

CREATE INDEX IF NOT EXISTS onboarding_queue_phone_idx
  ON onboarding_outreach_queue (phone, status, next_run_at);

CREATE INDEX IF NOT EXISTS onboarding_queue_sent_at_idx
  ON onboarding_outreach_queue (sent_at)
  WHERE sent_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS onboarding_queue_batch_idx
  ON onboarding_outreach_queue (batch_token_id)
  WHERE batch_token_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS advert_claim_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  advert_id TEXT NOT NULL,
  collection_name TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  claimed_at TIMESTAMPTZ,
  claimed_by_user_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data JSONB NOT NULL DEFAULT '{}'::JSONB
);

CREATE INDEX IF NOT EXISTS advert_claim_tokens_advert_idx
  ON advert_claim_tokens (collection_name, advert_id);

CREATE INDEX IF NOT EXISTS advert_claim_tokens_expires_idx
  ON advert_claim_tokens (expires_at);

CREATE TABLE IF NOT EXISTS advert_claim_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  raw_phone TEXT,
  advert_refs JSONB NOT NULL DEFAULT '[]'::JSONB,
  advert_count INTEGER NOT NULL DEFAULT 0,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  claimed_at TIMESTAMPTZ,
  claimed_by_user_id TEXT,
  claimed_advert_ids TEXT[] NOT NULL DEFAULT '{}',
  provider_message_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data JSONB NOT NULL DEFAULT '{}'::JSONB
);

CREATE INDEX IF NOT EXISTS advert_claim_batches_phone_idx
  ON advert_claim_batches (phone, sent_at DESC);

CREATE INDEX IF NOT EXISTS advert_claim_batches_expires_idx
  ON advert_claim_batches (expires_at);

CREATE TABLE IF NOT EXISTS suppressed_numbers (
  phone TEXT PRIMARY KEY,
  raw_phone TEXT,
  source TEXT,
  reason TEXT,
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kyc_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  document_type TEXT,
  document_url TEXT,
  cac_document_url TEXT,
  rejection_reason TEXT,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data JSONB NOT NULL DEFAULT '{}'::JSONB
);

CREATE INDEX IF NOT EXISTS kyc_submissions_user_status_idx
  ON kyc_submissions (user_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS listing_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id TEXT NOT NULL,
  collection_name TEXT NOT NULL,
  reporter_user_id TEXT,
  reason TEXT,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data JSONB NOT NULL DEFAULT '{}'::JSONB
);

CREATE INDEX IF NOT EXISTS listing_reports_status_idx
  ON listing_reports (status, created_at DESC);

CREATE TABLE IF NOT EXISTS content_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  next_run_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data JSONB NOT NULL DEFAULT '{}'::JSONB
);

CREATE INDEX IF NOT EXISTS content_jobs_status_idx
  ON content_jobs (status, next_run_at, created_at);

CREATE TABLE IF NOT EXISTS blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  summary TEXT,
  body TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  meta_title TEXT,
  meta_description TEXT,
  published_at TIMESTAMPTZ,
  scheduled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data JSONB NOT NULL DEFAULT '{}'::JSONB
);

CREATE INDEX IF NOT EXISTS blog_posts_status_published_idx
  ON blog_posts (status, published_at DESC);

CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT,
  email TEXT,
  phone TEXT,
  subject TEXT NOT NULL,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  priority TEXT NOT NULL DEFAULT 'normal',
  assigned_to TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data JSONB NOT NULL DEFAULT '{}'::JSONB
);

CREATE INDEX IF NOT EXISTS support_tickets_status_idx
  ON support_tickets (status, priority, created_at DESC);

CREATE TABLE IF NOT EXISTS analytics_daily (
  day DATE NOT NULL,
  metric_name TEXT NOT NULL,
  dimension_key TEXT NOT NULL DEFAULT '',
  count BIGINT NOT NULL DEFAULT 0,
  data JSONB NOT NULL DEFAULT '{}'::JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (day, metric_name, dimension_key)
);
