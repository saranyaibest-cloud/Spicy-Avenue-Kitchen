import fs from 'node:fs/promises'
import path from 'node:path'
import { parseWorkbook, countItems } from './parse.js'
import { sheetsFromBuffer } from './readWorkbook.js'
import { fetchWorkbookFromGraph, graphConfigured } from './graph.js'

const ROOT = path.resolve(import.meta.dirname, '..')
const exists = (p) => fs.access(p).then(() => true, () => false)

export function createMenuService(env = process.env, log = console) {
  const ttl = (Number(env.MENU_TTL_SECONDS) || 300) * 1000
  const localFile = path.resolve(ROOT, env.MENU_LOCAL_FILE || 'data/menu.xlsx')
  const cacheFile = path.resolve(ROOT, env.MENU_CACHE_FILE || 'server/.cache/menu.json')
  const live = graphConfigured(env)
  let good = null, nextTry = 0, inflight = null, lastError = null, warnings = []

  async function images() { try { return JSON.parse(await fs.readFile(path.join(ROOT, 'data/images.json'), 'utf8')) } catch { return { hero: null, categories: {}, items: {} } } }
  function build(parsed, meta) {
    if (!parsed.categories.length) throw new Error('Workbook produced no menu items')
    const n = countItems(parsed.categories), prev = good ? countItems(good.categories) : 0
    if (prev && n < prev * 0.5) throw new Error(`Workbook has ${n} dishes vs ${prev} before; refusing to publish (looks damaged)`)
    warnings = parsed.warnings
    return { categories: parsed.categories, meta: { ...meta, itemCount: n, warningCount: parsed.warnings.filter((w) => w.type !== 'missing_price').length } }
  }
  async function fromLive() {
    const { buffer, modified } = await fetchWorkbookFromGraph(env)
    const p = build(parseWorkbook(await sheetsFromBuffer(buffer)), { source: 'live', fetchedAt: new Date().toISOString(), sourceModified: modified })
    good = p; lastError = null
    await fs.mkdir(path.dirname(cacheFile), { recursive: true }).then(() => fs.writeFile(cacheFile, JSON.stringify(p))).catch(() => {})
  }
  async function fromLocal() {
    const [buf, st] = await Promise.all([fs.readFile(localFile), fs.stat(localFile)])
    good = build(parseWorkbook(await sheetsFromBuffer(buf)), { source: 'fallback', fetchedAt: new Date().toISOString(), sourceModified: st.mtime.toISOString() })
  }
  async function refresh() {
    try {
      if (live) await fromLive(); else await fromLocal()
      nextTry = Date.now() + ttl
    } catch (err) {
      lastError = err.message; nextTry = Date.now() + Math.min(ttl, 60000)
      log.error(`[menu] refresh failed: ${err.message}`)
      if (!good && live && await exists(cacheFile)) { try { good = JSON.parse(await fs.readFile(cacheFile, 'utf8')) } catch {} }
      if (!good) { try { await fromLocal() } catch (e2) { log.error(`[menu] fallback failed: ${e2.message}`) } }
    }
  }
  return {
    live,
    async get() {
      if (!good || Date.now() >= nextTry) await (inflight ||= refresh().finally(() => { inflight = null }))
      if (!good) return null
      const stale = live && !!lastError && good.meta.source === 'live'
      return { categories: good.categories, images: await images(), meta: { ...good.meta, stale } }
    },
    health: () => ({ ok: !!good, mode: live ? 'microsoft-graph' : 'local-fallback', source: good?.meta.source ?? null, fetchedAt: good?.meta.fetchedAt ?? null, lastError, warnings }),
  }
}
