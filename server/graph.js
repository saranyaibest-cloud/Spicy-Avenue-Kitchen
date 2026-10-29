// Reads the workbook from OneDrive/SharePoint with Microsoft Graph, app-only (client credentials).
// Secrets come from environment variables on the server only.
const enc = (u) => 'u!' + Buffer.from(u).toString('base64').replace(/=+$/, '').replace(/\//g, '_').replace(/\+/g, '-')
export const graphConfigured = (e) => !!(e.GRAPH_TENANT_ID && e.GRAPH_CLIENT_ID && e.GRAPH_CLIENT_SECRET && (e.GRAPH_SHARE_URL || (e.GRAPH_DRIVE_ID && e.GRAPH_ITEM_ID)))
let token = null
async function getToken(e) {
  if (token && token.exp > Date.now() + 60000) return token.value
  const base = e.GRAPH_AUTH_URL || 'https://login.microsoftonline.com'
  const res = await fetch(`${base}/${encodeURIComponent(e.GRAPH_TENANT_ID)}/oauth2/v2.0/token`, {
    method: 'POST', signal: AbortSignal.timeout(10000),
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: e.GRAPH_CLIENT_ID, client_secret: e.GRAPH_CLIENT_SECRET, scope: 'https://graph.microsoft.com/.default', grant_type: 'client_credentials' }),
  })
  if (!res.ok) throw new Error(`Graph token request failed (${res.status})`)
  const j = await res.json()
  token = { value: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 }
  return token.value
}
export async function fetchWorkbookFromGraph(e) {
  const base = e.GRAPH_BASE_URL || 'https://graph.microsoft.com/v1.0'
  const item = e.GRAPH_SHARE_URL ? `/shares/${enc(e.GRAPH_SHARE_URL)}/driveItem` : `/drives/${encodeURIComponent(e.GRAPH_DRIVE_ID)}/items/${encodeURIComponent(e.GRAPH_ITEM_ID)}`
  const headers = { authorization: `Bearer ${await getToken(e)}` }
  const meta = await fetch(base + item, { headers, signal: AbortSignal.timeout(10000) })
  if (!meta.ok) { if (meta.status === 401) token = null; throw new Error(`Graph item lookup failed (${meta.status})`) }
  const modified = (await meta.json()).lastModifiedDateTime || null
  const res = await fetch(`${base}${item}/content`, { headers, signal: AbortSignal.timeout(20000), redirect: 'follow' })
  if (!res.ok) throw new Error(`Graph download failed (${res.status})`)
  const buffer = Buffer.from(await res.arrayBuffer())
  if (buffer.length > 10 * 1024 * 1024) throw new Error('Workbook larger than 10 MB')
  return { buffer, modified }
}
