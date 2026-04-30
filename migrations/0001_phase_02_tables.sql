-- Phase 0.2 — New tables for operational features
-- Roles, revisions, scheduling, webhooks, redirects, forms, API keys, media folders

-- ============================================================
-- Roles & user role assignments
-- ============================================================

CREATE TABLE IF NOT EXISTS "roles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" varchar(100) NOT NULL UNIQUE,
  "description" text,
  "permissions" jsonb NOT NULL DEFAULT '{}',
  "is_system" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "user_roles" (
  "user_id" uuid NOT NULL,
  "role_id" uuid NOT NULL,
  PRIMARY KEY ("user_id", "role_id"),
  CONSTRAINT "fk_user_roles_user_id" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE,
  CONSTRAINT "fk_user_roles_role_id" FOREIGN KEY ("role_id") REFERENCES "roles" ("id") ON DELETE CASCADE
);

-- ============================================================
-- Invitations
-- ============================================================

CREATE TABLE IF NOT EXISTS "invitations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" varchar(255) NOT NULL,
  "role_id" uuid NOT NULL,
  "token" varchar(255) NOT NULL UNIQUE,
  "invited_by" uuid NOT NULL,
  "accepted_at" timestamptz,
  "expires_at" timestamptz NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "fk_invitations_role_id" FOREIGN KEY ("role_id") REFERENCES "roles" ("id"),
  CONSTRAINT "fk_invitations_invited_by" FOREIGN KEY ("invited_by") REFERENCES "users" ("id")
);

-- ============================================================
-- Document revisions
-- ============================================================

CREATE TABLE IF NOT EXISTS "revisions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "document_id" uuid NOT NULL,
  "collection" varchar(255) NOT NULL,
  "data" jsonb NOT NULL,
  "created_by" uuid,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "fk_revisions_created_by" FOREIGN KEY ("created_by") REFERENCES "users" ("id")
);

CREATE INDEX "idx_revisions_document" ON "revisions" ("document_id", "created_at" DESC);

-- ============================================================
-- Scheduled publishing
-- ============================================================

CREATE TABLE IF NOT EXISTS "scheduled_publishes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "document_id" uuid NOT NULL,
  "collection" varchar(255) NOT NULL,
  "scheduled_for" timestamptz NOT NULL,
  "timezone" varchar(100) NOT NULL DEFAULT 'UTC',
  "status" varchar(20) NOT NULL DEFAULT 'pending',
  "created_by" uuid,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "completed_at" timestamptz,
  CONSTRAINT "fk_scheduled_publishes_created_by" FOREIGN KEY ("created_by") REFERENCES "users" ("id")
);

CREATE INDEX "idx_scheduled_publishes_pending" ON "scheduled_publishes" ("scheduled_for")
  WHERE "status" = 'pending';

-- ============================================================
-- Activity log
-- ============================================================

CREATE TABLE IF NOT EXISTS "activity_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid,
  "action" varchar(100) NOT NULL,
  "resource" varchar(100) NOT NULL,
  "resource_id" uuid,
  "metadata" jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "fk_activity_log_user_id" FOREIGN KEY ("user_id") REFERENCES "users" ("id")
);

CREATE INDEX "idx_activity_log_created" ON "activity_log" ("created_at" DESC);

-- ============================================================
-- Forms
-- ============================================================

CREATE TABLE IF NOT EXISTS "forms" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" varchar(255) NOT NULL,
  "slug" varchar(255) NOT NULL UNIQUE,
  "fields" jsonb NOT NULL DEFAULT '[]',
  "settings" jsonb NOT NULL DEFAULT '{}',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  CREATE TRIGGER "set_updated_at_forms"
    BEFORE UPDATE ON "forms"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================================
-- Form submissions
-- ============================================================

CREATE TABLE IF NOT EXISTS "form_submissions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "form_id" uuid NOT NULL,
  "data" jsonb NOT NULL,
  "ip_address" varchar(45),
  "user_agent" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "fk_form_submissions_form_id" FOREIGN KEY ("form_id") REFERENCES "forms" ("id") ON DELETE CASCADE
);

CREATE INDEX "idx_form_submissions_form" ON "form_submissions" ("form_id", "created_at" DESC);

-- ============================================================
-- Redirects
-- ============================================================

CREATE TABLE IF NOT EXISTS "redirects" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "from_path" varchar(2048) NOT NULL UNIQUE,
  "to_path" varchar(2048) NOT NULL,
  "type" smallint NOT NULL DEFAULT 301,
  "hits" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "idx_redirects_from_path" ON "redirects" ("from_path");

DO $$ BEGIN
  CREATE TRIGGER "set_updated_at_redirects"
    BEFORE UPDATE ON "redirects"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================================
-- Webhooks
-- ============================================================

CREATE TABLE IF NOT EXISTS "webhooks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" varchar(255) NOT NULL,
  "url" varchar(2048) NOT NULL,
  "secret" varchar(255),
  "events" jsonb NOT NULL DEFAULT '[]',
  "active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- Webhook deliveries
-- ============================================================

CREATE TABLE IF NOT EXISTS "webhook_deliveries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "webhook_id" uuid NOT NULL,
  "event" varchar(100) NOT NULL,
  "payload" jsonb NOT NULL,
  "response_code" integer,
  "response_body" text,
  "duration_ms" integer,
  "success" boolean NOT NULL DEFAULT false,
  "attempt" smallint NOT NULL DEFAULT 1,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "fk_webhook_deliveries_webhook_id" FOREIGN KEY ("webhook_id") REFERENCES "webhooks" ("id") ON DELETE CASCADE
);

CREATE INDEX "idx_webhook_deliveries_webhook" ON "webhook_deliveries" ("webhook_id", "created_at" DESC);

-- ============================================================
-- API keys
-- ============================================================

CREATE TABLE IF NOT EXISTS "api_keys" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" varchar(255) NOT NULL,
  "key_hash" varchar(255) NOT NULL UNIQUE,
  "key_prefix" varchar(20) NOT NULL,
  "permissions" jsonb NOT NULL DEFAULT '[]',
  "last_used" timestamptz,
  "expires_at" timestamptz,
  "created_by" uuid,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "fk_api_keys_created_by" FOREIGN KEY ("created_by") REFERENCES "users" ("id")
);

-- ============================================================
-- Media folders
-- ============================================================

CREATE TABLE IF NOT EXISTS "media_folders" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" varchar(255) NOT NULL,
  "parent_id" uuid,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "fk_media_folders_parent_id" FOREIGN KEY ("parent_id") REFERENCES "media_folders" ("id")
);

-- Add 2FA columns to users table
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "two_factor_secret" varchar(255);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "two_factor_enabled" boolean NOT NULL DEFAULT false;

-- Add folder support to existing media table
ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "folder_id" uuid;
ALTER TABLE "media" ADD CONSTRAINT "fk_media_folder_id" FOREIGN KEY ("folder_id") REFERENCES "media_folders" ("id");

-- ============================================================
-- Seed system roles
-- ============================================================

INSERT INTO "roles" ("name", "description", "permissions", "is_system") VALUES
  ('super_admin', 'Full access to everything', '{"*": true}', true),
  ('admin', 'Full content access, can manage users', '{"content": true, "media": true, "users": true, "settings": true}', true),
  ('editor', 'Can edit and publish all content', '{"content": {"read": true, "create": true, "update": true, "publish": true}, "media": true}', true),
  ('author', 'Can create and edit own content, cannot publish', '{"content": {"read": true, "create": true, "update_own": true}, "media": {"upload": true}}', true),
  ('contributor', 'Can create drafts only', '{"content": {"read": true, "create": true}, "media": {"read": true}}', true),
  ('viewer', 'Read-only access to admin', '{"content": {"read": true}, "media": {"read": true}}', true)
ON CONFLICT ("name") DO NOTHING;
