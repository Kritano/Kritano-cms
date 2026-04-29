# Kritano CMS — Database Schema

## System Tables

### `users`
| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK, DEFAULT gen_random_uuid() |
| email | varchar(255) | NOT NULL, UNIQUE |
| password_hash | varchar(255) | NOT NULL |
| name | varchar(255) | nullable |
| created_at | timestamptz | NOT NULL, DEFAULT now() |
| updated_at | timestamptz | NOT NULL, DEFAULT now() |

### `media`
| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK, DEFAULT gen_random_uuid() |
| filename | varchar(500) | NOT NULL |
| original_filename | varchar(500) | NOT NULL |
| mime_type | varchar(100) | NOT NULL |
| size | integer | NOT NULL |
| width | integer | nullable |
| height | integer | nullable |
| alt | text | nullable |
| url | varchar(2048) | NOT NULL |
| thumbnail_url | varchar(2048) | nullable |
| created_at | timestamptz | NOT NULL, DEFAULT now() |
| updated_at | timestamptz | NOT NULL, DEFAULT now() |

### `site_settings`
| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK, DEFAULT gen_random_uuid() |
| key | varchar(255) | NOT NULL, UNIQUE |
| value | jsonb | NOT NULL |
| updated_at | timestamptz | NOT NULL, DEFAULT now() |

### `_cms_migrations`
| Column | Type | Constraints |
|---|---|---|
| id | serial | PK |
| filename | varchar(500) | NOT NULL, UNIQUE |
| applied_at | timestamptz | NOT NULL, DEFAULT now() |

## Collection Tables (auto-generated)

Every collection defined in `cms.config.ts` gets a table with:
- System columns: `id`, `status`, `created_at`, `updated_at`, `published_at`
- One column per field, snake_cased from the field name
- `updated_at` trigger fires BEFORE UPDATE

### Field Type → Postgres Column Mapping
| CMS Field | Postgres Type | Notes |
|---|---|---|
| text | varchar(255) | |
| textarea | text | |
| richText | jsonb | TipTap JSON |
| slug | varchar(255) UNIQUE | |
| url | varchar(2048) | |
| number | numeric | |
| boolean | boolean | DEFAULT false |
| datetime | timestamptz | |
| select | varchar(100) | |
| multiSelect | jsonb | string[] |
| media | uuid | FK → media.id |
| relation | uuid | FK → target table.id |
| seoBlock | jsonb | |
| blocks | jsonb | Block[] |
| array | jsonb | |
| colour | varchar(20) | |

## Migration Strategy
- Migrations are timestamped SQL files in `migrations/`
- `.snapshot.json` tracks the last known schema state
- `createMigration()` diffs current config against snapshot
- Initial migration generates all system + collection tables
- Subsequent migrations generate ALTER TABLE statements
- Migration runner applies pending files inside a transaction
- Applied migrations tracked in `_cms_migrations` table
- Never modifies existing migration files
