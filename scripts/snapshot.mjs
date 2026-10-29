// Writes src/data/menu.snapshot.json (the offline fallback bundled into the site) from data/menu.xlsx
// or from any .xlsx / rows .json passed as the first argument.  Usage: npm run menu:snapshot
import fs from 'node:fs'
import { parseWorkbook, countItems } from '../server/parse.js'
import { sheetsFromBuffer } from '../server/readWorkbook.js'
const file = process.argv[2] || 'data/menu.xlsx'
const parsed = parseWorkbook(await sheetsFromBuffer(fs.readFileSync(file)))
const out = { categories: parsed.categories, images: { hero: null, categories: {}, items: {} }, meta: { source: 'bundled', generatedAt: new Date().toISOString(), itemCount: countItems(parsed.categories) } }
fs.writeFileSync('src/data/menu.snapshot.json', JSON.stringify(out))
console.log(`snapshot: ${out.categories.length} categories, ${out.meta.itemCount} dishes from ${file}`)
for (const w of parsed.warnings.filter((w) => w.type !== 'missing_price')) console.log('warning:', w.type, w.sheet, w.name || '', w.message)
console.log('dishes without a price:', parsed.warnings.filter((w) => w.type === 'missing_price').length)
