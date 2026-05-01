interface FormValues {
  serverIp: string
  sshUser: string
  domain: string
  email: string
  os: string
  size: string
  includeTypesense: boolean
}

const PG_CONFIG: Record<string, { max_connections: number; shared_buffers: string }> = {
  small:  { max_connections: 50,  shared_buffers: '128MB' },
  medium: { max_connections: 100, shared_buffers: '256MB' },
  large:  { max_connections: 200, shared_buffers: '512MB' },
}

const REDIS_CONFIG: Record<string, string> = {
  small:  '128mb',
  medium: '256mb',
  large:  '512mb',
}

export function generateScript(v: FormValues): string {
  const pg = PG_CONFIG[v.size] || PG_CONFIG.small
  const redisMem = REDIS_CONFIG[v.size] || REDIS_CONFIG.small
  const jwtSecret = crypto.randomUUID() + crypto.randomUUID()
  const dbPassword = crypto.randomUUID().replace(/-/g, '')

  const typesenseBlock = v.includeTypesense ? `
# ─── Typesense ──────────────────────────────────────────────────────
echo "==> Installing Typesense"
curl -O https://dl.typesense.org/releases/26.0/typesense-server-26.0-amd64.deb
apt install -y ./typesense-server-26.0-amd64.deb
rm -f typesense-server-26.0-amd64.deb

# Generate a secure API key
TYPESENSE_API_KEY=$(openssl rand -hex 32)

# Configure Typesense
cat > /etc/typesense/typesense-server.ini << TSCONF
[server]
api-key = $TYPESENSE_API_KEY
data-dir = /var/lib/typesense
log-dir = /var/log/typesense
api-port = 8108
TSCONF

# Start and enable Typesense
systemctl start typesense-server
systemctl enable typesense-server
` : ''

  const typesenseEnv = v.includeTypesense ? `
TYPESENSE_HOST=localhost
TYPESENSE_PORT=8108
TYPESENSE_PROTOCOL=http
TYPESENSE_API_KEY=$TYPESENSE_API_KEY` : ''

  const typesenseSync = v.includeTypesense ? `
echo "==> Syncing search indexes"
bun run cms search:sync
` : ''

  return `#!/usr/bin/env bash
set -euo pipefail

# ─── Kritano CMS — Server Setup Script ───────────────────────────────
# Server:  ${v.serverIp}
# Domain:  ${v.domain}
# OS:      ${v.os}
# Size:    ${v.size}
# Search:  ${v.includeTypesense ? 'Typesense' : 'None'}
# Generated: ${new Date().toISOString()}
# ──────────────────────────────────────────────────────────────────────

echo "==> Updating system packages"
apt update && apt upgrade -y

echo "==> Installing dependencies"
apt install -y curl git nginx certbot python3-certbot-nginx ufw fail2ban

# ─── Bun ──────────────────────────────────────────────────────────────
echo "==> Installing Bun"
curl -fsSL https://bun.sh/install | bash
export BUN_INSTALL="/root/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"

# ─── PostgreSQL ───────────────────────────────────────────────────────
echo "==> Installing PostgreSQL"
apt install -y postgresql postgresql-contrib

sudo -u postgres psql -c "CREATE USER cms WITH PASSWORD '${dbPassword}';"
sudo -u postgres psql -c "CREATE DATABASE cms OWNER cms;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE cms TO cms;"

# Tune Postgres for server size
cat >> /etc/postgresql/*/main/postgresql.conf << PGCONF
max_connections = ${pg.max_connections}
shared_buffers = '${pg.shared_buffers}'
effective_cache_size = '${pg.shared_buffers}'
PGCONF
systemctl restart postgresql

# ─── Redis ────────────────────────────────────────────────────────────
echo "==> Installing Redis"
apt install -y redis-server
sed -i "s/^# maxmemory .*/maxmemory ${redisMem}/" /etc/redis/redis.conf
sed -i "s/^# maxmemory-policy .*/maxmemory-policy allkeys-lru/" /etc/redis/redis.conf
systemctl restart redis-server
${typesenseBlock}
# ─── CMS ──────────────────────────────────────────────────────────────
echo "==> Cloning CMS"
git clone https://github.com/kritano/cms.git /var/cms
cd /var/cms
bun install

# Environment
cat > /var/cms/.env << ENV
DATABASE_URL=postgresql://cms:${dbPassword}@localhost:5432/cms
REDIS_URL=redis://localhost:6379
JWT_SECRET=${jwtSecret}
MEDIA_PATH=/var/cms/media
SITE_URL=https://${v.domain}
ADMIN_URL=https://${v.domain}/admin
NODE_ENV=production${typesenseEnv}
ENV

mkdir -p /var/cms/media

echo "==> Running migrations"
bun run cms migrate

echo "==> Building"
bun run cms build
${typesenseSync}
# ─── nginx ────────────────────────────────────────────────────────────
echo "==> Configuring nginx"
cat > /etc/nginx/sites-available/${v.domain} << 'NGINX'
server {
    listen 80;
    server_name ${v.domain};

    # API + Admin
    location /api {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /admin {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Media — served directly by nginx
    location /media {
        alias /var/cms/media;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # Frontend (Astro static build)
    location / {
        root /var/cms/dist;
        try_files $uri $uri/ /index.html;
        expires 7d;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/${v.domain} /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# ─── SSL ──────────────────────────────────────────────────────────────
echo "==> Provisioning SSL certificate"
certbot --nginx -d ${v.domain} --non-interactive --agree-tos -m ${v.email}

# ─── systemd services ────────────────────────────────────────────────
echo "==> Creating systemd services"

cat > /etc/systemd/system/cms-api.service << SERVICE
[Unit]
Description=Kritano CMS API
After=network.target postgresql.service redis-server.service

[Service]
Type=simple
User=root
WorkingDirectory=/var/cms
ExecStart=/root/.bun/bin/bun run packages/core/src/api/server.ts
Restart=always
RestartSec=5
EnvironmentFile=/var/cms/.env

[Install]
WantedBy=multi-user.target
SERVICE

cat > /etc/systemd/system/cms-worker.service << SERVICE
[Unit]
Description=Kritano CMS Worker
After=network.target redis-server.service

[Service]
Type=simple
User=root
WorkingDirectory=/var/cms
ExecStart=/root/.bun/bin/bun run packages/core/src/worker.ts
Restart=always
RestartSec=5
EnvironmentFile=/var/cms/.env

[Install]
WantedBy=multi-user.target
SERVICE

systemctl daemon-reload
systemctl enable cms-api cms-worker
systemctl start cms-api cms-worker

# ─── Firewall ────────────────────────────────────────────────────────
echo "==> Configuring firewall"
ufw allow 22
ufw allow 80
ufw allow 443
ufw --force enable

# ─── fail2ban ─────────────────────────────────────────────────────────
systemctl enable fail2ban
systemctl start fail2ban

# ─── Backups ──────────────────────────────────────────────────────────
echo "==> Setting up daily backups"
mkdir -p /var/backups/cms
cat > /etc/cron.daily/cms-backup << 'CRON'
#!/bin/bash
pg_dump -U cms cms | gzip > /var/backups/cms/cms-$(date +%Y%m%d).sql.gz
find /var/backups/cms -name "*.sql.gz" -mtime +30 -delete
CRON
chmod +x /etc/cron.daily/cms-backup

# ─── Health Check ─────────────────────────────────────────────────────
echo "==> Running health check"
sleep 3
if curl -sf http://localhost:3000/api/health > /dev/null; then
  echo ""
  echo "════════════════════════════════════════════════════"
  echo "  ✓ Kritano CMS is running!"
  echo "  Site:  https://${v.domain}"
  echo "  Admin: https://${v.domain}/admin"
  echo "  API:   https://${v.domain}/api/health"
  echo "════════════════════════════════════════════════════"
else
  echo "✗ Health check failed. Check: systemctl status cms-api"
  exit 1
fi
`
}
