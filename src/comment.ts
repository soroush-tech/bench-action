/** Hidden marker that identifies this action's PR comment for later updates. */
export const COMMENT_MARKER = '<!-- soroush-bench-action -->'

export interface FileResult {
  /** Bench file path relative to the workspace root. */
  file: string
  passed: boolean
  /** Markdown results table; empty when the run produced none. */
  table: string
}

/**
 * Renders every file's outcome as one markdown report — the PR comment body
 * (and the action's `report` output). Starts with the hidden marker so a
 * later run can find and update the same comment instead of posting a new one.
 */
export function buildReport(results: FileResult[], baselineCase: string, minRatio: number): string {
  const sections = results.map(({ file, passed, table }) => {
    const status = passed ? '✅ passed' : '❌ failed'
    const body = table === '' ? '_no results table was produced_' : table
    return `### \`${file}\` — ${status}\n\n${body}`
  })
  return [
    COMMENT_MARKER,
    '## Benchmark results',
    `Baseline case: \`${baselineCase}\` · minimum speed ratio: **${minRatio}%**`,
    ...sections,
  ].join('\n\n')
}

/** Finds a previously posted report comment by its hidden marker. */
export function findReportComment<T extends { body?: string }>(comments: T[]): T | undefined {
  return comments.find((comment) => comment.body?.includes(COMMENT_MARKER) === true)
}
