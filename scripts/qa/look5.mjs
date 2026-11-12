import { chromium } from 'playwright'
const B = 'http://127.0.0.1:4173'
const b = await chromium.launch({ channel: 'msedge' })
const ctx = await b.newContext({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1.5 })
const p = await ctx.newPage()
await p.goto(B + '/', { waitUntil: 'networkidle' })
await p.evaluate(() => {
  const now = Date.now(); const day = 86400000
  const recs = [2,3,3,2,4,3,4].map((s, i) => ({ id: 'r'+i, ts: now - (6-i)*day + 3600000, score: s,
    tags: i%2?['学业压力']:['睡眠不足'], note:'', source:'quick' }))
  localStorage.setItem('sereneisle.v1.mood', JSON.stringify(recs))
  localStorage.setItem('sereneisle.v1.intro-seen', 'true')
  localStorage.setItem('sereneisle.v1.moment', 'dusk')
})
await p.reload({ waitUntil: 'networkidle' })
await p.waitForTimeout(1500)
await p.screenshot({ path: '.shots/v5-home-dusk.png', fullPage: true })
await p.screenshot({ path: '.shots/v5-home-fold.png' })
console.log('ok')
await b.close()
