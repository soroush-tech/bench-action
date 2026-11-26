import { describe, expect, it } from 'vitest'
import {
  COMMENT_MARKER,
  DEFAULT_TITLE,
  MAX_COMMENT_LENGTH,
  buildReport,
  commentMarker,
  failedFiles,
  findReportComment,
  parseCommentDetails,
  parseMinRatio,
  type FileResult,
  type ReportOptions,
} from './comment'

const options: ReportOptions = {
  baselineCase: 'previous',
  minRatio: 80,
  title: DEFAULT_TITLE,
  details: 'collapsed',
}

/** The summary table's body rows, in rendered order. */
const summaryRows = (report: string): string[] =>
  report.split('\n').filter((line) => line.startsWith('| ✅') || line.startsWith('| ❌'))

const merge: FileResult = {
  file: 'bench/merge.bench.ts',
  passed: false,
  table: '| merge table |',
  json: {
    baseline: 'previous',
    cases: [
      { key: 'previous', avg: 8_000, ratioPct: 100 },
      { key: 'local', avg: 11_500, ratioPct: 69.6 },
      { key: 'emotion', avg: 10_400, ratioPct: 76.9 },
      { key: 'styled', avg: 2_000_000, ratioPct: 0.4 },
    ],
  },
}

const parse: FileResult = {
  file: 'bench/parse.bench.ts',
  passed: true,
  table: '| parse table |',
  json: {
    baseline: 'previous',
    cases: [
      { key: 'previous', avg: 500, ratioPct: 100 },
      { key: 'local', avg: 520, ratioPct: 96.2 },
      { key: 'fast', avg: 400, ratioPct: 125 },
    ],
  },
}

describe('parseCommentDetails', () => {
  it.each(['collapsed', 'open', 'none'])('accepts %s', (value) => {
    expect(parseCommentDetails(value)).toBe(value)
  })

  it('rejects anything else', () => {
    expect(() => parseCommentDetails('folded')).toThrow(
      'comment-details must be collapsed, open or none (got "folded")'
    )
  })
})

describe('parseMinRatio', () => {
  it('reads an empty value as report only, with no gate', () => {
    expect(parseMinRatio('')).toBeUndefined()
  })

  it('accepts a positive percent', () => {
    expect(parseMinRatio('80')).toBe(80)
    expect(parseMinRatio('62.5')).toBe(62.5)
  })

  it.each(['0', '-5', 'eighty', ' '])('rejects %j', (value) => {
    expect(() => parseMinRatio(value)).toThrow(
      'bench-action: min-ratio must be a positive number (percent)'
    )
  })
})

describe('commentMarker', () => {
  it('keeps the unkeyed marker for the default title', () => {
    expect(commentMarker(DEFAULT_TITLE)).toBe(COMMENT_MARKER)
  })

  it('keys any other title by its slug', () => {
    expect(commentMarker('Browser benches (Chromium)')).toBe(
      '<!-- soroush-bench-action:browser-benches-chromium -->'
    )
  })

  it('cuts the slug to 64 characters without a trailing dash', () => {
    const marker = commentMarker(`${'a'.repeat(63)} b`)
    expect(marker).toBe(`<!-- soroush-bench-action:${'a'.repeat(63)} -->`)
  })

  it('rejects a title with no letters or digits', () => {
    expect(() => commentMarker('  ✨ ')).toThrow('has no letters or digits to key it by')
  })
})

describe('buildReport', () => {
  it('starts with the marker, the title, and the failure count', () => {
    const report = buildReport([merge, parse], options)
    expect(report.startsWith(`${COMMENT_MARKER}\n\n## Benchmark results\n\n`)).toBe(true)
    expect(report).toContain(
      'Baseline case: `previous` · minimum speed ratio: **80%** · **3 of 5** failed'
    )
  })

  it('lists every non-baseline case across files: failures first, then slowest to fastest', () => {
    expect(summaryRows(buildReport([parse, merge], options))).toEqual([
      '| ❌ | `styled` | `bench/merge.bench.ts` | 0.4% | 2.00 ms |',
      '| ❌ | `local` | `bench/merge.bench.ts` | 69.6% | 11.50 µs |',
      '| ❌ | `emotion` | `bench/merge.bench.ts` | 76.9% | 10.40 µs |',
      '| ✅ | `local` | `bench/parse.bench.ts` | 96.2% | 520 ns |',
      '| ✅ | `fast` | `bench/parse.bench.ts` | 125.0% | 400 ns |',
    ])
  })

  it('gives a file without usable results one failed row, even when its run passed', () => {
    const rows = summaryRows(
      buildReport(
        [
          { file: 'bench/a.bench.ts', passed: false, table: '' },
          { file: 'bench/b.bench.ts', passed: true, table: '', json: { cases: [] } },
          { file: 'bench/c.bench.ts', passed: false, table: '' },
        ],
        options
      )
    )
    expect(rows).toEqual([
      '| ❌ | _no results_ | `bench/a.bench.ts` | - | - |',
      '| ❌ | _no results_ | `bench/b.bench.ts` | - | - |',
      '| ❌ | _no results_ | `bench/c.bench.ts` | - | - |',
    ])
  })

  it('adds a run-failed row to a failed file none of whose cases is below the minimum', () => {
    const crashed: FileResult = { ...parse, file: 'bench/crash.bench.ts', passed: false }
    const rows = summaryRows(buildReport([merge, crashed, parse], options))
    expect(rows.slice(0, 4)).toEqual([
      '| ❌ | _run failed_ | `bench/crash.bench.ts` | - | - |',
      '| ❌ | `styled` | `bench/merge.bench.ts` | 0.4% | 2.00 ms |',
      '| ❌ | `local` | `bench/merge.bench.ts` | 69.6% | 11.50 µs |',
      '| ❌ | `emotion` | `bench/merge.bench.ts` | 76.9% | 10.40 µs |',
    ])
    expect(rows.filter((row) => row.includes('_run failed_'))).toHaveLength(1)
  })

  describe('report only (no min-ratio)', () => {
    const reportOnly = { ...options, minRatio: undefined }

    it('says there is no gate, with no failure count', () => {
      const report = buildReport([merge, parse], reportOnly)
      expect(report).toContain('Baseline case: `previous` · report only, no gate\n')
      expect(report).not.toContain('failed**')
    })

    it('marks no case failed for being slow, still sorting slowest first', () => {
      const passing = { ...merge, passed: true }
      expect(summaryRows(buildReport([passing], reportOnly))).toEqual([
        '| ✅ | `styled` | `bench/merge.bench.ts` | 0.4% | 2.00 ms |',
        '| ✅ | `local` | `bench/merge.bench.ts` | 69.6% | 11.50 µs |',
        '| ✅ | `emotion` | `bench/merge.bench.ts` | 76.9% | 10.40 µs |',
      ])
    })

    it('still marks a crashed run and a file with no results failed', () => {
      const crashed: FileResult = { ...parse, file: 'bench/crash.bench.ts', passed: false }
      const empty: FileResult = { file: 'bench/empty.bench.ts', passed: true, table: '' }
      const rows = summaryRows(buildReport([crashed, empty], reportOnly))
      expect(rows.filter((row) => row.startsWith('| ❌'))).toEqual([
        '| ❌ | _run failed_ | `bench/crash.bench.ts` | - | - |',
        '| ❌ | _no results_ | `bench/empty.bench.ts` | - | - |',
      ])
    })
  })

  it('names what produced the run under the baseline line, from the first file that says', () => {
    const env = { bench: '2.4.0', node: 'v24.22.3', cpus: 1, cpuset: '0', memory: '512m' }
    const withEnv = { ...parse, json: { ...parse.json!, env } }
    const report = buildReport([merge, withEnv], options)
    expect(report).toContain(
      '**3 of 5** failed\n\nsoroush-bench 2.4.0 · node v24.22.3 · cpus 1 · cpuset 0 · memory 512m\n\n|'
    )
  })

  it('leaves out the limits the env does not record', () => {
    const env = { bench: '2.4.0', node: 'v24.22.3' }
    const report = buildReport([{ ...parse, json: { ...parse.json!, env } }], options)
    expect(report).toContain('\n\nsoroush-bench 2.4.0 · node v24.22.3\n\n')
  })

  it('has no env line when no result records one', () => {
    expect(buildReport([merge, parse], options)).not.toContain('soroush-bench ')
  })

  it('folds each file table into a collapsed <details> by default', () => {
    const report = buildReport([merge, { ...parse, table: '' }], options)
    expect(report).toContain(
      '<details><summary><code>bench/merge.bench.ts</code> — ❌ failed</summary>\n\n| merge table |\n\n</details>'
    )
    expect(report).toContain(
      '<details><summary><code>bench/parse.bench.ts</code> — ✅ passed</summary>\n\n_no results table was produced_\n\n</details>'
    )
  })

  it('opens the <details> with comment-details: open', () => {
    const report = buildReport([parse], { ...options, details: 'open' })
    expect(report).toContain('<details open><summary><code>bench/parse.bench.ts</code>')
  })

  it('leaves the file tables out with comment-details: none', () => {
    const report = buildReport([parse], { ...options, details: 'none' })
    expect(report).not.toContain('<details')
    expect(report).not.toContain('| parse table |')
  })

  it('uses a custom title for the heading and the keyed marker', () => {
    const report = buildReport([parse], { ...options, title: 'Browser benches' })
    expect(report).toMatch(/^<!-- soroush-bench-action:browser-benches -->\n\n## Browser benches\n/)
  })

  it('drops the file tables, with a note, when they would pass the comment limit', () => {
    const huge = { ...parse, table: 'x'.repeat(MAX_COMMENT_LENGTH) }
    const report = buildReport([huge], options)
    expect(report.length).toBeLessThanOrEqual(MAX_COMMENT_LENGTH)
    expect(report).not.toContain('<details')
    expect(report).toContain('| ✅ | `local` | `bench/parse.bench.ts` | 96.2% | 520 ns |')
    expect(report).toContain('_The per-file tables were left out')
  })
})

describe('failedFiles', () => {
  it('lists failed runs and runs without results, in order', () => {
    const empty: FileResult = { file: 'bench/empty.bench.ts', passed: true, table: '' }
    const noBaseline: FileResult = { ...empty, file: 'bench/typo.bench.ts', json: { cases: [] } }
    expect(failedFiles([merge, parse, empty, noBaseline])).toEqual([
      'bench/merge.bench.ts',
      'bench/empty.bench.ts',
      'bench/typo.bench.ts',
    ])
  })

  it('is empty when every run passed with results', () => {
    expect(failedFiles([parse])).toEqual([])
  })
})

describe('findReportComment', () => {
  const keyed = '<!-- soroush-bench-action:browser -->'

  it('finds the comment whose first line is the marker, skipping bodiless ones', () => {
    const mine = { id: 3, body: `${COMMENT_MARKER}\r\n\r\n## Benchmark results` }
    const comments = [{ id: 1, body: 'unrelated' }, { id: 2 }, mine]
    expect(findReportComment(comments, COMMENT_MARKER)).toBe(mine)
  })

  it('never matches a keyed comment for the unkeyed marker, or the reverse', () => {
    const unkeyed = { id: 1, body: `${COMMENT_MARKER}\n\n## Benchmark results` }
    const browser = { id: 2, body: `${keyed}\n\n## Browser` }
    expect(findReportComment([browser], COMMENT_MARKER)).toBeUndefined()
    expect(findReportComment([unkeyed], keyed)).toBeUndefined()
    expect(findReportComment([unkeyed, browser], keyed)).toBe(browser)
  })

  it('ignores a marker that is not on the first line', () => {
    const quoted = { id: 1, body: `quoted:\n${COMMENT_MARKER}` }
    expect(findReportComment([quoted], COMMENT_MARKER)).toBeUndefined()
  })
})
