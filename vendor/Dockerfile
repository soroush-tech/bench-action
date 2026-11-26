# Sandbox image for @soroush.tech/bench.
# Generic and content-stable: the harness and bench files are mounted at run
# time, so this image is built once and cached across every benchmark.
# Pinned by version and digest: an image built from a floating tag changes under
# the same bench version, and its results stop being comparable.
FROM node:24.22.3-slim@sha256:873f586f3794f52281bd039bf02c048a0be08fde619338f9941bad1eb6b34530

# tsx runs the TypeScript harness and bench files. mitata is bundled into the
# harness at build time, so it is not installed here. --ignore-scripts: no
# lifecycle script runs at install - esbuild's binary ships as a platform
# package. Pinned exactly: an image built from a range is not reproducible.
RUN npm install -g --ignore-scripts tsx@4.23.11

# Expose manual GC so mitata runs a collection after warmup (steadier samples)
# and reports the GC-impact + heap-usage rows.
ENV NODE_OPTIONS=--expose-gc

WORKDIR /repo

# Drop root: the image's built-in unprivileged `node` user suffices - /bench (the
# writable tmpfs) is world-writable (mode 1777) and everything else is read-only
# or global, so package installs and the harness still run. - S6471
USER node
