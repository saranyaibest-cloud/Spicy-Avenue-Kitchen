import { useEffect, useRef, useState } from 'react'
import snapshot from './data/menu.snapshot.json'

const KEY = 'sak-menu-v1', POLL_MS = 5 * 60 * 1000
const saved = () => { try { return JSON.parse(localStorage.getItem(KEY)) } catch { return null } }

// status: 'loading' until the first answer or failure. On failure we show the last valid menu this browser
// received, else the bundled snapshot, and label it as such (see Stamp in App.jsx). Never invents data.
export function useMenu() {
  const [state, setState] = useState({ status: 'loading', menu: null })
  const good = useRef(null), last = useRef(0)
  useEffect(() => {
    let dead = false
    const load = async () => {
      last.current = Date.now()
      try {
        const r = await fetch('/api/menu', { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(8000) })
        if (!r.ok) throw new Error(String(r.status))
        const p = await r.json()
        if (!p?.categories?.length) throw new Error('empty')
        good.current = p
        try { localStorage.setItem(KEY, JSON.stringify(p)) } catch {}
        if (!dead) setState({ status: 'ready', menu: { ...p, meta: { ...p.meta, offline: false } } })
      } catch {
        if (dead) return
        const m = good.current || saved()
        if (m && m.meta?.source !== 'bundled') setState({ status: 'ready', menu: { ...m, meta: { ...m.meta, offline: true } } })
        else setState({ status: 'ready', menu: snapshot })
      }
    }
    load()
    const t = setInterval(load, POLL_MS)
    const vis = () => { if (document.visibilityState === 'visible' && Date.now() - last.current > 60000) load() }
    document.addEventListener('visibilitychange', vis)
    return () => { dead = true; clearInterval(t); document.removeEventListener('visibilitychange', vis) }
  }, [])
  return state
}
