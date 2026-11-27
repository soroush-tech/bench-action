import { defineConfig } from 'vitest/config'

// The E2E checks, run by .github/workflows/e2e.yml on the reports of the built
// action. They need those reports, so `npm test` never picks them up: the
// default include matches *.test.ts, not *.e2e.ts.
export default defineConfig({
  test: {
    include: ['e2e/**/*.e2e.ts'],
  },
})
