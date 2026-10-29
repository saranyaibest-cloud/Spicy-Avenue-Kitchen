import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { parseWorkbook, parsePrice, countItems } from '../server/parse.js'
const EXPECTED_MISSING = 29 // counted independently with Python/openpyxl
const fixture = () => JSON.parse(fs.readFileSync(new URL('./fixtures/rows.json', import.meta.url))).sheets
const flat = (p) => p.categories.flatMap((c) => c.sections.flatMap((s) => s.items))

test('every worksheet becomes a category and every dish is kept', () => {
  const p = parseWorkbook(fixture())
  assert.equal(p.categories.length, 12)
  assert.equal(countItems(p.categories), 189)
  assert.equal(new Set(flat(p).map((i) => i.id)).size, 189, 'ids are unique')
  assert.deepEqual(p.warnings.filter((w) => w.type === 'unmapped_sheet'), [])
})
test('missing prices stay null and are never $0', () => {
  const items = flat(parseWorkbook(fixture()))
  const missing = items.filter((i) => i.price == null)
  assert.equal(missing.length, EXPECTED_MISSING)
  assert.ok(missing.every((i) => i.priceStatus === 'missing'))
  assert.ok(items.every((i) => i.price == null || i.price > 0))
})
test('known dishes keep their price, description and diet', () => {
  const items = flat(parseWorkbook(fixture()))
  const d = items.find((i) => i.name === 'Masala Dosa')
  assert.equal(d.price, 8.99); assert.equal(d.diet, null); assert.match(d.description, /potato filling/)
  assert.equal(items.find((i) => i.name === 'Butter Chicken').diet, 'nonveg')
  assert.equal(items.find((i) => i.name === 'Irani Chai').price, 2)
  assert.equal(items.find((i) => i.name === 'Veg Cutlet').note, 'SAK Green Bites')
})
test('changing a price in the workbook rows changes the output', () => {
  const rows = fixture()
  for (const s of rows) for (const r of s.rows) if (r.includes('Masala Dosa ')) r[r.indexOf(8.99)] = 9.49
  assert.equal(flat(parseWorkbook(rows)).find((i) => i.name === 'Masala Dosa').price, 9.49)
})
test('price formats, invalid values and variants', () => {
  assert.deepEqual(parsePrice('$12.50'), { kind: 'ok', price: 12.5 })
  assert.equal(parsePrice(0).kind, 'invalid'); assert.equal(parsePrice(-3).kind, 'invalid'); assert.equal(parsePrice('call us').kind, 'invalid')
  assert.equal(parsePrice('').kind, 'none'); assert.equal(parsePrice('Price ').kind, 'label')
  assert.deepEqual(parsePrice('Half 9.99 / Full 14.99').variants, [{ label: 'Half', price: 9.99 }, { label: 'Full', price: 14.99 }])
})
test('bad rows are reported, not published as prices', () => {
  const p = parseWorkbook([{ name: 'Soups', rows: [['Veg'], ['Test Soup', '12..99', 'A long enough description for the test soup, over forty characters.'], ['Zero Soup', 0]] }])
  const items = flat(p)
  assert.equal(items.length, 2); assert.ok(items.every((i) => i.price === null && i.priceStatus === 'invalid'))
  assert.equal(p.warnings.filter((w) => w.type === 'invalid_price').length, 2)
})
test('unknown sheets are kept and flagged', () => {
  const p = parseWorkbook([{ name: 'Specials', rows: [['Mango Kulfi', 4.5]] }])
  assert.equal(flat(p)[0].price, 4.5); assert.equal(p.warnings[0].type, 'unmapped_sheet')
})
