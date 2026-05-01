#!/usr/bin/env bun

import { getClient, closeConnection } from '#core'
import bcrypt from 'bcryptjs'

async function seed() {
  const sql = getClient()

  // Check if admin user exists
  const existing = await sql`SELECT id FROM users WHERE email = 'admin@cms.local' LIMIT 1`
  if (existing.length > 0) {
    console.log('Admin user already exists')
    await closeConnection()
    return
  }

  const hash = await bcrypt.hash('admin', 10)
  await sql`
    INSERT INTO users (email, password_hash, name)
    VALUES ('admin@cms.local', ${hash}, 'Admin')
  `

  console.log('✓ Admin user created:')
  console.log('  Email:    admin@cms.local')
  console.log('  Password: admin')

  await closeConnection()
}

seed().catch((err) => {
  console.error('Seed failed:', err.message)
  process.exit(1)
})
