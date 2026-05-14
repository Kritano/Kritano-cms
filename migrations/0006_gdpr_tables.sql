-- GDPR / Data Subject Rights audit tables
-- See gdpr.md for full design + rationale.
--
-- email_hash is HMAC-SHA256 of normalised (lower + trim) email keyed by
-- GDPR_AUDIT_SECRET (env). Raw SHA-256 of an email would be trivially
-- brute-forced via rainbow table; HMAC defends against a DB-dump attack.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE gdpr_deletion_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_hash text NOT NULL,
  source text NOT NULL,
  source_record_id text,
  source_display_name text,
  deleted_at timestamptz NOT NULL DEFAULT now(),
  deleted_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  requested_by text NOT NULL CHECK (requested_by IN ('subject', 'retention', 'admin')),
  deletion_method text NOT NULL CHECK (deletion_method IN ('hard_delete', 'anonymised')),
  status text NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'failed', 'skipped')),
  failure_reason text,
  fields_deleted text[],
  rationale text,
  retention_snapshot jsonb
);

CREATE INDEX gdpr_deletion_log_email_hash_idx ON gdpr_deletion_log (email_hash);
CREATE INDEX gdpr_deletion_log_deleted_at_idx ON gdpr_deletion_log (deleted_at);

CREATE TABLE gdpr_search_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_hash text NOT NULL,
  searched_at timestamptz NOT NULL DEFAULT now(),
  searched_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  result_count integer NOT NULL,
  exported boolean NOT NULL DEFAULT false,
  reason text
);

CREATE INDEX gdpr_search_log_email_hash_idx ON gdpr_search_log (email_hash);
