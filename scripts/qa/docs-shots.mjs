import { chromium } from 'playwright'
const B = 'http://127.0.0.1:4173'
const b = await chromium.launch({ channel: 'msedge' })
const ctx = await b.newContext({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 2 })
const p = await ctx.newPage()
const S = 'docs/screenshots/'

await p.goto(B + '/', { waitUntil: 'networkidle' })
await p.evaluate(() => localStorage.clear())
await p.reload({ waitUntil: 'networkidle' })
await p.waitForTimeout(1600)
await p.screenshot({ path: S + 'gate.png' })

await p.evaluate(() => {
  const now = Date.now()
  const day = 86400000
  localStorage.setItem('sereneisle.auth.users', JSON.stringify({ schema: 1, users: [{ id: 'u1', name: '林小屿', hue: 190, salt: 'x', hash: 'y', createdAt: now - day * 12, lastSeen: now }] }))
  localStorage.setItem('sereneisle.auth.session', 'u1')
  const recs = [2,3,3,2,4,3,4,3,2,3,4,5,4,3].map((s, i) => ({ id: 'r' + i, ts: now - (13 - i) * day + 3600000, score: s, tags: i % 2 ? ['学业压力'] : ['睡眠不足'], note: '', source: 'quick' }))
  localStorage.setItem('sereneisle.v1.u_u1.mood', JSON.stringify(recs))
  localStorage.setItem('sereneisle.v1.u_u1.intro-seen', 'true')
  localStorage.setItem('sereneisle.v1.moment', 'noon')
})
await p.reload({ waitUntil: 'networkidle' })
await p.waitForTimeout(1500)
await p.screenshot({ path: S + 'home.png' })

const stage = await p.$('.atlas-stage')
await stage.scrollIntoViewIfNeeded()
await p.waitForTimeout(500)
const box = await stage.boundingBox()
await p.screenshot({ path: S + 'atlas.png', clip: { x: box.x - 18, y: box.y - 68, width: box.width + 36, height: box.height + 86 } })

await p.keyboard.press('Control+k')
await p.waitForTimeout(600)
await p.screenshot({ path: S + 'palette.png' })
await p.keyboard.press('Escape')

await p.goto(B + '/calm', { waitUntil: 'networkidle' })
await p.waitForTimeout(600)
await p.click('button:has-text("开始引导")')
await p.waitForTimeout(13000)
await p.screenshot({ path: S + 'breathing.png' })
console.log('done')
await b.close()
