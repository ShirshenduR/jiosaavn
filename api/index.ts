import { handle } from '@hono/node-server/vercel'

import app from '../dist/server.js'

/**
 * Vercel serverless entry point.
 *
 * The app only *exports* its Hono instance: it targets Cloudflare Workers, where
 * the platform supplies the HTTP runtime, and nothing in it ever opens a socket.
 * Vercel needs an explicit entry file like this one — without it every route
 * answered FUNCTION_INVOCATION_FAILED, because `vercel.json` rewrites everything
 * to `/api` and there was no function there to receive it.
 *
 * Node runtime (the default for `api/`), deliberately not Edge: `node-forge`
 * decrypts media links and needs Node APIs that the Edge runtime does not have.
 *
 * It imports the compiled `dist/` rather than `src/`: `npm run build` runs before
 * Vercel bundles this function, and the emitted files have already had their
 * `#modules/*` and `#common/*` specifiers rewritten to relative paths by
 * tsc-alias. The bundle therefore never has to understand this package's
 * `imports` map, which Vercel's bundler would not resolve.
 */
export default handle(app)
