# Deployment

Kritano CMS includes a deployment script generator in the admin UI that produces a single bash script to set up a production server. No Docker in production, no vendor lock-in — you own the server.

## Script generator

Open the admin at [http://localhost:3001/admin](http://localhost:3001/admin) and click **Deployment** in the sidebar.

### Configuration form

| Field | Required | Default | Description |
|---|---|---|---|
| Server IP | Yes | — | Your server's IP address |
| SSH user | No | `root` | User to SSH as |
| Domain | Yes | — | Your site's domain (e.g. `mysite.com`) |
| Email for SSL | Yes | — | Email address for Let's Encrypt certificate |
| OS | Yes | Ubuntu 24.04 | Ubuntu 22.04, Ubuntu 24.04, or Debian 12 |
| Server size | Yes | Small | Small (1–2 CPU), Medium (2–4 CPU), or Large (4+ CPU) |
| Include Typesense | Yes | Yes | Install Typesense for full-text search |

### Typesense (full-text search)

If you select "Yes" for Typesense, the generated script will:

1. Download and install Typesense 26.0
2. Generate a secure API key
3. Configure Typesense with data and log directories
4. Start and enable the systemd service
5. Add `TYPESENSE_HOST`, `TYPESENSE_PORT`, `TYPESENSE_PROTOCOL`, and `TYPESENSE_API_KEY` to the CMS `.env`
6. Run an initial search index sync

If you select "No", search features are gracefully disabled — the CMS runs without errors but search endpoints return `{ search_unavailable: true }`.

### Server size tuning

The script adjusts database and cache settings based on your server size:

| Setting | Small | Medium | Large |
|---|---|---|---|
| PostgreSQL `max_connections` | 50 | 100 | 200 |
| PostgreSQL `shared_buffers` | 128MB | 256MB | 512MB |
| Redis `maxmemory` | 128mb | 256mb | 512mb |

### Generate and deploy

1. Fill in the form fields.
2. Click **Generate Script**.
3. The script appears in a code block below the form.
4. Click **Copy to clipboard**.
5. SSH into your server: `ssh root@your-server-ip`
6. Paste and run the script.

The script is generated entirely client-side — no data is sent to any server.

## What the script installs

The generated bash script sets up a complete production environment:

### System

- System package updates
- Essential build tools

### Runtime

- [Bun](https://bun.sh/) — JavaScript/TypeScript runtime

### Database

- PostgreSQL 16 — with a dedicated CMS user, database, and tuned configuration
- Redis 7 — for caching and session storage

### Application

- Clones the CMS repository
- Runs `bun install`
- Generates a `.env` file with:
  - Random `JWT_SECRET`
  - Random database password
  - `DATABASE_URL` and `REDIS_URL`
  - `MEDIA_PATH` set to `/var/cms/media/`
  - Your domain as `SITE_URL`
- Runs database migrations
- Builds the admin UI

### Web server

- nginx as a reverse proxy:
  - `/api` routes to the Bun API server on port 3000
  - `/admin` routes to the Bun API server on port 3000
  - `/media` serves static files from `/var/cms/media/`
  - `/` serves static files from `/var/cms/dist/`
- SSL certificate via certbot (Let's Encrypt)

### Process management

- systemd service for the API server (`cms-api`)
- systemd service for the background worker (`cms-worker`)
- Both services restart automatically on failure

### Security

- UFW firewall — allows ports 22 (SSH), 80 (HTTP), 443 (HTTPS) only
- fail2ban — protects against brute-force SSH attacks

### Backups

- Daily PostgreSQL backup via cron job

### Health check

- Runs `curl` against `/api/health` to verify the deployment succeeded

## Manual deployment

If you prefer to deploy manually or to a different platform, here's what the CMS needs:

### Requirements

- Bun runtime
- PostgreSQL 16+
- Redis 7+

### Environment variables

```bash
DATABASE_URL=postgresql://user:password@host:5432/cms
REDIS_URL=redis://host:6379
JWT_SECRET=a-long-random-secret
MEDIA_PATH=/var/cms/media
SITE_URL=https://yourdomain.com
ADMIN_URL=https://yourdomain.com/admin
PORT=3000
```

### Steps

1. **Clone the repository** and install dependencies:

```bash
git clone https://github.com/kritano/cms.git /var/cms
cd /var/cms
bun install
```

2. **Set up the database:**

```bash
# Create the database and user in PostgreSQL
createuser cms
createdb -O cms cms

# Run migrations
bun run packages/cli/src/commands/migrate.ts
```

3. **Build the admin UI:**

```bash
bun run packages/cli/src/commands/build.ts
```

4. **Create the media directory:**

```bash
mkdir -p /var/cms/media
```

5. **Start the API server:**

```bash
bun run server.ts
```

The server listens on the port specified by the `PORT` environment variable (default 3000).

6. **Set up a reverse proxy** (nginx, Caddy, etc.) to:
   - Forward `/api/*` and `/admin/*` to `localhost:3000`
   - Serve `/media/*` as static files from your `MEDIA_PATH`
   - Serve `/` as static files from `/var/cms/dist/` (after building the Astro theme)
   - Terminate SSL

7. **Set up a process manager** (systemd, pm2, etc.) to keep the API server running and restart it on failure.

## Building the frontend

The Astro theme is built separately:

```bash
cd themes/default
bun astro build
```

This produces static output in the theme's `dist/` directory. Copy it to your web root or configure nginx to serve it.

## Updating (zero downtime)

The admin includes an **Update Server** tab that generates a zero-downtime update script. It handles:

1. `git pull` to fetch latest code
2. `bun install` to update dependencies
3. `bun run cms migrate` to apply new migrations (safe — only adds, never destructive)
4. `bun run cms build` to rebuild the frontend
5. Rolling restart — worker first, then API (the site stays up throughout)
6. Automatic health check — rolls back if the health check fails

To update manually:

```bash
cd /var/cms
git pull
bun install
bun run packages/cli/src/commands/migrate.ts
bun run packages/cli/src/commands/build.ts
systemctl restart cms-worker
sleep 5
systemctl restart cms-api
```

## Backups

The setup script configures daily PostgreSQL backups via cron at 02:00 UTC with 30-day retention. Backups are stored at `/var/backups/cms/`.

### Managing backups in the admin

The **Deployment → Backups** tab in the admin shows:

- List of backup files with date and size
- **Run backup now** button for manual backups
- Download button for each backup
- Restore script (copies to clipboard)

### Manual backup

```bash
pg_dump -U cms cms | gzip > /var/backups/cms/cms-$(date +%Y%m%d).sql.gz
```

### Restore from backup

```bash
systemctl stop cms-api cms-worker
gunzip -c /var/backups/cms/cms-20250601.sql.gz | psql -U cms cms
systemctl start cms-api cms-worker
```

### API endpoints

```
GET    /api/admin/backups              List backup files
POST   /api/admin/backups              Trigger manual backup
GET    /api/admin/backups/:filename    Download backup file
```
