# Cloak API.
#
# Debian rather than Alpine on purpose: `argon2` is a native addon, and the musl
# builds are the ones without prebuilts — on Alpine every image build compiles it
# from source, and any mismatch surfaces at runtime as a failed password hash
# rather than a failed build.

# ─── build ───────────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS build
WORKDIR /app

# Toolchain for the native addon. Present only in this stage.
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*

# The npm bundled with node:22 (10.9.8) cannot resolve this dependency tree from
# scratch: its peer-set walk dies with "Cannot read properties of null (reading
# 'edgesOut')". It handles `npm ci` against a lockfile fine, so only a build
# without one — straight from the repository — hits it. Upgrading here covers
# both paths for a few seconds of build time.
RUN npm install -g npm@11

COPY package*.json ./

# Exactly one install. Doing it again in the runtime stage would need the
# compiler there too, and the pruned tree below is what that stage copies.
#
# The release bundle ships a lockfile; a build straight from the repo has none.
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Drop dev dependencies from the tree the runtime stage will copy. The compiled
# argon2 binary survives, and was built against this same base image.
RUN npm prune --omit=dev

# ─── runtime ─────────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./

# Templates are read from disk at runtime — emails and the status page both live
# in here, two levels up from dist/lib, which is why the layout is preserved.
COPY templates ./templates

# Drop root. The app writes nothing to disk; all state is in MongoDB.
USER node

EXPOSE 4000

# Compose and most orchestrators use this to hold traffic back until Mongo is up.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/server.js"]
