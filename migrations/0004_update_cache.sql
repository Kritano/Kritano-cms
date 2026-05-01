-- Store the cached update check result
CREATE TABLE IF NOT EXISTS update_cache (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checked_at   timestamptz NOT NULL DEFAULT now(),
  result       jsonb NOT NULL
);

-- Store per-user dismiss state
ALTER TABLE users ADD COLUMN IF NOT EXISTS update_dismissed_until timestamptz;
