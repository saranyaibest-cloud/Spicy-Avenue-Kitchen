import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createMenuService } from './menuService.js'
try { process.loadEnvFile(path.resolve(import.meta.dirname, '../.env')) } catch {}
const svc = createMenuService()
const DIST = path.resolve(import.meta.dirname, '../dist')
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ico': 'image/x-icon' }
const send = (res, code, body, headers = {}) => { res.writeHead(code, { 'x-content-type-options': 'nosniff', ...headers }); res.end(body) }
export const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x')
  try {
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed')
    if (url.pathname === '/api/menu') {
      const m = await svc.get()
      return m ? send(res, 200, JSON.stringify(m), { 'content-type': 'application/json', 'cache-control': 'public, max-age=60, stale-while-revalidate=240' }) : send(res, 503, JSON.stringify({ error: 'Menu unavailable' }), { 'content-type': 'application/json' })
    }
    if (url.pathname === '/api/health') { await svc.get(); return send(res, 200, JSON.stringify(svc.health()), { 'content-type': 'application/json', 'cache-control': 'no-store' }) }
    if (!fs.existsSync(DIST)) return send(res, 404, 'Not found. In development, open the Vite URL (http://localhost:5173).')
    let file = path.join(DIST, path.normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, ''))
    if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html')
    const ext = path.extname(file)
    return send(res, 200, fs.readFileSync(file), { 'content-type': MIME[ext] || 'application/octet-stream', 'cache-control': file.includes(`${path.sep}assets${path.sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache' })
  } catch (e) { console.error(e); send(res, 500, 'Server error') }
})
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const port = Number(process.env.PORT) || 8787
  server.listen(port, () => console.log(`Menu server on http://localhost:${port}  (${svc.live ? 'Microsoft Graph' : 'local fallback workbook — not live'})`))
}
