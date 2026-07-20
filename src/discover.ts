/**
 * Parses the action's `files` input: newline- or comma-separated names,
 * trimmed, blanks dropped. An empty input means "run every file".
 */
export function parseFilesInput(input: string): string[] {
  return input
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '')
}

/**
 * Picks the bench files to run from a bench-dir listing. With no selection,
 * every `*.bench.ts` file runs (sorted for a stable order). A selection may
 * name files with or without the `.bench.ts` suffix and is resolved in the
 * given order; a name that matches nothing is an error — a typo must fail
 * the job, not silently skip the gate.
 */
export function selectBenchFiles(entries: string[], selection: string[]): string[] {
  const benchFiles = entries.filter((entry) => entry.endsWith('.bench.ts')).sort()
  if (selection.length === 0) return benchFiles
  return selection.map((wanted) => {
    const name = wanted.endsWith('.bench.ts') ? wanted : `${wanted}.bench.ts`
    const match = benchFiles.find((file) => file === name)
    if (match === undefined) {
      const available = benchFiles.join(', ') || 'no *.bench.ts files'
      throw new Error(`bench-action: "${wanted}" not found in the bench directory (${available})`)
    }
    return match
  })
}
