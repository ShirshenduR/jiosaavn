import { handle } from '@hono/node-server/vercel'
import { createRequire } from 'node:module'

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
 * decrypts media links and needs Node APIs the Edge runtime does not have.
 *
 * The `createRequire` shim is load-bearing. This package is `"type": "module"`,
 * so Vercel bundles the function as ESM — and esbuild's ESM shim replaces
 * CommonJS `require` with a function that throws "Dynamic require of ... is not
 * supported". `node-forge` is CommonJS and does `require('crypto')`, so importing
 * it crashed the function before it could serve anything, and *every* route
 * answered FUNCTION_INVOCATION_FAILED. Handing the bundle a real `require`
 * restores it.
 *
 * The app is then loaded with a dynamic import so it executes *after* that shim
 * is in place; a static import would be hoisted above it.
 *
 * `dist/` rather than `src/`: `npm run build` runs before Vercel bundles this
 * function, and tsc-alias has already rewritten the `#modules/*` and `#common/*`
 * specifiers to relative paths, so the bundle never has to resolve this
 * package's `imports` map.
 */
const globalWithRequire = globalThis as typeof globalThis & { require?: NodeRequire }
globalWithRequire.require ??= createRequire(import.meta.url)

const { default: app } = await import('../dist/server.js')

export default handle(app)
