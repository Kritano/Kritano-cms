-- Add created_by and updated_by columns to all collection tables if missing
-- These are system columns tracked automatically by the CMS
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOR tbl IN
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        AND table_name NOT IN ('_cms_migrations', 'users', 'roles', 'user_roles', 'media', 'site_settings', 'api_keys', 'webhooks', 'webhook_deliveries', 'activity_log', 'revisions', 'scheduled_publishes', 'redirects', 'forms', 'form_fields', 'form_submissions', 'media_folders', 'plugin_storage', 'plugin_settings', 'oauth_accounts', 'update_cache')
    LOOP
        EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS created_by uuid', tbl);
        EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS updated_by uuid', tbl);
    END LOOP;
END $$;
