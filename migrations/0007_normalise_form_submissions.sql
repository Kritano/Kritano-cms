-- Normalise form_submissions.data rows that were double-encoded by the
-- previous writer (which wrapped the payload in JSON.stringify() before
-- letting postgres-js JSON-encode it again — resulting in a jsonb *string*
-- value rather than a jsonb *object*).
--
-- This migration extracts the inner string back to a jsonb object so
-- expressions like `data->>'email'` work. Idempotent: only rows where
-- jsonb_typeof(data) = 'string' are touched, so re-running is a no-op.

UPDATE form_submissions
   SET data = (data #>> '{}')::jsonb
 WHERE jsonb_typeof(data) = 'string';
