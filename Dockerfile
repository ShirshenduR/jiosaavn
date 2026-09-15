# A working container image for the JioSaavn API.
#
# The previous Dockerfile never opened a socket: its CMD was `bun run start`,
# which ran `bun dist/server.js` — a module that only *exports* its Hono app
# because the project targets Cloudflare Workers, where the platform provides the
# HTTP runtime. The container started, loaded the module, and exited. Every
# request to it failed.
#
# This builds the TypeScript, then starts src/serve.ts (compiled to
# dist/serve.js), which is the actual server.
#
# Node rather than Bun: `@hono/node-server` is already a runtime dependency, and
# a long-running Node container is the least surprising thing to deploy anywhere.
# A package-lock.json is committed so `npm ci` is reproducible.

# ------------------------------------------------------------------- build ---
FROM node:22-bookworm-slim AS build

WORKDIR /app

# Dependency layer first, so it is cached across source edits.
COPY package.json package-lock.json ./
# --ignore-scripts: the postinstall installs git hooks, which is meaningless in a
# build stage and fails outside a git checkout.
RUN npm ci --ignore-scripts --no-audit --no-fund

COPY tsconfig.json ./
COPY src ./src

# Emits dist/, then drops the dev dependencies the build needed.
RUN npm run build && npm prune --omit=dev

# ----------------------------------------------------------------- runtime ---
FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production \
    PORT=3000

WORKDIR /app

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json

# Runs unprivileged: the image ships a `node` user and nothing here needs root.
USER node

EXPOSE 3000

# The health endpoint used by deploy checks. Uses the same server as everything
# else, so it exercises the real path rather than a special case.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/search/songs?query=test&limit=1').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/serve.js"]
