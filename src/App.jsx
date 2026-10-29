import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import { useMenu } from './useMenu.js'
import { SITE, FEATURED, GALLERY } from './data/site.js'

const NAV = [['about', 'About'], ['start', 'Favourites'], ['menu', 'Menu'], ...(GALLERY.length ? [['gallery', 'Gallery']] : []), ['visit', 'Visit us']]
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const flat = (cats) => cats.flatMap((c) => c.sections.flatMap((s) => s.items.map((i) => ({ ...i, cat: c.title }))))
const count = (c) => c.sections.reduce((n, s) => n + s.items.length, 0)
const fmt = (d) => new Date(d).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Chicago' }) + ' CT'

// A missing price is shown as a dash, never as $0.
function Price({ item }) {
  if (item.variants?.length) return <span className="price price--v">{item.variants.map((v) => <span key={v.label}><small>{v.label}</small> ${v.price.toFixed(2)}</span>)}</span>
  if (item.price == null) return <span className="price price--none" title="Price not listed"><span aria-hidden="true">—</span><span className="sr">Price not listed</span></span>
  return <span className="price">${item.price.toFixed(2)}</span>
}
function Stamp({ meta }) {
  let text
  if (meta.source === 'live') text = meta.stale || meta.offline ? `Couldn’t refresh just now. Prices as of ${fmt(meta.fetchedAt)}` : `Prices updated ${fmt(meta.fetchedAt)}`
  else if (meta.source === 'fallback') text = 'Reference menu data. Live price sync is not connected.'
  else text = `Saved menu data${meta.generatedAt ? ` from ${fmt(meta.generatedAt)}` : ''}. Live prices are unavailable.`
  return <p className="stamp">{text}</p>
}
// Renders only if the file exists, so a missing photo never leaves a broken image.
function Photo({ src, alt, className = '' }) {
  const [ok, setOk] = useState(true)
  if (!ok || !src) return null
  return <img className={`photo ${className}`} src={src} alt={alt} loading="lazy" decoding="async" onError={() => setOk(false)} />
}

function Header() {
  const [open, setOpen] = useState(false)
  useEffect(() => { document.body.style.overflow = open ? 'hidden' : '' }, [open])
  useEffect(() => { const k = (e) => e.key === 'Escape' && setOpen(false); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [])
  return (
    <header className="nav">
      <a className="brand" href="#top" aria-label="Spicy Avenue Kitchen, home"><img src="/brand/chili.jpg" alt="" width="34" height="42" /><span>Spicy Avenue Kitchen</span></a>
      <nav className="nav__links" aria-label="Primary">
        {NAV.map(([id, l]) => <a key={id} href={`#${id}`}>{l}</a>)}
        <a className="btn btn--chili" href={SITE.directionsUrl} target="_blank" rel="noreferrer">Directions</a>
      </nav>
      <button className="nav__toggle" aria-expanded={open} aria-controls="drawer" onClick={() => setOpen(!open)}>{open ? 'Close' : 'Menu'}</button>
      <AnimatePresence>
        {open && (
          <motion.div id="drawer" className="drawer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
            {NAV.map(([id, l]) => <a key={id} href={`#${id}`} onClick={() => setOpen(false)}>{l}</a>)}
            <a className="btn btn--chili" href={SITE.directionsUrl} target="_blank" rel="noreferrer">Get directions</a>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}

function Hero({ photo }) {
  const reduce = useReducedMotion()
  const [photoOk, setPhotoOk] = useState(!!photo)
  return (
    <section className="hero" id="top">
      <motion.div className={`hero__art ${photo && photoOk ? 'has-photo' : ''}`} initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8 }}>
        {photo && photoOk && <img className="hero__photo" src={photo.src} alt={photo.alt} fetchpriority="high" onError={() => setPhotoOk(false)} />}
        <img className="hero__logo" src="/brand/logo.jpg" alt="Spicy Avenue Kitchen: a red chili forms the S, a silver A, and a brass spoon and forks form the K, each on a slate tile" />
      </motion.div>
      <div className="hero__bar">
        <p>Indian kitchen in Katy, Texas. Andhra, Hyderabadi and North Indian cooking, South Indian tiffins and a tandoor.</p>
        <div className="actions">
          <a className="btn btn--chili" href="#menu">Explore menu</a>
          <a className="btn btn--ondark" href={SITE.directionsUrl} target="_blank" rel="noreferrer">Get directions</a>
        </div>
      </div>
    </section>
  )
}

function About({ menu, go }) {
  const total = menu ? flat(menu.categories).length : null
  return (
    <section className="intro" id="about">
      <div className="intro__text">
        <h2>One menu, from Andhra to Punjab.</h2>
        <p>Andhra fries and gongura curries. Chettinad pepper. Hyderabadi dum biryani, sealed and slow-cooked. Dal makhani and butter chicken from the North, and a South Indian list of dosa, idli and uttapam.</p>
        <p>The tandoor does the tikkas and kebabs; the wok does Indo-Chinese appetizers, fried rice and noodles. Vegetarian and non-vegetarian dishes are marked where the menu separates them.</p>
      </div>
      {menu && (
        <div className="index">
          <p className="index__head">On the menu · {total} dishes</p>
          <ol>{menu.categories.map((c) => (
            <li key={c.id}><a href="#menu" onClick={() => go(c.id)}><span>{c.title}</span><span className="rule" aria-hidden="true" /><span className="n">{count(c)}</span></a></li>))}</ol>
        </div>
      )}
    </section>
  )
}

function Featured({ menu }) {
  const items = useMemo(() => {
    if (!menu) return []
    const all = flat(menu.categories)
    return FEATURED.map((n) => all.find((i) => i.name.toLowerCase() === n.toLowerCase())).filter(Boolean)
  }, [menu])
  if (!items.length) return null
  return (
    <section className="start" id="start">
      <h2>Five to start with</h2>
      <ol>{items.map((d, n) => (
        <li key={d.id} className="row">
          <span className="row__n">{n + 1}</span>
          <div className="row__main"><h3>{d.name}</h3>{d.description && <p>{d.description}</p>}<span className="row__cat">{d.cat}</span></div>
          <span className="row__price"><Price item={d} /></span>
          <Photo className="row__photo" src={menu.images?.items?.[d.id]} alt={d.name} />
        </li>))}
      </ol>
    </section>
  )
}

function Skeleton() {
  return (
    <div className="skeleton" aria-busy="true"><span className="sr">Loading menu</span>
      {Array.from({ length: 8 }, (_, i) => <div key={i} className="skeleton__row"><i /><i /></div>)}
    </div>
  )
}

function Menu({ menu, status, cat, setCat }) {
  const [q, setQ] = useState('')
  const [diet, setDiet] = useState('all')
  const tabs = useRef([])
  const cats = menu?.categories ?? []
  const active = cats.find((c) => c.id === cat) || cats[0]
  const query = q.trim().toLowerCase()
  const groups = useMemo(() => {
    if (!menu) return []
    const fits = (i) => (diet === 'all' || !i.diet || i.diet === diet) && (!query || `${i.name} ${i.description || ''} ${i.note || ''}`.toLowerCase().includes(query))
    return (query ? cats : [active]).map((c) => ({ ...c, sections: c.sections.map((s) => ({ ...s, items: s.items.filter(fits) })).filter((s) => s.items.length) })).filter((c) => c.sections.length)
  }, [menu, active, query, diet])
  const shown = groups.reduce((n, c) => n + count(c), 0)
  useEffect(() => { const i = cats.findIndex((c) => c.id === active?.id); tabs.current[i]?.scrollIntoView({ inline: 'center', block: 'nearest' }) }, [active?.id])
  const pick = (id) => { setCat(id); setQ('') }
  const onKey = (e, i) => {
    const n = { ArrowRight: (i + 1) % cats.length, ArrowLeft: (i - 1 + cats.length) % cats.length, Home: 0, End: cats.length - 1 }[e.key]
    if (n == null) return
    e.preventDefault(); pick(cats[n].id); tabs.current[n]?.focus()
  }
  return (
    <section className="menu" id="menu">
      <div className="menu__top">
        <div className="menu__title"><h2>Menu</h2>{menu && <Stamp meta={menu.meta} />}</div>
        <div className="search">
          <label><span className="sr">Search the menu</span><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search: gongura, paneer, dosa…" /></label>
          {q && <button type="button" className="search__clear" onClick={() => setQ('')} aria-label="Clear search">Clear</button>}
        </div>
        <div className="seg" role="group" aria-label="Dietary filter">
          {[['all', 'All'], ['veg', 'Veg'], ['nonveg', 'Non-veg']].map(([v, l]) => <button key={v} aria-pressed={diet === v} onClick={() => setDiet(v)}>{l}</button>)}
        </div>
      </div>
      {status === 'loading' || !menu ? <Skeleton /> : (<>
        <div className="tabs" role="tablist" aria-label="Menu sections">
          {cats.map((c, i) => (
            <button key={c.id} ref={(el) => (tabs.current[i] = el)} role="tab" id={`tab-${c.id}`} aria-controls="menu-panel"
              aria-selected={!query && active.id === c.id} tabIndex={active.id === c.id ? 0 : -1} onClick={() => pick(c.id)} onKeyDown={(e) => onKey(e, i)}>{c.title}</button>))}
        </div>
        <div className="menu__list" id="menu-panel" role="tabpanel" aria-labelledby={query ? undefined : `tab-${active.id}`} aria-live="polite">
          {!query && menu.images?.categories?.[active.id] && <Photo className="banner" src={menu.images.categories[active.id]} alt="" />}
          <p className="menu__count">
            {query ? `${shown} result${shown === 1 ? '' : 's'} for “${q.trim()}”` : `${active.title}: ${shown} dishes`}
            {!query && active.sections.length > 1 && <span className="jump"> · Jump to {active.sections.map((s, i) => <span key={s.title}>{i > 0 && ', '}<a href={`#${active.id}-${slug(s.title)}`}>{s.title}</a></span>)}</span>}
          </p>
          <AnimatePresence mode="wait">
            <motion.div key={`${active.id}|${query}|${diet}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}>
              {groups.length === 0 && <p className="empty">Nothing matches “{q.trim()}”. Try a shorter word{diet !== 'all' ? ' or switch the Veg / Non-veg filter back to All' : ''}.</p>}
              {groups.map((c) => (
                <div key={c.id}>
                  {query && <h3 className="mcat">{c.title}</h3>}
                  {c.sections.map((s) => (
                    <div key={s.title} className="msec" id={`${c.id}-${slug(s.title)}`}>
                      {(c.sections.length > 1 || s.title !== c.title) && <h4>{s.title}</h4>}
                      <ul>{s.items.map((i) => {
                        const img = menu.images?.items?.[i.id]
                        return (
                          <li key={i.id} className={`mi ${img ? 'mi--img' : ''}`}>
                            <div className="mi__body">
                              <div className="mi__row">
                                <span className="mi__name">{i.diet && <span className={`mark mark--${i.diet}`} role="img" aria-label={i.diet === 'veg' ? 'Vegetarian' : 'Non-vegetarian'} />}{i.name}</span>
                                <Price item={i} />
                              </div>
                              {i.note && <p className="mi__note">{i.note}</p>}
                              {i.description && <p className="mi__desc">{i.description}</p>}
                            </div>
                            <Photo className="mi__thumb" src={img} alt={i.name} />
                          </li>)
                      })}</ul>
                    </div>))}
                </div>))}
            </motion.div>
          </AnimatePresence>
          <p className="menu__fine">Dishes shown with a dash have no price listed. Please tell us about any allergies when you order.</p>
        </div>
      </>)}
    </section>
  )
}

function Gallery() {
  if (!GALLERY.length) return null // appears automatically once real photos are listed in site.js
  return (
    <section className="gallery" id="gallery"><h2>Gallery</h2>
      <div className="gallery__grid">{GALLERY.map((s) => <figure key={s.src}><Photo src={s.src} alt={s.alt} /></figure>)}</div>
    </section>
  )
}

function Visit() {
  return (
    <section className="visit" id="visit">
      <div className="visit__row">
        <div><h2>Visit us</h2><address>{SITE.street}<br />{SITE.city}</address></div>
        <div className="actions">
          <a className="btn btn--chili" href={SITE.directionsUrl} target="_blank" rel="noreferrer">Get directions</a>
          <a className="btn btn--ondark" href={SITE.mapsUrl} target="_blank" rel="noreferrer">Google Maps listing</a>
        </div>
      </div>
      <p className="visit__note">Opening hours and contact details are on the Google Maps listing.</p>
      <iframe title="Map showing Spicy Avenue Kitchen in Katy, Texas" src={SITE.embedUrl} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
    </section>
  )
}

function Footer() {
  return (
    <footer className="foot">
      <img src="/brand/logo.jpg" alt="Spicy Avenue Kitchen" width="220" height="121" />
      <nav aria-label="Footer">{NAV.map(([id, l]) => <a key={id} href={`#${id}`}>{l}</a>)}</nav>
      <p>{SITE.street}<br />{SITE.city}<br /><a href={SITE.directionsUrl} target="_blank" rel="noreferrer">Get directions</a></p>
      <small>© {new Date().getFullYear()} {SITE.name}</small>
    </footer>
  )
}

export default function App() {
  const { status, menu } = useMenu()
  const [cat, setCat] = useState(null)
  const heroSrc = menu?.images?.hero
  return (<><Header /><main>
    <Hero photo={heroSrc ? { src: heroSrc, alt: 'A dish from Spicy Avenue Kitchen' } : null} />
    <About menu={menu} go={setCat} /><Featured menu={menu} />
    <Menu menu={menu} status={status} cat={cat} setCat={setCat} />
    <Gallery /><Visit />
  </main><Footer /></>)
}
