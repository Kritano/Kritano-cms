import { beforeEach, describe, expect, test } from 'bun:test'
import type { CmsConfig } from '@kritano/cms/types'
import { addForm, resetDeclaredForms } from '../../schema/addForm'
import { email, text } from '../../schema/fields'
import {
  clearGdprSources,
  discoverCollectionsSources,
  discoverFormsSources,
  findEmailFieldInForm,
  getGdprSource,
  getRegisteredSources,
  initGdpr,
  pickFormSourceFromDbRow,
  registerGdprSource,
} from '../registry'

function fakeConfig(collections: CmsConfig['collections']): CmsConfig {
  return {
    site: {
      name: 'Test',
      url: 'http://localhost',
      domain: 'localhost',
      language: 'en',
    },
    collections,
  } as CmsConfig
}

beforeEach(() => {
  clearGdprSources()
  resetDeclaredForms()
})

describe('registerGdprSource', () => {
  test('adds a source', () => {
    registerGdprSource({
      name: 'custom:audit',
      table: 'audit_submissions',
      emailColumn: 'email',
    })
    expect(getRegisteredSources()).toHaveLength(1)
    expect(getGdprSource('custom:audit')?.table).toBe('audit_submissions')
  })

  test('re-registering the same name overwrites (idempotent)', () => {
    registerGdprSource({ name: 'custom:x', table: 't1', emailColumn: 'email' })
    registerGdprSource({ name: 'custom:x', table: 't2', emailColumn: 'email' })
    expect(getRegisteredSources()).toHaveLength(1)
    expect(getGdprSource('custom:x')?.table).toBe('t2')
  })

  test('defaults autoDiscovered to false for manual registrations', () => {
    registerGdprSource({ name: 'custom:x', table: 't', emailColumn: 'email' })
    expect(getGdprSource('custom:x')?.autoDiscovered).toBe(false)
  })

  test('clearGdprSources empties the registry', () => {
    registerGdprSource({ name: 'custom:x', table: 't', emailColumn: 'email' })
    clearGdprSources()
    expect(getRegisteredSources()).toHaveLength(0)
  })
})

describe('discoverFormsSources', () => {
  test('registers forms that have an email-typed field', () => {
    addForm('contact', {
      fields: [
        { name: 'email', type: 'email', label: 'Email', required: true },
        { name: 'name', type: 'text', label: 'Name' },
      ],
    })
    const discovered = discoverFormsSources()
    expect(discovered).toHaveLength(1)
    expect(discovered[0].name).toBe('form:contact')
    expect(discovered[0].emailColumn).toBe('email')
    expect(discovered[0].autoDiscovered).toBe(true)
    expect(discovered[0].table).toBe('form_submissions')
  })

  test('uses the first email field when multiple exist', () => {
    addForm('multi', {
      fields: [
        { name: 'workEmail', type: 'email', label: 'Work email' },
        { name: 'personalEmail', type: 'email', label: 'Personal email' },
      ],
    })
    const discovered = discoverFormsSources()
    expect(discovered[0].emailColumn).toBe('workEmail')
  })

  test('skips forms without any email field', () => {
    addForm('feedback', {
      fields: [{ name: 'message', type: 'textarea', label: 'Message' }],
    })
    expect(discoverFormsSources()).toHaveLength(0)
    expect(getRegisteredSources()).toHaveLength(0)
  })

  test('falls back to name heuristic when no email-typed field exists', () => {
    // Admin-builder forms sometimes emit type:'text' for email fields.
    addForm('resource-gate', {
      fields: [
        { name: 'name',  type: 'text', label: 'Name' },
        { name: 'email', type: 'text', label: 'Email' }, // ← type:'text' but matches name heuristic
      ],
    })
    const discovered = discoverFormsSources()
    expect(discovered).toHaveLength(1)
    expect(discovered[0].emailColumn).toBe('email')
  })

  test('explicit type:"email" wins over name heuristic', () => {
    addForm('multi-email', {
      fields: [
        { name: 'name',          type: 'text',  label: 'Name' },
        { name: 'companyEmail',  type: 'text',  label: 'Company email' },  // heuristic-matchable
        { name: 'workAddress',   type: 'email', label: 'Work email' },     // explicit type
      ],
    })
    const discovered = discoverFormsSources()
    expect(discovered[0].emailColumn).toBe('workAddress')
  })
})

describe('findEmailFieldInForm (pure helper)', () => {
  test('returns name of first type:email field', () => {
    expect(findEmailFieldInForm([
      { name: 'a', type: 'text' },
      { name: 'b', type: 'email' },
      { name: 'c', type: 'email' },
    ])).toBe('b')
  })

  test('falls back to name match', () => {
    expect(findEmailFieldInForm([
      { name: 'fullName', type: 'text' },
      { name: 'contact_email', type: 'text' },
    ])).toBe('contact_email')
  })

  test('returns undefined for forms without any candidate', () => {
    expect(findEmailFieldInForm([
      { name: 'message', type: 'textarea' },
      { name: 'phone', type: 'phone' },
    ])).toBeUndefined()
  })
})

describe('pickFormSourceFromDbRow', () => {
  test('builds a source from a forms-table row with type:email', () => {
    const source = pickFormSourceFromDbRow({
      slug: 'contact',
      name: 'Contact',
      fields: [
        { name: 'name',  type: 'text',  label: 'Name' },
        { name: 'email', type: 'email', label: 'Email' },
      ],
    })
    expect(source).not.toBeNull()
    expect(source!.name).toBe('form:contact')
    expect(source!.displayName).toBe('Contact (form submission)')
    expect(source!.emailColumn).toBe('email')
    expect(source!.table).toBe('form_submissions')
    expect(source!.autoDiscovered).toBe(true)
  })

  test('uses name heuristic for admin-builder forms with type:text', () => {
    const source = pickFormSourceFromDbRow({
      slug: 'resource-gate',
      name: 'Resource gate',
      fields: [
        { name: 'name',  type: 'text', label: 'Name' },
        { name: 'email', type: 'text', label: 'Email' },
      ],
    })
    expect(source).not.toBeNull()
    expect(source!.emailColumn).toBe('email')
  })

  test('returns null when no email-shaped field is present', () => {
    const source = pickFormSourceFromDbRow({
      slug: 'feedback',
      name: 'Feedback',
      fields: [{ name: 'message', type: 'textarea' }],
    })
    expect(source).toBeNull()
  })

  test('tolerates a non-array fields value', () => {
    const source = pickFormSourceFromDbRow({
      slug: 'broken',
      name: 'Broken',
      fields: 'not-an-array' as unknown,
    })
    expect(source).toBeNull()
  })

  test('skips field entries with missing name/type', () => {
    const source = pickFormSourceFromDbRow({
      slug: 'partial',
      name: 'Partial',
      fields: [
        { name: 'email' },                  // missing type
        { type: 'email' },                  // missing name
        { name: 'realEmail', type: 'email' },
      ],
    })
    expect(source!.emailColumn).toBe('realEmail')
  })
})

describe('discoverCollectionsSources', () => {
  test('picks up collections with explicit email() field', () => {
    const config = fakeConfig([
      {
        name: 'subscriber',
        fields: {
          email: email().required().toDefinition(),
          name: text().toDefinition(),
        },
      },
    ])
    const discovered = discoverCollectionsSources(config)
    expect(discovered).toHaveLength(1)
    expect(discovered[0].name).toBe('collection:subscriber')
    expect(discovered[0].emailColumn).toBe('email')
    expect(discovered[0].table).toBe('subscribers')
  })

  test('falls back to the name heuristic on plain text fields', () => {
    const config = fakeConfig([
      {
        name: 'lead',
        fields: {
          email: text().toDefinition(),
          companyName: text().toDefinition(),
        },
      },
    ])
    const discovered = discoverCollectionsSources(config)
    expect(discovered).toHaveLength(1)
    expect(discovered[0].emailColumn).toBe('email')
  })

  test('name heuristic matches *_email and *Email patterns', () => {
    const config = fakeConfig([
      {
        name: 'contact',
        fields: { contact_email: text().toDefinition() },
      },
      {
        name: 'order',
        fields: { customerEmail: text().toDefinition() },
      },
    ])
    const discovered = discoverCollectionsSources(config)
    expect(discovered).toHaveLength(2)
    expect(discovered.find((d) => d.name === 'collection:contact')?.emailColumn).toBe('contact_email')
    expect(discovered.find((d) => d.name === 'collection:order')?.emailColumn).toBe('customer_email')
  })

  test('skips collections with no email-shaped field', () => {
    const config = fakeConfig([
      {
        name: 'article',
        fields: { title: text().toDefinition(), body: text().toDefinition() },
      },
    ])
    expect(discoverCollectionsSources(config)).toHaveLength(0)
  })

  test('prefers format:"email" over name heuristic when both present', () => {
    // A field named `slug` shouldn't match the name heuristic but explicitly
    // marking it `format: 'email'` should win. (Contrived, but documents
    // precedence.)
    const config = fakeConfig([
      {
        name: 'weird',
        fields: {
          contactPoint: email().toDefinition(),
          email: text().toDefinition(),
        },
      },
    ])
    const discovered = discoverCollectionsSources(config)
    // emailColumn is the Postgres column name, so camelCase → snake_case
    expect(discovered[0].emailColumn).toBe('contact_point')
  })
})

describe('initGdpr', () => {
  test('runs both discovery passes and returns counts', () => {
    addForm('signup', {
      fields: [{ name: 'email', type: 'email', label: 'Email' }],
    })
    const config = fakeConfig([
      {
        name: 'subscriber',
        fields: { email: email().toDefinition() },
      },
    ])

    const result = initGdpr(config)
    expect(result.formsDiscovered).toBe(1)
    expect(result.collectionsDiscovered).toBe(1)
    expect(result.totalSources).toBe(2)
  })

  test('does not clear manually registered sources', () => {
    registerGdprSource({
      name: 'custom:keep-me',
      table: 'audit_submissions',
      emailColumn: 'email',
    })
    initGdpr(fakeConfig([]))
    expect(getGdprSource('custom:keep-me')).toBeDefined()
  })
})
