import { describe, expect, it } from 'vitest'
import { MIN_BENCH, PINNED_BENCH, atLeast } from './versions.mjs'

describe('atLeast', () => {
  it.each([
    ['2.3.0', '2.3.0', true],
    ['2.4.0', '2.3.0', true],
    ['2.10.0', '2.3.0', true],
    ['3.0.0', '2.9.9', true],
    ['2.2.9', '2.3.0', false],
    ['2.1.0', '2.3.0', false],
    ['1.9.0', '2.0.0', false],
  ])('%s is at least %s: %s', (version, min, expected) => {
    expect(atLeast(version, min)).toBe(expected)
  })
})

describe('the supported range', () => {
  it('pins a bench no older than the minimum', () => {
    expect(atLeast(PINNED_BENCH, MIN_BENCH)).toBe(true)
  })
})
