interface FormValues {
  serverIp: string
  sshUser: string
  domain: string
  includeTypesense: boolean
}

export function generateUpdateScript(v: FormValues): string {
  const typesenseSync = v.includeTypesense ? `
echo "==> Re-syncing search indexes"
bun run cms search:sync
` : ''

  return `#!/usr/bin/env bash
set -euo pipefail

# ─── Kritano CMS — Zero-Downtime Update Script ────────────────────
# Server:  ${v.serverIp}
# Domain:  ${v.domain}
# Generated: ${new Date().toISOString()}
# ──────────────────────────────────────────────────────────────────

echo "==> Pulling latest code"
cd /var/cms
git fetch origin
git pull origin main

echo "==> Installing dependencies"
bun install

echo "==> Running migrations"
bun run cms migrate

echo "==> Rebuilding frontend"
bun run cms build
${typesenseSync}
echo "==> Rolling restart (zero downtime)"
# Restart worker first — API stays up during worker restart
systemctl restart cms-worker
sleep 5
systemctl restart cms-api

echo "==> Health check"
sleep 3
if curl -sf http://localhost:3000/api/health > /dev/null; then
  echo ""
  echo "════════════════════════════════════════════"
  echo "  ✓ Update complete!"
  echo "  Site: https://${v.domain}"
  echo "════════════════════════════════════════════"
else
  echo "✗ Health check failed — rolling back"
  git reset --hard HEAD~1
  bun install
  bun run cms build
  systemctl restart cms-api cms-worker
  sleep 3
  if curl -sf http://localhost:3000/api/health > /dev/null; then
    echo "✓ Rollback successful — previous version restored"
  else
    echo "✗ Rollback also failed. Manual intervention required."
    echo "  Check: systemctl status cms-api"
    exit 1
  fi
fi
`
}
