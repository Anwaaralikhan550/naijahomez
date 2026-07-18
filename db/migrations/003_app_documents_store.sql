CREATE TABLE IF NOT EXISTS app_documents (
  collection_path TEXT NOT NULL,
  doc_id TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (collection_path, doc_id)
);

CREATE INDEX IF NOT EXISTS app_documents_collection_updated_idx
  ON app_documents (collection_path, updated_at DESC);

CREATE INDEX IF NOT EXISTS app_documents_collection_created_idx
  ON app_documents (collection_path, created_at DESC);

CREATE INDEX IF NOT EXISTS app_documents_data_gin_idx
  ON app_documents USING GIN (data);
