-- OAuth accounts linked to users
CREATE TABLE IF NOT EXISTS oauth_accounts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider        varchar(50) NOT NULL,
  provider_id     varchar(255) NOT NULL,
  email           varchar(255),
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider, provider_id)
);

CREATE INDEX IF NOT EXISTS idx_oauth_accounts_user ON oauth_accounts(user_id);
