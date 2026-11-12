import { chromium } from 'playwright'
const B = 'http://127.0.0.1:4173'
const b = await chromium.launch({ channel: 'msedge' })
const S = 'docs/screenshots/'

const seed = () => {
  try {
    const now = Date.now()
    const day = 86400000
    localStorage.setItem('sereneisle.auth.users', JSON.stringify({ schema: 1, users: [{ id: 'u1', name: '林小屿', hue: 190, salt: 'x', hash: 'y', createdAt: now - day * 12, lastSeen: now }] }))
    localStorage.setItem('sereneisle.auth.session', 'u1')
    localStorage.setItem('sereneisle.v1.u_u1.intro-seen', 'true')
    localStorage.setItem('sereneisle.v1.moment', 'noon')
  } catch {}
}

const ctx = await b.newContext({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 2 })
await ctx.addInitScript(seed)
const p = await ctx.newPage()

await p.goto(B + '/', { waitUntil: 'networkidle' })
await p.waitForTimeout(1600)
await p.screenshot({ path: S + 'tmp-home.png' })

const stage = await p.$('.atlas-stage')
await stage.scrollIntoViewIfNeeded()
await p.waitForTimeout(600)
const box = await stage.boundingBox()
await p.screenshot({ path: S + 'tmp-atlas.png', clip: { x: box.x - 18, y: box.y - 92, width: box.width + 36, height: box.height + 112 } })

await p.goto(B + '/harbor', { waitUntil: 'networkidle' })
await p.waitForTimeout(900)
await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
await p.waitForTimeout(900)
await p.screenshot({ path: S + 'tmp-rail.png', fullPage: false })

const m = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
await m.addInitScript(seed)
const mp = await m.newPage()
await mp.goto(B + '/calm', { waitUntil: 'networkidle' })
await mp.waitForTimeout(1000)
await mp.screenshot({ path: S + 'tmp-mobile.png' })

await b.close()
console.log('ok')
