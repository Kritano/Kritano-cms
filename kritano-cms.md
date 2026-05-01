# Kritano CMS — Enable GitHub dependency consumption

Changes needed on the `Kritano/Kritano-cms` repo so that external projects can install it directly from GitHub as a single dependency.

---

## What to change

### 1. Update root `package.json`

Add `exports`, `bin`, and `type` fields to the existing root `package.json`:

```json
{
  "name": "@kritano/cms",
  "private": true,
  "type": "module",
  "workspaces": [
    "packages/*"
  ],
  "bin": {
    "cms": "./packages/cli/src/index.ts"
  },
  "exports": {
    "./core":  "./packages/core/src/index.ts",
    "./admin": "./packages/admin/src/index.ts",
    "./astro": "./packages/astro/src/index.ts",
    "./sdk":   "./packages/sdk/src/index.ts",
    "./cli":   "./packages/cli/src/index.ts",
    "./types": "./packages/types/src/index.ts",
    "./mcp":   "./packages/mcp/src/index.ts"
  },
  "scripts": {
    "build": "bun run --filter '*' build",
    "typecheck": "bun run --filter '*' typecheck"
  },
  "dependencies": {
    "@img/sharp-darwin-arm64": "^0.34.5",
    "date-fns-tz": "^3.2.0",
    "sharp": "^0.34.5"
  }
}
```

**What changed from current:**
- Added `"name": "@kritano/cms"`
- Added `"type": "module"`
- Added `"bin"` — exposes the `cms` CLI command to consumers
- Added `"exports"` — maps subpath imports to each package's source entry

**Why `.ts` source files, not `dist`:** Bun resolves TypeScript directly. Consumers using bun (which the portfolio does) don't need a build step — they import the source. This is the fastest path for development.

### 2. Rename internal package scopes (recommended, not blocking)

The packages are currently scoped `@cms/*`. This scope is likely taken on npm if you ever want to publish there. Renaming to `@kritano/*` now avoids a painful migration later.

This is **not required** for the GitHub dependency approach to work — bun resolves via the root `exports` map, not by individual package names. But it's good hygiene.

If you do rename:
- Update `name` in every `packages/*/package.json`
- Update every `workspace:*` reference (e.g. `"@cms/types": "workspace:*"` → `"@kritano/types": "workspace:*"`)
- Find and replace `@cms/` → `@kritano/` in all `.ts` and `.tsx` source files
- Update any documentation references

### 3. Verify the CLI entry point

The `bin` field points at `packages/cli/src/index.ts`. This file needs a shebang at the top:

```typescript
#!/usr/bin/env bun
```

If it doesn't already have one, add it as the first line of `packages/cli/src/index.ts`.

### 4. Check all sub-package entry points exist

Each export path must resolve. Verify these files exist:

- `packages/core/src/index.ts`
- `packages/admin/src/index.ts`
- `packages/astro/src/index.ts`
- `packages/sdk/src/index.ts`
- `packages/cli/src/index.ts`
- `packages/types/src/index.ts`
- `packages/mcp/src/index.ts`

### 5. Handle sub-package dependencies

When bun installs the CMS from GitHub, it reads the root `package.json` dependencies. But each sub-package has its own dependencies (hono, drizzle, react, etc.) that the root doesn't list.

**Option A — Add all sub-package deps to the root `dependencies`:**

Merge every sub-package's `dependencies` into the root `package.json`. This is the brute-force approach but guarantees everything resolves.

**Option B — Rely on bun's workspace hoisting (should work already):**

Bun installs workspace packages and hoists their dependencies. When installed from GitHub, bun should read the `workspaces` field and install everything. Test this — if the consumer gets missing module errors, fall back to Option A.

---

## That's it

After these changes, any bun project can do:

```bash
bun add github:Kritano/Kritano-cms#main
```

And import like:

```typescript
import { defineConfig } from '@kritano/cms/core'
import { defineTheme } from '@kritano/cms/astro'
```

And run the CLI:

```bash
bunx cms dev
```

---

## Later — npm publishing

When you're ready for stable releases, the npm publishing guide (`npm-publishing-guide.md`) covers the full setup with changesets. The portfolio just swaps one line in `package.json`:

```json
// From:
"@kritano/cms": "github:Kritano/Kritano-cms#main"

// To:
"@kritano/cms": "^0.3.0"
```

Everything else stays the same — same import paths, same CLI command.
