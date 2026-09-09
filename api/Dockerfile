# Cloak API.
#
# Debian rather than Alpine on purpose: `argon2` is a native addon, and the musl
# builds are the ones without prebuilds — on Alpine every image build compiles it
# from source, and any mismatch surfaces at runtime as a failed password hash
# rather than a failed build.

# ─── build ───────────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS build
WORKDIR /app

# Toolchain for the native addon. Present only in this stage.
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
# The release bundle ships a lockfile; a build straight from the repo has none.
RUN npm ci || npm install

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ─── runtime ─────────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN (npm ci --omit=dev || npm install --omit=dev) \
 && npm cache clean --force \
 && apt-get purge -y python3 make g++ \
 && apt-get autoremove -y

# Templates are read from disk at runtime — emails and the status page both live
# in here, two levels up from dist/lib, which is why the layout is preserved.
COPY --from=build /app/dist ./dist
COPY templates ./templates

# Drop root. The app writes nothing to disk; all state is in MongoDB.
USER node

EXPOSE 4000

# Compose and most orchestrators use this to hold traffic back until Mongo is up.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/server.js"]
