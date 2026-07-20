-- Row-level, timestamped event log for the WhatsApp agent-outreach funnel.
-- analytics_daily (see 002_non_auth_core_tables.sql) is a day-bucketed
-- aggregate counter -- good for trend tiles, useless for "did this specific
-- agent open the link." This table exists to answer that per-agent question.

CREATE TABLE IF NOT EXISTS outreach_funnel_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id TEXT,
  claim_token_id UUID,
  batch_token_id UUID,
  advert_id TEXT,
  collection_name TEXT,
  phone TEXT,
  event_type TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outreach_events_phone
  ON outreach_funnel_events (phone);

CREATE INDEX IF NOT EXISTS idx_outreach_events_claim_token
  ON outreach_funnel_events (claim_token_id);

CREATE INDEX IF NOT EXISTS idx_outreach_events_batch_token
  ON outreach_funnel_events (batch_token_id);

CREATE INDEX IF NOT EXISTS idx_outreach_events_type_time
  ON outreach_funnel_events (event_type, created_at);

CREATE INDEX IF NOT EXISTS idx_outreach_events_queue
  ON outreach_funnel_events (queue_id);
