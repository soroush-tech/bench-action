/** The part of `@actions/core`'s `summary` the action writes through. */
export interface JobSummary {
  addRaw(text: string, addEOL?: boolean): JobSummary
  write(): Promise<unknown>
}

/**
 * Writes the report to the job summary, on every run, with or without a PR, so
 * a release run gets its report with no extra wiring. A run with nowhere to
 * write it (no `$GITHUB_STEP_SUMMARY`, e.g. locally) only warns: the summary
 * never decides the job.
 */
export async function writeJobSummary(
  summary: JobSummary,
  report: string,
  warn: (message: string) => void
): Promise<void> {
  try {
    await summary.addRaw(report, true).write()
  } catch (error) {
    warn(`Could not write the job summary: ${error instanceof Error ? error.message : String(error)}`)
  }
}
