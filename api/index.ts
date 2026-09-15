import { handle } from '@hono/node-server/vercel'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { createRequire } from 'node:module'

/**
 * Vercel serverless entry point.
 *
 * The app only *exports* its Hono instance: it targets Cloudflare Workers, where
 * the platform supplies the HTTP runtime, and nothing in it ever opens a socket.
 * Vercel needs an explicit entry file like this one, because `vercel.json`
 * rewrites everything to `/api` and there has to be a function there to receive
 * it.
 *
 * Node runtime (the default for `api/`), deliberately not Edge: `node-forge`
 * decrypts media links and needs Node APIs the Edge runtime does not have.
 *
 * Two things here are load-bearing, and both exist because this deployment spent
 * a long time answering nothing but "FUNCTION_INVOCATION_FAILED" — which names a
 * symptom and hides every cause:
 *
 * 1. The `createRequire` shim. This package is `"type": "module"`, so the
 *    function is bundled as ESM, and an ESM bundle's shimmed CommonJS `require`
 *    throws "Dynamic require of ... is not supported". `node-forge` is CommonJS
 *    and requires 'crypto' as it loads, so importing it killed the function
 *    before it could serve anything.
 *
 * 2. Boot failures are caught and reported as JSON. Initialisation is lazy, so a
 *    broken deployment says *what* broke instead of sending someone to dig
 *    through logs that may not be reachable.
 *
 * The app is imported dynamically so it runs *after* the shim is installed; a
 * static import would be hoisted above it.
 *
 * `dist/` rather than `src/`: `npm run build` runs before Vercel bundles this
 * function, and tsc-alias has already rewritten the `#modules/*` and `#common/*`
 * specifiers to relative paths, so nothing has to resolve this package's
 * `imports` map.
 */
const globalWithRequire = globalThis as typeof globalThis & { require?: NodeRequire }
globalWithRequire.require ??= createRequire(import.meta.url)

type Handler = (req: IncomingMessage, res: ServerResponse) => unknown

let ready: Promise<Handler | null> | null = null
let bootError: unknown = null

function boot(): Promise<Handler | null> {
  ready ??= import('../dist/server.js')
    .then((module) => handle(module.default) as unknown as Handler)
    .catch((error: unknown) => {
      bootError = error
      return null
    })
  return ready
}

export default async function main(req: IncomingMessage, res: ServerResponse) {
  const handler = await boot()

  if (!handler) {
    const error = bootError as { name?: string; message?: string; stack?: string } | undefined
    res.statusCode = 500
    res.setHeader('content-type', 'application/json; charset=utf-8')
    res.end(
      JSON.stringify(
        {
          error: 'The function failed to initialise.',
          name: error?.name ?? typeof bootError,
          message: String(error?.message ?? bootError ?? 'unknown'),
          stack: String(error?.stack ?? '')
            .split('\n')
            .slice(0, 10),
        },
        null,
        2
      )
    )
    return
  }

  return handler(req, res)
}
