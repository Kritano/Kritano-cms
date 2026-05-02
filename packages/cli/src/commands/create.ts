import { $ } from 'bun'
import crypto from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync, cpSync, readdirSync } from 'node:fs'
import { resolve, join, dirname } from 'node:path'
import { log } from '../utils/logger'

const STARTERS = ['default', 'blog', 'portfolio', 'business'] as const
type Starter = typeof STARTERS[number]

const STARTER_DESCRIPTIONS: Record<Starter, string> = {
  default: 'Pages and articles, clean slate',
  blog: 'Blog-focused with tags, categories, featured posts',
  portfolio: 'Projects, case studies, about page',
  business: 'Pages, blog, team, services, contact form',
}

function getTemplatesDir(): string {
  const thisDir = dirname(new URL(import.meta.url).pathname)
  return resolve(thisDir, '..', '..', 'templates')
}

export async function create() {
  let projectName = process.argv[3]
  const args = process.argv.slice(3)

  const noGit = args.includes('--no-git')
  const noInstall = args.includes('--no-install')
  const yesMode = args.includes('--yes') || args.includes('-y')
  let starter: Starter = 'default'

  // Parse --starter option
  const starterIdx = args.indexOf('--starter')
  if (starterIdx !== -1 && args[starterIdx + 1]) {
    const s = args[starterIdx + 1] as Starter
    if (STARTERS.includes(s)) {
      starter = s
    } else {
      log.error(`Unknown starter: ${s}. Available: ${STARTERS.join(', ')}`)
      process.exit(1)
    }
  }

  // Get project name (first non-flag arg)
  if (!projectName || projectName.startsWith('--')) {
    if (yesMode) {
      projectName = 'my-site'
    } else {
      projectName = await promptText('What would you like to call your site?', 'my-site')
    }
  }

  // Interactive starter selection
  if (starterIdx === -1 && !yesMode) {
    starter = await promptStarter()
  }

  // Interactive git/install prompts
  let shouldGit = !noGit
  let shouldInstall = !noInstall

  if (!yesMode && !noGit) {
    shouldGit = await promptYesNo('Initialise a git repository?', true)
  }
  if (!yesMode && !noInstall) {
    shouldInstall = await promptYesNo('Install dependencies now?', true)
  }

  const projectDir = resolve(process.cwd(), projectName)

  if (existsSync(projectDir)) {
    log.error(`Directory "${projectName}" already exists.`)
    process.exit(1)
  }

  console.log('')
  log.step(`Creating Kritano CMS site in ./${projectName}`)
  console.log('')

  // 1. Copy scaffold template
  const templatesDir = getTemplatesDir()
  const starterDir = join(templatesDir, starter)

  if (!existsSync(starterDir)) {
    log.error(`Starter template "${starter}" not found at ${starterDir}`)
    process.exit(1)
  }

  mkdirSync(projectDir, { recursive: true })

  // Copy all non-template files
  copyDir(starterDir, projectDir)
  log.success('Scaffold copied')

  // 2. Process .template files
  const siteName = projectName.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  const jwtSecret = crypto.randomBytes(32).toString('hex')
  const refreshSecret = crypto.randomBytes(32).toString('hex')
  const cmsVersion = '0.4.0'

  const replacements: Record<string, string> = {
    '{{SITE_NAME}}': siteName,
    '{{JWT_SECRET}}': jwtSecret,
    '{{REFRESH_SECRET}}': refreshSecret,
    '{{VERSION}}': cmsVersion,
    '{{PROJECT_NAME}}': projectName,
  }

  processTemplates(projectDir, replacements)
  log.success('.env generated with secure secrets')

  // 3. Write .gitignore if not from template
  if (!existsSync(join(projectDir, '.gitignore'))) {
    writeFileSync(join(projectDir, '.gitignore'), `node_modules/
dist/
.env
media/
*.local
`)
  }

  // 4. Write README
  if (!existsSync(join(projectDir, 'README.md'))) {
    writeFileSync(join(projectDir, 'README.md'), `# ${siteName}

Built with [Kritano CMS](https://kritano.com).

## Development

\`\`\`bash
bun run dev
\`\`\`

## Documentation

See [docs.kritano.com](https://docs.kritano.com)
`)
  }

  // 5. Git init
  if (shouldGit) {
    try {
      await $`git init ${projectDir}`.quiet()
    } catch {}
  }

  // 6. Install dependencies
  if (shouldInstall) {
    log.step('Installing dependencies…')
    try {
      await $`cd ${projectDir} && bun install`.quiet()
      log.success('Dependencies installed')
    } catch (err) {
      log.warn('Failed to install dependencies. Run "bun install" manually.')
    }

    // 7. Run migrations
    log.step('Running migrations…')
    try {
      await $`cd ${projectDir} && bun run migrate`.quiet()
      log.success('Database migrated')
    } catch {
      log.warn('Migration skipped — run "bun run migrate" after starting Docker.')
    }
  }

  // Success message
  console.log('')
  log.success('Your site is ready.')
  console.log('')
  console.log('  ┌─────────────────────────────────────────────┐')
  console.log('  │                                             │')
  console.log(`  │   cd ${projectName.padEnd(38)}│`)
  console.log('  │   bun run dev                               │')
  console.log('  │                                             │')
  console.log('  │   Admin:    http://localhost:3006/admin      │')
  console.log('  │   Site:     http://localhost:3006            │')
  console.log('  │                                             │')
  console.log('  │   Email:    cms-admin@kritano.com                 │')
  console.log('  │   Password: admin                           │')
  console.log('  │                                             │')
  console.log('  └─────────────────────────────────────────────┘')
  console.log('')
  log.warn('Change your password after first login.')
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function copyDir(src: string, dest: string) {
  if (!existsSync(dest)) mkdirSync(dest, { recursive: true })

  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const srcPath = join(src, entry.name)
    const destPath = join(dest, entry.name)

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath)
    } else {
      // .template files are copied without the .template extension
      const finalName = entry.name.endsWith('.template')
        ? entry.name.replace('.template', '')
        : entry.name
      const finalPath = join(dest, finalName)

      const content = readFileSync(srcPath, 'utf-8')
      writeFileSync(finalPath, content)
    }
  }
}

function processTemplates(dir: string, replacements: Record<string, string>) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name)

    if (entry.isDirectory()) {
      processTemplates(fullPath, replacements)
      continue
    }

    // Only process text files
    if (!entry.name.match(/\.(ts|tsx|json|env|md|yaml|yml|toml|txt)$/)) continue

    let content = readFileSync(fullPath, 'utf-8')
    let changed = false

    for (const [placeholder, value] of Object.entries(replacements)) {
      if (content.includes(placeholder)) {
        content = content.replaceAll(placeholder, value)
        changed = true
      }
    }

    if (changed) {
      writeFileSync(fullPath, content)
    }
  }
}

async function promptText(message: string, defaultVal: string): Promise<string> {
  process.stdout.write(`  ${message} (${defaultVal}) › `)
  const buf = Buffer.alloc(256)
  const fd = require('node:fs').openSync('/dev/stdin', 'r')
  const bytesRead = require('node:fs').readSync(fd, buf, 0, 256, null)
  require('node:fs').closeSync(fd)
  const answer = buf.toString('utf-8', 0, bytesRead).trim()
  return answer || defaultVal
}

async function promptYesNo(message: string, defaultYes: boolean): Promise<boolean> {
  const suffix = defaultYes ? '[Y/n]' : '[y/N]'
  process.stdout.write(`  ${message} ${suffix} `)
  const buf = Buffer.alloc(64)
  const fd = require('node:fs').openSync('/dev/stdin', 'r')
  const bytesRead = require('node:fs').readSync(fd, buf, 0, 64, null)
  require('node:fs').closeSync(fd)
  const answer = buf.toString('utf-8', 0, bytesRead).trim().toLowerCase()
  if (answer === '') return defaultYes
  return answer === 'y' || answer === 'yes'
}

async function promptStarter(): Promise<Starter> {
  console.log('  Choose a starter template:')
  console.log('')
  for (let i = 0; i < STARTERS.length; i++) {
    const s = STARTERS[i]
    const label = s.charAt(0).toUpperCase() + s.slice(1)
    console.log(`    ${i + 1}) ${label.padEnd(12)} — ${STARTER_DESCRIPTIONS[s]}`)
  }
  console.log('')
  process.stdout.write('  Enter number (1): ')
  const buf = Buffer.alloc(64)
  const fd = require('node:fs').openSync('/dev/stdin', 'r')
  const bytesRead = require('node:fs').readSync(fd, buf, 0, 64, null)
  require('node:fs').closeSync(fd)
  const answer = buf.toString('utf-8', 0, bytesRead).trim()
  const idx = parseInt(answer, 10) - 1
  if (idx >= 0 && idx < STARTERS.length) return STARTERS[idx]
  return 'default'
}

// Run directly
if (import.meta.main) {
  await create()
}
