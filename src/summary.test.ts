import { describe, expect, it, vi } from 'vitest'
import { writeJobSummary, type JobSummary } from './summary'

/** A `core.summary` stand-in whose `write` resolves, or rejects with `failure`. */
function mockSummary(failure?: unknown) {
  const summary: JobSummary = {
    addRaw: vi.fn(() => summary),
    write: vi.fn(() => (failure === undefined ? Promise.resolve() : Promise.reject(failure))),
  }
  return summary
}

describe('writeJobSummary', () => {
  it('writes the report as-is to the job summary', async () => {
    const summary = mockSummary()
    const warn = vi.fn()
    await writeJobSummary(summary, '## Benchmark results', warn)
    expect(summary.addRaw).toHaveBeenCalledWith('## Benchmark results', true)
    expect(summary.write).toHaveBeenCalledOnce()
    expect(warn).not.toHaveBeenCalled()
  })

  it.each([
    ['an Error', new Error('Unable to find environment variable for $GITHUB_STEP_SUMMARY')],
    ['a non-Error', 'boom'],
  ])('warns, without throwing, when the write fails with %s', async (_, failure) => {
    const warn = vi.fn()
    await expect(writeJobSummary(mockSummary(failure), 'report', warn)).resolves.toBeUndefined()
    expect(warn).toHaveBeenCalledWith(
      `Could not write the job summary: ${failure instanceof Error ? failure.message : failure}`
    )
  })
})
