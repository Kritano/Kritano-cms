import { execSync } from 'node:child_process'
import { getClient } from '../db/client'

const GITHUB_REPO = 'Kritano/Kritano-cms'
const CMS_VERSION = '0.3.0'

export interface UpdateCheckResult {
  mode: 'development' | 'release'
  updateAvailable: boolean
  current: {
    sha?: string
    shortSha?: string
    committedAt?: string
    version?: string
  }
  latest: {
    sha?: string
    shortSha?: string
    committedAt?: string
    commitsAhead?: number
    version?: string
  }
  updateType?: 'patch' | 'minor' | 'major'
  recentCommits?: Array<{ sha: string; message: string; date: string }>
  changelogUrl?: string
  checkedAt: string
}

function getUpdateChannel(): 'development' | 'release' {
  return (process.env.CMS_UPDATE_CHANNEL as 'development' | 'release') || 'development'
}

function getCurrentSha(): string | null {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim()
  } catch {
    return null
  }
}

function getCurrentCommitDate(): string | null {
  try {
    return execSync('git log -1 --format=%cI', { encoding: 'utf-8' }).trim()
  } catch {
    return null
  }
}

/** Check for updates via GitHub API (development mode) */
async function checkDevelopmentUpdates(): Promise<UpdateCheckResult> {
  const currentSha = getCurrentSha()
  const currentDate = getCurrentCommitDate()

  const now = new Date().toISOString()

  if (!currentSha) {
    return {
      mode: 'development',
      updateAvailable: false,
      current: {},
      latest: {},
      checkedAt: now,
    }
  }

  try {
    // Get latest commit on main
    const latestRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/commits/main`, {
      headers: { Accept: 'application/json', 'User-Agent': 'Kritano-CMS' },
    })

    if (!latestRes.ok) {
      return {
        mode: 'development',
        updateAvailable: false,
        current: { sha: currentSha, shortSha: currentSha.slice(0, 7), committedAt: currentDate || undefined },
        latest: {},
        checkedAt: now,
      }
    }

    const latestData = await latestRes.json() as Record<string, unknown>
    const latestSha = latestData.sha as string
    const latestCommit = latestData.commit as Record<string, unknown>
    const latestCommitter = latestCommit?.committer as Record<string, unknown>
    const latestDate = latestCommitter?.date as string

    const updateAvailable = currentSha !== latestSha

    // Get recent commits if update available
    let recentCommits: Array<{ sha: string; message: string; date: string }> = []
    let commitsAhead = 0

    if (updateAvailable) {
      try {
        const compareRes = await fetch(
          `https://api.github.com/repos/${GITHUB_REPO}/compare/${currentSha.slice(0, 7)}...main`,
          { headers: { Accept: 'application/json', 'User-Agent': 'Kritano-CMS' } },
        )

        if (compareRes.ok) {
          const compareData = await compareRes.json() as Record<string, unknown>
          commitsAhead = (compareData.ahead_by as number) || 0
          const commits = (compareData.commits as Array<Record<string, unknown>>) || []

          recentCommits = commits.slice(-5).reverse().map((c) => ({
            sha: (c.sha as string).slice(0, 7),
            message: ((c.commit as Record<string, unknown>)?.message as string || '').split('\n')[0],
            date: (((c.commit as Record<string, unknown>)?.committer as Record<string, unknown>)?.date as string) || '',
          }))
        }
      } catch {}
    }

    return {
      mode: 'development',
      updateAvailable,
      current: {
        sha: currentSha,
        shortSha: currentSha.slice(0, 7),
        committedAt: currentDate || undefined,
      },
      latest: {
        sha: latestSha,
        shortSha: latestSha.slice(0, 7),
        committedAt: latestDate,
        commitsAhead,
      },
      recentCommits,
      checkedAt: now,
    }
  } catch {
    return {
      mode: 'development',
      updateAvailable: false,
      current: { sha: currentSha, shortSha: currentSha.slice(0, 7) },
      latest: {},
      checkedAt: now,
    }
  }
}

/** Check for updates via npm registry (release mode) */
async function checkReleaseUpdates(): Promise<UpdateCheckResult> {
  const now = new Date().toISOString()

  try {
    const res = await fetch('https://registry.npmjs.org/@kritano/cms/latest', {
      headers: { Accept: 'application/json' },
    })

    if (!res.ok) {
      return { mode: 'release', updateAvailable: false, current: { version: CMS_VERSION }, latest: {}, checkedAt: now }
    }

    const data = await res.json() as Record<string, unknown>
    const latestVersion = data.version as string

    const updateAvailable = latestVersion !== CMS_VERSION
    let updateType: 'patch' | 'minor' | 'major' | undefined

    if (updateAvailable) {
      const [curMajor, curMinor] = CMS_VERSION.split('.').map(Number)
      const [latMajor, latMinor] = latestVersion.split('.').map(Number)

      if (latMajor > curMajor) updateType = 'major'
      else if (latMinor > curMinor) updateType = 'minor'
      else updateType = 'patch'
    }

    return {
      mode: 'release',
      updateAvailable,
      current: { version: CMS_VERSION },
      latest: { version: latestVersion },
      updateType,
      changelogUrl: `https://github.com/${GITHUB_REPO}/blob/main/CHANGELOG.md`,
      checkedAt: now,
    }
  } catch {
    return { mode: 'release', updateAvailable: false, current: { version: CMS_VERSION }, latest: {}, checkedAt: now }
  }
}

/** Run an update check and cache the result */
export async function checkForUpdates(): Promise<UpdateCheckResult> {
  const channel = getUpdateChannel()
  const result = channel === 'release'
    ? await checkReleaseUpdates()
    : await checkDevelopmentUpdates()

  // Cache in database
  try {
    const sql = getClient()
    await sql`DELETE FROM update_cache`
    await sql`INSERT INTO update_cache (result) VALUES (${JSON.stringify(result)}::jsonb)`
  } catch {}

  return result
}

/** Get cached update check result */
export async function getCachedUpdateCheck(): Promise<UpdateCheckResult | null> {
  try {
    const sql = getClient()
    const rows = await sql`SELECT result, checked_at FROM update_cache ORDER BY checked_at DESC LIMIT 1`
    if (rows.length === 0) return null
    return (rows[0] as Record<string, unknown>).result as UpdateCheckResult
  } catch {
    return null
  }
}

/** Dismiss update notification for a user (7 days) */
export async function dismissUpdate(userId: string): Promise<void> {
  const sql = getClient()
  const dismissUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  await sql`UPDATE users SET update_dismissed_until = ${dismissUntil} WHERE id = ${userId}`
}

/** Check if user has dismissed the update notification */
export async function isUpdateDismissed(userId: string): Promise<boolean> {
  const sql = getClient()
  const rows = await sql`SELECT update_dismissed_until FROM users WHERE id = ${userId} LIMIT 1`
  if (rows.length === 0) return false
  const until = (rows[0] as Record<string, unknown>).update_dismissed_until as string | null
  if (!until) return false
  return new Date(until) > new Date()
}
