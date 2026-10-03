import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
// The same ESM module is loaded by the Vercel function at runtime.
// @ts-expect-error no declaration file is needed for this small server-only module.
import { fetchRemoteHtml } from './server/fetch-url-core.mjs'

async function readJson(req: import('node:http').IncomingMessage) {
  let body = ''
  for await (const chunk of req) {
    body += chunk.toString()
    if (body.length > 32_000) throw new Error('Request body is too large.')
  }
  return JSON.parse(body || '{}') as { url?: unknown }
}

function traceApiPlugin(): Plugin {
  return {
    name: 'trace-api',
    configureServer(server) {
      server.middlewares.use('/api/fetch-url', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ error: 'Use POST for URL scans.' }))
          return
        }
        try {
          const payload = await readJson(req)
          if (typeof payload.url !== 'string') throw new Error('A URL is required.')
          const result = await fetchRemoteHtml(payload.url)
          res.statusCode = 200
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify(result))
        } catch (error) {
          res.statusCode = 400
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'TRACE could not fetch that URL.' }))
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), traceApiPlugin()],
})
