-- Plugin storage — key-value store for plugin data
CREATE TABLE IF NOT EXISTS plugin_storage (
  plugin_name  varchar(255) NOT NULL,
  key          varchar(255) NOT NULL,
  value        jsonb,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (plugin_name, key)
);

-- Plugin settings — per-plugin configuration and state
CREATE TABLE IF NOT EXISTS plugin_settings (
  plugin_name   varchar(255) NOT NULL PRIMARY KEY,
  settings      jsonb NOT NULL DEFAULT '{}',
  enabled       boolean NOT NULL DEFAULT true,
  trust         varchar(20) NOT NULL DEFAULT 'sandboxed',
  installed_at  timestamptz NOT NULL DEFAULT now(),
  version       varchar(50)
);
