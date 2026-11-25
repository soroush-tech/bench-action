# Sandbox image for @soroush.tech/bench.
# Generic and content-stable: the harness and bench files are mounted at run
# time, so this image is built once and cached across every benchmark.
FROM node:24-slim

# tsx runs the TypeScript harness and bench files. mitata is bundled into the
# harness at build time, so it is not installed here.
RUN npm install -g tsx@^4

# Expose manual GC so mitata runs a collection after warmup (steadier samples)
# and reports the GC-impact + heap-usage rows.
ENV NODE_OPTIONS=--expose-gc

WORKDIR /repo

# Drop root: the image's built-in unprivileged `node` user suffices — /bench (the
# writable tmpfs) is world-writable (mode 1777) and everything else is read-only
# or global, so package installs and the harness still run. — S6471
USER node
