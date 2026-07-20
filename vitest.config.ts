import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      // Accepted coverage exception: the entrypoint is impure Action glue that
      // never runs under vitest — it reads workflow inputs, spawns Docker, and
      // calls the GitHub API. Its decision logic is extracted into the covered
      // modules (discover, comment, run-bench); only unconditional I/O wiring
      // remains here. Mirrors bench's bin.ts/harness.ts exclusion.
      exclude: ['src/index.ts'],
      thresholds: { 100: true },
    },
  },
})
