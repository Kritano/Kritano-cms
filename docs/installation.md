# Installation

Three ways to install Kritano CMS, depending on your preference and technical level.

---

## Developer install

The fastest way to start. Install the CLI globally, scaffold a project, run the dev server.

```bash
bun install -g @kritano/cms
cms create my-site
cd my-site
bun run dev
```

Or without installing the CLI globally:

```bash
bunx @kritano/create-cms my-site
cd my-site
bun run dev
```

### Starter templates

```bash
cms create my-site --starter default     # Pages + articles (clean slate)
cms create my-site --starter blog        # Blog with categories, tags, authors
cms create my-site --starter portfolio   # Projects, case studies, about
cms create my-site --starter business    # Pages, blog, team, services, testimonials
```

### Options

| Flag | Description |
|------|-------------|
| `--starter <name>` | Use a specific starter template |
| `--no-git` | Skip git init |
| `--no-install` | Copy files only, skip `bun install` |
| `--yes` | Accept all defaults, skip prompts |

### Prerequisites

- [Bun](https://bun.sh) — `curl -fsSL https://bun.sh/install | bash`
- [Docker Desktop](https://docker.com/products/docker-desktop) — must be running

### What gets created

```
my-site/
├── cms.config.ts       ← Your content schema
├── package.json        ← @kritano/cms as a dependency
├── .env                ← Generated with secure random secrets
├── .gitignore
├── bun.lock
└── migrations/         ← Auto-generated, commit these
```

The CMS internals live in `node_modules/@kritano/cms`. You never edit them. Updates via `bun update @kritano/cms` never touch your files.

---

## Browser installer

For users who prefer not to work in a terminal beyond running one installation script on their server.

### 1. Get a server

Any Ubuntu 22.04 or 24.04 VPS. Hetzner CAX11 (around 4 EUR/month) is recommended for most sites.

### 2. Run the installation script

SSH into your server and run:

```bash
curl -fsSL https://get.kritano.com | bash
```

This installs the CMS on your server. When it completes, visit your server's IP address or domain in a browser.

### 3. Complete the web wizard

A five-step setup wizard walks you through:

1. **Welcome** — introduction
2. **Your account** — create admin email and password (min 12 characters)
3. **Your site** — name, domain, language
4. **Choose a starter** — default, blog, portfolio, or business
5. **Complete** — logged in and ready to go

After completing the wizard you're taken directly to the admin. No more terminal required.

### How it works

The installer detects that no admin user exists in the database and shows the setup wizard instead of the login page. Once setup is complete, the installer never shows again — `/install` redirects to `/admin`.

---

## Manual install

For users who want full control over the installation.

```bash
git clone https://github.com/Kritano/Kritano-cms.git my-site
cd my-site
cp .env.example .env
# Edit .env with your configuration
bun install
bun run migrate
bun run dev
```

**Note:** With the manual install you are cloning the CMS repo directly. Updates require `git pull` and may conflict with local changes. For most users the `cms create` path is recommended.

---

## What's running

| Service | URL | Description |
|---------|-----|-------------|
| Admin | http://localhost:3006/admin | Content management UI |
| Frontend | http://localhost:3006 | Your site (default theme) |
| API | http://localhost:3005/api | REST API |
| GraphQL | http://localhost:3005/api/graphql | GraphQL endpoint |
