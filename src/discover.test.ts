import { describe, expect, it } from 'vitest'
import { parseFilesInput, selectBenchFiles } from './discover'

describe('parseFilesInput', () => {
  it('splits on newlines and commas, trimming and dropping blanks', () => {
    expect(parseFilesInput(' color ,\nspacing\n\n, ')).toEqual(['color', 'spacing'])
  })

  it('returns an empty selection for an empty input', () => {
    expect(parseFilesInput('')).toEqual([])
  })
})

describe('selectBenchFiles', () => {
  const entries = ['spacing.bench.ts', 'color.bench.ts', 'README.md', 'helper.ts']

  it('runs every *.bench.ts file, sorted, when there is no selection', () => {
    expect(selectBenchFiles(entries, [])).toEqual(['color.bench.ts', 'spacing.bench.ts'])
  })

  it('resolves selected names with or without the suffix, in selection order', () => {
    expect(selectBenchFiles(entries, ['spacing', 'color.bench.ts'])).toEqual([
      'spacing.bench.ts',
      'color.bench.ts',
    ])
  })

  it('rejects a selection that matches nothing, listing what exists', () => {
    expect(() => selectBenchFiles(entries, ['typo'])).toThrow(
      'bench-action: "typo" not found in the bench directory (color.bench.ts, spacing.bench.ts)'
    )
  })

  it('says so when the directory has no bench files at all', () => {
    expect(() => selectBenchFiles(['README.md'], ['color'])).toThrow(
      'bench-action: "color" not found in the bench directory (no *.bench.ts files)'
    )
  })
})
