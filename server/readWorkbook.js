// Bytes -> [{name, rows}]. Real .xlsx files go through SheetJS; a JSON rows file is accepted as a test hook.
export async function sheetsFromBuffer(buf) {
  if (buf[0] === 0x7b) return JSON.parse(buf.toString('utf8')).sheets // "{" -> test fixture
  const XLSX = await import('xlsx')
  const lib = XLSX.read ? XLSX : XLSX.default
  const wb = lib.read(buf, { type: 'buffer' })
  return wb.SheetNames.map((name) => ({ name, rows: lib.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: null, raw: true }) }))
}
