import { chromium } from 'playwright'
const B = 'http://127.0.0.1:4173'
const b = await chromium.launch({ channel: 'msedge' })
const errs = []
const ctx = await b.newContext({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 2 })
const p = await ctx.newPage()
p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message))
p.on('console', (m) => m.type() === 'error' && errs.push(m.text()))

await p.goto(B + '/', { waitUntil: 'networkidle' })
await p.evaluate(() => {
  const now = Date.now(); const day = 86400000
  const scores = [2,3,3,2,4,3,4,3,2,3,4,5,4,3,3,4,2,3,4,3,3,4,5,4,3,2,3,4,3,4]
  const recs = scores.map((s, i) => ({ id: 'r'+i, ts: now - (29-i)*day + 3600000, score: s,
    tags: i%3===0?['学业压力']:i%3===1?['睡眠不足']:['放松'], note:'', source:'quick' }))
  localStorage.setItem('sereneisle.v1.mood', JSON.stringify(recs))
  localStorage.setItem('sereneisle.v1.intro-seen', 'true')
})
await p.reload({ waitUntil: 'networkidle' })
await p.waitForTimeout(1200)

await p.goto(B + '/mood', { waitUntil: 'networkidle' })
await p.waitForTimeout(1200)
await p.screenshot({ path: '.shots/v3-mood.png', fullPage: true })
const heat = await p.$('text=最近 14 周的潮汐')
if (heat) {
  const card = await heat.evaluateHandle((el) => el.closest('div.lux'))
  const el = card.asElement()
  if (el) await el.screenshot({ path: '.shots/v3-heatmap.png' })
}

await p.goto(B + '/library', { waitUntil: 'networkidle' })
await p.waitForTimeout(1000)
await p.screenshot({ path: '.shots/v3-library.png', fullPage: true })

await p.goto(B + '/harbor', { waitUntil: 'networkidle' })
await p.waitForTimeout(1000)
await p.screenshot({ path: '.shots/v3-harbor.png', fullPage: true })

console.log('errors:', errs)
await b.close()
