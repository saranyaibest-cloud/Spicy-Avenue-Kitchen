import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createMenuService } from '../server/menuService.js'

const rows = () => JSON.parse(fs.readFileSync(new URL('./fixtures/rows.json', import.meta.url)))
const silent = { error() {}, log() {} }
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'sak-'))
const dish = (m, name) => m.categories.flatMap((c) => c.sections.flatMap((s) => s.items)).find((i) => i.name === name)

// Minimal fake of login.microsoftonline.com + graph.microsoft.com
function mockGraph(state) {
  return new Promise((resolve) => {
    const s = http.createServer((req, res) => {
      state.hits.push(req.url)
      if (req.url.includes('/oauth2/v2.0/token')) { res.setHeader('content-type', 'application/json'); return res.end(JSON.stringify({ access_token: 't0k', expires_in: 3600 })) }
      if (req.headers.authorization !== 'Bearer t0k') { res.statusCode = 401; return res.end('{}') }
      if (state.fail) { res.statusCode = 503; return res.end('{}') }
      if (req.url.endsWith('/content')) return res.end(JSON.stringify(state.data))
      res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ lastModifiedDateTime: '2026-10-29T10:00:00Z' }))
    }).listen(0, () => resolve(s))
  })
}
const envFor = (port, dir) => ({ GRAPH_TENANT_ID: 't', GRAPH_CLIENT_ID: 'c', GRAPH_CLIENT_SECRET: 's', GRAPH_DRIVE_ID: 'd', GRAPH_ITEM_ID: 'i',
  GRAPH_AUTH_URL: `http://localhost:${port}`, GRAPH_BASE_URL: `http://localhost:${port}`, MENU_TTL_SECONDS: '1', MENU_CACHE_FILE: path.join(dir, 'cache.json'), MENU_LOCAL_FILE: 'test/fixtures/rows.json' })

test('live sync: price edit in the source appears after the cache expires; failures serve last good data as stale', async () => {
  const state = { data: rows(), hits: [], fail: false }, srv = await mockGraph(state), dir = tmp()
  const svc = createMenuService(envFor(srv.address().port, dir), silent)
  let m = await svc.get()
  assert.equal(m.meta.source, 'live'); assert.equal(m.meta.stale, false); assert.equal(m.meta.sourceModified, '2026-10-29T10:00:00Z')
  assert.equal(dish(m, 'Chicken 65').price, 12.99); assert.ok(m.meta.fetchedAt)
  // owner edits Chicken 65 in Excel
  for (const s of state.data.sheets) for (const r of s.rows) if (r.includes(12.99) && String(r[1]).trim() === 'Chicken 65') r[r.indexOf(12.99)] = 13.49
  assert.equal(dish(await svc.get(), 'Chicken 65').price, 12.99, 'still cached within TTL')
  await new Promise((r) => setTimeout(r, 1100))
  m = await svc.get(); assert.equal(dish(m, 'Chicken 65').price, 13.49)
  // Graph goes down
  state.fail = true; await new Promise((r) => setTimeout(r, 1100))
  m = await svc.get(); assert.equal(m.meta.stale, true); assert.equal(dish(m, 'Chicken 65').price, 13.49, 'keeps last valid prices'); assert.equal(m.meta.source, 'live')
  // restart while Graph is still down: last valid comes from the disk cache, not the old local workbook
  const svc2 = createMenuService(envFor(srv.address().port, dir), silent)
  m = await svc2.get(); assert.equal(m.meta.stale, true); assert.equal(dish(m, 'Chicken 65').price, 13.49)
  state.fail = false; await new Promise((r) => setTimeout(r, 1100))
  m = await svc.get(); assert.equal(m.meta.stale, false)
  srv.close()
})
test('a wiped or damaged workbook is rejected, previous menu stays', async () => {
  const state = { data: rows(), hits: [], fail: false }, srv = await mockGraph(state), dir = tmp()
  const svc = createMenuService(envFor(srv.address().port, dir), silent)
  await svc.get()
  state.data = { sheets: [{ name: 'Soups', rows: [['Veg'], ['Only Soup', 5]] }] }
  await new Promise((r) => setTimeout(r, 1100))
  const m = await svc.get(); assert.equal(m.meta.stale, true); assert.equal(dish(m, 'Butter Chicken').price, 13.99)
  srv.close()
})
test('Graph unreachable and nothing cached: labelled fallback, never claims live', async () => {
  const dir = tmp(), env = envFor(1, dir) // port 1 = connection refused
  const m = await createMenuService(env, silent).get()
  assert.equal(m.meta.source, 'fallback'); assert.equal(m.categories.length, 12)
})
test('no Graph configuration: local workbook, labelled fallback', async () => {
  const m = await createMenuService({ MENU_LOCAL_FILE: 'test/fixtures/rows.json' }, silent).get()
  assert.equal(m.meta.source, 'fallback'); assert.equal(m.meta.stale, false)
})
