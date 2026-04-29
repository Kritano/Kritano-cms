import { $ } from 'bun'
import { log } from './logger'

export async function ensureDockerRunning(): Promise<void> {
  try {
    const result = await $`docker compose ps --format json`.quiet()
    const output = result.text()
    const running = output.trim().length > 0
    if (running) {
      log.step('Docker Compose services already running')
      return
    }
  } catch {
    // Not running or docker not available
  }

  log.step('Starting Docker Compose services (Postgres, Redis)…')
  try {
    await $`docker compose up -d`.quiet()
    // Wait for Postgres to be ready
    log.step('Waiting for PostgreSQL to be ready…')
    for (let i = 0; i < 30; i++) {
      try {
        await $`docker compose exec -T postgres pg_isready -U cms`.quiet()
        log.success('PostgreSQL is ready')
        return
      } catch {
        await Bun.sleep(1000)
      }
    }
    log.warn('PostgreSQL may not be ready yet — continuing anyway')
  } catch (err) {
    log.warn('Could not start Docker Compose. Make sure Docker is running.')
  }
}
