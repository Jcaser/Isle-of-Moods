import { chromium } from 'playwright'
const B = 'http://127.0.0.1:4173'
const b = await chromium.launch({ channel: 'msedge' })
const errs = []

// 桌面
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
await p.waitForTimeout(1000)

await p.goto(B + '/mood', { waitUntil: 'networkidle' })
await p.waitForTimeout(1000)
const heat = await p.$('text=最近 14 周的潮汐')
if (heat) {
  const el = (await heat.evaluateHandle((n) => n.closest('div.lux'))).asElement()
  if (el) await el.screenshot({ path: '.shots/v4-heatmap.png' })
}

await p.goto(B + '/library', { waitUntil: 'networkidle' })
await p.waitForTimeout(900)
const shelf = await p.$('text=THE SHELF')
if (shelf) {
  const el = (await shelf.evaluateHandle((n) => n.closest('section'))).asElement()
  if (el) await el.screenshot({ path: '.shots/v4-shelf.png' })
}
await p.screenshot({ path: '.shots/v4-library.png' })

// 地图
await p.goto(B + '/', { waitUntil: 'networkidle' })
await p.waitForTimeout(1000)
const svg = await p.$('svg[aria-label*="全景地图"]')
if (svg) await svg.screenshot({ path: '.shots/v4-atlas.png' })

// 移动端
const m = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
const mp = await m.newPage()
mp.on('pageerror', (e) => errs.push('M-PAGEERROR ' + e.message))
await mp.goto(B + '/', { waitUntil: 'networkidle' })
await mp.evaluate(() => localStorage.setItem('sereneisle.v1.intro-seen', 'true'))
await mp.reload({ waitUntil: 'networkidle' })
await mp.waitForTimeout(1000)
await mp.screenshot({ path: '.shots/v4-m-home.png', fullPage: true })

await mp.goto(B + '/play', { waitUntil: 'networkidle' })
await mp.waitForTimeout(800)
await mp.screenshot({ path: '.shots/v4-m-play.png' })

await mp.goto(B + '/mood', { waitUntil: 'networkidle' })
await mp.waitForTimeout(800)
await mp.screenshot({ path: '.shots/v4-m-mood.png' })

console.log('errors:', errs)
await b.close()
