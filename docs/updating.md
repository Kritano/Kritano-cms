# Updating Kritano CMS

## If you used `cms create` (recommended)

Your site uses `@kritano/cms` as a versioned dependency. Updates are clean — your theme, schema, and content are never touched.

```bash
# Check what's available (notification also shown in admin)
bun outdated @kritano/cms

# Update to latest compatible version
bun update @kritano/cms

# Run any new migrations
bun run migrate

# Test locally
bun run dev

# Commit the updated lockfile and push
git add bun.lock && git commit -m "chore: update cms"
git push
```

The admin shows a notification when a new version is available with the exact commands to run. Go to **Admin → Deployment → Updates** to see what has changed.

## Update types

| Type | Example | What to do |
|------|---------|------------|
| **Patch** | 0.3.1 | Bug fixes. Safe to apply immediately. |
| **Minor** | 0.4.0 | New features. Run `bun run migrate` after updating. |
| **Major** | 1.0.0 | May include breaking changes. Read the migration guide before updating. |

## If you used the manual git clone install

```bash
git pull origin main
bun install
bun run migrate
bun run build
systemctl restart cms-api cms-worker
```

Be aware that `git pull` may conflict with local changes to theme files or configuration if upstream has modified those files.

> **Note — admin UI ships pre-built.** `git pull` brings down the latest `packages/admin/dist/` along with the source, so `bun run build` only builds the Astro frontend on the server. The admin Vite build does not run on the production VPS — this prevents the OOM kill / corrupted-dist failure mode that small (1–2 GB) servers used to hit during deploy. If you have forked the admin and need to rebuild it, do so on a machine with ≥2 GB free RAM via `bun run build:assets`. See [deployment.md → Releasing](deployment.md#releasing-maintainers) for the maintainer workflow.

## Rollback

If an update causes issues:

```bash
# Revert to previous lockfile
git checkout HEAD~1 -- bun.lock
bun install
bun run dev
```

For major version rollbacks, you may also need to revert migrations. Check the migration guide for the specific version.
