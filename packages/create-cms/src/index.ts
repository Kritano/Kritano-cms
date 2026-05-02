#!/usr/bin/env bun

// Thin wrapper — delegates to the main CLI's create command
// Usage: bunx @kritano/create-cms my-site

// Shift argv so the create command sees the project name as argv[3]
process.argv = [process.argv[0], process.argv[1], 'create', ...process.argv.slice(2)]

await import('../../cli/src/commands/create')
