// Reads the summary table of an action report, for the E2E checks.

/** One summary row of a report. */
export interface SummaryRow {
  failed: boolean
  /** The case key, or a note such as `_no results_` for a file-level row. */
  label: string
  /** Speed vs the baseline in percent; undefined for a file-level row. */
  ratioPct?: number
}

/** The summary table's rows, in the report's order. */
export function summaryRows(report: string): SummaryRow[] {
  return report
    .split('\n')
    .filter((line) => line.startsWith('| ✅ |') || line.startsWith('| ❌ |'))
    .map((line) => {
      const [status, label, , ratio] = line.split('|').slice(1, -1).map((cell) => cell.trim())
      return {
        failed: status === '❌',
        label: label.replace(/^`|`$/g, ''),
        ratioPct: ratio === '-' ? undefined : Number.parseFloat(ratio),
      }
    })
}

/** The report's env line (`soroush-bench <version> · node ...`), if it has one. */
export function envLine(report: string): string | undefined {
  return report.split('\n').find((line) => line.startsWith('soroush-bench '))
}
