// Turns raw worksheet rows into the normalized menu structure. No I/O here, so it is easy to test.
// The workbook has no consistent header row: each sheet puts the dish name in the first text cell,
// then a price (number) and a description (long text), with optional short notes. Section headings
// ("Veg", "Non-Veg Tandoori", ...) are rows with a name and nothing else, listed in SHEETS below.
export const SHEETS = {
  'Soups': ['Soups', { 'veg': ['Vegetarian', 'veg'], 'non-veg': ['Non-vegetarian', 'nonveg'] }],
  'Appetizers': ['Appetizers', { 'vegetarian appetizers': ['Vegetarian', 'veg'], 'non-veg appetizers': ['Non-vegetarian', 'nonveg'] }],
  'Lunch Bowls': ['Lunch Bowls', { 'rice bowl': ['Rice bowls', null] }],
  'Curry': ['Curries', { 'vegetarian entress': ['Vegetarian entrées', 'veg'], 'non-vegetarian entress': ['Non-vegetarian entrées', 'nonveg'] }],
  'Tandoor': ['Tandoor', { 'veg tandoori': ['Vegetarian', 'veg'], 'non-veg tandoori': ['Non-vegetarian', 'nonveg'] }],
  'Breads': ['Breads', { 'breads': ['Breads', null] }],
  'Biryani & F-Rice': ['Biryani, Rice & Noodles', { 'veg-biryani / rice / noodels': ['Vegetarian', 'veg'], 'chicken dum biryanies / rice / noodiles': ['Chicken, goat & seafood', null] }],
  'Diserets': ['Desserts', {}],
  'Fresh Smoothis': ['Smoothies & Drinks', { 'fresh smoothis': ['Fresh smoothies', null], 'beverages': ['Beverages', null] }],
  'Icecream': ['Ice Cream Rolls', { 'ice cream rolles': ['Ice cream rolls', null] }],
  'Pulav - WKND': ['Weekend Pulao', { 'veg': ['Vegetarian', 'veg'], 'non veg': ['Non-vegetarian', 'nonveg'] }],
  'Just South': ['Just South', { 'tiffins': ['Tiffins, dosa & uttapam', null] }],
}
export const norm = (s) => String(s).replace(/\s+/g, ' ').trim()
export const slug = (s) => norm(s).toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const tidy = (n) => { n = norm(n); return n[0] && n[0] === n[0].toLowerCase() && n[0] !== n[0].toUpperCase() ? n.split(' ').map((w) => w[0]?.toUpperCase() + w.slice(1)).join(' ') : n }
const r2 = (n) => Math.round(n * 100) / 100

// -> {kind:'none'|'label'|'ok'|'variants'|'invalid', price?, variants?}
export function parsePrice(v) {
  if (v == null || v === '') return { kind: 'none' }
  if (typeof v === 'number') return Number.isFinite(v) && v > 0 ? { kind: 'ok', price: r2(v) } : { kind: 'invalid', raw: v }
  const s = String(v).trim()
  if (/^price$/i.test(s)) return { kind: 'label' }
  const plain = s.replace(/[$,\s]/g, '')
  if (/^\d+(\.\d{1,2})?$/.test(plain)) return +plain > 0 ? { kind: 'ok', price: r2(+plain) } : { kind: 'invalid', raw: s }
  // "Half 9.99 / Full 14.99" -> variants. (The supplied workbook has none yet; this keeps them from being flattened.)
  const pairs = s.length > 60 ? [] : [...s.matchAll(/([A-Za-z][A-Za-z .'()-]*?)\s*[:\-]?\s*\$?(\d+(?:\.\d{1,2})?)/g)]
  if (pairs.length >= 2) return { kind: 'variants', variants: pairs.map((m) => ({ label: norm(m[1]), price: r2(+m[2]) })) }
  return { kind: 'invalid', raw: s }
}

export function parseWorkbook(sheets) {
  const warnings = [], categories = [], used = new Set()
  for (const sheet of sheets) {
    const key = norm(sheet.name)
    const cfg = Object.entries(SHEETS).find(([k]) => k === key)?.[1]
    const [title, heads] = cfg || [key, {}]
    if (!cfg) warnings.push({ type: 'unmapped_sheet', sheet: key, message: `Sheet “${key}” is not in SHEETS; its rows are shown as one section.` })
    const catId = slug(title), sections = []
    let cur = null
    sheet.rows.forEach((row, ri) => {
      const idx = row.findIndex((c) => typeof c === 'string' && c.trim())
      if (idx < 0) return
      const name = norm(row[idx]), h = heads[name.toLowerCase()]
      if (h) { cur = { title: h[0], diet: h[1], items: [] }; sections.push(cur); return }
      if (!cur) { cur = { title, diet: null, items: [] }; sections.push(cur) }
      let pr = { kind: 'none' }; const texts = []
      for (const c of row.slice(idx + 1)) {
        if (c == null || c === '') continue
        const p = typeof c === 'number' ? parsePrice(c) : (() => { const q = parsePrice(c); return q.kind === 'invalid' && !/\d/.test(c) ? { kind: 'text' } : q })()
        if (p.kind === 'text') texts.push(norm(c))
        else if (p.kind === 'ok' || p.kind === 'variants' || p.kind === 'invalid') { if (pr.kind === 'none') pr = p }
      }
      const desc = texts.find((t) => t.length > 40) ?? null
      const note = texts.find((t) => t !== desc) ?? null
      const where = { sheet: key, row: ri + 1, name }
      if (pr.kind === 'none') warnings.push({ type: 'missing_price', ...where, message: 'No price in workbook; shown without a price.' })
      if (pr.kind === 'invalid') warnings.push({ type: 'invalid_price', ...where, message: `Price “${pr.raw}” is not valid; shown without a price.` })
      let id = `${catId}-${slug(name)}`, n = 2
      while (used.has(id)) { warnings.push({ type: 'duplicate_name', ...where, message: 'Same dish name appears twice in this sheet.' }); id = `${catId}-${slug(name)}-${n++}` }
      used.add(id)
      cur.items.push({
        id, name: tidy(name), note, description: desc,
        price: pr.kind === 'ok' ? pr.price : null,
        variants: pr.kind === 'variants' ? pr.variants : [],
        priceStatus: pr.kind === 'ok' ? 'ok' : pr.kind === 'variants' ? 'variants' : pr.kind === 'invalid' ? 'invalid' : 'missing',
        diet: cur.diet,
      })
    })
    const kept = sections.filter((s) => s.items.length)
    if (!kept.length) warnings.push({ type: 'empty_sheet', sheet: key, message: 'No dishes found.' })
    else categories.push({ id: catId, title, sections: kept })
  }
  return { categories, warnings }
}
export const countItems = (cats) => cats.reduce((n, c) => n + c.sections.reduce((m, s) => m + s.items.length, 0), 0)
