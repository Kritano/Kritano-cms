### 14. Admin UI should ship pre-built — not rebuilt from source on every install
**Status:** Resolved 2026-05-12. See "Resolution" at the bottom of this entry.
**Severity:** High (deployment / DX)
**Description:** The `@kritano/cms` package rebuilds the admin UI from source on every consumer install via the `postinstall` `build:assets` script (`cd packages/admin && bun run build`). That build runs `tsc -b && vite build` on ~1,800 modules — heavy enough that on small VPS instances (1–2 GB RAM) it gets killed by the OOM killer (exit 137 / SIGKILL). When that happens mid-build the `packages/admin/dist/` directory is left in a corrupted, half-written state. The consumer's `server.ts` sees files in `dist/` and decides "admin is built", so it routes `/admin` to a broken bundle that returns 500s or blank pages.

**Reproduced 2026-05-12 on chrisgarlick.com:** ran `bun run build && systemctl restart chrisgarlick` on a 2 GB VPS. The `cms build` step's admin Vite build hit OOM at ~1,842 modules transformed with `error: script "build" was terminated by signal SIGKILL (Forced quit) / Failed with exit code 137`. The frontend was fine, but `/admin` was unreachable afterwards because the admin dist was partial. Recovery required rebuilding admin on a laptop and rsyncing the dist up.

**Suggested fix (any one is sufficient):**

1. **Commit the built `dist/` to the package repo and ship it.** The simplest fix. CI builds admin once per release and bundles it into the published package. Consumer install is fast (just file copy), with zero risk of partial builds. Costs ~a few MB in the package but that's standard for any framework that ships a built UI (Strapi, Payload, Directus all do this).
2. **Drop the admin from `postinstall` and instead lazy-build on first `cms dev` / `cms build`.** Less ideal because the OOM problem recurs the first time a consumer builds. But at least the consumer knows when it's happening rather than it failing silently during install.
3. **Validate the dist before serving in `server.ts`.** Defensive layer regardless of the above — check for a sentinel file (e.g. `dist/.build-complete` written as the final step of `vite build`) before treating the admin as built. If the sentinel is missing, return a clear "admin is rebuilding / failed to build, run `cms build`" message rather than serving a corrupted bundle.

**Knock-on effect — `cms build` rebuilds admin unconditionally:** even when the consumer only changes theme code (frontend pages, components), `bun run build` runs the heavy admin Vite step. For a frontend-only deploy, the admin rebuild is wasted work and the dominant OOM risk. `cms build` should either skip admin when its source is unchanged (timestamp/hash check on `packages/admin/src/` vs `packages/admin/dist/`) or expose a `--frontend-only` flag. Right now the consumer workaround is `bunx astro build`, which sidesteps the CMS CLI entirely — fine but undocumented.

---

**Resolution (2026-05-12)** — implemented option 1 (ship pre-built) + option 3 (sentinel safety net):

1. Removed the `postinstall: "bun run build:assets"` hook from root `package.json`. `bun install` on a server no longer touches the admin.
2. Added a tiny `kritano:build-sentinel` Vite plugin in `packages/admin/vite.config.ts` that writes `dist/.build-complete` (ISO timestamp) as its `closeBundle` hook — only present when the build finished successfully.
3. `server.ts` now checks for `packages/admin/dist/.build-complete` rather than just the directory's existence. If the directory exists but the sentinel is missing (= OOM-killed partial build), the server logs a warning and serves a clear 503 page at `/admin` with recovery instructions instead of a broken bundle.
4. Updated `.gitignore` to track `packages/admin/dist/` (all other dist directories remain gitignored). The admin is now committed to the repo, the way Strapi/Payload/Directus do it.
5. Rebuilt `packages/admin/dist/` and committed it as the first pre-built shipped state.
6. Docs updated: `README.md`, `CONTRIBUTING.md` (added build-and-commit-dist step to PR checklist), `CLAUDE.md`, `docs/deployment.md` (new "Releasing (maintainers)" section), `docs/updating.md`.

**Knock-on effect — still open.** `cms build` (`packages/cli/src/commands/build.ts:26`) continues to rebuild the admin unconditionally. With the admin now pre-built and committed, the rebuild on `cms build` is redundant for consumers — but is harmless if it succeeds. The remaining work is to default `cms build` to frontend-only and add a `--admin` flag for the rare case someone has forked the admin source. Tracked as a follow-up so the change can be reviewed separately from this fix.