/** Hidden marker of the default (untitled) report comment. */
export const COMMENT_MARKER = '<!-- soroush-bench-action -->'

/** `comment-title` default; it keeps the unkeyed {@link COMMENT_MARKER}. */
export const DEFAULT_TITLE = 'Benchmark results'

/** GitHub's maximum comment body length, in characters. */
export const MAX_COMMENT_LENGTH = 65_536

/** How the per-file tables appear under the summary (`comment-details`). */
export type CommentDetails = 'collapsed' | 'open' | 'none'

/** What produced a run, as bench (>= 2.4.0) records it in `--json-file`. */
export interface BenchEnv {
  /** Version of the bench harness that ran. */
  bench: string
  /** The sandbox's Node version. */
  node: string
  cpus?: number
  cpuset?: string
  memory?: string
}

/** The part of bench's `--json-file` results the summary reads. */
export interface BenchJson {
  /** What produced the run; absent from results of bench before 2.4.0. */
  env?: BenchEnv
  /** Key of the baseline case, when bench found it. */
  baseline?: string
  cases: {
    key: string
    /** Mean time per iteration, in nanoseconds. */
    avg: number
    /** Speed as a percentage of the baseline's; present whenever `baseline` is. */
    ratioPct?: number
  }[]
}

export interface FileResult {
  /** Bench file path relative to the workspace root. */
  file: string
  passed: boolean
  /** Markdown results table; empty when the run produced none. */
  table: string
  /** The run's `--json-file` results; undefined when it wrote none. */
  json?: BenchJson
}

export interface ReportOptions {
  baselineCase: string
  /** Minimum speed vs the baseline, in percent; undefined reports without a gate. */
  minRatio?: number
  title: string
  details: CommentDetails
}

/** Validates the `comment-details` input. */
export function parseCommentDetails(value: string): CommentDetails {
  if (value === 'collapsed' || value === 'open' || value === 'none') return value
  throw new Error(`bench-action: comment-details must be collapsed, open or none (got "${value}")`)
}

/**
 * Validates the `min-ratio` input: empty means report only, with no gate; any
 * other value must be a positive percent.
 */
export function parseMinRatio(value: string): number | undefined {
  if (value === '') return undefined
  const minRatio = Number(value)
  if (!Number.isFinite(minRatio) || minRatio <= 0) {
    throw new Error('bench-action: min-ratio must be a positive number (percent)')
  }
  return minRatio
}

/**
 * The marker line a report starts with. The default title keeps the unkeyed
 * marker, so comments from earlier versions are still updated; any other title
 * is keyed by its slug, so jobs with different titles keep separate comments.
 */
export function commentMarker(title: string): string {
  if (title === DEFAULT_TITLE) return COMMENT_MARKER
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 64)
    // Runs are already one dash each, so at most one dash sits at either end.
    .replace(/^-|-$/g, '')
  if (slug === '') {
    throw new Error(`bench-action: comment-title "${title}" has no letters or digits to key it by`)
  }
  return `<!-- soroush-bench-action:${slug} -->`
}

/** Same units as bench's own markdown table. */
const formatTime = (ns: number): string => {
  if (ns >= 1e6) return `${(ns / 1e6).toFixed(2)} ms`
  if (ns >= 1e3) return `${(ns / 1e3).toFixed(2)} µs`
  return `${ns.toFixed(0)} ns`
}

interface SummaryRow {
  failed: boolean
  /** Markdown for the case cell: the case key, or a note for a file-level row. */
  label: string
  file: string
  ratioPct?: number
  avg?: number
}

/** Whether a run left numbers to compare: results with a baseline found. */
const hasResults = ({ json }: FileResult): boolean => json?.baseline !== undefined

/**
 * The files that fail the job: a failed run (a gate breach or a crash), or a
 * run that left no results to compare. In report-only mode only the latter two
 * can happen.
 */
export function failedFiles(results: FileResult[]): string[] {
  return results.filter((result) => !result.passed || !hasResults(result)).map(({ file }) => file)
}

/**
 * One row per non-baseline case of every file. A file without usable results
 * gets one failed `no results` row, and a failed file none of whose cases is
 * below the minimum (e.g. a case crashed) gets a `run failed` row, so a failure
 * is never missing from the summary. Without a minimum, no case fails for being
 * slow.
 */
function summaryRows(results: FileResult[], minRatio: number | undefined): SummaryRow[] {
  return results.flatMap((result) => {
    const { file, passed, json } = result
    if (json === undefined || !hasResults(result)) {
      return [{ failed: true, label: '_no results_', file }]
    }
    const rows: SummaryRow[] = json.cases
      .filter(({ key }) => key !== json.baseline)
      .map(({ key, avg, ratioPct }) => {
        const ratio = ratioPct as number
        const failed = minRatio !== undefined && ratio < minRatio
        return { failed, label: `\`${key}\``, file, ratioPct: ratio, avg }
      })
    if (!passed && !rows.some((row) => row.failed)) {
      rows.push({ failed: true, label: '_run failed_', file })
    }
    return rows
  })
}

/** Failures first, then slowest to fastest; rows without a ratio lead their group. */
const bySeverity = (a: SummaryRow, b: SummaryRow): number =>
  Number(b.failed) - Number(a.failed) || (a.ratioPct ?? 0) - (b.ratioPct ?? 0)

function summaryTable(rows: SummaryRow[]): string {
  const body = [...rows].sort(bySeverity).map(({ failed, label, file, ratioPct, avg }) => {
    const ratio = ratioPct === undefined ? '-' : `${ratioPct.toFixed(1)}%`
    const time = avg === undefined ? '-' : formatTime(avg)
    return `| ${failed ? '❌' : '✅'} | ${label} | \`${file}\` | ${ratio} | ${time} |`
  })
  const header = ['|  | Case | File | vs baseline | avg |', '| --- | --- | --- | ---: | ---: |']
  return [...header, ...body].join('\n')
}

/** One line naming what produced the run, the same as bench's own header line. */
function envLine(env: BenchEnv): string {
  const parts = [`soroush-bench ${env.bench}`, `node ${env.node}`]
  if (env.cpus !== undefined) parts.push(`cpus ${env.cpus}`)
  if (env.cpuset !== undefined) parts.push(`cpuset ${env.cpuset}`)
  if (env.memory !== undefined) parts.push(`memory ${env.memory}`)
  return parts.join(' · ')
}

function fileSection({ file, passed, table }: FileResult, open: boolean): string {
  const status = passed ? '✅ passed' : '❌ failed'
  const body = table === '' ? '_no results table was produced_' : table
  const summary = `<summary><code>${file}</code> — ${status}</summary>`
  return `<details${open ? ' open' : ''}>${summary}\n\n${body}\n\n</details>`
}

/**
 * Renders every file's outcome as one markdown report — the PR comment body
 * (and the action's `report` output): a summary table of every case across
 * files, then each file's own table. Starts with the marker line so a later
 * run can find and update the same comment instead of posting a new one. If
 * the per-file tables would push it past GitHub's comment limit, they are
 * left out with a note.
 */
export function buildReport(results: FileResult[], options: ReportOptions): string {
  const { baselineCase, minRatio, title, details } = options
  const rows = summaryRows(results, minRatio)
  const failed = rows.filter((row) => row.failed).length
  const mode =
    minRatio === undefined
      ? 'report only, no gate'
      : `minimum speed ratio: **${minRatio}%** · **${failed} of ${rows.length}** failed`
  // Every file in one job runs on the same harness and limits, so the first env stands for all.
  const env = results.find(({ json }) => json?.env !== undefined)?.json?.env
  const head = [
    commentMarker(title),
    `## ${title}`,
    `Baseline case: \`${baselineCase}\` · ${mode}`,
    ...(env === undefined ? [] : [envLine(env)]),
    summaryTable(rows),
  ]
  const sections =
    details === 'none' ? [] : results.map((result) => fileSection(result, details === 'open'))
  const report = [...head, ...sections].join('\n\n')
  if (report.length <= MAX_COMMENT_LENGTH) return report
  return [
    ...head,
    '_The per-file tables were left out: with them the report is longer than a GitHub comment allows._',
  ].join('\n\n')
}

/** Finds a previously posted report comment by its marker line. */
export function findReportComment<T extends { body?: string }>(
  comments: T[],
  marker: string
): T | undefined {
  return comments.find((comment) => comment.body?.split(/\r?\n/, 1)[0] === marker)
}
