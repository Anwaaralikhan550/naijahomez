CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS public_listings (
  collection_name TEXT NOT NULL,
  id TEXT NOT NULL,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  price_text TEXT,
  price_numeric NUMERIC(14, 2),
  listing_type TEXT,
  property_type TEXT,
  service_type TEXT,
  category TEXT,
  condition TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  image_urls TEXT[] NOT NULL DEFAULT '{}',
  phone TEXT,
  whatsapp_number TEXT,
  agent_name TEXT,
  user_id TEXT,
  kyc_status TEXT,
  source TEXT,
  source_url TEXT,
  dedupe_key TEXT,
  is_scraped BOOLEAN NOT NULL DEFAULT FALSE,
  bedrooms INTEGER,
  bathrooms INTEGER,
  toilets INTEGER,
  size_value NUMERIC(12, 2),
  size_unit TEXT,
  posted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data JSONB NOT NULL DEFAULT '{}'::JSONB,
  search_vector TSVECTOR GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(location, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(description, '')), 'C')
  ) STORED,
  PRIMARY KEY (collection_name, id)
);

CREATE UNIQUE INDEX IF NOT EXISTS public_listings_collection_slug_idx
  ON public_listings (collection_name, slug);

CREATE UNIQUE INDEX IF NOT EXISTS public_listings_collection_source_url_idx
  ON public_listings (collection_name, source_url)
  WHERE source_url IS NOT NULL AND source_url <> '';

CREATE UNIQUE INDEX IF NOT EXISTS public_listings_collection_dedupe_key_idx
  ON public_listings (collection_name, dedupe_key)
  WHERE dedupe_key IS NOT NULL AND dedupe_key <> '';

CREATE INDEX IF NOT EXISTS public_listings_collection_status_created_idx
  ON public_listings (collection_name, status, created_at DESC);

CREATE INDEX IF NOT EXISTS public_listings_property_filters_idx
  ON public_listings (status, listing_type, property_type, created_at DESC)
  WHERE collection_name = 'properties';

CREATE INDEX IF NOT EXISTS public_listings_marketplace_filters_idx
  ON public_listings (status, category, condition, created_at DESC)
  WHERE collection_name = 'marketplace';

CREATE INDEX IF NOT EXISTS public_listings_services_filters_idx
  ON public_listings (status, service_type, created_at DESC)
  WHERE collection_name = 'services';

CREATE INDEX IF NOT EXISTS public_listings_price_idx
  ON public_listings (collection_name, status, price_numeric);

CREATE INDEX IF NOT EXISTS public_listings_location_trgm_idx
  ON public_listings USING GIN (location gin_trgm_ops);

CREATE INDEX IF NOT EXISTS public_listings_title_trgm_idx
  ON public_listings USING GIN (title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS public_listings_search_vector_idx
  ON public_listings USING GIN (search_vector);

CREATE INDEX IF NOT EXISTS public_listings_data_gin_idx
  ON public_listings USING GIN (data);

