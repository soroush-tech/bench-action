// The E2E fixture. Its cases are far apart on purpose - `fast` about 2x the
// baseline's speed, `slow` about 1/5 - so runner noise can never move a case
// across the 80% gate, and every bench version must give the same verdicts.
// A plain config object: the shape `defineBench` returns, so the fixture
// depends on no bench version of its own.
const work = (n: number): number => {
  let sum = 0
  for (let i = 0; i < n; i++) sum += Math.sqrt(i)
  return sum
}

export default {
  name: 'e2e',
  cases: {
    baseline: () => work(2_000),
    fast: () => work(1_000),
    slow: () => work(10_000),
  },
}
