import { describe, expect, it } from 'vitest'
import { COMMENT_MARKER, buildReport, findReportComment } from './comment'

describe('buildReport', () => {
  it('starts with the marker and renders one section per file', () => {
    const report = buildReport(
      [
        { file: 'bench/color.bench.ts', passed: true, table: '| case | ratio |' },
        { file: 'bench/spacing.bench.ts', passed: false, table: '' },
      ],
      'previous',
      80
    )
    expect(report.startsWith(COMMENT_MARKER)).toBe(true)
    expect(report).toContain('Baseline case: `previous` · minimum speed ratio: **80%**')
    expect(report).toContain('### `bench/color.bench.ts` — ✅ passed\n\n| case | ratio |')
    expect(report).toContain('### `bench/spacing.bench.ts` — ❌ failed\n\n_no results table was produced_')
  })
})

describe('findReportComment', () => {
  it('finds the comment containing the marker, skipping bodiless ones', () => {
    const mine = { id: 3, body: `${COMMENT_MARKER}\n\n## Benchmark results` }
    const comments = [{ id: 1, body: 'unrelated' }, { id: 2 }, mine]
    expect(findReportComment(comments)).toBe(mine)
  })

  it('returns undefined when no comment carries the marker', () => {
    expect(findReportComment([{ id: 1, body: 'unrelated' }])).toBeUndefined()
  })
})
