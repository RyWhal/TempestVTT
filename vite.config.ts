import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import type { Plugin } from 'vite'

const r2AssetProxyPlugin = (): Plugin => ({
  name: 'r2-asset-proxy',
  configureServer(server) {
    server.middlewares.use('/__r2_asset_proxy', async (req, res) => {
      try {
        const requestUrl = new URL(req.url ?? '', 'http://localhost')
        const targetUrl = requestUrl.searchParams.get('url')

        if (!targetUrl || !/^https?:\/\//.test(targetUrl)) {
          res.statusCode = 400
          res.end('Missing or invalid url parameter')
          return
        }

        const upstream = await fetch(targetUrl)

        if (!upstream.ok) {
          res.statusCode = upstream.status
          res.end(`Upstream asset request failed: ${upstream.status}`)
          return
        }

        const contentType = upstream.headers.get('content-type') ?? 'application/octet-stream'
        const arrayBuffer = await upstream.arrayBuffer()

        res.statusCode = 200
        res.setHeader('Content-Type', contentType)
        res.setHeader('Cache-Control', 'no-store')
        res.end(Buffer.from(arrayBuffer))
      } catch (error) {
        res.statusCode = 502
        res.end(
          `Asset proxy failed: ${error instanceof Error ? error.message : 'unknown error'}`
        )
      }
    })
  },
})

export default defineConfig({
  plugins: [react(), r2AssetProxyPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: 'src/test/setup.ts',
    globals: true,
  },
})
