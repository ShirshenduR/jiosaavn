import { serve } from '@hono/node-server'

import app from './server'

/**
 * Node server entry point.
 *
 * The rest of this project only *exports* its Hono instance, because it targets
 * Cloudflare Workers — where the platform supplies the HTTP runtime. Nothing in
 * it ever opens a socket, which is why running `dist/server.js` directly just
 * loads the module and exits, and why every container/function deployment of
 * this repo answered with a crash instead of a response.
 *
 * This file is the missing server. It is compiled by the normal `npm run build`
 * (tsc emits dist/serve.js) and started by the Dockerfile's CMD.
 */
const port = Number(process.env.PORT ?? 3000)

serve({ fetch: app.fetch, port, hostname: '0.0.0.0' }, (info) => {
  console.log(`[jiosaavn-api] listening on http://0.0.0.0:${info.port}`)
})
