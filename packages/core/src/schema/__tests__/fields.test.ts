import { describe, expect, test } from 'bun:test'
import {
  text, textarea, richText, slug, url, number, boolean, datetime,
  select, multiSelect, media, relation, seoBlock, blocks, block,
  array, colour,
} from '../fields'

describe('field builders', () => {
  test('text() produces correct base definition', () => {
    const def = text().toDefinition()
    expect(def.type).toBe('text')
    expect(def.required).toBeUndefined()
    expect(def.nullable).toBeUndefined()
  })

  test('text() chaining: required, min, max, pattern', () => {
    const def = text().required().min(3).max(100).pattern('^[a-z]+$').toDefinition()
    expect(def).toEqual({
      type: 'text',
      required: true,
      min: 3,
      max: 100,
      pattern: '^[a-z]+$',
    })
  })

  test('textarea() with maxLength', () => {
    const def = textarea().maxLength(300).toDefinition()
    expect(def.type).toBe('textarea')
    expect(def.maxLength).toBe(300)
  })

  test('richText() basic', () => {
    expect(richText().toDefinition().type).toBe('richText')
  })

  test('slug() with from()', () => {
    const def = slug().from('title').toDefinition()
    expect(def.type).toBe('slug')
    expect(def.from).toBe('title')
  })

  test('url() basic', () => {
    expect(url().toDefinition().type).toBe('url')
  })

  test('number() with min, max, integer', () => {
    const def = number().min(0).max(100).integer().toDefinition()
    expect(def).toEqual({
      type: 'number',
      min: 0,
      max: 100,
      integer: true,
    })
  })

  test('boolean() basic', () => {
    expect(boolean().toDefinition().type).toBe('boolean')
  })

  test('datetime() nullable', () => {
    const def = datetime().nullable().toDefinition()
    expect(def.type).toBe('datetime')
    expect(def.nullable).toBe(true)
  })

  test('select() with options and default', () => {
    const def = select(['draft', 'published']).default('draft').toDefinition()
    expect(def.type).toBe('select')
    expect(def.options).toEqual(['draft', 'published'])
    expect(def.default).toBe('draft')
  })

  test('multiSelect() with options', () => {
    const def = multiSelect(['red', 'green', 'blue']).toDefinition()
    expect(def.type).toBe('multiSelect')
    expect(def.options).toEqual(['red', 'green', 'blue'])
  })

  test('media() basic', () => {
    expect(media().toDefinition().type).toBe('media')
  })

  test('relation() with target', () => {
    const def = relation('user').toDefinition()
    expect(def.type).toBe('relation')
    expect(def.target).toBe('user')
  })

  test('seoBlock() basic', () => {
    expect(seoBlock().toDefinition().type).toBe('seoBlock')
  })

  test('colour() basic', () => {
    expect(colour().toDefinition().type).toBe('colour')
  })

  test('array() wraps another field type', () => {
    const def = array(media()).toDefinition()
    expect(def.type).toBe('array')
    expect(def.of).toEqual({ type: 'media' })
  })

  test('array(text()) wraps text', () => {
    const def = array(text()).toDefinition()
    expect(def.type).toBe('array')
    expect(def.of).toEqual({ type: 'text' })
  })

  test('blocks() with block definitions', () => {
    const def = blocks([
      block('hero', {
        heading: text().required(),
        image: media(),
      }),
      block('cta', {
        label: text().required(),
        url: url(),
      }),
    ]).toDefinition()

    expect(def.type).toBe('blocks')
    expect(def.blocks).toHaveLength(2)
    expect(def.blocks[0].name).toBe('hero')
    expect(def.blocks[0].fields.heading).toEqual({ type: 'text', required: true })
    expect(def.blocks[0].fields.image).toEqual({ type: 'media' })
    expect(def.blocks[1].name).toBe('cta')
  })

  test('all builders support nullable()', () => {
    const builders = [
      text(), textarea(), richText(), slug(), url(), number(),
      boolean(), datetime(), select(['a']), multiSelect(['a']),
      media(), relation('x'), seoBlock(), colour(),
    ]
    for (const b of builders) {
      const def = b.nullable().toDefinition()
      expect(def.nullable).toBe(true)
    }
  })

  test('all builders support default()', () => {
    const def = text().default('hello').toDefinition()
    expect(def.default).toBe('hello')
  })
})
